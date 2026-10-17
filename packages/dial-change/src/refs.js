/**
 * References between the steps of one change — several actions an assistant proposes as one (DIAL's change: a
 * scene's commands, a board's), where a later step works on what an earlier one made: the element a step added, the
 * page a new composition starts with, the card a new thoughtbook opens on.
 *
 * A payload value { "$ref": "<step>.<path>" } is the value at <path> in the result of step <step> (1-based, an earlier
 * step of the same list); step 0 is what was there before the list — its at-a-glance read (a scene's scene.read, a
 * board's doc.outline) — so "0.layers.0.id" is a scene's first layer. A path's parts are field names, or positions in
 * a list (from 0). A $ref is an object of its own: no text is ever read as one.
 */

export const isRef = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.$ref === 'string';

/** Whether a payload refers to an earlier step anywhere in it. */
export function hasRefs(value) {
    if (isRef(value)) return true;
    if (Array.isArray(value)) return value.some(hasRefs);
    if (value && typeof value === 'object') return Object.values(value).some(hasRefs);
    return false;
}

/** The refs in a payload, as written: ['1.elementId', '0.layers.0.id', …]. */
export function refsOf(value, out = []) {
    if (isRef(value)) out.push(value.$ref);
    else if (Array.isArray(value)) value.forEach((v) => refsOf(v, out));
    else if (value && typeof value === 'object') Object.values(value).forEach((v) => refsOf(v, out));
    return out;
}

/**
 * The payload with each $ref replaced by what it names.
 * @param {unknown} value      the payload of step `step` (1-based)
 * @param {number} step
 * @param {unknown[]} results  the results of the steps before it, in order
 * @param {() => unknown} before  the scene before the list (scene.read's result) — asked for only when step 0 is named
 */
export function resolveRefs(value, step, results, before) {
    if (isRef(value)) {
        const [head, ...path] = value.$ref.split('.');
        if (!/^\d+$/.test(head)) throw new Error(`$ref '${value.$ref}': it starts with a step number (0 is the scene before; 1 the first step)`);
        const n = Number(head);
        if (n >= step) throw new Error(`$ref '${value.$ref}': only an earlier step can be named (this is step ${step})`);
        let at = n === 0 ? before() : results[n - 1];
        for (const part of path) {
            if (at === null || typeof at !== 'object') { at = undefined; break; }
            at = Array.isArray(at) && /^\d+$/.test(part) ? at[Number(part)] : at[part];
        }
        if (at === undefined) throw new Error(`$ref '${value.$ref}': step ${n} has no ${path.join('.') || 'result'}`);
        return at;
    }
    if (Array.isArray(value)) return value.map((v) => resolveRefs(v, step, results, before));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(v, step, results, before)]));
    return value;
}

/** How a list's step names what an earlier one made — said wherever a list is taken (examples: the domain's own). */
export const refsHelp = (examples) => 'A step may use what an earlier one in the list made, or what was there before the list: '
    + `{ "$ref": "<step>.<field>" } — ${examples}.`;
