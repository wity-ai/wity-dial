# Agents as DIAL: design note (2026-11-12, for the owner's review)

An agent's thinking is stored today as a **dialectics template** (`vritti-ideator-dialectics`, `DialecticsTemplate`),
the oldest form in the lineage Dialectic Chain → WUCE → DIAL. DIAL is the language of performative exchange that the
template was the first form of. Its README says it is a superset of WUCE, whose whole execution model lives inside
`<dial-execute>`. This note maps the template onto DIAL and onto the agent record, and settles what each yield does in
the composition, so that:

- an agent is **its settings + one DIAL exchange**;
- the run interprets DIAL;
- the template, its field translations and the WUCE paths are retired, with no agent lost.

Nothing here is built yet.

## 1. What is stored today

**A step** (`DialecticStepSchema`):

| Field | Meaning | Today's name at the edge (`@wity-ai/automation` DOCUMENTED_FIELD) |
|---|---|---|
| `refName` | the step's name; also its execution counter key | `stepName` |
| `_on` | the tag it waits for (scoped by `generateScopedQueryTag`) | `observe` |
| `queryType` | what it does: `contemplate` or `ask-human`, the only two registered (`ActionTypeRegistry`) | `actionType` |
| `query` | the prompt, or the question; `{{variables}}` filled in | `actionString` |
| `tags` | what it yields: tags put on the thoughts it makes, or for ask-human the variable it fills | `yield` |
| `maxExecutions` | how many times it may run (null: unlimited) | `maxExecutions` |
| `displayMsg`, `unitizationType` | the message shown while it runs; how a reply is split into thoughts | the same |
| `_for`, `_by`, `refGroup`, `queryTarget`, `queryFeedback`, `queryOpposition`, `queryPerspective`, `queryGraph`, `queryBelief` | older fields; **whether any stored agent uses them, and how, is to be counted** (section 6) | — |

**The agent** (the rest of `DialecticsTemplate`):
- identity and presentation: `puid`, `displayName`, `objective`, `description`, `symbol`, `poster`, `identity`, `launchPageConfig`, `startForm`, `autoStart`, `autoSeedCentralIdea`;
- what it makes: `outcomeFormat`, `outcomeLabel`, `outcomeDescription`, `outcomeBlurb`, `outcomePoster`, `outcomeContains`, `outcomeKeywords`;
- the exchange's data: `variables`, `yields` (the yields chosen for the composition: the agent builder's yield selector), `yieldMap` (a yield → the model that makes it);
- owner, sharing, publishing and versioning: `creator*`, `privacy`, `sharingSettings`, `isPublished`, `version`, `status`, `forkedFrom`, `pubKey`, `slug`, `tags`, `meta`, `usageStats`, `teleologiCategory`, `fsm_abstraction`, `ontology_abstraction`, `_type`.

## 2. The model: an agent = settings + one DIAL exchange

The steps become **one DIAL document** (`<dial>`), kept on the agent as `exchange`, the one source of how the agent
thinks. Everything that is not a speech act stays a field of the agent record, as now. The agent record and its owner,
sharing and publishing do not move.

| Template | DIAL | Why |
|---|---|---|
| a `contemplate` step | `<dial-execute>` with one `<step env="contemplate" id="<refName>" observe="<_on>" yield="<tags…>">query</step>` | thinking is an action the run carries out on what it observes: an execute step, in DIAL's own observe/yield graph |
| an `ask-human` step | `<dial-ask id="<refName>" observe="<_on>" yield="<variable>" response-type="text">question</dial-ask>` (timeout: the creator's expiry, see below) | asking a person is DIAL's ask |
| `maxExecutions` | an attribute on the step (`max`): **an addition to DIAL** | DIAL has no repeat limit; WUCE-on-a-board needs one |
| `displayMsg` | the step's `label` | DIAL already has it |
| `unitizationType` | an attribute on the step (`unit`): **an addition** | how a reply becomes thoughts is the board's, said per step |
| `variables`, `{{name}}` | `<dial-declare context-key="name">` at the head of the exchange, values from the start form | declared context is DIAL's |

Execution environments: `env="contemplate"` (the prompt executor) and, later, `env="mcp:<server>"`
(`notes/dial-and-mcp.md`) **replace the action-type registry**: one way to say what a step does, in the language.

**ask-human** (broken today: questions are not stored, `addNewClarification` is an empty stub) becomes a real
`dial-ask`. The run records it as asked, the person answers on the board, and the answer is declared and fills the
variable. The creator sets `timeout`. When it expires, the run takes the step's default (`<dial-option default>`) or
fails it, by name. Until this lands, ask-human never blocks a run, as now.

## 3. What each yield does in the composition (settled here, not by format)

Today, which thoughts reach the page is decided by a module template over `tagsRendered` (from `yields`). With modules
retired, the author says it once, per yield, on the agent: a **`yieldMap` entry gains `role`**. `yieldMap` already
holds per-yield settings (its model), so the role goes beside them rather than into a second map:

| `role` | What the composer does with a thought of that yield | Today's equivalent |
|---|---|---|
| `content` | placed in the scene: media as now; words as a text element (on its parent's page, under its image) or into an open text slot | the module drew it |
| `title` | the composition's title text, on its first page | `composition-title` |
| `post` | kept as the composition's words for publishing (caption, poll, blurb, gated preview); never on the page | `post-commentary`, `poll-*`, `composition-blurb`, `composition-description`, `gated-text-preview` |
| `thinking` | kept on the board only | `no-render`, or a yield unticked in the yield selector |

**No regression for existing agents.** A one-off conversion gives each existing agent's yields the role that reproduces
what it does now:
- media yields → `content`;
- the post-word tags → `post`;
- `composition-title` → `title`;
- yields unticked in the yield selector → `thinking`;
- **the remaining word yields → `content` only where the agent's module showed them as body text, else `thinking`**.

The last rule is read from the module the agent's compositions used, by a dry run. The owner reviews the per-agent list
before `--apply`. Once roles exist, the PDF transition (`sceneAuthored` + `rendered`) can go: the words are in the scene.

## 4. How the run changes (vritti-ideator)

- `DialecticsInstance` reads the agent's `exchange` (parsed by dial-core), not `dialectics`. It runs the observe/yield
  graph exactly as today: a step whose `observe` tag appears on a new thought runs, at most `max` times, and its output
  is unitised into thoughts tagged with its `yield`.
- The board, its thoughts, the run status (`agent-run-status`) and the composer's placement are unchanged.

## 5. Order of work, each step checked before the next

1. **dial-core / @wity.ai/dial:** `max` and `unit` on a step; `env="contemplate"`; a step's `yield` list (exists).
   A serializer from steps to `<dial>` and back, tested.
2. **Conversion check (read-only):** convert every stored agent and compare both ways (template → DIAL → template is
   identical in every field that is used), plus a **replay**: run each published agent's exchange against recorded
   seeds with the prompt executor mocked, both ways, and compare the thoughts made and their tags.
   `@wity-ai/automation` has a replay design (`notes/design-2026-10-27-replay.md`) to build on.
3. **Store `exchange` beside `dialectics`:** migration by hand (dry run, `--apply`, `--rollback`). The agent builder
   and `@wity-ai/automation` write both, from one function, while 4 is checked.
4. **The run reads `exchange`.** Compare live runs on a few agents before switching all.
5. **Yield roles** (section 3): conversion dry run, the owner's review, `--apply`. Then the composer places by role
   (scene-authoring text placement and slots, step 5.9), and Ghost HTML and PDF come from the scene.
6. **Retire:**
   - `dialectics` (the step schema);
   - `DOCUMENTED_FIELD` / `STORED_FIELD` (the translation between stored and documented names);
   - the action-type registry;
   - wity-cli's WUCE fallback;
   - `tagsRendered`, the modules, `rendered`, `sceneAuthored` (step 6 of the composition plan).

   Each after a prod dry-run count shows nothing still reads it.

## 6. To verify before building (not assumed)

- Which of the older step fields (`_for`, `_by`, `refGroup`, `queryTarget`, `queryFeedback`, `queryOpposition`,
  `queryPerspective`, `queryGraph`, `queryBelief`) any stored agent sets, and whether the run reads them. Count them on
  prod, read-only. A field nobody sets is dropped, not carried.
- `unitizationType` values in use, and what each does.
- The agent builder's `componentsInDialectics` and `template-renderer-preview`, which tie yields to module variables:
  they go with the modules, and their yield-selection UI becomes the role picker.
- How `generateScopedQueryTag` scopes an observed tag, so the DIAL `observe` keeps the same meaning.
