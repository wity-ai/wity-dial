# Agents as DIAL, and one board model (design note, 2026-11-12, for the owner's review)

DIAL is the model of performative exchange (lineage: Dialectic Chain → WUCE → DIAL; its README: a superset of WUCE,
whose execution model lives inside `<dial-execute>`). An agent uses it to keep **its own reusable, evolvable blueprint
of an exchange**. Aim: an agent's blueprint can lead to any outcome a session (person, assistant, or both) reaches on
the thought layer and the composition layer — by the same acts, down the same paths.

Nothing here is built yet. Revised the same day after the owner's review: `max`/`unit` replaced by `until`; roles
added; `env` is the layer an act works on (`contemplate` is a board command, not an env); the board model (section 7).

## 1. The layers, and who acts on them (as the code has it)

- **Thought layer** (vritti-ideator): a board (ChainOfThought) and its thoughts. A run starts here.
- **Composition layer** (vritti-composer, scene-core, scene-authoring): a composition and its scene.
- Observation is top-down: the composition layer observes the thought layer and reacts, never the reverse.
- A session — an agent run, a person, an assistant, or a mix — acts across both. Its entry may differ (the composer's
  board lifecycle, or a service), its acts go down the same operators: on a board, `cognitive-action-required`
  (`operators/action-types/contemplate.js` for an agent; `services/board-developer.js:111` for a person, reached by
  wity-mcp `board_operate_thought`); on a scene, the scene-authoring commands (studios, jity-mcp, the composer).
- Today an agent can only act on the board (`contemplate`, `ask-human` — the only registered action types). What a
  session made by scene commands (e.g. "Ollie and the Sleepy Stars": six pages of shapes, symbols and text, no
  generated media; the Gargi trailer's titles, lines, vignette and shaders over its generated clips) no agent can make.

## 2. The primitives of a blueprint

| Primitive | What it is | Today |
|---|---|---|
| **role** | who performs an act and who it is addressed to (author, reviewer, narrator…). Bound when a session starts: to a person, an agent or the system. One blueprint runs agentic, human or mixed unchanged | `_by` (default "system"); `addressed_to` in dial-core |
| **act** | DIAL's eight: inform, ask, suggest, declare, execute, acknowledge, delegate, phatic | contemplate (an execute), ask-human (an ask) |
| **observe** | when an act may be performed: what it responds to (its precondition) | `_on` |
| **yield** | what it makes, which others may observe | `tags` |
| **until** | its condition of satisfaction: performed again while what it observes recurs, until this holds (a count of its yields, an acceptance, a declared fact) | `maxExecutions` is one case: `until: count(yield) ≥ n` |
| **env** | the layer or system an execute step acts on: `board`, `scene`, `mcp:<server>` | — (the action-type registry) |
| **command** | the operation within that env, with its arguments: the env's own command vocabulary | `queryType` + `query` |

Blueprints compose by yield/observe (one's yield is another's trigger) and by `delegate` (an act handed to another
role or another blueprint).

**Two axes, not one list of action types.** Today's registry (`contemplate`, `ask-human`) mixes them:
- *the act*: what kind of performative — `ask-human` is an **ask** addressed to a role, not an action beside
  contemplate; inform, suggest, delegate, declare become possible the same way;
- *for an execute act, env + command*: `board` (contemplate, add, link, delete…: the board's commands), `scene` (the
  scene-authoring commands), `mcp:<server>` (a tool). Each env brings the command vocabulary people and assistants
  already use through its service and MCP — no second list; the action-type registry goes.

## 3. Today's template, mapped

| Template | DIAL |
|---|---|
| `contemplate` step | `<step env="board" command="contemplate" id observe yield until>intent</step>` in `<dial-execute>` |
| `ask-human` step | `<dial-ask id observe yield addressed-to timeout>question</dial-ask>`; the answer is declared into the variable. Broken today (questions not stored, `addNewClarification` an empty stub): fixed by this |
| `maxExecutions` | `until` |
| `displayMsg` | the step's `label` |
| `unitizationType` | the yield's **unit** (section 8): the 999 steps without it → the named default unit (today's rule); the 6 `treat-single` → `one` — see section 8 for what they do today |
| `variables`, `{{name}}` | `<dial-declare context-key>` at the head, filled from the start form |
| `_by` | `role` |

The agent record keeps everything that is not a speech act (identity, format, poster, privacy, sharing, publishing,
versioning, `yieldMap` with each yield's model); the steps become one `exchange` (`<dial>`).

**Entry, to be checked:** an agent's `contemplate` emits the event directly; a person's goes through
`board-developer` with `assertCanChangeBoard` and `requirePersonCanPay`. An agent's act should go through the same
service as a person's, so permission and payment hold alike — what an agent run does about them today is to be read
before building, not assumed.

## 4. What each yield does in the composition

`yieldMap` entry gains `role`: `content` (placed in the scene), `title`, `post` (caption, poll, blurb, gated preview —
the composition's words for publishing), `thinking` (board only). A conversion gives existing agents the roles that
reproduce what they do now (media → content; post tags → post; `composition-title` → title; unticked → thinking; other
words → content only where their module showed them, read by a dry run; the owner reviews before `--apply`).

Open: whether this stays a separate concept or becomes the composer's own blueprint — the thought → scene derivation
written as acts observing the board (env `scene`). To decide when the composer's placement is next touched.

## 5. Order of work (each step checked before the next)

1. dial-core: `until`, `role`, `env`/`command` on a step; serializer template ↔ `<dial>`, tested.
2. Conversion check, read-only: every stored agent round-trips; replay (prompt executor mocked) makes the same thoughts
   and tags (`@wity-ai/automation` replay design, `notes/design-2026-10-27-replay.md`).
3. `exchange` stored beside `dialectics` (migration by hand: dry run, `--apply`, `--rollback`); writers write both.
4. The run reads `exchange`, its board acts through the board's service; compared live on a few agents first.
5. `env="scene"`: an agent's execute steps run scene-authoring commands, as jity-mcp does.
6. Yield roles (section 4).
7. Retire: `dialectics`, `DOCUMENTED_FIELD`/`STORED_FIELD`, the action-type registry, wity-cli's WUCE fallback; then
   `tagsRendered`, modules, `rendered`, `sceneAuthored` — each after a prod count shows nothing reads it.

## 6. To count before building (prod, read-only)

- Which older step fields (`_for`, `refGroup`, `queryTarget`, `queryFeedback`, `queryOpposition`, `queryPerspective`,
  `queryGraph`, `queryBelief`) any agent sets, and whether the run reads them. Unused → dropped.
- `unitizationType` values in use; `_by` values in use.
- How `generateScopedQueryTag` scopes an observed tag, so `observe` keeps its meaning.

## 7. One board model: thoughtmap and thoughtbook

Both are typed knowledge graphs on the same record (ChainOfThought); only the engine's view differs.

### Audit (2026-11-12, read-only)

**Thoughtbook — one XML document on the board.**
- Stored: `ChainOfThought.knowledgeGraph` (`<wity-knowledge>`) + `knowledgeGraphRev`.
- One guarded writer: ideator `services/knowledge-graph-service.js` (compare-and-set on the rev, announces each
  write). Created by `board-admin.js` (a new board's document), copied by `operators/board-remix.js`; read by
  `operators/board-kernels.js` (decision binding).
- Edited through `@wity-ai/authoring` commands by wity-app (11 files: rkf, system, workbook, matrix, ideation
  workspace pages, assistant `stored-board-domain.js`, editors), wity-mcp `tools/boards.ts`, wity-cli
  (`WorkServices.ts`, `assistant/boardDomain.ts`).
- Also read by: wity-notebook-viewer (4), decisions-eval `board.js`, vritti-knowledge ingestion, the video studio's
  attached script (`attachedScript.ts`), vritti-ideator-decisions migrations, wity-system baseline.
- The engine (dialectics, occurrents, composer) sees none of it.

**Thoughtmap — one Thought per node, layout and links in a side record.**
- `Thought` (meaning: title, content, tags, intent, cause, taxonomy, semantic maps…).
- `VectorProp` via `graphProps` (x, y, w, h, map size, order/indices **and `links: Mixed[]`**) — written together by
  ideator `thought-developer.js updateThoughtVectorGraphProps` (keys idx, x, y, w, h, links), created by
  `operators/manage-chain-of-thought.js`. **Meaning (links) is stored and written with position.**
- `StyleProp` via `styleProps` (fill, stroke, opacity, fonts, className, styleString), its own update
  (`cot-vector-update` style-update).
- Links read into a graph by `@wity/ideation` `ideation-graph.js:225` **and, the same mapping again, by
  wity-thought-player `thought-player-page.js:351`** — a duplication to remove whatever is decided.
- Also: control-space-manager and file-manager define their own vector props (not the thoughtmap's; out of scope).

### Proposal
- **One graph, decomposed:** a board's semantic units are records the engine sees — a thought per unit (a thoughtmap
  node, a thoughtbook card/block), carrying its typed knowledge element; occurrents and DIAL `env="board"` acts work
  on any of them. Thoughtmap and thoughtbook become presentations of one graph.
- **An embed is one record holding its domain document** (system map, workbook, decisions, table): its parts are a
  domain model with their own commands, not thoughts.
- **Relations are records:** from, to, role (`causes`, `rkf:supports`…), properties — out of `VectorProp`, one link
  model for both.
- **Presentation separate from meaning:** position and style become a presentation over the graph (canvas, pages,
  flip; rkf themes). Today's thoughtmap look becomes one presentation; `StyleProp`/`VectorProp` fold into it.

### Must hold (no regression)
- An edit of several steps lands whole or not at all, as one compare-and-set does today: a board revision over its
  records (transaction, or the same guard).
- Exact round-trip: the records rebuild the identical `<wity-knowledge>`; every thoughtbook opens unchanged; every
  reader above keeps working (or reads through one function).
- Thoughtbook units becoming visible to the engine starts nothing by itself: whether a thoughtbook produces a
  composition is a decision.
- Large boards: read/write cost measured before switching.

### Order
After DIAL steps 1–2: the board model and its exact round-trip (tested on every stored thoughtbook, read-only) →
relations out of `VectorProp` → thoughtbooks migrated (by hand) → the thoughtmap as a presentation → readers moved to
one function, then the XML field retired.

## 8. Unitization: an act's output segmented into units of meaning

Counted on prod (2026-11-12, read-only): 164 live agents (57 published), 93 with steps, 1,005 steps. The eight older
step fields are set by none (dropped). `_by` is `system` on every step. `maxExecutions` set on 10 steps.
`unitizationType` set on 6 steps in 2 agents (`treat-single`). `queryType` empty on 5 steps in 1 agent (what the run
does with them: to read before converting).

### Today (vritti-ideator `operators/gpt-response-parser.js`)
- The prompt executor's reply is normalised for every model (`{ choices[].message.content, usage, answeredBy }`,
  vritti-prompt-executor `execute-prompt.js`); the parser reads it as JSON: each item a thought — unless its
  description holds a bullet list, then each bullet a thought and the item's other fields dropped.
- Not JSON: only lines starting `-`, `•`, `*` are kept; the rest of the reply is lost; none → nothing made, a warning.
- `treat-single` is checked on each item of the model's reply (`_item.unitizationType`). The step's setting reaches
  `vector.unitizationType` (`lifecycles/cognitive-processes.js:82`), which `parseMsgReceivedFromGpt` does not pass to
  the parser, and the prompt executor never reads it — **so the step's setting has no effect today**; a converted
  `treat-single` step must keep today's behaviour until the owner decides otherwise.
- The name ("gpt") says where text once came from, not what it does; the same in its functions.

### The model
- **The unit is the yield's**, not the command's: a yield declares what one unit is (a thought; a card with blocks; a
  typed knowledge element — claim, step, option, question), how many, and the relations between siblings (supports,
  follows). It applies to any act's output — a contemplation's reply, a person's answer, a tool's result.
- **Lossless by construction:** the whole output is kept (`Thought.rawContent` exists), each unit records the span it
  came from; the units can always be derived again; nothing is dropped silently.
- **Asked for in its shape:** the model is given the unit's schema (structured output), rather than its reply guessed
  at by bullets and regexes.
- **Code:** `operators/unitize.js`, `unitsOf(output, unit)` → units with their spans — replacing the parser, its
  contents and its name together, its tests pinning today's default first. Other "GPT" names in the ideator go in the
  ideator naming pass.

### Order
In DIAL step 1 the unit is part of the step model (default unit = today's rule, `one`); the lossless, schema-asked
unitizer is a runtime change, built and replay-tested after the conversion is proven (after step 4).

## 9. Status (2026-11-12, evening)

Built and released:
- **DIAL 0.2.2** (dial-core, dial-core-wasm, -web, @wity-ai/dial): `by`, `until` (`runs >= N`, `conditionOf`),
  `unit` on every act; `action` on a step; `context-key` on an ask; `serialize` (parse reads it back the same); any
  words carried exactly (entities, either quote, a `>` in a value). Variables stay the agent's start form (not
  declared in the exchange): they are a session's inputs, bound when it starts, as roles are.
- **@wity-ai/automation 0.4.0** `/exchange`: `exchangeOf(steps)`, `actsOf(exchange)`, `stepsOf(exchange)`.
  Checked on every stored agent (183) and run (1,509): what a run reads is the same for all 11,709 steps.
- **vritti-ideator-dialectics** (deployed, pm2 38): an agent's `exchange` written on every save; a step edit keeps
  the fields it does not change (it used to lose them); migration 005.
- **vritti-ideator** (on the server, not restarted): a run performs its exchange's acts through performers (the
  action-type registry gone); the price of a run reads the same acts; migration 2026-11-run-exchange.
  `tests/run-acts.test.js` replays every kind of stored step.

To finish the switch, in order (on the server): migration 005 `--apply` (vritti-ideator-dialectics), then
`migrate:run-exchange -- --apply` (vritti-ideator), then restart vritti-ideator. Then: the builder and
@wity-ai/automation edit the exchange itself; `env="scene"` performers; yield roles; retiring the steps.
