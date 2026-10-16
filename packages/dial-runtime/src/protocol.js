/**
 * The protocol an assistant follows in a conversation run by this runtime — how it works with the person, how it
 * proposes an action, and what comes back — in one text, for every action vector (wity-authoring's for boards,
 * wity-scene-authoring's for compositions). A domain's renderer adds only what is its own: an example, its ids.
 *
 * The outcomes are described from OUTCOME_STATUSES — the statuses this runtime reports (outcome.js) — so a status
 * cannot be reported without the assistant having been told what it means.
 */
import { OUTCOME_STATUSES } from './outcome.js';

const ENVELOPE = `DIAL — every response is one <dial>…</dial> envelope, never text outside it:
  <dial-inform>             say something: an answer, an idea, content they asked for, why you propose what follows
  <dial-ask>                ask one question
  <dial-acknowledge>        confirm briefly that something was done
  <dial-suggest> + <dial-declare>   propose one action (PATTERN below)
  Deliver what you say you will in the same response — never only announce it ("Let me…", "I'll…").`;

const CONDUCT = `CONDUCT — how you work with the person:
  - Talk an idea through before proposing anything. When they ask for help with an idea, or what they want is not
    settled yet (what it is for, who it is for, its tone, its form), answer in words and ask — one question at a
    time — or offer a few directions to choose from.
  - Propose an action when they ask for one, or once what to make is agreed.
  - Never propose making media (an image, a video, a sound) on a guess: its prompt comes from what was agreed, and
    making it costs the person credits.
  - One action per response. When its outcome comes back, propose the next step of what was agreed; each one is
    confirmed by the person.
  - Before an action that removes something, say in a dial-inform what will be lost.
  - Only the actions listed here can be proposed. One the context says is not available here cannot be done on this
    surface: say so, and where it can be done.`;

const MEANING = {
    done: 'it ran. "result" is what it returned (new ids, or what a read returned) — use it; go on to the next step or tell the user.',
    failed: 'it was refused when it ran: "error" (and "hint" when there is a way to fix it). Correct it and propose again once if the hint says how; otherwise tell the user.',
    invalid: 'it did not fit — an action there is not here, or a payload that does not fit it; the user never saw it. "field" and "hint" say what to fix. Correct it and propose again; don\'t tell the user about it.',
    dismissed: "the user declined. Don't propose the same thing again — go on, or ask.",
    superseded: 'the user wrote something else instead of deciding — answer what they wrote.',
    'handed-off': 'it was passed to its own panel. Nothing more to do.',
};

const wrap = (text, indent, width = 118) => {
    const lines = []; let line = '';
    for (const word of text.split(' ')) {
        if (line && indent + line.length + 1 + word.length > width) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
    return lines.join(`\n${' '.repeat(indent)}`);
};

/**
 * @param {object} [o]
 * @param {{ action: string, question: string, payload: string }} [o.example]  one proposal in this domain
 * @param {string} [o.batching]  what "one action can hold many items" means in this domain
 * @returns {string} DIAL (the envelope and its elements), CONDUCT, PATTERN and OUTCOMES
 */
export function renderProtocol({ example, batching } = {}) {
    const missing = OUTCOME_STATUSES.filter((s) => !MEANING[s]);
    if (missing.length) throw new Error(`renderProtocol: no meaning for outcome status ${missing.join(', ')}`);
    const camel = (name) => name.split(/[.-]/).map((p, i) => (i ? p[0].toUpperCase() + p.slice(1) : p)).join('');
    const pattern = `${wrap(`PATTERN — one action per response (one action can hold many items${batching ? `: ${batching}` : ''}):`, 0)}
  <dial-suggest action="<action>">Short human question?</dial-suggest>
  <dial-declare context-key="<actionCamel>Suggestion">{ JSON payload }</dial-declare>${example ? `
  e.g. <dial-suggest action="${example.action}">${example.question}</dial-suggest>
       <dial-declare context-key="${camel(example.action)}Suggestion">${example.payload}</dial-declare>` : ''}
Payload fields are exact: an unknown or misspelled field is rejected. Never invent an id: use only ids from the
context, or from an outcome.`;
    const later = OUTCOME_STATUSES.filter((s) => ['dismissed', 'superseded', 'handed-off'].includes(s));
    const outcomes = `OUTCOMES — what happened to each action you proposed comes back as DIAL, one pair per action:
  <dial-acknowledge of="ID" yield="ID:STATUS">…</dial-acknowledge>
  <dial-declare context-key="outcome:ID">{"status":"STATUS","action":"<action>", …}</dial-declare>
${OUTCOME_STATUSES.map((s) => `  ${s.padEnd(11)} ${wrap(MEANING[s], 14)}`).join('\n')}
A ${later.join(' / ')} outcome arrives together with the user's next message.`;
    return `${ENVELOPE}\n\n${CONDUCT}\n\n${pattern}\n\n${outcomes}\n`;
}
