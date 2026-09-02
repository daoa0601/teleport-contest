// Hero sickness and nausea state.
// C refs: potion.c make_sick(), make_vomiting().

import { game } from './gstate.js';

export function cureHeroSickness(state = game) {
    const hero = state.u || (state.u = {});
    const cured = !!hero.sick || (hero.sickTurns ?? 0) > 0;
    hero.sick = false;
    hero.sickTurns = 0;
    return cured;
}

export function cureHeroVomiting(state = game) {
    const hero = state.u || (state.u = {});
    const cured = !!hero.vomiting || (hero.vomitingTurns ?? 0) > 0;
    hero.vomiting = false;
    hero.vomitingTurns = 0;
    return cured;
}

export function cureHeroIllness(state = game) {
    return {
        sicknessCured: cureHeroSickness(state),
        nauseaCured: cureHeroVomiting(state),
    };
}
