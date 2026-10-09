# Consumer Runtime

`@wity.ai/dial-runtime` (in this repository: `packages/dial-runtime`) runs one conversation with an agent that speaks DIAL. It is the piece between the language and an application: the turn loop, and the life of each proposal the agent makes — validated, shown to a person in readable form, accepted / dismissed / edited, run, and reported back.

It is domain-agnostic. A **domain** supplies the actions (what can be proposed and how to run it); a **surface** — a terminal, an app's chat panel, a test — shows the conversation and plays the person. The runtime holds the rules in between, so every surface behaves the same.

::: info Availability
The runtime lives in this repository and is not yet published to the public npm registry. It depends on `@wity.ai/dial` and adds nothing to the DIAL schema: outcomes are reported with the existing `<dial-acknowledge>` and `<dial-declare>` elements.
:::

## Usage

```js
import { Conversation } from '@wity.ai/dial-runtime';

const conversation = new Conversation({
  agent:  { send: async (message) => replyText },          // the transport to the agent
  domain: { actions, validate, preview, run, context },    // the vocabulary it may act on
  human:  { decide: async (suggestion) => ({ accept: true }),
            answer: async (ask) => 'yes' },                // a person, or a policy
  onEvent: (event) => render(event),
});

const { status, turns, outcomes } = await conversation.say('add a note: buy milk');
```

`say(text)` runs turns until the agent needs nothing back, and resolves with `status`:

| `status` | Meaning |
|---|---|
| `idle` | The last reply needed nothing back |
| `no-reply` | The agent did not answer within `timeoutMs` (default 90 000) |
| `turn-limit` | `maxTurns` (default 8) turns were used |

If `agent.send` rejects for any other reason, `say` rejects with that error.

## One turn

Each turn sends, in this order: the outcomes of the previous turn (if any), the domain's `context()`, and the person's words. The agent's reply is parsed and its elements handled in order:

| Element | What the runtime does |
|---|---|
| `<dial-inform>`, `<dial-acknowledge>` | Emits an `inform` event (with `act`: `'inform'` or `'acknowledge'`) |
| `<dial-ask>` | Emits `ask`, then calls `human.answer(ask)`. The answer goes back on the next turn. An empty answer means the question stands: no turn follows |
| `<dial-suggest>` | Becomes a **suggestion** — see below |

A reply with no `<dial>` envelope is treated as text and emitted as `inform`. Prose outside the envelope is emitted the same way.

A suggestion's payload is the `<dial-suggest>`'s own `<dial-payload>`; if it has none, the `<dial-declare>` that immediately follows it is taken as its payload.

## The life of a suggestion

```
proposed ─ unknown action / invalid payload ─▶ invalid      (the person never sees it)
    │
    ├─ read-only action ─▶ runs at once ─▶ done | failed
    ├─ hand-off action  ─▶ runs at once ─▶ handed-off
    │
    └─ otherwise the person decides
          accept  ─▶ runs ─▶ done | failed
          edit    ─▶ the edited payload is validated, then runs ─▶ done | failed
          dismiss ─▶ dismissed
          say     ─▶ superseded (this and the reply's remaining suggestions)
```

Every suggestion ends in exactly one outcome, and the agent is told it.

- **`invalid`** — the action is not in `domain.actions`, or `domain.validate` refused the payload. The outcome carries the domain's `code`, `field` and `hint`, so the agent can correct itself without the person being involved.
- **Read-only** (`mutates: false`) actions run without asking.
- **Hand-off** (`handoff: true`) actions run without asking and end as `handed-off`: another part of the surface takes the proposal over, with its own form and its own accept.
- **`edit`** — an edited payload that fails validation is shown back to the person (as `suggestion.issue`), who decides again; after three failed edits the outcome is `invalid`.
- **`say`** — the person wrote something else instead of deciding. Their words go with the next turn.

### When the agent hears

Only `done`, `failed` and `invalid` make a turn follow at once — these are what the agent should react to now. `dismissed`, `superseded` and `handed-off` are reported together with the person's next words; a dismissal on its own starts no turn.

What the agent was not told — because a send failed, or it did not reply — is kept and goes with the next `say`: the outcomes, and any words the person gave inside the conversation (an answer to a question, or what they wrote instead of deciding). `say('')` sends just what is owed.

## Outcome replies

Outcomes are reported in DIAL itself. `<dial-acknowledge>` closes the loop with a short text; `<dial-declare>` asserts the outcome as a fact under the key `outcome:<id>`:

```xml
<dial>
  <dial-acknowledge of="sg-3" yield="sg-3:failed">Couldn't do it: Add 'Brand' to Strengths.</dial-acknowledge>
  <dial-declare context-key="outcome:sg-3">
    <dial-payload type="application/json">{"action":"matrix.entry.add","status":"failed","error":"…","hint":"…"}</dial-payload>
  </dial-declare>
</dial>
```

The payload carries `action`, `status`, and — depending on the status — `result` (what the action returned), `error`, `code`, `field`, `hint`, and `edited: true` when the person changed the payload. `outcomeReply(outcomes)` builds this envelope and is exported for consumers that report outcomes themselves.

A suggestion's `id` is the `<dial-suggest>`'s `id` when the agent gave one, otherwise the runtime assigns `sg-1`, `sg-2`, …

## The domain

```js
{
  actions:  { 'add-note': { mutates: true }, 'remove-note': { mutates: true, destructive: true },
              'list-notes': { mutates: false }, 'open-poll': { mutates: false, handoff: true } },
  validate: (action, payload) => ({ ok: true }) /* or { ok: false, code, field?, hint } */,
  preview:  (action, payload) => "Add the note 'buy milk'",   // short, in the person's terms
  run:      (action, payload) => result,                       // may be async; throw to fail
  context:  () => '<context notes="3"/>',                      // sent with every turn, or ''
}
```

An error thrown by `run` becomes a `failed` outcome with its `message`, and its `code`, `field` and `hint` when present. `preview` is what the person is shown; if it throws or returns nothing, the action name is used. `destructive` is passed through on the suggestion so a surface can mark it.

## The human

```js
{
  decide: async (suggestion) => ({ accept: true }),   // | { dismiss: true } | { edit: payload } | { say: text }
  answer: async (ask) => 'text',                      // '' or null = no answer
}
```

`suggestion` is `{ id, action, text, payload, preview, destructive }` (plus `issue` after a refused edit); `text` is the agent's own wording from the `<dial-suggest>`. `ask` is `{ text, responseType, options }`.

Two ready-made humans are exported for tests and unattended runs:

- `policyHuman('accept' | 'dismiss', { answerWith })` — the same decision every time.
- `scriptedHuman(['accept', 'dismiss', { edit: {…} }, { say: '…' }, { answer: '…' }])` — decisions and answers in order.

## Events

`onEvent(event)` receives every step, for rendering and for transcripts:

| `event.type` | Fields |
|---|---|
| `sent` | `turn`, `message` |
| `reply` | `turn`, `text` |
| `inform` | `text`, `act` (when from an element) |
| `ask` | `text`, `responseType`, `options` |
| `suggestion` | `id`, `action`, `text`, `payload`, `preview`, `destructive`, `mutates` — emitted for valid suggestions only |
| `outcome` | `id`, `action`, `status`, `preview`, and the outcome's own fields |
| `no-reply` | `turn`, `error` |
| `turn-limit` | `turns` |

## Environments

The runtime runs wherever `@wity.ai/dial`'s parser does. In Node.js `parse()` is synchronous and in the browser it returns a Promise; the runtime awaits both.
