# Relation to WUCE

## WUCE is a subset of DIAL

DIAL does not replace WUCE. It promotes WUCE's execution model to a first-class element type within a larger discourse system.

```
WUCE v2.3                         DIAL v0.1
─────────────────────             ─────────────────────────────────────
<wuce envelope>                   <dial ...>
  <step ... />          →           <dial-execute ...>
  <step ... />                        <step env="shell">command</step>
  <step ... />                        <step env="shell">command</step>
</wuce envelope>                    </dial-execute>
                                  </dial>
```

The **sequencing model** is preserved unchanged — observe/yield dependency graph, parallel activation, event-driven chaining. What changed is the **step content model**.

## Step content: what changed and why

WUCE steps used abstract action descriptors (`actionType`, `actionMeta`) translated by domain-specific executors:

```xml
<!-- WUCE: abstract action type → executor translates to command -->
<wuce-step actionDomain="filesystem" actionType="cd"
           actionMeta='{ "path": "/home/user/docs" }' yield="cwd:changed" />
```

DIAL steps carry raw executable commands directly:

```xml
<!-- DIAL: AI emits the actual command — executor just runs it -->
<step env="shell" yield="cwd:changed">cd /home/user/docs && pwd</step>
```

**Why this matters:** The abstract layer required a hand-coded executor per environment (filesystem, CAD, database, …). DIAL removes it. The AI knows the environment from upstream context (DialContextBuilder), so it emits environment-appropriate commands directly. The executor is a thin generic runner — `exec(command)` for shell, `db.query(command)` for SQL, `fetch(...)` for HTTP. One executor per runtime protocol, not per environment domain.

| WUCE | DIAL `<step>` |
|---|---|
| `stepName` | `id` (optional) |
| `stepDescription` / `stepMsg` | `label` (optional) |
| `actionDomain` + `actionType` + `actionMeta` | `env` + text content (raw command) |
| `observe` | `observe` — **identical** |
| `yield` | `yield` — **identical** |
| `observationDomain` | — dropped (subsumed by `env`) |

## What DIAL adds beyond execution

WUCE defines one communicative act — the imperative: *do this*. DIAL defines seven more:

| WUCE coverage | DIAL coverage |
|---|---|
| Execute operations | Execute, inform, ask, suggest, acknowledge, declare, delegate, phatic |
| Execution dependencies | Discourse dependencies — any element can observe any yield |
| Execution result events | Exchange events — selection, confirmation, handoff, context |
| Domain-typed actions | Actor-typed exchange moves |

## When to use WUCE directly vs DIAL

Use **WUCE** when:
- The exchange is entirely operational — a sequence of commands with no human interaction
- You are integrating with a system that already speaks WUCE and does not need richer discourse types
- The consumer is an execution runtime, not a dialogue manager

Use **DIAL** when:
- The exchange involves human turns — questions, confirmations, selections
- Multiple communicative acts occur in a single turn
- Context needs to be declared and shared across turns
- Delegation to agents or services is part of the flow
- UI rendering is a first-class concern

A `<dial>` envelope containing only a single `<dial-execute>` element is always valid.

## The observe/yield boundary — two nested scopes

```xml
<dial version="0.1" actor="agent" session="s-001">

  <!-- Outer scope: DIAL element dependencies -->
  <dial-ask id="q1" response-type="confirm" yield="confirmed cancelled" />

  <dial-execute id="op1" observe="confirmed" yield="op:done op:failed">

    <!-- Inner scope: step dependencies inside <dial-execute> -->
    <step env="shell" id="step-a" yield="a:done">ls -la /path</step>
    <step env="shell" id="step-b" observe="a:done" yield="b:done">cat /path/README.md</step>

  </dial-execute>

  <!-- Outer scope: waits for execution to complete -->
  <dial-inform id="result" observe="op:done" render="prose">
    Operation completed successfully.
  </dial-inform>

</dial>
```

Two scopes, clearly nested:
- **Outer scope** (DIAL): `<dial-ask>` → confirmed → `<dial-execute>` → op:done → `<dial-inform>`
- **Inner scope** (steps): step-a → a:done → step-b → b:done

Yields from inner steps are scoped to within `<dial-execute>`. The element itself exposes a single yield to the outer envelope.
