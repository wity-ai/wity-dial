/**
 * Conversation — one conversation with an agent: the turn loop and the suggestion lifecycle.
 *
 * Each turn: send [outcomes of the last turn] + the domain's context + the person's words → the agent replies in
 * DIAL → its elements are handled in order:
 *
 *   dial-inform / dial-acknowledge   → shown (onEvent 'inform')
 *   dial-ask                         → the human answers; the answer goes back on the next turn
 *   dial-suggest (+ its declare)     → a suggestion:
 *        unknown action / invalid payload → outcome 'invalid', never shown to the human
 *        read-only action                 → run at once → 'done' (with its result) or 'failed'
 *        otherwise the human decides:
 *          accept  → run → 'done' / 'failed'
 *          edit    → the edited payload is validated (the human sees why if not) and run
 *          dismiss → 'dismissed'
 *          say     → the person wrote something else: this and the reply's remaining suggestions are
 *                    'superseded', and the new words go with the next turn
 *
 * Every suggestion ends in exactly one outcome, and the agent is told it (see outcome.js). The loop continues while
 * there is something to tell the agent, and stops when a reply needs nothing back, when the agent doesn't answer
 * in time ('no-reply'), or after maxTurns ('turn-limit').
 *
 * Domain — the vocabulary this conversation acts on:
 *   actions:  { [name]: { mutates: boolean, destructive?: boolean } }
 *   validate(action, payload) → { ok: true } | { ok: false, code, field?, hint }
 *   preview(action, payload)  → short human text, e.g. "Add 'Strong brand' to Strengths"
 *   run(action, payload)      → result (may be async); throws on failure — { message, code?, field?, hint? }
 *   context()                 → text sent with every turn (e.g. a board snapshot), or ''
 */
import { parse, extractProse } from '@wity.ai/dial';
import { outcomeReply } from './outcome.js';

export class NoReplyError extends Error {
    constructor(ms) { super(`The agent didn't reply within ${Math.round(ms / 1000)}s`); this.name = 'NoReplyError'; }
}

const MAX_EDIT_ATTEMPTS = 3;

export class Conversation {
    #agent; #domain; #human; #onEvent; #timeoutMs; #maxTurns;
    #count = 0;
    #pendingText = null;                 // words the person wrote while a suggestion was pending

    /**
     * @param {{ agent, domain, human, onEvent?, timeoutMs?, maxTurns? }} opts
     *   onEvent(event) — every step, for a surface to render and for transcripts:
     *     sent · reply · inform · ask · suggestion · outcome · no-reply · turn-limit
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
     * @returns {Promise<{ status: 'idle' | 'no-reply' | 'turn-limit', turns: number, outcomes: object[] }>}
     */
    async say(text) {
        const allOutcomes = [];
        let words = text;
        let outcomes = [];
        for (let turn = 1; ; turn++) {
            if (turn > this.#maxTurns) {
                this.#onEvent({ type: 'turn-limit', turns: this.#maxTurns });
                return { status: 'turn-limit', turns: this.#maxTurns, outcomes: allOutcomes };
            }
            const message = this.#compose(outcomes, words);
            this.#onEvent({ type: 'sent', turn, message });
            let reply;
            try {
                reply = await this.#send(message);
            } catch (e) {
                if (!(e instanceof NoReplyError)) throw e;
                this.#onEvent({ type: 'no-reply', turn, error: e.message });
                return { status: 'no-reply', turns: turn, outcomes: allOutcomes };
            }
            this.#onEvent({ type: 'reply', turn, text: reply });

            const { outcomes: next, answer } = await this.#handle(reply);
            allOutcomes.push(...next);
            outcomes = next;
            words = this.#pendingText ?? answer ?? null;
            this.#pendingText = null;
            if (!outcomes.length && words === null) return { status: 'idle', turns: turn, outcomes: allOutcomes };
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

    #send(message) {
        let timer;
        const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(new NoReplyError(this.#timeoutMs)), this.#timeoutMs); });
        return Promise.race([Promise.resolve(this.#agent.send(message)), limit]).finally(() => clearTimeout(timer));
    }

    // One reply's elements, in order → the outcomes to report and an ask's answer (if any)
    async #handle(reply) {
        const envelope = parse(reply);
        if (!envelope) {
            const text = String(reply ?? '').trim();
            if (text) this.#onEvent({ type: 'inform', text });
            return { outcomes: [] };
        }
        const prose = extractProse(reply)?.trim();
        if (prose) this.#onEvent({ type: 'inform', text: prose });

        const outcomes = [];
        let answer;
        const elements = envelope.elements;
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            if (el.type === 'dial-inform' || el.type === 'dial-acknowledge') {
                if (el.text) this.#onEvent({ type: 'inform', text: el.text });
            } else if (el.type === 'dial-ask') {
                const ask = { text: el.text ?? '', responseType: el.responseType, options: el.options ?? [] };
                this.#onEvent({ type: 'ask', ...ask });
                if (this.#pendingText === null) answer = String(await this.#human.answer(ask) ?? '');
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
        // the person already moved on (wrote something while an earlier suggestion of this reply was pending)
        if (this.#pendingText !== null) { suggestion.preview = this.#preview(action, payload); return outcome('superseded'); }

        const check = this.#domain.validate(action, payload);
        if (!check.ok) return outcome('invalid', issue(check));
        suggestion.preview = this.#preview(action, payload);
        this.#onEvent({ type: 'suggestion', ...suggestion, mutates: spec.mutates });

        if (!spec.mutates) return this.#run(action, payload, outcome);

        let current = payload;
        for (let attempt = 0; ; attempt++) {
            const decision = await this.#human.decide({ ...suggestion, payload: current });
            if (decision?.dismiss) return outcome('dismissed');
            if (typeof decision?.say === 'string') { this.#pendingText = decision.say; return outcome('superseded'); }
            if (decision?.edit !== undefined) {
                const edited = this.#domain.validate(action, decision.edit);
                if (!edited.ok) {
                    if (attempt + 1 >= MAX_EDIT_ATTEMPTS) return outcome('invalid', issue(edited));
                    suggestion.issue = issue(edited);              // the human sees why, and decides again
                    current = decision.edit;
                    continue;
                }
                current = decision.edit;
                suggestion.preview = this.#preview(action, current);
                return this.#run(action, current, outcome, { edited: true });
            }
            if (decision?.accept) return this.#run(action, current, outcome);
            throw new Error(`Conversation: the human's decision must be accept, dismiss, edit or say — got ${JSON.stringify(decision)}`);
        }
    }

    async #run(action, payload, outcome, extra = {}) {
        try {
            const result = await this.#domain.run(action, payload);
            return outcome('done', { result, ...extra });
        } catch (e) {
            return outcome('failed', { error: e?.message ?? String(e), ...pick(e, ['code', 'field', 'hint']), ...extra });
        }
    }

    #preview(action, payload) {
        try { return this.#domain.preview?.(action, payload) || action; } catch { return action; }
    }
}

function readPayload(declare) {
    if (declare.payload !== null && declare.payload !== undefined) return declare.payload;
    const text = declare.text?.trim();
    if (!text) return undefined;
    try { return JSON.parse(text); } catch { return undefined; }
}

const issue = (check) => pick(check, ['code', 'field', 'hint']);
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
