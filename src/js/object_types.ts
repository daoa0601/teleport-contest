import type { Monster, SavedMonsterTraits } from './monster_types.js';
import type { LevitationState } from './property_types.js';
import type { SpellCategory } from './data_types.js';

export type ObjectWhere =
    | 'free'
    | 'inventory'
    | 'floor'
    | 'contained'
    | 'minvent'
    | 'buried'
    | 'onbill'
    | 'migrating'
    | 'gone';

export type ObjectTimerKind =
    | 'rot-organic'
    | 'rot-corpse'
    | 'revive-mon'
    | 'zombify-mon'
    | 'burn-object'
    | 'hatch-egg'
    | 'shrink-glob'
    | 'fig-transform';

export interface ObjectTimer {
    kind: ObjectTimerKind;
    deadline: number;
    id: number;
}

export interface LevelTimer {
    kind: 'melt-ice-away';
    deadline: number;
    id: number;
    x: number;
    y: number;
}

export type ObjectBlessing = 'blessed' | 'uncursed' | 'cursed';
export type ObjectLostReason = 0 | 1 | 2 | 3 | 4;
export type WornObjectSlot =
    | 'uarm'
    | 'uarmc'
    | 'uarmf'
    | 'uarmg'
    | 'uarmh'
    | 'uarms'
    | 'uarmu'
    | 'uskin'
    | 'uamul'
    | 'ublindf'
    | 'left-ring'
    | 'right-ring'
    | 'helmet';

export interface ObjectExtra {
    oname?: string | null;
    omid?: number;
    omonst?: SavedMonsterTraits | null;
}

export interface ObjectMigration {
    source: { dnum: number; dlevel: number };
    destination: { dnum: number; dlevel: number };
    arrival: number;
    speciesFlags?: number;
}

// The core fields are installed by mksobj before class-specific initialization.
// Extra fields appear only when their owning mechanic has initialized them.
export interface GameObject {
    otyp: number;
    oclass: number;
    o_id: number;
    ox: number;
    oy: number;
    quan: number;
    where: ObjectWhere;
    age: number;
    owt: number;
    spe: number;
    recharged: number;
    dknown: boolean;
    known: boolean;
    blessed: boolean;
    cursed: boolean;
    olocked: boolean;
    artifact: boolean;

    // Extraction and replacement update links in stages. A monster-carried
    // object retains its owner even after the monster leaves the map.
    contents?: GameObject[];
    container?: GameObject | null;
    ocarry?: Monster | null;
    carrierMid?: number | null;
    buried?: boolean;
    migration?: ObjectMigration;
    _fobjOrder?: number;
    lua_ref_cnt?: number;

    oextra?: ObjectExtra | null;
    oartifact?: number;
    oname?: string;
    omid?: number;
    corpsenm?: number;
    novelidx?: number;
    spestudied?: number;
    leashmon?: number;
    oeaten?: number;
    globby?: boolean;
    norevive?: boolean;
    on_ice?: boolean;
    ageRelative?: boolean;
    objectTimers?: ObjectTimer[];
    timed?: number;
    lamplit?: boolean | 0 | 1;
    ghostly?: boolean;

    bknown?: boolean;
    rknown?: boolean;
    cknown?: boolean;
    lknown?: boolean;
    tknown?: boolean;
    unpaid?: boolean;
    no_charge?: boolean;
    otrapped?: boolean | 0 | 1;
    obroken?: boolean;
    oeroded?: number;
    oeroded2?: number;
    oerodeproof?: boolean;
    greased?: boolean;
    opoisoned?: boolean | 0 | 1;
    odiluted?: boolean | 0 | 1;
    orotten?: boolean;
    degraded_horn?: number;
    nomerge?: boolean;
    bypass?: boolean;
    how_lost?: ObjectLostReason;
    pickup_prev?: boolean;
    in_use?: boolean;
    wishedfor?: boolean;
    fromsink?: boolean;
    achievement?: boolean;
    questArtifact?: boolean;
    destroyed?: boolean;

    owornmask?: number;
    worn?: boolean;
    wornSlot?: WornObjectSlot | null;
    wielded?: boolean;
    alternate?: boolean;
    ready?: boolean;
    _armorApplied?: boolean;
    _waterWalkingWasInWater?: boolean;
    _levitationBeforeWear?: LevitationState;
    _displacementWasActive?: boolean;
    _grantsVeryFastFromArmor?: boolean;

    // Inventory presentation is attached to the same object identity. These
    // optional projections do not replace the native fields above.
    quantity?: number;
    enchantment?: number | undefined;
    buc?: ObjectBlessing | '' | undefined;
    invlet?: string | null;
    name?: string;
    plural?: string;
    class?: string;
    description?: string;
    color?: number;
    artifactName?: string;
    typeKnown?: boolean;
    overrideIdentified?: boolean;
    _startingInventory?: boolean;
    bimanual?: boolean;
    poisoned?: boolean;
    diluted?: boolean;
    enchanted?: boolean;
    omitUncursed?: boolean;
    showBuc?: boolean | undefined;
    spellName?: string | null | undefined;
    spellLevel?: number | undefined;
    spellCategory?: SpellCategory | null | undefined;
    appearance?: string;
    empty?: boolean;
}
