// CJS wrapper for WASM parse — no import.meta.url needed in CommonJS.
'use strict';

const { dial_parse, dial_extract_prose } = require('dial-core-wasm');

function parse(text) {
  const result = dial_parse(text);
  if (result == null) return null;
  return typeof result === 'string' ? JSON.parse(result) : result;
}

function extractProse(text) {
  return dial_extract_prose(text);
}

module.exports = { parse, extractProse };
