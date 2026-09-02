// Whether the hero can touch the floor at the current square.
// C refs: engrave.c can_reach_floor(), trap.c uteetering_at_seen_pit(),
// and trap.c uescaped_shaft().

import {
    P_RIDING, TT_PIT, is_hole, is_pit,
} from './const.js';
import { game } from './gstate.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_SIZE, MONSTER_SYMBOL,
} from './monster_data.js';

const M1_FLY = 0x00000001;
const M1_CLING = 0x00000010;
const M1_HIDE = 0x00000100;
const MZ_HUGE = 4;
const S_MIMIC = 13;
const AT_HUGS = 7;
const AT_ENGL = 11;
const AD_WRAP = 18;
const AD_STCK = 19;

function currentForm(state) {
    const hero = state.u;
    if (!Number.isInteger(hero?.umonnum)) return null;
    if ((hero.mtimedone ?? 0) > 0) return hero.umonnum;
    return Number.isInteger(hero.umonster)
        && hero.umonnum !== hero.umonster ? hero.umonnum : null;
}

function formSticks(state) {
    const attacks = MONSTER_ATTACKS[currentForm(state)] || [];
    return attacks.some(([attackType, damageType]) =>
        damageType === AD_STCK
        || (damageType === AD_WRAP && attackType !== AT_ENGL)
        || attackType === AT_HUGS);
}

function holderHugs(holder) {
    return (MONSTER_ATTACKS[holder?.mnum] || [])
        .some(([attackType]) => attackType === AT_HUGS);
}

function heroHidesOnCeiling(state) {
    const form = currentForm(state);
    if (form == null || !state.u?.uundetected) return false;
    const flags = MONSTER_FLAGS1[form] ?? 0;
    const symbol = MONSTER_SYMBOL[form];
    return !!(flags & M1_HIDE)
        && (!!(flags & M1_FLY)
            || (!!(flags & M1_CLING) && symbol !== S_MIMIC));
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
    return state.level?.traps?.find(trap =>
        trap.tx === hero?.ux && trap.ty === hero?.uy) || null;
}

function heroTeetersAtPit(state, trap) {
    return is_pit(trap?.ttyp) && !!(trap.tseen ?? trap.seen)
        && !(state.u?.utrap && state.u.utraptype === TT_PIT);
}

function heroEscapedShaft(trap) {
    return is_hole(trap?.ttyp) && !!(trap.tseen ?? trap.seen);
}

export function heroCanReachFloor(
    state = game,
    { checkPit = false } = {},
) {
    const hero = state.u || {};
    if (hero.uswallow) return false;
    if (hero.ustuck && !formSticks(state) && holderHugs(hero.ustuck))
        return false;

    const airLevel = state.level?.flags?.is_airlevel
        || sameDungeonLevel(hero.uz, state.air_level);
    const waterLevel = state.level?.flags?.is_waterlevel
        || sameDungeonLevel(hero.uz, state.water_level);
    if ((hero.levitating || hero.levitation || state.levitating)
        && !airLevel && !waterLevel) return false;
    if (hero.usteed && ridingSkill(state) < 2) return false;
    if (heroHidesOnCeiling(state)) return false;

    const form = currentForm(state);
    const flags = form == null ? 0 : MONSTER_FLAGS1[form] ?? 0;
    if (hero.flying || hero.flight || state.flying || (flags & M1_FLY)
        || (form != null && (MONSTER_SIZE[form] ?? 2) >= MZ_HUGE)) {
        return true;
    }

    const trap = checkPit ? trapAtHero(state) : null;
    return !trap
        || (!heroTeetersAtPit(state, trap) && !heroEscapedShaft(trap));
}
