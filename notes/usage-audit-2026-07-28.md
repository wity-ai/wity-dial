# DIAL Usage Audit — Cross-Ecosystem Review

**Date:** 2026-07-28
**Scope:** All known consumers of the DIAL protocol and @wity.ai/dial package across the Wity ecosystem.

---

## Consumers Audited

| App | Path | DIAL role | Artefact |
|---|---|---|---|
| wity-cli | `/home/ankur/flabs/hais-clis/wity-cli` | Agentic execution | Server-side (coder profile) |
| jity-video-studio | `/home/ankur/flabs/hais-widgets/jity-video-studio` | Studio copilot | `lila-creative-assistant-jity-video-studio-8d309faf` |
| jity-design-studio | `/home/ankur/flabs/hais-widgets/jity-design-studio` | Studio copilot | `maya-design-assistant-jity-design-studio-6ed96461` |
| wity-games (doodle-char) | `/home/ankur/flabs/comm/WITY/wity-games` | Parametric character | Not yet artefacted |
| wity-websites (careers) | `/home/ankur/flabs/comm/WITY/wity-websites` | AI interview form | `lila-collab-manager-at-wity-36240b24` |
| ai-chat-wity-widget | `/home/ankur/flabs/hais-widgets/ai-chat-wity-widget` | Transport layer (no DIAL) | N/A |

---

## Element Usage Matrix

| Element | wity-cli | video-studio | design-studio | doodle-char | careers |
|---|---|---|---|---|---|
| `dial-inform` | Console output | AI bar message | AI bar message | Speech bubble (3s) | Interview bubble |
| `dial-ask` | Inquirer prompt (choice/confirm/input) | AI bar message | AI bar message | Persistent speech bubble | Interview question + input bar |
| `dial-suggest` | Dim-printed | 11 actions w/ confirm UX | 7 actions w/ confirm UX | Not used | Not used |
| `dial-execute` | ShellExecutor + runStepGraph | Not used | Not used | Not used | Not used |
| `dial-declare` | Session.declare() (arbitrary facts) | Paired with suggest (action payloads) + viewMode | Paired with suggest (action payloads) + viewMode | mood, face params, animation sequences | Form field accumulation |
| `dial-acknowledge` | Dim-printed | AI bar message | Not used | Not used | Styled acknowledge bubble |
| `dial-phatic` | No-op | Not used | Not used | Brief reaction beat (1.6s bubble) | `signal="session-complete"` triggers form submit |
| `dial-delegate` | Not used | Not used | Not used | Not used | Not used |

---

## How Each Consumer Uses @wity.ai/dial

### wity-cli

**Import:** `parse`, `extractProse`, `DialRouter`, `DialSession`, `runStepGraph`

The most complete consumer. Full integration:
- `parse()` extracts DIAL envelope from LLM response
- `extractProse()` shows conversational text outside the envelope
- `DialElementRouter` wraps `DialRouter` with terminal-specific handlers
- `DialSession` singleton persists declared facts + execution results across turns
- `DialContextBuilder.build()` injects `[ENV]/[SESSION]/[RESULTS]/[INSTRUCTION]` into each request
- `ShellExecutor` runs `dial-execute` steps via `runStepGraph()`
- Legacy WUCE fallback path exists (being phased out)

**Context injection pattern:** Plain-text sections (`[ENV]`, `[SESSION]`, `[RESULTS]`, `[INSTRUCTION]`) separated by `\n\n---------\n\n`.

### jity-video-studio

**Import:** Does NOT import `@wity.ai/dial` directly. Uses `wityChatService.onDialEvent()` from the widget bridge — receives pre-parsed DIAL element objects.

**Key files:**
- `src/wity-chat/useDialHandlers.ts` — React hook subscribing to DIAL events, dispatches to Zustand stores
- `src/wity-chat/artefact-ref/directive.ts` — LOCAL REFERENCE COPY of server-side artefact directive
- `src/wity-chat/artefact-ref/static-context.ts` — Few-shot examples reinforcing DIAL compliance
- `src/wity-chat/studioConfig.ts` — Artefact slug + `buildContextMessage()` for state snapshots
- `src/wity-chat/service.ts` — `WityChatService` singleton managing widget lifecycle + DIAL event bus

**Suggest actions (11):** `set-transition`, `reorder-segments`, `delete-segment`, `update-segment-text`, `open-drafting`, `add-segment`, `select-segment`, `set-layout`, `set-volume`, `set-aspect-ratio`, `add-character`

**Pattern:** Every action follows `<dial-suggest action="X">preview</dial-suggest>` + `<dial-declare context-key="XSuggestion">{JSON}</dial-declare>`. Handler uses `waitForPending(key)` (promise with 5s timeout) to cross-correlate the pair, then `awaitSuggestion()` for user confirm/reject UI.

**Context injection pattern:** XML `<dial-context domain="video-studio">` containing segments, scene graph elements, characters, selection state.

### jity-design-studio

**Import:** Same as video-studio — uses widget bridge, not `@wity.ai/dial` directly.

**Key files:**
- `src/wity-chat/artefact-ref/directive.ts` — LOCAL REFERENCE COPY, persona "Maya"
- `src/wity-chat/studioConfig.ts` — Artefact slug + `buildContextMessage()` for design state

**Suggest actions (7):** `add-text`, `reorder-pages`, `apply-bulk-op`, `snap-fit-images`, `add-page`, `delete-page`, `generate-images`

**Same paired suggest+declare pattern as video-studio.**

**Context injection pattern:** XML `<dial-context domain="design-studio">` containing pages, elements, canvas dimensions.

### wity-games (doodle-char)

**Import:** `initDial`, `parse`, `DialRouter`, `DialSession` from `@wity.ai/dial` (browser build)

**Key files:**
- `src/shared/character/dial-env.js` — System prompt (DIAL grammar for face params) + `buildEnvMessage()`
- `src/shared/character/draw.js` — Canvas rendering of parametric face
- `src/shared/character/sequence.js` — Keyframe animation player
- `src/pages/doodle-char/components/pages/game-page.js` — Chat UI + DialRouter handlers

**No artefact yet.** System prompt is injected client-side via invented `<system>/<environment>/<player-input>` wrapper tags in `buildEnvMessage()`. This should be replaced with an artefact.

**Unique context-key semantics:**
- `context-key="mood"` → preset snap (happy/sad/surprised/neutral/suspicious)
- `context-key="face"` → partial face param JSON override
- `context-key="sequence"` → keyframe animation array (t, face, ease)

**Context injection pattern:** Invented XML wrapper tags (`<system>`, `<environment>`, `<player-input>`).

### wity-websites (careers)

**Import:** Does NOT import `@wity.ai/dial`. Uses `window.WityChat.onDialEvent()` from the widget.

**Key files:**
- `src/pages/careers/services/dial-renderer.js` — Renders dial-inform/ask/phatic/acknowledge as interview UI bubbles
- `src/pages/careers/services/dial-form-handler.js` — Accumulates dial-declare values into form data, submits on `dial-phatic signal="session-complete"`
- `src/pages/careers/components/pages/careers-page.js` — Orchestrates widget, renderer, form handler

**Unique pattern:** Uses `dial-declare` to progressively collect form fields (name, email, etc.) throughout a conversational interview. When the AI decides the interview is complete, it emits `<dial-phatic signal="session-complete">` which triggers form submission to forms.wity.ai.

**Uses license key auth** (`LIC-AI-C-a046053472e360033d5c3d39c188681a`) — no user login required.

### ai-chat-wity-widget

**Zero DIAL usage.** Pure transport and UI layer. Provides:
- `sendMessage()` / `onNewMessage()` — raw message transport
- `onDialEvent()` — pre-parsed DIAL element dispatch to parent
- Artefact system (`artefactPersona`, `controlSpace`, `embeddingSpace`) — server-side AI shaping
- Widget bridge via postMessage (iframe ↔ parent)

The widget parses DIAL internally and emits element objects to consumers via `onDialEvent()`. This is why the studios don't import `@wity.ai/dial` — the widget does the parsing.

---

## What's Working Well

### 1. The suggest + declare pair pattern

The ecosystem's real workhorse. Video studio has 11 actions, design studio has 7. Each follows the same architecture: `<dial-suggest action="X">` carries the human-facing preview, `<dial-declare context-key="XSuggestion">` carries the structured payload. The handler awaits user confirmation, then applies. Two independent teams converged on this pattern without coordination.

### 2. context-key as an open-ended extension point

Used for radically different things across apps:
- Studios: action payloads (JSON), view mode signals
- Doodle char: mood snaps, face param overrides, animation keyframes
- Careers: form field accumulation
- CLI: arbitrary agent-asserted facts

No type registry. No schema negotiation. The artefact directive defines the vocabulary per app. Right level of openness for a protocol that can't predict its consumers.

### 3. Artefact separation (where it exists)

Studios demonstrate the right architecture:
- `directive.ts` and `static-context.ts` are local reference copies — "source of truth is the server-side artefact memory entry"
- `studioConfig.ts` sets artefact slug, widget config, context snapshot builder
- Widget loads headlessly, app's own UI drives the conversation
- Artefact's `controlSpace` + `artefactPersona` shape AI behavior server-side

### 4. Same primitives, radically different runtime semantics

The eight elements serve: terminal agentic execution, video editing copilot, design editing copilot, parametric character animation, and AI-driven interview forms — without any protocol changes.

---

## Bottlenecks and Concerns

### 1. The suggest + declare pair is a workaround

Every studio action requires TWO elements where ONE should suffice. The AI must emit both in the right order. The handler cross-correlates via `waitForPending()` (a hand-rolled promise with 5s timeout). If the AI emits suggest without declare, or swaps the order, the handler silently fails.

**Root cause:** `dial-suggest` lacks a `payload` slot. If it had one (like `dial-inform` has `<dial-payload>`), the paired declare would be unnecessary.

### 2. `<dial-context>` is invented XML, not part of DIAL

Three different context injection patterns exist across the ecosystem:
- Studios: `<dial-context domain="...">` — invented XML
- CLI: `[ENV]\n...\n[SESSION]\n...` — plain-text sections
- Doodle char: `<system>/<environment>/<player-input>` — invented XML

DIAL is silent on input context (arguably correct — protocol shouldn't prescribe initialization), but the inconsistency creates DX friction. Every new app reinvents this.

### 3. "Respond exclusively in DIAL XML" — all-or-nothing

Studio directives enforce pure DIAL ("Never output raw text outside DIAL elements"). CLI doesn't — uses `extractProse()` for mixed responses. No smooth gradient between "always DIAL" and "sometimes DIAL." Studios wrap every conversational snippet in `<dial-inform>`, which works but loses naturalness.

### 4. Artefact directives re-teach the entire DIAL grammar

Every directive re-specifies what DIAL elements exist and how to use them. Video studio directive is 100+ lines. Design studio is 78 lines. Each starts from scratch. No shared base directive that all apps inherit.

Consequences:
- Adding a new element type requires updating every artefact
- AI's understanding of DIAL comes from the directive, not from training or llms.txt
- Subtle wording differences cause behavioral drift across apps

### 5. `dial-phatic signal="session-complete"` stretches element semantics

Using phatic (defined as "no semantic payload, channel maintenance") to signal "submit the form now" overloads the element's meaning. Works, but confusing for new developers.

### 6. Studios don't use @wity.ai/dial at all

The widget bridge provides pre-parsed DIAL elements via `onDialEvent()`. Studios consume these directly — no `parse()`, `DialRouter`, or `DialSession` from the package. The DIAL JS package is only used by wity-cli and wity-games. The studios are consuming DIAL semantics without the library.

---

## Potential Improvements (for discussion)

These are observations, not prescriptions. Each has trade-offs.

1. **Add `<dial-payload>` support to `<dial-suggest>`** — eliminates the paired declare workaround, reduces fragility, halves the element count per action.

2. **Conventionalize context snapshots** — even a lightweight recommendation ("use `<dial-context domain="...">` for app state injection") would reduce reinvention across apps.

3. **Shared base directive fragments** — a canonical "DIAL basics" prompt that artefacts import rather than restate. Reduces drift, simplifies new artefact creation.

4. **Consider whether the widget's `onDialEvent()` should expose `DialRouter`-like semantics** — so studios get observe/yield dependency resolution for free instead of processing elements as a flat stream.

5. **Doodle char needs an artefact** — replace `buildEnvMessage()` with server-side artefact config. The invented wrapper tags go away.
