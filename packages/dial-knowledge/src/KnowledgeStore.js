/**
 * KnowledgeStore — top-level API for dial-knowledge.
 *
 * Manages multiple EnvironmentGraphs (one per environment identity),
 * wires in a persistence adapter, and exposes the interface that
 * DialContextBuilder and DialElementRouter use.
 *
 * Usage in wity-cli:
 *
 *   import { KnowledgeStore, FileAdapter } from '@wity/dial-knowledge';
 *
 *   const store = new KnowledgeStore({ adapter: new FileAdapter() });
 *   await store.load('freecad-0.21');
 *
 *   // In DialContextBuilder — inject known surface as upstream context
 *   const summary = store.summarise('freecad-0.21');
 *
 *   // In DialElementRouter — after routing a dial-declare element
 *   store.declareFact('freecad-0.21', key, value, 'ai-asserted');
 *   store.save('freecad-0.21');  // or call saveAll() at session end
 */

import { EnvironmentGraph } from './EnvironmentGraph.js';

export class KnowledgeStore {
  /** @param {{ adapter: import('./adapters/FileAdapter.js').FileAdapter }} options */
  constructor({ adapter }) {
    this.adapter = adapter;
    /** @type {Map<string, EnvironmentGraph>} */
    this._graphs = new Map();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Load (or create) a graph for the given environment identity. */
  load(envId) {
    if (this._graphs.has(envId)) return;

    const graph = new EnvironmentGraph(envId);
    const snapshot = this.adapter.load(envId);
    if (snapshot) graph.hydrate(snapshot);

    this._graphs.set(envId, graph);
  }

  /** Persist a single environment graph if dirty. */
  save(envId) {
    const graph = this._graphs.get(envId);
    if (!graph || !graph.isDirty) return;
    this.adapter.save(graph.serialise());
    graph.clearDirty();
  }

  /** Persist all dirty graphs — call at session end. */
  saveAll() {
    for (const envId of this._graphs.keys()) {
      this.save(envId);
    }
  }

  // ── Write (called by DialElementRouter after routing dial-declare) ─────────

  declareFact(envId, key, value, source = 'ai-asserted') {
    this._require(envId).declareFact(key, value, source);
  }

  declareCommand(envId, name, meta = {}) {
    this._require(envId).declareCommand(name, meta);
  }

  recordChain(envId, fromCmd, toCmd, context = {}) {
    this._require(envId).recordChain(fromCmd, toCmd, context);
  }

  recordConflict(envId, fromCmd, toCmd, reason = '') {
    this._require(envId).recordConflict(fromCmd, toCmd, reason);
  }

  // ── Read (called by DialContextBuilder to build [ENV-KNOWLEDGE]) ───────────

  /**
   * Produce a compact text summary of everything known about an environment.
   * Injected by DialContextBuilder as [ENV-KNOWLEDGE] upstream context.
   */
  summarise(envId) {
    const graph = this._graphs.get(envId);
    if (!graph) return null;

    const commands = graph.getCommands();
    const facts    = graph.getFacts();

    if (commands.length === 0 && facts.length === 0) return null;

    const lines = [`[ENV-KNOWLEDGE: ${envId}]`];

    if (commands.length > 0) {
      lines.push(`\nKnown commands (${commands.length}):`);
      for (const cmd of commands) {
        const chains = graph.getChainsFrom(cmd.label);
        const chainStr = chains.length
          ? ` → chains-with: ${chains.map(e => e.target.replace('cmd:', '')).join(', ')}`
          : '';
        lines.push(`  ${cmd.label}${chainStr}`);
        if (cmd.data?.description) lines.push(`    ${cmd.data.description}`);
      }
    }

    if (facts.length > 0) {
      lines.push(`\nDeclared facts:`);
      for (const fact of facts) {
        lines.push(`  ${fact.label}: ${JSON.stringify(fact.data?.value)}`);
      }
    }

    return lines.join('\n');
  }

  /** Raw graph access for advanced consumers. */
  graph(envId) {
    return this._graphs.get(envId) ?? null;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _require(envId) {
    if (!this._graphs.has(envId)) this.load(envId);
    return this._graphs.get(envId);
  }
}
