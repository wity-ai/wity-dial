import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Conversation, policyHuman, shownOf, toldOf, askOf } from '../index.js';

// A small domain: add-note mutates (the person decides), list-notes reads (runs at once)
function notesDomain() {
    return {
        actions: { 'add-note': { mutates: true }, 'list-notes': { mutates: false } },
        validate: (action, p) => (action === 'add-note' && !p.text ? { ok: false, code: 'invalid-payload', field: 'text', hint: 'text is required' } : { ok: true }),
        preview: (action, p) => (action === 'add-note' ? `Add the note '${p.text}'` : 'List the notes'),
        run: () => ({ ok: true }),
        context: () => '',
    };
}
const suggest = (action, payload, text) =>
    `<dial-suggest action="${action}">${text}</dial-suggest><dial-declare context-key="x">${JSON.stringify(payload)}</dial-declare>`;
const dial = (...parts) => `<dial>${parts.join('')}</dial>`;

// What a conversation showed live, reply by reply: the reply's text, what was shown of it, what became of its proposals
async function showedLive(replies) {
    const left = [...replies];
    const events = [];
    const conv = new Conversation({
        agent: { send: async () => left.shift() ?? dial('<dial-acknowledge>Ok.</dial-acknowledge>') },
        domain: notesDomain(),
        human: policyHuman('accept'),
        onEvent: (e) => events.push(e),
    });
    await conv.say('go');
    const turns = [];
    for (const e of events) {
        if (e.type === 'reply') turns.push({ reply: e.text, shown: [], outcomes: [] });
        else if (turns.length && ['inform', 'ask', 'suggestion'].includes(e.type)) turns.at(-1).shown.push(e);
        else if (turns.length && e.type === 'outcome') turns.at(-1).outcomes.push(e);
    }
    return turns;
}
// the same things compared: what is shown, as the person sees it
const asSeen = (item) => item.type === 'suggestion'
    ? { type: 'suggestion', action: item.action, text: item.text }
    : item.type === 'ask' ? { type: 'ask', text: item.text, responseType: item.responseType, options: item.options }
        : { type: 'inform', text: item.text, ...(item.act && { act: item.act }) };

test('a reply read back shows what it showed live — told, asked, proposed — and nothing else', async () => {
    const turns = await showedLive([
        `Sure, here goes. ${dial(
            '<dial-inform>Here is what I found.</dial-inform>',
            '<dial-ask response-type="choice">Which list?<dial-option value="a">Work</dial-option><dial-option value="b">Home</dial-option></dial-ask>',
            suggest('add-note', { text: 'Strong brand' }, "Add 'Strong brand'?"),
            suggest('add-note', {}, 'Add an empty note?'),          // invalid: never shown
            suggest('list-notes', {}, 'Let me look.'),              // reads: runs at once, shown
            '<dial-declare context-key="brand">{"tone":"calm"}</dial-declare>',
            '<dial-delegate to="lila" intent="video"></dial-delegate>',
        )} Thanks.`,
        dial('<dial-acknowledge>Done — added.</dial-acknowledge>'),
    ]);
    assert.ok(turns.length >= 2);
    for (const { reply, shown, outcomes } of turns) {
        const readBack = await shownOf(reply, outcomes);
        assert.deepEqual(readBack.map(asSeen), shown.map(asSeen), `not as shown live: ${reply}`);
    }
});

test('a reply not in DIAL is shown as it is, read back as live', async () => {
    const turns = await showedLive(['Just words.', 'Still just words.']);   // asked again, once; the latest shown
    const { reply, shown, outcomes } = turns[0];
    assert.equal(reply, 'Still just words.');
    assert.deepEqual((await shownOf(reply, outcomes)).map(asSeen), shown.map(asSeen));
    assert.deepEqual(shown.map(asSeen), [{ type: 'inform', text: 'Still just words.' }]);
});

test('read back, proposals carry what became of them; an invalid one is not there', async () => {
    const reply = dial(suggest('add-note', { text: 'a' }, 'One?'), suggest('add-note', {}, 'Two?'), suggest('add-note', { text: 'c' }, 'Three?'));
    const shown = await shownOf(reply, [{ status: 'done' }, { status: 'invalid' }, { status: 'dismissed' }]);
    assert.deepEqual(shown.map((s) => [s.text, s.outcome?.status]), [['One?', 'done'], ['Three?', 'dismissed']]);
});

test('a proposal not answered yet is shown, without an outcome', async () => {
    const shown = await shownOf(dial(suggest('add-note', { text: 'a' }, 'One?')));
    assert.deepEqual(shown, [{ type: 'suggestion', action: 'add-note', text: 'One?' }]);
});

test('an element tells or asks — or neither', () => {
    assert.deepEqual(toldOf({ type: 'dial-acknowledge', text: 'Done.' }), { type: 'inform', text: 'Done.', act: 'acknowledge' });
    assert.equal(toldOf({ type: 'dial-inform', text: '' }), null);
    assert.deepEqual(askOf({ type: 'dial-ask' }), { type: 'ask', text: '', responseType: undefined, options: [] });
    assert.equal(askOf({ type: 'dial-inform', text: 'x' }), null);
    assert.equal(toldOf({ type: 'dial-declare', text: 'x' }), null);
});

test('nothing in, nothing shown', async () => {
    assert.deepEqual(await shownOf(''), []);
    assert.deepEqual(await shownOf(null), []);
});
