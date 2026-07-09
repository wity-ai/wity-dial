# JavaScript Package

`@wity.ai/dial` is the JavaScript implementation of the DIAL protocol — a thin layer over the `dial-core` Rust parser compiled to WASM. It exposes `parse`, `DialSession`, and `DialRouter` for building DIAL-aware applications in Node.js or the browser.

## Installation

```bash
npm install @wity.ai/dial
```

## Environments

The package ships two entry points selected automatically by your toolchain:

| Environment | Entry | `parse()` signature |
|---|---|---|
| Node.js | `index.js` | Synchronous — `parse(text): DialEnvelope \| null` |
| Browser (Vite, webpack, etc.) | `index.browser.js` | Async — `parse(text): Promise<DialEnvelope \| null>` |

Vite picks up the `"browser"` export condition automatically. Node.js uses the `"node"` condition. No configuration needed.

## Node.js usage

```js
import { parse, extractProse, DialSession, DialRouter, runStepGraph } from '@wity.ai/dial';

const session = new DialSession();
const router  = new DialRouter()
  .on('dial-inform',  (el, ctx) => { /* render el.text */ })
  .on('dial-ask',     async (el, ctx) => { ctx.emit('choice:yes'); })
  .on('dial-execute', async (el, ctx) => {
    const { results } = await runStepGraph(el.steps, myExecutor);
    ctx.session.recordResults(results);
  })
  .on('dial-declare', (el, ctx) => {
    if (el.contextKey) ctx.session.declare(el.contextKey, el.payload ?? el.text);
  });

const envelope = parse(aiResponseText);
if (envelope) await router.route(envelope, session);
```

## Browser usage (Vite + vanilla JS)

The browser build loads the WASM binary via `fetch` on first use. `parse()` and `extractProse()` return Promises.

```js
import { parse, DialSession, DialRouter, initDial } from '@wity.ai/dial';

// Optional: pre-load WASM at startup to eliminate cold-start latency on first message
await initDial();

const session = new DialSession();
const router  = new DialRouter()
  .on('dial-inform',  (el, ctx) => { /* render el.text to DOM */ })
  .on('dial-declare', (el, ctx) => {
    if (el.contextKey) ctx.session.declare(el.contextKey, el.payload ?? el.text);
  });

chatWidget.onNewMessage(async (text) => {
  const envelope = await parse(text);          // await — WASM is async in the browser
  if (envelope) await router.route(envelope, session);
});
```

`initDial()` is optional — `parse()` initialises the WASM automatically on first call and caches it. Call it early only if you want to eliminate the cold-start fetch on the first message.

## API reference

### `parse(text)`

Extracts and parses a `<dial>` envelope from AI response text. Returns `null` if no `<dial>` block is present. The input may contain prose around the envelope — only the structured block is parsed.

- **Node.js:** `(text: string) => DialEnvelope | null`
- **Browser:** `(text: string) => Promise<DialEnvelope | null>`

### `extractProse(text)`

Returns the prose portions of an AI response — text outside any `<dial>` block. Useful for displaying the natural language part of a mixed response alongside structured DIAL output.

- **Node.js:** `(text: string) => string`
- **Browser:** `(text: string) => Promise<string>`

### `initDial()`  *(browser only)*

Pre-loads the WASM binary. Returns a Promise that resolves when the binary is ready. Safe to call multiple times — the fetch only happens once.

### `DialSession`

Holds per-session state with two orthogonal streams:

| Method | Description |
|---|---|
| `declare(key, value)` | Store a declared context value (from `<dial-declare>`) |
| `getDeclared()` | Snapshot of all declared context — `Record<string, unknown>` |
| `recordResults(results)` | Append execution results (from `<dial-execute>`) — rolling 10-item window |
| `getLastResults()` | Snapshot of recent execution results |
| `clear()` | Reset all state |

```js
const session = new DialSession({ maxResults: 20 }); // default: 10
```

### `DialRouter`

Dispatches elements from a parsed envelope to registered handlers, respecting the `observe`/`yield` dependency graph. Handlers for unknown element types are silently skipped.

```js
const router = new DialRouter()
  .on('dial-inform',  handler)   // returns `this` — chainable
  .on('dial-ask',     handler)
  .on('dial-execute', handler);

await router.route(envelope, session);
```

Handler signature: `(element: DialElementNode, ctx: { session: DialSession, emit: (event: string) => void }) => Promise<void> | void`

`ctx.emit(event)` is used by handlers that need to yield events programmatically (e.g. a `dial-ask` handler emitting the selected choice event before the router processes downstream elements that observe it).

### `runStepGraph(steps, executor, initialYielded?)`

Runs the inner `observe`/`yield` dependency loop for a `<dial-execute>` step array. Use this inside a `dial-execute` handler to sequence steps correctly.

```js
router.on('dial-execute', async (el, ctx) => {
  const { results, yielded } = await runStepGraph(el.steps, async (step) => {
    const output = await exec(step.command);
    return { command: step.command, env: step.env, stdout: output, success: true };
  });
  ctx.session.recordResults(results);
});
```

Returns `{ results: DialExecutionResult[], yielded: Set<string> }`.

## TypeScript

Full TypeScript declarations are included. Key types:

```ts
import type { DialEnvelope, DialElementNode, DialSession, RouteContext } from '@wity.ai/dial';
```

See `index.d.ts` in the package for the complete type surface.

## Building the WASM (contributors)

The npm package bundles pre-built WASM binaries. To rebuild from Rust source:

```bash
# Node.js build (pkg-node/) — synchronous fs-based loader
npm run build:wasm:node

# Browser build (pkg-web/) — fetch-based loader, wasm-pack --target web
npm run build:wasm:web

# Both
npm run build
```

Requires [wasm-pack](https://rustwasm.github.io/wasm-pack/) and a Rust toolchain with the `wasm32-unknown-unknown` target.
