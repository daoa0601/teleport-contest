// restore.js — C restore.c in one module: every whole-function restore.c
// port. restoreGame() owns the dorecover()/restgamestate() save boundary;
// getlev() owns level restoration for saved games, cached levels and bones.
// C refs: restore.c inven_inuse(), restmon(), rest_stairs(), getlev(),
// dorecover()/restgamestate() (restoreGame), and
// restore_msghistory(); mon.c hide_monst(), whose only native caller is
// getlev().

import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { saveKey } from './save.js';
import {
    eachObjectInBonesGraph, eachTopLevelBonesObject, sanitizeMonsterName,
    shiftBonesDestinations,
} from './bones.js';
import type { RestoreStorage } from './save.js';
import { decodeSavedGame } from './persistent_state_validation.js';
import { requireInitializedHero } from './hero_types.js';
import { rollQuestFigureGenders } from './role.js';
import { recorderRestoredTime } from './calendar.js';
import { resolveDungeonIdentities } from './dungeon.js';
import { oinit } from './o_init.js';
import { restoreScheduledLevelChange } from './do.js';
import { restore_waterlevel } from './mkmaze.js';
import { restoreLevelRegions, resetRegionMonsterIds } from './region.js';
import { restoreLevelLightSources, restoreSavedLightSources } from './light.js';
import { restoreLevelTimers, restoreSavedTimers } from './timeout.js';
import { restoreEngravings } from './engrave.js';
import { promptYesNo } from './query.js';
import { displayMessageWindow } from './topl.js';
import { reglyphSymbolSet } from './display.js';
import { vision_reset_new_level } from './vision.js';
import { weaponNeedsBashingMessage } from './wield.js';
import { resetErinys } from './monster_data.js';
import { hideMonsterOnRestore, removeMonsterFromGame, restoreMonsterInventoryOwnership, restoreMonsterShape } from './mon.js';
import { restorePersistentState } from './state_schema.js';
import type { PersistentState } from './state_schema.js';
import { cmdq_clear } from './cmd.js';
import { rememberToplines } from './topl.js';
import { impossible, pline, plineWithContinuation } from './pline.js';
import { consumeInventoryItem } from './invent.js';
import { objectName, pluralizeObjectNoun } from './objnam.js';
import { deleteTrap } from './trap.js';
import { PanicTermination } from './panic_termination.js';
import { attemptMonsterRestrap, hideMonsterUnder } from './mon.js';
import { monsterHidesUnder } from './mondata.js';
import { MONSTER_ALIGNMENT, MONSTER_SYMBOL } from './monster_data.js';
import { isok } from './cmd.js';
import {
    AM_CHAOTIC, AM_LAWFUL, AM_NEUTRAL, AM_NONE, ismnum, MAGIC_PORTAL, M_AP_FURNITURE,
    M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPMASK, M_AP_TYPE, MAX_NUM_WORMS, mon_offmap, NON_PM,
    CQ_CANNED, CQ_REPEAT, DEFUNCT_MONSTER, M_AP_NOTHING, PL_NSIZ, Upolyd,
} from './const.js';
import { GRAPPLING_HOOK, ICE_BOX, PICK_AXE, SLIME_MOLD } from './object_data.js';
import { validSavedHeroAlignment } from './character_validation.js';
import { validSavedSpeciesOrNone } from './species_validation.js';
import { validSavedLightSourcePosition } from './light_validation.js';
import {
    arrayOf, boolean, closedFieldsMatch, integer, nullable, optional, string, validateSavedEntity,
} from './saved_validation.js';
import { isSavedRecord } from './saved_graph.js';
import type { Check, Fields, SavedEntityContext } from './saved_validation.js';
import type {
    BonesMonsterData, MinionData, Monster, MonsterExtra, MonsterFlag, MonsterLevel, PetData, PriestData,
    SavedMonsterTraits, ShopBillEntry, ShopkeeperData, VaultGuardData, WormSegment,
} from './monster_types.js';
import type { GameMap } from './game.js';
import type { GameObject } from './object_types.js';
import type { Fruit, GameState } from './game_state.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { CachedLevelState, Position, Stairway } from './map_types.js';

import type { BonesPayload } from './bones_validation.js';
import { ageStoresFuel } from './pickup.js';
import { fobjChain, nextIdent } from './mkobj.js';
import { addFruit } from './message_types.js';
import { peaceMinded, propagateMonsterSpecies, setMonsterMalign } from './makemon.js';
import { pacifyShopkeeper, setShopResidency } from './shk.js';
import { hasShopkeeperData } from './shop_types.js';
import { catchUpMonster } from './dog.js';
import { rnd } from './rng.js';

// C restore.c:inven_inuse(). Announce before consuming, so a pager still
// shows the in-use stack until its message is acknowledged.
export async function finishInUseInventory(quietly: boolean): Promise<void> {
    for (const object of [...game.inventory]) {
        if (!object.in_use) continue;
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

const monsterFlag: Check<MonsterFlag> = (value): value is MonsterFlag =>
    typeof value === 'boolean' || value === 0 || value === 1;

const monsterPosition: Check<Position> = (value): value is Position =>
    closedFieldsMatch(value, { x: integer, y: integer });

const wormSegment: Check<WormSegment> = (value): value is WormSegment =>
    closedFieldsMatch(value, { x: integer, y: integer, onMap: optional(boolean) });

const monsterHomeLevel: Check<MonsterLevel> = (value): value is MonsterLevel =>
    closedFieldsMatch(value, { dnum: integer, dlevel: integer });

const pet: Check<PetData> = (value): value is PetData => closedFieldsMatch<PetData>(value, {
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

const minion: Check<MinionData> = (value): value is MinionData => closedFieldsMatch<MinionData>(value, {
    min_align: integer,
    renegade: monsterFlag,
    parentmid: optional(integer),
});

const priest: Check<PriestData> = (value): value is PriestData => closedFieldsMatch<PriestData>(value, {
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

const bill: Check<ShopBillEntry> = (value): value is ShopBillEntry => closedFieldsMatch<ShopBillEntry>(value, {
    bo_id: integer,
    bquan: integer,
    price: integer,
    useup: monsterFlag,
});

const shopkeeperData: Check<ShopkeeperData> = (value): value is ShopkeeperData => closedFieldsMatch<ShopkeeperData>(value, {
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

const corridor: Check<VaultGuardData['fakecorr'][number]> =
    (value): value is VaultGuardData['fakecorr'][number] => closedFieldsMatch(value, {
        x: integer, y: integer, typ: integer, flags: integer,
    });

// Port only: field checks for a saved vault guard record.
function guard(context: SavedEntityContext): Check<VaultGuardData> {
    return (value): value is VaultGuardData => closedFieldsMatch<VaultGuardData>(value, {
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

const bones: Check<BonesMonsterData> = (value): value is BonesMonsterData => closedFieldsMatch<BonesMonsterData>(value, {
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
function extra(representation: Check<number>): Check<MonsterExtra> {
    return (value): value is MonsterExtra => closedFieldsMatch<MonsterExtra>(value, {
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
function appearanceType(value: unknown): number {
    return isSavedRecord(value) && integer(value.m_ap_type)
        ? value.m_ap_type & M_AP_TYPMASK : 0;
}

// Port only: validates a saved mimic's mappearance payload by its
// appearance type.
// makemon.c:set_mimic_sym() also stores a fruit ID or altar mask here.
// Neither overload is a monster index, despite the field's native name.
function mimicRepresentation(value: unknown): Check<number> {
    if (!isSavedRecord(value)) return validSavedSpeciesOrNone;
    const type = appearanceType(value);
    if (type === M_AP_OBJECT && value.mappearance === SLIME_MOLD)
        return (entry): entry is number => entry === NON_PM
            || integer(entry) && entry >= 1 && entry <= 127;
    if (type === M_AP_FURNITURE && value.mappearance === 33) // S_altar
        return (entry): entry is number => entry === NON_PM || entry === AM_NONE
            || entry === AM_CHAOTIC || entry === AM_NEUTRAL || entry === AM_LAWFUL;
    return validSavedSpeciesOrNone;
}

// Port only: field checks for a saved Monster.
function monsterFields(value: unknown, context: SavedEntityContext): Fields<Monster> {
    const representation = mimicRepresentation(value);
    return {
        mx: integer,
        my: integer,
        mstate: optional(integer),
        headOnMap: optional(boolean),
        wormSegments: optional(arrayOf(wormSegment)),
        // Saving is unavailable while cutworm is awaiting a message pager.
        wormDetachedSegments: (entry): entry is undefined => entry === undefined,
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
export function validSavedMonster(value: unknown, context: SavedEntityContext): value is Monster {
    return validateSavedEntity(value, 'monster', context, monsterFields(value, context));
}

// Port only: bones-monster trait validation.
export function validSavedMonsterTraits(value: unknown, context: SavedEntityContext): value is SavedMonsterTraits {
    const {
        minvent, inventory, mw, wormSegments, wormDetachedSegments, wormHead, wormGrowTime, lightRemoved, headOnMap,
        ...fields
    } = monsterFields(value, context);
    return validateSavedEntity(value, 'savedMonster', context, fields);
}

type RestoredLevelSource =
    | { kind: 'saved-data' }
    | { kind: 'saved' }
    | { kind: 'cached'; cached: CachedLevelState }
    | { kind: 'bones'; payload: BonesPayload };

// C restore.c:getlev()
// JSON decoding and validation happen before this live-level boundary.
// Native sequence: "fmon = restmonchn(nhfp)" (restore.c:1146), "find_lev_obj()"
// (1168), resident repair (1181-1220), "rest_regions(nhfp)" (1225), then
// relink_timers()/relink_light_sources() (1299-1300).
// The saved-data pass installs the already validated JSON chains. The saved
// current-level monster pass waits for startup Lua initialization, as before.
export async function getlev(source: RestoredLevelSource): Promise<void> {
    // Bones currently restore against the caller's vision state. Preserve that
    // boundary while consolidating the owner; changing its display is separate.
    const restoringResidents = source.kind === 'saved' || source.kind === 'cached';
    if (restoringResidents) game.program_state.in_getlev = true;
    try {
        if (source.kind === 'saved-data') {
            game.stairs = restoreLevelChains(requireGameLevel(), game.stairs);
            await restoreLevelRegions(game, 0);
            restoreSavedLightSources(game);
            restoreSavedTimers(game);
        } else if (source.kind === 'cached') {
            const { cached } = source;
            const elapsed = game.moves - cached.savedAt;
            game.level = cached.level;
            game.billObjects = cached.billObjects ?? [];
            restoreEngravings(cached.level);
            cached.stairs = restoreLevelChains(cached.level, cached.stairs);
            game.stairs = cached.stairs;
            game._activeSpecialLevel = cached.activeSpecialLevel || null;
            if (cached.level.flags.stasis_until !== undefined)
                cached.level.flags.stasis_until += elapsed;
            restoreLevelTimers(game);
            restoreLevelPetHistory(cached.level, elapsed);
            restoreObjectPetHistory(cached.billObjects ?? [], elapsed);
            restoreMonsterWormHeads(cached.level);
        } else if (source.kind === 'bones') {
            const { payload } = source;
            restoreMonsterWormHeads(payload.level);
            restoreEngravings(payload.level);
            game.level = payload.level;
            const location = game.u.uz;
            if (!location) throw new Error('Bones restoration requires the receiving level location');
            shiftBonesDestinations(payload, location, location.dlevel);
            game.stairs = restoreLevelChains(game.level, payload.stairs || null);
            game._heroTrack = (payload.heroTrack || []).map(point => ({ x: point.x, y: point.y }));
            restoreBonesClock(game.level, payload.savedAt);
            // Region capacity must retain the saved membership count, before
            // identity renewal removes members absent from the bones graph.
            await restoreLevelRegions(game, 0);
            await renewBonesIdentities(game.level, payload.fruits);
            restoreBonesFloorOrder(game.level);
            restoreLevelTimers(game);
        }

        if (source.kind === 'bones') {
            await restoreBonesMonsters(requireGameLevel(), game);
            const location = game.u.uz;
            if (!location) throw new Error('Bones restoration requires the receiving level location');
            repairBonesConnections(requireGameLevel(), location);
        } else if (source.kind !== 'saved-data') {
            const elapsed = source.kind === 'cached' ? game.moves - source.cached.savedAt : 0;
            await restoreLevelResidents(game.level?.monsters ?? [], source.kind, elapsed, game);
        }

        if (source.kind === 'cached') {
            await restoreLevelRegions(game, game.moves - source.cached.savedAt);
            // Saved bubbles redraw before goto_level() moves them.
            restore_waterlevel();
            // Reload the level's light batch in front of carried lights.
            restoreLevelLightSources(game);
        }
    } finally {
        if (restoringResidents) game.program_state.in_getlev = false;
    }
}

// Part of C restore.c:getlev(): resident placement, catch-up and shape repair.
// Births append in the port; native fmon visits the newest resident first.
async function restoreLevelResidents(
    residents: readonly Monster[], source: 'saved' | 'cached' | 'bones', elapsed: number, state: GameState,
): Promise<void> {
    for (const monster of [...residents].reverse()) {
        if (source !== 'saved') setShopResidency(monster, false, state);
        if (source === 'bones') {
            if (monster.mundetected && monsterHidesUnder(monster.mnum))
                await hideMonsterUnder(monster, state);
            if (!monster.isshk) {
                const alignment = MONSTER_ALIGNMENT[monster.mnum] ?? 0;
                const isUnicorn = monster.mnum >= 101 && monster.mnum <= 103;
                const coalignedUnicorn = isUnicorn
                    && Math.sign(state.u.ualign?.type ?? 0) === Math.sign(alignment);
                monster.mpeaceful = coalignedUnicorn || peaceMinded(monster.mnum) ? 1 : 0;
            }
            setMonsterMalign(monster, state);
        } else {
            await restoreMonsterCover(monster, state);
            if (elapsed > 0) await catchUpMonster(monster, elapsed, state);
        }
        await restoreMonsterShape(monster, state);
        if (source !== 'bones' && state.program_state.gameover) break;
        if (source === 'bones' || elapsed > 0 && elapsed > rnd(10))
            await hideMonsterOnRestore(monster, state);
    }
}

// Part of C restore.c:restobjchn(): the ocontainer back-pointer repair.
function repairContainedObjects(container: GameObject): void {
    for (const object of container.contents || []) {
        object.container = container;
        object.where = 'contained';
        delete object.carrierMid;
        repairContainedObjects(object);
    }
}

// Port only: re-point the port's duplicated monster-extension records at
// the restored monster's fresh id (C sets parentmid == m_id when it
// creates each extension).
function repairMonsterExtensions(monster: Monster): void {
    const edog = monster.edog || monster.mextra?.edog;
    if (edog) {
        edog.parentmid = monster.m_id;
        monster.edog = edog;
        monster.mextra = { ...(monster.mextra || {}), edog };
    }
    const shopkeeper = monster.eshk || monster.mextra?.eshk;
    if (shopkeeper) {
        shopkeeper.parentmid = monster.m_id;
        monster.eshk = shopkeeper;
        if (monster.mextra?.eshk) monster.mextra.eshk = shopkeeper;
    }
    const priest = monster.epri || monster.mextra?.epri;
    if (priest) {
        priest.parentmid = monster.m_id;
        monster.epri = priest;
        if (monster.mextra?.epri) monster.mextra.epri = priest;
    }
    const minion = monster.emin || monster.mextra?.emin;
    if (minion) {
        minion.parentmid = monster.m_id;
        monster.emin = minion;
        if (monster.mextra?.emin) monster.mextra.emin = minion;
    }
    if (monster.mextra?.ebones) monster.mextra.ebones.parentmid = monster.m_id;
}

// Part of C restore.c:getlev(): the bones identity renewal, ending in
// region.c:reset_region_mids() for each restored region.
async function renewBonesIdentities(level: GameMap, fruits: readonly Fruit[]): Promise<void> {
    // restmonchn() assigns every monster a fresh id; each monster inventory
    // is restored immediately afterward. getlev() then restores floor and
    // buried object chains. All three paths share next_ident().
    const monsterIds = new Map<number, number>();
    const renewObject = async (object: GameObject): Promise<void> => {
        if (!object) return;
        object.o_id = nextIdent();
        if (object.otyp === SLIME_MOLD) {
            const oldFruit = fruits.find(fruit => fruit.fid === object.spe);
            if (oldFruit) object.spe = addFruit(oldFruit.fname);
            else await impossible('no old fruit?');
        }
        for (const content of object.contents || []) await renewObject(content);
    };
    for (const monster of [...level.monsters].reverse()) {
        const oldId = monster.m_id;
        monster.m_id = nextIdent();
        if (Number.isInteger(oldId) && oldId > 0)
            monsterIds.set(oldId, monster.m_id);
        for (const object of monster.minvent || monster.inventory || [])
            await renewObject(object);
    }
    for (const object of fobjChain(level)) await renewObject(object);
    for (const object of level?.buriedObjects || []) await renewObject(object);

    for (const monster of level?.monsters || []) {
        repairMonsterExtensions(monster);
        const inventory = monster.minvent || monster.inventory || [];
        monster.minvent = inventory;
        monster.inventory = inventory;
        monster.hasInventory = inventory.length > 0;
        for (const object of inventory) {
            object.where = 'minvent';
        }
        restoreMonsterInventoryOwnership(monster);
    }
    resetObjectAttachedMonsterIds(level, monsterIds);
    eachTopLevelBonesObject(level, repairContainedObjects);
    for (const region of level.regions) {
        region.heroFault = false;
        region.heroInside = false;
        resetRegionMonsterIds(region, monsterIds);
    }
}

// Port only: re-seed the floor-chain order counter after a bones restore.
function restoreBonesFloorOrder(level: GameMap): void {
    let newestOrder = game._fobjSerial ?? 0;
    eachObjectInBonesGraph(level, object => {
        newestOrder = Math.max(newestOrder, object._fobjOrder ?? 0);
    });
    // C getlev() restores fobj before restore_cham() can drop equipment.
    // Those drops must precede every object already in the bones chain.
    game._fobjSerial = newestOrder;
}

// Part of C restore.c:restobjchn(), getlev(), timeout.c:restore_timers():
// Bones arrive immediately after the old hero's death, on the new hero's
// clock.
function restoreBonesClock(level: GameMap, savedAt: number): void {
    const adjustment = game.moves - savedAt;
    restoreLevelPetHistory(level, adjustment);
    const restoreObjectClock = (object: GameObject, frozen = false): void => {
        if (!frozen && !object.ageRelative && !ageStoresFuel(object))
            object.age += adjustment;
        for (const timer of object.objectTimers ?? []) timer.deadline += adjustment;
        for (const content of object.contents ?? []) restoreObjectClock(content, object.otyp === ICE_BOX);
    };
    eachTopLevelBonesObject(level, restoreObjectClock);
    for (const timer of level.levelTimers) timer.deadline += adjustment;
    for (const damage of level.damagelist ?? []) damage.when += adjustment;
    if (level.flags.stasis_until !== undefined) level.flags.stasis_until += adjustment;
}

// Part of C bones.c:getbones(): the bones monster-chain admission —
// restore.c:restmonchn()'s ghostly propagate and restshk()/restpriest()
// reassignment, getlev()'s peaceful/malign/hide pass, and getbones()'s own
// sanitize_name and defunct purge.
export async function restoreBonesMonsters(level: Pick<GameMap, 'monsters'>, state: GameState): Promise<void> {
    // C restmonchn() admits the complete chain before getbones() starts
    // purging it. Inventory drops during purge must not affect admission
    // of an actor later in that chain.
    // Births append here; native fmon starts with the newest monster.
    const monsters = [...level.monsters].reverse();
    for (const monster of monsters) {
        if (monster.isshk && state.u.uz?.dlevel) {
            if (!hasShopkeeperData(monster))
                throw new Error(`Bones shopkeeper ${monster.m_id} has no shop record.`);
            monster.eshk.shoplevel = { ...state.u.uz };
            const customer = (monster.eshk.customer ?? '').slice(0, PL_NSIZ).toLowerCase();
            if (!monster.mpeaceful && customer !== state.plname.slice(0, PL_NSIZ).toLowerCase())
                pacifyShopkeeper(monster, true);
        }
        // C priest.c:restpriest(): bones belong to the receiving level.
        if (monster.ispriest && state.u.uz?.dlevel) {
            const shrine = monster.epri ?? monster.mextra?.epri;
            if (!shrine) throw new Error(`Bones priest ${monster.m_id} has no shrine record.`);
            shrine.shrlevel = { ...state.u.uz };
        }
        const species = typeof monster.cham === 'number' && Number.isInteger(monster.cham) && monster.cham >= 0
            ? monster.cham : monster.mnum;
        if (!propagateMonsterSpecies(species, true, true, state))
            monster.mhpmax = DEFUNCT_MONSTER;
    }
    await restoreLevelResidents(level.monsters, 'bones', 0, state);
    for (const monster of monsters) {
        sanitizeMonsterName(monster);
        if (monster.mhpmax !== DEFUNCT_MONSTER) continue;
        await removeMonsterFromGame(monster);
    }
}

// C restore.c:rest_stairs(), getlev() and restdamage().
// Native restoration prepends each saved stair to the new chain.
export function restoreLevelChains(level: GameMap, stairs: Stairway | null): Stairway | null {
    // Trap arrays run backwards to represent C's ftrap chain; getlev()
    // prepends each restored trap, reversing that chain.
    level.traps.reverse();
    // C restdamage() prepends the saved pending repairs.
    level.damagelist?.reverse();
    let restored: Stairway | null = null;
    let saved = stairs;
    while (saved) {
        const next = saved.next;
        saved.next = restored;
        restored = saved;
        saved = next;
    }
    return restored;
}

// ---------------------------------------------------------------------------
// Part of C restore.c:getlev(): resets the monster grid and places every restored
// monster, including the whole worm chain of each worm.
// ---------------------------------------------------------------------------
type WormRestoreMonster = Pick<Monster,
    'mx' | 'my' | 'mstate' | 'headOnMap' | 'wormno' | 'wormHead' | 'wormSegments' | 'wormGrowTime'>;

export interface WormRestoreLevel {
    monsters: WormRestoreMonster[];
}

// Port only: validates the worm fields of every saved monster on a level.
// This boundary proves only worm restoration fields, not a complete Monster.
// Full saves and bones retain body identity and deadlines rather than rebuilding them.
export function validMonsterWormBodies(level: unknown): level is WormRestoreLevel {
    if (!isSavedRecord(level) || !Array.isArray(level.monsters)) return false;
    const monsters: unknown[] = level.monsters;
    const slots = new Set<number>();
    for (const monster of monsters) {
        if (!isSavedRecord(monster)
            || typeof monster.mx !== 'number' || !Number.isInteger(monster.mx)
            || typeof monster.my !== 'number' || !Number.isInteger(monster.my)
            || monster.mstate !== undefined && typeof monster.mstate !== 'number'
            || monster.headOnMap !== undefined && typeof monster.headOnMap !== 'boolean'
            || monster.wormno !== undefined && typeof monster.wormno !== 'number'
            || monster.wormGrowTime !== undefined
                && typeof monster.wormGrowTime !== 'number') return false;
        if (!monster.wormno) {
            if (monster.wormHead != null) return false;
            if (monster.wormSegments !== undefined
                && (!Array.isArray(monster.wormSegments)
                    || monster.wormSegments.length !== 0)) return false;
            continue;
        }
        if (!Number.isInteger(monster.wormno)
            || monster.wormno < 1 || monster.wormno >= MAX_NUM_WORMS
            || slots.has(monster.wormno)
            || typeof monster.wormGrowTime !== 'number'
            || !Number.isInteger(monster.wormGrowTime) || monster.wormGrowTime < 0
            || !savedWormPoint(monster.wormHead)
            || (monster.wormHead.x !== 0 && !isok(monster.wormHead.x, monster.wormHead.y))
            || !Array.isArray(monster.wormSegments)) return false;
        const segments: unknown[] = monster.wormSegments;
        for (const point of segments) {
            if (!savedWormPoint(point)
                || !(point.x === 0 && mon_offmap(monster))
                    && !isok(point.x, point.y)) return false;
        }
        slots.add(monster.wormno);
    }
    return true;
}

// Port only: type guard for one saved worm segment point.
function savedWormPoint(value: unknown): value is WormSegment {
    return isSavedRecord(value)
        && typeof value.x === 'number' && Number.isInteger(value.x)
        && typeof value.y === 'number' && Number.isInteger(value.y)
        && (value.onMap === undefined || typeof value.onMap === 'boolean');
}

// Part of C restore.c:getlev(): the worm head placement after monster
// restore.
export function restoreMonsterWormHeads(level: WormRestoreLevel): void {
    for (const monster of level.monsters) {
        // The native monster grid is rebuilt from fmon when loading a level.
        delete monster.headOnMap;
        for (const segment of monster.wormSegments ?? []) delete segment.onMap;
        if (monster.wormno) monster.wormHead = { x: monster.mx, y: monster.my };
    }
}

// Part of C restore.c:getlev(): the hides_under()+mundetected hideunder()
// recheck after place_monster(), re-run before catch-up and shape changes.
// A saved mundetected bit alone does not establish valid cover.
export async function restoreMonsterCover(monster: Monster, state: GameState = game): Promise<void> {
    if (monster !== state.u.usteed && monster.mundetected
        && monsterHidesUnder(monster.mnum))
        await hideMonsterUnder(monster, state);
}

// Part of C restore.c:getlev(): branch entrances can move between games.
export function repairBonesConnections(level: GameMap, location: DungeonLocation): void {
    const here = (end: DungeonLocation) => end.dnum === location.dnum && end.dlevel === location.dlevel;
    const branch = game.branches.find(candidate => here(candidate.end1) || here(candidate.end2));
    if (!branch) {
        for (const trap of [...level.traps])
            if (trap.ttyp === MAGIC_PORTAL) deleteTrap(trap);
        return;
    }
    if (location.dlevel !== 1) return;
    const destination = here(branch.end1) ? branch.end2 : branch.end1;
    if (branch.type === 'portal') {
        const portal = level.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
        if (!portal) throw new PanicTermination('getlev: need portal but none found');
        portal.dst = { ...destination };
        return;
    }
    for (let stair = game.stairs; stair; stair = stair.next) {
        if (stair.tolev.dnum === location.dnum) continue;
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
export function restoreMessageHistory(saved: readonly string[]): void {
    if (!saved.length) return;
    rememberToplines();
    const session = game._messageHistory.splice(0);
    game._messageHistoryWriteIndex = 0;
    game._messageHistoryCursor = null;
    for (const message of saved) {
        if (!message) continue;
        rememberToplines();
        game._toplines = message;
    }
    for (const message of session) {
        rememberToplines();
        game._toplines = message;
    }
}

// Part of C restore.c:getlev(): one level's monster restore.
function restoreLevelMonsters(level: GameMap, moves: number): void {
    restoreLevelPetHistory(level, 0);
    restoreEngravings(level, moves);
    if (!validMonsterWormBodies(level)) throw new Error('Invalid saved worm bodies');
    restoreMonsterWormHeads(level);
    for (const monster of level.monsters) restoreMonsterInventoryOwnership(monster);
}

// Part of C restore.c:dorecover(): monster restore across levels,
// migrations, and the steed.
function restoreSavedMonsters(state: PersistentState): void {
    if (state.level) restoreLevelMonsters(state.level, state.moves);
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

// C restore.c:restgamestate() reports its refusal through You() and returns
// FALSE; dorecover() then waits for the message to be dismissed and discards
// the save file. The synchronous restoreGame() can only report the refusal,
// so the caller completes that dialogue through dismissUnhealthyRestore().
let restoreRefusal: 'unhealthy' | null = null;
let retainedSave: { storage: RestoreStorage; key: string } | null = null;

// C unixmain.c:main(): the wizard/explore save-retention question after
// recovery. C unixmain.c asks after dorecover()'s welcome; ordinary games
// consume their file inside dorecover(), while wizard and explore games
// may keep it.
export async function askKeepRestoredSave(): Promise<void> {
    const restored = retainedSave;
    retainedSave = null;
    if (!restored) return;
    if (await promptYesNo('Do you want to keep the save file?') === 'n')
        restored.storage.removeItem?.(restored.key);
}

// Port only: reports the deferred unhealthy-restore refusal.
export function restoreRefusedAsUnhealthy(): boolean {
    return restoreRefusal === 'unhealthy';
}

// Part of C restore.c:dorecover(): the unhealthy-refusal message, wait,
// and file discard.
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

// C restore.c:dorecover().
// Also C restore.c:restgamestate(): inlined here.
export async function restoreGame(
    name: string | null | undefined,
    storage: RestoreStorage | null | undefined = game.storage,
): Promise<boolean> {
    restoreRefusal = null;
    retainedSave = null;
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
        // C dorecover() refills the tty recall ring after the game state;
        // capture this session's messages before the snapshot replaces them.
        const sessionHistory = game._messageHistory;
        const sessionToplines = game._toplines;
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
        await getlev({ kind: 'saved-data' });
        // dorecover() assigns Rogue symbols again before the first redraw.
        reglyphSymbolSet();
        // C restore.c:dorecover() rebuilds transient vision after loading the
        // level. No old sight bits may suppress its first terrain repaint.
        vision_reset_new_level();
        game.vision_full_recalc = 1;
        if (game.flags.debug || game.flags.explore || game.discover)
            retainedSave = { storage, key };
        else storage.removeItem?.(key);
        return true;
    } catch (error) {
        if (error instanceof PanicTermination) throw error;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Unable to restore game: ${message}`);
        return false;
    }
}

// Port only: clears process-scoped globals when restoring into live state.
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

// Part of C restore.c:restmon(): the pet fix across a level's monsters
// and objects.
export function restoreLevelPetHistory(level: GameMap, elapsed: number): void {
    for (const monster of level.monsters) {
        restoreMonsterPetHistory(monster, elapsed);
        restoreObjectPetHistory(monster.minvent || monster.inventory || [], elapsed);
    }
    for (const column of level.objects)
        for (const pile of column ?? []) restoreObjectPetHistory(pile ?? [], elapsed);
    restoreObjectPetHistory(level.buriedObjects ?? [], elapsed);
}

// C restore.c:restmon(): the edog (pet) part of one restored monster's
// mextra — relative_time_to_moves() on droptime and hungrytime (the port
// re-bases them by the elapsed move count instead of a saved clock), and
// the apport sanity floor. The stream reads around it have no port
// counterpart: saved state arrives as a validated object graph.
export function restoreMonsterPetHistory(monster: Monster | SavedMonsterTraits, elapsed: number): void {
    const pet = monster.edog || monster.mextra?.edog;
    if (!pet) return;
    // Only these two pet times are saved relative to moves. Whistle time
    // remains absolute, and catch-up separately reduces tameness.
    pet.droptime += elapsed;
    pet.hungrytime += elapsed;
    if (pet.apport <= 0) pet.apport = 1;
    monster.edog = pet;
    if (monster.mextra) monster.mextra.edog = pet;
    else monster.mextra = { edog: pet };
}

// Part of C restore.c:restmon(): the edog fix applied to pets saved
// inside objects.
export function restoreObjectPetHistory(objects: readonly GameObject[], elapsed: number): void {
    for (const object of objects) {
        if (object.oextra?.omonst) restoreMonsterPetHistory(object.oextra.omonst, elapsed);
        restoreObjectPetHistory(object.contents ?? [], elapsed);
    }
}

// C restore.c:lookup_id_mapping(): the id_map lookup (the port stores the
// mapping as a Map instead of C's bucket chain).
function remappedMonsterId(oldId: number | undefined, monsterIds: ReadonlyMap<number, number>): number | undefined {
    return oldId !== undefined && Number.isInteger(oldId) ? monsterIds.get(oldId) : undefined;
}

// C restore.c:reset_oattached_mids(): walk the restored object
// graph and remap each ghostly omid (and the port's leashmon), zeroing
// any omonst — a dead owner's pet is no longer peaceful or tame.
// Bones loading is the only caller (bones.ts getbones()).
export function resetObjectAttachedMonsterIds(level: GameMap, monsterIds: ReadonlyMap<number, number>): void {
    eachObjectInBonesGraph(level, object =>
        repairObjectMonsterIds(object, monsterIds));
}

// Part of C restore.c:reset_oattached_mids(): ghostly omonst zeroing and
// omid remap; the port also remaps leashmon.
function repairObjectMonsterIds(object: GameObject, monsterIds: ReadonlyMap<number, number>): void {
    const extra = object.oextra;
    const omid = extra?.omid;
    if (omid && extra) {
        const newId = remappedMonsterId(omid, monsterIds);
        if (newId) extra.omid = newId;
        else delete extra.omid;
    }
    if (object.omid) {
        const newId = remappedMonsterId(object.omid, monsterIds);
        if (newId) object.omid = newId;
        else delete object.omid;
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

