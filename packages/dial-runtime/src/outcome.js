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
    invalid: (o) => `Not proposed to the user — the payload for ${o.action} is invalid.`,
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
