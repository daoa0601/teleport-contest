import type { AttackMethod, DamageType } from './monster_attack_types.js';
import type { RaceName, RoleKey } from './roles.js';

/** Native struct attack fields, in the order used by mons[].mattk. */
export type MonsterAttack = readonly [
    method: AttackMethod,
    damage: DamageType,
    dice: number,
    sides: number,
];

export type MonsterAttacks = readonly [
    MonsterAttack, MonsterAttack, MonsterAttack,
    MonsterAttack, MonsterAttack, MonsterAttack,
];

export type MonsterBody = readonly [weight: number, nutrition: number];
export type MonsterExperience = readonly [
    armorClass: number,
    attackMethodBonus: number,
    levelMultiplier: number,
    flatBonus: number,
    eelWrap: 0 | 1,
];

export type SpellCategory = 'attack' | 'healing' | 'divination'
    | 'enchantment' | 'clerical' | 'escape' | 'matter';

export type ArtifactFlag = 'SPFX_NOGEN' | 'SPFX_RESTR' | 'SPFX_SEEK'
    | 'SPFX_DEFN' | 'SPFX_INTEL' | 'SPFX_SEARCH' | 'SPFX_ATTK' | 'SPFX_DRLI'
    | 'SPFX_WARN' | 'SPFX_DFLAG2' | 'SPFX_DCLAS' | 'SPFX_REFLECT'
    | 'SPFX_HALRES' | 'SPFX_REGEN' | 'SPFX_BEHEAD' | 'SPFX_DALIGN'
    | 'SPFX_SPEAK' | 'SPFX_XRAY' | 'SPFX_PROTECT' | 'SPFX_LUCK'
    | 'SPFX_ESP' | 'SPFX_HSPDAM' | 'SPFX_STLTH' | 'SPFX_TCTRL'
    | 'SPFX_HPHDAM' | 'SPFX_EREGEN';

export type ArtifactTarget =
    | { readonly kind: 'all' | 'resistance' | 'alignment' }
    | { readonly kind: 'flag2'; readonly value: 'M2_ELF' | 'M2_ORC'
        | 'M2_DEMON' | 'M2_WERE' | 'M2_GIANT' | 'M2_UNDEAD' }
    | { readonly kind: 'symbol'; readonly value: 'S_DRAGON' | 'S_OGRE' | 'S_TROLL' };

export type ArtifactDamage = 'physical' | 'life-drain' | 'shock'
    | 'stun' | 'cold' | 'fire';
export type ArtifactDefense = 'life-drain' | 'poison' | 'magic' | 'cold'
    | 'fire' | 'lycanthropy' | 'blindness';
export type ArtifactPower = 'fling-poison' | 'snowstorm' | 'firestorm'
    | 'banish' | 'blinding-ray' | 'invisibility' | 'levitation' | 'conflict'
    | 'healing' | 'enlightening' | 'energy-boost' | 'create-ammo' | 'untrap'
    | 'charge-object' | 'level-teleport' | 'create-portal';

export interface ArtifactDefinition {
    readonly id: number;
    readonly name: string;
    readonly enumName: string;
    readonly baseType: number;
    readonly flags: readonly ArtifactFlag[];
    readonly carriedFlags: readonly ArtifactFlag[];
    readonly target: ArtifactTarget;
    readonly attack: {
        readonly damageType: ArtifactDamage;
        readonly toHitDie: number;
        readonly damageDie: number;
    } | null;
    readonly defense: ArtifactDefense | null;
    readonly carriedDefense: ArtifactDefense | null;
    readonly invokePower: ArtifactPower | null;
    readonly alignment: number | null;
    readonly role: RoleKey | null;
    readonly race: RaceName | null;
    readonly generationEnchantment: number;
    readonly giftValue: number;
    readonly cost: number;
    readonly color: 'NO_COLOR' | 'CLR_RED' | 'CLR_BRIGHT_BLUE';
}

export interface ShopType {
    readonly name: string;
    readonly annotation: string | null;
    readonly symbol: number;
    readonly probability: number;
    /** A positive item code is an object class; a negative one is an object type. */
    readonly items: readonly (readonly [probability: number, itemCode: number])[];
    readonly names: readonly string[];
}

export interface NativeCommand {
    readonly key: number;
    readonly name: string | null;
    readonly handler: string;
    readonly flags: number;
    readonly occupation: 'searching' | 'waiting' | null;
}

export interface CommandBinding {
    readonly key: number;
    readonly name: string;
}

export interface SpecialKey {
    readonly key: number;
    readonly name: string | null;
}

export type DirectionHandlers = readonly [move: string, run: string, rush: string];

export interface MapSymbol {
    readonly ch: string;
    readonly name: string;
    readonly color: number;
}
