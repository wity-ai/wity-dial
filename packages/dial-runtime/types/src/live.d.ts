export class LiveReply {
    constructor(turn: any, emit: any);
    /** The reply so far — the whole of it, each time. */
    progress(text: any): void;
    /** The reply is whole: nothing more is taken. What was told live, in order (once all that came is read). */
    close(): Promise<any[]>;
    #private;
}
