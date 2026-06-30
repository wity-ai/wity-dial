/**
 * EnvironmentGraph — a wity-graph instance representing the known API surface
 * and usage patterns of a specific environment (tool, filesystem, service).
 *
 * Built up over time from <dial-declare> facts emitted by the AI across sessions.
 * Each environment gets its own graph, keyed by environment identity.
 *
 * Graph semantics:
 *   Nodes — commands, parameters, return types, concepts
 *   Edges — depends-on, yields, chains-with, conflicts-with, observed-usage
 *
 * Node types (BFO-grounded, matching wity-graph conventions):
 *   command     — an executable operation in the environment
 *   parameter   — an input to a command
 *   result      — a return type or output of a command
 *   concept     — a domain concept (e.g. "face", "edge", "body" in CAD)
 *   error       — a known failure mode
 *
 * Edge types:
 *   has-param       — command → parameter
 *   yields          — command → result
 *   chains-with     — command → command (observed in real usage)
 *   conflicts-with  — command → command (observed to fail in sequence)
 *   instance-of     — parameter/result → concept
 */

import { GraphStore } from '@wity/graph-headless';

export class EnvironmentGraph {
  /** @param {string} envId — e.g. "freecad-0.21", "filesystem-linux", "postgres-15" */
  constructor(envId) {
    this.envId = envId;
    this.store = new GraphStore();
    this._dirty = false;

    this.store.on('nodes:changed', () => { this._dirty = true; });
    this.store.on('edges:changed', () => { this._dirty = true; });
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  /**
   * Declare a fact from a <dial-declare> element.
   * key: context-key from the element.
   * value: parsed payload (any JSON-serialisable value).
   * source: 'ai-asserted' | 'observed' | 'probed' — how the fact was learned.
   */
  declareFact(key, value, source = 'ai-asserted') {
    const nodeId = `fact:${key}`;
    const existing = this.store.getNode(nodeId);

    if (existing) {
      this.store.updateNode(nodeId, {
        data: { ...existing.data, value, source, updatedAt: Date.now() },
      });
    } else {
      this.store.addNode({
        uid: nodeId,
        type: 'concept',
        label: key,
        data: { value, source, createdAt: Date.now(), updatedAt: Date.now() },
      });
    }
  }

  /**
   * Record a command discovered in the environment.
   * Idempotent — safe to call repeatedly as more is learned about the command.
   */
  declareCommand(name, meta = {}) {
    const nodeId = `cmd:${name}`;
    const existing = this.store.getNode(nodeId);

    if (existing) {
      this.store.updateNode(nodeId, { data: { ...existing.data, ...meta } });
    } else {
      this.store.addNode({
        uid: nodeId,
        type: 'command',
        label: name,
        data: { ...meta, discoveredAt: Date.now() },
      });
    }
    return nodeId;
  }

  /**
   * Record that two commands were observed chaining together successfully.
   * Builds the real-usage graph over time.
   */
  recordChain(fromCmd, toCmd, context = {}) {
    const fromId = `cmd:${fromCmd}`;
    const toId   = `cmd:${toCmd}`;

    if (!this.store.getNode(fromId)) this.declareCommand(fromCmd);
    if (!this.store.getNode(toId))   this.declareCommand(toCmd);

    this.store.addEdge({
      uid:    `chain:${fromCmd}→${toCmd}`,
      source: fromId,
      target: toId,
      type:   'chains-with',
      data:   { ...context, observedAt: Date.now() },
    });
  }

  /**
   * Record an observed failure between two commands or a command and a condition.
   */
  recordConflict(fromCmd, toCmd, reason = '') {
    const fromId = `cmd:${fromCmd}`;
    const toId   = `cmd:${toCmd}`;

    if (!this.store.getNode(fromId)) this.declareCommand(fromCmd);
    if (!this.store.getNode(toId))   this.declareCommand(toCmd);

    this.store.addEdge({
      uid:    `conflict:${fromCmd}→${toCmd}`,
      source: fromId,
      target: toId,
      type:   'conflicts-with',
      data:   { reason, observedAt: Date.now() },
    });
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  /** All known commands. */
  getCommands() {
    return this.store.getNodesByType('command');
  }

  /** All known facts (declared context). */
  getFacts() {
    return this.store.getNodesByType('concept');
  }

  /** Known chains from a specific command. */
  getChainsFrom(cmdName) {
    const nodeId = `cmd:${cmdName}`;
    return this.store.getOutgoingEdges(nodeId)
      .filter(e => e.type === 'chains-with');
  }

  /**
   * Serialise the full graph to a plain object for persistence.
   * The adapter layer calls this and writes to disk/storage.
   */
  serialise() {
    return {
      envId:      this.envId,
      version:    1,
      exportedAt: Date.now(),
      nodes:      this.store.getAllNodes(),
      edges:      this.store.getAllEdges(),
    };
  }

  /**
   * Restore from a previously serialised snapshot.
   */
  hydrate(snapshot) {
    if (snapshot.envId !== this.envId) {
      throw new Error(`env mismatch: expected ${this.envId}, got ${snapshot.envId}`);
    }
    this.store.ingest({ nodes: snapshot.nodes, edges: snapshot.edges });
    this._dirty = false;
  }

  get isDirty() { return this._dirty; }
  clearDirty()  { this._dirty = false; }
}
