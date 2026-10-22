/**
 * What of a reply is the person's — what it tells, asks and proposes, in the order it was said. The one rule a reply
 * is shown by: live (Conversation's inform / ask / suggestion events come from these) and read back (a conversation's
 * history: shownOf). A surface draws it, speaks it or prints it its own way; what is shown is decided here.
 *
 *   { type: 'inform', text }                         told outside DIAL: prose around the envelope, or a reply not in DIAL
 *   { type: 'inform', text, act }                    told: a dial-inform (act 'inform') or a dial-acknowledge ('acknowledge')
 *   { type: 'ask', text, responseType, options }     asked
 *   { type: 'suggestion', action, text, outcome? }   proposed (shownOf only — live, a proposal is shown once its domain
 *                                                    has checked it: Conversation's suggestion event)
 *
 * Whatever else a reply carries — a declared value, a hand-over, a channel signal — is for the conversation, not the
 * person, and is not shown.
 */
import { parse, extractProse } from '@wity.ai/dial';

/** What a reply tells outside DIAL: a reply not in DIAL, whole; else the prose around its envelope. None when empty. */
export async function toldOutside(reply, envelope) {
    const text = envelope ? (await extractProse(reply))?.trim() : String(reply ?? '').trim();
    return text ? [{ type: 'inform', text }] : [];
}

/** What an element tells: a dial-inform or a dial-acknowledge with words. null otherwise. */
export function toldOf(el) {
    if ((el.type !== 'dial-inform' && el.type !== 'dial-acknowledge') || !el.text) return null;
    return { type: 'inform', text: el.text, act: el.type === 'dial-acknowledge' ? 'acknowledge' : 'inform' };
}

/** What an element asks: a dial-ask (its words may be empty — the question stands by its options). null otherwise. */
export function askOf(el) {
    if (el.type !== 'dial-ask') return null;
    return { type: 'ask', text: el.text ?? '', responseType: el.responseType, options: el.options ?? [] };
}

/**
 * A reply as the person saw it, read back: what it told, asked and proposed, in order. Its proposals are paired with
 * what became of them (outcomes, in the order proposed — readOutcomes); an invalid one was never shown, so is not here.
 * One superseded is here: read back, one superseded before it was shown (the person had already written something
 * else) cannot be told from one superseded after.
 * @param {string} reply
 * @param {{ status: string }[]} [outcomes]
 */
export async function shownOf(reply, outcomes = []) {
    const envelope = await parse(String(reply ?? ''));
    const shown = await toldOutside(reply, envelope);
    if (!envelope) return shown;
    let nth = 0;
    for (const el of envelope.elements) {
        const said = toldOf(el) ?? askOf(el);
        if (said) { shown.push(said); continue; }
        if (el.type !== 'dial-suggest') continue;
        const outcome = outcomes[nth++];
        if (outcome?.status === 'invalid') continue;
        shown.push({ type: 'suggestion', action: el.action ?? '', text: el.text ?? '', ...(outcome && { outcome }) });
    }
    return shown;
}
