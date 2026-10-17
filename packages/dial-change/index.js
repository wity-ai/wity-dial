/**
 * @wity.ai/dial-change — several actions as one change: how a step of the list names what an earlier one made
 * ({ "$ref": "<step>.<path>" }). Pure; the same wherever a list is run (wity-scene-authoring's applyScene,
 * wity-authoring's applyBoard) and wherever it is checked.
 */
export { isRef, hasRefs, refsOf, resolveRefs, refsHelp } from './src/refs.js';
