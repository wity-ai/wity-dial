// DialRouter — handler-based DIAL element dispatcher.
//
// Runs the outer observe/yield dependency graph across elements in a DialEnvelope.
// Handlers are registered per element type; each receives (element, ctx).
//
// ctx.session — the active DialSession
// ctx.emit(event) — manually fire a yield event (e.g. 'choice:yes', 'input:foo')
//                   used when the element handler itself determines which event to yield
//                   (e.g. dial-ask fires 'choice:${answer}' based on user input).
//
// Element-level `yield` attributes are applied automatically after each handler returns.
//
// Unregistered element types are silently skipped (non-fatal).
//
// Also exports: runStepGraph() — identical dependency-graph loop for inner step arrays
// (e.g. the steps inside <dial-execute>). Same observe/yield semantics, keyed by step.id.

export class DialRouter {
  #handlers = new Map();

  /**
   * Register a handler for a DIAL element type.
   * Chainable.
   *
   * @param {string} type  — e.g. 'dial-inform', 'dial-ask', 'dial-execute'
   * @param {(el: object, ctx: { session: import('./DialSession.js').DialSession, emit: (event: string) => void }) => Promise<void> | void} handler
   * @returns {this}
   */
  on(type, handler) {
    this.#handlers.set(type, handler);
    return this;
  }

  /**
   * Route a parsed DialEnvelope through registered handlers,
   * respecting the observe/yield dependency graph across elements.
   *
   * @param {object} envelope  — result of parse()
   * @param {import('./DialSession.js').DialSession} session
   */
  async route(envelope, session) {
    const elements = envelope.elements;
    const processed = new Set();
    const yielded   = new Set();
    const key = (el, i) => el.id ?? `${el.type}[${i}]`;

    const ctx = {
      session,
      emit: (event) => yielded.add(event),
    };

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

/**
 * Run an inner observe/yield dependency graph for a step array.
 * Used inside a dial-execute handler to sequence steps with inter-step dependencies.
 *
 * executor: async (step) => { success: boolean, ...result }
 * step.yield only fires when result.success === true.
 *
 * @param {object[]} steps
 * @param {(step: object) => Promise<{ success: boolean; [key: string]: unknown }>} executor
 * @param {Set<string>} [initialYielded]  — pre-seeded yield events (e.g. outer router context)
 * @returns {Promise<{ results: object[]; yielded: Set<string> }>}
 */
export async function runStepGraph(steps, executor, initialYielded = new Set()) {
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

      // step.yield only propagates on success
      if (result.success) {
        step.yield?.forEach(y => yielded.add(y));
      }

      changed = true;
    }
  }

  return { results, yielded };
}
