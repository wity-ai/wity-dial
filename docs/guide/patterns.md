# Patterns & Composability

DIAL has eight element types. That set is fixed. What is not fixed is how they compose, what vocabularies consumers build on top of them, and what kinds of interaction they can model.

This page covers how DIAL's primitives combine into higher-level communication patterns, where the extension points are, and how discrete performative acts coordinate continuous processes.

## Composite patterns

DIAL elements are independent primitives. Consumers combine them into patterns that the spec itself does not prescribe.

### Suggest + declare pair

The most common composite in the Wity ecosystem. An AI proposes an action and carries its structured payload in a separate declaration:

```xml
<dial-suggest action="set-transition" yield="transition:accepted transition:dismissed">
  Crossfade between segments 2 and 3
</dial-suggest>

<dial-declare context-key="setTransitionSuggestion">
  <dial-payload type="application/json">
    { "segmentIndex": 2, "type": "crossfade", "duration": 1.2 }
  </dial-payload>
</dial-declare>
```

The consumer cross-correlates the pair by convention (action name maps to context-key), presents a confirmation UX, then applies the payload on acceptance.

This pattern emerged independently in two different products (video and design studios) without coordination. It works because `dial-suggest` provides the human-facing preview and `dial-declare` provides the machine-readable payload. Neither element was designed for this specific use, but their composition produces it naturally.

### Progressive accumulation

A sequence of declarations across turns that incrementally build up structured state:

```xml
<!-- Turn 2 -->
<dial-declare context-key="candidate-name">
  <dial-payload type="application/json">"Priya"</dial-payload>
</dial-declare>

<!-- Turn 4 -->
<dial-declare context-key="candidate-email">
  <dial-payload type="application/json">"priya@example.com"</dial-payload>
</dial-declare>

<!-- Turn 8 -->
<dial-phatic signal="session-complete" />
```

Used in conversational form flows. Each `dial-declare` adds a field. A `dial-phatic` signal marks the end. The consumer accumulates declared values across turns and submits the collected result when the session signal fires.

### Confirm-gated execution

An ask gates a destructive operation. The execute block only activates if the human confirms:

```xml
<dial-ask id="confirm" response-type="confirm" yield="confirmed cancelled">
  Delete all 47 files in /archive/2024?
</dial-ask>

<dial-execute observe="confirmed" yield="done failed">
  <step env="shell" id="s1" yield="deleted">rm -rf /archive/2024/*</step>
</dial-execute>

<dial-acknowledge of="confirm" observe="cancelled">
  No files were deleted.
</dial-acknowledge>
```

The branching happens through observe/yield. `dial-ask` yields two possible events. Downstream elements each observe one branch. No control-flow primitive needed.

### Inform-then-suggest

An assertion followed by a non-blocking proposal. The inform provides context; the suggest offers actions the user may or may not take:

```xml
<dial-inform id="summary" render="prose" yield="summary:shown">
  Found 24 results in your price range.
</dial-inform>

<dial-suggest observe="summary:shown" action="add-to-cart" render="card-list">
  <dial-payload type="application/json">
    [{ "id": "sku-001", "title": "Air Max", "price": 130 }]
  </dial-payload>
</dial-suggest>
```

The suggest does not gate the exchange. Conversation continues regardless of selection.

## Extension points

The eight elements are fixed. The vocabularies built on them are not. DIAL's extension points are the open-ended attributes that consumers define for their domain.

### `context-key` on declare

Any string. No registry. Each consumer defines its own vocabulary:

| Consumer | context-key examples | What they carry |
|---|---|---|
| Creative studio | `setTransitionSuggestion`, `viewMode` | Action payloads, UI state signals |
| Game character | `mood`, `face`, `sequence` | Preset snaps, param overrides, keyframe arrays |
| Interview form | `candidate-name`, `candidate-email` | Collected form fields |
| CLI agent | arbitrary facts | Session context the agent asserts |

### `env` on execute steps

Any string. Determines which executor handles the step. The spec defines `shell`, `python`, `http` as conventions. Consumers add their own:

```xml
<step env="shell">npm run build</step>
<step env="python">import pandas as pd; print(df.describe())</step>
<step env="http">GET https://api.example.com/status</step>
<step env="mcp:github">create_issue --title "Bug"</step>
<step env="sim:physics">apply_force body=satellite vec=[0,0,9.8]</step>
```

Each `env` value maps to an executor in the consumer's runtime. Adding a new execution environment requires no spec change, only a new executor.

### `action` on suggest

Any string. Names the operation the consumer should perform on acceptance:

```xml
<dial-suggest action="set-transition">...</dial-suggest>
<dial-suggest action="generate-images">...</dial-suggest>
<dial-suggest action="add-to-cart">...</dial-suggest>
```

The action vocabulary is defined per-consumer, typically in the AI's directive.

### `signal` on phatic

Channel signals beyond the spec's defaults (`typing`, `thinking`, `heartbeat`, `presence`, `done-typing`). Consumers extend this for domain-specific lifecycle events:

```xml
<dial-phatic signal="session-complete" />
<dial-phatic signal="scene-ready" />
```

### `observe`/`yield` event names

Arbitrary strings. Consumers define their own event vocabulary. There is no global registry. Event names are scoped to the envelope (outer scope) or the execute block (inner scope).

## Coordinating continuous processes

DIAL is a discrete communication language. Its elements are bounded performative acts. But real-world systems involve continuous dynamics: animations, physics, sensor feeds, playheads.

DIAL coordinates these without modeling them. The separation is deliberate: DIAL carries the *intent*, the runtime executes the *dynamics*.

### Declaring a continuous relationship

A single discrete act can establish a relationship that the runtime sustains continuously:

```xml
<dial-declare context-key="force-binding">
  <dial-payload type="application/json">
    { "id": "spring-1", "source": "anchor", "target": "mass",
      "type": "spring", "stiffness": 200, "damping": 5 }
  </dial-payload>
</dial-declare>
```

The consumer reads this declaration and creates a continuous spring force in its physics engine. DIAL said it once. The engine runs it every frame.

A later declaration can modify or remove the binding:

```xml
<dial-declare context-key="force-binding">
  <dial-payload type="application/json">
    { "id": "spring-1", "stiffness": 0 }
  </dial-payload>
</dial-declare>
```

### Declaring continuous animation

Keyframe sequences are a common case. DIAL carries the keyframes; the renderer interpolates between them:

```xml
<dial-declare context-key="sequence">
  <dial-payload type="application/json">
    [
      { "t": 0.0, "face": { "eyeSize": 0.8, "mouthCurve": 0.3 }, "ease": "ease-in-out" },
      { "t": 0.5, "face": { "eyeSize": 1.2, "mouthCurve": 0.9 }, "ease": "ease-out" },
      { "t": 1.0, "face": { "eyeSize": 0.8, "mouthCurve": 0.3 } }
    ]
  </dial-payload>
</dial-declare>
```

The declaration is discrete. The animation is continuous. DIAL doesn't tick every frame. It declares the intent and the runtime sustains it.

### Bridging continuous state to DIAL events

When a continuous process needs to trigger a DIAL interaction, the bridge is the executor. The runtime monitors a condition; when it fires, the executor yields an event that DIAL elements can observe:

```xml
<dial-execute yield="threshold:reached">
  <step env="monitor" yield="threshold:reached">
    battery_level &lt; 0.1
  </step>
</dial-execute>

<dial-ask observe="threshold:reached" response-type="confirm" yield="confirmed cancelled">
  Battery below 10%. Return to base?
</dial-ask>
```

The monitor executor watches a continuous signal. When the guard condition is met, it yields. Downstream DIAL elements activate. The continuous-to-discrete bridge lives in the executor, not in DIAL itself.

### Periodic signals

For regular sampling of continuous state, `dial-phatic` with an interval provides a heartbeat that the consumer can use as a sync point:

```xml
<dial-phatic signal="heartbeat" interval="5" />
```

The consumer can attach state snapshots to each heartbeat tick, bridging continuous evolution into periodic discrete observations.

### The general pattern

```
Discrete act (DIAL)         Continuous process (runtime)
─────────────────           ────────────────────────────
dial-declare binding   →    runtime creates force/animation/stream
                            runtime sustains it continuously
dial-declare update    →    runtime modifies parameters
                            runtime continues
executor guard fires   →    yield event
dial-ask/inform/suggest     ← DIAL reacts to the event
                            runtime continues or changes regime
```

DIAL initiates and reacts. The runtime sustains. Neither replaces the other.
