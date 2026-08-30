// save.js — Web-Storage-backed save and restore.
// C refs: save.c and restore.c.

import { game } from './gstate.js';
import { GameMap } from './game.js';
import { copyPersistentState, SAVE_VERSION } from './state_schema.js';

const SAVE_PREFIX = 'teleport-save:';
const TYPE = '__teleportType';
const ENTITY_KIND = '__teleportEntityKind';
const ENTITY_ID = '__teleportEntityId';

function saveKey(name) {
    return `${SAVE_PREFIX}${String(name || 'player').toLowerCase()}`;
}

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

function decodeGraph(encoded) {
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

function snapshotState() {
    return {
        version: SAVE_VERSION,
        state: copyPersistentState(game),
    };
}

function rehydrateLevel(level) {
    if (!level?.locations) return;
    Object.setPrototypeOf(level, GameMap.prototype);
}

function rehydrateLevels(state) {
    rehydrateLevel(state.level);
    const cached = state._levelCache;
    const entries = cached instanceof Map
        ? cached.values() : Object.values(cached || {});
    for (const entry of entries) rehydrateLevel(entry?.level || entry);
}

export function saveGame(storage = game.storage) {
    if (!storage?.setItem) return false;
    try {
        const encoded = JSON.stringify(snapshotState(), graphReplacer());
        storage.setItem(saveKey(game.plname), encoded);
        return true;
    } catch (error) {
        console.error(`Unable to save game: ${error.message}`);
        return false;
    }
}

export function restoreGame(name, storage = game.storage) {
    if (!storage?.getItem) return false;
    const key = saveKey(name);
    try {
        const encoded = storage.getItem(key);
        if (!encoded) return false;
        const snapshot = decodeGraph(encoded);
        if (snapshot?.version !== SAVE_VERSION || !snapshot.state?.level)
            return false;

        Object.assign(game, snapshot.state);
        rehydrateLevels(game);
        game.program_state = {};
        game.fmon = game.level.monsters?.[0] || null;
        storage.removeItem?.(key);
        return true;
    } catch (error) {
        console.error(`Unable to restore game: ${error.message}`);
        return false;
    }
}
