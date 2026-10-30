const TYPE = '__teleportType';
const ENTITY_KIND = '__teleportEntityKind';
const ENTITY_ID = '__teleportEntityId';

type EntityKind = 'monster' | 'object';
interface EntityIdentity {
    kind: EntityKind;
    id: number;
}

// Records at the serialized-data boundary have not acquired domain types.
export function isSavedRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object'
        && !Array.isArray(value) && !(value instanceof Map) && !(value instanceof Set);
}

function entityIdentity(value: unknown): EntityIdentity | null {
    if (!isSavedRecord(value)) return null;
    if (isEntityId(value.m_id)) return { kind: 'monster', id: value.m_id };
    // Occupation contexts also carry o_id to identify their food or tool.
    // Only objects have a type; those references are ordinary state records.
    if (typeof value.otyp === 'number' && Number.isInteger(value.otyp)
        && isEntityId(value.o_id)) return { kind: 'object', id: value.o_id };
    return null;
}

function isEntityId(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function graphReplacer(): (key: string, value: unknown) => unknown {
    const entities = new Map<string, object>();
    return (_key, value) => {
        if (typeof value === 'function')
            throw new TypeError('Persistent state contains a function');
        if (typeof value === 'bigint')
            return { [TYPE]: 'BigInt', value: value.toString() };
        if (value instanceof Map)
            return { [TYPE]: 'Map', entries: [...value.entries()] };
        if (value instanceof Set)
            return { [TYPE]: 'Set', values: [...value.values()] };
        if (ArrayBuffer.isView(value)) {
            const length = 'length' in value && typeof value.length === 'number'
                ? value.length : 0;
            const values = Array.from({ length }, (_, index): unknown =>
                Reflect.get(value, index));
            return { [TYPE]: 'TypedArray', values };
        }

        if (!isSavedRecord(value)) return value;
        const identity = entityIdentity(value);
        if (!identity) return value;

        const key = `${identity.kind}:${identity.id}`;
        const existing = entities.get(key);
        if (existing) {
            if (existing !== value) {
                throw new Error(
                    `Duplicate ${identity.kind} id ${identity.id} in saved state`,
                );
            }
            return {
                [TYPE]: 'EntityRef',
                [ENTITY_KIND]: identity.kind,
                [ENTITY_ID]: identity.id,
            };
        }
        entities.set(key, value);
        const saved: Record<string, unknown> = {
            ...value,
            [TYPE]: 'Entity',
            [ENTITY_KIND]: identity.kind,
            [ENTITY_ID]: identity.id,
        };
        // restore.c:restobjchn() clears these traversal marks on every object.
        if (identity.kind === 'object') delete saved.bypass;
        // save.c:savemon() clears a flash interrupted by a panic save.
        if (identity.kind === 'monster') saved.mtemplit = 0;
        return saved;
    };
}

export function encodeSavedGraph(value: unknown): string {
    const encoded = JSON.stringify(value, graphReplacer());
    if (encoded === undefined) throw new TypeError('Saved graph has no root value');
    return encoded;
}

export function decodeSavedGraph(encoded: string): unknown {
    const entities = new Map<string, Record<string, unknown>>();
    const parsed: unknown = JSON.parse(encoded);
    return resolveReferences(materialize(parsed), new WeakSet<object>());

    function materialize(value: unknown): unknown {
        if (!value || typeof value !== 'object') return value;
        if (Array.isArray(value)) return savedArray(value).map(materialize);
        if (!isSavedRecord(value)) throw new TypeError('Invalid saved graph record');
        if (value[TYPE] === 'BigInt') {
            if (typeof value.value !== 'string')
                throw new TypeError('Invalid saved BigInt');
            return BigInt(value.value);
        }
        if (value[TYPE] === 'Map') {
            return new Map(savedArray(value.entries).map(entry => {
                const pair = savedArray(entry);
                if (pair.length !== 2) throw new TypeError('Invalid saved Map entry');
                return [materialize(pair[0]), materialize(pair[1])];
            }));
        }
        if (value[TYPE] === 'Set')
            return new Set(savedArray(value.values).map(materialize));
        if (value[TYPE] === 'TypedArray') return [...savedArray(value.values)];
        if (value[TYPE] === 'EntityRef') {
            savedEntityIdentity(value);
            return value;
        }
        if (value[TYPE] === 'Entity') {
            const { kind, id } = savedEntityIdentity(value);
            const key = `${kind}:${id}`;
            if (entities.has(key))
                throw new Error(`Duplicate ${kind} id ${id} in save`);
            const entity: Record<string, unknown> = {};
            entities.set(key, entity);
            for (const [name, entry] of Object.entries(value)) {
                if (name === TYPE || name === ENTITY_KIND
                    || name === ENTITY_ID) continue;
                Object.defineProperty(entity, name, {
                    value: materialize(entry),
                    enumerable: true, configurable: true, writable: true,
                });
            }
            return entity;
        }

        return Object.fromEntries(Object.entries(value).map(([key, entry]) =>
            [key, materialize(entry)]));
    }

    function resolveReferences(value: unknown, visited: WeakSet<object>): unknown {
        if (!value || typeof value !== 'object') return value;
        if (isSavedRecord(value) && value[TYPE] === 'EntityRef') {
            const { kind, id } = savedEntityIdentity(value);
            const entity = entities.get(`${kind}:${id}`);
            if (!entity)
                throw new Error(`Missing ${kind} id ${id} in save`);
            return entity;
        }
        if (visited.has(value)) return value;
        visited.add(value);

        if (Array.isArray(value)) {
            const values = savedArray(value);
            for (let index = 0; index < values.length; index++)
                values[index] = resolveReferences(values[index], visited);
            return values;
        }
        if (value instanceof Map) {
            const map: Map<unknown, unknown> = value;
            const entries = [...map.entries()].map(([key, entry]) => [
                resolveReferences(key, visited),
                resolveReferences(entry, visited),
            ] as const);
            map.clear();
            for (const [key, entry] of entries) map.set(key, entry);
            return map;
        }
        if (value instanceof Set) {
            const set: Set<unknown> = value;
            const entries = [...set].map(entry => resolveReferences(entry, visited));
            set.clear();
            for (const entry of entries) set.add(entry);
            return set;
        }
        if (!isSavedRecord(value)) throw new TypeError('Invalid saved graph record');
        for (const [key, entry] of Object.entries(value)) {
            Object.defineProperty(value, key, {
                value: resolveReferences(entry, visited),
                enumerable: true, configurable: true, writable: true,
            });
        }
        return value;
    }
}

function savedArray(value: unknown): unknown[] {
    if (!Array.isArray(value)) throw new TypeError('Invalid saved graph array');
    return value;
}

function savedEntityIdentity(value: Record<string, unknown>): EntityIdentity {
    const kind = value[ENTITY_KIND];
    const id = value[ENTITY_ID];
    if ((kind !== 'monster' && kind !== 'object') || !isEntityId(id))
        throw new TypeError('Invalid saved entity identity');
    return { kind, id };
}
