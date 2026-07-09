# wity-dial

DIAL — Dialectic Interagent Language. An XML protocol for structured communicative exchange between humans and AI agents. Rust parser compiled to WASM, with a JavaScript layer for Node.js and browser.

**[Full documentation → wity.ai/stack/dial](https://www.wity.ai/stack/dial/)**

---

## Overview

DIAL encodes the pragmatic layer of agent interaction — not what agents say, but what they *do*: assertions, questions, proposals, execution, acknowledgements, declarations, handoffs, channel signals. Each element is a typed speech act with a machine-readable dependency model (`observe`/`yield`).

It is a superset of WUCE. WUCE's entire execution model lives inside `<dial-execute>`.

| Package | Purpose | Environment |
|---|---|---|
| [`@wity.ai/dial`](https://www.npmjs.com/package/@wity.ai/dial) | Parse · route · session state — JS layer over dial-core WASM | Node.js + Browser |
| [`@wity/dial-knowledge`](https://github.com/wity-ai/wity-dial/tree/master/packages/dial-knowledge) | Cross-session persistence of declared context and execution results | Node.js |
| `dial-core` | DIAL parser — Rust library | Rust |
| `dial-core-wasm` | WASM bindings for dial-core (wasm-pack, dual Node.js + web targets) | WASM |

## Quick start

```bash
npm install @wity.ai/dial
```

### Node.js

```js
import { parse, extractProse, DialSession, DialRouter, runStepGraph } from '@wity.ai/dial';

const session = new DialSession();
const router  = new DialRouter()
  .on('dial-inform',  (el, ctx) => { /* el.text, el.render, el.payload */ })
  .on('dial-ask',     async (el, ctx) => { ctx.emit('choice:yes'); })
  .on('dial-execute', async (el, ctx) => {
    const { results } = await runStepGraph(el.steps, myExecutor);
    ctx.session.recordResults(results);
  })
  .on('dial-declare', (el, ctx) => {
    if (el.contextKey) ctx.session.declare(el.contextKey, el.payload ?? el.text);
  });

const envelope = parse(aiResponseText);   // DialEnvelope | null — synchronous
if (envelope) await router.route(envelope, session);
```

### Browser (Vite)

The `"browser"` export condition is picked up automatically — no config needed.
`parse()` and `extractProse()` return Promises; the WASM binary is loaded via `fetch` on first call and cached.

```js
import { parse, initDial, DialSession, DialRouter } from '@wity.ai/dial';

await initDial(); // optional — pre-loads WASM before first message

chatWidget.onNewMessage(async (text) => {
  const envelope = await parse(text);
  if (envelope) await router.route(envelope, session);
});
```

## Design principles

- **Performative-first.** Every element is defined by its illocutionary role — what act it performs — not its data shape. `<dial-ask>` and `<dial-inform>` may carry identical content but are categorically different acts with different routing behaviour.
- **Generative, not pre-authored.** A DIAL envelope is produced turn-by-turn by an LLM at runtime. No dialogue graph is traversed, no state machine consulted. Structure emerges from the exchange via shared context (`<dial-declare>`) and the `observe`/`yield` dependency model.
- **WUCE superset.** Every valid WUCE envelope is a valid `<dial-execute>` block. The execution model is preserved unchanged — observe/yield step graphs, parallel activation, event-driven chaining.
- **Rust core, browser-safe.** The parser is written in Rust and compiled to WASM via wasm-pack. Two build targets: `--target nodejs` (synchronous, fs-based) and `--target web` (async, fetch-based). The JS layer auto-selects via package.json export conditions.

## Documentation

Full protocol reference, schema, and JS API docs:
**https://www.wity.ai/stack/dial/**

For AI coding agents: [llms.txt](https://www.wity.ai/stack/dial/llms.txt) · [llms-full.txt](https://www.wity.ai/stack/dial/llms-full.txt)

---

## Wity stack

- [wity-graph](https://www.wity.ai/stack/knowledge-graph/) — headless directed graph library
- [wity-scene](https://www.wity.ai/stack/scene-graph/) — headless XML scene-graph library
- [WUCE spec v2.3](https://www.jity.ai/academy/en/products/wity/concepts/wity-universal-command-envelope-wuce-spec-v2-3) — predecessor execution protocol

---

Built by [Wity AI](https://www.wity.ai)
