import type { DungeonLocation } from './dungeon_types.js';
import type { Monster } from './monster_types.js';
import type { MapLocation } from './map_types.js';
import type { GameObject } from './object_types.js';
import type { HeroPropertyState } from './property_types.js';
import type { AlignmentValue, AttributeValues } from './roles.js';

export interface HeroCoordinates {
    ux: number;
    uy: number;
    ux0: number;
    uy0: number;
}

export interface HeroAttributes {
    a: AttributeValues;
}

export interface HeroAlignment {
    type: AlignmentValue;
    record: number;
    abuse?: number;
}

export interface HeroRoleplay {
    pauper: boolean;
    nudist: boolean;
    reroll: boolean;
    numrerolls: number;
    blind: boolean;
    deaf: boolean;
}

export interface HeroConduct {
    food?: number;
    unvegan?: number;
    unvegetarian?: number;
    gnostic?: number;
    weaphit?: number;
    killer?: number;
    literate?: number;
    polypiles?: number;
    polyselfs?: number;
    wishes?: number;
    wisharti?: number;
    genocides?: number;
    sokocheat?: number;
    pets?: number;
}

export type HeroEventFlag = boolean | 0 | 1;

export interface HeroEvents {
    ascended?: HeroEventFlag;
    amulet_wish?: HeroEventFlag;
    gehennom_entered?: HeroEventFlag;
    invoked?: HeroEventFlag;
    qcalled?: HeroEventFlag;
    qcompleted?: HeroEventFlag;
    qexpelled?: HeroEventFlag;
    read_tribute?: HeroEventFlag;
    udemigod?: HeroEventFlag;
    uhand_of_elbereth?: number;
    uheard_tune?: number;
    uopened_dbridge?: HeroEventFlag;
    uvibrated?: HeroEventFlag;
}

export interface HeroPossessions {
    amulet?: HeroEventFlag;
    bell?: HeroEventFlag;
    book?: HeroEventFlag;
    menorah?: HeroEventFlag;
    questart?: HeroEventFlag;
}

export interface HeroSkill {
    skill: number;
    maxSkill: number;
    advance: number;
}

// u_init_misc installs these fields before level generation and pet creation.
export interface HeroInitialState {
    uz: DungeonLocation;
    ulevel: number;
    ulevelmax: number;
    ulevelpeak: number;
    uhp: number;
    uhpmax: number;
    uhppeak: number;
    uen: number;
    uenmax: number;
    uenpeak: number;
    uhpinc: number[];
    ueninc: number[];
    uexp: number;
    urexp: number;
    ublesscnt: number;
    uac: number;
    ualign: HeroAlignment;
    ualignbase: [AlignmentValue, AlignmentValue];
    uroleplay: HeroRoleplay;
    rightHanded: boolean;
    umovement: number;
    umonster: number;
    umonnum: number;
    ulycn: number;
    mh: number;
    mhmax: number;
    mtimedone: number;
    nv_range: number;
    xray_range: number;
    uhave: HeroPossessions;
    uconduct: HeroConduct;
    urooms: number[];
    urooms0: number[];
    uentered: number[];
    ushops: number[];
    ushops0: number[];
    ushops_entered: number[];
    ushops_left: number[];
}

// These do not exist when the starting pet is made. In particular, absent
// Charisma yields native apport 3; installing a zero tuple earlier changes it.
export interface HeroStartingAttributes {
    acurr: HeroAttributes;
    amax: HeroAttributes;
    atemp: HeroAttributes;
    uhunger: number;
    uhs: number;
    weaponSkills: HeroSkill[] | null;
    skillRecord: number[];
    weapon_slots: number;
}

export interface Hero extends HeroCoordinates, HeroPropertyState,
    Partial<HeroInitialState>, Partial<HeroStartingAttributes> {
    // Sensory and equipment projections are installed by their owners.
    blind?: boolean;
    permaBlind?: boolean;
    extrinsicDeaf?: boolean;
    Deaf?: boolean;
    veryFast?: boolean;
    veryFastFromArmor?: boolean;
    veryFastTurns?: number;
    monsterDetection?: boolean;
    monsterDetectionTurns?: number;
    teleporting?: boolean;
    teleportingTurns?: number;
    polymorphingTurns?: number;
    blindTelepathy?: boolean;
    unblindTelepathy?: boolean;
    unblind_telepat_range?: number;
    invisBlocked?: boolean;
    invis?: boolean;
    invisibilityBlocked?: boolean;
    displacementBlocked?: boolean;
    displacedBlocked?: boolean;
    clairvoyanceBlocked?: boolean;
    extrinsicJumping?: boolean;
    energyRegenerationExtrinsic?: boolean;
    energyRegenerationIntrinsic?: boolean;
    magicalBreathingExtrinsic?: boolean;
    stealthExtrinsic?: boolean;
    stealthIntrinsic?: boolean;
    regenerationIntrinsic?: boolean;
    intrinsicDisplacement?: boolean;
    displacedIntrinsic?: boolean;
    fumblingIntrinsic?: boolean;
    fumblingFromIce?: boolean;
    halfPhysicalDamageFromArtifact?: boolean;
    halfGasDamage?: boolean;
    fixedAbilities?: boolean;
    magicProtection?: number;
    magicResistance?: boolean;
    amphibious?: boolean;
    breathless?: boolean;
    haveAmulet?: boolean;
    lifesaved?: boolean;

    // Form state is installed or removed by polymorph and rehumanization.
    macurr?: HeroAttributes;
    mamax?: HeroAttributes;
    abon?: HeroAttributes;
    mfemale?: boolean;
    mcham?: number;
    formArmorClass?: number;
    baseArmorClass?: number;
    m_ap_type?: number;
    mappearance?: number;
    m_lev?: number;
    mcan?: boolean;
    uundetected?: boolean | 0 | 1;

    // Equipment links remain nullable during extraction and replacement.
    uwep?: GameObject | null;
    uswapwep?: GameObject | null;
    uquiver?: GameObject | null;
    uarm?: GameObject | null;
    uarmc?: GameObject | null;
    uarmf?: GameObject | null;
    uarmg?: GameObject | null;
    uarmh?: GameObject | null;
    uarms?: GameObject | null;
    uarmu?: GameObject | null;
    uskin?: GameObject | null;
    uamul?: GameObject | null;
    ublindf?: GameObject | null;
    uball?: GameObject | null;
    uchain?: GameObject | null;
    uright?: GameObject | null;
    uleft?: GameObject | null;
    twoweap?: boolean;

    ustuck?: Monster | null;
    usteed?: Monster | null;
    uswallow?: boolean | 0 | 1;
    uswldtim?: number;
    urideturns?: number;
    ugallop?: number;
    utrap?: number;
    utraptype?: number;
    uinwater?: boolean | 0 | 1;
    underwater?: boolean;
    uburied?: boolean | 0 | 1;
    punished?: boolean;
    bc_felt?: number;
    bc_order?: number;
    bglyph?: MapLocation['remembered_glyph'];
    cglyph?: MapLocation['remembered_glyph'];
    uz0?: DungeonLocation;
    ucamefrom?: DungeonLocation;
    utolev?: DungeonLocation;
    utotype?: number;
    umoved?: boolean | 0 | 1;
    dx?: number;
    dy?: number;
    dz?: number;
    tx?: number;
    ty?: number;
    uinvault?: number;
    usleep?: number;
    uinvulnerable?: boolean | 0 | 1;
    ucreamed?: number;

    uconduct?: HeroConduct;
    uevent?: HeroEvents;
    uachieved?: number[];
    umoney0?: number;
    umortality?: number;
    ugifts?: number;
    ugangr?: number;
    ublessed?: number;
    udg_cnt?: number;
    ugrave_arise?: number;
    uluck?: number;
    luck?: number;
    moreluck?: number;
    udaminc?: number;
    uhitinc?: number;
    umconf?: number;
    uedibility?: number;
    uspellprot?: number;
    uspmtime?: number;
    usptime?: number;
    sickCause?: string;
    sickType?: number;
    stoneKiller?: string;
    stoneKillerFormat?: 0 | 1 | 2;
    slimeKiller?: string;
    _encumbrance?: string;
    _exercise?: AttributeValues;
    _sleepyTimeout?: number;
    _woundedLegSide?: 'left' | 'right' | 'both' | null;
    _woundedLegTurns?: number;
}

export type InitializedHero = Hero & HeroInitialState & HeroStartingAttributes;

// The mapped record makes adding an initialized field require a corresponding
// boundary check. Values remain the actual field names, so no string cast is
// needed when inspecting the partially initialized hero.
const INITIALIZED_FIELDS: {
    [Field in keyof (HeroInitialState & HeroStartingAttributes)]: Field;
} = {
    uz: 'uz', ulevel: 'ulevel', ulevelmax: 'ulevelmax', ulevelpeak: 'ulevelpeak',
    uhp: 'uhp', uhpmax: 'uhpmax', uhppeak: 'uhppeak',
    uen: 'uen', uenmax: 'uenmax', uenpeak: 'uenpeak',
    uhpinc: 'uhpinc', ueninc: 'ueninc', uexp: 'uexp', urexp: 'urexp',
    ublesscnt: 'ublesscnt', uac: 'uac', ualign: 'ualign',
    ualignbase: 'ualignbase', uroleplay: 'uroleplay', rightHanded: 'rightHanded',
    umovement: 'umovement', umonster: 'umonster', umonnum: 'umonnum',
    ulycn: 'ulycn', mh: 'mh', mhmax: 'mhmax', mtimedone: 'mtimedone',
    nv_range: 'nv_range', xray_range: 'xray_range', uhave: 'uhave', uconduct: 'uconduct',
    urooms: 'urooms', urooms0: 'urooms0', uentered: 'uentered',
    ushops: 'ushops', ushops0: 'ushops0',
    ushops_entered: 'ushops_entered', ushops_left: 'ushops_left',
    acurr: 'acurr', amax: 'amax', atemp: 'atemp',
    uhunger: 'uhunger', uhs: 'uhs', weaponSkills: 'weaponSkills',
    skillRecord: 'skillRecord', weapon_slots: 'weapon_slots',
};

export function requireInitializedHero(hero: Hero): asserts hero is InitializedHero {
    for (const field of Object.values(INITIALIZED_FIELDS)) {
        if (hero[field] === undefined)
            throw new Error(`Hero initialization has not installed ${field}`);
    }
}

// Allocation must preserve absence until the owning startup phase runs.
export function createHeroState(): Hero {
    return { ux: 0, uy: 0, ux0: 0, uy0: 0 };
}

export function requireHeroAttributes(hero: Hero): Pick<HeroStartingAttributes,
    'acurr' | 'amax' | 'atemp'> {
    const { acurr, amax, atemp } = hero;
    if (!acurr || !amax || !atemp)
        throw new Error('Hero attributes are not initialized');
    return { acurr, amax, atemp };
}
