/**
 * EnvironmentGraph — an AbstractGraph instance representing the known API surface
 * and usage patterns of a specific environment (tool, filesystem, service).
 *
 * Built up over time from <dial-declare> facts emitted by the AI across sessions.
 * Each environment gets its own graph, keyed by environment identity.
 *
 * Graph semantics:
 *   Nodes — commands, parameters, return types, concepts
 *   Edges — depends-on, yields, chains-with, conflicts-with, observed-usage
 *
 * Node types (BFO-grounded):
 *   command     — an executable operation in the environment        (occurant)
 *   concept     — a domain concept or declared fact                 (continuant)
 *   parameter   — an input to a command                            (continuant)
 *   result      — a return type or output of a command             (continuant)
 *   error       — a known failure mode                             (occurant)
 *
 * Edge types:
 *   has-param       — command → parameter
 *   yields          — command → result
 *   chains-with     — command → command (observed successful sequence)
 *   conflicts-with  — command → command (observed failure in sequence)
 *   instance-of     — parameter/result → concept
 */

import { GraphAbstract } from '@wity/graph-headless';

export class EnvironmentGraph {
    /** @param {string} envId — e.g. "freecad-0.21", "filesystem-linux", "postgres-15" */
    constructor(envId) {
        this.envId = envId;
        this.graph = new GraphAbstract();
        this._dirty = false;

        this.graph.on('nodes:changed', () => { this._dirty = true; });
        this.graph.on('edges:changed', () => { this._dirty = true; });
    }

    // ── Write ──────────────────────────────────────────────────────────────────

    /**
     * Declare a fact from a <dial-declare> element.
     * key:    context-key from the element.
     * value:  parsed payload (any JSON-serialisable value).
     * source: 'ai-asserted' | 'observed' | 'probed' — how the fact was learned.
     */
    declareFact(key, value, source = 'ai-asserted') {
        this.graph.addNode({
            uid:   `fact:${key}`,
            type:  'concept',
            label: key,
            data:  { value, source, updatedAt: Date.now() },
        });
    }

    /**
     * Record a command discovered in the environment.
     * Idempotent — safe to call repeatedly as more is learned about the command.
     */
    declareCommand(name, meta = {}) {
        this.graph.addNode({
            uid:   `cmd:${name}`,
            type:  'command',
            label: name,
            data:  { ...meta, discoveredAt: Date.now() },
        });
        return `cmd:${name}`;
    }

    /**
     * Record that two commands were observed chaining together successfully.
     */
    recordChain(fromCmd, toCmd, context = {}) {
        this.declareCommand(fromCmd);
        this.declareCommand(toCmd);
        this.graph.addEdge({
            srcUid:    `cmd:${fromCmd}`,
            targetUid: `cmd:${toCmd}`,
            type:      'chains-with',
            data:      { ...context, observedAt: Date.now() },
        });
    }

    /**
     * Record an observed failure between two commands.
     */
    recordConflict(fromCmd, toCmd, reason = '') {
        this.declareCommand(fromCmd);
        this.declareCommand(toCmd);
        this.graph.addEdge({
            srcUid:    `cmd:${fromCmd}`,
            targetUid: `cmd:${toCmd}`,
            type:      'conflicts-with',
            data:      { reason, observedAt: Date.now() },
        });
    }

    // ── Read ───────────────────────────────────────────────────────────────────

    /** All known commands. */
    getCommands() {
        return this.graph.getNodesByType('command');
    }

    /** All known facts (declared context). */
    getFacts() {
        return this.graph.getNodesByType('concept');
    }

    /** Known chains from a specific command. */
    getChainsFrom(cmdName) {
        return this.graph.getOutgoing(`cmd:${cmdName}`, 'chains-with');
    }

    // ── Persistence ────────────────────────────────────────────────────────────

    /**
     * Serialise the full graph to a plain object for persistence.
     */
    serialise() {
        return {
            envId:      this.envId,
            version:    1,
            exportedAt: Date.now(),
            ...this.graph.serialise(),
        };
    }

    /**
     * Restore from a previously serialised snapshot.
     */
    hydrate(snapshot) {
        if (snapshot.envId !== this.envId) {
            throw new Error(`env mismatch: expected ${this.envId}, got ${snapshot.envId}`);
        }
        this.graph.hydrate(snapshot);
        this._dirty = false;
    }

    get isDirty()   { return this._dirty; }
    clearDirty()    { this._dirty = false; }
}
