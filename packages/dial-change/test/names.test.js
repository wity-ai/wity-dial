import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRefs, stepNames, refProblems, refPaths, withPlaceholders, STEP_NAME } from '../index.js';

const before = () => ({ layers: [{ id: 'p1' }] });

test('a step named, and a later one using what it made by that name — the same as by its number', () => {
    const list = [{ command: 'scene.set' }, { command: 'layer.add', as: 'titles' }, { command: 'element.add' }];
    const names = stepNames(list);
    assert.deepEqual([...names], [['titles', 2]]);
    const results = [{}, { layerId: 'L9' }];
    assert.deepEqual(resolveRefs({ layerId: { $ref: 'titles.layerId' } }, 3, results, before, names), { layerId: 'L9' });
    assert.deepEqual(resolveRefs({ layerId: { $ref: '2.layerId' } }, 3, results, before, names), { layerId: 'L9' }, 'by number, as before');
    assert.deepEqual(resolveRefs({ layerId: { $ref: '0.layers.0.id' } }, 3, results, before, names), { layerId: 'p1' });
    assert.deepEqual(resolveRefs({ a: { $ref: '2.layerId' } }, 3, results, before), { a: 'L9' }, 'no names given: numbers only, as before');
});

test('a name refused: not a word, used twice, unknown, or not earlier', () => {
    assert.throws(() => stepNames([{ as: '1st' }]), /is a word, not starting with a digit/);
    assert.throws(() => stepNames([{ as: 'a.b' }]), /is a word/);
    assert.throws(() => stepNames([{ as: 'x' }, { as: 'x' }]), /already step 1's/);
    const names = stepNames([{ as: 'first' }, { as: 'second' }]);
    assert.throws(() => resolveRefs({ $ref: 'third.id' }, 2, [{}], before, names), /no step before this one is named 'third'/);
    assert.throws(() => resolveRefs({ $ref: 'second.id' }, 2, [{}], before, names), /only an earlier step can be named \(this is step 2\; 'second' is step 2\)/);
    assert.throws(() => resolveRefs({ $ref: 'first.nothing' }, 2, [{ id: 1 }], before, names), /step 1 \('first'\) has no nothing/);
    assert.throws(() => resolveRefs({ $ref: '-x.id' }, 2, [{}], before, names), /starts with a step's name or number/);
});

test('refProblems: said before the list runs, in the domain\'s words', () => {
    const ok = [{ command: 'layer.add', as: 'titles' }, { command: 'element.add', payload: { layerId: { $ref: 'titles.layerId' }, x: { $ref: '0.layers.0.id' } } }];
    assert.deepEqual(refProblems(ok, 'the scene before'), []);
    const bad = [{ command: 'layer.add', as: 'titles' }, { command: 'element.add', payload: { layerId: { $ref: 'title.layerId' } } }, { command: 'element.add', payload: { a: { $ref: '3.x' } } }];
    assert.deepEqual(refProblems(bad, 'the scene before'), [
        "Step 2 (element.add): $ref 'title.layerId' — no step before this one is named 'title'; it may name the scene before (0) or an earlier step (1–1, or by its name)",
        "Step 3 (element.add): $ref '3.x' — only an earlier step can be named (this is step 3); it may name the scene before (0) or an earlier step (1–2, or by its name)",
    ]);
    assert.deepEqual(refProblems([{ command: 'a', as: 'x' }, { command: 'b', as: 'x' }], 'the board before'), ["Step 2: the name 'x' is already step 1's"]);
});

test('the shared helpers the checkers use', () => {
    assert.deepEqual(refPaths({ a: { $ref: '1.x' }, b: [{ c: { $ref: 'n.y' } }] }), ['a', 'b[0].c']);
    assert.deepEqual(withPlaceholders({ a: { $ref: '1.x' }, b: 2 }), { a: 'ref', b: 2 });
    assert.ok(new RegExp(STEP_NAME.pattern).test('titles') && !new RegExp(STEP_NAME.pattern).test('2x'));
});
