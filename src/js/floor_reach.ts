// Whether the hero can touch the floor at the current square.
// C refs: engrave.c can_reach_floor(), trap.c uteetering_at_seen_pit(),
// and trap.c uescaped_shaft().

import {
    P_RIDING, TT_PIT, is_hole, is_pit,
} from './const.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { Monster } from './monster_types.js';
import type { Trap } from './map_types.js';

export type FloorReachProblem = 'swallowed' | 'held' | 'levitating'
    | 'riding' | 'ceiling' | 'pit-edge' | 'shaft-edge';
export interface FloorReachOptions { checkPit?: boolean }
import {
    MONSTER_ATTACKS, MONSTER_SIZE,
} from './monster_data.js';
import { AT_HUGS } from './monster_attack_types.js';
import {
    heroHidesOnCeiling, heroIsFlying, heroMonsterForm,
} from './polyself.js';
import { heroFormSticks } from './hero_species.js';

const MZ_HUGE = 4;

function holderHugs(holder: Monster): boolean {
    return (MONSTER_ATTACKS[holder?.mnum] || [])
        .some(([attackType]) => attackType === AT_HUGS);
}

function ridingSkill(state: GameState): number {
    return state.u?.weaponSkills?.[P_RIDING]?.skill ?? 0;
}

function sameDungeonLevel(current: DungeonLocation | null | undefined, target: DungeonLocation | null | undefined): boolean {
    return !!current && !!target
        && current.dnum === target.dnum
        && current.dlevel === target.dlevel;
}

function trapAtHero(state: GameState): Trap | null {
    const hero = state.u;
    return state.level?.traps?.find(trap =>
        trap.tx === hero?.ux && trap.ty === hero?.uy) || null;
}

export function heroTeetersAtPit(state: GameState, trap: Trap | null): boolean {
    return !!trap && is_pit(trap.ttyp) && !!trap.tseen
        && trap.tx === state.u.ux && trap.ty === state.u.uy
        && !(state.u?.utrap && state.u.utraptype === TT_PIT);
}

export function heroEscapedShaft(trap: Trap | null): boolean {
    return !!trap && is_hole(trap.ttyp) && !!trap.tseen;
}

export function floorReachProblem(
    state: GameState = game,
    { checkPit = false }: FloorReachOptions = {},
): FloorReachProblem | null {
    const hero = state.u;
    if (hero.uswallow) return 'swallowed';
    if (hero.ustuck && !heroFormSticks(state) && holderHugs(hero.ustuck))
        return 'held';

    const airLevel = sameDungeonLevel(hero.uz, state.air_level);
    const waterLevel = sameDungeonLevel(hero.uz, state.water_level);
    if ((hero.levitating || hero.levitation || state.levitating)
        && !airLevel && !waterLevel) return 'levitating';
    if (hero.usteed && ridingSkill(state) < 2) return 'riding';
    if (heroHidesOnCeiling(state)) return 'ceiling';

    const form = heroMonsterForm(state);
    if (heroIsFlying(state)
        || (form != null && (MONSTER_SIZE[form] ?? 2) >= MZ_HUGE)) {
        return null;
    }

    const trap = checkPit ? trapAtHero(state) : null;
    if (heroTeetersAtPit(state, trap)) return 'pit-edge';
    if (heroEscapedShaft(trap)) return 'shaft-edge';
    return null;
}

export function heroCanReachFloor(
    state: GameState = game,
    options: FloorReachOptions = {},
): boolean {
    return floorReachProblem(state, options) === null;
}
