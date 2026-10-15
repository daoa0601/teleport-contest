// Native eat.c:eatcorpse(). Admission prepares the meal before its first bite.
import { applyCannibalPenalty } from './cannibalism.js';
import { SICK_VOMITABLE } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { recordCorpseDiet } from './food_conduct.js';
import { consumeFoodObject, consumeRemainingFood, touchFoodObject } from './food_lifecycle.js';
import { nonrottingCorpse, veganCorpse, vegetarianCorpse } from './food_traits.js';
import { game, requirePlayingGame } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { heroIsSick, startHeroSickness } from './hero_illness.js';
import { heroSpecies } from './hero_species.js';
import { MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SYMBOL, requireMonsterData, } from './monster_data.js';
import { corpseName, foodObjectName } from './objnam.js';
import { applyRottenFood } from './ordinary_food_effects.js';
import { poisonHeroStrengthAndHp } from './poison.js';
import { propertyIsActive } from './properties.js';
import { rn1, rn2, rnd } from './rng.js';
import { heroIsHallucinating } from './senses.js';
import { heroCanBeSlimed, PM_GREEN_SLIME } from './slime.js';
import { heroWouldPetrifyFromFlesh } from './stoning.js';
const M1_ACID = 0x08000000, M1_POIS = 0x10000000;
const M1_CARNIVORE = 0x20000000, M1_HERBIVORE = 0x40000000;
const M2_PNAME = 0x00080000, G_UNIQ = 0x1000, S_FUNGUS = 32;
// The caller has installed context.victual and keeps its food identity.
export async function prepareCorpseMeal(food, { state = game } = {}) {
    requirePlayingGame(state);
    const meal = state.context.victual;
    if (!meal || meal.key !== 'eat-food')
        throw new Error('Corpse preparation requires an active food meal');
    const species = corpseSpecies(food), glob = !!food.globby;
    await recordCorpseDiet(food, { state });
    let rotted = 0;
    if (!nonrottingCorpse(species)) {
        const age = food.on_ice
            ? food.age + Math.trunc((state.moves - food.age) / 2) : food.age;
        rotted = Math.trunc((state.moves - age) / (10 + rn2(20)));
        rotted += food.cursed ? 2 : food.blessed ? -2 : 0;
    }
    const stoneable = heroWouldPetrifyFromFlesh(species, state);
    const slimeable = species === PM_GREEN_SLIME && heroCanBeSlimed(state);
    if (!glob && !stoneable && !slimeable && rotted > 5) {
        await eatTaintedCorpse(food, state);
        return 'consumed';
    }
    let tastedHazard = false;
    if (requireMonsterData(MONSTER_FLAGS1, species) & M1_ACID && !propertyIsActive('acidResistance', state)) {
        tastedHazard = true;
        await pline('You have a very bad case of stomach acid.');
        await loseHeroHp(rnd(15), glob ? 'acidic glob' : 'acidic corpse', { state });
    }
    else if (requireMonsterData(MONSTER_FLAGS1, species) & M1_POIS && rn2(5)) {
        tastedHazard = true;
        await pline('Ecch - that must have been poisonous!');
        if (propertyIsActive('poisonResistance', state))
            await pline('You seem unaffected by the poison.');
        else
            await poisonHeroStrengthAndHp(rnd(4), rnd(15), glob ? 'poisonous glob' : 'poisonous corpse', { state });
    }
    else if ((rotted > 5 || rotted > 3 && rn2(5))
        && !propertyIsActive('sicknessResistance', state)) {
        tastedHazard = true;
        await pline(`You feel ${heroIsSick(state) ? 'very ' : ''}sick.`);
        await loseHeroHp(rnd(8), glob ? 'rotted glob' : 'cadaver', { state });
    }
    if (state.program_state.gameover)
        return 'dead';
    meal.reqtime = 3 + ((glob ? food.owt : requireMonsterData(MONSTER_BODY_META, species)[0]) >> 6);
    if (!tastedHazard && !nonrottingCorpse(species) && (food.orotten || !rn2(7))) {
        const passedOut = await applyRottenFood(food, { state });
        if (passedOut) {
            food.orotten = true;
            if (!await touchFoodObject(food, { state }))
                return 'delayed';
        }
        if (!requireMonsterData(MONSTER_BODY_META, species)[1]) {
            if (!passedOut)
                await pline('The corpse rots away completely.');
            await consumeFoodObject(food, { state });
            return 'consumed';
        }
        if (passedOut)
            return 'delayed';
        await consumeRemainingFood(food, 2, { state });
    }
    else if (['cockatrice', 'chickatrice'].includes(requireMonsterData(MONSTER_NAME, species))
        && (propertyIsActive('stoneResistance', state) || heroIsHallucinating(state))) {
        await pline('This tastes just like chicken!');
    }
    else if (requireMonsterData(MONSTER_NAME, species) === 'floating eye'
        && requireMonsterData(MONSTER_NAME, heroSpecies(state)) === 'raven') {
        await pline('You peck the eyeball with delight.');
    }
    else if (!tastedHazard) {
        await describeCorpseTaste(food, rotted, state);
    }
    return 'ready';
}
async function eatTaintedCorpse(food, state) {
    const species = corpseSpecies(food);
    const cannibal = await applyCannibalPenalty(species, { state, announce: false });
    const kind = requireMonsterData(MONSTER_SYMBOL, species) === S_FUNGUS ? 'fungoid vegetation'
        : vegetarianCorpse(species) ? 'protoplasm' : 'meat';
    await pline(`Ulch - that ${kind} was tainted${cannibal ? ', you cannibal' : ''}!`);
    if (propertyIsActive('sicknessResistance', state)) {
        await pline("It doesn't seem at all sickening, though...");
    }
    else {
        let turns = rn1(10, 10);
        const sickTurns = state.u.sickTurns ?? 0;
        if (heroIsSick(state) && turns > sickTurns)
            turns = Math.max(1, sickTurns - 1);
        await startHeroSickness({ state, turns,
            cause: corpseName(food, { adjective: 'rotted' }), type: SICK_VOMITABLE });
        await pline('(It must have died too long ago to be safe to eat.)');
    }
    await consumeFoodObject(food, { state });
}
async function describeCorpseTaste(food, rotted, state) {
    const species = corpseSpecies(food), flags = requireMonsterData(MONSTER_FLAGS1, heroSpecies(state));
    const carnivore = !!(flags & M1_CARNIVORE), herbivore = !!(flags & M1_HERBIVORE);
    const yummy = veganCorpse(species) ? !carnivore && herbivore : carnivore && !herbivore;
    const palatable = (vegetarianCorpse(species) ? herbivore : carnivore)
        && rn2(10) && (rotted < 1 || !rn2(rotted + 1));
    const choices = ['Tokay', 'Istringy', 'Igamey', 'Ifatty', 'Itough'];
    const tasteIndex = vegetarianCorpse(species) ? 0 : rn2(choices.length);
    const taste = choices[tasteIndex];
    if (taste === undefined)
        throw new RangeError(`Unknown corpse taste index ${tasteIndex}`);
    const hallucinating = heroIsHallucinating(state);
    const verb = hallucinating || palatable && taste[0] === 'I' ? 'is' : 'tastes';
    let description;
    if (hallucinating) {
        if (yummy)
            description = requireMonsterData(MONSTER_NAME, heroSpecies(state)) === 'tiger' ? 'gr-r-reat' : 'gnarly';
        else
            description = palatable ? 'copacetic' : 'grody';
    }
    else {
        description = yummy ? 'delicious' : palatable ? taste.slice(1) : 'terrible';
    }
    const prefix = requireMonsterData(MONSTER_FLAGS2, species) & M2_PNAME ? ''
        : requireMonsterData(MONSTER_GENO, species) & G_UNIQ ? 'The ' : 'This ';
    const name = foodObjectName(food, { state }).replace(/^the /i, '');
    await pline(`${prefix}${name} ${verb} ${description}${yummy || !palatable ? '!' : '.'}`);
}
function corpseSpecies(food) {
    if (food.corpsenm === undefined)
        throw new Error(`Corpse ${food.o_id} has no species`);
    return food.corpsenm;
}
//# sourceMappingURL=corpse_meal.js.map