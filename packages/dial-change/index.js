/**
 * @wity.ai/dial-change — several actions as one change: how a step of the list names what an earlier one made
 * (a step named { as: "<name>" }, used later as { "$ref": "<name>.<path>" }; or by number). Pure; the same wherever a list is run (wity-scene-authoring's applyScene,
 * wity-authoring's applyBoard) and wherever it is checked.
 */
export { isRef, hasRefs, refsOf, refPaths, withPlaceholders, stepNames, refProblems, resolveRefs, STEP_NAME, refsHelp } from './src/refs.js';
