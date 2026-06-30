/**
 * @wity/dial-knowledge
 *
 * Persistent environment knowledge store for DIAL.
 *
 * Accumulates facts declared via <dial-declare> into local wity-graph instances,
 * one per environment identity. Adapters handle where graphs are persisted —
 * FileAdapter for Node.js/CLI, custom adapters for browser or remote storage.
 *
 * Architecture:
 *
 *   DialContextBuilder  →  KnowledgeStore.summarise()  →  [ENV-KNOWLEDGE] in upstream ctx
 *   DialElementRouter   →  KnowledgeStore.declareFact()  →  EnvironmentGraph → adapter → disk
 *
 * Each environment identity gets its own graph:
 *   ~/.wity/knowledge/freecad-0.21.graph.json
 *   ~/.wity/knowledge/filesystem-linux.graph.json
 *   ~/.wity/knowledge/postgres-15.graph.json
 */

export { KnowledgeStore }    from './src/KnowledgeStore.js';
export { EnvironmentGraph }  from './src/EnvironmentGraph.js';
export { FileAdapter }       from './src/adapters/FileAdapter.js';
