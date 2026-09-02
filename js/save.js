// save.js — Web-Storage-backed save and restore.
// C refs: save.c and restore.c.

import { game } from './gstate.js';
import { docrt, pline } from './display.js';
import { GameMap } from './game.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { decodeSavedGraph, encodeSavedGraph } from './saved_graph.js';
import { promptKey } from './tty_prompts.js';
import { copyPersistentState, SAVE_VERSION } from './state_schema.js';

const SAVE_PREFIX = 'teleport-save:';

function saveKey(name) {
    return `${SAVE_PREFIX}${String(name || 'player').toLowerCase()}`;
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

export async function dosave() {
    let key;
    let answer;
    do {
        key = await promptKey('Really save? [yn] (n) ');
        answer = String.fromCharCode(key).toLowerCase();
    } while (!['y', 'n'].includes(answer)
        && ![27, 32, 10, 13].includes(key));
    if (answer !== 'y') {
        game._pending_message = '';
        game.context.move = 0;
        return;
    }

    game._pending_message = '';
    await pline('Saving...');
    if (!saveGame()) {
        await docrt();
        game.context.move = 0;
        return;
    }
    game.program_state.savefile_completed
        = (game.program_state.savefile_completed || 0) + 1;
    game.u.uhp = -1;
    game._saveExitPending = true;
    game.program_state.gameover = true;
    game.context.move = 0;
}

export function saveGame(storage = game.storage) {
    if (!storage?.setItem) return false;
    try {
        currentLuaLifecycle().syncVariables(game);
        const encoded = encodeSavedGraph(snapshotState());
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
        const snapshot = decodeSavedGraph(encoded);
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
