// restore.js — C restore.c in one module: every whole-function restore.c
// port, ordered by its C definition. The synchronous dorecover() flow
// (restoreGame() with the restgamestate() refusal dialogue) stays in save.ts
// beside the save.c side, and the restobjchn()/getlev() bones clock shift
// stays in bones.ts beside its object traversal helpers.
// C refs: restore.c inven_inuse(), restmon(), rest_stairs(), getlev(), and
// restore_msghistory(); mon.c hide_monst(), whose only native caller is
// getlev().
import { game, requireLiveGame } from './gstate.js';
import { rememberToplines } from './topl.js';
import { plineWithContinuation } from './pline.js';
import { consumeInventoryItem } from './invent.js';
import { objectName, pluralizeObjectNoun } from './objnam.js';
import { deleteTrap } from './trap.js';
import { PanicTermination } from './panic_termination.js';
import { attemptMonsterRestrap, hideMonsterUnder } from './mon.js';
import { monsterHidesUnder } from './mondata.js';
import { MONSTER_SYMBOL } from './monster_data.js';
import { isok } from './cmd.js';
import { AM_CHAOTIC, AM_LAWFUL, AM_NEUTRAL, AM_NONE, ismnum, MAGIC_PORTAL, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPMASK, M_AP_TYPE, MAX_NUM_WORMS, MON_FLOOR, NON_PM, } from './const.js';
import { SLIME_MOLD } from './object_data.js';
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
//# sourceMappingURL=restore.js.map