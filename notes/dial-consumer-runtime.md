# DIAL consumer runtime — driving domain actions with a human in the loop

Date: 2026-10-09
Status: **design, for review.** Nothing here is built yet. Nothing in it changes the DIAL spec or `DialRouter`.
Follows [dial-and-mcp.md](./dial-and-mcp.md): MCP (and our command registries) are the capabilities — the limbs;
DIAL is the discourse — the language. This note is the piece between them: how a consumer uses DIAL to propose and
run domain actions, with a person deciding, the same way on every surface.

## 1. Why

What happened while testing the in-app assistant (Sage, in wity-app) on 2026-10-09:

- A suggestion card showed the internal action name (`matrix.entry.add`) instead of a readable proposal.
- The user accepted an invalid proposal; it failed after the click, and the assistant had to ask for the missing
  fields.
- After another accept, the panel kept "thinking" forever: no reply, no timeout, no error.
- Dismissing a suggestion tells the assistant nothing; it never learns it was declined.
- Each of these could only be seen by deploying the app and trying it in a browser. That loop is too slow to make
  an assistant good.

And the same logic is written per surface: wity-app has its own suggest/accept/execute/reply code (spread across
the chat panel, `dial-handlers.js` and the page classes); wity-cli has a different one (suggestions are only
printed, nothing executes). A third surface would add a third.

## 2. Layers

| Layer | What | Owns |
|---|---|---|
| DIAL (`@wity.ai/dial`) | the language: 8 speech acts, observe / yield, payloads | parsing, routing, session — no domain knowledge |
| Domain vocabularies | the limbs: actions and their payload rules | e.g. wity-authoring (thoughtbooks, 51 commands); later scene-graph ops (Jity) |
| **Consumer runtime** (this note) | using the language to drive the limbs with a person in the loop | the turn loop, the suggestion lifecycle, outcome replies, timeouts |
| Surfaces | rendering, and playing the human | wity-cli (TUI), wity-app (chat panel), scripted runs, later Jity |

The runtime is domain-agnostic. Domains plug in. Surfaces only render and decide.

## 3. What exists (audited 2026-10-09)

- **wity-app + the chat widget** (`hais-widgets/ai-chat-wity-widget`): the widget creates the session with the Sage
  artefact; each request carries `controlSpace` / `embeddingSpace` resolved from it. The app prepends a
  `<dial-context domain="wity-thinking">` board snapshot (`chat-context.js`) to the user's text. The widget parses
  DIAL and emits elements; `dial-handlers.js` pairs `suggest` + `declare`, auto-runs read-only commands, shows a card
  for the rest. On accept the page runs the command and sends `[command] {json}` back as a new message.
- **wity-cli** (`hais-clis/wity-cli`): same backend (`UnrefinedIdeationService` → vritti-ideator-unrefined), parses
  DIAL with `@wity.ai/dial`, prompts with inquirer for `dial-ask`, runs shell steps for `dial-execute`. It sends no
  control space or artefact (so it does not reach Sage), has no board context, and `dial-suggest` is print-only.
- **The vocabulary** (wity-authoring): every command has a name, a summary, a strict payload schema, `mutates`, and
  runs on a live document (`wrap`) or a stored one (`apply`); vritti-ideator's `applyCommands` runs the same commands
  on the server.

## 4. The runtime

### 4.1 Turn loop

```
user text ──▶ [context snapshot from the domain] + text ──▶ agent (artefact → control / embedding space)
                                                                │
agent reply (DIAL) ◀────────────────────────────────────────────┘
   inform / ask / acknowledge ──▶ surface renders (ask waits for the human's answer)
   suggest + declare          ──▶ suggestion lifecycle (4.2)
   execute                    ──▶ steps by env (shell, or a domain executor)
```

The runtime holds one conversation: the session, pending suggestions, and the last outcomes.

### 4.2 Suggestion lifecycle

A `suggest` + its `declare` payload become one suggestion with an id (the element's `id` if the agent gave one,
else assigned).

```
proposed ──validate──▶ invalid ──▶ outcome "invalid" to the agent (the human never sees it)
    │
    └─ valid ──▶ pending ──accept──▶ running ──▶ done   ──▶ outcome "done" + result
                   │          │                 └──▶ failed ──▶ outcome "failed" + code / field / hint
                   │          └─edit──▶ (payload changed by the human) ──▶ validate again
                   ├─dismiss──▶ dismissed ──▶ outcome "dismissed"
                   └─new user message first──▶ superseded ──▶ outcome "superseded"
done ──later undo by the human──▶ undone ──▶ outcome "undone" (on the next turn)
```

Rules:
- **Read-only actions** (`mutates: false`) skip `pending`: run at once, outcome back.
- **Only valid proposals reach the human.** Validation is the domain's (4.4).
- **Every proposal ends in exactly one outcome**, and the agent is told it.
- **No silent waits:** after an accept, if no agent reply arrives within a limit, the surface shows "no response —
  retry" instead of spinning.
- **Destructive actions** (the domain flags them) are marked as such in the preview.

### 4.3 Outcome replies

Told to the agent with DIAL's own elements — no spec change:

```xml
<dial>
  <dial-acknowledge of="sg-3" yield="matrix.entry.add:failed">
    <dial-payload type="application/json">
      {"status":"failed","code":"invalid-payload","field":"fields.impact",
       "hint":"impact must be one of 'high', 'medium', 'low' (or '' to clear)"}
    </dial-payload>
  </dial-acknowledge>
</dial>
```

`status` ∈ `done` (with `result`) · `failed` · `invalid` · `dismissed` · `superseded` · `undone`. The agent's
directive explains how to react: retry once on `invalid` / `failed` when the hint says how, continue on `done`,
move on (or ask) on `dismissed`.

### 4.4 Domain plug-in contract

```js
{
  name: 'thoughtbook',
  actions: [{ name, summary, params /* JSON schema */, mutates, destructive?,
              preview(payload, doc) /* → short human text: "Add 'Strong brand' to Strengths" */ }],
  validate(action, payload, doc),            // → { ok } | { ok: false, code, field, hint }
  executor: { run(action, payload) },        // local document, or a server (applyCommands, MCP)
  context(doc),                              // → the snapshot sent with each user turn
  agent: { artefact },                       // which assistant (resolves control / embedding space)
}
```

For thoughtbooks all of this exists except `preview` and `destructive`, which belong next to each command in
wity-authoring (the vocabulary owns how its actions read), and `context`, which moves from wity-app's
`chat-context.js` into the plug-in so app and CLI send the identical snapshot.

### 4.5 The human, as an interface

```js
human.decide(suggestion) → { accept } | { dismiss } | { edit: newPayload }
human.answer(ask)        → value
```

Implementations:
- **TUI** (wity-cli): preview, then Accept / Dismiss / Edit (edit opens the payload's fields).
- **wity-app**: the chat panel's cards (rendering only; the lifecycle is the runtime's).
- **Policy** (tests, automation): `accept-all`, `dismiss-all`, or a script (`[accept, dismiss, edit {...}]`).

## 5. Surfaces

- **wity-cli**: a new mode alongside the existing coder flow (which stays as it is), e.g.
  `wity sage --board <slug> "add a SWOT and put 'Strong brand' under Strengths"` — interactive, or
  `--human accept-all` / `--script steps.json` for unattended runs; prints the transcript (said, proposed, decided,
  ran, result) and can save the resulting document.
- **wity-app**: the chat panel and `dial-handlers.js` move onto the runtime; the pages keep only the editor.
- **Later**: Jity compositions as the second domain (scene-graph ops), proving the plug-in boundary.

## 6. Testing

- **Without a model:** scripted agent replies (recorded DIAL) + a policy human + the local executor → the whole
  lifecycle (invalid, failed, dismissed, superseded, timeout, undo) runs as ordinary tests, in CI.
- **With the real assistant:** the TUI against Sage, on a board copy or a scratch board. Each run costs model
  calls; runs are capped by turns.

## 7. Open questions

1. **Package:** name and home. Proposed: a new package inside this repo, `packages/dial-runtime`, beside
   `dial-knowledge` (which is likewise built on `@wity.ai/dial`) — `dial` itself stays domain-free and unchanged.
   Domains depend on nothing new. To decide: its npm scope and registry (public `@wity.ai/*` like `dial`, or the
   private `packages.wity.ai` like the domain packages).
2. **Artefact resolution in the CLI:** how the widget turns an artefact into control / embedding space (an
   organizer-service call) — reuse it, so CLI and app reach the same assistant.
3. **Does the backend pass a DIAL outcome reply through as-is?** Today replies are plain text; confirm the agent
   receives the XML verbatim.
4. **Directive changes:** Sage must be told the outcome format and how to react (one new control-vector section).
5. **Suggestion ids:** ask agents to put `id` on `dial-suggest`, or always assign one in the runtime.
6. **Several suggestions in one reply:** today the app handles one suggest + declare per response; decide whether
   the runtime queues them.
7. **Legacy action names** (`add-block`, …): stay accepted by the app until no directive mentions them.

## 8. Plan

1. The runtime core with the thoughtbook plug-in and the local executor; model-free tests for every lifecycle path.
   Reproduce the stuck accept and the action-name label there.
2. The wity-cli TUI mode against the real Sage (artefact, board context, outcome replies).
3. wity-app's chat panel onto the runtime.
4. Jity compositions as the second domain.
