// C eat.c:edibility_prompts(). Blessed food detection lasts until a warning
// is offered, whether the hero accepts or declines that meal.
import { heroNoseName } from './body_parts.js';
import { pline } from './display.js';
import { nonrottingCorpse, veganCorpse, vegetarianCorpse } from './food_traits.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { MONSTER_FLAGS1, MONSTER_NAME, requireMonsterData } from './monster_data.js';
import { APPLE, CORPSE, EGG, GLOB_OF_GREEN_SLIME, TIN } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { objectMaterial } from './object_material.js';
import { objectQuantity } from './object_stack.js';
import { objectName } from './objnam.js';
import { heroIsPolymorphed } from './polyself.js';
import { promptYesNo } from './query.js';
import { heroIsSlimeproof, PM_GREEN_SLIME } from './slime.js';
import { heroWouldPetrifyFromFlesh } from './stoning.js';
const M1_ACID = 0x08000000, M1_POIS = 0x10000000;
const WAX = 2, LEATHER = 7, BONE = 9, DRAGON_HIDE = 10, IRON = 11, MITHRIL = 17;
const RUST_MONSTER = MONSTER_NAME.indexOf('rust monster');
export async function checkFoodEdibility(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if ('kind' in object || !state.u.uedibility)
        return true;
    const warning = edibilityWarning(object, state);
    if (!warning)
        return true;
    const quantity = objectQuantity(object);
    const answer = await promptYesNo(`${warning}  Eat ${quantity === 1 ? 'it' : 'one'} anyway?`);
    await pline(`Your ${heroNoseName(state)} stops tingling and your sense of smell returns to normal.`);
    state.u.uedibility = 0;
    return answer === 'y';
}
function edibilityWarning(object, state) {
    const corpse = object.otyp === CORPSE;
    const species = object.corpsenm;
    const hero = state.u;
    const material = objectMaterial(object, state);
    if (corpse && species === undefined)
        throw new Error('Corpse edibility requires a species.');
    const conduct = hero.uconduct;
    let rotted = 0;
    if (corpse && !nonrottingCorpse(species)) {
        // C peek_at_iced_corpse_age() observes its slower aging without
        // removing the body from ice or disturbing its decay timer.
        const age = object.on_ice
            ? object.age + Math.trunc((state.moves - object.age) / 2) : object.age;
        rotted = Math.trunc((state.moves - age) / 10);
        if (object.cursed)
            rotted += 2;
        else if (object.blessed)
            rotted -= 2;
    }
    let stoneOrSlime = false;
    if ([CORPSE, EGG, TIN, GLOB_OF_GREEN_SLIME].includes(object.otyp)) {
        stoneOrSlime = species !== undefined && heroWouldPetrifyFromFlesh(species, state);
        if (species === PM_GREEN_SLIME || object.otyp === GLOB_OF_GREEN_SLIME)
            stoneOrSlime = !hero.unchanging && !state.unchanging && !heroIsSlimeproof(state);
    }
    const amount = objectQuantity(object);
    const noun = corpse && species !== undefined
        ? `${requireMonsterData(MONSTER_NAME, species)} corpse` : objectName(object, state);
    const smell = `The ${amount === 1 ? noun : makePlural(noun)} ${amount === 1 ? 'smells' : 'smell'}`;
    const pronoun = amount === 1 ? 'it' : 'they';
    const flags = corpse && species !== undefined
        ? requireMonsterData(MONSTER_FLAGS1, species) : 0;
    if (corpse && rotted > 5 && !hero.sicknessResistance)
        return `${smell} like ${pronoun} could be tainted!`;
    if (stoneOrSlime)
        return `${smell} like ${pronoun} could be something very dangerous!`;
    if (corpse && rotted > 5)
        return `${smell} like ${pronoun} could be tainted.`;
    if (object.orotten || corpse && rotted > 3)
        return `${smell} like ${pronoun} could be rotten!`;
    if (corpse && (flags & M1_POIS) && !hero.poisonResistance)
        return `${smell} like ${pronoun} might be poisonous!`;
    if (object.otyp === APPLE && object.cursed && !hero.sleepResistance)
        return `${smell} like ${pronoun} might have been poisoned.`;
    if (corpse && !vegetarianCorpse(species)
        && !conduct.unvegetarian && state.urole.key === 'monk')
        return `${smell} unhealthy.`;
    if (corpse && (flags & M1_ACID) && !hero.acidResistance)
        return `${smell} rather acidic.`;
    if (heroIsPolymorphed(state) && hero.umonnum === RUST_MONSTER
        && material >= IRON && material <= MITHRIL && object.oerodeproof)
        return `${smell} disgusting to you right now.`;
    if (!conduct.unvegan && ([LEATHER, BONE, DRAGON_HIDE, WAX].includes(material)
        || corpse && !veganCorpse(species)))
        return `${smell} foul and unfamiliar to you.`;
    if (!conduct.unvegetarian && ([LEATHER, BONE, DRAGON_HIDE].includes(material)
        || corpse && !vegetarianCorpse(species)))
        return `${smell} unfamiliar to you.`;
    return null;
}
//# sourceMappingURL=food_edibility.js.map