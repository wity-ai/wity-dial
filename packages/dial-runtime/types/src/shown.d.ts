/** What a reply tells outside DIAL: a reply not in DIAL, whole; else the prose around its envelope. None when empty. */
export function toldOutside(reply: any, envelope: any): Promise<{
    type: string;
    text: string;
}[]>;
/** What an element tells: a dial-inform or a dial-acknowledge with words. null otherwise. */
export function toldOf(el: any): {
    type: string;
    text: any;
    act: string;
};
/** What an element asks: a dial-ask (its words may be empty — the question stands by its options). null otherwise. */
export function askOf(el: any): {
    type: string;
    text: any;
    responseType: any;
    options: any;
};
/**
 * A reply as the person saw it, read back: what it told, asked and proposed, in order. Its proposals are paired with
 * what became of them (outcomes, in the order proposed — readOutcomes); an invalid one was never shown, so is not here.
 * One superseded is here: read back, one superseded before it was shown (the person had already written something
 * else) cannot be told from one superseded after.
 * @param {string} reply
 * @param {{ status: string }[]} [outcomes]
 */
export function shownOf(reply: string, outcomes?: {
    status: string;
}[]): Promise<{
    type: string;
    text: string;
}[]>;
