export class NoReplyError extends Error {
    constructor(ms: any);
}
export class Conversation {
    /**
     * @param {{ agent, domain, human, onEvent?, timeoutMs?, maxTurns? }} opts
     *   onEvent(event) — every step, for a surface to render and for transcripts:
     *     sent · reply-progress (the reply so far, as it comes) · reply · inform (act: 'inform' | 'acknowledge') · ask ·
 *     suggestion · outcome · no-reply · turn-limit
     */
    constructor({ agent, domain, human, onEvent, timeoutMs, maxTurns }: {
        agent: any;
        domain: any;
        human: any;
        onEvent?: any;
        timeoutMs?: any;
        maxTurns?: any;
    });
    /**
     * The person says something; runs turns until the agent needs nothing back.
     * @param {string} text
     * @param {{ maxTurns?: number }} [o]  this message's turn limit, when it is not the conversation's (an agent whose
     *                                     domain changed — it can act now, or no longer can)
     * @returns {Promise<{ status: 'idle' | 'no-reply' | 'turn-limit', turns: number, outcomes: object[] }>}
     */
    say(text: string, { maxTurns }?: {
        maxTurns?: number;
    }): Promise<{
        status: "idle" | "no-reply" | "turn-limit";
        turns: number;
        outcomes: object[];
    }>;
    #private;
}
export const UNREADABLE_HINT: "Write the payload as plain JSON: no comments (// or /* */), nothing left out or abbreviated (no '…', no 'the rest are similar') — every item written in full.";
