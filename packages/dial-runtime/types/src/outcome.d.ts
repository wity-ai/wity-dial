/**
 * One <dial> envelope reporting these outcomes.
 * @param {{ id, action, status, preview?, result?, code?, field?, hint?, error? }[]} outcomes
 */
export function outcomeReply(outcomes: {
    id: any;
    action: any;
    status: any;
    preview?: any;
    result?: any;
    code?: any;
    field?: any;
    hint?: any;
    error?: any;
}[]): string;
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
export function readOutcomes(elements: Array<{
    type: string;
    of?: string;
    text?: string;
    contextKey?: string;
    payload?: object;
}>): any[];
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
export const OUTCOME_STATUSES: string[];
