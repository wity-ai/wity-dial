/** Whether a payload refers to an earlier step anywhere in it. */
export function hasRefs(value: any): boolean;
/** The refs in a payload, as written: ['1.elementId', 'titles.layerId', '0.layers.0.id', …]. */
export function refsOf(value: any, out?: any[]): any[];
/** The paths in a payload that hold a $ref ('layerId', 'element.src', 'items[2].id' …). */
export function refPaths(value: any, at?: string): any;
/** The payload with each $ref as a placeholder string — to check its shape before the list runs. */
export function withPlaceholders(value: any, placeholder?: string): any;
/**
 * The steps' names → their numbers (1-based). Throws on a name that is not a word, or used twice.
 * @param {Array<{ as?: string }>} list
 * @returns {Map<string, number>}
 */
export function stepNames(list: Array<{
    as?: string;
}>): Map<string, number>;
/**
 * What would be refused in a list's names and refs, said before it runs: a name not a word or used twice, a ref to a
 * step that is not earlier, or to a name no earlier step has. (What a ref's path holds is known only when it runs.)
 * @param {unknown[]} list
 * @param {string} before  what step 0 is, as the domain says it: 'the scene before', 'the board before'
 * @returns {string[]}
 */
export function refProblems(list: unknown[], before: string): string[];
/**
 * The payload with each $ref replaced by what it names.
 * @param {unknown} value      the payload of step `step` (1-based)
 * @param {number} step
 * @param {unknown[]} results  the results of the steps before it, in order
 * @param {() => unknown} before  the scene before the list (scene.read's result) — asked for only when step 0 is named
 * @param {Map<string, number>} [names]  the steps' names (stepNames of the list)
 */
export function resolveRefs(value: unknown, step: number, results: unknown[], before: () => unknown, names?: Map<string, number>): any;
export function isRef(v: any): boolean;
export namespace STEP_NAME {
    let type: string;
    let pattern: string;
    let description: string;
}
export function refsHelp(examples: any): string;
