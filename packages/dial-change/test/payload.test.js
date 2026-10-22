import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePayload, payloadShape } from '../index.js';

const SCHEMA = {
    type: 'object',
    properties: {
        name: { type: 'string', minLength: 1 },
        count: { type: 'integer' },
        kind: { type: 'string', enum: ['a', 'b'] },
        tags: { type: 'array', items: { type: 'string' }, minItems: 1 },
        note: { type: ['string', 'null'] },
        meta: { type: 'object', additionalProperties: true },
    },
    required: ['name'],
};

test('a payload that fits: no errors', () => {
    assert.deepEqual(validatePayload(SCHEMA, { name: 'x', count: 2, kind: 'a', tags: ['t'], note: null, meta: { any: 1 } }), []);
});
test('required, types, enum, minLength, minItems — each named by its path', () => {
    assert.deepEqual(validatePayload(SCHEMA, {}), ['payload.name is required']);
    assert.deepEqual(validatePayload(SCHEMA, { name: '' }), ['payload.name must not be empty']);
    assert.deepEqual(validatePayload(SCHEMA, { name: 'x', count: 1.5 }), ['payload.count must be an integer']);
    assert.deepEqual(validatePayload(SCHEMA, { name: 'x', kind: 'c' }), ['payload.kind must be one of "a", "b"']);
    assert.equal(validatePayload(SCHEMA, { name: 'x', tags: [] }).length, 1);
    assert.deepEqual(validatePayload(SCHEMA, { name: 'x', tags: [3] }), ['payload.tags[0] must be a string']);
});
test('null where a list of types allows it; said so where it does not fit', () => {
    assert.deepEqual(validatePayload(SCHEMA, { name: 'x', note: null }), []);
    assert.deepEqual(validatePayload(SCHEMA, { name: 'x', note: 3 }), ['payload.note must be a string (or null)']);
});
test('an unknown field is an error, naming the known ones; an open object takes any', () => {
    assert.deepEqual(validatePayload(SCHEMA, { name: 'x', label: 'y' }), ['payload.label is not a known field (expected: name, count, kind, tags, note, meta)']);
    assert.deepEqual(validatePayload(SCHEMA, { name: 'x', meta: { whatever: [1] } }), []);
});

test('payloadShape: a schema written short — required and optional fields, choices, lists, open objects', () => {
    assert.equal(payloadShape(SCHEMA), '{name, count?, kind?: "a"|"b", tags?: [string], note?, meta?: {…}}');
    assert.equal(payloadShape({ type: 'object', properties: {} }), '{}');
    assert.equal(payloadShape(undefined), 'any');
});

test('the bounds a schema declares are kept: pattern (said by its description), minimum / maximum, maxLength, maxItems', () => {
    const S = { type: 'object', properties: {
        link: { type: ['string', 'null'], pattern: '^https?://', description: 'a link (https://…)' },
        n: { type: 'integer', minimum: 1, maximum: 5 }, name: { type: 'string', maxLength: 3 },
        tags: { type: 'array', items: { type: 'string' }, maxItems: 2 },
    } };
    assert.deepEqual(validatePayload(S, { link: 'https://x', n: 3, name: 'abc', tags: ['a', 'b'] }), []);
    assert.deepEqual(validatePayload(S, { link: null }), [], 'null where null is allowed: no pattern asked of it');
    assert.deepEqual(validatePayload(S, { link: 'x.png', n: 0, name: 'abcd', tags: ['a', 'b', 'c'] }), [
        'payload.link must be a link (https://…)', 'payload.n must be at least 1', 'payload.name must be at most 3 characters', 'payload.tags takes at most 2 item(s)',
    ]);
    assert.deepEqual(validatePayload(S, { n: 6 }), ['payload.n must be at most 5']);
});
