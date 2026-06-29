# Overview

## Why DIAL?

Every exchange between a human and an AI agent involves more than information transfer. Something is always *being done* with words — a question is asked, options are offered, a task is handed off, an understanding is confirmed. These are distinct communicative acts, not variations of the same thing.

Existing agent protocols handle the transport layer well — how messages travel, how schemas are defined, how tools are called. What they lack is a **pragmatic layer**: protocol-level mechanisms for what each message *does* in the context of the exchange.

Without this, systems push semantic responsibility into prompts and application logic — rebuilding the same routing, response-gating, and context-propagation machinery in every application. DIAL externalises that structure into the language itself.

## The name

**Dialectic Interagent Language.**

"Dialectic" is used in its classical sense — not Hegelian. The etymology: *dia* (through) + *legein* (to speak, to reason). Meaning arrived at *through* exchange. The Socratic and Aristotelian tradition: structured exchange of reasoning as the medium through which understanding emerges. No opposition required. No two-party restriction — "dia" here means *through*, not *two*.

"Interagent" — between agents, where agent includes humans, AI models, orchestrators, and services. DIAL does not privilege any direction or party type.

"Language" — not a protocol, not a format, not an envelope. A language has vocabulary (the eight elements), grammar (observe/yield dependency model), and rules of use (element semantics). DIAL is the right frame for what this is and what it will become.

## What DIAL is

DIAL is an XML-based language in which each element is a *speech act*: a structured declaration of what communicative move is being made, what it carries, and what it expects in return.

Three properties distinguish DIAL from other agent protocols:

**Performative-first.** Each element type is defined by its illocutionary role — what act it performs — not by its data shape. `<dial-ask>` and `<dial-inform>` may carry identical content but are categorically different acts with different routing behaviour.

**Generative, not pre-authored.** A DIAL envelope is produced turn-by-turn by an LLM at runtime. There is no dialogue graph traversed, no state machine consulted. The structure emerges from the exchange itself. Coherence is maintained through shared context (`<dial-declare>`) and the `observe`/`yield` dependency model inherited from WUCE.

**Superset of WUCE.** WUCE's execution model — step graphs with dependencies, domain-typed actions, yield events — lives intact inside `<dial-execute>`. Every valid WUCE envelope is a valid DIAL `<dial-execute>` block. Nothing is lost; the scope is widened.

## What DIAL is not

DIAL is not a knowledge representation format. It does not model facts about the world, maintain ontologies, or define inference rules. It models *exchange* — what agents and humans do to each other through structured communication.

DIAL is not a dialogue graph. It does not pre-author the topology of a conversation. The routing declared in `observe`/`yield` is local to each element — a declaration of its own dependencies, not a map of the whole.

DIAL is not an execution engine. It defines *what* to do and *when* (via dependencies). External consumers — agent runtimes, UI renderers, orchestrators — decide *how*: retry strategy, error recovery, streaming, rendering surface. This separation is deliberate and inherited from WUCE.

## Ontological position

DIAL operates at the **pragmatic layer** of meaning:

```
Semantics        ← what elements mean in isolation
Pragmatics       ← what utterances DO in context     ← DIAL lives here
Knowledge Rep.   ← what is true about the world
Execution        ← how operations run                ← WUCE lives here (subset of DIAL)
```

The theoretical grounding is speech act theory (Austin, Searle): every utterance has an *illocutionary force* — the act it performs — in addition to its propositional content. DIAL operationalises this for structured human-AI exchange, making illocutionary force explicit and machine-readable rather than inferred from natural language.

## Intellectual lineage

DIAL sits in a long tradition of attempts to make communicative structure formally tractable:

- **Leibniz** — Characteristica Universalis: a universal formal language for thought and reasoning. DIAL is one layer above: a formal language for *exchange* of thought between agents. What Leibniz dreamed of encoding was semantic; what DIAL encodes is pragmatic.
- **Wittgenstein** — meaning as use, not reference. "The meaning of a word is its use in the language." DIAL elements are defined by what they *do* in an exchange, not by what they *say*. That is Wittgenstein over Frege.
- **Austin / Searle** — speech act theory: every utterance performs an act with illocutionary force. DIAL operationalises this — making force explicit, typed, and machine-routable.
- **Peirce** — the triadic sign: sign, object, interpretant. DIAL elements are signs whose meaning is completed only by the receiving agent in context. Meaning is never in the element alone.
- **FIPA ACL** (1990s) — the closest prior attempt: performative types for agent communication. Never reached critical mass because no agent existed capable of naturally producing well-formed instances at runtime. LLMs change that.

What is new is not the idea. What is new is that agents now exist capable of naturally producing well-formed DIAL at runtime — making the formally tractable and the naturally fluent the same thing for the first time.

## The exchange model

A DIAL exchange is a sequence of envelopes, one per conversational turn. Each envelope contains one or more elements. Elements within an envelope may be independent (parallel) or ordered (via `observe`/`yield`).

```
Turn 1  →  <dial turn="1" actor="human">         
              <dial-ask .../>
           </dial>

Turn 2  →  <dial turn="2" actor="agent">         
              <dial-inform .../>
              <dial-suggest .../>
              <dial-ask .../>
           </dial>

Turn 3  →  <dial turn="3" actor="human">         
              <dial-acknowledge .../>
              <dial-inform .../>              (selection from suggest)
           </dial>

Turn 4  →  <dial turn="4" actor="agent">         
              <dial-execute .../>             (WUCE steps in response)
              <dial-inform .../>
           </dial>
```

The conversation is not a graph — it is a **stream of situated envelopes**, each one locally coherent, collectively forming a dialectical exchange. Coherence comes from shared context (`<dial-declare>`) and dependency events (`observe`/`yield`), not from a pre-defined topology.

## Actors

DIAL envelopes carry actor attribution. An actor is any participant in the exchange:

| Actor type | Examples |
|---|---|
| `human` | End user, operator |
| `agent` | LLM, orchestrator, specialist sub-agent |
| `system` | Application runtime, bridge, infrastructure |
| `service` | External API, tool, microservice |

The `actor` attribute on the root `<dial>` element identifies who produced this envelope. Individual elements may override with `addressed-to` to target a specific receiver.
