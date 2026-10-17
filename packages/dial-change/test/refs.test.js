import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRefs, refsOf, hasRefs, isRef, refsHelp } from '../index.js';

test('a step names what an earlier one made, or what was there before — and nothing else', () => {
    const results = [{ elementId: 'e1', layerId: 'L' }, { notes: { headline: 'n1' } }];
    let read = 0;
    const before = () => { read++; return { layers: [{ id: 'p1' }, { id: 'p2' }] }; };
    assert.deepEqual(resolveRefs({ a: { $ref: '1.elementId' }, b: [{ $ref: '2.notes.headline' }], c: { $ref: '0.layers.1.id' }, d: 'text' }, 3, results, before),
        { a: 'e1', b: ['n1'], c: 'p2', d: 'text' });
    assert.equal(read, 1);
    resolveRefs({ a: { $ref: '1.layerId' } }, 2, results, before); assert.equal(read, 1, 'what was before is read only when named');
    assert.throws(() => resolveRefs({ $ref: '1.x' }, 1, [], before), /only an earlier step/);
    assert.throws(() => resolveRefs({ $ref: '1.nothing' }, 2, results, before), /step 1 has no nothing/);
    assert.throws(() => resolveRefs({ $ref: 'first.id' }, 2, results, before), /no step before this one is named 'first'/);
    assert.equal(resolveRefs({ $ref: '1.elementId', extra: 1 }.extra, 2, results, before), 1);
    assert.deepEqual(refsOf({ a: { $ref: '1.x' }, b: [{ $ref: '0.y' }] }), ['1.x', '0.y']);
    assert.equal(hasRefs({ a: '$ref 1.x' }), false, 'text is text'); assert.equal(isRef({ $ref: '1.x', other: 2 }), false);
    assert.match(refsHelp('{ "$ref": "intro.cardUid" } is the card the step named intro added'), /^A step that makes something a later step works on is given a name/);
});
