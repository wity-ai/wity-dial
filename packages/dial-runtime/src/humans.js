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
export function policyHuman(decision = 'accept', { answerWith = '' } = {}) {
    if (!['accept', 'dismiss'].includes(decision)) throw new Error(`policyHuman: '${decision}' is not accept or dismiss`);
    const seen = [];
    return {
        seen,
        async decide(suggestion) { seen.push(suggestion); return { [decision]: true }; },
        async answer(ask) { seen.push(ask); return answerWith; },
    };
}

/** Decisions and answers in order, from a script: ['accept', 'dismiss', { edit: {…} }, { say: '…' }, { answer: '…' }]. */
export function scriptedHuman(steps) {
    const queue = [...steps];
    const seen = [];
    const next = (kind) => {
        if (!queue.length) throw new Error(`scriptedHuman: no scripted step left for this ${kind}`);
        return queue.shift();
    };
    return {
        seen,
        async decide(suggestion) {
            seen.push(suggestion);
            const step = next('decision');
            if (step === 'accept' || step === 'dismiss') return { [step]: true };
            if (step && typeof step === 'object' && ('edit' in step || 'say' in step)) return step;
            throw new Error(`scriptedHuman: expected a decision, got ${JSON.stringify(step)}`);
        },
        async answer(ask) {
            seen.push(ask);
            const step = next('ask');
            if (step && typeof step === 'object' && 'answer' in step) return step.answer;
            throw new Error(`scriptedHuman: expected { answer }, got ${JSON.stringify(step)}`);
        },
    };
}
