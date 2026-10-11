// C prop.h properties, expressed through the port's stored hero fields.
// Native prop.h order is also the timeout processing order.
export const PROPERTY_NAMES = [
    'fireResistance', 'coldResistance', 'sleepResistance',
    'disintegrationResistance', 'shockResistance', 'poisonResistance',
    'acidResistance', 'stoneResistance', 'drainResistance',
    'sicknessResistance', 'invulnerable', 'antimagic',
    'stunned', 'confusion', 'blinded',
    'deaf', 'sick', 'stoned',
    'strangled', 'vomiting', 'glib',
    'slimed', 'hallucination', 'hallucinationResistance',
    'fumbling', 'woundedLegs', 'sleepy',
    'hunger', 'seeInvisible', 'telepathy',
    'warning', 'warnOfMonster', 'warnUndead',
    'searching', 'clairvoyant', 'infravision',
    'detectMonsters', 'blindResistance', 'adorned',
    'invisible', 'displaced', 'stealth',
    'aggravateMonster', 'conflict', 'jumping',
    'teleportation', 'teleportControl', 'levitation',
    'flying', 'waterWalking', 'swimming',
    'magicalBreathing', 'passesWalls', 'slowDigestion',
    'halfSpellDamage', 'halfPhysicalDamage', 'regeneration',
    'energyRegeneration', 'protection', 'protectionFromShapeChangers',
    'polymorph', 'polymorphControl', 'unchanging',
    'fast', 'reflection', 'freeAction',
    'sustainAbility', 'lifeSaving',
] as const;
export type PropertyName = typeof PROPERTY_NAMES[number];

// Field names describe the stored counters, not the projected ability flags.
export const PROPERTY_TIMEOUT_FIELDS = {
    fireResistance: 'fireResistanceTurns',
    coldResistance: 'coldResistanceTurns',
    sleepResistance: 'sleepResistanceTurns',
    disintegrationResistance: 'disintegrationResistanceTurns',
    shockResistance: 'shockResistanceTurns',
    poisonResistance: 'poisonResistanceTurns',
    acidResistance: 'acidResistanceTurns',
    stoneResistance: 'stoneResistanceTurns',
    drainResistance: 'drainResistanceTurns',
    sicknessResistance: 'sicknessResistanceTurns',
    invulnerable: 'invulnerableTurns',
    antimagic: 'magicResistanceTurns',
    stunned: 'stunnedTurns',
    confusion: 'confusionTurns',
    blinded: 'blindTurns',
    deaf: 'deafTurns',
    sick: 'sickTurns',
    stoned: 'stonedTurns',
    strangled: 'strangledTurns',
    vomiting: 'vomitingTurns',
    glib: 'glibTurns',
    slimed: 'slimedTurns',
    hallucination: 'hallucinationTurns',
    hallucinationResistance: 'hallucinationResistanceTurns',
    fumbling: 'fumblingTurns',
    woundedLegs: '_woundedLegTurns',
    sleepy: 'sleepyTurns',
    hunger: 'hungerTurns',
    seeInvisible: 'seeInvisibleTurns',
    telepathy: 'telepathyTurns',
    warning: 'warningTurns',
    warnOfMonster: 'warnOfMonsterTurns',
    warnUndead: 'warnUndeadTurns',
    searching: 'searchingTurns',
    clairvoyant: 'clairvoyanceTurns',
    infravision: 'infravisionTurns',
    detectMonsters: 'monsterDetectionTurns',
    blindResistance: 'blindResistanceTurns',
    adorned: 'adornedTurns',
    invisible: 'invisibleTurns',
    displaced: 'displacedTurns',
    stealth: 'stealthTurns',
    aggravateMonster: 'aggravateMonsterTurns',
    conflict: 'conflictTurns',
    jumping: 'jumpingTurns',
    teleportation: 'teleportingTurns',
    teleportControl: 'teleportControlTurns',
    levitation: 'levitationTurns',
    flying: 'flyingTurns',
    waterWalking: 'waterWalkingTurns',
    swimming: 'swimmingTurns',
    magicalBreathing: 'magicalBreathingTurns',
    passesWalls: 'passesWallsTurns',
    slowDigestion: 'slowDigestionTurns',
    halfSpellDamage: 'halfSpellDamageTurns',
    halfPhysicalDamage: 'halfPhysicalDamageTurns',
    regeneration: 'regenerationTurns',
    energyRegeneration: 'energyRegenerationTurns',
    protection: 'protectionTurns',
    protectionFromShapeChangers: 'protectionFromShapeChangersTurns',
    polymorph: 'polymorphingTurns',
    polymorphControl: 'polymorphControlTurns',
    unchanging: 'unchangingTurns',
    fast: 'veryFastTurns',
    reflection: 'reflectionTurns',
    freeAction: 'freeActionTurns',
    sustainAbility: 'sustainAbilityTurns',
    lifeSaving: 'lifeSavingTurns',
} as const satisfies Record<PropertyName, string>;

export type IntrinsicOrigin = 'role' | 'experience' | 'race' | 'outside' | 'form' | 'potion';
export type WornPropertySlot =
    | 'uarm' | 'uarmc' | 'uarmh' | 'uarms' | 'uarmg' | 'uarmf' | 'uarmu'
    | 'uleft' | 'uright' | 'uamul' | 'ublindf' | 'uwep' | 'uswapwep' | 'uquiver';

export interface PropertyObject {
    o_id?: number;
    oartifact?: number;
    otyp?: number;
}

export interface CarriedPropertySource {
    objectId: number | null;
    artifactId: number | null;
    otyp: number | null;
}

export interface InvokedPropertySource {
    objectId: number | null;
    artifactId: number | null;
    objectType: number | null;
}

export interface WornPropertySource {
    slot: WornPropertySlot;
    otyp: number | null;
    objectId: number | null;
}

export interface PropertySources {
    intrinsic: Partial<Record<IntrinsicOrigin, true>>;
    worn: WornPropertySource[];
    invoked: InvokedPropertySource | null;
    carried: CarriedPropertySource[];
    blockedByTerrain?: boolean;
}

export type PropertyTimeout = typeof PROPERTY_TIMEOUT_FIELDS[PropertyName];

export type HeroPropertyState =
    Partial<Record<Exclude<PropertyName, 'invulnerable'>, boolean>>
    & Partial<Record<PropertyTimeout, number>>
    & Partial<Record<`${PropertyName}FromArmor`, boolean>>
    & {
        _propertySources?: Partial<Record<PropertyName, PropertySources>>;
        levitating?: boolean;
        confused?: boolean;
        veryFast?: boolean;
        veryFastFromArmor?: boolean;
        invis?: boolean;
        monsterDetection?: boolean;
        teleporting?: boolean;
        // C u.uinvulnerable is prayer protection, separate from INVULNERABLE.
        invulnerable?: boolean;
    };

// Property queries also run during character initialization, before combat
// attributes exist. They require only this narrow part of the hero state.
export interface PropertyHero extends HeroPropertyState {
    utrap?: number;
    utraptype?: number;
    usteed?: { mnum: number } | null;
    uarmc?: PropertyObject | null;
    invisibilityBlocked?: boolean;
    invisBlocked?: boolean;
}

export interface PropertyState {
    u: PropertyHero;
    uarmc?: PropertyObject | null;
}

export interface LevitationState {
    hasSource: boolean;
    active: boolean;
    blockedByTerrain: boolean;
    blockedByTrap: boolean;
    flying: boolean;
    flyingBlocked: boolean;
}

export interface StashedLevitationSources {
    record: PropertySources | undefined;
    turns: number;
}
