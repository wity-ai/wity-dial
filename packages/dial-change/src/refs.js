/**
 * References between the steps of one change — several actions an assistant proposes as one (DIAL's change: a
 * scene's commands, a board's), where a later step works on what an earlier one made: the element a step added, the
 * page a new composition starts with, the card a new thoughtbook opens on.
 *
 * A step may be given a name ({ command, payload, as: "titles" }); a payload value { "$ref": "<step>.<path>" } is the
 * value at <path> in the result of the step it names — by that name ("titles.layerId"), or by its number (1-based:
 * "4.layerId"). Step 0 is what was there before the list — its at-a-glance read (a scene's scene.read, a board's
 * doc.outline) — so "0.layers.0.id" is a scene's first layer. Only an earlier step can be named. A path's parts are
 * field names, or positions in a list (from 0). A $ref is an object of its own: no text is ever read as one.
 */

export const isRef = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.$ref === 'string';

/** What a step's name may be: a word, not starting with a digit (a number names a step by position). */
const NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Whether a payload refers to an earlier step anywhere in it. */
export function hasRefs(value) {
    if (isRef(value)) return true;
    if (Array.isArray(value)) return value.some(hasRefs);
    if (value && typeof value === 'object') return Object.values(value).some(hasRefs);
    return false;
}

/** The refs in a payload, as written: ['1.elementId', 'titles.layerId', '0.layers.0.id', …]. */
export function refsOf(value, out = []) {
    if (isRef(value)) out.push(value.$ref);
    else if (Array.isArray(value)) value.forEach((v) => refsOf(v, out));
    else if (value && typeof value === 'object') Object.values(value).forEach((v) => refsOf(v, out));
    return out;
}

/** The paths in a payload that hold a $ref ('layerId', 'element.src', 'items[2].id' …). */
export function refPaths(value, at = '') {
    if (isRef(value)) return [at];
    if (Array.isArray(value)) return value.flatMap((v, i) => refPaths(v, `${at}[${i}]`));
    if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => refPaths(v, at ? `${at}.${k}` : k));
    return [];
}

/** The payload with each $ref as a placeholder string — to check its shape before the list runs. */
export function withPlaceholders(value, placeholder = 'ref') {
    if (isRef(value)) return placeholder;
    if (Array.isArray(value)) return value.map((v) => withPlaceholders(v, placeholder));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withPlaceholders(v, placeholder)]));
    return value;
}

/**
 * The steps' names → their numbers (1-based). Throws on a name that is not a word, or used twice.
 * @param {Array<{ as?: string }>} list
 * @returns {Map<string, number>}
 */
export function stepNames(list) {
    const names = new Map();
    (Array.isArray(list) ? list : []).forEach((step, i) => {
        if (step?.as === undefined) return;
        if (typeof step.as !== 'string' || !NAME.test(step.as)) throw new Error(`Step ${i + 1}: its name ("as") is a word, not starting with a digit — '${step.as}'`);
        if (names.has(step.as)) throw new Error(`Step ${i + 1}: the name '${step.as}' is already step ${names.get(step.as)}'s`);
        names.set(step.as, i + 1);
    });
    return names;
}

/** The step a ref names (0 for what was before), or why it names none. */
function stepOf(ref, step, names) {
    const head = ref.split('.')[0];
    const n = /^\d+$/.test(head) ? Number(head) : names.get(head);
    if (n === undefined) return { why: NAME.test(head) ? `no step before this one is named '${head}'` : 'it starts with a step\'s name or number (0 is what was there before the list)' };
    if (n >= step) return { why: `only an earlier step can be named (this is step ${step}${/^\d+$/.test(head) ? '' : `; '${head}' is step ${n}`})` };
    return { n };
}

/**
 * What would be refused in a list's names and refs, said before it runs: a name not a word or used twice, a ref to a
 * step that is not earlier, or to a name no earlier step has. (What a ref's path holds is known only when it runs.)
 * @param {unknown[]} list
 * @param {string} before  what step 0 is, as the domain says it: 'the scene before', 'the board before'
 * @returns {string[]}
 */
export function refProblems(list, before) {
    const problems = [];
    let names;
    try { names = stepNames(list); } catch (e) { return [e.message]; }
    (Array.isArray(list) ? list : []).forEach((step, i) => {
        for (const ref of refsOf(step?.payload ?? {})) {
            const { why } = stepOf(String(ref), i + 1, names);
            if (why) problems.push(`Step ${i + 1} (${step?.command}): $ref '${ref}' — ${why}; it may name ${before} (0)${i ? ` or an earlier step (1–${i}, or by its name)` : ''}`);
        }
    });
    return problems;
}

/**
 * The payload with each $ref replaced by what it names.
 * @param {unknown} value      the payload of step `step` (1-based)
 * @param {number} step
 * @param {unknown[]} results  the results of the steps before it, in order
 * @param {() => unknown} before  the scene before the list (scene.read's result) — asked for only when step 0 is named
 * @param {Map<string, number>} [names]  the steps' names (stepNames of the list)
 */
export function resolveRefs(value, step, results, before, names = new Map()) {
    if (isRef(value)) {
        const [head, ...path] = value.$ref.split('.');
        const { n, why } = stepOf(value.$ref, step, names);
        if (why) throw new Error(`$ref '${value.$ref}': ${why}`);
        let at = n === 0 ? before() : results[n - 1];
        for (const part of path) {
            if (at === null || typeof at !== 'object') { at = undefined; break; }
            at = Array.isArray(at) && /^\d+$/.test(part) ? at[Number(part)] : at[part];
        }
        if (at === undefined) throw new Error(`$ref '${value.$ref}': step ${n}${/^\d+$/.test(head) ? '' : ` ('${head}')`} has no ${path.join('.') || 'result'}`);
        return at;
    }
    if (Array.isArray(value)) return value.map((v) => resolveRefs(v, step, results, before, names));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(v, step, results, before, names)]));
    return value;
}

/** A step's name, as a list's item schema field. */
export const STEP_NAME = { type: 'string', pattern: NAME.source, description: 'a name for this step, for a later step to use what it made: { "$ref": "<name>.<field>" }' };

/** How a list's step names what an earlier one made — said wherever a list is taken (examples: the domain's own). */
export const refsHelp = (examples) => 'A step that makes something a later step works on is given a name ("as": "<name>"), and the later step '
    + `uses what it made: { "$ref": "<name>.<field>" }; { "$ref": "0.<field>" } is what was there before the list — ${examples}.`;
