// The protocol every action vector carries (src/protocol.js). `node --test test/`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderProtocol, OUTCOME_STATUSES } from '../index.js';

test('every outcome status the runtime reports is described — and nothing else', () => {
    const text = renderProtocol();
    for (const s of OUTCOME_STATUSES) assert.match(text, new RegExp(`^  ${s} +\\S`, 'm'), s);
    assert.match(text, /A dismissed \/ superseded \/ handed-off outcome arrives together/);
});

test('conduct: talk an idea through first; never make media on a guess; only listed actions', () => {
    const text = renderProtocol();
    assert.match(text, /Talk an idea through before proposing anything/);
    assert.match(text, /Never propose making media .* on a guess/s);
    assert.match(text, /not available here cannot be done on this\s+surface/);
});

test("a domain's example and batching go into the pattern", () => {
    const text = renderProtocol({ example: { action: 'card.add', question: 'Add a card?', payload: '{"title":"x"}' }, batching: 'all of a map\'s assets in one' });
    assert.match(text, /e\.g\. <dial-suggest action="card\.add">Add a card\?<\/dial-suggest>/);
    assert.match(text, /context-key="cardAddSuggestion">\{"title":"x"\}/);
    assert.match(text, /many items: all of a map's assets in one\)/);
    assert.doesNotMatch(renderProtocol(), /e\.g\./);
});

test('no line is wider than 118 characters', () => {
    const text = renderProtocol({ example: { action: 'card.add', question: 'Add a card?', payload: '{}' }, batching: 'building a system map, add all its assets with ONE system.assets.add and all its connections with ONE system.connections.add — never one at a time' });
    for (const line of text.split('\n')) assert.ok(line.length <= 118, `${line.length}: ${line}`);
});

test('the envelope and its elements; what a removal loses is said first', () => {
    const text = renderProtocol();
    assert.match(text, /^DIAL — every response is one <dial>…<\/dial> envelope/);
    for (const el of ['dial-inform', 'dial-ask', 'dial-acknowledge', 'dial-suggest']) assert.ok(text.includes(`<${el}>`), el);
    assert.match(text, /removes something, say in a dial-inform what will be lost/);
});
