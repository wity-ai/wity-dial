# Schema v0.1

## Root element

```xml
<dial version="0.1" turn="3" actor="agent" session="sess-abc123">
  ...
</dial>
```

| Attribute | Type | Required | Description |
|---|---|---|---|
| `version` | string | yes | Must be `"0.1"` |
| `turn` | number | no | Turn index in the exchange (1-based) |
| `actor` | string | yes | Who produced this envelope (`human`, `agent`, `system`, `service`, or a named id) |
| `session` | string | no | Session identifier — scopes shared context and `declare` persistence |

---

## Common element attributes

All DIAL elements share this base set:

| Attribute | Type | Default | Description |
|---|---|---|---|
| `id` | string | auto | Unique element identifier within this envelope |
| `observe` | string | — | Event or condition required before this element activates; empty = activates immediately |
| `yield` | string | — | Space-separated event names emitted when this element is resolved |
| `addressed-to` | string | — | Target actor id; omit = broadcast to all participants |
| `lang` | string | `"en"` | BCP-47 language tag for natural language content |

The `observe`/`yield` model is inherited directly from WUCE. Within a single envelope, elements with no `observe` activate in parallel; elements with `observe` wait for the named yield from another element.

---

## `<dial-inform>`

An assertion. Delivers information to the receiver. No response is expected or waited for.

```xml
<dial-inform id="result" render="prose" yield="result:delivered">
  The image was generated successfully. Resolution: 1024×1024.
</dial-inform>
```

```xml
<dial-inform id="product-list" render="card-list">
  <dial-payload type="application/json">
    [
      { "id": "sku-001", "title": "Nike Air Max", "price": 129, "currency": "USD" },
      { "id": "sku-002", "title": "Adidas Ultraboost", "price": 160, "currency": "USD" }
    ]
  </dial-payload>
</dial-inform>
```

| Attribute | Type | Default | Description |
|---|---|---|---|
| `render` | enum | `prose` | Surface hint for the receiver's rendering layer |
| *(base attributes)* | | | All common attributes apply |

### `render` values

| Value | Description |
|---|---|
| `prose` | Natural language paragraph(s) — default |
| `card-list` | Structured list of item cards |
| `table` | Tabular data |
| `chart` | Data visualisation |
| `code` | Code block with language |
| `media` | Image, video, or audio content |
| `map` | Geographic data |
| `diagram` | Structural diagram (Mermaid etc.) |
| `raw` | No rendering hint — consumer decides |

Content is either a text node (for prose/code) or a `<dial-payload>` child element for structured data.

---

## `<dial-ask>`

An interrogative. Requests something from the receiver. The exchange is gated — elements that `observe` the ask's yield will not activate until a response is received and resolved.

```xml
<dial-ask id="confirm-delete"
        response-type="confirm"
        yield="delete:confirmed delete:cancelled">
  Are you sure you want to delete all 47 files in this folder? This cannot be undone.
</dial-ask>
```

```xml
<dial-ask id="get-style-pref"
        response-type="choice"
        yield="style:chosen"
        timeout="30">
  Which visual style would you like for the generated image?
  <dial-option value="photorealistic">Photorealistic</dial-option>
  <dial-option value="illustration">Illustration</dial-option>
  <dial-option value="minimalist">Minimalist</dial-option>
</dial-ask>
```

| Attribute | Type | Default | Description |
|---|---|---|---|
| `response-type` | enum | `text` | Shape of the expected response |
| `timeout` | number | — | Seconds to wait before yielding a timeout event; omit = wait indefinitely |
| *(base attributes)* | | | All common attributes apply |

### `response-type` values

| Value | Description |
|---|---|
| `text` | Free-form natural language response |
| `choice` | Selection from `<dial-option>` children |
| `confirm` | Boolean yes/no; yields separate named events |
| `number` | Numeric input |
| `file` | File upload |

---

## `<dial-suggest>`

A proposal. Presents options the receiver may act on. Unlike `<dial-ask>`, selection is not required to proceed — the exchange continues regardless, but selection events are available for routing.

```xml
<dial-suggest id="product-suggestions"
            render="card-list"
            action="add-to-cart"
            yield="item:selected item:dismissed">
  <dial-payload type="application/json">
    [
      { "id": "sku-001", "title": "Nike Air Max", "price": 129, "currency": "USD", "badge": "Best Seller" },
      { "id": "sku-002", "title": "Adidas Ultraboost", "price": 160, "currency": "USD" }
    ]
  </dial-payload>
</dial-suggest>
```

| Attribute | Type | Default | Description |
|---|---|---|---|
| `render` | enum | `card-list` | Surface hint — same values as `<dial-inform>` |
| `action` | string | — | Named action triggered by selection (routed to consuming application) |
| `multi` | boolean | `false` | Whether multiple items can be selected |
| *(base attributes)* | | | All common attributes apply |

**Key distinction from `<dial-ask>`:** `<dial-suggest>` does not gate the exchange. Subsequent elements do not need to `observe` its yield to proceed. It is a non-blocking proposal; `<dial-ask>` is a blocking question.

---

## `<dial-execute>`

An imperative. Executes a sequence of operations. Contains a WUCE-style observe/yield dependency tree of `<step>` elements. Each step carries a raw executable command as its text content — no translation layer, no abstract action types. The AI emits the exact command appropriate for the target runtime; the executor runs it directly.

```xml
<dial-execute id="setup-op" observe="confirm:received" yield="setup:done setup:failed">

  <step env="shell" id="make-dir" yield="dir:ready">
    mkdir -p /home/user/docs/project
  </step>

  <step env="shell" id="write-config" observe="dir:ready" yield="config:written">
    echo '{"version": "1.0"}' > /home/user/docs/project/config.json
  </step>

</dial-execute>
```

### `<step>` attributes

| Attribute | Type | Default | Description |
|---|---|---|---|
| `env` | string | `shell` | Runtime protocol. Determines which executor handles this step |
| `id` | string | auto | Unique step identifier within this `<dial-execute>` |
| `label` | string | — | Human-readable label for display (defaults to first line of command) |
| `observe` | string | — | Step-level yield event to wait for before this step activates |
| `yield` | string | — | Space-separated events emitted when this step resolves |

Step text content is the raw command passed directly to the executor. The AI adapts content to the declared runtime — it knows the environment from upstream context (DialContextBuilder).

### `env` values

| Value | Executor behaviour |
|---|---|
| `shell` | POSIX bash — `exec(command)`. Works for any shell-accessible environment: local filesystem, SSH, Docker, etc. |
| `python` | Python subprocess — `python3 -c "..."` or script file |
| `http` | HTTP request — command text is a `curl`-style spec or JSON request descriptor |
| *(extensible)* | Any new runtime registers its own executor by `env` key |

### Step sequencing

Steps without `observe` activate immediately, in parallel. Steps with `observe="event-name"` wait for a prior step's `yield` before activating. This is the WUCE dependency model, applied inside `<dial-execute>`.

The outer `<dial-execute>` element exposes its own `yield` to the enclosing DIAL envelope — signalling that the entire execution block has resolved. See [Relation to WUCE](wuce-relation.md) for the two-level scope diagram.

| Attribute | Type | Default | Description |
|---|---|---|---|
| *(base attributes)* | | | All common attributes apply |

---

## `<dial-acknowledge>`

An affective. Signals receipt or understanding of a prior element. Carries no new information. Used to close a request-response cycle explicitly, or to signal that a long-running operation was received and is in progress.

```xml
<dial-acknowledge id="ack-upload" of="file-upload-request" yield="ack:sent">
  Got it — processing your file now.
</dial-acknowledge>
```

| Attribute | Type | Default | Description |
|---|---|---|---|
| `of` | string | — | `id` of the element being acknowledged (within this session) |
| *(base attributes)* | | | All common attributes apply |

Content (text node) is optional human-readable confirmation text.

---

## `<dial-declare>`

A declaration. Asserts a named fact into the shared context of the session. Future elements in this or subsequent turns may reference declared context by key.

```xml
<dial-declare id="set-artefact"
            context-key="active-artefact"
            yield="artefact:set">
  <dial-payload type="application/json">
    { "slug": "nike-campaign", "vectorSpace": "vs-abc123", "brandColor": "#f97316" }
  </dial-payload>
</dial-declare>
```

| Attribute | Type | Default | Description |
|---|---|---|---|
| `context-key` | string | required | Named key in shared context; overwrites any prior value for this key |
| *(base attributes)* | | | All common attributes apply |

Persistence is a concern of the receiving layer (e.g. dial-knowledge), not of the protocol attribute. The declared fact is available for the remainder of the session; any cross-session persistence is handled by the knowledge store, keyed by environment identity.

---

## `<dial-delegate>`

A handoff. Transfers responsibility for this exchange — or a part of it — to another actor. The delegating actor steps back; the receiving actor picks up.

```xml
<dial-delegate id="handoff-billing"
             to="billing-agent"
             intent="resolve-payment-dispute"
             yield="delegation:accepted delegation:rejected">
  The user needs help with a charge from March 2026. Handing off to billing.
  <dial-context>
    <dial-payload type="application/json">
      { "userId": "usr-999", "chargeId": "chg-8827", "amount": 49.99, "currency": "USD" }
    </dial-payload>
  </dial-context>
</dial-delegate>
```

| Attribute | Type | Default | Description |
|---|---|---|---|
| `to` | string | required | Actor id of the recipient (registered agent, service, or `human`) |
| `intent` | string | — | Named intent describing what the receiver should accomplish |
| `resume` | boolean | `false` | Whether to resume this actor's turn after delegation resolves |
| *(base attributes)* | | | All common attributes apply |

The optional `<dial-context>` child carries structured handoff data for the receiving actor.

---

## `<dial-phatic>`

A channel signal. Carries no semantic payload. Used for exchange maintenance: typing indicators, heartbeats, session keepalives, presence signals.

```xml
<dial-phatic signal="typing" />
```

```xml
<dial-phatic signal="heartbeat" interval="30" />
```

| Attribute | Type | Default | Description |
|---|---|---|---|
| `signal` | enum | required | The type of channel signal |
| `interval` | number | — | For repeating signals: interval in seconds |
| *(base attributes)* | | | All common attributes apply |

### `signal` values

| Value | Description |
|---|---|
| `typing` | Actor is composing a response |
| `thinking` | Actor is processing (longer latency) |
| `heartbeat` | Session keepalive |
| `presence` | Actor is present and listening |
| `done-typing` | Actor stopped composing without sending |

---

## `<dial-payload>`

A structured data container. Used as a child element when content is not natural language text.

```xml
<dial-payload type="application/json">
  { "key": "value" }
</dial-payload>
```

| Attribute | Type | Default | Description |
|---|---|---|---|
| `type` | string | `application/json` | MIME type of the payload content |
| `encoding` | string | `utf-8` | Content encoding |
| `schema` | string | — | URI of a JSON Schema or other schema definition for validation |

---

## `<dial-option>`

A selectable option within `<dial-ask response-type="choice">`. Not used elsewhere.

```xml
<dial-option value="photorealistic" default="true">Photorealistic</dial-option>
```

| Attribute | Type | Default | Description |
|---|---|---|---|
| `value` | string | required | Machine-readable value yielded on selection |
| `default` | boolean | `false` | Pre-selected option |
| `disabled` | boolean | `false` | Option is shown but cannot be selected |

---

## Full example — product recommendation exchange

An AI agent turn in a shopping assistance exchange. Informs the user of search results, suggests products, asks a filtering question, and declares the active session context.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<dial version="0.1" turn="2" actor="agent" session="sess-shop-7712">

  <!-- Declare the active product domain into shared context -->
  <dial-declare id="ctx-domain" context-key="product-domain" yield="domain:set">
    <dial-payload type="application/json">
      { "category": "footwear", "brand": "nike", "priceRange": [80, 200] }
    </dial-payload>
  </dial-declare>

  <!-- Inform: search result summary (activates after context is set) -->
  <dial-inform id="search-summary"
             observe="domain:set"
             render="prose"
             yield="summary:shown">
    Found 24 Nike footwear options in your price range. Here are the top picks:
  </dial-inform>

  <!-- Suggest: product cards (activates after summary shown) -->
  <dial-suggest id="top-picks"
              observe="summary:shown"
              render="card-list"
              action="add-to-cart"
              yield="item:selected item:dismissed">
    <dial-payload type="application/json">
      [
        { "id": "sku-001", "title": "Nike Air Max 270", "price": 130, "currency": "USD", "badge": "Best Seller", "image": "https://cdn.example.com/am270.jpg" },
        { "id": "sku-002", "title": "Nike React Infinity", "price": 160, "currency": "USD", "badge": "New", "image": "https://cdn.example.com/react.jpg" },
        { "id": "sku-003", "title": "Nike Revolution 6", "price": 85, "currency": "USD", "image": "https://cdn.example.com/rev6.jpg" }
      ]
    </dial-payload>
  </dial-suggest>

  <!-- Ask: refine filter (parallel to suggest — does not gate on it) -->
  <dial-ask id="filter-ask"
          observe="summary:shown"
          response-type="choice"
          yield="filter:chosen"
          addressed-to="human">
    Would you like to filter by a specific use case?
    <dial-option value="running">Running</dial-option>
    <dial-option value="casual">Casual / Lifestyle</dial-option>
    <dial-option value="training">Training</dial-option>
    <dial-option value="none" default="true">No preference</dial-option>
  </dial-ask>

</dial>
```

---

## Full example — execution with confirmation gate

An agent proposes a destructive file operation, gates on human confirmation, then executes directly via shell steps.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<dial version="0.1" turn="4" actor="agent" session="sess-fs-0042">

  <!-- Ask for confirmation before any execution -->
  <dial-ask id="confirm-delete"
          response-type="confirm"
          yield="delete:confirmed delete:cancelled">
    This will permanently delete all files in /home/user/archive/2024.
    This cannot be undone. Proceed?
  </dial-ask>

  <!-- Execute shell steps — gated on human confirmation -->
  <dial-execute id="delete-op"
              observe="delete:confirmed"
              yield="delete:done delete:failed">

    <step env="shell" id="count-files" yield="count:done">
      ls /home/user/archive/2024 | wc -l
    </step>

    <step env="shell" id="delete-files" observe="count:done" yield="files:deleted">
      rm -rf /home/user/archive/2024/*
    </step>

  </dial-execute>

  <!-- Inform result — gated on execution -->
  <dial-inform id="result-ok"
             observe="delete:done"
             render="prose">
    Done. Archive cleared.
  </dial-inform>

  <!-- Acknowledge cancellation — gated on the other confirm branch -->
  <dial-acknowledge id="ack-cancel"
                  of="confirm-delete"
                  observe="delete:cancelled">
    Understood — no files were deleted.
  </dial-acknowledge>

</dial>
```
