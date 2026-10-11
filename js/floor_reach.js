// Whether the hero can touch the floor at the current square.
// C refs: engrave.c can_reach_floor(), trap.c uteetering_at_seen_pit(),
// and trap.c uescaped_shaft().
import { P_RIDING, TT_PIT, is_hole, is_pit, } from './const.js';
import { game } from './gstate.js';
import { MONSTER_ATTACKS, MONSTER_SIZE, } from './monster_data.js';
import { AT_HUGS } from './monster_attack_types.js';
import { heroHidesOnCeiling, heroIsFlying, heroMonsterForm, } from './polyself.js';
import { heroFormSticks } from './hero_species.js';
const MZ_HUGE = 4;
function holderHugs(holder) {
    return (MONSTER_ATTACKS[holder?.mnum] || [])
        .some(([attackType]) => attackType === AT_HUGS);
}
function ridingSkill(state) {
    return state.u?.weaponSkills?.[P_RIDING]?.skill ?? 0;
}
function sameDungeonLevel(current, target) {
    return !!current && !!target
        && current.dnum === target.dnum
        && current.dlevel === target.dlevel;
}
function trapAtHero(state) {
    const hero = state.u;
    return state.level?.traps?.find(trap => trap.tx === hero?.ux && trap.ty === hero?.uy) || null;
}
function heroTeetersAtPit(state, trap) {
    return !!trap && is_pit(trap.ttyp) && !!trap.tseen
        && !(state.u?.utrap && state.u.utraptype === TT_PIT);
}
function heroEscapedShaft(trap) {
    return !!trap && is_hole(trap.ttyp) && !!trap.tseen;
}
export function floorReachProblem(state = game, { checkPit = false } = {}) {
    const hero = state.u;
    if (hero.uswallow)
        return 'swallowed';
    if (hero.ustuck && !heroFormSticks(state) && holderHugs(hero.ustuck))
        return 'held';
    const airLevel = sameDungeonLevel(hero.uz, state.air_level);
    const waterLevel = sameDungeonLevel(hero.uz, state.water_level);
    if ((hero.levitating || hero.levitation || state.levitating)
        && !airLevel && !waterLevel)
        return 'levitating';
    if (hero.usteed && ridingSkill(state) < 2)
        return 'riding';
    if (heroHidesOnCeiling(state))
        return 'ceiling';
    const form = heroMonsterForm(state);
    if (heroIsFlying(state)
        || (form != null && (MONSTER_SIZE[form] ?? 2) >= MZ_HUGE)) {
        return null;
    }
    const trap = checkPit ? trapAtHero(state) : null;
    if (heroTeetersAtPit(state, trap))
        return 'pit-edge';
    if (heroEscapedShaft(trap))
        return 'shaft-edge';
    return null;
}
export function heroCanReachFloor(state = game, options = {}) {
    return floorReachProblem(state, options) === null;
}
//# sourceMappingURL=floor_reach.js.map