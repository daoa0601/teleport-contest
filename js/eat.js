// Hero eating and nutrition. Ports from eat.c.
import { heroCannotVomit, sameMonsterRace } from './mondata.js';
import { setHeroPetrificationTimeout, eatPetrifyingEgg, fleshPetrifies, formCanBecomeStoneGolem, heroIsPetrifying, heroResistsStoning, heroWouldPetrifyFromFlesh, selfTouchPetrifyingWeapons, } from './stoning.js';
import { removeHeroAccessory } from './accessory.js';
import { adjustHeroAlignment } from './alignment.js';
import { finishHeroHelplessness } from './allmain.js';
import { armorSimpleName } from './armor.js';
import { artifactById, artifactByName, touchArtifactByHero } from './artifacts.js';
import { adjustAttribute, attributeChangeMessage, currentAttribute, currentStrength, exerciseAttribute, exerciseWisdom, gainHeroStrength, } from './attrib.js';
import { extrinsicPropertyMask, intrinsicPropertyMask } from './attribute_provenance.js';
import { heroFingerName, heroLightHeadedFeeling, heroNoseName, heroStomachName } from './body_parts.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { bot } from './botl.js';
import { commandResultCancelled, commandResultSpentTime, currentMulti, setMulti } from './cmd.js';
import { ALTAR, A_CHA, A_CON, A_DEX, A_INT, A_LAWFUL, A_STR, A_WIS, CHOKING, DIED, DISMOUNT_FELL, EXPL_FIERY, FAINTED, FAINTING, GD_EATGOLD, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, HEALTHY_TIN, HOMEMADE_TIN, HUNGRY, Is_airlevel, Is_waterlevel, KILLED_BY, LUCKMIN, MON_FLOOR, M_AP_NOTHING, M_AP_OBJECT, M_ATTK_AGR_DIED, M_ATTK_HIT, M_ATTK_MISS, NOT_HUNGRY, PARANOID_EATING, RANDOM_TIN, ROTTEN_TIN, SATIATED, SICK_VOMITABLE, SPINACH_TIN, STARVED, STARVING, STONING, TIMEOUT, Upolyd, WEAK, W_AMUL, W_ARMOR, W_RING, W_SADDLE, W_TOOL, } from './const.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { impossible } from './diagnostics.js';
import { canSeeMonster, canSpotMonster, displayColorName, flush_screen, newsym, randomDisplayMonsterName, see_monsters, } from './display.js';
import { tryCallObjectType } from './do.js';
import { monsterName } from './do_name.js';
import { eggIsStale, isPyroliskEgg } from './egg_impact.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { finishHeroDeath, finishMonsterAttackDeath } from './end.js';
import { addExperience, checkExperienceLevel, gainExperienceLevel } from './exper.js';
import { explode } from './explosion.js';
import { useUpFloorObject } from './floor_consumption.js';
import { stack_object } from './floor_object.js';
import { heroCanReachFloor } from './floor_reach.js';
import { isEdibleFood, selectFoodToEat } from './food_selection.js';
import { nonrottingCorpse, veganCorpse, vegetarianCorpse } from './food_traits.js';
import { LL_CONDUCT, recordGameLogEvent } from './gamelog.js';
import { game, requireGameLevel, requireInitializedGame, requireLiveGame, requirePlayingGame, } from './gstate.js';
import { nomul } from './hack.js';
import { possessiveName } from './hacklib.js';
import { heroAcidBreathAttack, hitHeroWithRay } from './hero_breath.js';
import { hasNonArtifactConflict } from './hero_conflict.js';
import { loseHeroHp } from './hero_damage.js';
import { gainCorpseDisplacement } from './hero_displacement.js';
import { dropInventoryObjectAtHero, dropObjectAtHero } from './hero_drop.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { makeDeaf } from './hero_hearing.js';
import { cureHeroSicknessWithMessages, cureHeroVomiting, heroIsSick, startHeroSickness, startHeroVomiting, } from './hero_illness.js';
import { freeInventoryObject, useUpInventoryStack } from './hero_inventory.js';
import { heroIsInvisible, invisibilityIsBlocked, showInvisibilityMessage, syncHeroInvisibility, } from './hero_invisibility.js';
import { makeConfused, makeHallucinated, makeStunned } from './hero_mental_status.js';
import { retouchEquipment, retouchHeroObject } from './hero_retouch.js';
import { refreshHeroSeeing } from './hero_seeing.js';
import { heroIsUnaware, putHeroToSleep } from './hero_sleep.js';
import { changeHeroSex, heroIsBreathless, heroSpecies } from './hero_species.js';
import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import { meltIce } from './ice.js';
import { consumeInventoryItem, inventoryItemDescription } from './invent.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { chewIronBars } from './iron_bars_meal.js';
import { releaseObjectLeash } from './leash_apply.js';
import { recordLiteracy } from './literacy.js';
import { objectQuantity, splitObjectStack } from './mkobj.js';
import { finishEnvironmentalMonsterDeath, prepareMonsterPetrification, restoreNaturalMonsterShapes, } from './mon.js';
import { makeMonsterFlee } from './monmove.js';
import { AD_BLND, AD_HALU, AD_POLY, AD_STUN, AT_ENGL, AT_MAGC } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_CONVEYS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SYMBOL, monsterIsMindless, monsterIsNoncorporeal, monsterIsRider, monsterIsUndead, monsterTypeName, requireMonsterData, } from './monster_data.js';
import { learnObjectType, objectMaterial, observeObject, recordObjectKnowledge } from './o_init.js';
import { AMULET_OF_STRANGULATION, AMULET_OF_YENDOR, APPLE, AXE, CANDY_BAR, CARROT, CLOVE_OF_GARLIC, CORPSE, CRAM_RATION, CREAM_PIE, EGG, EUCALYPTUS_LEAF, FAKE_AMULET_OF_YENDOR, FLINT, FOOD_RATION, FORTUNE_COOKIE, GLOB_OF_GREEN_SLIME, GOLD_PIECE, LEASH, LEMBAS_WAFER, LUMP_OF_ROYAL_JELLY, MEAT_RING, OBJECT_CHARGED, OBJECT_DELAY, OBJECT_NAMES, OBJECT_NUTRITION, OBJECT_PROPERTY, ORANGE, PANCAKE, PEAR, PICK_AXE, RIN_PROTECTION, RIN_SLOW_DIGESTION, SCR_SCARE_MONSTER, SLIME_MOLD, SPRIG_OF_WOLFSBANE, TIN, TIN_OPENER, TRIDENT, TRIPE_RATION, requireObjectData, } from './object_data.js';
import { corpseName, definiteName, killerObjectName, makePlural, objectHasPersonalName, objectName, objectNameIsPlural, observeObjectForNaming, ownedObjectName, pluralizeObjectNoun, withIndefiniteArticle, } from './objnam.js';
import { stopHeroOccupation } from './occupation.js';
import { pline as immediatePline, plineWithContinuation as pline, plineWithContinuation } from './pline.js';
import { poisonHeroStrengthAndHp } from './poison.js';
import { heroHasNoHands, heroIsPolymorphed, heroIsUnchanging, heroIsVerySmall, heroMonsterForm, polymonHero, polymorphHero, returnHeroToHumanForm, } from './polyself.js';
import { altarWrath } from './pray.js';
import { captureLevitationState, grantIntrinsicProperty, hasCarriedProperty, hasIntrinsicProperty, hasInvokedProperty, hasPermanentIntrinsicProperty, hasTimedProperty, hasWornProperty, propertyIsActive, propertyIsBlocked, propertyTimeout, refreshProperty, removePermanentIntrinsicProperty, setPropertyTimeout, } from './properties.js';
import { unpunishHero } from './punishment.js';
import { drinkPotion } from './quaff.js';
import { paranoidQuery, promptYesNo, promptYesNoQuit } from './query.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { eatRoyalJelly } from './royal_jelly.js';
import { readCookieFortune } from './rumor.js';
import { stopRun } from './runmode.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { SELL_DONTSELL, SELL_NORMAL, chargeAlteredUnpaidObject, costlySpot, setSellDisposition, } from './shk.js';
import { makeBlinded } from './sight_change.js';
import { PM_GREEN_SLIME, heroCanBeSlimed, heroIsSlimeproof, startHeroSliming } from './slime.js';
import { dismountHero } from './steed.js';
import { floatHeroUp } from './terrain_movement.js';
import { surfaceName } from './terrain_name.js';
import { isIceAt } from './terrain_properties.js';
import { attrcurse } from './throne.js';
import { setSlipperyHands } from './towel.js';
import { flushPendingTopline } from './tty_topline.js';
import { addInventoryItem } from './u_init.js';
import { findVaultGuard } from './vault_guard.js';
import { monsterHasLineOfSightToHero } from './vision.js';
import { exceedsActionCapacity, nearCapacity, objectWeight } from './weight.js';
import { catchLycanthropyFromCorpse, purifyHeroLycanthropy, wereBeastForSpecies } from './were.js';
import { isWeldedPrimary, releaseWeaponSlots } from './wield.js';
import { wieldTool } from './wield_tool.js';
const M2_ELF = 0x00000010, M2_DWARF = 0x00000020, M2_ORC = 0x00000080;
const M1_METALLIVORE = 0x80000000;
const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;
const G_UNIQ = 0x1000;
const M2_PNAME = 0x00080000;
const PM_WIZARD = MONSTER_NAME.indexOf('Wizard of Yendor');
const PM_HIGH_CLERIC = MONSTER_NAME.indexOf('high cleric');
const PM_LONG_WORM_TAIL = MONSTER_NAME.indexOf('long worm tail');
const openingKnives = new Set([
    'dagger', 'silver dagger', 'elven dagger', 'orcish dagger',
    'athame', 'knife', 'stiletto', 'crysknife',
].map(name => OBJECT_NAMES.indexOf(name)));
// The last row is native tintxts' sentinel; random preparations exclude it.
const preparations = [
    { name: 'rotten', nutrition: -50 },
    { name: 'homemade', nutrition: 50, fodder: true },
    { name: 'soup made from', nutrition: 20, fodder: true },
    { name: 'french fried', nutrition: 40, greasy: true },
    { name: 'pickled', nutrition: 40, fodder: true },
    { name: 'boiled', nutrition: 50, fodder: true },
    { name: 'smoked', nutrition: 50, fodder: true },
    { name: 'dried', nutrition: 55, fodder: true },
    { name: 'deep fried', nutrition: 60, greasy: true },
    { name: 'szechuan', nutrition: 70, fodder: true },
    { name: 'broiled', nutrition: 80 },
    { name: 'stir fried', nutrition: 80, greasy: true },
    { name: 'sauteed', nutrition: 95 },
    { name: 'candied', nutrition: 100, fodder: true },
    { name: 'pureed', nutrition: 500, fodder: true },
    { name: '', nutrition: 0 },
];
const M1_HUMANOID = 0x00020000;
const LIQUID = 1, WOOD = 8, DRAGON_HIDE = 10;
const K_RATION = OBJECT_NAMES.indexOf('K-ration');
const C_RATION = OBJECT_NAMES.indexOf('C-ration');
const BLAND_FOODS = new Set([CRAM_RATION, K_RATION, C_RATION]);
// Native olfaction is based on monster class, not eyes or living anatomy.
const NO_OLFACTION = new Set([2, 5, 10, 22, 25, 31, 32, 42, 55]);
const M1_ACID = 0x08000000;
const PM_STONE_GOLEM = MONSTER_NAME.indexOf('stone golem');
// The human were-forms and their animal forms share neutral display names.
const HUMAN_WERE_FORMS = new Set([261, 262, 263]);
const domesticAnimals = new Set(['little dog', 'dog', 'large dog', 'kitten', 'housecat', 'large cat']);
const S_MIMIC = requireMonsterData(MONSTER_SYMBOL, MONSTER_NAME.indexOf('small mimic'));
const M1_TPORT = 0x02000000, M1_TPORT_CNTRL = 0x04000000;
const M2_GIANT = 0x00002000;
const TELEPATHIC_SPECIES = new Set([
    'floating eye', 'mind flayer', 'master mind flayer',
].map(name => MONSTER_NAME.indexOf(name)));
const KILLER_BEE = MONSTER_NAME.indexOf('killer bee');
const SCORPION = MONSTER_NAME.indexOf('scorpion');
// Native property order controls the reservoir draw for each candidate.
const RESISTANCES = [
    'fireResistance', 'coldResistance', 'sleepResistance',
    'disintegrationResistance', 'shockResistance', 'poisonResistance',
    'acidResistance', 'stoneResistance',
];
const CANDIDATES = [...RESISTANCES, 'telepathy', 'teleportation', 'teleportControl'];
const M1_POIS = 0x10000000;
const S_FUNGUS = 32;
const type = (name) => OBJECT_NAMES.indexOf(name);
const ADORNMENT = type('adornment'), STRENGTH = type('gain strength');
const CONSTITUTION = type('gain constitution'), ACCURACY = type('increase accuracy');
const DAMAGE = type('increase damage'), PROTECTION = type('protection');
const SEE_INVISIBLE = type('see invisible'), INVISIBILITY = type('invisibility');
const SHAPE_PROTECTION = type('protection from shape changers'), LEVITATION = type('levitation');
const FREE_ACTION = type('free action'), SUSTAIN = type('sustain ability');
const CHANGE = type('amulet of change'), UNCHANGING = type('amulet of unchanging');
const GUARDING = type('amulet of guarding'), STRANGULATION = type('amulet of strangulation');
const SLEEP = type('amulet of restful sleep');
const NO_DIGESTED_EFFECT = new Set([SUSTAIN, type('amulet of life saving'),
    type('amulet of flying'), type('amulet of reflection')]);
const WAX = 2, FLESH = 4, LEATHER = 7, BONE = 9;
const ANIMAL_INGREDIENTS = new Set([PANCAKE, FORTUNE_COOKIE, CREAM_PIE, CANDY_BAR, LUMP_OF_ROYAL_JELLY]);
const IRON = 11, MITHRIL = 17;
const RUST_MONSTER = MONSTER_NAME.indexOf('rust monster');
const FOOD_CLASS = 7, RING_CLASS = 4, AMULET_CLASS = 5, POTION_CLASS = 8;
const SCROLL_CLASS = 9, COIN_CLASS = 12, BALL_CLASS = 15, CHAIN_CLASS = 16;
const PAPER = 5;
const SCR_MAIL = OBJECT_NAMES.indexOf('mail');
// C eat.c:init_uhunger(). Hunger weakens temporary, not innate, strength.
export async function restoreHeroNutrition(state = game, publish = plineWithContinuation) {
    requirePlayingGame(state);
    const hero = state.u;
    state.context.botl = hero.uhs !== NOT_HUNGRY || (hero.atemp?.a[A_STR] ?? 0) < 0;
    hero.uhunger = 900;
    hero.uhs = NOT_HUNGRY;
    if (!hero.atemp || !(hero.atemp.a[A_STR] < 0))
        return;
    hero.atemp.a[A_STR] = 0;
    await reportHeroEncumbrance(state, publish);
}
// C eat.c:eatmdone().
export async function finishMealMimicry(state = game) {
    if (state._helplessDoneMessage === state._mimicMealMessage)
        state._helplessDoneMessage = null;
    state._mimicMealMessage = null;
    if (state.u.m_ap_type) {
        state.u.m_ap_type = M_AP_NOTHING;
        await newsym(state.u.ux, state.u.uy);
    }
}
// C eat.c:eatmupdate().
export async function updateMealMimicry(state = game) {
    if (!state._mimicMealMessage || state._helplessDoneMessage !== state._mimicMealMessage
        || state.u.m_ap_type !== M_AP_OBJECT)
        return;
    const hallucinating = heroIsHallucinating(state);
    if (state.u.mappearance === ORANGE && !hallucinating) {
        state._mimicMealMessage = 'You now prefer mimicking yourself.';
        state.u.mappearance = GOLD_PIECE;
    }
    else if (state.u.mappearance === GOLD_PIECE && hallucinating) {
        state._mimicMealMessage = 'Your rind escaped intact.';
        state.u.mappearance = ORANGE;
    }
    else
        return;
    state._helplessDoneMessage = state._mimicMealMessage;
    await newsym(state.u.ux, state.u.uy);
}
// C eat.c:food_xname(): eating describes one item, even in a larger stack.
export function foodObjectName(object, { state = game, definite = false, } = {}) {
    if (object.otyp === CORPSE)
        return corpseName(object, { singular: true, definite });
    const name = objectName(object, state);
    return definite ? definiteName(name, state) : name;
}
// C eat.c:choke(). An initially hungry eater cannot choke merely because
// the meal fills her up; canchoke retains the state from before the meal.
export async function chokeHeroOnFood(food, { state = game } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    if (hero.uhs !== SATIATED && food?.otyp !== AMULET_OF_STRANGULATION)
        return;
    if (hero.uhs === SATIATED && state.urole?.key === 'knight'
        && hero.ualign.type === A_LAWFUL) {
        adjustHeroAlignment(-1, state);
        await plineWithContinuation(formatFeltMessage('like a glutton!', state));
    }
    await exerciseAttribute(A_CON, false, state);
    if (heroIsBreathless(state) || hero.hunger
        || !(hero.strangled || (hero.strangledTurns ?? 0) > 0) && rn2(20) === 0) {
        if (food?.otyp === AMULET_OF_STRANGULATION) {
            await plineWithContinuation('You choke, but recover your composure.');
            return;
        }
        await plineWithContinuation('You stuff yourself and then vomit voluminously.');
        await spendHeroNutrition(hero.hunger ? hero.uhunger - 60 : 1000, { state });
        if (state.program_state.gameover)
            return;
        await vomitHero({ state, publish: plineWithContinuation });
        return;
    }
    await plineWithContinuation(food ? `You choke over your ${foodWord(food, state)}.`
        : 'You choke over it.');
    const cause = !food ? 'a quick snack' : food.oclass === 12
        ? 'a very rich meal' : killerObjectName(food, state);
    await plineWithContinuation('You die...');
    const died = await finishHeroDeath({
        killer: cause, deathCause: `choked on ${cause}`, deathVerb: 'choked',
        deathType: CHOKING, deathLineShown: true,
    });
    if (!died)
        await updateHeroHunger(false, { state });
}
// C eat.c:obj_nutrition().
export function foodNutrition(food) {
    if (food.otyp === CORPSE) {
        const species = food.corpsenm;
        return species === undefined ? 0 : MONSTER_BODY_META[species]?.[1] ?? 0;
    }
    return food.globby ? food.owt : requireObjectData(OBJECT_NUTRITION, food.otyp);
}
// C eat.c:adj_victual_nutrition().
function adjustedBiteNutrition(meal, state) {
    let nutrition = -meal.nmod;
    const race = requireMonsterData(MONSTER_FLAGS2, heroSpecies(state));
    const food = currentMealFood(meal);
    const elf = Upolyd(state.u) ? race & M2_ELF : state.urace.name === 'elf';
    const orc = Upolyd(state.u) ? race & M2_ORC : state.urace.name === 'orc';
    const dwarf = Upolyd(state.u) ? race & M2_DWARF : state.urace.name === 'dwarf';
    if (food.otyp === LEMBAS_WAFER) {
        if (elf)
            nutrition += Math.trunc((nutrition + 2) / 4);
        else if (orc)
            nutrition -= Math.trunc((nutrition + 2) / 4);
    }
    else if (food.otyp === CRAM_RATION && dwarf) {
        nutrition += Math.trunc((nutrition + 3) / 6);
    }
    return Math.max(nutrition, 1);
}
// C eat.c:touchfood().
// A bite splits the actual stack, including its timers and unpaid bill.
// A carried bite is reinserted without merging; a full pack drops it instead.
export async function touchFoodObject(food, { state = game } = {}) {
    requireLiveGame(state);
    const carried = food.where === 'inventory';
    const quantity = objectQuantity(food);
    if (quantity > 1) {
        const split = splitObjectStack(food, carried ? 1 : quantity - 1, state);
        if (!split)
            throw new Error(`Food stack ${food.o_id} could not be split`);
        if (carried)
            food = split;
    }
    if (!food.oeaten) {
        await chargeAlteredUnpaidObject(food, 'bite', state);
        food.oeaten = foodNutrition(food);
    }
    if (carried) {
        await freeInventoryObject(food, state);
        if (state.program_state.gameover)
            return null;
        const slots = state.inventory.filter(object => object.otyp !== GOLD_PIECE).length;
        if (slots >= 52) {
            setSellDisposition(SELL_DONTSELL);
            try {
                await dropObjectAtHero(food, { state });
            }
            finally {
                setSellDisposition(SELL_NORMAL);
            }
            if (food.where === 'gone')
                return null;
        }
        else {
            const noMerge = food.nomerge;
            food.nomerge = true;
            const carriedFood = await addInventoryItem(food, null, false);
            if (!carriedFood)
                throw new Error(`Food ${food.o_id} could not be returned to inventory`);
            food = carriedFood;
            if (noMerge === undefined)
                delete food.nomerge;
            else
                food.nomerge = noMerge;
        }
    }
    requirePreparedFood(food);
    return food;
}
// C eat.c:touchfood().
export function requirePreparedFood(food) {
    if (food.oeaten === undefined)
        throw new Error(`Food ${food.o_id} has not been prepared for eating`);
}
// C eat.c:do_reset_eat().
async function resetFoodMeal(state) {
    const meal = state.context.victual;
    if (meal?.piece && meal.piece.where !== 'gone') {
        meal.o_id = 0;
        meal.piece = await touchFoodObject(meal.piece, { state });
        if (meal.piece) {
            meal.o_id = meal.piece.o_id;
            meal.piece.owt = objectWeight(meal.piece);
        }
    }
    if (meal)
        meal.fullwarn = meal.eating = meal.doreset = false;
    await stopHeroOccupation(state);
    if (!state.program_state.gameover)
        await updateHeroHunger(false, { state });
}
function roundNutritionTime(value, divisor) {
    const quotient = Math.trunc(value / divisor);
    return quotient + Number(2 * (value % divisor) >= divisor);
}
// C eat.c:temp_resist().
export function temporaryResistance(property) {
    return propertyTimeout(property) && !(intrinsicPropertyMask(property) & ~TIMEOUT)
        && !extrinsicPropertyMask(property) && !propertyIsBlocked(property) ? 'temporarily ' : '';
}
// C eat.c:eating_dangerous_corpse().
export function eatingDangerousCorpse(property, { state = game } = {}) {
    if (state._occupation?.key !== 'eat-food')
        return false;
    const food = state.context.victual?.piece;
    if (food?.otyp !== CORPSE || food.corpsenm === undefined || food.corpsenm < 0)
        return false;
    const available = food.where === 'inventory'
        || food.where === 'floor' && food.ox === state.u.ux && food.oy === state.u.uy
            && requireGameLevel(state).objects[food.ox]?.[food.oy]?.includes(food);
    if (!available)
        return false;
    return property === 'acidResistance' ? !!(requireMonsterData(MONSTER_FLAGS1, food.corpsenm) & M1_ACID)
        : property === 'stoneResistance' && fleshPetrifies(food.corpsenm);
}
// C eat.c:eatfood().
export async function continueFoodMeal(_occupation, state = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const meal = state.context.victual;
    const food = meal?.piece;
    const available = food && (food.where === 'inventory'
        || food.where === 'floor' && food.ox === state.u.ux && food.oy === state.u.uy
            && state.level.objects[food.ox]?.[food.oy]?.includes(food));
    if (!available || !meal || meal.key !== 'eat-food') {
        await resetFoodMeal(state);
        return false;
    }
    if (!meal.eating) {
        state._occupation = null;
        return false;
    }
    if (++meal.usedtime > meal.reqtime) {
        await finishFoodMeal(state, true);
        return false;
    }
    const choked = await takeFoodBite(state);
    if (choked || state.program_state.gameover)
        state._occupation = null;
    return !choked && !state.program_state.gameover;
}
// C eat.c:eatfood().
function currentFoodMeal(state) {
    const meal = state.context.victual;
    if (!meal || meal.key !== 'eat-food')
        throw new Error('No food meal is active');
    return meal;
}
// C eat.c:eatfood().
function currentMealFood(meal) {
    if (!meal.piece)
        throw new Error(`The current meal no longer has food object ${meal.o_id}`);
    return meal.piece;
}
// C eat.c:done_eating().
async function finishFoodMeal(state, showMessage) {
    const food = currentMealFood(currentFoodMeal(state));
    food.in_use = true;
    state._occupation = null;
    await updateHeroHunger(false, { state });
    if (state.program_state.gameover)
        return;
    if (state._helplessDoneMessage) {
        if (showMessage)
            await pline(state._helplessDoneMessage);
        state._helplessDoneMessage = null;
    }
    else if (showMessage) {
        const verb = MONSTER_NAME[heroSpecies(state)] === 'fire elemental' ? 'consuming' : 'eating';
        await pline(`You finish ${verb} ${foodObjectName(food, { state, definite: true })}.`);
    }
    if (food.otyp === CORPSE || food.globby)
        await applyCorpsePostEffects(corpseSpecies(food), { state });
    else
        await applyOrdinaryFoodPostEffects(food, { state });
    if (state.program_state.gameover)
        return;
    await consumeFoodObject(food, { state });
    state.context.victual = null;
}
// C eat.c:done_eating().
export async function consumeFoodObject(food, { all = false, state = game } = {}) {
    requireLiveGame(state);
    if (food.where === 'inventory') {
        if (all)
            await useUpInventoryStack(food, state);
        else
            await consumeInventoryItem(food, state);
    }
    else {
        await useUpFloorObject(food, all ? objectQuantity(food) : 1, { state });
    }
}
// C eat.c:eating_conducts().
// Tins and brain eating use one shared log scope for food and both diets.
export async function eatingConducts(species, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const name = requireMonsterData(MONSTER_NAME, species);
    let logged = incrementFood(`ate for the first time - ${name}`, state);
    if (!veganCorpse(species) && incrementConduct('unvegan', state) && !logged) {
        recordGameLogEvent(`consumed animal products (${name}) for the first time`, { state, flags: LL_CONDUCT });
        logged = true;
    }
    if (!vegetarianCorpse(species)) {
        if (!state.u.uconduct.unvegetarian && !logged)
            recordGameLogEvent(`tasted meat (${name}) for the first time`, { state, flags: LL_CONDUCT });
        await violateVegetarian(state);
    }
}
// C eat.c:eating_conducts().
function incrementFood(message, state) {
    const first = incrementConduct('food', state);
    if (first)
        recordGameLogEvent(message, { state, flags: LL_CONDUCT });
    return first;
}
// C eat.c:eating_conducts().
function incrementConduct(key, state) {
    const conduct = state.u.uconduct;
    const first = !conduct[key];
    conduct[key] = (conduct[key] || 0) + 1;
    return first;
}
// C eat.c:eat_brains(), monster mind flayer eating the hero's brain.
// Called from uhitm.ts (mhitm_ad_drin()'s hero branch).
export async function eatHeroBrain(monster, attack, state, publish, rollOne) {
    rollOne(10);
    const body = { mnum: heroSpecies(state) };
    if (monsterIsNoncorporeal(body)) {
        await publish('Your brain is unharmed.');
        return false;
    }
    await publish('Your brain is eaten!');
    if (fleshPetrifies(body.mnum)) {
        if (canSeeMonster(monster))
            await publish(`${monsterName(monster, { state, capitalized: true })} turns to stone!`);
        const stone = await prepareMonsterPetrification(monster, { publish });
        if (stone.survived)
            return false;
        await finishEnvironmentalMonsterDeath(monster, state, {
            noCorpse: true, stoneRemains: stone.remains ?? null, publish,
        });
        return true;
    }
    const attributes = state.u.acurr?.a;
    if (!attributes)
        throw new Error('Brain drain requires initialized hero attributes');
    const minimum = state.urace.attrmin[A_INT];
    if (attributes[A_INT] <= minimum) {
        const options = { attribution: {
                kind: 'death-inflicted-by', killer: 'brainlessness', deathCause: 'killed by brainlessness',
            } };
        if (propertyIsActive('lifeSaving', state) || state.u.lifeSaving) {
            if (await finishMonsterAttackDeath(monster, options)) {
                attack.heroDied = true;
                return false;
            }
            await publish('Unfortunately your brain is still gone.');
        }
        else
            await publish('Your last thought fades away.');
        if (await finishMonsterAttackDeath(monster, options)) {
            attack.heroDied = true;
            return false;
        }
        attributes[A_INT] = minimum + 2;
        await publish(formatFeltMessage('like a scarecrow.', state));
    }
    exerciseWisdom(false, state);
    if (monster.mtame && !monster.isminion) {
        const pet = monster.edog ?? monster.mextra?.edog;
        if (!pet)
            throw new Error('A brain-eating pet needs feeding state');
        pet.hungrytime += rollOne(60);
        monster.mconf = 0;
    }
    return true;
}
// C eat.c:eat_brains().
export async function eatMonsterBrain(attacker, defender, damage, { state, visible, random, rollOne, publish, finishDeath }) {
    const extraDamage = rollOne(10);
    if (attacker.mhp <= 0)
        return { damage, hitFlags: M_ATTK_AGR_DIED, heroDied: false };
    if (monsterIsNoncorporeal(defender)) {
        if (visible) {
            const name = possessiveName(monsterName(defender, { state, capitalized: true }));
            await publish(`${name} brain is unharmed.`);
        }
        return { damage, hitFlags: M_ATTK_MISS, heroDied: false };
    }
    if (visible && canSpotMonster(defender)) {
        const name = possessiveName(monsterName(defender, { state, capitalized: true }));
        await publish(`${name} brain is eaten!`);
    }
    if (fleshPetrifies(defender.mnum)) {
        if (visible && canSeeMonster(attacker)) {
            await publish(`${monsterName(attacker, { state, capitalized: true })} turns to stone!`);
        }
        // eat_brains calls monstone directly: no food cure, resistance check,
        // or golem conversion precedes its life-saving and statue handling.
        const stone = await prepareMonsterPetrification(attacker, { publish });
        if (stone.heroDied)
            return { damage, hitFlags: M_ATTK_MISS, heroDied: true };
        if (stone.survived)
            return { damage, hitFlags: M_ATTK_MISS, heroDied: false };
        const death = await finishDeath(attacker, {
            noCorpse: true, stoneRemains: stone.remains ?? null, random, publish,
        });
        if (death.heroDied)
            return { damage, hitFlags: M_ATTK_AGR_DIED, heroDied: true };
        if (attacker.mtame && !visible) {
            await publish('You have a sad thought for a moment, then it passes.');
        }
        return { damage, hitFlags: M_ATTK_AGR_DIED, heroDied: false };
    }
    if (monsterIsMindless(defender.mnum)) {
        if (visible && canSpotMonster(defender)) {
            await publish(`${monsterName(defender, { state, capitalized: true })} doesn't notice.`);
        }
        return { damage, hitFlags: M_ATTK_MISS, heroDied: false };
    }
    if (monsterIsRider(defender)) {
        const death = await finishDeath(attacker, { random, publish });
        return {
            damage: damage + extraDamage,
            hitFlags: attacker.mhp <= 0 ? M_ATTK_AGR_DIED : M_ATTK_HIT,
            heroDied: !!death.heroDied,
        };
    }
    damage += extraDamage;
    if (damage >= defender.mhp && visible && canSpotMonster(defender)) {
        const name = possessiveName(monsterName(defender, { state, capitalized: true }));
        await publish(`${name} last thought fades away...`);
    }
    if (attacker.mtame && !attacker.isminion) {
        const pet = attacker.edog || attacker.mextra?.edog;
        if (!pet)
            throw new Error(`Brain-eating pet ${attacker.m_id} has no feeding state`);
        // Unlike a regular meal, brains do not reset an overdue deadline or
        // reverse the HP penalty from starvation.
        pet.hungrytime += rollOne(60);
        attacker.mconf = 0;
    }
    return { damage, hitFlags: M_ATTK_HIT, heroDied: false };
}
// C eat.c:maybe_cannibal().
export function heroMayEatOwnKind(state = game) {
    requirePlayingGame(state);
    return state.urole.key === 'caveman' || state.urace.name === 'orc';
}
// C eat.c:maybe_cannibal().
export async function applyCannibalPenalty(mnum, { state = game, announce = true } = {}) {
    requirePlayingGame(state);
    if ((state._cannibalCheckMove ?? 0) === state.moves)
        return false;
    state._cannibalCheckMove = state.moves;
    const ownRace = !!(requireMonsterData(MONSTER_FLAGS2, mnum) & state.urace.selfmask);
    const sameForm = Upolyd(state.u) && sameMonsterRace(heroSpecies(state), mnum);
    const sameWereKind = state.u.ulycn >= 0 && wereBeastForSpecies(mnum) === state.u.ulycn;
    if (heroMayEatOwnKind(state) || !(ownRace || sameForm || sameWereKind))
        return false;
    if (announce) {
        if (Upolyd(state.u) && ownRace)
            await plineWithContinuation('You have a bad feeling deep inside.');
        await plineWithContinuation('You cannibal!  You will regret this!');
    }
    grantIntrinsicProperty('aggravateMonster', 'outside', state);
    state.u.uluck = Math.max(LUCKMIN, (state.u.uluck || 0) - rn1(4, 2));
    return true;
}
// C eat.c:cprefx().
export async function applyCorpsePreEffects(mnum, { state = game, food = null, tin = null } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    await applyCannibalPenalty(mnum, { state });
    if (fleshPetrifies(mnum) && !heroResistsStoning(state)) {
        let transformed = false;
        if (formCanBecomeStoneGolem(heroSpecies(state), state)) {
            transformed = !!(await polymonHero(PM_STONE_GOLEM)).transformed;
            if (state.program_state.gameover)
                return { stopped: true, heroDied: true };
        }
        if (!transformed) {
            if (tin)
                await useUpTin(tin, { state });
            await plineWithContinuation('You turn to stone.');
            const heroDied = await finishHeroDeath({
                killer: `tasting ${requireMonsterData(MONSTER_NAME, mnum)} meat`,
                killerFormat: KILLED_BY, deathType: STONING,
                deathVerb: 'turned to stone', deathLineShown: true,
            });
            if (!heroDied && state.context.victual?.piece)
                state.context.victual.eating = false;
            return { stopped: true, heroDied: !!heroDied };
        }
    }
    const name = requireMonsterData(MONSTER_NAME, mnum);
    if (domesticAnimals.has(name) && !heroMayEatOwnKind(state)) {
        await plineWithContinuation(formatFeltMessage(`that eating the ${name} was a bad idea.`, state));
        grantIntrinsicProperty('aggravateMonster', 'outside', state);
    }
    else if (name === 'lizard') {
        if (heroIsPetrifying(state))
            await fixHeroPetrification({ state });
    }
    else if (monsterIsRider({ mnum })) {
        await plineWithContinuation('Eating that is instantly fatal.');
        const cause = `unwisely ate the body of ${name}`;
        const heroDied = await finishHeroDeath({ killer: cause, deathCause: cause, deathType: DIED });
        if (heroDied)
            return { stopped: true, heroDied: true };
        exerciseWisdom(false, state);
        if (food?.otyp === CORPSE) {
            const revival = await reviveCorpseImmediately(food, state);
            for (const message of revival?.messages || [])
                await plineWithContinuation(message);
            if (revival?.kind === 'revived') {
                state.context.victual = null;
                return { stopped: true, heroDied: false };
            }
        }
    }
    else {
        if (name === 'green slime' && heroCanBeSlimed(state)) {
            await plineWithContinuation("You don't feel very well.");
            startHeroSliming({ state, killer: '' });
        }
        if (requireMonsterData(MONSTER_FLAGS1, mnum) & M1_ACID && heroIsPetrifying(state))
            await fixHeroPetrification({ state });
    }
    return { stopped: false, heroDied: !!state.program_state.gameover };
}
// C eat.c:fix_petrification(): the timeout stops before its cure feedback.
export async function fixHeroPetrification({ state = game } = {}) {
    if (!heroIsPetrifying(state))
        return false;
    const message = heroIsHallucinating(state)
        ? `What a pity--you just ruined a future piece of ${currentAttribute(A_CHA, state) > 15 ? 'fine ' : ''}art!`
        : 'You feel limber!';
    await setHeroPetrificationTimeout(0, { state, message });
    return true;
}
// C eat.c:intrinsic_possible().
export function intrinsicPossible(property, mnum) {
    const resistance = RESISTANCES.findIndex(resistance => resistance === property);
    if (resistance >= 0)
        return !!(requireMonsterData(MONSTER_CONVEYS, mnum) & (1 << resistance));
    if (property === 'telepathy')
        return TELEPATHIC_SPECIES.has(mnum);
    const flag = property === 'teleportation' ? M1_TPORT : M1_TPORT_CNTRL;
    return !!(requireMonsterData(MONSTER_FLAGS1, mnum) & flag);
}
// C eat.c:should_givit().
export function shouldGiveIntrinsic(property, mnum) {
    let chance = 15;
    if (property === 'poisonResistance'
        && (mnum === KILLER_BEE || mnum === SCORPION) && !rn2(4))
        chance = 1;
    else if (property === 'teleportation')
        chance = 10;
    else if (property === 'teleportControl')
        chance = 12;
    else if (property === 'telepathy')
        chance = 1;
    return requireMonsterData(MONSTER_LEVEL, mnum) > rn2(chance);
}
// C eat.c:temp_givit().
function shouldGiveTemporaryResistance(property, mnum) {
    const chance = property === 'stoneResistance' ? 6
        : property === 'acidResistance' ? 3 : 0;
    return chance > 0 && requireMonsterData(MONSTER_LEVEL, mnum) > rn2(chance);
}
// C eat.c:givit().
export async function grantCorpseIntrinsic(mnum, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const property = chooseCorpseIntrinsic(mnum);
    if (!property)
        return;
    if (property === 'strength') {
        await gainHeroStrength(null, 0, { state });
        return;
    }
    if (!shouldGiveIntrinsic(property, mnum)
        && !shouldGiveTemporaryResistance(property, mnum))
        return;
    const timed = property === 'acidResistance' || property === 'stoneResistance';
    if (timed) {
        if (!state.u[property])
            await plineWithContinuation(intrinsicMessage(property, state));
        const timeout = `${property}Turns`;
        state.u[timeout] = Math.min(TIMEOUT, (state.u[timeout] || 0) + d(3, 6));
        refreshProperty(property, state);
        return;
    }
    if (hasIntrinsicProperty(property, 'outside', state))
        return;
    await plineWithContinuation(intrinsicMessage(property, state));
    grantIntrinsicProperty(property, 'outside', state);
    if (property === 'telepathy' && heroIsBlind(state))
        await see_monsters();
}
// C eat.c:givit().
function intrinsicMessage(property, state) {
    const hallucinating = heroIsHallucinating(state);
    switch (property) {
        case 'fireResistance':
            return hallucinating ? "You be chillin'." : 'You feel a momentary chill.';
        case 'coldResistance': return formatFeltMessage('full of hot air.', state);
        case 'sleepResistance': return formatFeltMessage('wide awake.', state);
        case 'disintegrationResistance':
            return formatFeltMessage(hallucinating ? 'totally together, man.' : 'very firm.', state);
        case 'shockResistance':
            return hallucinating ? formatFeltMessage('grounded in reality.', state)
                : 'Your health currently feels amplified!';
        case 'poisonResistance':
            return formatFeltMessage(state.u.poisonResistance ? 'especially healthy.' : 'healthy.', state);
        case 'telepathy':
            return formatFeltMessage(hallucinating ? 'in touch with the cosmos.' : 'a strange mental acuity.', state);
        case 'teleportation':
            return formatFeltMessage(hallucinating ? 'diffuse.' : 'very jumpy.', state);
        case 'teleportControl':
            return formatFeltMessage(hallucinating ? 'centered in your personal space.' : 'in control of yourself.', state);
        case 'acidResistance':
            return formatFeltMessage(hallucinating ? 'secure from flashbacks.' : 'less concerned about being harmed by acid.', state);
        case 'stoneResistance':
            return formatFeltMessage(hallucinating ? 'unusually limber.' : 'less concerned about becoming petrified.', state);
    }
}
// C eat.c:eye_of_newt_buzz().
export async function corpseEnergyBuzz({ state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    if (!rn2(3) && 3 * hero.uen > 2 * hero.uenmax)
        return;
    const previousEnergy = hero.uen;
    hero.uen += rnd(3);
    if (hero.uen > hero.uenmax) {
        if (!rn2(3)) {
            hero.uenmax++;
            hero.uenpeak = Math.max(hero.uenpeak || 0, hero.uenmax);
        }
        hero.uen = hero.uenmax;
    }
    if (hero.uen !== previousEnergy) {
        await plineWithContinuation(formatFeltMessage('a mild buzz.', state));
        state.context.botl = true;
    }
}
// C eat.c:cpostfx().
export async function applyCorpsePostEffects(mnum, { state = game, tin = null } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (state._mimicMealMessage)
        await finishMealMimicry(state);
    const hero = state.u;
    const name = requireMonsterData(MONSTER_NAME, mnum);
    if (HUMAN_WERE_FORMS.has(mnum)) {
        catchLycanthropyFromCorpse(mnum, state);
        await retouchEquipment(2);
        return { heroDied: !!state.program_state.gameover };
    }
    let checkIntrinsics = false;
    switch (name) {
        case 'wraith':
            await gainExperienceLevel({ state });
            break;
        case 'nurse':
            if (Upolyd(hero))
                hero.mh = hero.mhmax;
            else
                hero.uhp = hero.uhpmax;
            await makeBlinded(0, { state, talk: !hero.ucreamed });
            state.context.botl = true;
            checkIntrinsics = true;
            break;
        case 'stalker':
        case 'yellow light':
        case 'giant bat':
        case 'bat':
            if (name === 'stalker')
                await eatStalker(state);
            if (name !== 'bat')
                await makeStunned((hero.stunnedTurns || 0) + 30, { state, talk: false });
            await makeStunned((hero.stunnedTurns || 0) + 30, { state, talk: false });
            break;
        case 'giant mimic':
        case 'large mimic':
        case 'small mimic':
            await beginMealMimicry(name === 'giant mimic' ? 50 : name === 'large mimic' ? 40 : 20, { state });
            break;
        case 'quantum mechanic':
            await plineWithContinuation('Your velocity suddenly seems very uncertain!');
            if (hasPermanentIntrinsicProperty('fast', state)) {
                removePermanentIntrinsicProperty('fast', state);
                await plineWithContinuation('You seem slower.');
            }
            else {
                grantIntrinsicProperty('fast', 'outside', state);
                await plineWithContinuation('You seem faster.');
            }
            break;
        case 'lizard':
            if ((hero.stunnedTurns ?? 0) > 2)
                await makeStunned(2, { state, talk: false });
            if ((hero.confusionTurns ?? 0) > 2)
                await makeConfused(2, { state, talk: false });
            checkIntrinsics = true;
            break;
        case 'chameleon':
        case 'doppelganger':
        case 'sandestin':
        case 'genetic engineer':
            if (heroIsUnchanging(state))
                await plineWithContinuation(formatFeltMessage('momentarily different.', state));
            else {
                if (tin) {
                    await useUpTin(tin, { state });
                    await gainHeroNutrition(200 + ((requireMonsterData(MONSTER_FLAGS1, heroSpecies(state)) & M1_METALLIVORE) ? 5 : 0), { state });
                    if (state.program_state.gameover)
                        break;
                }
                await plineWithContinuation(name === 'genetic engineer'
                    ? 'You undergo a freakish metamorphosis.' : 'You feel a change coming over you.');
                await polymorphHero();
            }
            break;
        case 'displacer beast':
            await gainCorpseDisplacement({ state });
            break;
        case 'disenchanter':
            await attrcurse();
            break;
        case 'Death':
        case 'Pestilence':
        case 'Famine':
            break;
        case 'mind flayer':
        case 'master mind flayer':
            if (hero.acurr.a[A_INT] < state.urace.attrmax[A_INT]) {
                if (!rn2(2)) {
                    await plineWithContinuation('Yum!  That was real brain food!');
                    const change = adjustAttribute(A_INT, 1, state);
                    const message = attributeChangeMessage(A_INT, change, state);
                    if (message)
                        await plineWithContinuation(message);
                    break;
                }
            }
            else
                await plineWithContinuation('For some reason, that tasted bland.');
            checkIntrinsics = true;
            break;
        default:
            checkIntrinsics = true;
    }
    if (checkIntrinsics && !state.program_state.gameover) {
        const attacks = requireMonsterData(MONSTER_ATTACKS, mnum);
        if (attacks.some(([, damage]) => damage === AD_STUN || damage === AD_HALU) || name === 'violet fungus') {
            await plineWithContinuation('Oh wow!  Great stuff!');
            await makeHallucinated((hero.hallucinationTurns || 0) + 200, { state, talk: false });
        }
        if (attacks.some(([type]) => type === AT_MAGC) || name === 'newt')
            await corpseEnergyBuzz({ state });
        await grantCorpseIntrinsic(mnum, { state });
    }
    return { heroDied: !!state.program_state.gameover };
}
// C eat.c:cpostfx().
async function eatStalker(state) {
    const hero = state.u;
    if (!heroIsInvisible(state)) {
        hero.invisibleTurns = rn1(100, 50);
        syncHeroInvisibility(state);
        if (!heroIsBlind(state) && !invisibilityIsBlocked(state))
            await showInvisibilityMessage(state);
    }
    else {
        if (!hasPermanentIntrinsicProperty('invisible', state))
            await plineWithContinuation(formatFeltMessage('hidden!', state));
        grantIntrinsicProperty('invisible', 'outside', state);
        grantIntrinsicProperty('seeInvisible', 'outside', state);
        syncHeroInvisibility(state);
    }
    await newsym(hero.ux, hero.uy);
}
// C eat.c:cpostfx().
export async function beginMealMimicry(turns, { state = game } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    if (requireMonsterData(MONSTER_SYMBOL, heroSpecies(state)) === S_MIMIC || heroIsUnchanging(state))
        return;
    const hallucinating = heroIsHallucinating(state);
    const shape = hallucinating ? 'an orange' : 'a pile of gold';
    const conduct = hero.uconduct;
    if (!conduct.polyselfs)
        recordGameLogEvent(`changed form for the first time by mimicking ${shape}`, { state, flags: LL_CONDUCT });
    conduct.polyselfs = (conduct.polyselfs || 0) + 1;
    await plineWithContinuation(`You can't resist the temptation to mimic ${shape}.`);
    if (hero.usteed) {
        await dismountHero(DISMOUNT_FELL, { state });
        if (state.program_state.gameover)
            return;
    }
    nomul(-turns, state);
    state._helplessReason = 'pretending to be a pile of gold';
    const original = Upolyd(hero) ? monsterTypeName(heroSpecies(state), state.flags.female) : state.urace.noun;
    const nowHallucinating = heroIsHallucinating(state);
    state._mimicMealMessage = nowHallucinating
        ? `You suddenly dread being peeled and mimic ${withIndefiniteArticle(original)} again!`
        : `You now prefer mimicking ${withIndefiniteArticle(original)} again.`;
    state._helplessDoneMessage = state._mimicMealMessage;
    state._afterMove = { kind: 'end-mimic-meal' };
    hero.m_ap_type = M_AP_OBJECT;
    hero.mappearance = nowHallucinating ? ORANGE : GOLD_PIECE;
    await newsym(hero.ux, hero.uy);
    await flush_screen(1);
    await flushPendingTopline();
}
// C eat.c:corpse_intrinsic().
export function chooseCorpseIntrinsic(mnum) {
    const giant = !!(requireMonsterData(MONSTER_FLAGS2, mnum) & M2_GIANT);
    let count = giant ? 1 : 0;
    let selected = giant ? 'strength' : null;
    for (const property of CANDIDATES) {
        if (!intrinsicPossible(property, mnum))
            continue;
        if (!rn2(++count))
            selected = property;
    }
    if (giant && count === 1 && !rn2(2))
        selected = null;
    return selected;
}
// C eat.c:violated_vegetarian().
async function violateVegetarian(state) {
    incrementConduct('unvegetarian', state);
    if (state.urole.key !== 'monk')
        return;
    await pline(formatFeltMessage('guilty.', state));
    adjustHeroAlignment(-1, state);
}
// C eat.c:costly_tin().
async function costlyTin(alteration, state) {
    const opening = currentTinOpening(state);
    let tin = currentTin(state);
    const billable = tin.where === 'inventory' ? tin.unpaid
        : costlySpot(tin.ox, tin.oy, state) && !tin.no_charge;
    if (billable) {
        if (objectQuantity(tin) > 1) {
            tin = splitTin(tin, state);
            opening.tin = tin;
            opening.o_id = tin.o_id;
        }
        await chargeAlteredUnpaidObject(tin, alteration, state);
    }
    return tin;
}
// C eat.c:tin_variety_txt().
// Native tin_variety_txt(): preparation labels are accepted only as whole
// prefixes followed by a space and the monster that supplies the meat.
export function parseTinPreparation(text) {
    for (const [variety, preparation] of preparations.entries()) {
        if (preparation.name && text.toLowerCase().startsWith(`${preparation.name} `))
            return { variety, remaining: text.slice(preparation.name.length + 1) };
    }
    return { variety: null, remaining: text };
}
// C eat.c:tin_details().
export function tinDetails(tin, species = tinSpecies(tin), { state = game } = {}) {
    const variety = tinVariety(tin, true);
    if (variety === SPINACH_TIN)
        return 'tin of spinach';
    if (species === -1)
        return 'empty tin';
    const contents = vegetarianCorpse(species) ? requireMonsterData(MONSTER_NAME, species) : `${requireMonsterData(MONSTER_NAME, species)} meat`;
    if ((tin.cknown || tin.overrideIdentified || state.iflags?.override_ID) && tin.spe < 0) {
        const name = tinPreparation(variety).name;
        return variety === ROTTEN_TIN || variety === HOMEMADE_TIN
            ? `${name} tin of ${contents}` : `tin of ${name} ${contents}`;
    }
    return `tin of ${contents}`;
}
// C eat.c:set_tin_variety().
export function setTinVariety(tin, mode = RANDOM_TIN) {
    if (mode === SPINACH_TIN) {
        tin.corpsenm = -1;
        tin.spe = 1;
        return;
    }
    const species = tinSpecies(tin);
    if (mode === HEALTHY_TIN && (species < 0 || !vegetarianCorpse(species))) {
        tin.corpsenm = -1;
        tin.spe = 1;
        return;
    }
    let variety;
    if (mode === HEALTHY_TIN) {
        variety = tinVariety(tin);
        if (variety < 0 || variety >= preparations.length)
            variety = ROTTEN_TIN;
        while (variety === ROTTEN_TIN && !tin.cursed || !tinPreparation(variety).fodder)
            variety = rn2(preparations.length - 1);
    }
    else if (mode >= 0 && mode < preparations.length - 1)
        variety = mode;
    else {
        variety = rn2(preparations.length - 1);
        if (variety === ROTTEN_TIN && species >= 0 && nonrottingCorpse(species))
            variety = HOMEMADE_TIN;
    }
    tin.spe = -(variety + 1);
}
// C eat.c:tin_variety().
export function tinVariety(tin, display = false) {
    const species = tinSpecies(tin);
    let variety = tin.spe === 1 ? SPINACH_TIN : tin.cursed ? ROTTEN_TIN
        : tin.spe < 0 ? -tin.spe - 1 : rn2(preparations.length - 1);
    if (!display && variety === HOMEMADE_TIN && !tin.blessed && rn2(7) === 0)
        variety = ROTTEN_TIN;
    if (variety === ROTTEN_TIN && species >= 0 && nonrottingCorpse(species))
        variety = HOMEMADE_TIN;
    return variety;
}
// C eat.c:tin_variety().
function tinPreparation(variety) {
    const preparation = preparations[variety];
    if (!preparation)
        throw new RangeError(`Invalid tin preparation ${variety}`);
    return preparation;
}
// C eat.c:use_up_tin().
export async function useUpTin(tin, { state = game } = {}) {
    requirePlayingGame(state);
    await consumeFoodObject(tin, { state });
    if (state.context.tin) {
        state.context.tin.tin = null;
        state.context.tin.o_id = 0;
    }
}
// C eat.c:consume_tin().
async function consumeTin(message, { state }) {
    // Metal has already been swallowed when corpse effects change the form.
    const alwaysEat = eatsMetal(state);
    let tin = currentTin(state);
    const variety = tinVariety(tin);
    if (tin.otrapped || tin.cursed && variety !== HOMEMADE_TIN && rn2(8) === 0) {
        if (await triggerBoobyTrap('tin', { state }))
            return;
        tin = await costlyTin('destroy', state);
        await useUpTin(tin, { state });
        return;
    }
    await plineWithContinuation(message);
    if (variety === SPINACH_TIN) {
        await consumeSpinach(tin, alwaysEat, state);
        return;
    }
    const species = tinSpecies(tin);
    if (species === -1) {
        await plineWithContinuation(heroIsHallucinating(state)
            ? `It's full of ${rn2(2) ? 'air elemental souffle' : 'dehydrated water'}.`
            : 'It turns out to be empty.');
        observeObject(tin, state);
        tin.known = true;
        tin = await costlyTin('open', state);
        await useUpTin(tin, { state });
        if (alwaysEat)
            await gainHeroNutrition(5, { state });
        return;
    }
    const smell = tinSmell(species, state);
    if (!alwaysEat) {
        await plineWithContinuation(`It smells like ${smell}.`);
        if (await promptYesNo('Eat it?') === 'n') {
            await discardTin(tin, state, !heroIsHallucinating(state));
            return;
        }
    }
    state.context.victual = null;
    const preparation = tinPreparation(variety);
    await plineWithContinuation(`You consume ${preparation.name} ${requireMonsterData(MONSTER_NAME, species)}.`);
    await eatingConducts(species, { state });
    observeObject(tin, state);
    tin.known = true;
    tin = await costlyTin('open', state);
    const pre = await applyCorpsePreEffects(species, { state, tin });
    if (pre.heroDied || state.program_state.gameover || !state.context.tin?.tin)
        return;
    const post = await applyCorpsePostEffects(species, { state, tin });
    if (post.heroDied || state.program_state.gameover || !state.context.tin?.tin)
        return;
    if (preparation.nutrition < 0)
        startHeroVomiting({ state, turns: rn1(15, 10) });
    else {
        const nutrition = (variety === HOMEMADE_TIN
            ? Math.min(preparation.nutrition, requireMonsterData(MONSTER_BODY_META, species)[1])
            : preparation.nutrition) + (alwaysEat ? 5 : 0);
        await useUpTin(tin, { state });
        await gainHeroNutrition(nutrition, { state });
        if (state.program_state.gameover)
            return;
        tin = null;
    }
    if (preparation.greasy) {
        const old = state.u.glibTurns || 0;
        setSlipperyHands(old + rn1(11, 5), state);
        const fingers = state.uarmg ? armorSimpleName(state.uarmg, state) : makePlural(heroFingerName(state));
        await plineWithContinuation(`Eating ${preparation.name} food made your ${fingers} ${old ? 'even more' : 'very'} slippery.`);
    }
    if (tin)
        await useUpTin(tin, { state });
}
// C eat.c:consume_tin().
async function consumeSpinach(tin, alwaysEat, state) {
    await plineWithContinuation(tin.cursed
        ? `It contains some decaying${heroIsBlind(state) ? '' : ` ${displayColorName('green', state)}`} substance.`
        : 'It contains spinach.');
    if (!tin.cursed) {
        observeObject(tin, state);
        tin.known = true;
    }
    if (!alwaysEat && await promptYesNo('Eat it?') === 'n') {
        await discardTin(tin, state, false);
        return;
    }
    recordSpinachConsumption({ state });
    if (!tin.cursed) {
        const fixed = state.u.fixedAbilities || propertyIsActive('sustainAbility', state);
        const character = heroIsHallucinating(state) ? "Swee'pea"
            : !fixed ? 'Popeye' : state.flags.female ? 'Olive Oyl' : 'Bluto';
        await plineWithContinuation(`This makes you feel like ${character}!`);
    }
    await gainHeroStrength(tin, 0, { state, giveMessage: false });
    tin = await costlyTin('open', state);
    const nutrition = (tin.blessed ? 600 : tin.cursed ? 200 + rnd(400) : 400 + rnd(200))
        + (alwaysEat ? 5 : 0);
    await useUpTin(tin, { state });
    await gainHeroNutrition(nutrition, { state });
}
// C eat.c:consume_tin().
async function discardTin(tin, state, learnContents) {
    if (state.flags.verbose !== false)
        await plineWithContinuation('You discard the open tin.');
    if (learnContents) {
        observeObject(tin, state);
        tin.known = true;
    }
    tin = await costlyTin('open', state);
    await useUpTin(tin, { state });
}
// C eat.c:consume_tin().
function tinSmell(species, state) {
    if (['cockatrice', 'chickatrice'].includes(requireMonsterData(MONSTER_NAME, species))
        && (propertyIsActive('stoneResistance', state) || heroIsHallucinating(state)))
        return 'chicken';
    if (heroIsHallucinating(state))
        return makePlural(randomDisplayMonsterName());
    if (species === PM_WIZARD || requireMonsterData(MONSTER_GENO, species) & G_UNIQ
        && !(requireMonsterData(MONSTER_FLAGS2, species) & M2_PNAME)
        && species !== PM_HIGH_CLERIC && species !== PM_LONG_WORM_TAIL)
        return `the ${requireMonsterData(MONSTER_NAME, species)}`;
    return requireMonsterData(MONSTER_FLAGS2, species) & M2_PNAME ? requireMonsterData(MONSTER_NAME, species) : makePlural(requireMonsterData(MONSTER_NAME, species));
}
// C eat.c:consume_tin().
function currentTin(state) {
    const tin = currentTinOpening(state).tin;
    if (!tin)
        throw new Error('The tin being opened has already been consumed');
    return tin;
}
// C eat.c:consume_tin().
function tinSpecies(tin) {
    if (tin.corpsenm === undefined)
        throw new Error(`Tin ${tin.o_id} has no contents species`);
    return tin.corpsenm;
}
// C eat.c:consume_tin().
export function recordSpinachConsumption({ state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    return incrementFood('ate for the first time (spinach)', state);
}
// C eat.c:opentin().
export async function continueTinOpening(opening, state = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const tin = state.context.tin?.tin;
    const available = tin && (tin.where === 'inventory'
        || tin.where === 'floor' && tin.ox === state.u.ux && tin.oy === state.u.uy
            && state.level.objects[tin.ox]?.[tin.oy]?.includes(tin)
            && heroCanReachFloor(state, { checkPit: true }));
    if (!available) {
        state._occupation = null;
        state.context.move = 1;
        return true;
    }
    if (opening.usedtime++ >= 50) {
        await plineWithContinuation('You give up your attempt to open the tin.');
        state._occupation = null;
    }
    else if (opening.usedtime >= opening.reqtime) {
        await consumeTin('You succeed in opening the tin.', { state });
        state._occupation = null;
    }
    state.context.move = state.program_state.gameover ? 0 : 1;
    return true;
}
// C eat.c:opentin().
function currentTinOpening(state) {
    const opening = state.context.tin;
    if (!opening)
        throw new Error('No tin is being opened');
    return opening;
}
// C eat.c:start_tin().
export async function startTin(tin, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const weapon = state.uwep;
    let duration;
    let message;
    if (eatsMetal(state)) {
        duration = 0;
        message = 'You bite right into the metal tin...';
    }
    else if (heroHasNoHands(state) || heroIsVerySmall(state)) {
        await plineWithContinuation('You cannot handle the tin properly to open it.');
        return { started: false, completed: false, heroDied: false };
    }
    else if (tin.blessed) {
        duration = weapon?.otyp === TIN_OPENER && weapon.blessed ? 0 : rn2(2);
        if (!duration)
            message = 'The tin opens like magic!';
        else
            await plineWithContinuation('The tin seems easy to open.');
    }
    else if (weapon && (weapon.otyp === TIN_OPENER || openingKnives.has(weapon.otyp)
        || weapon.otyp === AXE || weapon.otyp === PICK_AXE)) {
        if (weapon.otyp === TIN_OPENER) {
            duration = rn2(weapon.cursed ? 3 : weapon.blessed ? 1 : 2);
            message = 'You easily open the tin.';
        }
        else
            duration = openingKnives.has(weapon.otyp) ? 3 : 6;
        // eat.c:start_tin() uses yobjnam(uwep), which includes the stack
        // count ("Using your 11 orcish daggers ...").
        await plineWithContinuation(`Using ${ownedObjectName(weapon, state, { capitalized: false, includeQuantity: true })} you try to open the tin.`);
    }
    else {
        await plineWithContinuation('It is not so easy to open this tin.');
        if ((state.u.glibTurns ?? 0) > 0 || state.u.glib) {
            await plineWithContinuation(`The tin slips from your ${makePlural(heroFingerName(state))}.`);
            if (objectQuantity(tin) > 1)
                tin = splitTin(tin, state);
            if (tin.where === 'inventory')
                await dropInventoryObjectAtHero(tin, { state });
            else
                await stack_object(tin, state);
            return { started: false, completed: false, heroDied: !!state.program_state.gameover };
        }
        duration = rn1(1 + Math.trunc(500 / (currentAttribute(A_DEX, state) + currentStrength(state))), 10);
    }
    const opening = {
        key: 'open-tin', text: 'opening the tin', object: tin,
        tin, o_id: tin.o_id, reqtime: duration, usedtime: 0,
    };
    state.context.tin = opening;
    if (!duration) {
        if (message === undefined)
            throw new Error('Instant tin opening requires a message');
        await consumeTin(message, { state });
    }
    else
        state._occupation = opening;
    state.context.move = state.program_state.gameover ? 0 : 1;
    return { started: true, completed: duration === 0, heroDied: !!state.program_state.gameover };
}
// C eat.c:start_tin().
function splitTin(tin, state) {
    const split = splitObjectStack(tin, 1, state);
    if (!split)
        throw new Error(`Tin stack ${tin.o_id} could not be split`);
    return split;
}
// C eat.c:start_tin().
function eatsMetal(state) {
    return !!(requireMonsterData(MONSTER_FLAGS1, heroSpecies(state)) & M1_METALLIVORE);
}
// C eat.c:Hear_again()/unfaint(). allmain calls this after the awaited
// recovery message, so neither hearing nor hunger changes before acknowledgment.
export async function regainHearingAfterHelplessness({ state = game } = {}) {
    if (rn2(2) === 0) {
        await makeDeaf(0, { state, talk: false });
        state.context.botl = true;
    }
}
// C eat.c:rottenfood().
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
// C eat.c:eatcorpse().
function corpseSpecies(food) {
    if (food.corpsenm === undefined)
        throw new Error(`Corpse ${food.o_id} has no species`);
    return food.corpsenm;
}
// C eat.c:eatcorpse().
// The caller has installed context.victual and keeps its food identity.
export async function prepareCorpseMeal(food, { state = game } = {}) {
    requirePlayingGame(state);
    const meal = state.context.victual;
    if (!meal || meal.key !== 'eat-food')
        throw new Error('Corpse preparation requires an active food meal');
    const species = mealCorpseSpecies(food), glob = !!food.globby;
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
        await pline(formatFeltMessage(`${heroIsSick(state) ? 'very ' : ''}sick.`, state));
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
// C eat.c:eatcorpse().
async function eatTaintedCorpse(food, state) {
    const species = mealCorpseSpecies(food);
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
// C eat.c:eatcorpse().
async function describeCorpseTaste(food, rotted, state) {
    const species = mealCorpseSpecies(food), flags = requireMonsterData(MONSTER_FLAGS1, heroSpecies(state));
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
// C eat.c:eatcorpse().
function mealCorpseSpecies(food) {
    if (food.corpsenm === undefined)
        throw new Error(`Corpse ${food.o_id} has no species`);
    return food.corpsenm;
}
// C eat.c:eatcorpse().
export async function recordCorpseDiet(food, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const species = food.corpsenm;
    if (species === undefined)
        throw new Error('Corpse consumption requires a species.');
    const name = withIndefiniteArticle(foodObjectName(food, { state }));
    let logged = false;
    if (!veganCorpse(species) && incrementConduct('unvegan', state)) {
        recordGameLogEvent(`consumed animal products for the first time, by eating ${name}`, { state, flags: LL_CONDUCT });
        logged = true;
    }
    if (!vegetarianCorpse(species)) {
        if (!state.u.uconduct.unvegetarian && !logged)
            recordGameLogEvent(`tasted meat for the first time, by eating ${name}`, { state, flags: LL_CONDUCT });
        await violateVegetarian(state);
    }
}
// C eat.c:start_eating().
async function startFoodMeal(food, partlyEaten, state) {
    const meal = currentFoodMeal(state);
    meal.fullwarn = meal.doreset = false;
    meal.eating = true;
    if (food.otyp === CORPSE || food.globby) {
        const effect = await applyCorpsePreEffects(corpseSpecies(food), { state, food });
        if (effect.stopped || !state.context.victual?.piece || !meal.eating)
            return;
    }
    const oldMessage = state._helplessDoneMessage;
    if (await takeFoodBite(state)) {
        if (state.program_state.gameover)
            return;
        if (++meal.usedtime >= meal.reqtime) {
            const chokingMessage = state._helplessDoneMessage;
            if (!oldMessage)
                state._helplessDoneMessage = null;
            await finishFoodMeal(state, false);
            if (!oldMessage) {
                if (chokingMessage === undefined)
                    delete state._helplessDoneMessage;
                else
                    state._helplessDoneMessage = chokingMessage;
            }
        }
        return;
    }
    if (state.program_state.gameover)
        return;
    if (++meal.usedtime >= meal.reqtime) {
        await finishFoodMeal(state, meal.reqtime > 1 || partlyEaten);
        return;
    }
    meal.text = `eating ${foodObjectName(food, { state, definite: true })}`;
    state._occupation = { key: 'eat-food', text: meal.text };
}
// C eat.c:eating_glob(). True while this glob is the meal in progress.
export function activelyEatingGlob(glob, state) {
    return state._occupation?.key === 'eat-food'
        && state.context.victual?.piece === glob;
}
// C eat.c:garlic_breath().
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
// C eat.c:fprefx().
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
// C eat.c:fprefx().
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
// C eat.c:fprefx().
function heroHasRace(name, speciesFlag, state) {
    return heroIsPolymorphed(state)
        ? !!(requireMonsterData(MONSTER_FLAGS2, heroSpecies(state)) & speciesFlag) : state.urace.name === name;
}
// C eat.c:fprefx().
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
// C eat.c:fprefx().
function mealResult(state, continueMeal = true) {
    const heroDied = !!state.program_state.gameover;
    return { continueMeal: continueMeal && !heroDied, heroDied };
}
// C eat.c:fprefx().
function requireFoodMeal(state) {
    const meal = state.context.victual;
    if (meal?.key !== 'eat-food')
        throw new Error('This food effect requires an ordinary food meal.');
    return meal;
}
// C eat.c:bounded_increase().
function boundedIncrease(old, amount, objectType, state) {
    const worn = [state.uleft, state.uright].filter((ring) => ring != null && ring.otyp === objectType);
    const wornBonus = objectType === PROTECTION ? 0 : worn.reduce((sum, ring) => sum + ring.spe, 0);
    old -= wornBonus;
    const total = Math.abs(old) + Math.abs(amount);
    if (amount && Math.sign(old) === Math.sign(amount) && total >= 10) {
        let increase;
        if (total < 20) {
            increase = rnd(Math.abs(amount));
            if (Math.abs(old) + increase < 10)
                increase = 10 - Math.abs(old);
        }
        else if (total < 40) {
            increase = rn2(Math.abs(amount)) ? 1 : 0;
            if (Math.abs(old) + increase < 20)
                increase = rnd(20 - Math.abs(old));
        }
        else
            increase = 0;
        amount = Math.sign(amount) * increase;
    }
    return old + wornBonus + amount;
}
// C eat.c:accessory_has_effect().
function accessoryEffectMessage(object) {
    return pline(`Magic spreads through your body as you digest the ${object.oclass === 4 ? 'ring' : 'amulet'}.`);
}
// C eat.c:eataccessory().
export async function digestAccessory(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const property = requireObjectData(OBJECT_PROPERTY, object.otyp);
    const oldIntrinsic = property && (hasIntrinsicProperty(property, null, state)
        || hasTimedProperty(property, state));
    if (object === state.uleft || object === state.uright) {
        await removeHeroAccessory(object, state);
        if (state.program_state.gameover || state.u.uhp <= 0)
            return;
    }
    observeObject(object, state);
    object.known = true;
    if (rn2(object.oclass === 4 ? 3 : 5))
        return;
    if (NO_DIGESTED_EFFECT.has(object.otyp))
        return;
    if ([ADORNMENT, STRENGTH, CONSTITUTION].includes(object.otyp)) {
        await accessoryEffectMessage(object);
        const attribute = object.otyp === ADORNMENT ? A_CHA : object.otyp === STRENGTH ? A_STR : A_CON;
        const change = adjustAttribute(attribute, object.spe, state);
        if (change.changed) {
            const message = attributeChangeMessage(attribute, change, state);
            if (message)
                await pline(message);
            if (state._moveloopStarted && [A_STR, A_CON].includes(attribute))
                await reportHeroEncumbrance(state);
            learnObjectType(object.otyp, state);
        }
    }
    else if ([ACCURACY, DAMAGE].includes(object.otyp)) {
        await accessoryEffectMessage(object);
        const field = object.otyp === ACCURACY ? 'uhitinc' : 'udaminc';
        state.u[field] = boundedIncrease(state.u[field] || 0, object.spe, object.otyp, state);
    }
    else if (object.otyp === PROTECTION || object.otyp === GUARDING) {
        await accessoryEffectMessage(object);
        grantIntrinsicProperty('protection', 'outside', state);
        state.u.ublessed = boundedIncrease(state.u.ublessed || 0, object.otyp === PROTECTION ? object.spe : 2, object.otyp, state);
        // Native eataccessory() leaves find_ac() to the next input boundary,
        // after monsters have used the armor class from before this meal.
        state._armorClassDirty = true;
        state.context.botl = true;
    }
    else if (object.otyp === FREE_ACTION) {
        if (!hasIntrinsicProperty('sleepResistance', 'outside', state))
            await accessoryEffectMessage(object);
        if (!state.u.sleepResistance)
            await pline(formatFeltMessage('wide awake.', state));
        grantIntrinsicProperty('sleepResistance', 'outside', state);
    }
    else if (object.otyp === CHANGE) {
        await accessoryEffectMessage(object);
        learnObjectType(object.otyp, state);
        changeHeroSex(state);
        await pline(`You are suddenly very ${state.flags.female ? 'feminine' : 'masculine'}!`);
        state.context.botl = true;
    }
    else if (object.otyp === UNCHANGING) {
        if (!state.u.unchanging && heroIsPolymorphed(state)) {
            await accessoryEffectMessage(object);
            learnObjectType(object.otyp, state);
            await returnHeroToHumanForm(state);
        }
    }
    else if (object.otyp === STRANGULATION) {
        await chokeHeroOnFood(object, { state });
    }
    else if (object.otyp === SLEEP) {
        const delay = rnd(100);
        const oldDelay = propertyTimeout('sleepy', state);
        if (!hasIntrinsicProperty('sleepy', 'outside', state))
            await accessoryEffectMessage(object);
        grantIntrinsicProperty('sleepy', 'outside', state);
        if (!oldDelay || delay < oldDelay)
            setPropertyTimeout('sleepy', delay, state);
    }
    else if (property) {
        if (!hasIntrinsicProperty(property, 'outside', state))
            await accessoryEffectMessage(object);
        if (object.otyp === LEVITATION) {
            // The generic intrinsic gain is immediately undone by C. Only
            // this temporary flight remains, and existing levitation wins.
            if (!propertyIsActive('levitation', state)) {
                await floatHeroUp(state, captureLevitationState(state));
                state.u.levitationTurns = Math.min(TIMEOUT, (state.u.levitationTurns || 0) + d(10, 20));
                refreshProperty('levitation', state);
                learnObjectType(object.otyp, state);
            }
            return;
        }
        grantIntrinsicProperty(property, 'outside', state);
        if (object.otyp === SEE_INVISIBLE) {
            await refreshHeroSeeing({ state });
            const innateSight = requireMonsterData(MONSTER_FLAGS1, state.u.umonnum) & 0x01000000;
            if (heroIsInvisible(state) && !oldIntrinsic && !extrinsicProperty(property, state)
                && !innateSight && !heroIsBlind(state)) {
                await newsym(state.u.ux, state.u.uy);
                await pline('Suddenly you can see yourself.');
                learnObjectType(object.otyp, state);
            }
        }
        else if (object.otyp === INVISIBILITY) {
            syncHeroInvisibility(state);
            if (!oldIntrinsic && !extrinsicProperty(property, state) && !invisibilityIsBlocked(state)
                && !state.u.seeInvisible && !heroIsBlind(state)) {
                await newsym(state.u.ux, state.u.uy);
                await pline(`Your body takes on a ${heroIsHallucinating(state) ? 'normal' : 'strange'} transparency...`);
                learnObjectType(object.otyp, state);
            }
        }
        else if (object.otyp === SHAPE_PROTECTION) {
            await restoreNaturalMonsterShapes(state);
        }
    }
}
// C eat.c:eataccessory().
function extrinsicProperty(property, state) {
    return hasWornProperty(property, state) || hasInvokedProperty(property, state)
        || hasCarriedProperty(property, null, state);
}
// C eat.c:eatspecial().
async function finishNonFoodMeal(object, meal, state) {
    state._occupation = { key: 'eat-food', text: 'eating non-food' };
    await gainHeroNutrition(meal.nmod, { state });
    state._occupation = null;
    state.context.victual = null;
    if (state.program_state.gameover)
        return;
    if (object.oclass === COIN_CLASS) {
        await consumeFoodObject(object, { all: true, state });
        const guard = await findVaultGuard(state);
        if (guard?.mx && guard.mcansee && monsterHasLineOfSightToHero(guard, state)) {
            if (!guard._egd)
                throw new Error('A vault guard has no guard state');
            guard._egd.witness = GD_EATGOLD;
        }
        return;
    }
    if (objectMaterial(object, state) === PAPER) {
        const label = state.objectDescriptions?.[object.otyp];
        await pline(object.otyp === SCR_MAIL ? 'This junk mail is less than satisfying.'
            : object.otyp === SCR_SCARE_MONSTER ? `Yuck${object.blessed ? '!' : '.'}`
                : object.oclass === SCROLL_CLASS && label === 'YUM YUM' ? `Yum${object.blessed ? '!' : '.'}` : 'Needs salt...');
    }
    if (object.oclass === POTION_CLASS)
        await drinkPotion(object, { state, consume: false });
    else if ([RING_CLASS, AMULET_CLASS].includes(object.oclass))
        await digestAccessory(object, { state });
    else if (object.otyp === LEASH && object.leashmon)
        releaseObjectLeash(object, state);
    if (state.program_state.gameover)
        return;
    if (object.otyp === TRIDENT && !object.cursed) {
        await pline(heroIsHallucinating(state) ? 'Four out of five dentists agree.' : 'That was pure chewing satisfaction!');
        await exerciseAttribute(A_WIS, true, state);
    }
    if (object.otyp === FLINT && !object.cursed) {
        await pline('Yabba-dabba delicious!');
        await exerciseAttribute(A_CON, true, state);
    }
    if (objectQuantity(object) === 1)
        await releaseWeaponSlots(object, state);
    const chain = object === state.uchain;
    if (object === state.uball || chain)
        await unpunishHero(state);
    if (!chain)
        await consumeFoodObject(object, { state });
}
// C eat.c:foodword().
export function foodWord(food, state = game) {
    if (food.oclass === 7)
        return 'food';
    const material = objectMaterial(food, state);
    if (food.oclass === 13 && material === 19 && food.dknown)
        recordObjectKnowledge(food.otyp, state);
    // C eat.c:foodwords[], indexed by the native oc_material enum.
    const word = ['meal', 'liquid', 'wax', 'food', 'meat', 'paper', 'cloth', 'leather',
        'wood', 'bone', 'scale', 'metal', 'metal', 'metal', 'silver', 'gold',
        'platinum', 'mithril', 'plastic', 'glass', 'rich food', 'stone'][material];
    if (word === undefined)
        throw new RangeError(`Unknown food material ${material}`);
    return word;
}
// C eat.c:fpostfx().
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
                await putHeroToSleep(rn1(11, 20), { state });
            }
            break;
    }
    return mealResult(state);
}
// C eat.c:fpostfx().
function heroResistsSleep(state) {
    return !!state.u.sleepResistance || propertyIsActive('sleepResistance', state);
}
// C eat.c:fpostfx().
function engulfingAttackBlinds(state) {
    if (!state.u.uswallow)
        return false;
    const swallower = state.u.ustuck;
    if (!swallower)
        throw new Error('An engulfed hero must have a swallowing monster.');
    return requireMonsterData(MONSTER_ATTACKS, swallower.mnum).some(([method, damage]) => method === AT_ENGL && damage === AD_BLND);
}
// C eat.c:edibility_prompts().
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
    await immediatePline(`Your ${heroNoseName(state)} stops tingling and your sense of smell returns to normal.`);
    state.u.uedibility = 0;
    return answer === 'y';
}
// C eat.c:edibility_prompts().
function edibilityWarning(object, state) {
    const corpse = object.otyp === CORPSE;
    const species = object.corpsenm;
    const hero = state.u;
    const material = objectMaterial(object, state);
    if (corpse && species === undefined)
        throw new Error('Corpse edibility requires a species.');
    const conduct = hero.uconduct;
    // Tobjnam uses xname, which calls a corpse "corpse" rather than naming
    // its species. The warning still uses the species to assess danger.
    observeObjectForNaming(object, { state });
    const amount = objectQuantity(object);
    const noun = objectName(object, state);
    const subject = definiteName(amount === 1 ? noun : pluralizeObjectNoun(object, noun), state);
    const smell = `${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${objectNameIsPlural(object, state) ? 'smell' : 'smells'}`;
    const pronoun = amount === 1 ? 'it' : 'they';
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
// C eat.c:doeat_nonfood().
export async function recordNonfoodConduct(food, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const name = foodObjectName(food, { state });
    let logged = incrementFood(`ate for the first time (${name})`, state);
    const material = objectMaterial(food, state);
    if (![LEATHER, BONE, DRAGON_HIDE, WAX].includes(material))
        return;
    if (incrementConduct('unvegan', state) && !logged) {
        recordGameLogEvent(`consumed animal products for the first time, by eating ${withIndefiniteArticle(name)}`, { state, flags: LL_CONDUCT });
        logged = true;
    }
    if (material !== WAX) {
        if (!state.u.uconduct.unvegetarian && !logged)
            recordGameLogEvent(`tasted meat by-products for the first time, by eating ${withIndefiniteArticle(name)}`, { state, flags: LL_CONDUCT });
        await violateVegetarian(state);
    }
}
// C eat.c:doeat_nonfood().
async function eatNonFood(object, state) {
    const material = objectMaterial(object, state);
    const nutrition = object.otyp === SCR_MAIL ? 0 : object.oclass === COIN_CLASS
        ? Math.min(2000, Math.trunc(objectQuantity(object) / 100))
        : [BALL_CLASS, CHAIN_CLASS].includes(object.oclass) ? objectWeight(object)
            : requireObjectData(OBJECT_NUTRITION, object.otyp);
    const meal = { piece: object, o_id: object.o_id, reqtime: 1,
        usedtime: 0, nmod: nutrition, canchoke: currentHungerState(state) === SATIATED, eating: true };
    state.context.victual = meal;
    await recordNonfoodConduct(object, { state });
    let noDelicious = object.otyp === SCR_MAIL || material === PAPER;
    if (object.cursed) {
        await applyRottenFood(object, { state });
        noDelicious = true;
    }
    if (object.oclass === 2 && object.opoisoned) {
        await pline('Ecch - that must have been poisonous!');
        if (state.u.poisonResistance)
            await pline('You seem unaffected by the poison.');
        else {
            const name = objectName(object, state);
            if (await poisonHeroStrengthAndHp(rnd(4), rnd(15), name, {
                state, deathCause: `killed by ${withIndefiniteArticle(name)}`,
            }))
                return;
        }
    }
    else if (!noDelicious) {
        let namedArtifact = false;
        if (objectHasPersonalName(object, state)) {
            const orb = artifactByName('The Orb of Detection', state);
            if (!orb)
                throw new Error('The Orb of Detection is missing from artifact data');
            namedArtifact = (object.oartifact ?? 0) < orb.id;
        }
        await pline(`${namedArtifact ? '' : 'This '}${object.oclass === COIN_CLASS ? 'gold' : objectName(object, state)} is delicious!`);
    }
    await finishNonFoodMeal(object, meal, state);
}
// C eat.c:doeat().
export async function doeat() {
    const state = game;
    requirePlayingGame(state);
    const selection = await selectFoodToEat({ state });
    if (!selection) {
        state.context.move = 0;
        return;
    }
    const admission = await handleFoodAdmission(selection, { state });
    if (admission.handled) {
        state.context.move = admission.heroDied ? 0 : Number(admission.spentTime);
        return;
    }
    let food = admission.food;
    if (food === state.context.victual?.piece) {
        await resumeFoodMeal(food, state);
        if (!state.program_state.gameover)
            state.context.move = 1;
        return;
    }
    if (food.otyp === TIN) {
        await startTin(food, { state });
        if (!state.program_state.gameover)
            state.context.move = 1;
        return;
    }
    const firstFoodLogged = recordFoodConsumption(food, { state });
    const partlyEaten = !!food.oeaten;
    const preparedFood = await touchFoodObject(food, { state });
    if (!preparedFood) {
        await resetFoodMeal(state);
        if (!state.program_state.gameover)
            state.context.move = 1;
        return;
    }
    food = preparedFood;
    const meal = {
        key: 'eat-food', piece: preparedFood, o_id: food.o_id,
        usedtime: 0, reqtime: 0, nmod: 0,
        canchoke: false, fullwarn: false, eating: false, doreset: false,
    };
    state.context.victual = meal;
    let dontStart = false;
    if (food.otyp === CORPSE || food.globby) {
        const result = await prepareCorpseMeal(food, { state });
        if (result === 'dead')
            return;
        if (result === 'consumed') {
            state.context.victual = null;
            state.context.move = 1;
            return;
        }
        dontStart = result === 'delayed';
    }
    else {
        await recordOrdinaryFoodDiet(food, { state, firstFoodLogged });
        meal.reqtime = requireObjectData(OBJECT_DELAY, food.otyp);
        if (ordinaryFoodIsRotten(food, state)) {
            dontStart = await applyRottenFood(food, { state });
            if (dontStart)
                food.orotten = true;
            await consumeRemainingFood(food, 1, { state });
        }
        else if (!partlyEaten) {
            const effect = await applyOrdinaryFoodFirstBite(food, { state });
            if (effect.heroDied)
                return;
            if (!effect.continueMeal) {
                await resetFoodMeal(state);
                state.context.move = 1;
                return;
            }
        }
        else {
            await pline(`You ${meal.reqtime === 1 ? 'eat' : 'begin eating'} ${await inventoryItemDescription(food)}.`);
        }
    }
    const nutrition = foodNutrition(food);
    meal.reqtime = nutrition ? roundNutritionTime(meal.reqtime * preparedFood.oeaten, nutrition) : 0;
    meal.nmod = !meal.reqtime || !preparedFood.oeaten ? 0
        : preparedFood.oeaten >= meal.reqtime ? -Math.trunc(preparedFood.oeaten / meal.reqtime)
            : meal.reqtime % preparedFood.oeaten;
    meal.canchoke = currentHungerState(state) === SATIATED;
    if (dontStart)
        food.owt = objectWeight(food);
    else
        await startFoodMeal(preparedFood, partlyEaten, state);
    if (!state.program_state.gameover)
        state.context.move = 1;
}
// C eat.c:doeat().
async function resumeFoodMeal(originalFood, state) {
    const meal = currentFoodMeal(state);
    const lastBite = meal.usedtime + 1 >= meal.reqtime;
    if (currentHungerState(state) !== SATIATED)
        meal.canchoke = false;
    meal.o_id = 0;
    const food = await touchFoodObject(originalFood, { state });
    if (food) {
        meal.piece = food;
        meal.o_id = food.o_id;
    }
    else
        await resetFoodMeal(state);
    if (state.program_state.gameover)
        return;
    await pline(`You ${lastBite ? 'consume the last bite of' : 'resume'} your meal.`);
    if (food)
        await startFoodMeal(food, false, state);
}
// C eat.c:doeat().
function ordinaryFoodIsRotten(food, state) {
    if (food.otyp === FORTUNE_COOKIE)
        return false;
    if (food.cursed)
        return true;
    return ![LEMBAS_WAFER, CRAM_RATION].includes(food.otyp)
        && state.moves - food.age > (food.blessed ? 50 : 30)
        && (food.orotten || !rn2(7));
}
// C eat.c:doeat().
// doeat increments food before touchfood; the returned flag belongs only to
// that invocation's ordinary-food diet log scope. Corpse diet starts a new one.
export function recordFoodConsumption(food, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    return incrementFood(`ate for the first time - ${foodObjectName(food, { state })}`, state);
}
// C eat.c:doeat().
export async function recordOrdinaryFoodDiet(food, { state = game, firstFoodLogged = false } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    let logged = firstFoodLogged;
    const name = foodObjectName(food, { state });
    if (objectMaterial(food, state) === FLESH) {
        if (incrementConduct('unvegan', state) && !logged) {
            recordGameLogEvent(`consumed animal products for the first time, by eating ${withIndefiniteArticle(name)}`, { state, flags: LL_CONDUCT });
            logged = true;
        }
        if (food.otyp !== EGG) {
            if (!state.u.uconduct.unvegetarian && !logged)
                recordGameLogEvent(`tasted meat for the first time, by eating ${withIndefiniteArticle(name)}`, { state, flags: LL_CONDUCT });
            await violateVegetarian(state);
        }
    }
    else if (ANIMAL_INGREDIENTS.has(food.otyp)) {
        if (incrementConduct('unvegan', state) && !logged)
            recordGameLogEvent(`consumed animal products (${name}) for the first time`, { state, flags: LL_CONDUCT });
    }
}
// C eat.c:doeat().
export async function handleFoodAdmission(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (exceedsActionCapacity(state)) {
        await pline("You can't do that while carrying so much stuff.");
        return admissionResult(true, false, state);
    }
    if (!await checkFoodEdibility(object, { state }))
        return admissionResult(true, false, state);
    if ('kind' in object) {
        await chewIronBars({ state });
        return admissionResult(true, true, state);
    }
    if (!isEdibleFood(object, state)) {
        await pline('You cannot eat that!');
        return admissionResult(true, false, state);
    }
    if ((object.owornmask ?? 0) & (W_ARMOR | W_TOOL | W_AMUL | W_SADDLE)) {
        await pline("You can't eat something you're wearing.");
        return admissionResult(true, false, state);
    }
    if (object.where === 'inventory') {
        const touch = await retouchHeroObject(object, { state });
        if (touch.died || touch.rejected)
            return admissionResult(true, true, state);
    }
    else {
        const touch = await touchArtifactByHero(object, artifactById(object.oartifact, state), { state });
        if (touch.died || touch.allowed === false)
            return admissionResult(true, true, state);
    }
    const material = objectMaterial(object, state);
    if (material >= IRON && material <= MITHRIL
        && state.u.umonnum === RUST_MONSTER && object.oerodeproof) {
        await spitOutRustproofObject(object, state);
        return admissionResult(true, true, state);
    }
    if (object.otyp === RIN_SLOW_DIGESTION) {
        await pline('This ring is indigestible!');
        await applyRottenFood(object, { state });
        if (object.dknown)
            await tryCallObjectType(object, state);
        return admissionResult(true, true, state);
    }
    if (object.oclass === FOOD_CLASS)
        return { handled: false, food: object, spentTime: false, heroDied: !!state.program_state.gameover };
    await eatNonFood(object, state);
    return admissionResult(true, true, state);
}
// C eat.c:doeat().
function admissionResult(handled, spentTime, state) {
    return { handled, spentTime, heroDied: !!state.program_state.gameover };
}
// C eat.c:doeat().
async function spitOutRustproofObject(object, state) {
    object.rknown = true;
    if (objectQuantity(object) > 1) {
        const carried = object.where === 'inventory';
        const split = splitObjectStack(object, carried ? 1 : objectQuantity(object) - 1, state);
        if (!split)
            throw new Error(`Edible stack ${object.o_id} could not be split`);
        if (carried)
            object = split;
    }
    await pline(`Ulch - that ${objectName(object, state)} was rustproofed!`);
    object.oerodeproof = false;
    await makeStunned((state.u.stunnedTurns || 0) + rn2(10), { state });
    if (isWeldedPrimary(object, state) || object.cursed && ((object.owornmask ?? 0) & W_RING)) {
        object.bknown = true;
        await pline(`You spit out the ${objectName(object, state)}.`);
        return;
    }
    await pline(`You spit the ${objectName(object, state)} out onto the ${surfaceName(state.u.ux, state.u.uy, state)}.`);
    if (object.where === 'inventory') {
        if (object.owornmask)
            await removeWornHeroItem(object, state);
        if (state.program_state.gameover)
            return;
        await freeInventoryObject(object, state);
        if (state.program_state.gameover)
            return;
        await dropObjectAtHero(object, { state });
    }
    if (object.where === 'floor')
        await stack_object(object, state);
}
// C eat.c:use_tin_opener().
export async function useTinOpener(tool, { state = game, swapWeapons } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!state.inventory.some(object => object.otyp === TIN)) {
        await plineWithContinuation('You have no tin to open.');
        return { usedTime: false, cancelled: false, heroDied: false };
    }
    let usedTime = false;
    if (tool !== state.uwep) {
        if (tool.cursed && tool.bknown && await promptYesNoQuit(`Really wield ${await inventoryItemDescription(tool)}?`) !== 'y')
            return { usedTime, cancelled: true, heroDied: false };
        const wielded = await wieldTool(tool, 'use', { swapWeapons }, state);
        if (!wielded.ready || state.program_state.gameover)
            return { usedTime, cancelled: false, heroDied: !!state.program_state.gameover };
        usedTime = true;
    }
    const tin = await chooseInventoryObject('open', object => object?.otyp === TIN ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE);
    // eat.c:use_tin_opener() returns res|ECMD_CANCEL for a declined tin;
    // res is ECMD_TIME when the opener was wielded this command, and
    // rhack() lets the TIME bit keep the turn despite the cancellation.
    if (!tin) {
        commandResultCancelled(state);
        if (usedTime)
            commandResultSpentTime(state);
        return { usedTime, cancelled: true, heroDied: false };
    }
    const result = await startTin(tin, { state });
    return { usedTime: true, cancelled: false, heroDied: result.heroDied };
}
// C eat.c:bite().
// C eat.c:recalc_wt().
async function takeFoodBite(state) {
    const meal = currentFoodMeal(state);
    if (meal.canchoke && state.u.uhunger >= 2000) {
        await chokeHeroOnFood(meal.piece, { state });
        return true;
    }
    if (meal.doreset) {
        await resetFoodMeal(state);
        return false;
    }
    state.context.forceSaveHungerState = true;
    try {
        if (meal.nmod < 0) {
            await gainHeroNutrition(adjustedBiteNutrition(meal, state), { state });
            if (state.program_state.gameover)
                return true;
            await consumeRemainingFood(currentMealFood(meal), meal.nmod, { state });
        }
        else if (meal.nmod > 0 && meal.usedtime % meal.nmod) {
            await gainHeroNutrition(1, { state });
            if (state.program_state.gameover)
                return true;
            await consumeRemainingFood(currentMealFood(meal), -1, { state });
        }
    }
    finally {
        delete state.context.forceSaveHungerState;
    }
    const food = currentMealFood(meal);
    food.owt = objectWeight(food);
    return false;
}
// C eat.c:gethungry().
function ringCostsNutrition(ring, slot) {
    if (!ring || ring.otyp === MEAT_RING)
        return false;
    if ((ring.spe || 0) !== 0 || !OBJECT_CHARGED[ring.otyp])
        return true;
    if (ring.otyp !== RIN_PROTECTION)
        return false;
    const sources = game.u._propertySources?.protection;
    const others = (sources?.worn || []).filter(source => source.slot !== slot);
    if (sources?.invoked || sources?.carried?.length)
        return false;
    if (!others.length)
        return true;
    // Two +0 protection rings charge the left ring only.
    return slot === 'uleft' && others.length === 1 && others[0]?.slot === 'uright'
        && game.uright?.otyp === RIN_PROTECTION && !(game.uright.spe || 0);
}
// C eat.c:gethungry().
function regenerationCostsNutrition() {
    const hero = game.u;
    const sources = hero._propertySources?.regeneration;
    return hero.regenerationIntrinsic || (hero.regenerationTurns ?? 0) > 0
        || Object.keys(sources?.intrinsic || {}).some(origin => origin !== 'form')
        || sources?.worn?.some(source => source.slot !== 'uwep')
        || !!sources?.carried?.length;
}
// C eat.c:gethungry().
function accessoryNutritionCost(accessoryTime) {
    const u = game.u;
    let cost = 0;
    if (accessoryTime % 2) {
        if (regenerationCostsNutrition())
            cost++;
        if (nearCapacity(game) > 1)
            cost++;
        return cost;
    }
    // Hunger and Conflict are independent C properties and can both charge.
    if (u.hunger)
        cost++;
    if (hasNonArtifactConflict(game))
        cost++;
    switch (accessoryTime) {
        case 0:
            if (u.slowDigestion
                && game.uright?.otyp !== RIN_SLOW_DIGESTION
                && game.uleft?.otyp !== RIN_SLOW_DIGESTION)
                cost++;
            break;
        case 4:
            if (ringCostsNutrition(game.uleft, 'uleft'))
                cost++;
            break;
        case 8:
            if (game.uamul?.otyp !== undefined
                && game.uamul.otyp !== FAKE_AMULET_OF_YENDOR)
                cost++;
            break;
        case 12:
            if (ringCostsNutrition(game.uright, 'uright'))
                cost++;
            break;
        case 16:
            if (u.uhave?.amulet || u.haveAmulet
                || game.inventory?.some(object => object.otyp === AMULET_OF_YENDOR))
                cost++;
            break;
        default:
            break;
    }
    return cost;
}
// C eat.c:gethungry().
export async function getHungry({ invulnerable = false } = {}) {
    const state = requireInitializedGame();
    const u = state.u;
    if (invulnerable || u.invulnerable || game.iflags?.debug_hunger)
        return null;
    if (!Number.isInteger(u.uhunger))
        u.uhunger = 900;
    u.uhs ??= currentHungerState(game);
    // C checks awareness before diet or slow digestion: an unaware hero
    // spends this random draw even in a body which does not eat.
    const currentFormEats = !!(requireMonsterData(MONSTER_FLAGS1, heroSpecies(game))
        & (M1_METALLIVORE | M1_CARNIVORE | M1_HERBIVORE));
    if ((!heroIsUnaware(game) || rn2(10) === 0)
        && currentFormEats && !u.slowDigestion)
        u.uhunger--;
    const accessoryTime = rn2(20);
    u.uhunger -= accessoryNutritionCost(accessoryTime);
    await updateHeroHunger(true);
    return accessoryTime;
}
// C eat.c:morehungry(). A zero or negative amount still runs newuhs(TRUE).
export async function spendHeroNutrition(amount, { state = game } = {}) {
    requirePlayingGame(state);
    state.u.uhs ??= currentHungerState(state);
    state.u.uhunger = (state.u.uhunger ?? 900) - amount;
    await updateHeroHunger(true, { state });
}
// C eat.c:lesshungry(). Fullness belongs to this common boundary, including
// nutrition received outside a meal.
export async function gainHeroNutrition(amount, { state = game } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    hero.uhs ??= currentHungerState(state);
    hero.uhunger = (hero.uhunger ?? 900) + amount;
    const victual = state.context.victual;
    const eating = state._occupation?.key === 'eat-food'
        || state.context.forceSaveHungerState;
    if (hero.uhunger >= 2000) {
        if (!eating || victual?.canchoke) {
            await chokeHeroOnFood(eating ? victual?.piece
                : state._occupation?.key === 'open-tin' ? state.context.tin?.tin ?? null : null, { state });
            if (state.program_state.gameover)
                return;
            if (eating && victual?.eating)
                victual.doreset = true;
        }
    }
    else if (hero.uhunger >= 1500 && !hero.hunger
        && (!victual?.eating || !victual.fullwarn)) {
        await plineWithContinuation("You're having a hard time getting all of it down.");
        if (!victual?.eating) {
            setMulti(-2, state);
            state._helplessReason = 'finishing a meal';
            state._helplessDoneMessage = "You're finally finished.";
        }
        else {
            victual.fullwarn = true;
            state._helplessDoneMessage = "You're finally finished.";
            if (victual.canchoke && victual.reqtime - victual.usedtime > 1
                && !await paranoidQuery(!!((state.flags?.paranoia_bits ?? 0) & PARANOID_EATING), 'Continue eating?')) {
                victual.doreset = true;
                state._helplessDoneMessage = null;
            }
        }
    }
    await updateHeroHunger(false, { state });
}
// C eat.c:unfaint().
export async function recoverHeroFromFainting({ state = game } = {}) {
    requirePlayingGame(state);
    await regainHearingAfterHelplessness({ state });
    if (state.u.uhs > FAINTING)
        state.u.uhs = FAINTING;
    await stopHeroOccupation(state);
    await bot();
}
// C eat.c:reset_faint() calls unmul("You revive.") only when unfaint
// owns the recovery. A different involuntary delay must remain in place.
export async function resetHeroFaint({ state = game } = {}) {
    requirePlayingGame(state);
    if (state._afterMove?.kind !== 'unfaint')
        return false;
    await finishHeroHelplessness('You revive.', state);
    return true;
}
// C eat.c:newuhs().
export function currentHungerState(state = game) {
    if (state.u.uhs === FAINTED || state.u.uhs === STARVED)
        return state.u.uhs;
    const nutrition = state.u.uhunger ?? 900;
    return nutritionState(nutrition);
}
// C eat.c:newuhs().
function nutritionState(nutrition) {
    return nutrition > 1000 ? SATIATED : nutrition > 150 ? NOT_HUNGRY
        : nutrition > 50 ? HUNGRY : nutrition > 0 ? WEAK : FAINTING;
}
// C eat.c:newuhs(). Eating saves the state from before the first bite so
// recovery prose describes the whole meal, rather than each intermediate bite.
export async function updateHeroHunger(increasing, { state = game } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    let next = nutritionState(hero.uhunger ?? 900);
    const context = state.context;
    if (state._occupation?.key === 'eat-food' || context.forceSaveHungerState) {
        // newuhs() changes uhs here without requesting a status redraw.
        context.hungerStateBeforeMeal ??= hero.uhs ?? NOT_HUNGRY;
        hero.uhs = next;
        return;
    }
    if (context.hungerStateBeforeMeal != null) {
        hero.uhs = context.hungerStateBeforeMeal;
        delete context.hungerStateBeforeMeal;
    }
    const old = hero.uhs ?? NOT_HUNGRY;
    if (next === FAINTING) {
        const rounded = Math.sign(hero.uhunger)
            * Math.trunc((Math.abs(hero.uhunger) + 5) / 10);
        if (old === FAINTED)
            next = FAINTED;
        if (old <= WEAK || rn2(20 - rounded) >= 19) {
            if (old !== FAINTED && (state.multi ?? 0) >= 0
                && !((state._helplessTurns ?? 0) > 0)) {
                await faintFromHunger(10 - rounded, state);
                if (state.program_state.gameover)
                    return;
                next = FAINTED;
            }
        }
        else if (hero.uhunger < -(100 + 10 * currentAttribute(A_CON, state))) {
            hero.uhs = STARVED;
            await bot();
            await dieFromHunger('starvation', state);
            return;
        }
    }
    if (next === old)
        return;
    hero.atemp ||= { a: [0, 0, 0, 0, 0, 0] };
    if (next >= WEAK && old < WEAK)
        hero.atemp.a[A_STR] = -1;
    else if (next < WEAK && old >= WEAK)
        hero.atemp.a[A_STR] = 0;
    if (next === HUNGRY || next === WEAK) {
        await plineWithContinuation(hungerMessage(next, increasing, state));
        if (increasing && state._occupation
            && !['eat-food', 'open-tin'].includes(state._occupation.key))
            await stopHeroOccupation(state);
        stopRun(state);
    }
    hero.uhs = next;
    state.context.botl = true;
    await bot();
    if ((Upolyd(hero) ? hero.mh : hero.uhp) < 1)
        await dieFromHunger('exhaustion', state);
}
// C eat.c:newuhs().
function hungerMessage(next, increasing, state) {
    if (heroIsHallucinating(state)) {
        if (next === HUNGRY)
            return increasing
                ? 'You are getting the munchies.' : 'You now have a lesser case of the munchies.';
        return increasing ? 'The munchies are interfering with your motor capabilities.'
            : 'You still have the munchies.';
    }
    if (next === HUNGRY)
        return !increasing ? 'You only feel hungry now.'
            : state.u.uhunger < 145 ? 'You feel hungry.' : 'You are beginning to feel hungry.';
    if (increasing && (['wizard', 'valkyrie'].includes(state.urole?.key)
        || state.urace?.name === 'elf')) {
        const name = ['wizard', 'valkyrie'].includes(state.urole?.key)
            ? state.urole.name.m : 'Elf';
        return `${name} needs food, badly!`;
    }
    return !increasing ? 'You are still weak.'
        : state.u.uhunger < 45 ? 'You feel weak.' : 'You are beginning to feel weak.';
}
// C eat.c:newuhs().
async function faintFromHunger(duration, state) {
    await stopHeroOccupation(state);
    await plineWithContinuation('You faint from lack of food.');
    await makeDeaf((state.u.deafTurns ?? 0) + duration, { state, talk: false });
    nomul(-duration, state);
    state._helplessReason = 'fainted from lack of food';
    state._helplessDoneMessage = 'You regain consciousness.';
    state._afterMove = { kind: 'unfaint' };
    // C eat.c:newuhs(): "if (!Levitation) selftouch("Falling, you");" —
    // gloves do not shield the hero from the wielded corpse.
    if (!propertyIsActive('levitation', state)) {
        await selfTouchPetrifyingWeapons({
            messageStart: 'Falling, you', state, publish: plineWithContinuation,
        });
    }
}
// C eat.c:newuhs().
async function dieFromHunger(cause, state) {
    await plineWithContinuation(cause === 'starvation'
        ? 'You die from starvation.' : 'You die from hunger and exhaustion.');
    const died = await finishHeroDeath({
        killer: cause, deathCause: `died of ${cause}`, deathVerb: 'starved',
        deathType: STARVING, deathLineShown: true,
    });
    if (!died)
        await updateHeroHunger(false, { state });
}
// C eat.c:vomit().
function installVomitingHelplessness(state) {
    if (currentMulti(state) < -2)
        return;
    nomul(-2, state);
    state._helplessReason = 'vomiting';
    state._helplessDoneMessage = 'You can move again.';
}
// C eat.c:vomit().
async function cureFoodPoisoningByVomiting(state, publish) {
    const hero = state.u;
    if (!((hero.sickType ?? 0) & SICK_VOMITABLE))
        return false;
    // potion.c make_sick(0): the cure line pages before Sick is cleared and
    // botl is raised, so the --More-- it raises still shows the old status.
    return cureHeroSicknessWithMessages(state, SICK_VOMITABLE, publish);
}
// C eat.c:vomit().
export async function vomitHero({ state = game, publish = immediatePline, angerAltar = altarWrath, melt = meltIce, random = rn2, rollDice = d, } = {}) {
    const hero = state.u;
    const cannotVomit = heroCannotVomit(state);
    const hungerState = currentHungerState(state);
    hero.uhs = hungerState;
    if (cannotVomit) {
        await publish('Your jaw gapes convulsively.');
    }
    else {
        await cureFoodPoisoningByVomiting(state, publish);
        if (hungerState >= FAINTING)
            await publish(`Your ${heroStomachName(state)} heaves convulsively!`);
    }
    installVomitingHelplessness(state);
    if (cannotVomit || hungerState >= FAINTING)
        return { spewed: false, cannotVomit };
    const x = hero.ux, y = hero.uy;
    const acidBreath = heroAcidBreathAttack(state);
    if (acidBreath) {
        await publish('You breathe acid on yourself...');
        const breath = await hitHeroWithRay({
            state,
            attack: acidBreath,
            publish,
            random,
            rollDice,
        });
        if (breath.heroDied)
            return { spewed: true, cannotVomit: false, heroDied: true };
    }
    if (state.level?.at(x, y)?.typ === ALTAR)
        await angerAltar(x, y, state);
    const form = heroMonsterForm(state);
    if (form != null
        && ((MONSTER_FLAGS1[form] ?? 0) & M1_ACID)
        && isIceAt(x, y, state)) {
        await melt(x, y, {
            message: 'Your stomach acid melts straight through the ice!',
        });
    }
    return { spewed: true, cannotVomit: false };
}
// C eat.c:consume_oeaten().
// Native consume_oeaten(): positive adjustments divide by a power of two;
// negative adjustments subtract a bite. Zero remains reserved for untouched food.
export async function consumeRemainingFood(food, adjustment, { state = game } = {}) {
    if (!foodNutrition(food)) {
        const type = food.otyp === CORPSE ? 'corpse' : food.otyp === EGG ? 'egg'
            : food.otyp === TIN ? 'tin' : null;
        const name = type ? `${type} [${food.corpsenm}]` : String(food.otyp);
        await impossible(`oeaten: attempting to set 0 nutrition food (${name}) partially eaten`, { state });
        return;
    }
    requirePreparedFood(food);
    food.oeaten = adjustment > 0 ? food.oeaten >>> adjustment
        : Math.max(0, food.oeaten + adjustment);
    if (!food.oeaten) {
        const meal = state.context.victual;
        if (meal?.piece === food)
            meal.reqtime = meal.usedtime;
        food.oeaten = 1;
    }
}
// C eat.c:Popeye(): do not interrupt opening a tin which might cure the
// current threat. Unknown contents are given the benefit of the doubt.
export function openingTinMaySaveHero(threat, state = game) {
    if (state._occupation?.key !== 'open-tin')
        return false;
    const tin = state.context.tin?.tin;
    if (!tin)
        return false;
    const available = tin.where === 'inventory'
        || tin.where === 'floor' && tin.ox === state.u.ux && tin.oy === state.u.uy
            && state.level?.objects[tin.ox]?.[tin.oy]?.includes(tin)
            && heroCanReachFloor(state, { checkPit: true });
    if (!available)
        return false;
    if (!tin.known)
        return true;
    const species = tinSpecies(tin);
    switch (threat) {
        case 'hunger': return species !== -1 || tin.spe === 1;
        case 'stoned':
            return species >= 0 && (MONSTER_NAME[species] === 'lizard'
                || !!(requireMonsterData(MONSTER_FLAGS1, species) & 0x08000000));
        case 'slimed':
            return species >= 0 && (!!(requireMonsterData(MONSTER_FLAGS2, species) & 0x00004000)
                || requireMonsterData(MONSTER_ATTACKS, species).some(([, damage]) => damage === AD_POLY));
        case 'sick':
        case 'vomiting': return false;
    }
}
// C eat.c:Finish_digestion(). Corpse post-effects once digestion completes.
export async function finishHeroDigestion(state = game) {
    const species = state._digestedMonsterSpecies;
    if (species === undefined || species === null)
        return;
    await applyCorpsePostEffects(species, { state });
    state._digestedMonsterSpecies = null;
}
//# sourceMappingURL=eat.js.map