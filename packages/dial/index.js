/**
 * @wity/dial — DIAL protocol package
 *
 * Layered over dial-core (Rust/WASM):
 *
 *   parse(text)          — extract + parse <dial> envelope from AI response text
 *   extractProse(text)   — return prose portions (text outside any <dial> block)
 *
 *   DialSession          — per-session context: declared facts + rolling execution results
 *   DialRouter           — handler-based element dispatcher with observe/yield dependency graph
 *   runStepGraph         — inner observe/yield loop for step arrays (use inside dial-execute handlers)
 *
 * Canonical usage:
 *
 *   import { parse, extractProse, DialSession, DialRouter, runStepGraph } from '@wity/dial';
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

export { parse, extractProse }           from './src/parse.js';
export { DialSession }                   from './src/DialSession.js';
export { DialRouter, runStepGraph }      from './src/DialRouter.js';
