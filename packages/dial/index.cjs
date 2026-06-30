/**
 * @wity/dial — CJS entry point for CommonJS consumers (e.g. TypeScript compiled to CJS).
 * ESM consumers use index.js instead (resolved automatically via package.json exports).
 */
'use strict';

const { parse, extractProse } = require('./src/parse.cjs');

class DialSession {
  #declared = {};
  #results  = [];
  #maxResults;

  constructor({ maxResults = 10 } = {}) {
    this.#maxResults = maxResults;
  }

  declare(key, value) { this.#declared[key] = value; }
  getDeclared()        { return { ...this.#declared }; }

  recordResults(results) {
    this.#results = [...this.#results, ...results].slice(-this.#maxResults);
  }
  getLastResults() { return [...this.#results]; }

  clear() { this.#declared = {}; this.#results = []; }
}

class DialRouter {
  #handlers = new Map();

  on(type, handler) {
    this.#handlers.set(type, handler);
    return this;
  }

  async route(envelope, session) {
    const elements = envelope.elements;
    const processed = new Set();
    const yielded   = new Set();
    const key = (el, i) => el.id ?? `${el.type}[${i}]`;
    const ctx = { session, emit: (event) => yielded.add(event) };

    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const k  = key(el, i);
        if (processed.has(k)) continue;
        if (el.observe && !yielded.has(el.observe)) continue;

        const handler = this.#handlers.get(el.type);
        if (handler) await handler(el, ctx);

        processed.add(k);
        el.yield?.forEach(y => yielded.add(y));
        changed = true;
      }
    }
  }
}

async function runStepGraph(steps, executor, initialYielded = new Set()) {
  const yielded = new Set(initialYielded);
  const done    = new Set();
  const results = [];

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < steps.length; i++) {
      if (done.has(i)) continue;
      const step = steps[i];
      if (step.observe && !yielded.has(step.observe)) continue;

      const result = await executor(step);
      results.push(result);
      done.add(i);

      if (result.success) step.yield?.forEach(y => yielded.add(y));
      changed = true;
    }
  }

  return { results, yielded };
}

module.exports = { parse, extractProse, DialSession, DialRouter, runStepGraph };
