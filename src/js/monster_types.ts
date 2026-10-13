import type { GameObject } from './object_types.js';
import type { Position, Room } from './map_types.js';

// The port currently stores C bit fields as either booleans or integer bits.
// Multi-bit fields such as mstate, mstrategy and mtrapseen remain numbers.
export type MonsterFlag = boolean | 0 | 1;

export interface MonsterPosition {
    mx: number;
    my: number;
    mstate?: number;
    wormSegments?: Position[];
}

export interface MonsterLevel {
    dnum: number;
    dlevel: number;
}

export interface PetData {
    parentmid?: number;
    droptime: number;
    dropdist: number;
    apport: number;
    whistletime: number;
    hungrytime: number;
    ogoal: Position;
    abuse: number;
    revivals: number;
    mhpmax_penalty: number;
    killed_by_u: MonsterFlag;
}

export interface MinionData {
    min_align: number;
    renegade: MonsterFlag;
    parentmid?: number;
}

export interface PriestData {
    parentmid: number;
    shroom: number;
    shralign: number;
    shrpos: Position;
    shrlevel: MonsterLevel;
    intone_time: number;
    enter_time: number;
    peaceful_time: number;
    hostile_time: number;
}

export interface ShopBillEntry {
    bo_id: number;
    bquan: number;
    price: number;
    useup: MonsterFlag;
}

export interface ShopkeeperData {
    shoproom: number;
    shoptype: number;
    shoplevel: MonsterLevel;
    shd: Position;
    shk: Position;
    parentmid?: number;
    shknam?: string;
    bill?: ShopBillEntry[];
    billct?: number;
    billUnavailable?: boolean;
    credit?: number;
    debit?: number;
    loan?: number;
    robbed?: number;
    surcharge?: MonsterFlag;
    following?: MonsterFlag;
    customer?: string;
    visitct?: number;
    dismiss_kops?: boolean;
    break_seq?: number;
    seq_peaceful?: MonsterFlag;
}

export interface VaultGuardData {
    gdlevel: MonsterLevel;
    gddone: MonsterFlag;
    ogx: number;
    ogy: number;
    gdx: number;
    gdy: number;
    vault: Room;
    warncnt: number;
    fcbeg: number;
    fcend: number;
    fakecorr: Array<Position & { typ: number; flags: number }>;
    dropgoldcnt: number;
    witness?: number;
}

export interface BonesMonsterData {
    parentmid: number;
    role: number;
    race: number;
    oldalign: number;
    deathlevel: number;
    luck: number;
    mnum: number;
    female: boolean;
    demigod: boolean;
    crowned: boolean;
}

// A monster may carry several role extensions. Species and isminion are not
// discriminants: polymorph and priest conversion preserve other live state.
export interface MonsterExtra {
    mgivenname?: string;
    mcorpsenm?: number;
    edog?: PetData;
    emin?: MinionData;
    epri?: PriestData;
    eshk?: ShopkeeperData;
    ebones?: BonesMonsterData;
}

export interface Monster extends MonsterPosition {
    m_id: number;
    mnum: number;
    m_lev: number;
    mhp: number;
    mhpmax: number;
    female: boolean;
    mux?: number;
    muy?: number;
    mcanmove: MonsterFlag;
    mcansee: MonsterFlag;
    mgenmklev?: boolean;
    msleeping?: MonsterFlag;
    mpeaceful: MonsterFlag;
    minvent?: GameObject[];
    inventory?: GameObject[];
    hasInventory?: boolean;
    cham?: number;

    dead?: boolean;
    movement?: number;
    mmove?: number;
    mspeed?: number;
    permspeed?: number;
    symbol?: string;
    color?: number;
    mstrategy?: number;
    mtrapseen?: number;
    mtrack?: Position[];
    mtame?: number;
    pet?: boolean;
    meating?: number;
    mlstmv?: number;
    mspec_used?: number;
    mfrozen?: number;
    mblinded?: number;
    mfleetim?: number;
    mcan?: MonsterFlag;
    mstun?: MonsterFlag;
    mconf?: MonsterFlag;
    mflee?: MonsterFlag;
    mtrapped?: MonsterFlag;
    mburied?: MonsterFlag;
    mleashed?: MonsterFlag;
    mrevived?: MonsterFlag;
    mcloned?: MonsterFlag;
    mavenge?: MonsterFlag;
    meverseen?: MonsterFlag;
    mtemplit?: MonsterFlag;
    mundetected?: MonsterFlag;
    minvis?: MonsterFlag;
    perminvis?: MonsterFlag;
    invis_blkd?: MonsterFlag;
    seen_resistance?: number;
    mintrinsics?: number;
    mextrinsics?: number;
    defendedSleep?: boolean;
    defendedDisintegration?: boolean;
    seenMagicResistance?: boolean;
    misc_worn_check?: number;
    weaponCheck?: number;
    mw?: GameObject | null;
    saddle?: GameObject | null;
    saddled?: boolean;
    mwandexp?: boolean;

    m_ap_type?: number;
    mappearance?: number;
    mcorpsenm?: number;
    mgivenname?: string;
    name?: string;
    givenName?: string;
    iswiz?: MonsterFlag;
    isgd?: MonsterFlag;
    isshk?: MonsterFlag;
    ispriest?: MonsterFlag;
    isminion?: MonsterFlag;
    questLeader?: boolean;
    waiting?: boolean;
    gold?: number;
    malign: number;
    maligntyp?: number;
    edog?: PetData;
    emin?: MinionData;
    epri?: PriestData;
    eshk?: ShopkeeperData;
    mextra?: MonsterExtra;
    _egd?: VaultGuardData;
    _nastyBirthPeaceful?: MonsterFlag;

    wormno?: number;
    wormHead?: Position | null;
    wormGrowTime?: number;
    migrating?: boolean;
    migratingWormSegments?: number;
    migrationMode?: number;
    migrationArrival?: number;
    migrationFlags?: number;
    migrationSource?: Position;
    migrationOrigin?: MonsterLevel;
    migrationDestination?: MonsterLevel;
}

// makemon publishes its pending actor before groups and inventory generation.
// Starting pets use their own native constructor and do not install these
// fields until the corresponding movement or inventory owner needs them.
export interface MonsterBirthState extends Monster {
    mux: number;
    muy: number;
    mgenmklev: boolean;
    msleeping: MonsterFlag;
    minvent: GameObject[];
    inventory: GameObject[];
    hasInventory: boolean;
    cham: number;
}

// A corpse keeps identity and role history, never ownership of the former
// inventory or a live long-worm body. Revival supplies those from its birth.
export type SavedMonsterTraits = Omit<Monster,
    'minvent' | 'inventory' | 'mw' | 'wormSegments' | 'wormHead' | 'wormGrowTime'>;

export interface MonsterVital {
    mvflags: number;
    born: number;
    died: number;
    seen_close?: MonsterFlag;
    photographed?: MonsterFlag;
}

export interface MonsterPopulationState {
    mvitals?: MonsterVital[];
}
