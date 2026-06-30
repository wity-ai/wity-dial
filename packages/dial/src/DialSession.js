// DialSession — per-session store for DIAL declared context and execution results.
//
// dial-declare values accumulate across turns via declare().
// Execution results carry over as upstream context via recordResults() (rolling window of 10).
//
// Pure JS — no WASM, no DOM. Works in Node.js, browser, or edge.

export class DialSession {
  #declared = {};
  #results  = [];
  #maxResults;

  /**
   * @param {{ maxResults?: number }} [opts]
   */
  constructor({ maxResults = 10 } = {}) {
    this.#maxResults = maxResults;
  }

  /**
   * Store a declared context value (from <dial-declare context-key="...">).
   * Overwrites previous value for the same key.
   *
   * @param {string} key
   * @param {unknown} value
   */
  declare(key, value) {
    this.#declared[key] = value;
  }

  /**
   * Get a snapshot of all declared context.
   * @returns {Record<string, unknown>}
   */
  getDeclared() {
    return { ...this.#declared };
  }

  /**
   * Record execution results from a <dial-execute> run.
   * Keeps a rolling window of the last N results.
   *
   * @param {Array<{ command: string; env: string; stdout: string; stderr: string; success: boolean; error?: string }>} results
   */
  recordResults(results) {
    this.#results = [...this.#results, ...results].slice(-this.#maxResults);
  }

  /**
   * Get the current rolling window of execution results.
   * @returns {Array<{ command: string; env: string; stdout: string; stderr: string; success: boolean; error?: string }>}
   */
  getLastResults() {
    return [...this.#results];
  }

  /**
   * Clear all declared context and execution results.
   */
  clear() {
    this.#declared = {};
    this.#results  = [];
  }
}
