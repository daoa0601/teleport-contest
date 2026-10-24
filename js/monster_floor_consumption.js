// Non-pet meals during post-move item handling.
// C mon.c:meatmetal(), meatobj(), and meatcorpse().
import { monsterCanTouchArtifact } from './artifacts.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { isRider } from './corpse_species.js';
import { canSeeMonster, newsym, plineWithContinuation } from './display.js';
import { placeCreatedObject } from './floor_object.js';
import { veganCorpse } from './food_traits.js';
import { requireGameLevel, requireLiveGame } from './gstate.js';
import { formatHeardMessage } from './hero_speech.js';
import { inventoryItemDescription } from './invent.js';
import { isLevelPrize } from './level_prize.js';
import { mksobj } from './mklev.js';
import { consumeMonsterObject } from './monster_consumption.js';
import { MONSTER_FLAGS1, MONSTER_NAME } from './monster_data.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { speciesEatsCorpses } from './monster_item_interest.js';
import { monsterName } from './monster_name.js';
import { monsterHasPoisonResistance, monsterHasStoneResistance } from './monster_resistance.js';
import { monsterIsSlimeproof } from './monster_unslime.js';
import { AMULET_OF_STRANGULATION, CORPSE, EGG, GLOB_OF_GREEN_SLIME, OBJECT_DESCRIPTIONS, RIN_SLOW_DIGESTION, ROCK, SCR_SCARE_MONSTER, TIN, } from './object_data.js';
import { unlinkObject } from './object_location.js';
import { objectMaterial } from './object_material.js';
import { splitObjectStack } from './object_stack.js';
import { objectResistsDestruction } from './object_state.js';
import { observeDistantObjectForNaming } from './objnam.js';
import { d, rn2, rnd } from './rng.js';
import { fleshPetrifies, touchPetrifies } from './stoning.js';
import { cansee } from './vision.js';
const WOOD = 8, IRON = 11, MITHRIL = 17;
const SCROLL_CLASS = 9, ROCK_CLASS = 14;
const M1_METALLIVORE = 0x80000000;
const PM_RUST_MONSTER = MONSTER_NAME.indexOf('rust monster');
const PM_GELATINOUS_CUBE = MONSTER_NAME.indexOf('gelatinous cube');
export async function consumeMonsterFloorObjects(monster, state, { originalSpecies, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation, }) {
    requireLiveGame(state);
    const context = { state, level: requireGameLevel(state), random, rollOne, rollDice, publish };
    let status = 0;
    if (!monster.mtame && !mealInterrupted(monster, context)) {
        if ((MONSTER_FLAGS1[originalSpecies] ?? 0) & M1_METALLIVORE)
            status = await eatMetal(monster, context);
        if (!mealInterrupted(monster, context) && originalSpecies === PM_GELATINOUS_CUBE)
            status = await eatOrEngulfPile(monster, context) || status;
        if (!mealInterrupted(monster, context) && speciesEatsCorpses(originalSpecies))
            status = await eatCorpse(monster, context) || status;
    }
    const died = !!monster.dead || monster.mhp <= 0;
    const leftLevel = !died && leftMealLevel(monster, context);
    return {
        nativeResult: died ? 2 : leftLevel ? 3 : status,
        died, leftLevel, heroDied: !!state.program_state.gameover,
    };
}
function leftMealLevel(monster, { state, level }) {
    return !!monster.migrating || state.level !== level || !level.monsters.includes(monster);
}
function mealInterrupted(monster, context) {
    return !!context.state.program_state.gameover || !!monster.dead || monster.mhp <= 0
        || leftMealLevel(monster, context);
}
async function eatMetal(monster, context) {
    const { state, level, random, rollOne, publish } = context;
    const visible = canSeeMonster(monster);
    for (const object of [...(level.objects[monster.mx]?.[monster.my] ?? [])]) {
        const material = objectMaterial(object, state);
        if ((monster.mnum === PM_RUST_MONSTER && material !== IRON)
            || chokingObject(object) || poisonousObject(object, monster))
            continue;
        if (material < IRON || material > MITHRIL
            || objectResistsDestruction(object, 5, 95, random)
            || !monsterCanTouchArtifact(monster, object, state))
            continue;
        if (monster.mnum === PM_RUST_MONSTER && object.oerodeproof) {
            if (visible)
                await describeEating(monster, object, context);
            object.oerodeproof = false;
            monster.mstun = 1;
            if (visible) {
                const name = await distantMealName(object, state);
                if (state.flags.verbose)
                    await publish(`${monsterName(monster, { state, capitalized: true })} spits ${name} out in disgust!`);
            }
            continue;
        }
        if (cansee(monster.mx, monster.my))
            await describeEating(monster, object, context);
        else
            await describeSound('a crunching sound.', context);
        monster.meating = Math.trunc(object.owt / 2) + 1;
        await consumeMonsterObject(monster, object, state, context);
        if (mealInterrupted(monster, context))
            return 1;
        if (rollOne(25) < 3)
            placeCreatedObject(await mksobj(ROCK, true, false), monster.mx, monster.my, state);
        newsym(monster.mx, monster.my);
        return 1;
    }
    return 0;
}
async function eatOrEngulfPile(monster, context) {
    const { state, level, random, publish } = context;
    const originalSpecies = monster.mnum;
    let eaten = 0, engulfed = 0, engulfMessage = '';
    for (const object of [...(level.objects[monster.mx]?.[monster.my] ?? [])]) {
        if (isLevelPrize(object, state))
            continue;
        if (object.otyp === CORPSE && isRider(object.corpsenm)) {
            if (await reviveMeal(object, context) || mealInterrupted(monster, context))
                break;
            continue;
        }
        if ((object.otyp === CORPSE && touchPetrifies(object.corpsenm)
            && !monsterHasStoneResistance(monster))
            || object.oclass === ROCK_CLASS || object === (state.uball || state.u.uball)
            || object === (state.uchain || state.u.uchain) || object.otyp === SCR_SCARE_MONSTER)
            continue;
        if (objectMaterial(object, state) > WOOD || objectResistsDestruction(object, 5, 95, random)
            || !monsterCanTouchArtifact(monster, object, state)
            || chokingObject(object) || poisonousObject(object, monster)
            || (petrifyingFood(object) && !monsterHasStoneResistance(monster))
            || (object.otyp === GLOB_OF_GREEN_SLIME && !monsterIsSlimeproof(monster))) {
            engulfed++;
            const name = await distantMealName(object, state);
            if (engulfed === 1)
                engulfMessage = `${monsterName(monster, { state, capitalized: true })} engulfs ${name}.`;
            else if (engulfed === 2)
                engulfMessage = `${monsterName(monster, { state, capitalized: true })} engulfs several objects.`;
            unlinkObject(object, state);
            await addObjectToMonsterInventory(monster, object, state);
        }
        else {
            eaten++;
            if (cansee(monster.mx, monster.my)) {
                await describeEating(monster, object, context);
                const description = state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp];
                if (object.oclass === SCROLL_CLASS && description === 'YUM YUM')
                    await publish(object.blessed ? 'Yum!' : 'Yum.');
            }
            else
                await describeSound('a slurping sound.', context);
            await consumeMonsterObject(monster, object, state, context);
            if (mealInterrupted(monster, context) || monster.mnum !== originalSpecies)
                return 1;
        }
        if (mealInterrupted(monster, context))
            return 1;
        if (monster.minvis)
            newsym(monster.mx, monster.my);
    }
    if (!mealInterrupted(monster, context) && engulfed > 0) {
        if (cansee(monster.mx, monster.my) && state.flags.verbose)
            await publish(engulfMessage);
        else
            await describeSound(engulfed === 1 ? 'a slurping sound.' : 'several slurping sounds.', context);
    }
    return eaten > 0 || engulfed > 0 ? 1 : 0;
}
async function eatCorpse(monster, context) {
    const { state, level } = context;
    const originalSpecies = monster.mnum;
    const x = monster.mx, y = monster.my;
    const pile = level.objects[x]?.[y] ?? [];
    for (const corpse of [...pile]) {
        if (corpse.otyp !== CORPSE || veganCorpse(corpse.corpsenm)
            || (fleshPetrifies(corpse.corpsenm) && !monsterHasStoneResistance(monster)))
            continue;
        if (isRider(corpse.corpsenm)) {
            if (await reviveMeal(corpse, context) || mealInterrupted(monster, context))
                break;
            continue;
        }
        const meal = splitCorpseMeal(corpse, state);
        if (cansee(x, y) && canSeeMonster(monster))
            await describeEating(monster, meal, context);
        else
            await describeSound('a masticating sound.', context);
        await consumeMonsterObject(monster, meal, state, context);
        if (!mealInterrupted(monster, context) && monster.mnum === originalSpecies && monster.minvis)
            newsym(x, y);
        return 1;
    }
    return 0;
}
function splitCorpseMeal(corpse, state) {
    if (corpse.quan <= 1)
        return corpse;
    const meal = splitObjectStack(corpse, 1, state);
    if (!meal)
        throw new Error(`Corpse ${corpse.o_id} could not split one meal`);
    return meal;
}
async function reviveMeal(object, { state, publish }) {
    const x = object.ox, y = object.oy;
    const revival = await reviveCorpseImmediately(object, state);
    if (revival)
        for (const message of revival.messages)
            await publish(message);
    newsym(x, y);
    return !!revival?.monster;
}
function chokingObject(object) {
    return object.otyp === AMULET_OF_STRANGULATION || object.otyp === RIN_SLOW_DIGESTION;
}
function poisonousObject(object, monster) {
    // Native stores trapped-container and poisoned-weapon state in one bit.
    return !!(object.opoisoned || object.otrapped) && !monsterHasPoisonResistance(monster);
}
function petrifyingFood(object) {
    return [CORPSE, EGG, TIN].includes(object.otyp) && fleshPetrifies(object.corpsenm);
}
async function distantMealName(object, state) {
    observeDistantObjectForNaming(object, state);
    return await inventoryItemDescription(object);
}
async function describeEating(monster, object, { state, publish }) {
    // Naming can identify an object even when verbose prose is disabled.
    const name = await distantMealName(object, state);
    if (state.flags.verbose)
        await publish(`${monsterName(monster, { state, capitalized: true })} eats ${name}!`);
}
async function describeSound(sound, { state, publish }) {
    if (!state.flags.verbose)
        return;
    const message = formatHeardMessage(sound, state);
    if (message)
        await publish(message);
}
//# sourceMappingURL=monster_floor_consumption.js.map