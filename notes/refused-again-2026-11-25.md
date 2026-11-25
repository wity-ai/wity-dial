# Refused again: the loop stops and says why (2026-11-25)

## What happened
In the film studio, Lila was asked for "a photo of our 2 characters Bhu & Mi together in a single frame suitable for
instagram profile pic". She announced eight near-identical times and ended on "Stopped after several back-and-forth
turns". Two causes:

1. **The surface contradicted itself.** The guide (written from scene-core's MEDIA_OPERATIONS) offers `settings.with`
   on media.make, but media.make refused it ("people … are asked in a composition"), and so did the composer's recipe.
   Every corrected try hit the same refusal.
2. **The harness hid it.** dial-runtime never shows an invalid suggestion and tells the agent to "propose the corrected
   one as if it were the first", so the same refusal went round until maxTurns (8). Only its leading informs, streamed
   live each turn, reached the person.

## What changed
- **People in media made on its own, as in a scene** (scene-authoring 0.164.0; vritti-composer 0352951):
  `settings.with` takes `{ character }` or `{ image }` anywhere, and `{ cast }` with `composition` (the one whose cast
  they are). The same goes for `voice { character | cast }`. The composer resolves them before pricing (quoteMorph,
  morphToTargetForm, and so the bulk path), using the people.js helpers a scene's request already uses (peopleAsked,
  withPeople, stillOf, startingFrom). A picture of them is a combine from their pictures; a clip starts from such a
  picture, priced as one. Through a thought (via chainofthought), people are refused (made by morph).
- **Refused again → stop** (dial-runtime 0.25.0): a suggestion refused for the same reason (action, code, field, hint)
  twice in one message ends the loop with status/event `refused-again { turn, action, preview, hint }`. The agent
  is told with the person's next words that they saw it, never to propose it as new. A different refusal each time
  goes on as before, while the agent is still finding its way.
- **Shown**: assistant-thread 0.24.0 shows the notice "<name> couldn't do that: <why>. Say how to go on.";
  voice-harness 0.6.0 says "I couldn't do that this way, so I stopped. Say how to go on." Its phrases are now filled
  from the locale's.
- Carried by assistants 0.24.0 and chat 0.5.6. Bumped: jity-mcp, the chat widget, video, design and brand studios,
  and wity-app.

## Not done
- jity-websites, wity-websites and wity-cli still take the older assistants (pinned on purpose before; bump when touched).
- voice-harness's own tests have 8 failures from before this change (the fixture lacks `roster.lead`).
