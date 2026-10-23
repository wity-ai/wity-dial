/**
 * Conversation — one conversation with an agent: the turn loop and the suggestion lifecycle.
 *
 * Each turn: send [outcomes of the last turn] + the domain's context + the person's words → the agent replies in
 * DIAL → its elements are handled in order:
 *
 *   dial-inform / dial-acknowledge   → shown (onEvent 'inform')
 *   dial-ask                         → the human answers; the answer goes back on the next turn (no answer → no turn)
 *   dial-suggest (+ its declare)     → a suggestion:
 *        unknown action / invalid payload → outcome 'invalid', never shown to the human
 *        read-only action                 → run at once → 'done' (with its result) or 'failed'
 *        hand-off action                  → run at once → 'handed-off': another part of the surface takes the
 *                                           proposal over (its own form, its own accept); the agent is told with
 *                                           the person's next words, like a dismissal
 *        otherwise the human decides:
 *          accept  → run → 'done' / 'failed'
 *          edit    → the edited payload is validated (the human sees why if not) and run
 *          dismiss → 'dismissed' (reported with the person's next words — a dismissal alone starts no turn)
 *          say     → the person wrote something else: this and the reply's remaining suggestions are
 *                    'superseded', and the new words go with the next turn
 *
 * A reply that is not in DIAL carries nothing to act on: it is asked for again, once (conformance.js), and the reply
 * shown is the one in DIAL — else the latest, as text. Asking again is not a turn of its own.
 *
 * Every suggestion ends in exactly one outcome, and the agent is told it (see outcome.js). The loop continues while
 * there is something to tell the agent, and stops when a reply needs nothing back, when the agent doesn't answer
 * in time ('no-reply'), or after maxTurns ('turn-limit'). What the agent wasn't told — the send failed, or it
 * didn't answer — is kept and goes with the next thing the person says: the outcomes, and words the person gave
 * inside the conversation (an answer to its question, or what they wrote instead of deciding). say('') sends just that.
 *
 * An agent that streams its reply — send(message, { onProgress }), onProgress(the reply so far) — has what of it is
 * whole told as it comes (live.js): its leading informs and acknowledgements, each once; the rest when it is whole,
 * as always. An agent that does not stream is as before.
 *
 * Runs wherever the parser does: in Node its parse() is synchronous, in a browser it returns a promise (the
 * WebAssembly loads on first use) — both are awaited.
 *
 * Domain — the vocabulary this conversation acts on:
 *   actions:  { [name]: { mutates: boolean, destructive?: boolean, handoff?: boolean } }
 *   validate(action, payload) → { ok: true } | { ok: false, code, field?, hint }
 *   preview(action, payload)  → short human text, e.g. "Add 'Strong brand' to Strengths" — or a promise of it
 *   run(action, payload)      → result (may be async); throws on failure — { message, code?, field?, hint? }
 *   context()                 → text sent with every turn (e.g. a board snapshot), or ''
 */
import { parse } from '@wity.ai/dial';
import { outcomeReply } from './outcome.js';
import { toldOutside, toldOf, askOf } from './shown.js';
import { REPLY_AGAIN } from './conformance.js';
import { LiveReply } from './live.js';

export class NoReplyError extends Error {
    constructor(ms) { super(`The agent didn't reply within ${Math.round(ms / 1000)}s`); this.name = 'NoReplyError'; }
}

const MAX_EDIT_ATTEMPTS = 3;

export class Conversation {
    #agent; #domain; #human; #onEvent; #timeoutMs; #maxTurns;
    #count = 0;
    #pendingText = null;                 // words the person wrote while a suggestion was pending
    #undelivered = [];                   // outcomes the agent hasn't been told yet (a send failed / no reply)
    #unsentWords = null;                 // the person's words from inside a turn that never reached the agent

    /**
     * @param {{ agent, domain, human, onEvent?, timeoutMs?, maxTurns? }} opts
     *   onEvent(event) — every step, for a surface to render and for transcripts:
     *     sent · reply-progress (the reply so far, as it comes) · reply · inform (act: 'inform' | 'acknowledge') · ask ·
 *     suggestion · outcome · no-reply · turn-limit
     */
    constructor({ agent, domain, human, onEvent = () => {}, timeoutMs = 90_000, maxTurns = 8 }) {
        for (const [name, value, method] of [['agent', agent, 'send'], ['human', human, 'decide'], ['domain', domain, 'run']]) {
            if (typeof value?.[method] !== 'function') throw new Error(`Conversation: ${name} needs a ${method}() method`);
        }
        this.#agent = agent; this.#domain = domain; this.#human = human;
        this.#onEvent = onEvent; this.#timeoutMs = timeoutMs; this.#maxTurns = maxTurns;
    }

    /**
     * The person says something; runs turns until the agent needs nothing back.
     * @param {string} text
     * @param {{ maxTurns?: number }} [o]  this message's turn limit, when it is not the conversation's (an agent whose
     *                                     domain changed — it can act now, or no longer can)
     * @returns {Promise<{ status: 'idle' | 'no-reply' | 'turn-limit', turns: number, outcomes: object[] }>}
     */
    async say(text, { maxTurns = this.#maxTurns } = {}) {
        const allOutcomes = [];
        let words = [this.#unsentWords, text].filter((w) => w !== null && w !== undefined && w !== '').join('\n\n');
        let outcomes = this.#undelivered;
        this.#undelivered = [];
        this.#unsentWords = null;
        // what this turn owes the agent stays owed if it can't be delivered (the first turn's words are the caller's)
        const keep = (turn) => { this.#undelivered = outcomes; if (turn > 1) this.#unsentWords = words; };
        for (let turn = 1; ; turn++) {
            if (turn > maxTurns) {
                keep(turn);
                this.#onEvent({ type: 'turn-limit', turns: maxTurns });
                return { status: 'turn-limit', turns: maxTurns, outcomes: allOutcomes };
            }
            const message = this.#compose(outcomes, words);
            this.#onEvent({ type: 'sent', turn, message });
            // what of the reply is whole is told as it comes, when the agent streams it (live.js)
            const live = new LiveReply(turn, (e) => this.#onEvent(e));
            let reply;
            try {
                reply = await this.#send(message, live);
            } catch (e) {
                await live.close();
                keep(turn);
                if (!(e instanceof NoReplyError)) throw e;
                this.#onEvent({ type: 'no-reply', turn, error: e.message });
                return { status: 'no-reply', turns: turn, outcomes: allOutcomes };
            }
            // a reply not in DIAL is asked for again, once — it carries nothing to act on (conformance.js); the reply
            // shown is the one in DIAL, else the latest (never worse than before)
            const toldLive = await live.close();
            reply = await this.#conform(reply, turn);
            this.#onEvent({ type: 'reply', turn, text: reply });

            const { outcomes: next, answer } = await this.#handle(reply, toldLive);
            allOutcomes.push(...next);
            outcomes = next;
            words = this.#pendingText ?? answer ?? null;
            this.#pendingText = null;
            // a turn follows only when there is something the agent should react to now: the person's words, or an
            // action that ran / couldn't. A dismissal alone waits — it goes with the next thing the person says.
            if (words === null && !outcomes.some(needsReply)) {
                this.#undelivered = outcomes;
                return { status: 'idle', turns: turn, outcomes: allOutcomes };
            }
        }
    }

    // [outcomes] + context + words — whichever there are
    #compose(outcomes, words) {
        const parts = [];
        if (outcomes.length) parts.push(outcomeReply(outcomes));
        const context = this.#domain.context?.() ?? '';
        if (context) parts.push(context);
        if (words !== null && words !== undefined && words !== '') parts.push(words);
        return parts.join('\n\n');
    }

    // the reply to use: as it is when it is DIAL (or empty); else what the agent gives when asked again (REPLY_AGAIN),
    // or the first if it gives nothing in time. Not a turn of its own: the turn limit is the person's turns.
    async #conform(reply, turn) {
        if (!String(reply ?? '').trim() || await parse(reply)) return reply;
        this.#onEvent({ type: 'off-protocol', turn, text: reply });
        try {
            const again = await this.#send(REPLY_AGAIN);
            return String(again ?? '').trim() ? again : reply;
        } catch (e) {
            if (!(e instanceof NoReplyError)) throw e;
            return reply;
        }
    }

    // an agent that streams its reply is told where (onProgress: the reply so far); one that does not, ignores it
    #send(message, live) {
        let timer;
        const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(new NoReplyError(this.#timeoutMs)), this.#timeoutMs); });
        const sent = this.#agent.send(message, live ? { onProgress: (text) => live.progress(text) } : undefined);
        return Promise.race([Promise.resolve(sent), limit]).finally(() => clearTimeout(timer));
    }

    // One reply's elements, in order → the outcomes to report and an ask's answer (if any). toldLive: what of it was
    // told as it came (live.js) — its leading told elements, in order — not told again.
    async #handle(reply, toldLive = []) {
        const already = [...toldLive];
        // what is shown is decided in one place (shown.js) — live here, and when a reply is read back
        const envelope = await parse(reply);
        for (const told of await toldOutside(reply, envelope)) this.#onEvent(told);
        if (!envelope) return { outcomes: [] };

        const outcomes = [];
        let answer;
        const elements = envelope.elements;
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            const told = toldOf(el);
            const asked = askOf(el);
            if (told) {
                if (already.length && already[0].text === told.text && already[0].act === told.act) already.shift();
                else { already.length = 0; this.#onEvent(told); }
            } else if (asked) {
                this.#onEvent(asked);
                const { type: _, ...ask } = asked;
                if (this.#pendingText === null) {
                    // no answer (null / empty) = the person hasn't answered: the question stands and no turn follows
                    const given = String(await this.#human.answer(ask) ?? '');
                    if (given.trim()) answer = given;
                }
            } else if (el.type === 'dial-suggest') {
                // its payload: its own <dial-payload>, else the declare that follows it
                let payload = el.payload ?? undefined;
                if (payload === undefined && elements[i + 1]?.type === 'dial-declare') {
                    payload = readPayload(elements[i + 1]);
                    i++;
                }
                outcomes.push(await this.#suggestion(el, payload ?? {}));
            }
        }
        return { outcomes, answer };
    }

    async #suggestion(el, payload) {
        const id = el.id || `sg-${++this.#count}`;
        const action = el.action ?? '';
        const spec = this.#domain.actions?.[action];
        const outcome = (status, extra = {}) => {
            const o = { id, action, status, preview: suggestion.preview, ...extra };
            this.#onEvent({ type: 'outcome', ...o });
            return o;
        };
        const suggestion = { id, action, text: el.text ?? '', payload, preview: '', destructive: !!spec?.destructive };

        if (!spec) return outcome('invalid', { code: 'unknown-action', hint: `There is no action '${action}'.` });
        if (payload?.[UNREADABLE]) return outcome('invalid', { code: 'unreadable-payload', hint: `The payload is not JSON (${payload[UNREADABLE]}). ${UNREADABLE_HINT}` });
        // the person already moved on (wrote something while an earlier suggestion of this reply was pending)
        if (this.#pendingText !== null) { suggestion.preview = await this.#preview(action, payload); return outcome('superseded'); }

        const check = await this.#domain.validate(action, payload);   // a domain may check where the work is kept
        if (!check.ok) return outcome('invalid', issue(check));
        suggestion.preview = await this.#preview(action, payload);
        this.#onEvent({ type: 'suggestion', ...suggestion, mutates: spec.mutates });

        if (spec.handoff) return this.#run(action, payload, outcome, {}, 'handed-off');
        if (!spec.mutates) return this.#run(action, payload, outcome);

        let current = payload;
        for (let attempt = 0; ; attempt++) {
            const decision = await this.#human.decide({ ...suggestion, payload: current });
            if (decision?.dismiss) return outcome('dismissed');
            if (typeof decision?.say === 'string') { this.#pendingText = decision.say; return outcome('superseded'); }
            if (decision?.edit !== undefined) {
                const edited = await this.#domain.validate(action, decision.edit);
                if (!edited.ok) {
                    if (attempt + 1 >= MAX_EDIT_ATTEMPTS) return outcome('invalid', issue(edited));
                    suggestion.issue = issue(edited);              // the human sees why, and decides again
                    current = decision.edit;
                    continue;
                }
                current = decision.edit;
                suggestion.preview = await this.#preview(action, current);
                return this.#run(action, current, outcome, { edited: true });
            }
            if (decision?.accept) return this.#run(action, current, outcome);
            throw new Error(`Conversation: the human's decision must be accept, dismiss, edit or say — got ${JSON.stringify(decision)}`);
        }
    }

    async #run(action, payload, outcome, extra = {}, status = 'done') {
        try {
            const result = await this.#domain.run(action, payload);
            return outcome(status, { ...(result !== undefined ? { result } : {}), ...extra });
        } catch (e) {
            return outcome('failed', { error: e?.message ?? String(e), ...pick(e, ['code', 'field', 'hint']), ...extra });
        }
    }

    // a preview may be a promise — what it costs, asked of the service that makes it; one that fails reads as the action
    async #preview(action, payload) {
        try { return (await this.#domain.preview?.(action, payload)) || action; } catch { return action; }
    }
}

/**
 * A declare's payload — or UNREADABLE (with why) when its text is not JSON: the agent is told that, not that the
 * fields it did write are missing (a comment or a "…" in it made the whole of it unreadable).
 */
const UNREADABLE = Symbol('unreadable payload');
function readPayload(declare) {
    if (declare.payload !== null && declare.payload !== undefined) return declare.payload;
    const text = declare.text?.trim();
    if (!text) return undefined;
    try { return JSON.parse(text); } catch (e) { return { [UNREADABLE]: e?.message ?? 'not JSON' }; }
}
export const UNREADABLE_HINT = "Write the payload as plain JSON: no comments (// or /* */), nothing left out or abbreviated (no '…', no 'the rest are similar') — every item written in full.";

// what the agent should react to now — the rest (dismissed, superseded, handed-off) waits for the person's next words
const needsReply = (outcome) => ['done', 'failed', 'invalid'].includes(outcome.status);
const issue = (check) => pick(check, ['code', 'field', 'hint']);
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
