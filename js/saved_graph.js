const TYPE = '__teleportType';
const ENTITY_KIND = '__teleportEntityKind';
const ENTITY_ID = '__teleportEntityId';

function entityIdentity(value) {
    if (!value || typeof value !== 'object') return null;
    if (Number.isInteger(value.m_id) && value.m_id > 0)
        return { kind: 'monster', id: value.m_id };
    if (Number.isInteger(value.o_id) && value.o_id > 0)
        return { kind: 'object', id: value.o_id };
    return null;
}

function graphReplacer() {
    const entities = new Map();
    return (_key, value) => {
        if (typeof value === 'function')
            throw new TypeError('Persistent state contains a function');
        if (typeof value === 'bigint')
            return { [TYPE]: 'BigInt', value: value.toString() };
        if (value instanceof Map)
            return { [TYPE]: 'Map', entries: [...value.entries()] };
        if (value instanceof Set)
            return { [TYPE]: 'Set', values: [...value.values()] };
        if (ArrayBuffer.isView(value))
            return { [TYPE]: 'TypedArray', values: Array.from(value) };

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
        return {
            ...value,
            [TYPE]: 'Entity',
            [ENTITY_KIND]: identity.kind,
            [ENTITY_ID]: identity.id,
        };
    };
}

export function encodeSavedGraph(value) {
    return JSON.stringify(value, graphReplacer());
}

export function decodeSavedGraph(encoded) {
    const entities = new Map();

    function materialize(value) {
        if (!value || typeof value !== 'object') return value;
        if (Array.isArray(value)) return value.map(materialize);
        if (value[TYPE] === 'BigInt') return BigInt(value.value);
        if (value[TYPE] === 'Map') {
            return new Map(value.entries.map(([key, entry]) =>
                [materialize(key), materialize(entry)]));
        }
        if (value[TYPE] === 'Set')
            return new Set(value.values.map(materialize));
        if (value[TYPE] === 'TypedArray') return [...value.values];
        if (value[TYPE] === 'EntityRef') return value;
        if (value[TYPE] === 'Entity') {
            const kind = value[ENTITY_KIND];
            const id = value[ENTITY_ID];
            const key = `${kind}:${id}`;
            if (entities.has(key))
                throw new Error(`Duplicate ${kind} id ${id} in save`);
            const entity = {};
            entities.set(key, entity);
            for (const [name, entry] of Object.entries(value)) {
                if (name === TYPE || name === ENTITY_KIND
                    || name === ENTITY_ID) continue;
                entity[name] = materialize(entry);
            }
            return entity;
        }

        return Object.fromEntries(Object.entries(value).map(([key, entry]) =>
            [key, materialize(entry)]));
    }

    function resolveReferences(value, visited = new WeakSet()) {
        if (!value || typeof value !== 'object') return value;
        if (value[TYPE] === 'EntityRef') {
            const kind = value[ENTITY_KIND];
            const id = value[ENTITY_ID];
            const entity = entities.get(`${kind}:${id}`);
            if (!entity)
                throw new Error(`Missing ${kind} id ${id} in save`);
            return entity;
        }
        if (visited.has(value)) return value;
        visited.add(value);

        if (Array.isArray(value)) {
            for (let index = 0; index < value.length; index++)
                value[index] = resolveReferences(value[index], visited);
            return value;
        }
        if (value instanceof Map) {
            const entries = [...value.entries()].map(([key, entry]) => [
                resolveReferences(key, visited),
                resolveReferences(entry, visited),
            ]);
            value.clear();
            for (const [key, entry] of entries) value.set(key, entry);
            return value;
        }
        if (value instanceof Set) {
            const entries = [...value].map(entry =>
                resolveReferences(entry, visited));
            value.clear();
            for (const entry of entries) value.add(entry);
            return value;
        }
        for (const [key, entry] of Object.entries(value))
            value[key] = resolveReferences(entry, visited);
        return value;
    }

    return resolveReferences(materialize(JSON.parse(encoded)));
}
