import test from 'node:test';
import assert from 'node:assert/strict';
import { outcomeReply, readOutcomes } from '../index.js';
import { parse } from '@wity.ai/dial';

const OUTCOMES = [
    { id: 'sg-1', action: 'media.make_many', status: 'done', preview: 'Make 2 images · 50 credits', result: { each: [{ step: { morphedForm: 'https://x/a.jpg' } }] } },
    { id: 'sg-2', action: 'matrix.entry.add', status: 'dismissed', preview: "Add 'A & B' to <Strengths>" },
    { id: 'sg-3', action: 'nope.x', status: 'invalid', code: 'unknown-action' },
];

test('an outcome reply read back: each outcome as data, in order — its preview (price included) from its acknowledgement', async () => {
    const env = await parse(outcomeReply(OUTCOMES));
    assert.deepEqual(readOutcomes(env.elements), OUTCOMES);
});

test('the preview from the acknowledgement\'s words — escaped text unescaped; none for an invalid proposal', async () => {
    const old = `<dial>
  <dial-acknowledge of="sg-1" yield="sg-1:done">Done: Make 2 images · 50 credits.</dial-acknowledge>
  <dial-declare context-key="outcome:sg-1"><dial-payload type="application/json">{"action":"media.make_many","status":"done","result":{"ok":true}}</dial-payload></dial-declare>
  <dial-acknowledge of="sg-2" yield="sg-2:dismissed">The user dismissed: Add 'A &amp; B' to &lt;Strengths&gt;.</dial-acknowledge>
  <dial-declare context-key="outcome:sg-2"><dial-payload type="application/json">{"action":"matrix.entry.add","status":"dismissed"}</dial-payload></dial-declare>
  <dial-acknowledge of="sg-3" yield="sg-3:invalid">Not proposed to the user — there is no action nope.x here.</dial-acknowledge>
  <dial-declare context-key="outcome:sg-3"><dial-payload type="application/json">{"action":"nope.x","status":"invalid","code":"unknown-action"}</dial-payload></dial-declare>
</dial>`;
    const read = readOutcomes((await parse(old)).elements);
    assert.equal(read[0].preview, 'Make 2 images · 50 credits');
    assert.deepEqual(read[0].result, { ok: true });
    assert.equal(read[1].preview, "Add 'A & B' to <Strengths>");
    assert.equal(read[2].preview, undefined);
    assert.equal(read[2].code, 'unknown-action');
});

test('anything that is not an outcome is ignored; nothing in, nothing out', async () => {
    const env = await parse('<dial><dial-inform>Hi</dial-inform><dial-declare context-key="note"><dial-payload type="application/json">{"a":1}</dial-payload></dial-declare></dial>');
    assert.deepEqual(readOutcomes(env.elements), []);
    assert.deepEqual(readOutcomes(undefined), []);
});
