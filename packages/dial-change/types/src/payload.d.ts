/**
 * Whether an action's payload fits its schema — one validator for every registry of actions (wity-authoring's board
 * commands and automation actions, wity-scene-authoring's scene commands and media actions, @wity-ai/publishing's
 * actions), so they all check alike. Moved here on 2026-10-19 from the two authoring packages' schema.js (two
 * copies; this one, scene-authoring's, also takes null in a list of types — otherwise the same).
 *
 * A JSON-schema subset — what the action schemas use: type (object|array|string|number|integer|boolean|null — one,
 * or a list meaning any of them), properties, required, items, enum, minLength, maxLength, pattern, minimum, maximum,
 * minItems, maxItems, additionalProperties
 * (default **false**: an unknown field is an error, so a caller sending `data.label` where the action takes `label`
 * fails loudly instead of silently doing nothing).
 *
 * @returns {string[]} errors (empty when valid)
 */
export function validatePayload(schema: any, value: any, path?: string): string[];
/**
 * An action's payload schema written short, for an assistant to read — { field, optional?, list: [shape], choice: "a"|"b" }
 * (the actions vectors' <dial-declare>). Moved here on 2026-10-19 from the two authoring packages' context.js (two
 * identical copies), beside the validator of the same schemas.
 */
export function payloadShape(schema: any): any;
