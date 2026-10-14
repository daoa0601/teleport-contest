import type {
    BonesMonsterData, MinionData, Monster, MonsterExtra, MonsterFlag,
    MonsterLevel, PetData, PriestData, SavedMonsterTraits, ShopBillEntry,
    ShopkeeperData, VaultGuardData,
} from './monster_types.js';
import type { Position } from './map_types.js';
import {
    AM_CHAOTIC, AM_LAWFUL, AM_NEUTRAL, AM_NONE,
    M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPMASK, NON_PM, ismnum,
} from './const.js';
import { SLIME_MOLD } from './object_data.js';
import { isSavedRecord } from './saved_graph.js';
import { validSavedSpeciesOrNone } from './species_validation.js';
import {
    arrayOf, boolean, closedFieldsMatch, integer, nullable, optional, string,
    validateSavedEntity,
} from './saved_validation.js';
import type { Check, Fields, SavedEntityContext } from './saved_validation.js';

const flag: Check<MonsterFlag> = (value): value is MonsterFlag =>
    typeof value === 'boolean' || value === 0 || value === 1;

const position: Check<Position> = (value): value is Position =>
    closedFieldsMatch(value, { x: integer, y: integer });

const level: Check<MonsterLevel> = (value): value is MonsterLevel =>
    closedFieldsMatch(value, { dnum: integer, dlevel: integer });

const pet: Check<PetData> = (value): value is PetData => closedFieldsMatch<PetData>(value, {
    parentmid: optional(integer),
    droptime: integer,
    dropdist: integer,
    apport: integer,
    whistletime: integer,
    hungrytime: integer,
    ogoal: position,
    abuse: integer,
    revivals: integer,
    mhpmax_penalty: integer,
    killed_by_u: flag,
});

const minion: Check<MinionData> = (value): value is MinionData => closedFieldsMatch<MinionData>(value, {
    min_align: integer,
    renegade: flag,
    parentmid: optional(integer),
});

const priest: Check<PriestData> = (value): value is PriestData => closedFieldsMatch<PriestData>(value, {
    parentmid: integer,
    shroom: integer,
    shralign: integer,
    shrpos: position,
    shrlevel: level,
    intone_time: integer,
    enter_time: integer,
    peaceful_time: integer,
    hostile_time: integer,
});

const bill: Check<ShopBillEntry> = (value): value is ShopBillEntry => closedFieldsMatch<ShopBillEntry>(value, {
    bo_id: integer,
    bquan: integer,
    price: integer,
    useup: flag,
});

const shopkeeper: Check<ShopkeeperData> = (value): value is ShopkeeperData => closedFieldsMatch<ShopkeeperData>(value, {
    shoproom: integer,
    shoptype: integer,
    shoplevel: level,
    shd: position,
    shk: position,
    parentmid: optional(integer),
    shknam: optional(string),
    bill: optional(arrayOf(bill)),
    billct: optional(integer),
    billUnavailable: optional(boolean),
    credit: optional(integer),
    debit: optional(integer),
    loan: optional(integer),
    robbed: optional(integer),
    surcharge: optional(flag),
    following: optional(flag),
    customer: optional(string),
    visitct: optional(integer),
    dismiss_kops: optional(boolean),
    break_seq: optional(integer),
    seq_peaceful: optional(flag),
});

const corridor: Check<VaultGuardData['fakecorr'][number]> =
    (value): value is VaultGuardData['fakecorr'][number] => closedFieldsMatch(value, {
        x: integer, y: integer, typ: integer, flags: integer,
    });

function guard(context: SavedEntityContext): Check<VaultGuardData> {
    return (value): value is VaultGuardData => closedFieldsMatch<VaultGuardData>(value, {
        gdlevel: level,
        gddone: flag,
        ogx: integer,
        ogy: integer,
        gdx: integer,
        gdy: integer,
        vault: context.room,
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
    oldalign: integer,
    deathlevel: integer,
    luck: integer,
    mnum: ismnum,
    female: boolean,
    demigod: boolean,
    crowned: boolean,
});

function extra(representation: Check<number>): Check<MonsterExtra> {
    return (value): value is MonsterExtra => closedFieldsMatch<MonsterExtra>(value, {
        mgivenname: optional(string),
        mcorpsenm: optional(representation),
        edog: optional(pet),
        emin: optional(minion),
        epri: optional(priest),
        eshk: optional(shopkeeper),
        ebones: optional(bones),
    });
}

function appearanceType(value: unknown): number {
    return isSavedRecord(value) && integer(value.m_ap_type)
        ? value.m_ap_type & M_AP_TYPMASK : 0;
}

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

function monsterFields(value: unknown, context: SavedEntityContext): Fields<Monster> {
    const representation = mimicRepresentation(value);
    return {
        mx: integer,
        my: integer,
        mstate: optional(integer),
        wormSegments: optional(arrayOf(position)),
        m_id: integer,
        mnum: ismnum,
        m_lev: integer,
        mhp: integer,
        mhpmax: integer,
        female: boolean,
        mux: optional(integer),
        muy: optional(integer),
        mcanmove: flag,
        mcansee: flag,
        mgenmklev: optional(boolean),
        msleeping: optional(flag),
        mpeaceful: flag,
        minvent: optional(arrayOf(context.object)),
        inventory: optional(arrayOf(context.object)),
        hasInventory: optional(boolean),
        cham: optional(validSavedSpeciesOrNone),
        dead: optional(boolean),
        movement: optional(integer),
        mmove: optional(integer),
        mspeed: optional(integer),
        permspeed: optional(integer),
        symbol: optional(string),
        color: optional(integer),
        mstrategy: optional(integer),
        mgoal: optional(position),
        mtrapseen: optional(integer),
        mtrack: optional(arrayOf(position)),
        mtame: optional(integer),
        pet: optional(boolean),
        meating: optional(integer),
        mlstmv: optional(integer),
        mspec_used: optional(integer),
        mfrozen: optional(integer),
        mblinded: optional(integer),
        mfleetim: optional(integer),
        mcan: optional(flag),
        mstun: optional(flag),
        mconf: optional(flag),
        mflee: optional(flag),
        mtrapped: optional(flag),
        mburied: optional(flag),
        mleashed: optional(flag),
        mrevived: optional(flag),
        mcloned: optional(flag),
        mavenge: optional(flag),
        meverseen: optional(flag),
        mtemplit: optional(flag),
        mundetected: optional(flag),
        minvis: optional(flag),
        perminvis: optional(flag),
        invis_blkd: optional(flag),
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
        iswiz: optional(flag),
        isgd: optional(flag),
        isshk: optional(flag),
        ispriest: optional(flag),
        isminion: optional(flag),
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
        _nastyBirthPeaceful: optional(flag),
        wormno: optional(integer),
        wormHead: optional(nullable(position)),
        wormGrowTime: optional(integer),
        migrating: optional(boolean),
        migratingWormSegments: optional(integer),
        migrationMode: optional(integer),
        migrationArrival: optional(integer),
        migrationFlags: optional(integer),
        migrationSource: optional(position),
        migrationOrigin: optional(level),
        migrationDestination: optional(level),
    };
}

export function validSavedMonster(value: unknown, context: SavedEntityContext): value is Monster {
    return validateSavedEntity(value, 'monster', context, monsterFields(value, context));
}

export function validSavedMonsterTraits(value: unknown, context: SavedEntityContext): value is SavedMonsterTraits {
    const {
        minvent, inventory, mw, wormSegments, wormHead, wormGrowTime,
        ...fields
    } = monsterFields(value, context);
    return validateSavedEntity(value, 'savedMonster', context, fields);
}
