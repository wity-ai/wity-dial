import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parse, serialize, conditionOf } from '../index.js';

const require = createRequire(import.meta.url);
const cjs = require('../index.cjs');

const exchange = `<dial version="1">
  <dial-execute id="angles" observe="idea" yield="angle hook" until="runs >= 3"><step env="board" action="contemplate" label="Finding angles…">Give 3 angles on {{topic}} — "quoted" & <tagged></step></dial-execute>
  <dial-ask id="chapters" addressed-to="initiator" context-key="chapters" observe="angle" yield="chapters">How many chapters?</dial-ask>
</dial>`;

const data = (env) => { const { raw, ...rest } = env; return rest; };

test('an exchange is written and read back the same, through the node and require entries', () => {
  const env = parse(exchange);
  assert.equal(env.elements[0].steps[0].action, 'contemplate');
  assert.equal(env.elements[0].until, 'runs >= 3');
  assert.equal(env.elements[1].contextKey, 'chapters');
  assert.deepEqual(data(parse(serialize(env))), data(env));
  assert.deepEqual(data(cjs.parse(cjs.serialize(env))), data(env));
});

test('an envelope without its raw text is written too', () => {
  assert.deepEqual(data(parse(serialize(data(parse(exchange))))), data(parse(exchange)));
});

test('a condition is read, or refused with why', () => {
  assert.deepEqual(conditionOf('runs >= 3'), { kind: 'runs', atLeast: 3 });
  assert.deepEqual(cjs.conditionOf('runs>=1'), { kind: 'runs', atLeast: 1 });
  assert.throws(() => conditionOf('until bored'), /until bored/);
});
