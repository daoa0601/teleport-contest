// The hero's current species and species-based weaknesses.
// C refs: you.h Upolyd and mondata.c mon_hates_silver().

import { Upolyd } from './const.js';
import { monsterSpeciesHatesSilver } from './monster_data.js';

export function heroSpecies(state) {
    if (Upolyd(state.u)) return state.u.umonnum;
    return state.flags?.female
        ? state.urace?.femalenum ?? state.urace?.malenum
        : state.urace?.malenum;
}

export function heroHatesSilver(state) {
    if (Number.isInteger(state.u?.ulycn) && state.u.ulycn >= 0) return true;
    return monsterSpeciesHatesSilver(heroSpecies(state));
}
