import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '@wity.ai/dial';
import { Conversation, outcomeReply, policyHuman, scriptedHuman } from '../index.js';

// A small domain: a list of notes. add-note needs text; remove-note is destructive; list-notes reads.
function notesDomain() {
    const notes = [];
    return {
        notes,
        actions: { 'add-note': { mutates: true }, 'remove-note': { mutates: true, destructive: true }, 'list-notes': { mutates: false } },
        validate(action, p) {
            if (action === 'add-note' && (typeof p.text !== 'string' || !p.text.trim())) return { ok: false, code: 'invalid-payload', field: 'text', hint: 'text is required' };
            if (action === 'remove-note' && typeof p.index !== 'number') return { ok: false, code: 'invalid-payload', field: 'index', hint: 'index must be a number' };
            return { ok: true };
        },
        preview(action, p) {
            return action === 'add-note' ? `Add the note '${p.text}'` : action === 'remove-note' ? `Remove note ${p.index}` : 'List the notes';
        },
        run(action, p) {
            if (action === 'add-note') { notes.push(p.text); return { count: notes.length }; }
            if (action === 'remove-note') { if (!notes[p.index]) throw Object.assign(new Error(`No note ${p.index}`), { code: 'not-found', hint: 'list-notes gives the indices' }); return { removed: notes.splice(p.index, 1)[0] }; }
            return { notes: [...notes] };
        },
        context: () => `<context notes="${notes.length}"/>`,
    };
}

// An agent that answers from a script, one reply per turn, and records what it was sent
function scriptedAgent(replies) {
    const sent = [];
    return { sent, async send(message) { sent.push(message); if (!replies.length) throw new Error('scriptedAgent: no reply left'); return replies.shift(); } };
}
const suggest = (action, payload, text = 'Shall I?', id) =>
    `<dial-suggest action="${action}"${id ? ` id="${id}"` : ''}>${text}</dial-suggest><dial-declare context-key="x">${JSON.stringify(payload)}</dial-declare>`;
const dial = (...parts) => `<dial>${parts.join('')}</dial>`;
const outcomesIn = (message) => (parse(message)?.elements || []).filter((e) => e.type === 'dial-declare').map((e) => e.payload ?? JSON.parse(e.text));

test('accepted suggestion → runs → the agent is told it was done, with the result; then the turn ends', async () => {
    const domain = notesDomain();
    const agent = scriptedAgent([
        dial('<dial-inform>Adding it.</dial-inform>', suggest('add-note', { text: 'Strong brand' }, "Add 'Strong brand'?")),
        dial('<dial-acknowledge>Done — added.</dial-acknowledge>'),
    ]);
    const human = policyHuman('accept');
    const events = [];
    const conv = new Conversation({ agent, domain, human, onEvent: (e) => events.push(e.type) });
    const r = await conv.say('add strong brand');
    assert.equal(r.status, 'idle'); assert.equal(r.turns, 2);
    assert.deepEqual(domain.notes, ['Strong brand']);
    // the human saw the domain's preview and the agent's own question
    assert.equal(human.seen[0].preview, "Add the note 'Strong brand'"); assert.equal(human.seen[0].text, "Add 'Strong brand'?");
    // turn 1 = context + words; turn 2 = the outcome + context, no words
    assert.match(agent.sent[0], /<context notes="0"\/>\n\nadd strong brand$/);
    assert.deepEqual(outcomesIn(agent.sent[1]), [{ action: 'add-note', status: 'done', result: { count: 1 } }]);
    assert.match(agent.sent[1], /<dial-acknowledge of="sg-1" yield="sg-1:done">Done: Add the note 'Strong brand'.<\/dial-acknowledge>/);
    assert.match(agent.sent[1], /<context notes="1"\/>$/);
    assert.deepEqual(events, ['sent', 'reply', 'inform', 'suggestion', 'outcome', 'sent', 'reply', 'inform']);
});

test('invalid payload → never shown to the human; the agent gets code, field and hint and can correct itself', async () => {
    const domain = notesDomain();
    const agent = scriptedAgent([dial(suggest('add-note', { text: '' })), dial(suggest('add-note', { text: 'Fixed' })), dial('<dial-inform>ok</dial-inform>')]);
    const human = policyHuman('accept');
    const r = await new Conversation({ agent, domain, human }).say('add a note');
    assert.equal(human.seen.length, 1, 'only the valid one reached the human');
    assert.deepEqual(outcomesIn(agent.sent[1]), [{ action: 'add-note', status: 'invalid', code: 'invalid-payload', field: 'text', hint: 'text is required' }]);
    assert.deepEqual(domain.notes, ['Fixed']); assert.equal(r.turns, 3);
});

test('unknown action → invalid, not shown', async () => {
    const agent = scriptedAgent([dial(suggest('fly', {})), dial('<dial-inform>sorry</dial-inform>')]);
    const human = policyHuman('accept');
    await new Conversation({ agent, domain: notesDomain(), human }).say('x');
    assert.equal(human.seen.length, 0);
    assert.deepEqual(outcomesIn(agent.sent[1]), [{ action: 'fly', status: 'invalid', code: 'unknown-action', hint: "There is no action 'fly'." }]);
});

test('read-only actions run without asking; failures carry the error, code and hint', async () => {
    const domain = notesDomain();
    const agent = scriptedAgent([dial(suggest('list-notes', {}), suggest('remove-note', { index: 7 })), dial('<dial-inform>ok</dial-inform>')]);
    const human = policyHuman('accept');
    await new Conversation({ agent, domain, human }).say('clean up');
    assert.equal(human.seen.length, 1, 'only the mutating one was decided');
    assert.equal(human.seen[0].destructive, true);
    assert.deepEqual(outcomesIn(agent.sent[1]), [
        { action: 'list-notes', status: 'done', result: { notes: [] } },
        { action: 'remove-note', status: 'failed', error: 'No note 7', code: 'not-found', hint: 'list-notes gives the indices' },
    ]);
});

test('dismissed → nothing runs and no turn is spent; the agent is told with the next thing the person says', async () => {
    const domain = notesDomain();
    const agent = scriptedAgent([dial(suggest('add-note', { text: 'a' })), dial('<dial-inform>ok, skipped</dial-inform>')]);
    const conversation = new Conversation({ agent, domain, human: policyHuman('dismiss') });
    const first = await conversation.say('x');
    assert.deepEqual(domain.notes, []);
    assert.equal(first.status, 'idle');
    assert.equal(agent.sent.length, 1);                              // the dismissal alone sent nothing
    assert.deepEqual(first.outcomes.map((o) => o.status), ['dismissed']);
    await conversation.say('something else');
    assert.deepEqual(outcomesIn(agent.sent[1]), [{ action: 'add-note', status: 'dismissed' }]);
    assert.match(agent.sent[1], /something else/);
});

test('a dismissal next to an action that ran is reported in the same turn', async () => {
    const domain = notesDomain();
    const agent = scriptedAgent([dial(suggest('add-note', { text: 'a' }), suggest('add-note', { text: 'b' })), dial('<dial-acknowledge>ok</dial-acknowledge>')]);
    await new Conversation({ agent, domain, human: scriptedHuman(['accept', 'dismiss']) }).say('x');
    assert.deepEqual(domain.notes, ['a']);
    assert.deepEqual(outcomesIn(agent.sent[1]).map((o) => o.status), ['done', 'dismissed']);
});

test('edit → the edited payload runs; an invalid edit is shown back to the human, who decides again', async () => {
    const domain = notesDomain();
    const agent = scriptedAgent([dial(suggest('add-note', { text: 'draft' })), dial('<dial-inform>ok</dial-inform>')]);
    const human = scriptedHuman([{ edit: { text: '' } }, { edit: { text: 'Final' } }]);
    await new Conversation({ agent, domain, human }).say('x');
    assert.deepEqual(domain.notes, ['Final']);
    assert.deepEqual(human.seen[1].issue, { code: 'invalid-payload', field: 'text', hint: 'text is required' });
    assert.deepEqual(outcomesIn(agent.sent[1]), [{ action: 'add-note', status: 'done', result: { count: 1 }, edited: true }]);
});

test('the person writes something else instead → this and the rest of the reply are superseded; the new words go next', async () => {
    const domain = notesDomain();
    const agent = scriptedAgent([
        dial(suggest('add-note', { text: 'a' }), suggest('add-note', { text: 'b' })),
        dial('<dial-inform>Got it.</dial-inform>'),
    ]);
    const human = scriptedHuman([{ say: 'actually, add c instead' }]);
    const r = await new Conversation({ agent, domain, human }).say('add a and b');
    assert.deepEqual(domain.notes, []);
    assert.deepEqual(outcomesIn(agent.sent[1]).map((o) => o.status), ['superseded', 'superseded']);
    assert.match(agent.sent[1], /actually, add c instead$/);
    assert.equal(r.status, 'idle');
});

test('ask → the human answers, and the answer goes back', async () => {
    const agent = scriptedAgent([dial('<dial-ask>Which zone?</dial-ask>'), dial('<dial-inform>Thanks</dial-inform>')]);
    const human = scriptedHuman([{ answer: 'Strengths' }]);
    await new Conversation({ agent, domain: notesDomain(), human }).say('add it');
    assert.equal(human.seen[0].text, 'Which zone?');
    assert.match(agent.sent[1], /Strengths$/);
});

test('no reply in time → status no-reply, never a hang', async () => {
    const agent = { send: () => new Promise(() => {}) };
    const events = [];
    const r = await new Conversation({ agent, domain: notesDomain(), human: policyHuman(), timeoutMs: 50, onEvent: (e) => events.push(e.type) }).say('hi');
    assert.equal(r.status, 'no-reply'); assert.deepEqual(events, ['sent', 'no-reply']);
});

test('an agent that keeps proposing stops at maxTurns', async () => {
    const replies = Array.from({ length: 10 }, () => dial(suggest('list-notes', {})));
    const r = await new Conversation({ agent: scriptedAgent(replies), domain: notesDomain(), human: policyHuman(), maxTurns: 3 }).say('loop');
    assert.equal(r.status, 'turn-limit'); assert.equal(r.outcomes.length, 3);
});

test('a plain-text reply is shown and ends the turn', async () => {
    const events = [];
    const r = await new Conversation({ agent: scriptedAgent(['Just text.']), domain: notesDomain(), human: policyHuman(), onEvent: (e) => events.push(e) }).say('hi');
    assert.equal(r.status, 'idle'); assert.equal(events.find((e) => e.type === 'inform').text, 'Just text.');
});

test('outcome replies are valid DIAL the parser reads back', () => {
    const xml = outcomeReply([{ id: 'sg-3', action: 'a', status: 'failed', preview: 'Do <it>', error: 'x </dial-payload> y', hint: 'h' }]);
    const els = parse(xml).elements;
    assert.deepEqual(els.map((e) => [e.type, e.of ?? e.contextKey]), [['dial-acknowledge', 'sg-3'], ['dial-declare', 'outcome:sg-3']]);
    assert.deepEqual(els[0].yield, ['sg-3:failed']);
    assert.deepEqual(els[1].payload, { action: 'a', status: 'failed', error: 'x </dial-payload> y', hint: 'h' });
    assert.throws(() => outcomeReply([{ id: 'x', action: 'a', status: 'weird' }]), /unknown status/);
});

test('an outcome the agent was never told (the send failed) goes with the next thing the person says', async () => {
    const domain = notesDomain();
    const sent = [];
    let call = 0;
    const agent = { async send(message) {
        sent.push(message);
        call++;
        if (call === 1) return dial(suggest('add-note', { text: 'milk' }, 'Add milk?', 'sg-a'));
        if (call === 2) throw new Error('send failed');
        return dial('<dial-inform>ok</dial-inform>');
    } };
    const conversation = new Conversation({ agent, domain, human: policyHuman('accept') });
    await assert.rejects(conversation.say('add milk'), /send failed/);
    assert.deepEqual(domain.notes, ['milk']);                       // the action ran; only the report was lost
    const result = await conversation.say('thanks');
    assert.equal(result.status, 'idle');
    assert.deepEqual(outcomesIn(sent[2]).map((o) => o.status), ['done']);
    assert.match(sent[2], /thanks/);
    await conversation.say('one more');
    assert.deepEqual(outcomesIn(sent[3]), []);                      // told once
});

test('a hand-off action runs at once, asks nobody, and spends no turn; the agent hears of it with the next words', async () => {
    const taken = [];
    const domain = { ...notesDomain(), actions: { 'suggest-poll': { mutates: false, handoff: true } }, validate: () => ({ ok: true }), preview: () => 'Open a poll', run: (a, p) => { taken.push(p); } };
    const agent = scriptedAgent([dial(suggest('suggest-poll', { question: 'Lunch?' })), dial('<dial-inform>ok</dial-inform>')]);
    const human = scriptedHuman([]);                                  // would throw if asked
    const conversation = new Conversation({ agent, domain, human });
    const first = await conversation.say('poll please');
    assert.deepEqual(taken, [{ question: 'Lunch?' }]);
    assert.deepEqual(first.outcomes.map((o) => o.status), ['handed-off']);
    assert.equal(agent.sent.length, 1);
    await conversation.say('thanks');
    assert.deepEqual(outcomesIn(agent.sent[1]).map((o) => o.status), ['handed-off']);
});

test('an answer the agent never received (the send failed) is not lost: it goes with the next send', async () => {
    const domain = notesDomain();
    const sent = [];
    let call = 0;
    const agent = { async send(message) {
        sent.push(message);
        call++;
        if (call === 1) return dial('<dial-ask>Which note?</dial-ask>');
        if (call === 2) throw new Error('send failed');
        return dial('<dial-inform>ok</dial-inform>');
    } };
    const human = { decide: async () => ({ dismiss: true }), answer: async () => 'the first one' };
    const conversation = new Conversation({ agent, domain, human });
    await assert.rejects(conversation.say('remove a note'), /send failed/);
    await conversation.say('');                                     // "resend": nothing new to say
    assert.match(sent[2], /the first one\s*$/);
    await conversation.say('thanks');
    assert.doesNotMatch(sent[3], /the first one/);                  // sent once
});
