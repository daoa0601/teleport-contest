import { isPoolAt } from './terrain_properties.js';
// C weapon.c:hitval() and dothrow.c:omon_adj().

import { artifactToHitBonus } from './artifacts.js';
import { P_PICK_AXE, P_SPEAR } from './const.js';

import { game } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';
import type { GameState } from './game_state.js';
import type { Hero } from './hero_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';

import {
    MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_SIZE, MONSTER_SYMBOL,
    monsterHatesBlessings,
} from './monster_data.js';
import {
    BOULDER, HEAVY_IRON_BALL, OBJECT_HIT_BONUS, OBJECT_SUBTYPE, TRIDENT,
} from './object_data.js';
import { rn2, rnd } from './rng.js';

const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const GEM_CLASS = 13;
const M1_SWIM = 0x00000002;
const M1_WALLWALK = 0x00000008;
const M1_THICK_HIDE = 0x00200000;
const S_DRAGON = 30;
const S_GIANT = 34;
const S_JABBERWOCK = 36;
const S_NAGA = 40;
const S_SNAKE = 45;
const S_XORN = 50;
const S_EEL = 57;

interface WeaponAccuracyOptions {
    state?: GameState;
    random?: (limit: number) => number;
    rollOne?: (sides: number) => number;
}

function heroTarget(defender: Hero | Monster, state: GameState): defender is Hero {
    return defender === state.u;
}
export function rangedTargetHitBonus(object: GameObject, defender: Monster, {
    state = game, defenderNotices = false, random = rn2, rollOne = rnd,
}: WeaponAccuracyOptions & { defenderNotices?: boolean } = {}): number {
    const size = MONSTER_SIZE[defender.mnum];
    if (size === undefined) throw new RangeError(`Unknown ranged defender species ${defender.mnum}`);
    let bonus = size - 2;
    if (defender.msleeping) bonus += 2;
    const speciesCanMove = MONSTER_MOVE[defender.mnum] !== 0;
    if (!defender.mcanmove || !speciesCanMove) {
        bonus += 4;
        if (defenderNotices && speciesCanMove && random(10) === 0) {
            defender.mcanmove = 1;
            defender.mfrozen = 0;
        }
    }
    if (object.otyp === HEAVY_IRON_BALL) {
        if (object !== state.uball) bonus += 2;
    } else if (object.otyp === BOULDER) {
        bonus += 6;
    } else if (object.oclass === WEAPON_CLASS || object.oclass === GEM_CLASS
        || (object.oclass === TOOL_CLASS && OBJECT_SUBTYPE[object.otyp] !== 0)) {
        bonus += weaponHitBonus(object, defender, { state, random, rollOne });
    }
    return bonus;
}

export function weaponHitBonus(object: GameObject, defender: Hero | Monster, {
    state = game, random = rn2, rollOne = rnd,
}: WeaponAccuracyOptions = {}): number {
    const hero = heroTarget(defender, state);
    let target: { mnum: number; mx: number; my: number; cham?: number };
    if (heroTarget(defender, state)) {
        requireInitializedHero(defender);
        target = { mnum: defender.umonnum, mx: defender.ux, my: defender.uy };
    } else target = defender;
    const skill = OBJECT_SUBTYPE[object.otyp];
    const weapon = object.oclass === WEAPON_CLASS
        || (object.oclass === TOOL_CLASS && skill !== 0);
    const symbol = MONSTER_SYMBOL[target.mnum];
    const flags = MONSTER_FLAGS1[target.mnum];
    let bonus = OBJECT_HIT_BONUS[object.otyp];
    if (bonus === undefined || skill === undefined)
        throw new RangeError(`Unknown weapon type ${object.otyp}`);
    if (symbol === undefined || flags === undefined)
        throw new RangeError(`Unknown weapon defender species ${target.mnum}`);
    if (weapon) {
        if (object.spe === undefined)
            throw new Error(`Weapon ${object.otyp} has no enchantment value.`);
        bonus += object.spe;
    }
    if (weapon && object.blessed && monsterHatesBlessings(target)) bonus += 2;

    if (object.oclass === WEAPON_CLASS && skill === P_SPEAR
        && [S_XORN, S_DRAGON, S_JABBERWOCK, S_NAGA, S_GIANT].includes(symbol)) {
        bonus += 2;
    }
    if (object.otyp === TRIDENT && (flags & M1_SWIM)) {
        if (isPoolAt(target.mx, target.my, state)) bonus += 4;
        else if (symbol === S_EEL || symbol === S_SNAKE) bonus += 2;
    }
    if (weapon && skill === P_PICK_AXE
        && (flags & M1_WALLWALK) && (flags & M1_THICK_HIDE)) {
        bonus += 2;
    }
    if (object.oartifact) {
        bonus += artifactToHitBonus(object, target, rollOne, { hero, random, state });
    }
    return bonus;
}
