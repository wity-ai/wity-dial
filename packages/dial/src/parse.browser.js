// parse.browser.js — browser-compatible WASM loader.
//
// Uses the wasm-pack `--target web` build (pkg-web), which loads the WASM
// binary via fetch / WebAssembly.instantiateStreaming instead of fs.readFileSync.
//
// parse() and extractProse() are async in the browser build so that WASM
// initialisation (a one-time fetch) can be awaited lazily on first call.
// Subsequent calls return immediately — the init promise is cached.

import init, { dial_parse, dial_extract_prose, dial_serialize, dial_condition } from 'dial-core-wasm-web';

let _ready = null;

function _ensureInit() {
  if (!_ready) _ready = init();
  return _ready;
}

/**
 * Pre-load the WASM binary. Optional — called automatically on first use.
 * Call this at app startup to avoid latency on the first message.
 *
 * @returns {Promise<void>}
 */
export async function initDial() {
  await _ensureInit();
}

/**
 * Parse a <dial> envelope from AI response text.
 * Returns a DialEnvelope object, or null if no envelope is present.
 *
 * @param {string} text
 * @returns {Promise<import('../index.js').DialEnvelope | null>}
 */
export async function parse(text) {
  await _ensureInit();
  const result = dial_parse(text);
  if (result == null) return null;
  return typeof result === 'string' ? JSON.parse(result) : result;
}

/**
 * Return the prose portions of an AI response — text outside any <dial> block.
 * Useful for displaying the non-structured part of a mixed response.
 *
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function extractProse(text) {
  await _ensureInit();
  return dial_extract_prose(text);
}

/**
 * An envelope written as DIAL text — what parse reads back to the same envelope (its `raw` aside). One canonical form;
 * any words carried exactly.
 *
 * @param {import('../index.js').DialEnvelope | Omit<import('../index.js').DialEnvelope, 'raw'>} envelope
 * @returns {Promise<string>}
 */
export async function serialize(envelope) {
  await _ensureInit();
  return dial_serialize(JSON.stringify(envelope));
}

/**
 * An `until` read: its condition ({ kind: 'runs', atLeast }) — or an Error saying why it is not one.
 *
 * @param {string} text
 * @returns {Promise<import('../index.js').DialCondition>}
 */
export async function conditionOf(text) {
  await _ensureInit();
  try { return JSON.parse(dial_condition(text)); } catch (e) { throw new Error(String(e?.message ?? e)); }
}
