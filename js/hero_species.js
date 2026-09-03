// The hero's current species and species-based weaknesses.
// C refs: you.h Upolyd and mondata.c mon_hates_silver().

import { Upolyd } from './const.js';
import {
    monsterHasHead, monsterSpeciesHatesSilver,
} from './monster_data.js';

export function heroSpecies(state) {
    if (Upolyd(state.u)) return state.u.umonnum;
    const race = state.urace;
    return state.flags?.female
        ? race?.femalenum ?? race?.malenum ?? race?.mnum
        : race?.malenum ?? race?.mnum;
}

export function heroHatesSilver(state) {
    if (Number.isInteger(state.u?.ulycn) && state.u.ulycn >= 0) return true;
    return monsterSpeciesHatesSilver(heroSpecies(state));
}

export function heroHasNoHead(state) {
    return Upolyd(state.u)
        && !monsterHasHead({ mnum: state.u.umonnum });
}
