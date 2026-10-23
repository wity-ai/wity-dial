import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Conversation } from '../index.js';

const NOTHING = { actions: {}, validate: () => ({ ok: true }), run: () => {}, context: () => '' };
const tick = () => new Promise((r) => setImmediate(r));
// a person who has not answered yet: questions stand, proposals are let go
const AWAY = { decide: async () => ({ dismiss: true }), answer: async () => '' };

// an agent that streams each reply: the reply so far at each cut, then the whole (its last reply, once the rest are given)
function streaming(replies, { cuts = 7 } = {}) {
    return {
        async send(message, o) {
            const reply = replies.length > 1 ? replies.shift() : replies[0];
            for (let end = 0; end < reply.length; end += cuts) { o?.onProgress?.(reply.slice(0, end)); await tick(); }
            return reply;
        },
    };
}
// what was shown, and when: [type, text] in order, the reply's whole text marked where it came
async function run(replies, o) {
    const seen = [];
    const conv = new Conversation({ agent: streaming(replies, o), domain: NOTHING, human: AWAY, onEvent: (e) => {
        if (e.type === 'reply') seen.push(['REPLY']);
        if (e.type === 'inform' || e.type === 'ask') seen.push([e.type, e.text]);
    } });
    await conv.say('go');
    return seen;
}

test('told as it comes: each inform once it is whole, before the reply is — and not again after', async () => {
    const seen = await run(['<dial><dial-inform>The first part.</dial-inform><dial-acknowledge>Noted.</dial-acknowledge><dial-inform>The last.</dial-inform></dial>']);
    assert.deepEqual(seen, [['inform', 'The first part.'], ['inform', 'Noted.'], ['inform', 'The last.'], ['REPLY']]);
});

test('a question waits for the whole reply — and so does all after it', async () => {
    const seen = await run(['<dial><dial-inform>Two ways.</dial-inform><dial-ask response-type="text">Which?</dial-ask><dial-inform>Either works.</dial-inform></dial>']);
    assert.deepEqual(seen, [['inform', 'Two ways.'], ['REPLY'], ['ask', 'Which?'], ['inform', 'Either works.']]);
});

test('prose before the DIAL: nothing live — shown whole, prose first, as ever', async () => {
    const seen = await run(['Sure. <dial><dial-inform>Done.</dial-inform></dial>']);
    assert.deepEqual(seen, [['REPLY'], ['inform', 'Sure.'], ['inform', 'Done.']]);
});

test('the same, said whole or as it came', async () => {
    const replies = [
        '<dial><dial-inform>a</dial-inform><dial-suggest action="x">x</dial-suggest><dial-inform>b</dial-inform></dial>',
        '<dial-inform>Bare, without its envelope.</dial-inform>',
        'Plain words, no DIAL at all.',
    ];
    for (const reply of replies) {
        const whole = [];
        const conv = new Conversation({ agent: { send: async () => reply }, domain: NOTHING, human: AWAY, onEvent: (e) => e.type === 'inform' && whole.push(e.text) });
        await conv.say('go');
        const live = (await run([reply])).filter(([t]) => t === 'inform').map(([, x]) => x);
        assert.deepEqual(live, whole, reply);
    }
});

test('the reply so far, as events; progress after the reply is let go', async () => {
    const events = [];
    let late;
    const agent = { async send(message, { onProgress }) { onProgress('<dial><dial-inform>Hi.</dial-inform>'); late = onProgress; return '<dial><dial-inform>Hi.</dial-inform></dial>'; } };
    const conv = new Conversation({ agent, domain: NOTHING, human: AWAY, onEvent: (e) => events.push(e) });
    await conv.say('go');
    late('<dial><dial-inform>Hi.</dial-inform><dial-inform>Late.</dial-inform>');
    await tick();
    assert.deepEqual(events.filter((e) => e.type === 'reply-progress').map((e) => [e.turn, e.text]), [[1, '<dial><dial-inform>Hi.</dial-inform>']]);
    assert.deepEqual(events.filter((e) => e.type === 'inform').map((e) => e.text), ['Hi.']);
});

test('an agent that does not stream: as before', async () => {
    const seen = [];
    const conv = new Conversation({ agent: { send: async (m) => '<dial><dial-inform>Whole.</dial-inform></dial>' }, domain: NOTHING, human: AWAY, onEvent: (e) => seen.push(e.type) });
    await conv.say('go');
    assert.deepEqual(seen, ['sent', 'reply', 'inform']);
});

test('a reply that began again (another model answered): nothing more live — the whole reply as it is, nothing missed', async () => {
    const seen = [];
    const agent = { async send(message, { onProgress }) {
        onProgress('<dial><dial-inform>First try.</dial-inform>');
        await tick();
        onProgress('<dial><dial-inform>Second');                    // another model, from its start
        await tick();
        onProgress('<dial><dial-inform>Second try.</dial-inform>');
        await tick();
        return '<dial><dial-inform>Second try.</dial-inform><dial-inform>More.</dial-inform></dial>';
    } };
    const conv = new Conversation({ agent, domain: NOTHING, human: AWAY, onEvent: (e) => (e.type === 'inform' || e.type === 'reply') && seen.push(e.type === 'reply' ? 'REPLY' : e.text) });
    await conv.say('go');
    assert.deepEqual(seen, ['First try.', 'REPLY', 'Second try.', 'More.']);
});
