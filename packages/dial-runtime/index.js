/**
 * @wity.ai/dial-runtime — one conversation with an agent, the same on every surface.
 * Design: wity-dial/notes/dial-consumer-runtime.md.
 *
 *   const conv = new Conversation({ agent, domain, human });
 *   await conv.say("put 'Strong brand' under Strengths");
 *
 *   agent  — { send(text) → Promise<reply text> }            the transport to the assistant
 *   domain — { actions, validate, preview, run, context }     a vocabulary (e.g. thoughtbooks); see Domain below
 *   human  — { decide(suggestion), answer(ask) }              a TUI, an app's cards, or a policy (tests)
 */
export { Conversation, NoReplyError } from './src/conversation.js';
export { outcomeReply } from './src/outcome.js';
export { policyHuman, scriptedHuman } from './src/humans.js';
