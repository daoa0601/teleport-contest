// Monster terrain rules.
// C ref: mon.c m_in_air() and minliquid().

import { game } from './gstate.js';
import { In_endgame, Is_earthlevel } from './const.js';
import { MONSTER_FLAGS1, MONSTER_SYMBOL } from './monster_data.js';
import { d, rn2 } from './rng.js';

const M1_FLY = 0x00000001;
const M1_SWIM = 0x00000002;
const M1_CLING = 0x00000010;
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;
const S_EYE = 5;
const S_LIGHT = 25;
const PM_GREMLIN = 40;
const PM_IRON_GOLEM = 259;

export function levelHasCeiling(state = game) {
    const flags = state.level?.flags || {};
    if (typeof flags.has_ceiling === 'boolean') return flags.has_ceiling;
    if (state !== game)
        return !(flags.is_endgame && !flags.is_earthlevel);
    return !(In_endgame(state.u?.uz) && !Is_earthlevel(state.u?.uz));
}

export function monsterInAir(monster, state = game) {
    if (!monster) return false;
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    if ((flags & M1_FLY) || symbol === S_EYE || symbol === S_LIGHT)
        return true;
    return !!(flags & M1_CLING)
        && levelHasCeiling(state)
        && !!monster.mundetected;
}

export function monsterSurvivesPool(monster) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    return !!(flags & (
        M1_SWIM | M1_CLING | M1_AMPHIBIOUS | M1_BREATHLESS
    ));
}

export function rollMonsterPoolReaction(
    monster,
    state = game,
    { random = rn2, rollDice = d } = {},
) {
    if (monsterInAir(monster, state) || monsterSurvivesPool(monster))
        return { kind: 'safe' };

    if (monster.mnum === PM_GREMLIN && random(3) !== 0)
        return { kind: 'split' };

    if (monster.mnum === PM_IRON_GOLEM && random(5) === 0) {
        const damage = rollDice(2, 6);
        return {
            kind: 'rust',
            damage,
        };
    }

    return { kind: 'drown' };
}
