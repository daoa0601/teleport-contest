// What the hero leaves behind after death.
// C refs: end.c:done_in_by()/really_done().

import { isZombieMaker } from './corpse_species.js';
import {
    G_GENOD, LEAVESTATUE, NON_PM, STONING,
} from './const.js';
import { game } from './gstate.js';
import { MONSTER_SYMBOL } from './monster_data.js';

const PM_HUMAN = 260;
const PM_HUMAN_MUMMY = 192;
const PM_HUMAN_ZOMBIE = 244;
const PM_VAMPIRE = 226;
const PM_WRAITH = 230;
const PM_GHOUL = 246;
const S_MUMMY = 39;
const S_VAMPIRE = 48;
const S_WRAITH = 49;

export function clearHeroRemains(state = game) {
    state.u.ugrave_arise = NON_PM;
    return NON_PM;
}

export function setHeroRemainsFromDeath(deathType, state = game) {
    state.u.ugrave_arise = deathType === STONING ? LEAVESTATUE : NON_PM;
    return state.u.ugrave_arise;
}

export function setHeroRemainsFromMonster(monster, state = game) {
    const symbol = MONSTER_SYMBOL[monster?.mnum];
    let arise = NON_PM;
    if (symbol === S_WRAITH) arise = PM_WRAITH;
    else if (symbol === S_MUMMY)
        arise = state.urace?.mummynum ?? PM_HUMAN_MUMMY;
    else if (isZombieMaker(monster?.mnum, !!monster?.mcan))
        arise = state.urace?.zombienum ?? PM_HUMAN_ZOMBIE;
    else if (symbol === S_VAMPIRE && state.urace?.mnum === PM_HUMAN)
        arise = PM_VAMPIRE;
    else if (monster?.mnum === PM_GHOUL) arise = PM_GHOUL;

    if (arise >= 0
        && ((state.mvitals?.[arise]?.mvflags ?? 0) & G_GENOD)) {
        arise = NON_PM;
    }
    state.u.ugrave_arise = arise;
    return arise;
}
