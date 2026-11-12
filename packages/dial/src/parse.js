// parse.js — thin wrapper around the dial-core WASM (Node.js CJS build).
//
// dial_parse(text)         → DialEnvelope | null
// dial_extract_prose(text) → string (text outside any <dial> block)
//
// The WASM build is CJS; we bridge it into this ESM module via createRequire.

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { dial_parse, dial_extract_prose, dial_serialize, dial_condition } = require('dial-core-wasm');

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

/**
 * An envelope written as DIAL text — what parse reads back to the same envelope (its `raw` aside). One canonical form;
 * any words carried exactly.
 *
 * @param {import('../index.js').DialEnvelope | Omit<import('../index.js').DialEnvelope, 'raw'>} envelope
 * @returns {string}
 */
export function serialize(envelope) {
  return dial_serialize(JSON.stringify(envelope));
}

/**
 * An `until` read: its condition ({ kind: 'runs', atLeast }) — or an Error saying why it is not one.
 *
 * @param {string} text
 * @returns {import('../index.js').DialCondition}
 */
export function conditionOf(text) {
  try { return JSON.parse(dial_condition(text)); } catch (e) { throw new Error(String(e?.message ?? e)); }
}
