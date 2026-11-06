import { isSavedRecord } from './saved_graph.js';
// Port only: validates each field of a saved record against its check.
export function fieldsMatch(value, fields, invalidField) {
    if (!isSavedRecord(value))
        return false;
    for (const key in fields) {
        const ownField = Object.hasOwn(value, key);
        const entry = ownField ? value[key] : undefined;
        // JSON object members cannot retain undefined. Rejecting one here
        // also preserves exact optional-property semantics at this boundary.
        if ((ownField && entry === undefined) || !fields[key](entry)) {
            invalidField?.(key);
            return false;
        }
    }
    return true;
}
// Port only: fieldsMatch that also rejects unknown extra fields.
// Use this for a complete saved record. Structural predicates such as a
// coordinate check may still use fieldsMatch on a larger domain object.
export function closedFieldsMatch(value, fields, invalidField) {
    if (!isSavedRecord(value))
        return false;
    for (const key of Object.keys(value)) {
        if (!Object.hasOwn(fields, key)) {
            invalidField?.(key);
            return false;
        }
    }
    return fieldsMatch(value, fields, invalidField);
}
// Port only: type-guard combinator for Map values in saved state.
export function mapOf(keyCheck, valueCheck) {
    return (value) => {
        if (!(value instanceof Map))
            return false;
        const entries = value;
        for (const [key, entry] of entries) {
            if (!keyCheck(key) || !valueCheck(entry))
                return false;
        }
        return true;
    };
}
// Port only: type-guard combinator for Set values in saved state.
export function setOf(check) {
    return (value) => {
        if (!(value instanceof Set))
            return false;
        const entries = value;
        for (const entry of entries)
            if (!check(entry))
                return false;
        return true;
    };
}
// Port only: type-guard combinator for numeric-key records in saved state.
export function numericRecordOf(check) {
    return (value) => {
        if (!isSavedRecord(value))
            return false;
        return Object.entries(value).every(([key, entry]) => Number.isInteger(Number(key)) && String(Number(key)) === key && check(entry));
    };
}
// Port only: type-guard combinator for a fixed set of literal values.
export function oneOf(...values) {
    return (value) => values.some(candidate => candidate === value);
}
// Port only: type-guard combinator for optional saved fields.
export function optional(check) {
    return (value) => value === undefined || check(value);
}
// Port only: type-guard combinator for nullable saved fields.
export function nullable(check) {
    return (value) => value === null || check(value);
}
// Port only: type-guard combinator for arrays in saved state.
export function arrayOf(check) {
    return (value) => {
        if (!Array.isArray(value))
            return false;
        const entries = value;
        for (let index = 0; index < entries.length; index++) {
            if (!check(entries[index]))
                return false;
        }
        return true;
    };
}
// Port only: primitive type guards for decoded save values.
export const integer = (value) => typeof value === 'number' && Number.isInteger(value);
// Port only: primitive type guard for decoded save values.
export const boolean = (value) => typeof value === 'boolean';
// Port only: primitive type guard for decoded save values.
export const string = (value) => typeof value === 'string';
// Port only: cycle-aware field validation of one saved entity.
// A carrier can point back to the object currently being checked. Only an
// active check of that same entity type closes a cycle; another entity type
// must still validate its own fields. Failed checks are never cached.
export function validateSavedEntity(value, kind, context, fields) {
    if (!isSavedRecord(value)) {
        context.failure ??= `${kind} must be a record`;
        return false;
    }
    let active = context.active.get(value);
    if (active?.has(kind))
        return true;
    if (!active) {
        active = new Set();
        context.active.set(value, active);
    }
    active.add(kind);
    try {
        return closedFieldsMatch(value, fields, field => {
            context.failure ??= `${kind} has invalid field ${field.slice(0, 80)}`;
        });
    }
    finally {
        active.delete(kind);
        if (!active.size)
            context.active.delete(value);
    }
}
//# sourceMappingURL=saved_validation.js.map