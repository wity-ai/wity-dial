---
layout: home

hero:
  name: DIAL
  tagline: Dialectic Interagent Language — a language for structured communicative exchange between any participants in an exchange — humans, AI agents, systems, and services.
  actions:
    - theme: brand
      text: Overview
      link: /guide/overview
    - theme: alt
      text: Schema
      link: /guide/schema
    - theme: alt
      text: Relation to WUCE
      link: /guide/wuce-relation

features:
  - title: Performative-first
    details: Every element declares what communicative act it performs — not just what it says. The grammar of a conversation, not just its vocabulary.
  - title: Classical dialectic
    details: Dialectic in the Socratic sense — meaning arrived at through structured exchange of reasoning. Not Hegelian opposition. Not restricted to two parties. Through speaking, through agents.
  - title: WUCE is a subset
    details: WUCE's entire execution model lives inside <dial-execute>. All WUCE envelopes are valid DIAL. The lineage is explicit and intentional.
  - title: Rendering-agnostic
    details: DIAL defines meaning and routing. Consumers — UI renderers, agent runtimes, orchestrators — decide surface form and execution policy.
---

# DIAL

**Dialectic Interagent Language** — v0.1

DIAL is a language for structured communicative exchange between any participants in an exchange — humans, AI agents, systems, and services. It encodes not what agents say but what they *do* — the pragmatic layer of agent interaction that existing protocols leave unaddressed.

The word "dialectic" is used in its classical sense: *dia* (through) + *legein* (to speak, to reason). Meaning arrived at *through* exchange. Not Hegelian opposition, not restricted to two parties — the Socratic and Aristotelian tradition of reasoned discourse as the medium through which understanding emerges.

> For AI coding agents:
> [llms.txt](/llms.txt) · [llms-full.txt](/llms-full.txt)

## Lineage

```
Dialectic Chain      ← Wity's foundational conversation model
    └── WUCE         ← structured execution within the chain  (v2.3)
            └── DIAL ← the full dialectic language            (v0.1)
                       WUCE = dial/<dial-execute>
```

## Intellectual roots

DIAL sits in a long tradition of attempts to make communicative structure formally tractable:

- **Leibniz** — Characteristica Universalis: a universal formal language for thought. DIAL is one layer above: a formal language for *exchange of thought between agents*.
- **Wittgenstein** — meaning as use, not reference. DIAL elements are defined by what they *do*, not what they *say*.
- **Austin / Searle** — speech act theory: every utterance performs an act. DIAL operationalises illocutionary force as machine-readable structure.
- **Peirce** — the triadic sign: sign, object, interpretant. DIAL elements are signs whose meaning is completed by the receiving agent.

What is new is not the idea. What is new is that agents now exist that can naturally produce well-formed DIAL at runtime.

## The eight elements

| Element | Communicative act | Expects |
|---|---|---|
| `<dial-inform>` | Assertion — here is data | Nothing |
| `<dial-ask>` | Interrogative — I need something from you | A response |
| `<dial-suggest>` | Proposal — here are options | A selection |
| `<dial-execute>` | Imperative — perform these operations | Completion events |
| `<dial-acknowledge>` | Affective — I received / understood that | Nothing |
| `<dial-declare>` | Declaration — assert this into shared context | Nothing |
| `<dial-delegate>` | Handoff — another agent/service/human should handle this | Pickup |
| `<dial-phatic>` | Channel maintenance — no semantic payload | Nothing |
