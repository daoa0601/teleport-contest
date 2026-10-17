// Ordinary food first bites, finishing effects, and rotten-food illness.
// C refs: eat.c fprefx(), fpostfx(), rottenfood(), and garlic_breath().
import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import { heroLightHeadedFeeling, heroStomachName } from './body_parts.js';
import { nomul } from './command_state.js';
import { EXPL_FIERY, Is_airlevel, Is_waterlevel, MON_FLOOR, TIMEOUT } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { eggIsStale, isPyroliskEgg } from './egg_impact.js';
import { explode } from './explosion.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { useUpFloorObject } from './floor_consumption.js';
import { recordLiteracy } from './literacy.js';
import { readCookieFortune } from './rumor.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { makeDeaf } from './hero_hearing.js';
import { cureHeroSicknessWithMessages, cureHeroVomiting, startHeroVomiting } from './hero_illness.js';
import { makeConfused } from './hero_mental_status.js';
import { heroIsUnaware, putHeroToSleep } from './hero_sleep.js';
import { heroSpecies } from './hero_species.js';
import { foodWord } from './hunger.js';
import { consumeInventoryItem } from './invent.js';
import { AD_BLND, AT_ENGL } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_SYMBOL, monsterIsUndead, requireMonsterData, } from './monster_data.js';
import { makeMonsterFlee } from './monster_flee.js';
import { APPLE, CARROT, CLOVE_OF_GARLIC, CRAM_RATION, EGG, EUCALYPTUS_LEAF, FOOD_RATION, FORTUNE_COOKIE, LEMBAS_WAFER, LUMP_OF_ROYAL_JELLY, OBJECT_NAMES, PEAR, SLIME_MOLD, SPRIG_OF_WOLFSBANE, TRIPE_RATION, } from './object_data.js';
import { objectMaterial } from './object_material.js';
import { foodObjectName } from './objnam.js';
import { heroIsPolymorphed } from './polyself.js';
import { propertyIsActive } from './properties.js';
import { eatRoyalJelly } from './royal_jelly.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { eatPetrifyingEgg } from './stoning.js';
import { surfaceName } from './terrain_name.js';
import { purifyHeroLycanthropy } from './were.js';
const M1_HUMANOID = 0x00020000, M1_CARNIVORE = 0x20000000;
const M2_ELF = 0x10, M2_ORC = 0x80;
const LIQUID = 1, WOOD = 8, DRAGON_HIDE = 10;
const K_RATION = OBJECT_NAMES.indexOf('K-ration');
const C_RATION = OBJECT_NAMES.indexOf('C-ration');
const BLAND_FOODS = new Set([CRAM_RATION, K_RATION, C_RATION]);
// Native olfaction is based on monster class, not eyes or living anatomy.
const NO_OLFACTION = new Set([2, 5, 10, 22, 25, 31, 32, 42, 55]);
// The caller halves remaining nutrition and decides whether a meal can start.
export async function applyRottenFood(food, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const material = objectMaterial(food, state);
    const rottable = material <= WOOD && material !== LIQUID || material === DRAGON_HIDE;
    await pline(`Blecch!  ${rottable ? 'Rotten' : 'Awful'} ${foodWord(food, state)}!`);
    if (!rn2(4)) {
        await pline(formatFeltMessage(`rather ${heroIsHallucinating(state) ? 'trippy' : heroLightHeadedFeeling(state)}.`, state));
        await makeConfused((state.u.confusionTurns || 0) + d(2, 4), { state, talk: false });
    }
    else if (!rn2(4) && !heroIsBlind(state)) {
        await pline('Everything suddenly goes dark.');
        await makeBlinded((state.u.blindTurns || 0) + d(2, 10), { state, talk: false });
        if (!heroIsBlind(state))
            await pline('Your vision clears.');
    }
    else if (!rn2(3)) {
        const duration = rnd(10);
        const floating = state.u.levitating || state.levitating || propertyIsActive('levitation', state)
            || Is_airlevel(state.u.uz) || Is_waterlevel(state.u.uz);
        const ending = !heroIsBlind(state) ? 'goes dark'
            : floating ? 'you lose control of yourself'
                : `you slap against the ${state.u.usteed ? 'saddle' : surfaceName(state.u.ux, state.u.uy, state)}`;
        await pline(`The world spins and ${ending}.`);
        await makeDeaf((state.u.deafTurns || 0) + duration, { state, talk: false });
        nomul(-duration, state);
        state._helplessReason = 'unconscious from rotten food';
        state._helplessDoneMessage = 'You are conscious again.';
        state._afterMove = { kind: 'hear-again' };
        return true;
    }
    return false;
}
// Called only on an untouched, non-rotten ordinary food after touchfood.
// context.victual.reqtime is still the full native food delay at this point.
export async function applyOrdinaryFoodFirstBite(food, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const type = food.otyp;
    const species = heroSpecies(state);
    if (type === EGG) {
        if (isPyroliskEgg(food)) {
            if (state.inventory.includes(food))
                await consumeInventoryItem(food, state);
            else
                await useUpFloorObject(food, 1, { state });
            await explode(state.u.ux, state.u.uy, -11, d(3, 6), 0, EXPL_FIERY, { state });
            return mealResult(state, false);
        }
        if (eggIsStale(food, state)) {
            await pline('Ugh.  Rotten egg.');
            startHeroVomiting({ state, turns: Math.min(TIMEOUT, (state.u.vomitingTurns || 0) + d(10, 4)) });
            return mealResult(state);
        }
    }
    else if (type === FOOD_RATION) {
        if (state.u.uhunger <= 200)
            await pline(heroIsHallucinating(state)
                ? 'Oh wow, like, superior, man!' : 'This food really hits the spot!');
        else if (state.u.uhunger < 700)
            await pline(`This satiates your ${heroStomachName(state)}!`);
        return mealResult(state);
    }
    else if (type === TRIPE_RATION) {
        await tasteTripe(species, state);
        return mealResult(state);
    }
    else if (type === LEMBAS_WAFER) {
        if (heroHasRace('orc', M2_ORC, state)) {
            await pline('!#?&* elf kibble!');
            return mealResult(state);
        }
        if (heroHasRace('elf', M2_ELF, state)) {
            await pline('A little goes a long way.');
            return mealResult(state);
        }
    }
    else if (type === CLOVE_OF_GARLIC) {
        if (monsterIsUndead(species)) {
            startHeroVomiting({ state, turns: rn1(requireFoodMeal(state).reqtime, 5) });
            return mealResult(state);
        }
        await garlicBreath(state);
        if (state.program_state.gameover)
            return mealResult(state, false);
    }
    await ordinaryFoodFeedback(food, state);
    return mealResult(state);
}
export async function applyOrdinaryFoodPostEffects(food, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    switch (food.otyp) {
        case SPRIG_OF_WOLFSBANE:
            await purifyHeroLycanthropy({ state });
            break;
        case CARROT:
            if (!engulfingAttackBlinds(state))
                await makeBlinded(state.u.ucreamed || 0, { state });
            break;
        case FORTUNE_COOKIE:
            await readCookieFortune(food, { state });
            if (!heroIsBlind(state))
                recordLiteracy('became literate by reading the fortune inside a cookie', { state });
            break;
        case LUMP_OF_ROYAL_JELLY:
            await eatRoyalJelly(food, { state });
            break;
        case EGG:
            await eatPetrifyingEgg(food);
            break;
        case EUCALYPTUS_LEAF:
            if (!food.cursed) {
                await cureHeroSicknessWithMessages(state);
                if (cureHeroVomiting(state) && !heroIsUnaware(state))
                    await pline(formatFeltMessage('much less nauseated now.', state));
            }
            break;
        case APPLE:
            if (food.cursed && !heroResistsSleep(state)) {
                if (state.urace.name === 'dwarf' && heroIsHallucinating(state))
                    await pline('"Heigh-ho, ho-hum, I think I\'ll skip work today."');
                else if (heroIsDeaf(state) || state.flags.acoustics === false)
                    await pline('You fall asleep.');
                else
                    await publishHeardMessage('sinister laughter as you fall asleep...', pline, state);
                putHeroToSleep(rn1(11, 20), { state });
            }
            break;
    }
    return mealResult(state);
}
async function tasteTripe(species, state) {
    const flags = requireMonsterData(MONSTER_FLAGS1, species);
    if ((flags & M1_CARNIVORE) && !(flags & M1_HUMANOID)) {
        await pline('This tripe ration is surprisingly good!');
    }
    else if (heroHasRace('orc', M2_ORC, state)) {
        await pline(heroIsHallucinating(state) ? 'Tastes great!  Less filling!' : 'Mmm, tripe... not bad!');
    }
    else {
        await pline('Yak - dog food!');
        addExperience(1, 0, state);
        await checkExperienceLevel();
        if (rn2(2) && state.urole.key !== 'caveman' && state.urace.name !== 'orc')
            startHeroVomiting({ state, turns: rn1(requireFoodMeal(state).reqtime, 14) });
    }
}
function heroResistsSleep(state) {
    return !!state.u.sleepResistance || propertyIsActive('sleepResistance', state);
}
function heroHasRace(name, speciesFlag, state) {
    return heroIsPolymorphed(state)
        ? !!(requireMonsterData(MONSTER_FLAGS2, heroSpecies(state)) & speciesFlag) : state.urace.name === name;
}
async function ordinaryFoodFeedback(food, state) {
    const name = foodObjectName(food, { state });
    const hallucinating = heroIsHallucinating(state);
    if (food.otyp === SLIME_MOLD && !food.cursed && food.spe === state.context.current_fruit) {
        await pline(`My, this is a ${hallucinating ? 'primo' : 'yummy'} ${name}!`);
    }
    else if (food.otyp === APPLE && food.cursed && !heroResistsSleep(state)) {
        return;
        // The configured native build defines MACOS and UNIX. Apples take the
        // Mac branch; pears retain the UNIX core-dump message.
    }
    else if (food.otyp === APPLE) {
        await pline('Delicious!  Must be a Macintosh!');
    }
    else if (food.otyp === PEAR) {
        if (!hallucinating)
            await pline('Core dumped.');
        else {
            const fault = rnd(100);
            await pline(`${fault <= 75 ? 'Segmentation fault' : fault <= 99 ? 'Bus error' : "Yo\' mama"} -- core dumped.`);
        }
    }
    else {
        const taste = food.cursed ? (hallucinating ? 'grody!' : 'terrible!')
            : BLAND_FOODS.has(food.otyp) ? 'bland.' : hallucinating ? 'gnarly!' : 'delicious!';
        await pline(`This ${name} is ${taste}`);
    }
}
async function garlicBreath(state) {
    for (const monster of [...state.level.monsters].reverse()) {
        if (monster.mhp <= 0 || (monster.mstate ?? MON_FLOOR) !== MON_FLOOR
            || NO_OLFACTION.has(requireMonsterData(MONSTER_SYMBOL, monster.mnum)))
            continue;
        const dx = monster.mx - state.u.ux;
        const dy = monster.my - state.u.uy;
        if (dx * dx + dy * dy >= 7)
            continue;
        await makeMonsterFlee(monster, { state, announce: false });
        if (state.program_state.gameover)
            return;
    }
}
function mealResult(state, continueMeal = true) {
    const heroDied = !!state.program_state.gameover;
    return { continueMeal: continueMeal && !heroDied, heroDied };
}
function requireFoodMeal(state) {
    const meal = state.context.victual;
    if (meal?.key !== 'eat-food')
        throw new Error('This food effect requires an ordinary food meal.');
    return meal;
}
function engulfingAttackBlinds(state) {
    if (!state.u.uswallow)
        return false;
    const swallower = state.u.ustuck;
    if (!swallower)
        throw new Error('An engulfed hero must have a swallowing monster.');
    return requireMonsterData(MONSTER_ATTACKS, swallower.mnum).some(([method, damage]) => method === AT_ENGL && damage === AD_BLND);
}
//# sourceMappingURL=ordinary_food_effects.js.map