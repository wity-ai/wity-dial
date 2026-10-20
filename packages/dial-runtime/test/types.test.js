import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');   // wherever it is installed (a workspace hoists it)

// the shipped declarations are generated from the source (npm run types) — never written by hand; stale ones fail here
test('types/ is what the source declares now (npm run types)', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dial-runtime-types-'));
    const args = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts.types.split(' ').slice(1).map((a, i, all) => (all[i - 1] === '--outDir' ? out : a));
    execFileSync(process.execPath, [tsc, ...args], { stdio: 'pipe' });
    const list = (dir) => fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.d.ts')).sort();
    assert.deepEqual(list(out), list('types'), 'the same files');
    for (const f of list(out)) assert.equal(fs.readFileSync(path.join('types', f), 'utf8'), fs.readFileSync(path.join(out, f), 'utf8'), `${f} is stale — npm run types`);
});
