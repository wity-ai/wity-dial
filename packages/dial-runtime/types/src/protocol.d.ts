/**
 * @param {object} [o]
 * @param {{ action: string, question: string, payload: string }} [o.example]  one proposal in this domain
 * @param {string} [o.batching]  what "one action can hold many items" means in this domain
 * @returns {string} DIAL (the envelope and its elements), CONDUCT, PATTERN and OUTCOMES
 */
export function renderProtocol({ example, batching }?: {
    example?: {
        action: string;
        question: string;
        payload: string;
    };
    batching?: string;
}): string;
