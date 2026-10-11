// Native corpse composition and decay exceptions.
// C refs: mondata.h vegan()/vegetarian(), eat.c nonrotting_corpse().
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
const S_BLOB = 2, S_JELLY = 10, S_VORTEX = 22, S_LIGHT = 25;
const S_ELEMENTAL = 31, S_FUNGUS = 32, S_PUDDING = 42, S_GHOST = 54, S_GOLEM = 55;
const PM_STALKER = MONSTER_NAME.indexOf('stalker');
const PM_FLESH_GOLEM = MONSTER_NAME.indexOf('flesh golem');
const PM_LEATHER_GOLEM = MONSTER_NAME.indexOf('leather golem');
const PM_BLACK_PUDDING = MONSTER_NAME.indexOf('black pudding');
const NONROTTING = new Set(['acid blob', 'lichen', 'lizard', 'Death', 'Pestilence', 'Famine']
    .map(name => MONSTER_NAME.indexOf(name)));
export function nonrottingCorpse(species) {
    return species !== undefined && NONROTTING.has(species);
}
export function veganCorpse(species) {
    if (species === undefined)
        return false;
    const symbol = MONSTER_SYMBOL[species];
    if (symbol === undefined)
        return false;
    return [S_BLOB, S_JELLY, S_FUNGUS, S_VORTEX, S_LIGHT, S_GHOST].includes(symbol)
        || symbol === S_ELEMENTAL && species !== PM_STALKER
        || symbol === S_GOLEM && species !== PM_FLESH_GOLEM && species !== PM_LEATHER_GOLEM;
}
export function vegetarianCorpse(species) {
    return veganCorpse(species)
        || species !== undefined && MONSTER_SYMBOL[species] === S_PUDDING && species !== PM_BLACK_PUDDING;
}
//# sourceMappingURL=food_traits.js.map