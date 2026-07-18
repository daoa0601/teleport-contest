// save.js — Web-Storage-backed save/restore snapshots.
// C refs: save.c, restore.c.  RNG and terminal handles belong to the current
// process; persistent dungeon/hero state is copied and re-linked on restore.

import { game } from './gstate.js';
import { GameMap } from './game.js';

const SAVE_VERSION = 1;
const SAVE_PREFIX = 'teleport-save:';
const EQUIPMENT_KEYS = ['uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmc', 'uarmu'];
const OMIT_KEYS = new Set([
    'nhDisplay', '_preNhgetchHook', 'coreCtx', 'currentSeed', 'mockStorage',
    'storage', 'datetime', 'replayMoves', '_screen_output', '_pending_message',
    '_saveExitPending', 'program_state', 'startingPet', 'fmon',
    ...EQUIPMENT_KEYS,
]);

function saveKey(name) {
    return `${SAVE_PREFIX}${String(name || 'player').toLowerCase()}`;
}

function equipmentReference(item) {
    return item?.invlet || null;
}

function snapshotState() {
    const state = {};
    for (const [key, value] of Object.entries(game)) {
        if (OMIT_KEYS.has(key) || typeof value === 'function') continue;
        state[key] = value;
    }
    return {
        version: SAVE_VERSION,
        state,
        refs: {
            equipment: Object.fromEntries(EQUIPMENT_KEYS
                .map(key => [key, equipmentReference(game[key])])),
            startingPet: game.level?.monsters?.indexOf(game.startingPet) ?? -1,
        },
    };
}

function replacer(_key, value) {
    if (value instanceof Map)
        return { __teleportType: 'Map', entries: [...value.entries()] };
    if (ArrayBuffer.isView(value)) return Array.from(value);
    if (typeof value === 'bigint') return Number(value);
    return value;
}

function reviver(_key, value) {
    if (value?.__teleportType === 'Map') return new Map(value.entries || []);
    return value;
}

export function saveGame(storage = game.storage) {
    if (!storage?.setItem) return false;
    try {
        storage.setItem(saveKey(game.plname), JSON.stringify(snapshotState(), replacer));
        return true;
    } catch (_error) {
        return false;
    }
}

export function restoreGame(name, storage = game.storage) {
    if (!storage?.getItem) return false;
    let encoded;
    try {
        encoded = storage.getItem(saveKey(name));
        if (!encoded) return false;
        storage.removeItem?.(saveKey(name));
    } catch (_error) {
        return false;
    }

    const snapshot = JSON.parse(encoded, reviver);
    if (snapshot?.version !== SAVE_VERSION || !snapshot.state?.level) return false;
    Object.assign(game, snapshot.state);
    Object.setPrototypeOf(game.level, GameMap.prototype);
    game.program_state = {};

    const inventory = game.inventory || [];
    for (const key of EQUIPMENT_KEYS) {
        const invlet = snapshot.refs?.equipment?.[key];
        game[key] = invlet
            ? inventory.find(item => item.invlet === invlet) || null : null;
    }
    const petIndex = snapshot.refs?.startingPet ?? -1;
    game.startingPet = petIndex >= 0
        ? game.level.monsters?.[petIndex] || null : null;
    game.fmon = game.level.monsters?.[0] || null;
    return true;
}
