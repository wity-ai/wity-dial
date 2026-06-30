// parse.js — thin wrapper around the dial-core WASM (Node.js CJS build).
//
// dial_parse(text)         → DialEnvelope | null
// dial_extract_prose(text) → string (text outside any <dial> block)
//
// The WASM build is CJS; we bridge it into this ESM module via createRequire.

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { dial_parse, dial_extract_prose } = require('dial-core-wasm');

/**
 * Parse a <dial> envelope from AI response text.
 * Returns a DialEnvelope object, or null if no envelope is present.
 *
 * @param {string} text
 * @returns {import('../index.js').DialEnvelope | null}
 */
export function parse(text) {
  const result = dial_parse(text);
  if (result == null) return null;
  // WASM returns the envelope as a JSON string (JsValue::from_str)
  return typeof result === 'string' ? JSON.parse(result) : result;
}

/**
 * Return the prose portions of an AI response — text outside any <dial> block.
 * Useful for displaying the non-structured part of a mixed response.
 *
 * @param {string} text
 * @returns {string}
 */
export function extractProse(text) {
  return dial_extract_prose(text);
}
