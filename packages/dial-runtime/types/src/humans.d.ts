/**
 * Humans that aren't people — for tests and unattended runs. A surface (a TUI, an app's chat panel) provides its
 * own with the same two methods:
 *
 *   decide(suggestion) → { accept: true } | { dismiss: true } | { edit: payload } | { say: text }
 *       suggestion: { id, action, preview, text, payload, destructive }
 *       `say` = the person wrote something else instead of deciding (the suggestion is superseded)
 *   answer(ask)        → string, or '' / null for no answer (the question stands)   ask: { text, responseType, options }
 */
/** Always the same decision ('accept' or 'dismiss'); answers asks with `answerWith`. */
export function policyHuman(decision?: string, { answerWith }?: {
    answerWith?: string;
}): {
    seen: any[];
    decide(suggestion: any): Promise<{
        [x: string]: boolean;
    }>;
    answer(ask: any): Promise<string>;
};
/** Decisions and answers in order, from a script: ['accept', 'dismiss', { edit: {…} }, { say: '…' }, { answer: '…' }]. */
export function scriptedHuman(steps: any): {
    seen: any[];
    decide(suggestion: any): Promise<any>;
    answer(ask: any): Promise<any>;
};
