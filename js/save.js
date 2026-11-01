// save.js — Web-Storage-backed save and restore.
// C refs: save.c and restore.c.
import { MONSTER_FLAGS1, MONSTER_SYMBOL, resetErinys } from './monster_data.js';
import { game, requireLiveGame } from './gstate.js';
import { PanicTermination } from './panic_termination.js';
import { clearMessageWindow, displayMessageWindow, rememberToplines } from './tty_topline.js';
import { docrt, reglyphSymbolSet } from './display.js';
import { pline, plineWithContinuation, rawPrint } from './pline.js';
import { doneObjectCleanup } from './object_cleanup.js';
import { restoreSavedLightSources } from './light.js';
import { promptChoice, promptYesNo } from './query.js';
import { requireInitializedHero } from './hero_types.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { encodeSavedGraph, isSavedRecord } from './saved_graph.js';
import { decodeSavedGame } from './persistent_state_validation.js';
import { clearCannedCommands, endVoluntaryMultiTurn } from './command_state.js';
import { copyPersistentState, restorePersistentState, SAVE_VERSION } from './state_schema.js';
import { rollQuestFigureGenders } from './startup.js';
import { resolveDungeonIdentities } from './dungeon.js';
import { purgeDeadMonsters, attemptMonsterRestrap, hideMonsterUnder } from './mon.js';
import { restoreMonsterInventoryOwnership } from './mkobj.js';
import { FULL_MOON, LUCKMAX, LUCKMIN, M_AP_NOTHING, Upolyd, AM_CHAOTIC, AM_LAWFUL, AM_NEUTRAL, AM_NONE, COULD_SEE, IN_SIGHT, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPMASK, M_AP_TYPE, MAX_NUM_WORMS, MON_FLOOR, NON_PM, ismnum, isok, } from './const.js';
import { vision_reset_new_level } from './vision.js';
import { rewindEngravingsForSave, restoreEngravings } from './engrave.js';
import { weaponNeedsBashingMessage } from './weapon_type.js';
import { GRAPPLING_HOOK, PICK_AXE, SLIME_MOLD } from './object_data.js';
import { forgetTempleEntry } from './priest.js';
import { restoreElementalBubbles } from './elemental.js';
import { restoreLevelRegions } from './regions.js';
import { oinit } from './o_init.js';
import { restoreScheduledLevelChange } from './level_change.js';
import { recorderRestoredTime } from './calendar.js';
import { restoreSavedTimers } from './object_timers.js';
import { restoreLevelChains } from './level_restore.js';
import { validSavedHeroAlignment } from './character_validation.js';
import { validSavedSpeciesOrNone } from './species_validation.js';
import { arrayOf, boolean, closedFieldsMatch, integer, nullable, optional, string, validateSavedEntity, } from './saved_validation.js';
const SAVE_PREFIX = 'teleport-save:';
const ERROR_SAVE_PREFIX = 'teleport-error-save:';
function saveKey(name, prefix = SAVE_PREFIX) {
    return `${prefix}${String(name || 'player').toLowerCase()}`;
}
function snapshotState() {
    // C save_msghistory() -> getmsghistory() flushes the pending topline
    // into the ring before the messages are written out.
    rememberToplines();
    return {
        version: SAVE_VERSION,
        state: copyPersistentState(game),
    };
}
/**
 * C restore.c:restore_msghistory(): the first restored message purges the
 * session's own ring (keeping its entries), each restored message becomes
 * the current topline in turn, and the final empty call puts the session's
 * messages back on top of the restored ones.
 */
function restoreMessageHistory(saved) {
    if (!saved.length)
        return;
    rememberToplines();
    const session = game._messageHistory.splice(0);
    game._messageHistoryWriteIndex = 0;
    game._messageHistoryCursor = null;
    for (const message of saved) {
        if (!message)
            continue;
        rememberToplines();
        game._toplines = message;
    }
    for (const message of session) {
        rememberToplines();
        game._toplines = message;
    }
}
function restoreLevelMonsters(level, moves) {
    restoreLevelPetHistory(level, 0);
    restoreEngravings(level, moves);
    if (!validMonsterWormBodies(level))
        throw new Error('Invalid saved worm bodies');
    restoreMonsterWormHeads(level);
    for (const monster of level.monsters)
        restoreMonsterInventoryOwnership(monster);
}
function restoreSavedMonsters(state) {
    if (state.level)
        restoreLevelMonsters(state.level, state.moves);
    for (const cached of state._levelCache?.values() ?? []) {
        restoreLevelMonsters(cached.level, state.moves);
        restoreObjectPetHistory(cached.billObjects ?? [], 0);
    }
    for (const monster of state._migratingMonsters || []) {
        restoreMonsterPetHistory(monster, 0);
        restoreObjectPetHistory(monster.minvent || monster.inventory || [], 0);
        restoreMonsterInventoryOwnership(monster);
    }
    if (state.u.usteed) {
        restoreMonsterPetHistory(state.u.usteed, 0);
        restoreMonsterInventoryOwnership(state.u.usteed);
    }
    restoreObjectPetHistory([
        ...state.inventory, ...state.migratingObjects ?? [], ...state.billObjects ?? [],
    ], 0);
}
export async function dosave() {
    // C save.c:dosave() clears WIN_MESSAGE before asking and after either
    // answer. Acknowledgment alone leaves the seen question on tty.
    clearMessageWindow();
    const answer = await promptYesNo('Really save?');
    clearMessageWindow();
    if (answer !== 'y') {
        if (game.multi > 0)
            endVoluntaryMultiTurn(game);
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
    // (term_end_screen clears the screen, settty raw-prints the goodbye
    // with a trailing newline), and nh_terminate() never returns here.
    game.program_state.windows_exited = true;
    game.nhDisplay?.clearScreen();
    rawPrint('Be seeing you...');
    game.program_state.gameover = true;
    game.context.move = 0;
}
export async function saveGame(storage = game.storage) {
    return await writeSave(storage, saveKey(game.plname), true, 'replace');
}
export async function saveErrorGame(storage = game.storage) {
    return await writeSave(storage, saveKey(game.plname, ERROR_SAVE_PREFIX), false, 'replace');
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
    const question = 'Start a new game instead?';
    return await promptChoice(question, ['y', 'n', 'q'], 'n', { visibleChoices: 'yn' }) === 'y';
}
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
// C dosave0() asks after interrupted-action cleanup, before saving level data.
async function confirmSaveOverwrite(storage, key) {
    const previous = storage.getItem?.(key);
    if (previous === undefined || previous === null)
        return true;
    clearMessageWindow();
    await plineWithContinuation('There seems to be an old save file.');
    return await promptYesNo('Overwrite the old file?') === 'y';
}
// C restore.c:restgamestate() reports its refusal through You() and returns
// FALSE; dorecover() then waits for the message to be dismissed and discards
// the save file. The synchronous restoreGame() can only report the refusal,
// so the caller completes that dialogue through dismissUnhealthyRestore().
let restoreRefusal = null;
let retainedSave = null;
// C unixmain.c asks after dorecover()'s welcome; ordinary games consume
// their file inside dorecover(), while wizard and explore games may keep it.
export async function askKeepRestoredSave() {
    const restored = retainedSave;
    retainedSave = null;
    if (!restored)
        return;
    if (await promptYesNo('Do you want to keep the save file?') === 'n')
        restored.storage.removeItem?.(restored.key);
}
export function restoreRefusedAsUnhealthy() {
    return restoreRefusal === 'unhealthy';
}
export async function dismissUnhealthyRestore(name, storage = game.storage) {
    if (restoreRefusal !== 'unhealthy')
        return;
    restoreRefusal = null;
    await pline('You were not healthy enough to survive restoration.');
    await displayMessageWindow();
    storage?.removeItem?.(saveKey(name));
}
export async function restoreGame(name, storage = game.storage) {
    restoreRefusal = null;
    retainedSave = null;
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
        // C dorecover() refills the tty recall ring after the game state;
        // capture this session's messages before the snapshot replaces them.
        const sessionHistory = game._messageHistory;
        const sessionToplines = game._toplines;
        // C restgamestate() reads ubirthday back from its local-time text.
        const birthday = snapshot.state.ubirthday === undefined
            ? undefined : recorderRestoredTime(snapshot.state.ubirthday);
        restorePersistentState(game, snapshot.state);
        if (birthday !== undefined)
            game.ubirthday = birthday;
        resetRestoredInstanceState();
        resetErinys(game.u.ualign?.abuse ?? 0);
        resolveDungeonIdentities(game);
        // C restnames() reloads objects[].oc_prob as saved; those gem
        // probabilities are always oinit()'s values for the saved u.uz.
        oinit();
        game._messageHistory = sessionHistory;
        game._toplines = sessionToplines;
        restoreMessageHistory(snapshot.state._messageHistory ?? []);
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
        clearCannedCommands();
        game._afterMove = null;
        game._armorTheft = null;
        game.context.move = 0;
        // Saved flags govern future resets; the current Space binding still
        // belongs to this process until an option change reconciles it.
        game.commandBindings.setRestOnSpace(!!game.flags?.rest_on_space, { initial: true });
        game._emptyShops = [];
        game._shopFollowMessageTurn = 0;
        game.program_state = { something_worth_saving: true };
        game.fmon = game.level?.monsters[0] ?? null;
        game.fruits?.reverse(); // C loadfruitchn() prepends saved entries.
        game.stairs = restoreLevelChains(snapshot.state.level, game.stairs);
        await restoreLevelRegions(game, 0);
        // C restores the hero's carried and migrating lights while reading
        // the game state (restore.c:655) and then pushes the current
        // level's own batch back in front while loading the level
        // (restore.c:1145); each batch returns reversed from its saved
        // newest-first order.
        restoreSavedLightSources(game);
        restoreSavedTimers(game);
        // dorecover() assigns Rogue symbols again before the first redraw.
        reglyphSymbolSet();
        // C restore.c:dorecover() rebuilds transient vision after loading the
        // level. No old sight bits may suppress its first terrain repaint.
        vision_reset_new_level();
        game.vision_full_recalc = 1;
        if (game.flags.debug || game.flags.explore || game.discover)
            retainedSave = { storage, key };
        else
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
// C starts a restored game in a new process. These values belong to decl.c
// instance globals or function statics, rather than the saved context or hero.
// Clear them here too when callers restore into the existing live state.
function resetRestoredInstanceState() {
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
    delete game._monsterGenerationOrder;
    delete game._runtimeVersionInfoInitialized;
    delete game.shownSymbols;
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
    delete game._bonesSaved;
    delete game._characterPickerUsed;
    delete game._initialPwBonus;
    delete game._lastDemigodAggravation;
    delete game._lastDemigodNasty;
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
// ---------------------------------------------------------------------------
// C save.c:savemon() and restore.c:restmon(): saved pet extensions.
// ---------------------------------------------------------------------------
export function restoreLevelPetHistory(level, elapsed) {
    for (const monster of level.monsters) {
        restoreMonsterPetHistory(monster, elapsed);
        restoreObjectPetHistory(monster.minvent || monster.inventory || [], elapsed);
    }
    for (const column of level.objects)
        for (const pile of column ?? [])
            restoreObjectPetHistory(pile ?? [], elapsed);
    restoreObjectPetHistory(level.buriedObjects ?? [], elapsed);
}
export function restoreMonsterPetHistory(monster, elapsed) {
    const pet = monster.edog || monster.mextra?.edog;
    if (!pet)
        return;
    // Only these two pet times are saved relative to moves. Whistle time
    // remains absolute, and catch-up separately reduces tameness.
    pet.droptime += elapsed;
    pet.hungrytime += elapsed;
    if (pet.apport <= 0)
        pet.apport = 1;
    monster.edog = pet;
    if (monster.mextra)
        monster.mextra.edog = pet;
    else
        monster.mextra = { edog: pet };
}
export function restoreObjectPetHistory(objects, elapsed) {
    for (const object of objects) {
        if (object.oextra?.omonst)
            restoreMonsterPetHistory(object.oextra.omonst, elapsed);
        restoreObjectPetHistory(object.contents ?? [], elapsed);
    }
}
// ---------------------------------------------------------------------------
// C restore.c:restmon(): saved monster validation.
// ---------------------------------------------------------------------------
const monsterFlag = (value) => typeof value === 'boolean' || value === 0 || value === 1;
const monsterPosition = (value) => closedFieldsMatch(value, { x: integer, y: integer });
const wormSegment = (value) => closedFieldsMatch(value, { x: integer, y: integer, onMap: optional(boolean) });
const monsterHomeLevel = (value) => closedFieldsMatch(value, { dnum: integer, dlevel: integer });
const pet = (value) => closedFieldsMatch(value, {
    parentmid: optional(integer),
    droptime: integer,
    dropdist: integer,
    apport: integer,
    whistletime: integer,
    hungrytime: integer,
    ogoal: monsterPosition,
    abuse: integer,
    revivals: integer,
    mhpmax_penalty: integer,
    killed_by_u: monsterFlag,
});
const minion = (value) => closedFieldsMatch(value, {
    min_align: integer,
    renegade: monsterFlag,
    parentmid: optional(integer),
});
const priest = (value) => closedFieldsMatch(value, {
    parentmid: integer,
    cheapskate_count: optional(integer),
    shroom: integer,
    shralign: integer,
    shrpos: monsterPosition,
    shrlevel: monsterHomeLevel,
    intone_time: integer,
    enter_time: integer,
    peaceful_time: integer,
    hostile_time: integer,
});
const bill = (value) => closedFieldsMatch(value, {
    bo_id: integer,
    bquan: integer,
    price: integer,
    useup: monsterFlag,
});
const shopkeeper = (value) => closedFieldsMatch(value, {
    shoproom: integer,
    shoptype: integer,
    shoplevel: monsterHomeLevel,
    shd: monsterPosition,
    shk: monsterPosition,
    parentmid: optional(integer),
    shknam: optional(string),
    bill: optional(arrayOf(bill)),
    billct: optional(integer),
    billUnavailable: optional(boolean),
    credit: optional(integer),
    debit: optional(integer),
    loan: optional(integer),
    robbed: optional(integer),
    surcharge: optional(monsterFlag),
    following: optional(monsterFlag),
    customer: optional(string),
    visitct: optional(integer),
    dismiss_kops: optional(boolean),
    break_seq: optional(integer),
    seq_peaceful: optional(monsterFlag),
});
const corridor = (value) => closedFieldsMatch(value, {
    x: integer, y: integer, typ: integer, flags: integer,
});
function guard(context) {
    return (value) => closedFieldsMatch(value, {
        gdlevel: monsterHomeLevel,
        gddone: monsterFlag,
        ogx: integer,
        ogy: integer,
        gdx: integer,
        gdy: integer,
        vault: nullable(context.room),
        warncnt: integer,
        fcbeg: integer,
        fcend: integer,
        fakecorr: arrayOf(corridor),
        dropgoldcnt: integer,
        witness: optional(integer),
    });
}
const bones = (value) => closedFieldsMatch(value, {
    parentmid: integer,
    role: integer,
    race: integer,
    oldalign: validSavedHeroAlignment,
    deathlevel: integer,
    luck: integer,
    mnum: ismnum,
    female: boolean,
    demigod: boolean,
    crowned: boolean,
});
function extra(representation) {
    return (value) => closedFieldsMatch(value, {
        mgivenname: optional(string),
        mcorpsenm: optional(representation),
        edog: optional(pet),
        emin: optional(minion),
        epri: optional(priest),
        eshk: optional(shopkeeper),
        ebones: optional(bones),
    });
}
function appearanceType(value) {
    return isSavedRecord(value) && integer(value.m_ap_type)
        ? value.m_ap_type & M_AP_TYPMASK : 0;
}
// makemon.c:set_mimic_sym() also stores a fruit ID or altar mask here.
// Neither overload is a monster index, despite the field's native name.
function mimicRepresentation(value) {
    if (!isSavedRecord(value))
        return validSavedSpeciesOrNone;
    const type = appearanceType(value);
    if (type === M_AP_OBJECT && value.mappearance === SLIME_MOLD)
        return (entry) => entry === NON_PM
            || integer(entry) && entry >= 1 && entry <= 127;
    if (type === M_AP_FURNITURE && value.mappearance === 33) // S_altar
        return (entry) => entry === NON_PM || entry === AM_NONE
            || entry === AM_CHAOTIC || entry === AM_NEUTRAL || entry === AM_LAWFUL;
    return validSavedSpeciesOrNone;
}
function monsterFields(value, context) {
    const representation = mimicRepresentation(value);
    return {
        mx: integer,
        my: integer,
        mstate: optional(integer),
        headOnMap: optional(boolean),
        wormSegments: optional(arrayOf(wormSegment)),
        // Saving is unavailable while cutworm is awaiting a message pager.
        wormDetachedSegments: (entry) => entry === undefined,
        m_id: integer,
        mnum: ismnum,
        m_lev: integer,
        mhp: integer,
        mhpmax: integer,
        female: boolean,
        mux: optional(integer),
        muy: optional(integer),
        mcanmove: monsterFlag,
        mcansee: monsterFlag,
        mgenmklev: optional(boolean),
        msleeping: optional(monsterFlag),
        mpeaceful: monsterFlag,
        minvent: optional(arrayOf(context.object)),
        inventory: optional(arrayOf(context.object)),
        hasInventory: optional(boolean),
        cham: optional(validSavedSpeciesOrNone),
        dead: optional(boolean),
        lightRemoved: optional(boolean),
        movement: optional(integer),
        mmove: optional(integer),
        mspeed: optional(integer),
        permspeed: optional(integer),
        symbol: optional(string),
        color: optional(integer),
        mstrategy: optional(integer),
        mgoal: optional(monsterPosition),
        mtrapseen: optional(integer),
        mtrack: optional(arrayOf(monsterPosition)),
        mtame: optional(integer),
        pet: optional(boolean),
        meating: optional(integer),
        mlstmv: optional(integer),
        mspec_used: optional(integer),
        mfrozen: optional(integer),
        mblinded: optional(integer),
        mfleetim: optional(integer),
        mcan: optional(monsterFlag),
        mstun: optional(monsterFlag),
        mconf: optional(monsterFlag),
        mflee: optional(monsterFlag),
        mtrapped: optional(monsterFlag),
        mburied: optional(monsterFlag),
        mleashed: optional(monsterFlag),
        mrevived: optional(monsterFlag),
        mcloned: optional(monsterFlag),
        mavenge: optional(monsterFlag),
        meverseen: optional(monsterFlag),
        mtemplit: optional(monsterFlag),
        // save.c:savemon() writes the raw struct monst (Sfo_monst), so the
        // spot_monsters latch survives save, restore, and bones.
        mspotted: optional(monsterFlag),
        mundetected: optional(monsterFlag),
        minvis: optional(monsterFlag),
        perminvis: optional(monsterFlag),
        invis_blkd: optional(monsterFlag),
        seen_resistance: optional(integer),
        mintrinsics: optional(integer),
        mextrinsics: optional(integer),
        defendedSleep: optional(boolean),
        defendedDisintegration: optional(boolean),
        seenMagicResistance: optional(boolean),
        misc_worn_check: optional(integer),
        weaponCheck: optional(integer),
        mw: optional(nullable(context.object)),
        saddle: optional(nullable(context.object)),
        saddled: optional(boolean),
        mwandexp: optional(boolean),
        m_ap_type: optional(integer),
        mappearance: appearanceType(value) === M_AP_MONSTER ? ismnum : optional(integer),
        mcorpsenm: optional(representation),
        mgivenname: optional(string),
        name: optional(string),
        givenName: optional(string),
        iswiz: optional(monsterFlag),
        isgd: optional(monsterFlag),
        isshk: optional(monsterFlag),
        ispriest: optional(monsterFlag),
        isminion: optional(monsterFlag),
        questLeader: optional(boolean),
        waiting: optional(boolean),
        malign: integer,
        maligntyp: optional(integer),
        edog: optional(pet),
        emin: optional(minion),
        epri: optional(priest),
        eshk: optional(shopkeeper),
        mextra: optional(extra(representation)),
        _egd: optional(guard(context)),
        wormno: optional(integer),
        wormHead: optional(nullable(monsterPosition)),
        wormGrowTime: optional(integer),
        migrating: optional(boolean),
        migratingWormSegments: optional(integer),
        migrationMode: optional(integer),
        migrationArrival: optional(integer),
        migrationFlags: optional(integer),
        migflags: optional(integer),
        migrationSource: optional(monsterPosition),
        migrationOrigin: optional(monsterHomeLevel),
        migrationDestination: optional(monsterHomeLevel),
    };
}
export function validSavedMonster(value, context) {
    return validateSavedEntity(value, 'monster', context, monsterFields(value, context));
}
export function validSavedMonsterTraits(value, context) {
    const { minvent, inventory, mw, wormSegments, wormDetachedSegments, wormHead, wormGrowTime, lightRemoved, headOnMap, ...fields } = monsterFields(value, context);
    return validateSavedEntity(value, 'savedMonster', context, fields);
}
// ---------------------------------------------------------------------------
// C restore.c:getlev(): rechecked cover and a fresh hiding attempt for a
// restored monster. The native hiding decisions themselves live in mon.ts
// (restrap()/hideunder()/maybe_unhide_at()) and monmove.ts
// (can_hide_under_obj()).
// ---------------------------------------------------------------------------
const M1_CONCEAL = 0x80, M1_HIDE = 0x100;
const S_EEL = 57, S_MIMIC = 13;
// C restore.c:getlev() rechecks existing cover before catch-up and shape
// changes. A saved mundetected bit alone does not establish valid cover.
export async function restoreMonsterCover(monster, state = game) {
    if (monster !== state.u.usteed && monster.mundetected
        && ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CONCEAL))
        await hideMonsterUnder(monster, state);
}
// Restored hiders get their attempt before normal vision can expose their spot.
// Only that square's vision bits are hidden, and hideunder sees restored vision.
export async function hideMonsterOnRestore(monster, state = game) {
    requireLiveGame(state);
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const hiderUnder = !!(flags & M1_CONCEAL) || MONSTER_SYMBOL[monster.mnum] === S_EEL;
    if (!(flags & M1_HIDE) && !hiderUnder)
        return;
    if (monster.mundetected || M_AP_TYPE(monster))
        return;
    const row = state.viz_array?.[monster.my];
    const savedVision = row?.[monster.mx];
    if (!row || savedVision === undefined)
        throw new Error('Restoring monster hiding requires an initialized vision square.');
    row[monster.mx] = savedVision & ~(IN_SIGHT | COULD_SEE);
    try {
        if (flags & M1_HIDE)
            await attemptMonsterRestrap(monster, state);
        if (MONSTER_SYMBOL[monster.mnum] === S_MIMIC && !M_AP_TYPE(monster))
            await attemptMonsterRestrap(monster, state);
    }
    finally {
        row[monster.mx] = savedVision;
    }
    if (hiderUnder)
        await hideMonsterUnder(monster, state);
}
// This boundary proves only worm restoration fields, not a complete Monster.
// Full saves and bones retain body identity and deadlines rather than rebuilding them.
export function validMonsterWormBodies(level) {
    if (!isSavedRecord(level) || !Array.isArray(level.monsters))
        return false;
    const monsters = level.monsters;
    const slots = new Set();
    for (const monster of monsters) {
        if (!isSavedRecord(monster)
            || typeof monster.mx !== 'number' || !Number.isInteger(monster.mx)
            || typeof monster.my !== 'number' || !Number.isInteger(monster.my)
            || monster.mstate !== undefined && typeof monster.mstate !== 'number'
            || monster.headOnMap !== undefined && typeof monster.headOnMap !== 'boolean'
            || monster.wormno !== undefined && typeof monster.wormno !== 'number'
            || monster.wormGrowTime !== undefined
                && typeof monster.wormGrowTime !== 'number')
            return false;
        if (!monster.wormno) {
            if (monster.wormHead != null)
                return false;
            if (monster.wormSegments !== undefined
                && (!Array.isArray(monster.wormSegments)
                    || monster.wormSegments.length !== 0))
                return false;
            continue;
        }
        if (!Number.isInteger(monster.wormno)
            || monster.wormno < 1 || monster.wormno >= MAX_NUM_WORMS
            || slots.has(monster.wormno)
            || typeof monster.wormGrowTime !== 'number'
            || !Number.isInteger(monster.wormGrowTime) || monster.wormGrowTime < 0
            || !savedWormPoint(monster.wormHead)
            || (monster.wormHead.x !== 0 && !isok(monster.wormHead.x, monster.wormHead.y))
            || !Array.isArray(monster.wormSegments))
            return false;
        const segments = monster.wormSegments;
        for (const point of segments) {
            if (!savedWormPoint(point)
                || !(point.x === 0 && (monster.mstate ?? MON_FLOOR) !== MON_FLOOR)
                    && !isok(point.x, point.y))
                return false;
        }
        slots.add(monster.wormno);
    }
    return true;
}
function savedWormPoint(value) {
    return isSavedRecord(value)
        && typeof value.x === 'number' && Number.isInteger(value.x)
        && typeof value.y === 'number' && Number.isInteger(value.y)
        && (value.onMap === undefined || typeof value.onMap === 'boolean');
}
export function restoreMonsterWormHeads(level) {
    for (const monster of level.monsters) {
        // The native monster grid is rebuilt from fmon when loading a level.
        delete monster.headOnMap;
        for (const segment of monster.wormSegments ?? [])
            delete segment.onMap;
        if (monster.wormno)
            monster.wormHead = { x: monster.mx, y: monster.my };
    }
}
//# sourceMappingURL=save.js.map