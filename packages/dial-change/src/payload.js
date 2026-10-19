/**
 * Whether an action's payload fits its schema — one validator for every registry of actions (wity-authoring's board
 * commands and automation actions, wity-scene-authoring's scene commands and media actions, @wity-ai/publishing's
 * actions), so they all check alike. Moved here on 2026-10-19 from the two authoring packages' schema.js (two
 * copies; this one, scene-authoring's, also takes null in a list of types — otherwise the same).
 *
 * A JSON-schema subset — what the action schemas use: type (object|array|string|number|integer|boolean|null — one,
 * or a list meaning any of them), properties, required, items, enum, minLength, minItems, additionalProperties
 * (default **false**: an unknown field is an error, so a caller sending `data.label` where the action takes `label`
 * fails loudly instead of silently doing nothing).
 *
 * @returns {string[]} errors (empty when valid)
 */
export function validatePayload(schema, value, path = 'payload') {
    const errors = [];
    check(schema, value, path, errors);
    return errors;
}

function typeOf(v) {
    if (Array.isArray(v)) return 'array';
    if (v === null) return 'null';
    return typeof v;
}

function check(schema, value, path, errors) {
    if (!schema) return;
    if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path} must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`);
        return;
    }
    // a type, or (as in JSON Schema) a list of them — e.g. ['string', 'null'] for an optional field that null removes
    const types = schema.type === undefined ? [] : [].concat(schema.type);
    const actual = typeOf(value);
    const isA = (type) => (type === 'integer' ? Number.isInteger(value)
        : type === 'number' ? actual === 'number' && Number.isFinite(value)
        : actual === type);
    const t = types.find(isA) ?? types[0];
    if (types.length && !types.some(isA)) {
        const named = types.filter((type) => type !== 'null').map((type) => (type === 'integer' ? 'an integer' : `a${/^[aeiou]/.test(type) ? 'n' : ''} ${type}`));
        errors.push(`${path} must be ${named.join(' or ')}${types.includes('null') ? ' (or null)' : ''}`);
        return;
    }
    if (t === 'string' && schema.minLength && value.length < schema.minLength) errors.push(`${path} must not be empty`);
    if (t === 'array') {
        if (schema.minItems && value.length < schema.minItems) errors.push(`${path} needs at least ${schema.minItems} item(s)`);
        if (schema.items) value.forEach((v, i) => check(schema.items, v, `${path}[${i}]`, errors));
    }
    if (t === 'object') {
        const props = schema.properties || {};
        for (const key of schema.required || []) {
            if (value[key] === undefined) errors.push(`${path}.${key} is required`);
        }
        for (const [key, v] of Object.entries(value)) {
            if (v === undefined) continue;
            if (props[key]) check(props[key], v, `${path}.${key}`, errors);
            else if (schema.additionalProperties === true) continue;
            else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') check(schema.additionalProperties, v, `${path}.${key}`, errors);
            else errors.push(`${path}.${key} is not a known field (expected: ${Object.keys(props).join(', ') || 'none'})`);
        }
    }
}
