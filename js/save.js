// save.js — Web-Storage-backed save and restore.
// C refs: save.c and restore.c.
import { game } from './gstate.js';
import { PanicTermination } from './panic_termination.js';
import { clearMessageWindow, docrt, pline, plineWithContinuation, rawPrint } from './display.js';
import { doneObjectCleanup } from './object_cleanup.js';
import { promptYesNo, promptYesNoQuit } from './query.js';
import { requireInitializedHero } from './hero_types.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { encodeSavedGraph } from './saved_graph.js';
import { decodeSavedGame } from './persistent_state_validation.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { copyPersistentState, restorePersistentState, SAVE_VERSION } from './state_schema.js';
import { restoreMonsterWormHeads, validMonsterWormBodies } from './monster_worm.js';
import { resolveDungeonIdentities } from './dungeon.js';
import { restoreMonsterInventoryOwnership } from './monster_inventory.js';
import { FULL_MOON, LUCKMAX, LUCKMIN } from './const.js';
import { vision_reset_new_level } from './vision.js';
const SAVE_PREFIX = 'teleport-save:';
const ERROR_SAVE_PREFIX = 'teleport-error-save:';
function saveKey(name, prefix = SAVE_PREFIX) {
    return `${prefix}${String(name || 'player').toLowerCase()}`;
}
function snapshotState() {
    return {
        version: SAVE_VERSION,
        state: copyPersistentState(game),
    };
}
function restoreLevelMonsters(level) {
    if (!validMonsterWormBodies(level))
        throw new Error('Invalid saved worm bodies');
    restoreMonsterWormHeads(level);
    for (const monster of level.monsters)
        restoreMonsterInventoryOwnership(monster);
}
function restoreSavedMonsters(state) {
    if (state.level)
        restoreLevelMonsters(state.level);
    for (const cached of state._levelCache?.values() ?? [])
        restoreLevelMonsters(cached.level);
    for (const monster of state._migratingMonsters || [])
        restoreMonsterInventoryOwnership(monster);
    if (state.u.usteed)
        restoreMonsterInventoryOwnership(state.u.usteed);
}
export async function dosave() {
    // C save.c:dosave() clears WIN_MESSAGE before asking and after either
    // answer. Acknowledgment alone leaves the seen question on tty.
    clearMessageWindow();
    const answer = await promptYesNo('Really save? [yn] (n) ');
    clearMessageWindow();
    if (answer !== 'y') {
        if (game.multi > 0)
            endVoluntaryMultiTurn(game);
        game.context.move = 0;
        return;
    }
    await pline('Saving...');
    if (!await saveGame()) {
        await docrt();
        game.context.move = 0;
        return;
    }
    game.program_state.savefile_completed
        = (game.program_state.savefile_completed || 0) + 1;
    game.u.uhp = -1;
    // C save.c:dosave() displays WIN_MESSAGE so the "Saving..." line is
    // seen, then exit_nhwindows("Be seeing you...") tears the windows down
    // (term_end_screen clears the screen, settty raw-prints the goodbye
    // with a trailing newline), and nh_terminate() never returns here.
    game.program_state.windows_exited = true;
    game.nhDisplay?.clearScreen();
    rawPrint('Be seeing you...');
    game.program_state.gameover = true;
    game.context.move = 0;
}
export async function saveGame(storage = game.storage) {
    return await writeSave(storage, saveKey(game.plname), true);
}
export async function saveErrorGame(storage = game.storage) {
    return await writeSave(storage, saveKey(game.plname, ERROR_SAVE_PREFIX), false);
}
export function hasErrorSave(name, storage = game.storage) {
    try {
        return !!storage?.getItem
            && storage.getItem(saveKey(name, ERROR_SAVE_PREFIX)) !== null;
    }
    catch (error) {
        if (error instanceof PanicTermination)
            throw error;
        return false;
    }
}
// C unixunix.c:ask_about_panic_save(). The error snapshot is kept either way.
export async function askAboutPanicSave() {
    await plineWithContinuation('There is no regular save file but there is a panic one.');
    await plineWithContinuation('It might be recoverable with demi-divine intervention.');
    const question = 'Start a new game instead? [yn] (n) ';
    return await promptYesNoQuit(question, 'n') === 'y';
}
async function prepareGameForSave() {
    game.u.invulnerable = false;
    await doneObjectCleanup();
}
// C save.c dosave0(): undo the date-dependent luck that
// moveloop_preamble() applied at startup; restoring applies it again.
function undoDateLuck() {
    const before = game.u.uluck || 0;
    let luck = before;
    if (game.flags.moonphase === FULL_MOON)
        luck = Math.max(LUCKMIN, luck - 1);
    if (game.flags.friday13)
        luck = Math.min(LUCKMAX, luck + 1);
    game.u.uluck = luck;
    return before;
}
async function writeSave(storage, key, reportFailure) {
    game.program_state.saving = (game.program_state.saving || 0) + 1;
    let saved = false;
    try {
        await prepareGameForSave();
        if (storage?.setItem) {
            currentLuaLifecycle().syncVariables(game);
            const luck = undoDateLuck();
            try {
                storage.setItem(key, encodeSavedGraph(snapshotState()));
            }
            catch (error) {
                // The port keeps playing after a failed save; C has exited.
                game.u.uluck = luck;
                throw error;
            }
            game.program_state.something_worth_saving = false;
            saved = true;
        }
    }
    catch (error) {
        if (error instanceof PanicTermination)
            throw error;
        if (reportFailure) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Unable to save game: ${message}`);
        }
    }
    game.program_state.saving--;
    return saved;
}
export function restoreGame(name, storage = game.storage) {
    if (!storage?.getItem)
        return false;
    const key = saveKey(name);
    try {
        const encoded = storage.getItem(key);
        if (!encoded)
            return false;
        const snapshot = decodeSavedGame(encoded);
        if (!snapshot.state.level || !snapshot.state.urole || !snapshot.state.urace)
            return false;
        requireInitializedHero(snapshot.state.u);
        restoreSavedMonsters(snapshot.state);
        restorePersistentState(game, snapshot.state);
        resolveDungeonIdentities(game);
        game.multi = 0;
        game.warn_obj_cnt = 0;
        game._monsterSwallower = null;
        game._monsterEngulf = null;
        game._commandCount = 0;
        game._commandKey = 0;
        game._occupation = null;
        game._runState = null;
        game._heroTimePending = false;
        game._kickedLoc = null;
        game._cannedCommands = [];
        game._delayedAction = null;
        delete game._helplessRunmodeDelayPending;
        game.context.move = 0;
        // Saved flags govern future resets; the current Space binding still
        // belongs to this process until an option change reconciles it.
        game.commandBindings.setRestOnSpace(!!game.flags?.rest_on_space, { initial: true });
        game._emptyShops = [];
        game._shopFollowMessageTurn = 0;
        game.program_state = { something_worth_saving: true };
        game.fmon = game.level?.monsters[0] ?? null;
        // C restore.c:dorecover() rebuilds transient vision after loading the
        // level. No old sight bits may suppress its first terrain repaint.
        vision_reset_new_level();
        game.vision_full_recalc = 1;
        storage.removeItem?.(key);
        return true;
    }
    catch (error) {
        if (error instanceof PanicTermination)
            throw error;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Unable to restore game: ${message}`);
        return false;
    }
}
//# sourceMappingURL=save.js.map