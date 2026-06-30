/**
 * FileAdapter — persists EnvironmentGraph snapshots to the local filesystem.
 *
 * Default location: ~/.wity/knowledge/<envId>.graph.json
 * Override via storageDir option.
 *
 * Used by wity-cli and any Node.js DIAL client running on a local machine.
 * Browser clients use a different adapter (e.g. IndexedDB).
 */

import fs   from 'fs';
import path from 'path';
import os   from 'os';

const DEFAULT_DIR = path.join(os.homedir(), '.wity', 'knowledge');

export class FileAdapter {
  /** @param {{ storageDir?: string }} options */
  constructor(options = {}) {
    this.storageDir = options.storageDir ?? DEFAULT_DIR;
  }

  _filePath(envId) {
    return path.join(this.storageDir, `${envId}.graph.json`);
  }

  _ensureDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /** Load a snapshot for envId. Returns null if none exists yet. */
  load(envId) {
    const file = this._filePath(envId);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }

  /** Save a snapshot. */
  save(snapshot) {
    this._ensureDir();
    const file = this._filePath(snapshot.envId);
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  /** List all known environment ids on this machine. */
  listEnvironments() {
    if (!fs.existsSync(this.storageDir)) return [];
    return fs.readdirSync(this.storageDir)
      .filter(f => f.endsWith('.graph.json'))
      .map(f => f.replace('.graph.json', ''));
  }

  /** Remove a stored environment graph. */
  remove(envId) {
    const file = this._filePath(envId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}
