import { isSavedRecord } from './saved_graph.js';
import type { GameObject } from './object_types.js';
import type { Monster, SavedMonsterTraits } from './monster_types.js';
import type { Room } from './map_types.js';

export type Check<T> = (value: unknown) => value is T;
export type Fields<T> = { [Key in keyof T]-?: Check<T[Key]> };

export function fieldsMatch<T>(
    value: unknown, fields: Fields<T>, invalidField?: (field: string) => void,
): value is T {
    if (!isSavedRecord(value)) return false;
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

// Use this for a complete saved record. Structural predicates such as a
// coordinate check may still use fieldsMatch on a larger domain object.
export function closedFieldsMatch<T>(
    value: unknown, fields: Fields<T>, invalidField?: (field: string) => void,
): value is T {
    if (!isSavedRecord(value)) return false;
    for (const key of Object.keys(value)) {
        if (!Object.hasOwn(fields, key)) {
            invalidField?.(key);
            return false;
        }
    }
    return fieldsMatch(value, fields, invalidField);
}

export function mapOf<Key, Value>(keyCheck: Check<Key>, valueCheck: Check<Value>): Check<Map<Key, Value>> {
    return (value): value is Map<Key, Value> => {
        if (!(value instanceof Map)) return false;
        const entries: Map<unknown, unknown> = value;
        for (const [key, entry] of entries) {
            if (!keyCheck(key) || !valueCheck(entry)) return false;
        }
        return true;
    };
}

export function setOf<T>(check: Check<T>): Check<Set<T>> {
    return (value): value is Set<T> => {
        if (!(value instanceof Set)) return false;
        const entries: Set<unknown> = value;
        for (const entry of entries) if (!check(entry)) return false;
        return true;
    };
}

export function numericRecordOf<T>(check: Check<T>): Check<Partial<Record<number, T>>> {
    return (value): value is Partial<Record<number, T>> => {
        if (!isSavedRecord(value)) return false;
        return Object.entries(value).every(([key, entry]) =>
            Number.isInteger(Number(key)) && String(Number(key)) === key && check(entry));
    };
}

export function oneOf<const Values extends readonly (string | number | boolean)[]>(
    ...values: Values
): Check<Values[number]> {
    return (value): value is Values[number] => values.some(candidate => candidate === value);
}

export function optional<T>(check: Check<T>): Check<T | undefined> {
    return (value): value is T | undefined => value === undefined || check(value);
}

export function nullable<T>(check: Check<T>): Check<T | null> {
    return (value): value is T | null => value === null || check(value);
}

export function arrayOf<T>(check: Check<T>): Check<T[]> {
    return (value): value is T[] => {
        if (!Array.isArray(value)) return false;
        const entries: unknown[] = value;
        for (let index = 0; index < entries.length; index++) {
            if (!check(entries[index])) return false;
        }
        return true;
    };
}

export const integer = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value);
export const boolean = (value: unknown): value is boolean => typeof value === 'boolean';
export const string = (value: unknown): value is string => typeof value === 'string';

type SavedEntityKind = 'object' | 'monster' | 'savedMonster' | 'room';

export interface SavedEntityContext {
    active: WeakMap<object, Set<SavedEntityKind>>;
    acyclicObjectContents?: WeakSet<object>;
    object: Check<GameObject>;
    monster: Check<Monster>;
    savedMonster: Check<SavedMonsterTraits>;
    room: Check<Room>;
    failure?: string;
}

// A carrier can point back to the object currently being checked. Only an
// active check of that same entity type closes a cycle; another entity type
// must still validate its own fields. Failed checks are never cached.
export function validateSavedEntity<T>(
    value: unknown, kind: SavedEntityKind, context: SavedEntityContext, fields: Fields<T>,
): value is T {
    if (!isSavedRecord(value)) {
        context.failure ??= `${kind} must be a record`;
        return false;
    }
    let active = context.active.get(value);
    if (active?.has(kind)) return true;
    if (!active) {
        active = new Set();
        context.active.set(value, active);
    }
    active.add(kind);
    try {
        return closedFieldsMatch<T>(value, fields, field => {
            context.failure ??= `${kind} has invalid field ${field.slice(0, 80)}`;
        });
    } finally {
        active.delete(kind);
        if (!active.size) context.active.delete(value);
    }
}
