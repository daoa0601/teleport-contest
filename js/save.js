// save.js — Web-Storage-backed save.
// C refs: save.c. The restore.c dorecover()/restgamestate() flow lives in
// restore.ts.
import { resetErinys } from './monster_data.js';
import { game } from './gstate.js';
import { PanicTermination } from './panic_termination.js';
import { clearMessageWindow, displayMessageWindow, rememberToplines } from './topl.js';
import { tty_exit_nhwindows } from './wintty.js';
import { docrt, reglyphSymbolSet } from './display.js';
import { pline, plineWithContinuation } from './pline.js';
import { doneObjectCleanup } from './end.js';
import { restoreSavedLightSources } from './light.js';
import { promptChoice, promptYesNo } from './query.js';
import { requireInitializedHero } from './hero_types.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { encodeSavedGraph } from './saved_graph.js';
import { decodeSavedGame } from './persistent_state_validation.js';
import { cmdq_clear } from './cmd.js';
import { nomul } from './hack.js';
import { copyPersistentState, restorePersistentState, SAVE_VERSION } from './state_schema.js';
import { rollQuestFigureGenders } from './role.js';
import { resolveDungeonIdentities } from './dungeon.js';
import { purgeDeadMonsters, restoreMonsterInventoryOwnership } from './mon.js';
import { CQ_CANNED, CQ_REPEAT, FULL_MOON, LUCKMAX, LUCKMIN, M_AP_NOTHING, Upolyd } from './const.js';
import { vision_reset_new_level } from './vision.js';
import { rewindEngravingsForSave, restoreEngravings } from './engrave.js';
import { weaponNeedsBashingMessage } from './wield.js';
import { GRAPPLING_HOOK, PICK_AXE } from './object_data.js';
import { forgetTempleEntry } from './priest.js';
import { restore_waterlevel } from './mkmaze.js';
import { restoreLevelRegions } from './region.js';
import { oinit } from './o_init.js';
import { restoreScheduledLevelChange } from './do.js';
import { recorderRestoredTime } from './calendar.js';
import { restoreSavedTimers } from './timeout.js';
import { restoreLevelChains, restoreMessageHistory, restoreMonsterWormHeads, validMonsterWormBodies, } from './restore.js';
const SAVE_PREFIX = 'teleport-save:';
const ERROR_SAVE_PREFIX = 'teleport-error-save:';
// Port only: derives the storage key from the player name.
export function saveKey(name, prefix = SAVE_PREFIX) {
    return `${prefix}${String(name || 'player').toLowerCase()}`;
}
// Port only: snapshots the persistent state for serialization.
// Snapshot persistent state, including the message window's recall history.
// Also C save.c:save_msghistory(): inlined here with the rest of the saved state.
// Also C topl.c:msghistory_snapshot(): inlined here before serializing the oldest-first history.
// Also C topl.c:tty_getmsghistory(): inlined here; saving reads the history array directly.
function snapshotState() {
    // C save_msghistory() -> getmsghistory() flushes the pending topline
    // into the ring before the messages are written out.
    rememberToplines();
    return {
        version: SAVE_VERSION,
        state: copyPersistentState(game),
    };
}
// C save.c:dosave()
export async function dosave() {
    // C save.c:dosave() clears WIN_MESSAGE before asking and after either
    // answer. Acknowledgment alone leaves the seen question on tty.
    clearMessageWindow();
    const answer = await promptYesNo('Really save?');
    clearMessageWindow();
    if (answer !== 'y') {
        if (game.multi > 0)
            nomul(0, game);
        game.context.move = 0;
        return;
    }
    await pline('Saving...');
    if (!await writeSave(game.storage, saveKey(game.plname), true, 'ask')) {
        await docrt();
        game.context.move = 0;
        return;
    }
    game.program_state.savefile_completed
        = (game.program_state.savefile_completed || 0) + 1;
    game.u.uhp = -1;
    // C save.c:dosave() displays WIN_MESSAGE so the "Saving..." line is
    // seen, then exit_nhwindows("Be seeing you...") tears the windows down
    // (wintty.c:tty_exit_nhwindows() -> tty_suspend_nhwindows(): settty
    // clears the screen and raw-prints the goodbye), and the native
    // nh_terminate exit that follows never re-enters the port.
    tty_exit_nhwindows('Be seeing you...');
    game.program_state.gameover = true;
    game.context.move = 0;
}
// Port only: writes a snapshot under the player's storage key.
export async function saveGame(storage = game.storage) {
    return await writeSave(storage, saveKey(game.plname), true, 'replace');
}
// Port only: writes the error snapshot under its own key.
export async function saveErrorGame(storage = game.storage) {
    return await writeSave(storage, saveKey(game.plname, ERROR_SAVE_PREFIX), false, 'replace');
}
// Port only: checks storage for an existing error snapshot.
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
    const question = 'Start a new game instead?';
    return await promptChoice(question, ['y', 'n', 'q'], 'n', { visibleChoices: 'yn' }) === 'y';
}
// C save.c:savemonchn(): forget_temple_entry() for every priest and
// the dead-monster purge, applied to live, cached, and migrating levels
// before the graph is serialized.
function prepareMonstersForSave() {
    const levels = [game.level, ...[...(game._levelCache?.values() ?? [])].map(cached => cached.level)];
    for (const level of levels) {
        if (!level)
            continue;
        purgeDeadMonsters(level);
        for (const monster of level.monsters)
            if (monster.ispriest)
                forgetTempleEntry(monster);
    }
    for (const monster of game._migratingMonsters ?? [])
        if (monster.ispriest)
            forgetTempleEntry(monster);
    if (game.u.usteed?.ispriest)
        forgetTempleEntry(game.u.usteed);
}
// Part of C save.c:dosave0(): the calendar-dependent luck reversal.
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
// C save.c:dosave0().
async function writeSave(storage, key, reportFailure, overwrite) {
    game.program_state.saving = (game.program_state.saving || 0) + 1;
    let saved = false;
    try {
        // C dosave0() finishes interrupted actions even if overwrite is refused.
        game.u.invulnerable = false;
        await doneObjectCleanup();
        if (storage?.setItem && (overwrite === 'replace' || await confirmSaveOverwrite(storage, key))) {
            // savemonchn() resets temple visits only when saving proceeds.
            prepareMonstersForSave();
            currentLuaLifecycle().syncVariables(game);
            const luck = undoDateLuck();
            try {
                rewindEngravingsForSave(game.level);
                for (const cached of game._levelCache?.values() ?? [])
                    rewindEngravingsForSave(cached.level);
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
// Part of C save.c:dosave0(): the overwrite question.
// C dosave0() asks after interrupted-action cleanup, before saving level data.
async function confirmSaveOverwrite(storage, key) {
    const previous = storage.getItem?.(key);
    if (previous === undefined || previous === null)
        return true;
    clearMessageWindow();
    await plineWithContinuation('There seems to be an old save file.');
    return await promptYesNo('Overwrite the old file?') === 'y';
}
//# sourceMappingURL=save.js.map