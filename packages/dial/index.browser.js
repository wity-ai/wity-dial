/**
 * @wity.ai/dial — browser entry point
 *
 * Identical surface to the Node.js build, with two differences:
 *
 *   1. parse() and extractProse() return Promises (async, WASM fetched via fetch)
 *   2. initDial() is exported for optional eager pre-loading at app startup
 *
 * Vite picks up this file automatically via the "browser" export condition.
 * DialSession and DialRouter are pure JS and unchanged from the Node.js build.
 *
 * Usage:
 *
 *   import { parse, DialSession, DialRouter, initDial } from '@wity.ai/dial';
 *
 *   // Optional: pre-load WASM before first message to eliminate cold-start latency
 *   await initDial();
 *
 *   chatWidget.onNewMessage(async (text) => {
 *     const envelope = await parse(text);
 *     if (envelope) await router.route(envelope, session);
 *   });
 */

export { parse, extractProse, initDial } from './src/parse.browser.js';
export { DialSession }                   from './src/DialSession.js';
export { DialRouter, runStepGraph }      from './src/DialRouter.js';
