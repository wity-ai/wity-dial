// CJS wrapper for WASM parse — no import.meta.url needed in CommonJS.
'use strict';

const { dial_parse, dial_extract_prose, dial_serialize, dial_condition } = require('dial-core-wasm');

function parse(text) {
  const result = dial_parse(text);
  if (result == null) return null;
  return typeof result === 'string' ? JSON.parse(result) : result;
}

function extractProse(text) {
  return dial_extract_prose(text);
}

function serialize(envelope) {
  return dial_serialize(JSON.stringify(envelope));
}

function conditionOf(text) {
  try { return JSON.parse(dial_condition(text)); } catch (e) { throw new Error(String(e?.message ?? e)); }
}

module.exports = { parse, extractProse, serialize, conditionOf };
