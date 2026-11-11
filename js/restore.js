import { TERRAIN_FALLOUT_MASK, MON_MIGRATING, MON_PARKED } from './const.js';
import { level_status_init } from './gstate.js';
import { updateFloorObjectShopOwnership } from './mkobj.js';
// restore.js — C restore.c in one module: every whole-function restore.c
// port, ordered by its C definition. The synchronous dorecover() flow
// (restoreGame() with the restgamestate() refusal dialogue) stays in save.ts
// beside the save.c side, and the restobjchn()/getlev() bones clock shift
// stays in bones.ts beside its object traversal helpers.
// C refs: restore.c inven_inuse(), restmon(), rest_stairs(), getlev(),
// dorecover()/restgamestate() (restoreGame), and
// restore_msghistory(); mon.c hide_monst(), whose only native caller is
// getlev().
import { game, requireLiveGame } from './gstate.js';
import { saveKey } from './save.js';
import { eachObjectInBonesGraph } from './bones.js';
import { decodeSavedGame } from './persistent_state_validation.js';
import { requireInitializedHero } from './hero_types.js';
import { rollQuestFigureGenders } from './role.js';
import { recorderRestoredTime } from './calendar.js';
import { resolveDungeonIdentities } from './dungeon.js';
import { oinit } from './o_init.js';
import { restoreScheduledLevelChange } from './do.js';
import { restore_waterlevel } from './mkmaze.js';
import { restoreLevelRegions } from './region.js';
import { restoreSavedLightSources } from './light.js';
import { restoreSavedTimers } from './timeout.js';
import { restoreEngravings } from './engrave.js';
import { promptYesNo } from './query.js';
import { displayMessageWindow } from './topl.js';
import { reglyphSymbolSet } from './display.js';
import { vision_reset_new_level } from './vision.js';
import { weaponNeedsBashingMessage } from './wield.js';
import { resetErinys } from './monster_data.js';
import { restoreMonsterInventoryOwnership } from './mon.js';
import { restorePersistentState } from './state_schema.js';
import { cmdq_clear } from './cmd.js';
import { rememberToplines } from './topl.js';
import { pline, plineWithContinuation } from './pline.js';
import { consumeInventoryItem } from './invent.js';
import { objectName, pluralizeObjectNoun } from './objnam.js';
import { deleteTrap } from './trap.js';
import { PanicTermination } from './panic_termination.js';
import { attemptMonsterRestrap, hideMonsterUnder } from './mon.js';
import { monsterHidesUnder } from './mondata.js';
import { MONSTER_SYMBOL } from './monster_data.js';
import { isok } from './cmd.js';
import { AM_CHAOTIC, AM_LAWFUL, AM_NEUTRAL, AM_NONE, ismnum, MAGIC_PORTAL, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPMASK, M_AP_TYPE, MAX_NUM_WORMS, MON_FLOOR, NON_PM, CQ_CANNED, CQ_REPEAT, M_AP_NOTHING, Upolyd, } from './const.js';
import { GRAPPLING_HOOK, PICK_AXE, SLIME_MOLD } from './object_data.js';
import { validSavedHeroAlignment } from './character_validation.js';
import { validSavedSpeciesOrNone } from './species_validation.js';
import { validSavedLightSourcePosition } from './light_validation.js';
import { arrayOf, boolean, closedFieldsMatch, integer, nullable, optional, string, validateSavedEntity, } from './saved_validation.js';
import { isSavedRecord } from './saved_graph.js';
// C restore.c:inven_inuse(). Announce before consuming, so a pager still
// shows the in-use stack until its message is acknowledged.
export async function finishInUseInventory(quietly) {
    for (const object of [...game.inventory]) {
        if (!object.in_use)
            continue;
        if (!quietly) {
            const noun = objectName(object);
            const name = object.quan === 1 ? noun : pluralizeObjectNoun(object, noun);
            await plineWithContinuation(`Finishing off ${name}...`);
        }
        await consumeInventoryItem(object);
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
const shopkeeperData = (value) => closedFieldsMatch(value, {
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
// Port only: field checks for a saved vault guard record.
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
// Port only: field checks for a saved monster extra record.
function extra(representation) {
    return (value) => closedFieldsMatch(value, {
        mgivenname: optional(string),
        mcorpsenm: optional(representation),
        edog: optional(pet),
        emin: optional(minion),
        epri: optional(priest),
        eshk: optional(shopkeeperData),
        ebones: optional(bones),
    });
}
// Port only: reads a saved monster's m_ap_type appearance code.
function appearanceType(value) {
    return isSavedRecord(value) && integer(value.m_ap_type)
        ? value.m_ap_type & M_AP_TYPMASK : 0;
}
// Port only: validates a saved mimic's mappearance payload by its
// appearance type.
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
// Port only: field checks for a saved Monster.
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
        eshk: optional(shopkeeperData),
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
        _lightSeq: optional(integer),
        _lightPosition: optional(validSavedLightSourcePosition),
    };
}
// Port only: full saved Monster validation.
export function validSavedMonster(value, context) {
    return validateSavedEntity(value, 'monster', context, monsterFields(value, context));
}
// Port only: bones-monster trait validation.
export function validSavedMonsterTraits(value, context) {
    const { minvent, inventory, mw, wormSegments, wormDetachedSegments, wormHead, wormGrowTime, lightRemoved, headOnMap, ...fields } = monsterFields(value, context);
    return validateSavedEntity(value, 'savedMonster', context, fields);
}
// C restore.c:find_lev_obj(): saved TS maps retain floor chains and coordinates.
// Shop flags must still be reconciled after restored keepers take residency.
export function updateRestoredFloorShopOwnership(state = game) {
    for (const column of state.level?.objects ?? [])
        for (const pile of column ?? [])
            for (const object of pile ?? [])
                updateFloorObjectShopOwnership(object, state);
}
// C restore.c:rest_stairs(), getlev() and restdamage().
// Native restoration prepends each saved stair to the new chain.
export function restoreLevelChains(level, stairs) {
    // Trap arrays run backwards to represent C's ftrap chain; getlev()
    // prepends each restored trap, reversing that chain.
    level.traps.reverse();
    // C restdamage() prepends the saved pending repairs.
    level.damagelist?.reverse();
    let restored = null;
    let saved = stairs;
    while (saved) {
        const next = saved.next;
        saved.next = restored;
        restored = saved;
        saved = next;
    }
    return restored;
}
// Port only: validates the worm fields of every saved monster on a level.
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
// Port only: type guard for one saved worm segment point.
function savedWormPoint(value) {
    return isSavedRecord(value)
        && typeof value.x === 'number' && Number.isInteger(value.x)
        && typeof value.y === 'number' && Number.isInteger(value.y)
        && (value.onMap === undefined || typeof value.onMap === 'boolean');
}
// Part of C restore.c:getlev(): the worm head placement after monster
// restore.
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
// C restore.c:restmonchn(): restore the post-5.0.0 parked bit on old guards.
function restoreParkedGuardState(monster) {
    if (monster.isgd && !monster.mx && !((monster.mstate ?? 0) & (MON_PARKED | MON_MIGRATING)))
        monster.mstate = ((monster.mstate ?? 0) & ~TERRAIN_FALLOUT_MASK) | MON_PARKED;
}
// C restore.c:getlev(): restore the resident terrain-fallout flags.
export function restoreMonsterTerrainState(monster, state = game) {
    restoreParkedGuardState(monster);
    const effects = (monster.mstate ?? 0) & TERRAIN_FALLOUT_MASK;
    if (effects)
        state._pendingTerrainEffects = (state._pendingTerrainEffects ?? 0) | effects;
}
// Part of C restore.c:getlev(): the hides_under()+mundetected hideunder()
// recheck after place_monster(), re-run before catch-up and shape changes.
// A saved mundetected bit alone does not establish valid cover.
export async function restoreMonsterCover(monster, state = game) {
    if (monster !== state.u.usteed && monster.mundetected
        && monsterHidesUnder(monster.mnum))
        await hideMonsterUnder(monster, state);
}
// C restore.c:getlev(): branch entrances can move between games.
export function repairBonesConnections(level, location) {
    const here = (end) => end.dnum === location.dnum && end.dlevel === location.dlevel;
    const branch = game.branches.find(candidate => here(candidate.end1) || here(candidate.end2));
    if (!branch) {
        for (const trap of [...level.traps])
            if (trap.ttyp === MAGIC_PORTAL)
                deleteTrap(trap);
        return;
    }
    if (location.dlevel !== 1)
        return;
    const destination = here(branch.end1) ? branch.end2 : branch.end1;
    if (branch.type === 'portal') {
        const portal = level.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
        if (!portal)
            throw new PanicTermination('getlev: need portal but none found');
        portal.dst = { ...destination };
        return;
    }
    for (let stair = game.stairs; stair; stair = stair.next) {
        if (stair.tolev.dnum === location.dnum)
            continue;
        stair.tolev = { ...destination };
        break;
    }
}
// C restore.c:restore_msghistory().
/**
 * C restore.c:restore_msghistory(): the first restored message purges the
 * session's own ring (keeping its entries), each restored message becomes
 * the current topline in turn, and the final empty call puts the session's
 * messages back on top of the restored ones.
 */
// C restore.c:restore_msghistory().
export function restoreMessageHistory(saved) {
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
// Part of C restore.c:getlev(): one level's monster restore.
function restoreLevelMonsters(level, moves) {
    restoreLevelPetHistory(level, 0);
    restoreEngravings(level, moves);
    if (!validMonsterWormBodies(level))
        throw new Error('Invalid saved worm bodies');
    restoreMonsterWormHeads(level);
    for (const monster of level.monsters) {
        restoreParkedGuardState(monster);
        restoreMonsterInventoryOwnership(monster);
    }
}
// Part of C restore.c:dorecover(): monster restore across levels,
// migrations, and the steed.
function restoreSavedMonsters(state) {
    if (state.level)
        restoreLevelMonsters(state.level, state.moves);
    for (const cached of state._levelCache?.values() ?? []) {
        restoreLevelMonsters(cached.level, state.moves);
        restoreObjectPetHistory(cached.billObjects ?? [], 0);
    }
    for (const monster of state._migratingMonsters || []) {
        restoreParkedGuardState(monster);
        restoreMonsterPetHistory(monster, 0);
        restoreObjectPetHistory(monster.minvent || monster.inventory || [], 0);
        restoreMonsterInventoryOwnership(monster);
    }
    if (state.u.usteed) {
        restoreParkedGuardState(state.u.usteed);
        restoreMonsterPetHistory(state.u.usteed, 0);
        restoreMonsterInventoryOwnership(state.u.usteed);
    }
    restoreObjectPetHistory([
        ...state.inventory, ...state.migratingObjects ?? [], ...state.billObjects ?? [],
    ], 0);
}
// C restore.c:restgamestate() reports its refusal through You() and returns
// FALSE; dorecover() then waits for the message to be dismissed and discards
// the save file. The synchronous restoreGame() can only report the refusal,
// so the caller completes that dialogue through dismissUnhealthyRestore().
let restoreRefusal = null;
let retainedSave = null;
// C unixmain.c:main(): the wizard/explore save-retention question after
// recovery. C unixmain.c asks after dorecover()'s welcome; ordinary games
// consume their file inside dorecover(), while wizard and explore games
// may keep it.
export async function askKeepRestoredSave() {
    const restored = retainedSave;
    retainedSave = null;
    if (!restored)
        return;
    if (await promptYesNo('Do you want to keep the save file?') === 'n')
        restored.storage.removeItem?.(restored.key);
}
// Port only: reports the deferred unhealthy-restore refusal.
export function restoreRefusedAsUnhealthy() {
    return restoreRefusal === 'unhealthy';
}
// Part of C restore.c:dorecover(): the unhealthy-refusal message, wait,
// and file discard.
export async function dismissUnhealthyRestore(name, storage = game.storage) {
    if (restoreRefusal !== 'unhealthy')
        return;
    restoreRefusal = null;
    await pline('You were not healthy enough to survive restoration.');
    await displayMessageWindow();
    storage?.removeItem?.(saveKey(name));
}
// C restore.c:dorecover().
// Also C restore.c:restgamestate(): inlined here.
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
        level_status_init();
        game.level_status.loading = true;
        resetErinys(game.u.ualign?.abuse ?? 0);
        resolveDungeonIdentities(game);
        // C restnames() reloads objects[].oc_prob as saved; those gem
        // probabilities are always oinit()'s values for the saved u.uz.
        oinit();
        game._messageHistory = sessionHistory;
        game._toplines = sessionToplines;
        restoreMessageHistory(snapshot.state._messageHistory ?? []);
        restoreScheduledLevelChange();
        restore_waterlevel();
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
        cmdq_clear(CQ_REPEAT);
        game._inDoAgain = false;
        game._movementAttempt = null;
        game._occupation = null;
        game._lockAttempt = null;
        game._runState = null;
        game._heroTimePending = false;
        game._kickedLoc = null;
        cmdq_clear(CQ_CANNED);
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
// Port only: clears process-scoped globals when restoring into live state.
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
// Part of C restore.c:restmon(): the pet fix across a level's monsters
// and objects.
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
// C restore.c:restmon(): the edog (pet) part of one restored monster's
// mextra — relative_time_to_moves() on droptime and hungrytime (the port
// re-bases them by the elapsed move count instead of a saved clock), and
// the apport sanity floor. The stream reads around it have no port
// counterpart: saved state arrives as a validated object graph.
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
// Part of C restore.c:restmon(): the edog fix applied to pets saved
// inside objects.
export function restoreObjectPetHistory(objects, elapsed) {
    for (const object of objects) {
        if (object.oextra?.omonst)
            restoreMonsterPetHistory(object.oextra.omonst, elapsed);
        restoreObjectPetHistory(object.contents ?? [], elapsed);
    }
}
// C restore.c:lookup_id_mapping(): the id_map lookup (the port stores the
// mapping as a Map instead of C's bucket chain).
function remappedMonsterId(oldId, monsterIds) {
    return oldId !== undefined && Number.isInteger(oldId) ? monsterIds.get(oldId) : undefined;
}
// C restore.c:reset_oattached_mids(): walk the restored object
// graph and remap each ghostly omid (and the port's leashmon), zeroing
// any omonst — a dead owner's pet is no longer peaceful or tame.
// Bones loading is the only caller (bones.ts getbones()).
export function resetObjectAttachedMonsterIds(level, monsterIds) {
    eachObjectInBonesGraph(level, object => repairObjectMonsterIds(object, monsterIds));
}
// Part of C restore.c:reset_oattached_mids(): ghostly omonst zeroing and
// omid remap; the port also remaps leashmon.
function repairObjectMonsterIds(object, monsterIds) {
    const extra = object.oextra;
    const omid = extra?.omid;
    if (omid && extra) {
        const newId = remappedMonsterId(omid, monsterIds);
        if (newId)
            extra.omid = newId;
        else
            delete extra.omid;
    }
    if (object.omid) {
        const newId = remappedMonsterId(object.omid, monsterIds);
        if (newId)
            object.omid = newId;
        else
            delete object.omid;
    }
    if (object.leashmon) {
        object.leashmon = remappedMonsterId(object.leashmon, monsterIds) || 0;
    }
    if (object.oextra?.omonst) {
        object.oextra.omonst.m_id = 0;
        object.oextra.omonst.mpeaceful = 0;
        object.oextra.omonst.mtame = 0;
    }
}
//# sourceMappingURL=restore.js.map