/**
 * Conformance — a reply that is not in DIAL is asked for again, once. A model sometimes answers in plain prose even
 * with every instruction in place; prose carries no proposal, so the person has nothing to accept and "ok" / "go
 * ahead" only goes round again. The conversation (conversation.js) checks each reply with the parser it runs on; one
 * with no DIAL is not shown — the agent is asked, by the message below, to give it again as DIAL, and the reply to
 * that is used. A second miss is shown as it is (as before this existed): never worse than without it.
 *
 * The request is a <dial-context> with protocol="reply-again", so whoever reads a conversation's history (the chat
 * rebuilding it) knows the reply before it was asked again, and shows only what was shown live (isReplyAgain).
 */

const MARK = 'protocol="reply-again"';

/** What the agent is sent when its reply was not in DIAL. */
export const REPLY_AGAIN = `<dial-context ${MARK}>Your last reply was not in DIAL, so the person could not act on it. ` +
    'Give that reply again as one <dial>…</dial> envelope: what you tell in a dial-inform, what you ask in a dial-ask, ' +
    'and what they asked for proposed — a dial-suggest with its declare, choosing what was left open and saying what you chose.</dial-context>';

/** Whether a message is the request to reply again in DIAL (REPLY_AGAIN) — in a conversation's history. */
export const isReplyAgain = (text) => typeof text === 'string' && text.includes(`<dial-context ${MARK}>`);
