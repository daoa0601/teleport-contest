// C mon.c:can_be_hatched() and dead_species(). Extinction does not kill eggs.
import { G_GENOD } from './const.js';
import { game } from './gstate.js';
import { MONSTER_FLAGS1, MONSTER_NAME, monsterOlderForm, monsterYoungerForm, } from './monster_data.js';
import { rn2 } from './rng.js';
const PM_SCORPIUS = MONSTER_NAME.indexOf('Scorpius');
const PM_SCORPION = MONSTER_NAME.indexOf('scorpion');
const PM_KILLER_BEE = MONSTER_NAME.indexOf('killer bee');
const PM_QUEEN_BEE = MONSTER_NAME.indexOf('queen bee');
const PM_GARGOYLE = MONSTER_NAME.indexOf('gargoyle');
const PM_WINGED_GARGOYLE = MONSTER_NAME.indexOf('winged gargoyle');
const M1_OVIPAROUS = 0x00400000;
export function hatchableEggSpecies(species) {
    if (species == null)
        return -1;
    if (species === PM_SCORPIUS)
        species = PM_SCORPION;
    species = monsterOlderForm(species);
    if (species === PM_KILLER_BEE || species === PM_GARGOYLE)
        return species;
    if (((MONSTER_FLAGS1[species] ?? 0) & M1_OVIPAROUS)
        && (!rn2(77) || (species !== PM_QUEEN_BEE && species !== PM_WINGED_GARGOYLE)))
        return species;
    return -1;
}
export function eggSpeciesIsDead(species, state = game) {
    return species < 0 || !!((state.mvitals?.[species]?.mvflags ?? 0) & G_GENOD)
        || !!((state.mvitals?.[monsterYoungerForm(species)]?.mvflags ?? 0) & G_GENOD);
}
//# sourceMappingURL=egg_species.js.map