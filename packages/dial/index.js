/**
 * @wity.ai/dial — DIAL protocol package
 *
 * Layered over dial-core (Rust/WASM):
 *
 *   parse(text)          — extract + parse <dial> envelope from AI response text
 *   extractProse(text)   — return prose portions (text outside any <dial> block)
 *   serialize(envelope)  — an envelope written as DIAL text (parse reads it back the same)
 *   conditionOf(until)   — an act's `until` read as its condition, or an Error
 *
 *   DialSession          — per-session context: declared facts + rolling execution results
 *   DialRouter           — handler-based element dispatcher with observe/yield dependency graph
 *   runStepGraph         — inner observe/yield loop for step arrays (use inside dial-execute handlers)
 *
 * Canonical usage:
 *
 *   import { parse, extractProse, DialSession, DialRouter, runStepGraph } from '@wity.ai/dial';
 *
 *   const session = new DialSession();
 *   const router  = new DialRouter()
 *     .on('dial-inform',  (el, ctx) => { ... })
 *     .on('dial-ask',     async (el, ctx) => { ctx.emit('choice:yes'); })
 *     .on('dial-execute', async (el, ctx) => {
 *       const { results } = await runStepGraph(el.steps, myExecutor);
 *       ctx.session.recordResults(results);
 *     })
 *     .on('dial-declare', (el, ctx) => {
 *       if (el.contextKey) ctx.session.declare(el.contextKey, el.payload ?? el.text);
 *     });
 *
 *   const envelope = parse(aiResponseText);
 *   if (envelope) await router.route(envelope, session);
 *
 * Knowledge persistence (separate concern):
 *   import { KnowledgeStore, FileAdapter } from '@wity/dial-knowledge';
 */

export { parse, extractProse, serialize, conditionOf } from './src/parse.js';
export { DialSession }                   from './src/DialSession.js';
export { DialRouter, runStepGraph }      from './src/DialRouter.js';
