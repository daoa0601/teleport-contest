// save.js — Web-Storage-backed save and restore.
// C refs: save.c and restore.c.

import { resetErinys } from './monster_data.js';
import { game } from './gstate.js';
import { PanicTermination } from './panic_termination.js';
import { clearMessageWindow, displayMessageWindow, docrt, pline, plineWithContinuation, rawPrint } from './display.js';
import { doneObjectCleanup } from './object_cleanup.js';
import { restoreSavedLightSources } from './light.js';
import { promptChoice, promptYesNo } from './query.js';
import { requireInitializedHero } from './hero_types.js';
import type { GameMap } from './game.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { encodeSavedGraph } from './saved_graph.js';
import { decodeSavedGame } from './persistent_state_validation.js';
import type { SavedGame } from './persistent_state_validation.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { copyPersistentState, restorePersistentState, SAVE_VERSION } from './state_schema.js';
import { rollQuestFigureGenders } from './startup.js';
import type { PersistentState } from './state_schema.js';
import type { StorageBackend } from './storage.js';
import { restoreMonsterWormHeads, validMonsterWormBodies } from './monster_worm.js';
import { resolveDungeonIdentities } from './dungeon.js';
import { restoreMonsterInventoryOwnership } from './monster_inventory.js';
import { purgeDeadMonsters } from './monster_level_departure.js';
import { FULL_MOON, LUCKMAX, LUCKMIN, M_AP_NOTHING, Upolyd } from './const.js';
import { vision_reset_new_level } from './vision.js';
import { rewindEngravingsForSave, restoreEngravings } from './engrave.js';
import { weaponNeedsBashingMessage } from './weapon_type.js';
import { GRAPPLING_HOOK, PICK_AXE } from './object_data.js';
import { forgetTempleEntry } from './priest.js';
import { restoreElementalBubbles } from './elemental.js';
import { restoreLevelRegions } from './regions.js';
import { oinit } from './mklev.js';
import { restoreScheduledLevelChange } from './level_change.js';
import { recorderRestoredTime } from './calendar.js';

const SAVE_PREFIX = 'teleport-save:';
const ERROR_SAVE_PREFIX = 'teleport-error-save:';

type SaveStorage = Pick<StorageBackend, 'setItem'>;
type RestoreStorage = Pick<StorageBackend, 'getItem'>
    & Partial<Pick<StorageBackend, 'removeItem'>>;

function saveKey(name: string | null | undefined, prefix = SAVE_PREFIX): string {
    return `${prefix}${String(name || 'player').toLowerCase()}`;
}

function snapshotState(): SavedGame {
    return {
        version: SAVE_VERSION,
        state: copyPersistentState(game),
    };
}

function restoreLevelMonsters(level: GameMap, moves: number): void {
    restoreEngravings(level, moves);
    if (!validMonsterWormBodies(level)) throw new Error('Invalid saved worm bodies');
    restoreMonsterWormHeads(level);
    for (const monster of level.monsters) restoreMonsterInventoryOwnership(monster);
}

function restoreSavedMonsters(state: PersistentState): void {
    if (state.level) restoreLevelMonsters(state.level, state.moves);
    for (const cached of state._levelCache?.values() ?? [])
        restoreLevelMonsters(cached.level, state.moves);
    for (const monster of state._migratingMonsters || [])
        restoreMonsterInventoryOwnership(monster);
    if (state.u.usteed) restoreMonsterInventoryOwnership(state.u.usteed);
}

export async function dosave(): Promise<void> {
    // C save.c:dosave() clears WIN_MESSAGE before asking and after either
    // answer. Acknowledgment alone leaves the seen question on tty.
    clearMessageWindow();
    const answer = await promptYesNo('Really save?');
    clearMessageWindow();
    if (answer !== 'y') {
        if (game.multi > 0) endVoluntaryMultiTurn(game);
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

export async function saveGame(
    storage: SaveStorage | null | undefined = game.storage,
): Promise<boolean> {
    return await writeSave(storage, saveKey(game.plname), true);
}

export async function saveErrorGame(
    storage: SaveStorage | null | undefined = game.storage,
): Promise<boolean> {
    return await writeSave(storage, saveKey(game.plname, ERROR_SAVE_PREFIX), false);
}

export function hasErrorSave(
    name: string | null | undefined,
    storage: Pick<StorageBackend, 'getItem'> | null | undefined = game.storage,
): boolean {
    try {
        return !!storage?.getItem
            && storage.getItem(saveKey(name, ERROR_SAVE_PREFIX)) !== null;
    } catch (error) {
        if (error instanceof PanicTermination) throw error;
        return false;
    }
}

// C unixunix.c:ask_about_panic_save(). The error snapshot is kept either way.
export async function askAboutPanicSave(): Promise<boolean> {
    await plineWithContinuation('There is no regular save file but there is a panic one.');
    await plineWithContinuation('It might be recoverable with demi-divine intervention.');
    const question = 'Start a new game instead?';
    return await promptChoice(question, ['y', 'n', 'q'], 'n', { visibleChoices: 'yn' }) === 'y';
}

async function prepareGameForSave(): Promise<void> {
    game.u.invulnerable = false;
    await doneObjectCleanup();
    const levels = [game.level, ...[...(game._levelCache?.values() ?? [])].map(cached => cached.level)];
    for (const level of levels) {
        if (!level) continue;
        purgeDeadMonsters(level);
        for (const monster of level.monsters)
            if (monster.ispriest) forgetTempleEntry(monster);
    }
    for (const monster of game._migratingMonsters ?? [])
        if (monster.ispriest) forgetTempleEntry(monster);
    if (game.u.usteed?.ispriest) forgetTempleEntry(game.u.usteed);
}

// C save.c dosave0(): undo the date-dependent luck that
// moveloop_preamble() applied at startup; restoring applies it again.
function undoDateLuck(): number {
    const before = game.u.uluck || 0;
    let luck = before;
    if (game.flags.moonphase === FULL_MOON) luck = Math.max(LUCKMIN, luck - 1);
    if (game.flags.friday13) luck = Math.min(LUCKMAX, luck + 1);
    game.u.uluck = luck;
    return before;
}

async function writeSave(
    storage: SaveStorage | null | undefined, key: string, reportFailure: boolean,
): Promise<boolean> {
    game.program_state.saving = (game.program_state.saving || 0) + 1;
    let saved = false;
    try {
        await prepareGameForSave();
        if (storage?.setItem) {
            currentLuaLifecycle().syncVariables(game);
            const luck = undoDateLuck();
            try {
                rewindEngravingsForSave(game.level);
                for (const cached of game._levelCache?.values() ?? [])
                    rewindEngravingsForSave(cached.level);
                storage.setItem(key, encodeSavedGraph(snapshotState()));
            } catch (error) {
                // The port keeps playing after a failed save; C has exited.
                game.u.uluck = luck;
                throw error;
            }
            game.program_state.something_worth_saving = false;
            saved = true;
        }
    } catch (error) {
        if (error instanceof PanicTermination) throw error;
        if (reportFailure) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Unable to save game: ${message}`);
        }
    }
    game.program_state.saving--;
    return saved;
}

// C restore.c:restgamestate() reports its refusal through You() and returns
// FALSE; dorecover() then waits for the message to be dismissed and discards
// the save file. The synchronous restoreGame() can only report the refusal,
// so the caller completes that dialogue through dismissUnhealthyRestore().
let restoreRefusal: 'unhealthy' | null = null;

export function restoreRefusedAsUnhealthy(): boolean {
    return restoreRefusal === 'unhealthy';
}

export async function dismissUnhealthyRestore(
    name: string | null | undefined,
    storage: RestoreStorage | null | undefined = game.storage,
): Promise<void> {
    if (restoreRefusal !== 'unhealthy') return;
    restoreRefusal = null;
    await pline('You were not healthy enough to survive restoration.');
    await displayMessageWindow();
    storage?.removeItem?.(saveKey(name));
}

export function restoreGame(
    name: string | null | undefined,
    storage: RestoreStorage | null | undefined = game.storage,
): boolean {
    restoreRefusal = null;
    if (!storage?.getItem) return false;
    const key = saveKey(name);
    try {
        const encoded = storage.getItem(key);
        if (!encoded) return false;
        const snapshot = decodeSavedGame(encoded);
        if (!snapshot.state.level || !snapshot.state.urole || !snapshot.state.urace)
            return false;
        requireInitializedHero(snapshot.state.u);
        // C restgamestate() reads the saved flags and runs role_init()
        // before it reads the hero, so the quest gender rolls are spent
        // even when the save is then refused; installing the snapshot
        // afterwards overwrites the rolled values, as Sfi_q_score() does.
        rollQuestFigureGenders(snapshot.state.urole, { ldrgend: 0, nemgend: 0 });
        // C restgamestate() refuses a save whose hero was not healthy enough
        // to survive restoration, and dorecover() then waits for the message
        // to be dismissed before discarding the save file and starting over.
        // restoreGame() is synchronous, so the caller owns that dialogue.
        const savedHero = snapshot.state.u;
        if ((savedHero.uhp ?? 0) <= 0
            && (!Upolyd(savedHero) || (savedHero.mh ?? 0) <= 0)) {
            restoreRefusal = 'unhealthy';
            return false;
        }
        restoreSavedMonsters(snapshot.state);
        // C restgamestate() reads ubirthday back from its local-time text.
        const birthday = snapshot.state.ubirthday === undefined
            ? undefined : recorderRestoredTime(snapshot.state.ubirthday);
        restorePersistentState(game, snapshot.state);
        if (birthday !== undefined) game.ubirthday = birthday;
        resetRestoredInstanceState();
        resetErinys(game.u.ualign?.abuse ?? 0);
        resolveDungeonIdentities(game);
        // C restnames() reloads objects[].oc_prob as saved; those gem
        // probabilities are always oinit()'s values for the saved u.uz.
        oinit();
        restoreScheduledLevelChange();
        restoreElementalBubbles();
        // restgamestate() rebuilds the first-use reminder from the restored
        // weapon, treating applied tools conservatively as improvised weapons.
        const weapon = game.uwep || game.u.uwep;
        game._unweapon = weaponNeedsBashingMessage(weapon, game)
            || weapon?.otyp === PICK_AXE || weapon?.otyp === GRAPPLING_HOOK;
        game.multi = 0;
        game.warn_obj_cnt = 0;
        game._magicKeyTrapWarningCount = 0;
        game._monsterSwallower = null;
        game._monsterEngulf = null;
        game._commandCount = 0;
        game._commandKey = 0;
        game._repeatCommands = [];
        game._inDoAgain = false;
        game._movementAttempt = null;
        game._occupation = null;
        game._lockAttempt = null;
        game._runState = null;
        game._heroTimePending = false;
        game._kickedLoc = null;
        game._cannedCommands = [];
        game._afterMove = null;
        game._armorTheft = null;
        delete game._helplessRunmodeDelayPending;
        game.context.move = 0;
        // Saved flags govern future resets; the current Space binding still
        // belongs to this process until an option change reconciles it.
        game.commandBindings.setRestOnSpace(!!game.flags?.rest_on_space, { initial: true });
        game._emptyShops = [];
        game._shopFollowMessageTurn = 0;
        game.program_state = { something_worth_saving: true };
        game.fmon = game.level?.monsters[0] ?? null;
        restoreLevelRegions(game, 0);
        // C restores the hero's carried and migrating lights while reading
        // the game state (restore.c:655) and then pushes the current
        // level's own batch back in front while loading the level
        // (restore.c:1145); each batch returns reversed from its saved
        // newest-first order.
        restoreSavedLightSources(game);
        // C restore.c:dorecover() rebuilds transient vision after loading the
        // level. No old sight bits may suppress its first terrain repaint.
        vision_reset_new_level();
        game.vision_full_recalc = 1;
        storage.removeItem?.(key);
        return true;
    } catch (error) {
        if (error instanceof PanicTermination) throw error;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Unable to restore game: ${message}`);
        return false;
    }
}

// C starts a restored game in a new process. These values belong to decl.c
// instance globals or function statics, rather than the saved context or hero.
// Clear them here too when callers restore into the existing live state.
function resetRestoredInstanceState(): void {
    // restgamestate() rebuilds youmonst from the saved species; its disguise
    // belongs to that unsaved monster structure, not the saved native u.
    game.u.m_ap_type = M_AP_NOTHING;
    game.u.mappearance = 0;
    game._lastInvNr = 51; // decl.c starts the rotating letter order before 'a'.
    game._heroActionSeq = game.moves * 8; // restgamestate() recalculates hero_seq.
    game._encumbranceLevel = 0;
    // Resuming skips the new-game branch of moveloop_preamble().
    game._moveloopStarted = true;
    delete game._lastPushedBoulder;
    delete game._lastBoulderPushMove;
    delete game._farMonsterNoise;
    delete game._monsterNoiseTime;
    delete game._prevDecorType;
    delete game._bubbleTraversalUp;
    delete game._rndmonstAlignment;
    delete game._rndmonstAlignmentMove;
    delete game._runtimeVersionInfoInitialized;

    // A panic save can interrupt helplessness. Native multi, its completion
    // message, and its callback are all unsaved, including prayer/digestion data.
    delete game._helplessTurns;
    delete game._helplessReason;
    delete game._helplessDoneMessage;
    delete game._digestedMonsterSpecies;
    delete game._mimicMealMessage;
    delete game._prayerAlignment;
    delete game._prayerTrouble;
    delete game._prayerOutcome;
    delete game._queuedHelplessRecoveryMessage;

    delete game._bonesSaved;
    delete game._characterPickerUsed;
    delete game._initialPwBonus;
    delete game._lastDemigodAggravation;
    delete game._lastDemigodNasty;
    delete game._unresolvedDemigodIntervention;
    delete game._preserveLeadingStyledBlanks;
    delete game._restoredBones;
    delete game._specialLevelPrototype;
    delete game._startingEffectsApplied;
    delete game._tutorialDeclined;
    delete game.in_mklev;
    delete game.in_mk_themerooms;
    delete game.made_branch;
    delete game.smeq;
    delete game.splev_align;
    delete game.targetX;
    delete game.targetY;
    delete game.vault_x;
    delete game.vault_y;
    delete game.were_changes;
    // Instance options (symset, nethackrc, preferred_pet, tutorial_set_in_config)
    // retain the values parsed for the current process before restore.
}
