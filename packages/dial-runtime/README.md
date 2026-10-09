# dial-runtime

Published as `@wity-ai/dial-runtime`. One conversation with an agent that speaks DIAL: the turn loop and the life
of each proposal — validated, shown readable, accepted / dismissed / edited by a person, run, and reported back.
Domain-agnostic; domains and surfaces plug in. wity-app's chat panel and `wity open` (wity-cli) both run this.

```js
import { Conversation, policyHuman, scriptedHuman } from '@wity-ai/dial-runtime';

const conversation = new Conversation({
  agent:  { send: async (message) => replyText },             // the assistant
  domain: { actions, validate, preview, run, context },       // e.g. boardDomain(...) from @wity-ai/authoring
  human:  { decide: async (suggestion) => ({ accept: true }), answer: async (ask) => '…' },
  onEvent: (event) => render(event),   // sent · reply · inform · ask · suggestion · outcome · no-reply · turn-limit
});
await conversation.say('add a card called Plan');
```

- A proposal ends in exactly one outcome: `done`, `failed`, `invalid` (never shown to the person), `dismissed`,
  `superseded` (the person wrote something else) or `handed-off` (another part of the surface owns it).
- Only `done` / `failed` / `invalid` make the agent answer now; the rest are reported with the person's next words.
- What the agent wasn't told — a send failed, or it didn't answer — is kept and goes with the next `say`.
- Outcomes are reported in DIAL itself: `dial-acknowledge` + `dial-declare context-key="outcome:<id>"`.
- Runs in Node (≥ 17) and in browsers.

Design and status: `notes/dial-consumer-runtime.md`. `npm test` — model-free, with scripted agents and humans.
