/**
 * A reply shown as it comes — while it is being written (an agent that streams: send(message, { onProgress })), what
 * of it is already whole is told at once, by the rule a whole reply is shown by (shown.js), never otherwise:
 *
 *   told live   its leading run of told elements (dial-inform, dial-acknowledge), each once it is closed — parsing what
 *               has come so far gives only whole elements, in order, only ever added to (dial-core's streaming contract)
 *   not live    from its first element that is not simply told (a question, a proposal, a hand-over …) on: those wait
 *               for the whole reply, as they always did — nothing is told ahead of what the person must answer first;
 *               and the whole of a reply that opens with prose before its DIAL (prose is shown first, once it is whole)
 *
 * Once the reply is whole, it is handled as always, but for what was told live already: that is not told again
 * (Conversation). Every step of it is an event too — reply-progress { turn, text }, the reply so far — for a surface
 * that draws it as it comes.
 */
import { parse } from '@wity.ai/dial';
import { toldOf } from './shown.js';

export class LiveReply {
    #turn; #emit;
    #told = [];              // what was told live, in order
    #open = true;            // still taking what comes
    #done = false;           // nothing more is told live (prose leads, or an element that waits for the whole reply)
    #last = null;            // the text last read
    #reading = Promise.resolve();

    constructor(turn, emit) { this.#turn = turn; this.#emit = emit; }

    /** The reply so far — the whole of it, each time. */
    progress(text) {
        if (!this.#open) return;
        const so = String(text ?? '');
        this.#reading = this.#reading.then(() => this.#read(so)).catch(() => {});   // one at a time, in order
    }

    /** The reply is whole: nothing more is taken. What was told live, in order (once all that came is read). */
    async close() {
        this.#open = false;
        await this.#reading;
        return this.#told;
    }

    async #read(text) {
        if (text === this.#last) return;
        this.#last = text;
        this.#emit({ type: 'reply-progress', turn: this.#turn, text });
        if (this.#done) return;
        const at = text.search(/<dial/);
        const before = (at === -1 ? text : text.slice(0, at)).trim();
        // prose before the DIAL — or text that is not the start of it — leads: shown first once whole, so nothing live
        if (before && !(at === -1 && '<dial'.startsWith(before))) { this.#done = true; return; }
        if (at === -1) return;
        const envelope = await parse(text);
        const elements = envelope?.elements ?? [];
        for (let i = this.#told.length; i < elements.length; i++) {
            const told = toldOf(elements[i]);
            if (!told) { this.#done = true; return; }
            this.#told.push(told);
            this.#emit(told);
        }
    }
}
