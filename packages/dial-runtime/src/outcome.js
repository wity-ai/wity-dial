/**
 * Outcome replies — how the agent is told what became of a suggestion, in DIAL's own elements (no spec change):
 * `dial-acknowledge` closes the loop with a short text, `dial-declare` asserts the outcome as a fact.
 *
 *   <dial>
 *     <dial-acknowledge of="sg-3" yield="sg-3:failed">Couldn't run matrix.entry.add.</dial-acknowledge>
 *     <dial-declare context-key="outcome:sg-3">
 *       <dial-payload type="application/json">{"status":"failed","action":"matrix.entry.add",…}</dial-payload>
 *     </dial-declare>
 *   </dial>
 */

export const OUTCOME_STATUSES = ['done', 'failed', 'invalid', 'dismissed', 'superseded', 'handed-off'];

const ACK_TEXT = {
    done: (o) => `Done: ${o.preview || o.action}.`,
    failed: (o) => `Couldn't do it: ${o.preview || o.action}.`,
    invalid: (o) => (o.code === 'unknown-action'
        ? `Not proposed to the user — there is no action ${o.action} here.`
        : `Not proposed to the user — the payload for ${o.action} is invalid.`),
    dismissed: (o) => `The user dismissed: ${o.preview || o.action}.`,
    superseded: (o) => `The user moved on without deciding: ${o.preview || o.action}.`,
    'handed-off': (o) => `Passed to the user in its own panel: ${o.preview || o.action}.`,
};

const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');

/**
 * One <dial> envelope reporting these outcomes.
 * @param {{ id, action, status, preview?, result?, code?, field?, hint?, error? }[]} outcomes
 */
export function outcomeReply(outcomes) {
    const parts = outcomes.map((o) => {
        if (!OUTCOME_STATUSES.includes(o.status)) throw new Error(`outcomeReply: unknown status '${o.status}'`);
        const { id, preview, ...fact } = o;
        const body = JSON.stringify(fact).replace(/</g, '\\u003c');      // a payload can't close its own element
        return `  <dial-acknowledge of="${escapeAttr(id)}" yield="${escapeAttr(`${id}:${o.status}`)}">${escapeText(ACK_TEXT[o.status](o))}</dial-acknowledge>\n`
            + `  <dial-declare context-key="${escapeAttr(`outcome:${id}`)}">\n    <dial-payload type="application/json">${body}</dial-payload>\n  </dial-declare>`;
    });
    return `<dial>\n${parts.join('\n')}\n</dial>`;
}

const OUTCOME_KEY = 'outcome:';

/**
 * What an outcome reply (outcomeReply) says, read back as data — for whoever reads a conversation's history (the chat
 * rebuilding its proposal cards): each outcome, in the order reported: { id, action, status, preview?, result?, code?,
 * field?, hint?, error?, edited? }. The reply's own format is read here, where it is written: the fact is the declare's
 * payload; the preview (what was proposed, its price included — "Make 2 images · 50 credits") is in the
 * acknowledgement's words (ACK_TEXT), and read from there.
 *
 * @param {Array<{ type: string, of?: string, text?: string, contextKey?: string, payload?: object }>} elements
 *        a reply's parsed elements (@wity-ai/dial parse(…).elements); anything that is not an outcome is ignored
 */
export function readOutcomes(elements) {
    const acks = new Map((elements ?? []).filter((e) => e?.type === 'dial-acknowledge' && e.of).map((e) => [e.of, e.text ?? '']));
    return (elements ?? [])
        .filter((e) => e?.type === 'dial-declare' && typeof e.contextKey === 'string' && e.contextKey.startsWith(OUTCOME_KEY) && e.payload && typeof e.payload === 'object')
        .map((e) => {
            const id = e.contextKey.slice(OUTCOME_KEY.length);
            const fact = e.payload;
            const preview = previewFromAck(fact.status, acks.get(id));
            return { id, ...fact, ...(preview ? { preview } : {}) };
        });
}

/** An acknowledgement's preview, by its status's words: "Done: <preview>." → "<preview>" (none for invalid). */
function previewFromAck(status, text) {
    if (!text || !ACK_TEXT[status] || status === 'invalid') return undefined;
    const marker = '\u0000';
    const [before, after] = ACK_TEXT[status]({ preview: marker, action: marker }).split(marker);
    const unescaped = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    if (!unescaped.startsWith(before) || !unescaped.endsWith(after)) return undefined;
    const preview = unescaped.slice(before.length, unescaped.length - after.length);
    return preview || undefined;
}
