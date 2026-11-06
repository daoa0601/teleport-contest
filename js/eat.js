// Hero eating and nutrition. Ports from eat.c.
import { RANDOM_CLASS, WEAPON_CLASS, RING_CLASS, AMULET_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, COIN_CLASS, GEM_CLASS, BALL_CLASS, CHAIN_CLASS, } from './objclass.js';
import { objectPropertyName, oc_nutrition, objectDelay, objectCharged, AMULET_OF_STRANGULATION, AMULET_OF_YENDOR, APPLE, AXE, CANDY_BAR, CARROT, CLOVE_OF_GARLIC, CORPSE, CRAM_RATION, CREAM_PIE, EGG, EUCALYPTUS_LEAF, FAKE_AMULET_OF_YENDOR, FLINT, FOOD_RATION, FORTUNE_COOKIE, GLOB_OF_GREEN_SLIME, GOLD_PIECE, LEASH, LEMBAS_WAFER, LUMP_OF_ROYAL_JELLY, MEAT_RING, OBJECT_NAMES, ORANGE, PANCAKE, PEAR, PICK_AXE, RIN_PROTECTION, RIN_SLOW_DIGESTION, SCR_SCARE_MONSTER, SLIME_MOLD, SPRIG_OF_WOLFSBANE, TIN, TIN_OPENER, TRIDENT, TRIPE_RATION, } from './object_data.js';
import { heroCannotVomit, sameMonsterRace, monsterCanTeleport, monsterControlsTeleport, poisonous, acidic, your_race, carnivorous, herbivorous, is_dwarf, is_elf, is_orc, is_shapeshifter, metallivorous, monsterHasProperName, monsterIsGiant, monsterIsHumanoid, monsterIsMindless, monsterIsNoncorporeal, monsterIsRider, monsterIsUndead, monsterPerceives, fleshPetrifies, formCanBecomeStoneGolem, heroResistsStoning, heroWouldPetrifyFromFlesh, } from './mondata.js';
import { setHeroPetrificationTimeout, makeDeaf, startHeroSickness, showInvisibilityMessage, makeConfused, makeHallucinated, makeStunned, drinkPotion, makeBlinded, setSlipperyHands, cureHeroSicknessWithMessages, heroIsSick, heroIsSliming, startHeroSliming, makeHeroVomiting, } from './potion.js';
import { eatPetrifyingEgg, heroIsPetrifying } from './stoning.js';
import { removeHeroAccessory, armorSimpleName } from './do_wear.js';
import { finishHeroHelplessness, stopHeroOccupation } from './allmain.js';
import { artifactById, artifactByName, touchArtifactByHero } from './artifact.js';
import { adjustAttribute, adjustHeroAlignment, attributeChangeMessage, currentAttribute, currentStrength, exerciseAttribute, exerciseWisdom, extrinsicPropertyMask, gainHeroStrength, intrinsicPropertyMask, poisonHeroStrengthAndHp } from './attrib.js';
import { bot } from './botl.js';
import { commandResultCancelled, commandResultSpentTime, currentMulti, setMulti, setOccupation, paranoidQuery } from './cmd.js';
import { ALTAR, A_CHA, A_CON, A_DEX, A_INT, A_LAWFUL, A_STR, A_WIS, CHOKING, DIED, DISMOUNT_FELL, EXPL_FIERY, FAINTED, FAINTING, GD_EATGOLD, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, HEALTHY_TIN, HOMEMADE_TIN, HUNGRY, Is_airlevel, Is_waterlevel, KILLED_BY, KILLED_BY_AN, LUCKMIN, MON_FLOOR, M_AP_NOTHING, M_AP_OBJECT, M_ATTK_AGR_DIED, M_ATTK_HIT, M_ATTK_MISS, NOT_HUNGRY, PARANOID_EATING, POISONING, RANDOM_TIN, ROTTEN_TIN, SATIATED, SICK_VOMITABLE, SPINACH_TIN, STARVED, STARVING, STONING, TIMEOUT, Upolyd, WEAK, W_AMUL, W_ARMOR, W_RING, W_SADDLE, W_TOOL, FINGER, LIGHT_HEADED, STOMACH, NOSE, LL_CONDUCT, } from './const.js';
import { reviveCorpseImmediately } from './do.js';
import { impossible } from './diagnostics.js';
import { canSeeMonster, canSpotMonster, flush_screen, newsym, see_monsters, refreshHeroSeeing, curs_on_u } from './display.js';
import { tryCallObjectType, healHeroLegs, dropInventoryObjectAtHero, dropObjectAtHero } from './do.js';
import { displayColorName, monsterName, randomDisplayMonsterName } from './do_name.js';
import { eggIsStale, isPyroliskEgg } from './egg_impact.js';
import { encumber_msg } from './pickup.js';
import { finishHeroDeath, finishMonsterAttackDeath } from './end.js';
import { addExperience, checkExperienceLevel, gainExperienceLevel } from './exper.js';
import { explode } from './explode.js';
import { useUpFloorObject, stack_object } from './invent.js';
import { heroCanReachFloor } from './engrave.js';
import { isEdibleFood, selectFoodToEat } from './food_selection.js';
import { nonrottingCorpse, veganCorpse, vegetarianCorpse } from './food_traits.js';
import { game, requireGameLevel, requireInitializedGame, requireLiveGame, requirePlayingGame } from './gstate.js';
import { nomul, loseHeroHp, chewIronBars, stopRun, exceedsActionCapacity, nearCapacity } from './hack.js';
import { possessiveName } from './hacklib.js';
import { heroAcidBreathAttack, hitHeroWithRay, meltIce } from './zap.js';
import { hasNonArtifactConflict } from './hero_conflict.js';
import { gainCorpseDisplacement } from './hero_displacement.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { freeInventoryObject, useUpInventoryStack, addInventoryItem, chooseInventoryObject, consumeInventoryItem, inventoryItemDescription } from './invent.js';
import { heroIsInvisible, invisibilityIsBlocked, syncHeroInvisibility } from './hero_invisibility.js';
import { retouchEquipment, retouchHeroObject } from './artifact.js';
import { heroIsUnaware, heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { putHeroToSleep } from './timeout.js';
import { changeHeroSex, heroIsBreathless, heroSpecies, heroHasNoHands, heroIsPolymorphed, heroIsUnchanging, heroIsVerySmall, heroMonsterForm, polymonHero, polymorphHero, returnHeroToHumanForm, heroIsSlimeproof, body_part } from './polyself.js';
import { releaseObjectLeash } from './apply.js';
import { recordLiteracy } from './literacy.js';
import { objectQuantity, splitObjectStack, objectWeight, objectIsRottable } from './mkobj.js';
import { objectIsMetallic } from './object_properties.js';
import { finishEnvironmentalMonsterDeath, prepareMonsterPetrification, restoreNaturalMonsterShapes } from './mon.js';
import { makeMonsterFlee } from './monmove.js';
import { AD_BLND, AD_HALU, AD_POLY, AD_STUN, AT_ENGL, AT_MAGC } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_CONVEYS, MONSTER_FLAGS1, MONSTER_GENO, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SYMBOL, monsterTypeName, requireMonsterData, PM_GREEN_SLIME, } from './monster_data.js';
import { learnObjectType, objectMaterial, observeObject, recordObjectKnowledge } from './o_init.js';
import { corpseName, definiteName, killerObjectName, makePlural, objectHasPersonalName, objectName, objectNameIsPlural, observeObjectForNaming, ownedObjectName, pluralizeObjectNoun, withIndefiniteArticle } from './objnam.js';
import { pline as immediatePline, pline1, plineWithContinuation as pline, plineWithContinuation, recordGameLogEvent, formatFeltMessage, publishHeardMessage, } from './pline.js';
import { altarWrath } from './pray.js';
import { grantIntrinsicProperty, hasCarriedProperty, hasIntrinsicProperty, hasInvokedProperty, hasPermanentIntrinsicProperty, hasTimedProperty, hasWornProperty, propertyIsActive, propertyIsBlocked, propertyTimeout, refreshProperty, removePermanentIntrinsicProperty, setPropertyTimeout } from './properties.js';
import { unpunishHero } from './read.js';
import { promptYesNo, promptYesNoQuit } from './query.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { readCookieFortune } from './rumors.js';
import { SELL_DONTSELL, SELL_NORMAL, chargeAlteredUnpaidObject, costlySpot, setSellDisposition } from './shk.js';
import { dismountHero } from './steed.js';
import { surfaceName } from './dungeon.js';
import { isIceAt } from './dbridge.js';
import { attrcurse } from './throne.js';
import { flushPendingTopline } from './topl.js';
import { vaultGdWatching } from './vault.js';
import { catchLycanthropyFromCorpse, purifyHeroLycanthropy, wereBeastForSpecies } from './were.js';
import { isWeldedPrimary, uqwepgone, uswapwepgone, uwepgone, wieldTool } from './wield.js';
import { captureLevitationState, floatHeroUp, triggerBoobyTrap, selfTouchPetrifyingWeapons } from './trap.js';
const G_UNIQ = 0x1000;
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
const DRAGON_HIDE = 10;
const K_RATION = OBJECT_NAMES.indexOf('K-ration');
const C_RATION = OBJECT_NAMES.indexOf('C-ration');
const BLAND_FOODS = new Set([CRAM_RATION, K_RATION, C_RATION]);
// Native olfaction is based on monster class, not eyes or living anatomy.
const NO_OLFACTION = new Set([2, 5, 10, 22, 25, 31, 32, 42, 55]);
const PM_STONE_GOLEM = MONSTER_NAME.indexOf('stone golem');
// The human were-forms and their animal forms share neutral display names.
const HUMAN_WERE_FORMS = new Set([261, 262, 263]);
const domesticAnimals = new Set(['little dog', 'dog', 'large dog', 'kitten', 'housecat', 'large cat']);
const S_MIMIC = requireMonsterData(MONSTER_SYMBOL, MONSTER_NAME.indexOf('small mimic'));
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
const RUST_MONSTER = MONSTER_NAME.indexOf('rust monster');
const PAPER = 5;
const SCR_MAIL = OBJECT_NAMES.indexOf('mail');
// C eat.c:init_uhunger(). Hunger weakens temporary, not innate, strength.
export async function init_uhunger(state = game, publish = plineWithContinuation) {
    requirePlayingGame(state);
    const hero = state.u;
    state.context.botl = hero.uhs !== NOT_HUNGRY || (hero.atemp?.a[A_STR] ?? 0) < 0;
    hero.uhunger = 900;
    hero.uhs = NOT_HUNGRY;
    if (!hero.atemp || !(hero.atemp.a[A_STR] < 0))
        return;
    hero.atemp.a[A_STR] = 0;
    await encumber_msg(state, publish);
}
// C eat.c:eatmdone().
export async function eatmdone(state = game) {
    if (state._helplessDoneMessage === state._mimicMealMessage)
        state._helplessDoneMessage = null;
    state._mimicMealMessage = null;
    if (state.u.m_ap_type) {
        state.u.m_ap_type = M_AP_NOTHING;
        await newsym(state.u.ux, state.u.uy);
    }
}
// C eat.c:eatmupdate().
export async function eatmupdate(state = game) {
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
export function food_xname(object, { state = game, definite = false, } = {}) {
    if (object.otyp === CORPSE)
        return corpseName(object, { singular: true, definite });
    const name = objectName(object, state);
    return definite ? definiteName(name, state) : name;
}
// C eat.c:choke(). An initially hungry eater cannot choke merely because
// the meal fills her up; canchoke retains the state from before the meal.
export async function choke(food, { state = game } = {}) {
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
        await morehungry(hero.hunger ? hero.uhunger - 60 : 1000, { state });
        if (state.program_state.gameover)
            return;
        await vomit({ state, publish: plineWithContinuation });
        return;
    }
    await plineWithContinuation(food ? `You choke over your ${foodword(food, state)}.`
        : 'You choke over it.');
    const cause = !food ? 'a quick snack' : food.oclass === COIN_CLASS
        ? 'a very rich meal' : killerObjectName(food, state);
    await plineWithContinuation('You die...');
    const died = await finishHeroDeath({
        killer: cause, deathCause: `choked on ${cause}`, deathVerb: 'choked',
        deathType: CHOKING, deathLineShown: true,
    });
    if (!died)
        await newuhs(false, { state });
}
// C eat.c:obj_nutrition().
export function obj_nutrition(food) {
    if (food.otyp === CORPSE) {
        const species = food.corpsenm;
        return species === undefined ? 0 : MONSTER_BODY_META[species]?.[1] ?? 0;
    }
    return food.globby ? food.owt : oc_nutrition(food.otyp);
}
// C eat.c:adj_victual_nutrition().
function adj_victual_nutrition(meal, state) {
    let nutrition = -meal.nmod;
    const food = currentMealFood(meal);
    const elf = Upolyd(state.u) ? is_elf(heroSpecies(state)) : state.urace.name === 'elf';
    const orc = Upolyd(state.u) ? is_orc(heroSpecies(state)) : state.urace.name === 'orc';
    const dwarf = Upolyd(state.u) ? is_dwarf(heroSpecies(state)) : state.urace.name === 'dwarf';
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
export async function touchfood(food, { state = game } = {}) {
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
        food.oeaten = obj_nutrition(food);
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
// Port boundary: narrow an object whose oeaten field has been initialized.
export function requirePreparedFood(food) {
    if (food.oeaten === undefined)
        throw new Error(`Food ${food.o_id} has not been prepared for eating`);
}
// C eat.c:recalc_wt().
function recalc_wt(food) {
    food.owt = objectWeight(food);
}
// C eat.c:do_reset_eat().
async function do_reset_eat(state) {
    const meal = state.context.victual;
    if (meal?.piece && meal.piece.where !== 'gone') {
        meal.o_id = 0;
        meal.piece = await touchfood(meal.piece, { state });
        if (meal.piece) {
            meal.o_id = meal.piece.o_id;
            recalc_wt(meal.piece);
        }
    }
    if (meal)
        meal.fullwarn = meal.eating = meal.doreset = false;
    await stopHeroOccupation(state);
    if (!state.program_state.gameover)
        await newuhs(false, { state });
}
// C eat.c:temp_resist().
export function temp_resist(property) {
    return propertyTimeout(property) && !(intrinsicPropertyMask(property) & ~TIMEOUT)
        && !extrinsicPropertyMask(property) && !propertyIsBlocked(property) ? 'temporarily ' : '';
}
// C eat.c:eating_dangerous_corpse().
export function eating_dangerous_corpse(property, { state = game } = {}) {
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
    return property === 'acidResistance' ? acidic(food.corpsenm)
        : property === 'stoneResistance' && fleshPetrifies(food.corpsenm);
}
// C eat.c:eatfood().
export async function eatfood(_occupation, state = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const meal = state.context.victual;
    const food = meal?.piece;
    const available = food && (food.where === 'inventory'
        || food.where === 'floor' && food.ox === state.u.ux && food.oy === state.u.uy
            && state.level.objects[food.ox]?.[food.oy]?.includes(food));
    if (!available || !meal || meal.key !== 'eat-food') {
        await do_reset_eat(state);
        return false;
    }
    if (!meal.eating) {
        state._occupation = null;
        return false;
    }
    if (++meal.usedtime > meal.reqtime) {
        await done_eating(state, true);
        return false;
    }
    const choked = await bite(state);
    if (choked || state.program_state.gameover)
        state._occupation = null;
    return !choked && !state.program_state.gameover;
}
// Port boundary: require the shared context.victual food-meal state.
function currentFoodMeal(state) {
    const meal = state.context.victual;
    if (!meal || meal.key !== 'eat-food')
        throw new Error('No food meal is active');
    return meal;
}
// Port boundary: require the food retained by context.victual.
function currentMealFood(meal) {
    if (!meal.piece)
        throw new Error(`The current meal no longer has food object ${meal.o_id}`);
    return meal.piece;
}
// C eat.c:done_eating().
async function done_eating(state, showMessage) {
    const food = currentMealFood(currentFoodMeal(state));
    food.in_use = true;
    state._occupation = null;
    await newuhs(false, { state });
    if (state.program_state.gameover)
        return;
    const endMessage = state._helplessDoneMessage;
    if (endMessage != null) {
        // C eat.c:551 `if (gn.nomovemsg)` tests the pointer, so the empty
        // nomovemsg hurtle() left still counts as set: pline1("") reaches
        // update_topl(""), whose append widens the topline gap by two
        // blank columns without glyphs or a pager, and done_eating()
        // clears the message instead of announcing the finished meal.
        if (showMessage)
            await pline1(endMessage);
        state._helplessDoneMessage = null;
    }
    else if (showMessage) {
        const verb = MONSTER_NAME[heroSpecies(state)] === 'fire elemental' ? 'consuming' : 'eating';
        await pline(`You finish ${verb} ${food_xname(food, { state, definite: true })}.`);
    }
    if (food.otyp === CORPSE || food.globby)
        await cpostfx(corpseSpecies(food), { state });
    else
        await fpostfx(food, { state });
    if (state.program_state.gameover)
        return;
    await consumeFoodObject(food, { state });
    state.context.victual = null;
}
// Shared carried()/useup()/useupf() expression used by meal and tin owners.
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
export async function eating_conducts(species, { state = game } = {}) {
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
        await violated_vegetarian(state);
    }
}
// Part of C eat.c:eating_conducts(): the shared food-counter increment and first-food log expression.
// Shared u.uconduct.food++ and first-food livelog expression in eat.c.
function incrementFood(message, state) {
    const first = incrementConduct('food', state);
    if (first)
        recordGameLogEvent(message, { state, flags: LL_CONDUCT });
    return first;
}
// Shared u.uconduct field increment expression in eat.c.
function incrementConduct(key, state) {
    const conduct = state.u.uconduct;
    const first = !conduct[key];
    conduct[key] = (conduct[key] || 0) + 1;
    return first;
}
// C eat.c:eat_brains(). Participant types select the native combat branch.
export async function eat_brains(meal) {
    if (meal.kind === 'hero-attacker') {
        const { monster, context, result } = meal;
        const { state, publish, rollOne } = context;
        const extraDamage = rollOne(10);
        if (monsterIsNoncorporeal(monster)) {
            const owner = possessiveName(monsterName(monster, { state, capitalized: true }));
            await publish(`${owner} brain is unharmed.`);
            return;
        }
        await publish(`You eat ${possessiveName(monsterName(monster, { state }))} brain!`);
        if (fleshPetrifies(monster.mnum) && !heroResistsStoning(state) && !heroIsPetrifying(state)) {
            await setHeroPetrificationTimeout(5, {
                state, killer: monsterTypeName(monster.mnum, monster.female),
                killerFormat: KILLED_BY_AN, publish,
            });
        }
        await eating_conducts(monster.mnum, { state });
        if (monsterIsMindless(monster.mnum)) {
            await publish(`${monsterName(monster, { state, capitalized: true })} doesn't notice.`);
            return;
        }
        if (monsterIsRider(monster)) {
            await publish('Ingesting that is fatal.');
            const cause = `unwisely ate the brain of ${monsterTypeName(monster.mnum, monster.female)}`;
            result.heroDied = await finishHeroDeath({
                killer: cause, deathCause: cause, deathType: DIED, deathLineShown: true,
            });
            if (result.heroDied) {
                result.done = true;
                return;
            }
            exerciseWisdom(false, state);
        }
        else {
            // Native morehungry() accepts negative nutrition and cannot choke.
            await morehungry(-rollOne(30), { state });
            const hero = state.u;
            if (hero.acurr.a[A_INT] < hero.amax.a[A_INT]) {
                // This repairs the base directly, including beneath a dunce cap.
                hero.acurr.a[A_INT] = Math.min(hero.amax.a[A_INT], hero.acurr.a[A_INT] + rollOne(4));
                state.context.botl = true;
            }
            exerciseWisdom(true, state);
        }
        result.damage += extraDamage;
        await maybe_cannibal(monster.mnum, { state });
        return;
    }
    if (meal.kind === 'hero-defender') {
        const { monster, attack, state, publish, rollOne } = meal;
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
    const { attacker, defender, context } = meal;
    const { state, visible, random, rollOne, publish, finishDeath } = context;
    let damage = meal.damage;
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
// C eat.c:CANNIBAL_ALLOWED() macro.
export function heroMayEatOwnKind(state = game) {
    requirePlayingGame(state);
    return state.urole.key === 'caveman' || state.urace.name === 'orc';
}
// C eat.c:maybe_cannibal().
export async function maybe_cannibal(mnum, { state = game, announce = true } = {}) {
    requirePlayingGame(state);
    if ((state._cannibalCheckMove ?? 0) === state.moves)
        return false;
    state._cannibalCheckMove = state.moves;
    const ownRace = !!(your_race(mnum, state));
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
export async function cprefx(mnum, { state = game, food = null, tin = null } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    await maybe_cannibal(mnum, { state });
    if (fleshPetrifies(mnum) && !heroResistsStoning(state)) {
        let transformed = false;
        if (formCanBecomeStoneGolem(heroSpecies(state), state)) {
            transformed = !!(await polymonHero(PM_STONE_GOLEM)).transformed;
            if (state.program_state.gameover)
                return { stopped: true, heroDied: true };
        }
        if (!transformed) {
            if (tin)
                await use_up_tin(tin, { state });
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
            await fix_petrification({ state });
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
        if (acidic(mnum) && heroIsPetrifying(state))
            await fix_petrification({ state });
    }
    return { stopped: false, heroDied: !!state.program_state.gameover };
}
// Part of C eat.c:cprefx(): the slime-admission predicate shared with eatcorpse().
// Shared slime-admission expression in eat.c:cprefx() and eatcorpse().
export function heroCanBeSlimed(state = game) {
    const hero = state.u;
    return !heroIsSliming(state)
        && !hero.unchanging && !state.unchanging
        && !heroIsSlimeproof(state);
}
// C eat.c:fix_petrification(): the timeout stops before its cure feedback.
export async function fix_petrification({ state = game } = {}) {
    if (!heroIsPetrifying(state))
        return false;
    const message = heroIsHallucinating(state)
        ? `What a pity--you just ruined a future piece of ${currentAttribute(A_CHA, state) > 15 ? 'fine ' : ''}art!`
        : 'You feel limber!';
    await setHeroPetrificationTimeout(0, { state, message });
    return true;
}
// C eat.c:intrinsic_possible().
export function intrinsic_possible(property, mnum) {
    const resistance = RESISTANCES.findIndex(resistance => resistance === property);
    if (resistance >= 0)
        return !!(requireMonsterData(MONSTER_CONVEYS, mnum) & (1 << resistance));
    if (property === 'telepathy')
        return TELEPATHIC_SPECIES.has(mnum);
    return property === 'teleportation' ? monsterCanTeleport(mnum) : monsterControlsTeleport(mnum);
}
// C eat.c:should_givit().
export function should_givit(property, mnum) {
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
function temp_givit(property, mnum) {
    const chance = property === 'stoneResistance' ? 6
        : property === 'acidResistance' ? 3 : 0;
    return chance > 0 && requireMonsterData(MONSTER_LEVEL, mnum) > rn2(chance);
}
// C eat.c:givit().
export async function givit(property, mnum, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!should_givit(property, mnum)
        && !temp_givit(property, mnum))
        return;
    const timed = property === 'acidResistance' || property === 'stoneResistance';
    if (!timed && hasIntrinsicProperty(property, 'outside', state))
        return;
    let message;
    const hallucinating = heroIsHallucinating(state);
    switch (property) {
        case 'fireResistance':
            message = hallucinating ? "You be chillin'." : 'You feel a momentary chill.';
            break;
        case 'coldResistance':
            message = formatFeltMessage('full of hot air.', state);
            break;
        case 'sleepResistance':
            message = formatFeltMessage('wide awake.', state);
            break;
        case 'disintegrationResistance':
            message = formatFeltMessage(hallucinating ? 'totally together, man.' : 'very firm.', state);
            break;
        case 'shockResistance':
            message = hallucinating ? formatFeltMessage('grounded in reality.', state)
                : 'Your health currently feels amplified!';
            break;
        case 'poisonResistance':
            message = formatFeltMessage(state.u.poisonResistance ? 'especially healthy.' : 'healthy.', state);
            break;
        case 'telepathy':
            message = formatFeltMessage(hallucinating ? 'in touch with the cosmos.' : 'a strange mental acuity.', state);
            break;
        case 'teleportation':
            message = formatFeltMessage(hallucinating ? 'diffuse.' : 'very jumpy.', state);
            break;
        case 'teleportControl':
            message = formatFeltMessage(hallucinating ? 'centered in your personal space.' : 'in control of yourself.', state);
            break;
        case 'acidResistance':
            message = formatFeltMessage(hallucinating ? 'secure from flashbacks.' : 'less concerned about being harmed by acid.', state);
            break;
        case 'stoneResistance':
            message = formatFeltMessage(hallucinating ? 'unusually limber.' : 'less concerned about becoming petrified.', state);
            break;
    }
    if (timed) {
        if (!state.u[property])
            await plineWithContinuation(message);
        const timeout = `${property}Turns`;
        state.u[timeout] = Math.min(TIMEOUT, (state.u[timeout] || 0) + d(3, 6));
        refreshProperty(property, state);
        return;
    }
    await plineWithContinuation(message);
    grantIntrinsicProperty(property, 'outside', state);
    if (property === 'telepathy' && heroIsBlind(state))
        await see_monsters();
}
// C eat.c:eye_of_newt_buzz().
export async function eye_of_newt_buzz({ state = game } = {}) {
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
export async function cpostfx(mnum, { state = game, tin = null } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (state._mimicMealMessage)
        await eatmdone(state);
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
            if (name === 'stalker') {
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
            if (name !== 'bat')
                await makeStunned((hero.stunnedTurns || 0) + 30, { state, talk: false });
            await makeStunned((hero.stunnedTurns || 0) + 30, { state, talk: false });
            break;
        case 'giant mimic':
        case 'large mimic':
        case 'small mimic':
            {
                const turns = name === 'giant mimic' ? 50 : name === 'large mimic' ? 40 : 20;
                if (requireMonsterData(MONSTER_SYMBOL, heroSpecies(state)) === S_MIMIC || heroIsUnchanging(state))
                    break;
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
                        break;
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
                await curs_on_u();
                await flushPendingTopline();
            }
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
                    await use_up_tin(tin, { state });
                    await lesshungry(200 + (metallivorous(heroSpecies(state)) ? 5 : 0), { state });
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
            await eye_of_newt_buzz({ state });
        const property = corpse_intrinsic(mnum);
        if (property === 'strength')
            await gainHeroStrength(null, 0, { state });
        else if (property)
            await givit(property, mnum, { state });
    }
    return { heroDied: !!state.program_state.gameover };
}
// C eat.c:corpse_intrinsic().
export function corpse_intrinsic(mnum) {
    const giant = monsterIsGiant(mnum);
    let count = giant ? 1 : 0;
    let selected = giant ? 'strength' : null;
    for (const property of CANDIDATES) {
        if (!intrinsic_possible(property, mnum))
            continue;
        if (!rn2(++count))
            selected = property;
    }
    if (giant && count === 1 && !rn2(2))
        selected = null;
    return selected;
}
// C eat.c:violated_vegetarian().
async function violated_vegetarian(state) {
    incrementConduct('unvegetarian', state);
    if (state.urole.key !== 'monk')
        return;
    await pline(formatFeltMessage('guilty.', state));
    adjustHeroAlignment(-1, state);
}
// C eat.c:costly_tin().
async function costly_tin(alteration, state) {
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
export function tin_variety_txt(text) {
    for (const [variety, preparation] of preparations.entries()) {
        if (preparation.name && text.toLowerCase().startsWith(`${preparation.name} `))
            return { variety, remaining: text.slice(preparation.name.length + 1) };
    }
    return { variety: null, remaining: text };
}
// C eat.c:tin_details().
export function tin_details(tin, species = tinSpecies(tin), { state = game } = {}) {
    const variety = tin_variety(tin, true);
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
export function set_tin_variety(tin, mode = RANDOM_TIN) {
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
        variety = tin_variety(tin);
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
export function tin_variety(tin, display = false) {
    const species = tinSpecies(tin);
    let variety = tin.spe === 1 ? SPINACH_TIN : tin.cursed ? ROTTEN_TIN
        : tin.spe < 0 ? -tin.spe - 1 : rn2(preparations.length - 1);
    if (!display && variety === HOMEMADE_TIN && !tin.blessed && rn2(7) === 0)
        variety = ROTTEN_TIN;
    if (variety === ROTTEN_TIN && species >= 0 && nonrottingCorpse(species))
        variety = HOMEMADE_TIN;
    return variety;
}
// C eat.c tintxts[] access with a checked preparation index.
function tinPreparation(variety) {
    const preparation = preparations[variety];
    if (!preparation)
        throw new RangeError(`Invalid tin preparation ${variety}`);
    return preparation;
}
// C eat.c:use_up_tin().
export async function use_up_tin(tin, { state = game } = {}) {
    requirePlayingGame(state);
    await consumeFoodObject(tin, { state });
    if (state.context.tin) {
        state.context.tin.tin = null;
        state.context.tin.o_id = 0;
    }
}
// C eat.c:consume_tin().
async function consume_tin(message, { state }) {
    // Metal has already been swallowed when corpse effects change the form.
    const alwaysEat = metallivorous(heroSpecies(state));
    let tin = currentTin(state);
    const variety = tin_variety(tin);
    if (tin.otrapped || tin.cursed && variety !== HOMEMADE_TIN && rn2(8) === 0) {
        if (await triggerBoobyTrap('tin', { state }))
            return;
        tin = await costly_tin('destroy', state);
        await use_up_tin(tin, { state });
        return;
    }
    await plineWithContinuation(message);
    if (variety !== SPINACH_TIN) {
        const species = tinSpecies(tin);
        if (species === -1) {
            await plineWithContinuation(heroIsHallucinating(state)
                ? `It's full of ${rn2(2) ? 'air elemental souffle' : 'dehydrated water'}.`
                : 'It turns out to be empty.');
            observeObject(tin, state);
            tin.known = true;
            tin = await costly_tin('open', state);
            await use_up_tin(tin, { state });
            if (alwaysEat)
                await lesshungry(5, { state });
            return;
        }
        let smell;
        if (['cockatrice', 'chickatrice'].includes(requireMonsterData(MONSTER_NAME, species))
            && (propertyIsActive('stoneResistance', state) || heroIsHallucinating(state)))
            smell = 'chicken';
        else if (heroIsHallucinating(state))
            smell = makePlural(randomDisplayMonsterName());
        else if (species === PM_WIZARD || requireMonsterData(MONSTER_GENO, species) & G_UNIQ
            && !monsterHasProperName(species)
            && species !== PM_HIGH_CLERIC && species !== PM_LONG_WORM_TAIL)
            smell = `the ${requireMonsterData(MONSTER_NAME, species)}`;
        else
            smell = monsterHasProperName(species) ? requireMonsterData(MONSTER_NAME, species) : makePlural(requireMonsterData(MONSTER_NAME, species));
        if (!alwaysEat) {
            await plineWithContinuation(`It smells like ${smell}.`);
            if (await promptYesNo('Eat it?') === 'n') {
                if (state.flags.verbose !== false)
                    await plineWithContinuation('You discard the open tin.');
                if (!heroIsHallucinating(state)) {
                    observeObject(tin, state);
                    tin.known = true;
                }
                tin = await costly_tin('open', state);
                await use_up_tin(tin, { state });
                return;
            }
        }
        state.context.victual = null;
        const preparation = tinPreparation(variety);
        await plineWithContinuation(`You consume ${preparation.name} ${requireMonsterData(MONSTER_NAME, species)}.`);
        await eating_conducts(species, { state });
        observeObject(tin, state);
        tin.known = true;
        tin = await costly_tin('open', state);
        const pre = await cprefx(species, { state, tin });
        if (pre.heroDied || state.program_state.gameover || !state.context.tin?.tin)
            return;
        const post = await cpostfx(species, { state, tin });
        if (post.heroDied || state.program_state.gameover || !state.context.tin?.tin)
            return;
        if (preparation.nutrition < 0)
            await makeHeroVomiting(rn1(15, 10), { state });
        else {
            const nutrition = (variety === HOMEMADE_TIN
                ? Math.min(preparation.nutrition, requireMonsterData(MONSTER_BODY_META, species)[1])
                : preparation.nutrition) + (alwaysEat ? 5 : 0);
            await use_up_tin(tin, { state });
            await lesshungry(nutrition, { state });
            if (state.program_state.gameover)
                return;
            tin = null;
        }
        if (preparation.greasy) {
            const old = state.u.glibTurns || 0;
            setSlipperyHands(old + rn1(11, 5), state);
            const fingers = state.uarmg ? armorSimpleName(state.uarmg, state) : makePlural(body_part(FINGER, state));
            await plineWithContinuation(`Eating ${preparation.name} food made your ${fingers} ${old ? 'even more' : 'very'} slippery.`);
        }
    }
    else {
        await plineWithContinuation(tin.cursed
            ? `It contains some decaying${heroIsBlind(state) ? '' : ` ${displayColorName('green', state)}`} substance.`
            : 'It contains spinach.');
        if (!tin.cursed) {
            observeObject(tin, state);
            tin.known = true;
        }
        if (!alwaysEat && await promptYesNo('Eat it?') === 'n') {
            if (state.flags.verbose !== false)
                await plineWithContinuation('You discard the open tin.');
            tin = await costly_tin('open', state);
            await use_up_tin(tin, { state });
            return;
        }
        incrementFood('ate for the first time (spinach)', state);
        if (!tin.cursed) {
            const fixed = state.u.fixedAbilities || propertyIsActive('sustainAbility', state);
            const character = heroIsHallucinating(state) ? "Swee'pea"
                : !fixed ? 'Popeye' : state.flags.female ? 'Olive Oyl' : 'Bluto';
            await plineWithContinuation(`This makes you feel like ${character}!`);
        }
        await gainHeroStrength(tin, 0, { state, giveMessage: false });
        tin = await costly_tin('open', state);
        const nutrition = (tin.blessed ? 600 : tin.cursed ? 200 + rnd(400) : 400 + rnd(200))
            + (alwaysEat ? 5 : 0);
        await use_up_tin(tin, { state });
        await lesshungry(nutrition, { state });
        tin = null;
    }
    if (tin)
        await use_up_tin(tin, { state });
}
// Port boundary: require the tin retained by context.tin.
function currentTin(state) {
    const tin = currentTinOpening(state).tin;
    if (!tin)
        throw new Error('The tin being opened has already been consumed');
    return tin;
}
// Port boundary: require corpsenm before reading tin contents.
function tinSpecies(tin) {
    if (tin.corpsenm === undefined)
        throw new Error(`Tin ${tin.o_id} has no contents species`);
    return tin.corpsenm;
}
// C eat.c:opentin().
export async function opentin(opening, state = game) {
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
        await consume_tin('You succeed in opening the tin.', { state });
        state._occupation = null;
    }
    state.context.move = state.program_state.gameover ? 0 : 1;
    return true;
}
// Port boundary: require the shared context.tin opening state.
function currentTinOpening(state) {
    const opening = state.context.tin;
    if (!opening)
        throw new Error('No tin is being opened');
    return opening;
}
// C eat.c:start_tin().
export async function start_tin(tin, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const weapon = state.uwep;
    let duration;
    let message;
    if (metallivorous(heroSpecies(state))) {
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
            await plineWithContinuation(`The tin slips from your ${makePlural(body_part(FINGER, state))}.`);
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
        await consume_tin(message, { state });
    }
    else
        state._occupation = opening;
    state.context.move = state.program_state.gameover ? 0 : 1;
    return { started: true, completed: duration === 0, heroDied: !!state.program_state.gameover };
}
// Shared splitobj(tin, 1) expression in costly_tin() and start_tin().
function splitTin(tin, state) {
    const split = splitObjectStack(tin, 1, state);
    if (!split)
        throw new Error(`Tin stack ${tin.o_id} could not be split`);
    return split;
}
// C eat.c:Hear_again(). allmain calls this after the awaited
// recovery message, so neither hearing nor hunger changes before acknowledgment.
export async function Hear_again({ state = game } = {}) {
    if (rn2(2) === 0) {
        await makeDeaf(0, { state, talk: false });
        state.context.botl = true;
    }
}
// C eat.c:rottenfood().
// The caller halves remaining nutrition and decides whether a meal can start.
export async function rottenfood(food, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    await pline(`Blecch!  ${objectIsRottable(food, state) ? 'Rotten' : 'Awful'} ${foodword(food, state)}!`);
    if (!rn2(4)) {
        await pline(formatFeltMessage(`rather ${heroIsHallucinating(state) ? 'trippy' : body_part(LIGHT_HEADED, state)}.`, state));
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
// Port boundary: require corpsenm before indexing monster data.
function corpseSpecies(food) {
    if (food.corpsenm === undefined)
        throw new Error(`Corpse ${food.o_id} has no species`);
    return food.corpsenm;
}
// C eat.c:eatcorpse().
// The caller has installed context.victual and keeps its food identity.
export async function eatcorpse(food, { state = game } = {}) {
    requirePlayingGame(state);
    const meal = state.context.victual;
    if (!meal || meal.key !== 'eat-food')
        throw new Error('Corpse preparation requires an active food meal');
    const species = corpseSpecies(food), glob = !!food.globby;
    const name = withIndefiniteArticle(food_xname(food, { state }));
    let logged = false;
    if (!veganCorpse(species) && incrementConduct('unvegan', state)) {
        recordGameLogEvent(`consumed animal products for the first time, by eating ${name}`, { state, flags: LL_CONDUCT });
        logged = true;
    }
    if (!vegetarianCorpse(species)) {
        if (!state.u.uconduct.unvegetarian && !logged)
            recordGameLogEvent(`tasted meat for the first time, by eating ${name}`, { state, flags: LL_CONDUCT });
        await violated_vegetarian(state);
    }
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
        const cannibal = await maybe_cannibal(species, { state, announce: false });
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
        return 2;
    }
    let tastedHazard = false;
    if (acidic(species) && !propertyIsActive('acidResistance', state)) {
        tastedHazard = true;
        await pline('You have a very bad case of stomach acid.');
        await loseHeroHp(rnd(15), glob ? 'acidic glob' : 'acidic corpse', { state });
    }
    else if (poisonous(species) && rn2(5)) {
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
        return null;
    meal.reqtime = 3 + ((glob ? food.owt : requireMonsterData(MONSTER_BODY_META, species)[0]) >> 6);
    if (!tastedHazard && !nonrottingCorpse(species) && (food.orotten || !rn2(7))) {
        const passedOut = await rottenfood(food, { state });
        if (passedOut) {
            food.orotten = true;
            if (!await touchfood(food, { state }))
                return 1;
        }
        if (!requireMonsterData(MONSTER_BODY_META, species)[1]) {
            if (!passedOut)
                await pline('The corpse rots away completely.');
            await consumeFoodObject(food, { state });
            return 2;
        }
        if (passedOut)
            return 1;
        await consume_oeaten(food, 2, { state });
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
        const carnivore = carnivorous(heroSpecies(state)), herbivore = herbivorous(heroSpecies(state));
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
        const prefix = monsterHasProperName(species) ? ''
            : requireMonsterData(MONSTER_GENO, species) & G_UNIQ ? 'The ' : 'This ';
        const name = food_xname(food, { state }).replace(/^the /i, '');
        await pline(`${prefix}${name} ${verb} ${description}${yummy || !palatable ? '!' : '.'}`);
    }
    return 0;
}
// C eat.c:start_eating().
async function start_eating(food, partlyEaten, state) {
    const meal = currentFoodMeal(state);
    meal.fullwarn = meal.doreset = false;
    meal.eating = true;
    if (food.otyp === CORPSE || food.globby) {
        const effect = await cprefx(corpseSpecies(food), { state, food });
        if (effect.stopped || !state.context.victual?.piece || !meal.eating)
            return;
    }
    // C eat.c:2048/2056/2059: `old_nomovemsg = gn.nomovemsg` and the two
    // `if (!old_nomovemsg)` tests examine the pointer, so an empty-but-set
    // nomovemsg (e.g. hurtle()'s "") counts as set: done_eating(FALSE)
    // consumes it instead of being suppressed and restored around it.
    const oldMessage = state._helplessDoneMessage ?? null;
    if (await bite(state)) {
        if (state.program_state.gameover)
            return;
        if (++meal.usedtime >= meal.reqtime) {
            const chokingMessage = state._helplessDoneMessage;
            if (oldMessage === null)
                state._helplessDoneMessage = null;
            await done_eating(state, false);
            if (oldMessage === null) {
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
        await done_eating(state, meal.reqtime > 1 || partlyEaten);
        return;
    }
    meal.text = `eating ${food_xname(food, { state, definite: true })}`;
    state._occupation = { key: 'eat-food', text: meal.text };
}
// C eat.c:eating_glob(). True while this glob is the meal in progress.
export function eating_glob(glob, state) {
    return state._occupation?.key === 'eat-food'
        && state.context.victual?.piece === glob;
}
// C eat.c:garlic_breath().
async function garlic_breath(state) {
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
export async function fprefx(food, { state = game } = {}) {
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
            await explode(state.u.ux, state.u.uy, -11, d(3, 6), RANDOM_CLASS, EXPL_FIERY, { state });
            return false;
        }
        if (eggIsStale(food, state)) {
            await pline('Ugh.  Rotten egg.');
            await makeHeroVomiting(Math.min(TIMEOUT, (state.u.vomitingTurns || 0) + d(10, 4)), { state });
            return !state.program_state.gameover;
        }
    }
    else if (type === FOOD_RATION) {
        if (state.u.uhunger <= 200)
            await pline(heroIsHallucinating(state)
                ? 'Oh wow, like, superior, man!' : 'This food really hits the spot!');
        else if (state.u.uhunger < 700)
            await pline(`This satiates your ${body_part(STOMACH, state)}!`);
        return !state.program_state.gameover;
    }
    else if (type === TRIPE_RATION) {
        if (carnivorous(species) && !monsterIsHumanoid(species)) {
            await pline('This tripe ration is surprisingly good!');
        }
        else if ((heroIsPolymorphed(state)
            ? is_orc(heroSpecies(state)) : state.urace.name === 'orc')) {
            await pline(heroIsHallucinating(state) ? 'Tastes great!  Less filling!' : 'Mmm, tripe... not bad!');
        }
        else {
            await pline('Yak - dog food!');
            addExperience(1, 0, state);
            await checkExperienceLevel();
            if (rn2(2) && state.urole.key !== 'caveman' && state.urace.name !== 'orc')
                await makeHeroVomiting(rn1(currentFoodMeal(state).reqtime, 14), { state });
        }
        return !state.program_state.gameover;
    }
    else if (type === LEMBAS_WAFER) {
        if ((heroIsPolymorphed(state)
            ? is_orc(heroSpecies(state)) : state.urace.name === 'orc')) {
            await pline('!#?&* elf kibble!');
            return !state.program_state.gameover;
        }
        if ((heroIsPolymorphed(state)
            ? is_elf(heroSpecies(state)) : state.urace.name === 'elf')) {
            await pline('A little goes a long way.');
            return !state.program_state.gameover;
        }
    }
    else if (type === CLOVE_OF_GARLIC) {
        if (monsterIsUndead(species)) {
            await makeHeroVomiting(rn1(currentFoodMeal(state).reqtime, 5), { state });
            return !state.program_state.gameover;
        }
        await garlic_breath(state);
        if (state.program_state.gameover)
            return false;
    }
    const name = food_xname(food, { state });
    const hallucinating = heroIsHallucinating(state);
    if (food.otyp === SLIME_MOLD && !food.cursed && food.spe === state.context.current_fruit) {
        await pline(`My, this is a ${hallucinating ? 'primo' : 'yummy'} ${name}!`);
    }
    else if (food.otyp === APPLE && food.cursed && !heroResistsSleep(state)) {
        return !state.program_state.gameover;
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
    return !state.program_state.gameover;
}
// C eat.c:bounded_increase().
function bounded_increase(old, amount, objectType, state) {
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
function accessory_has_effect(object) {
    return pline(`Magic spreads through your body as you digest the ${object.oclass === RING_CLASS ? 'ring' : 'amulet'}.`);
}
// C eat.c:eataccessory().
export async function eataccessory(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const property = objectPropertyName(object.otyp);
    const oldIntrinsic = property && (hasIntrinsicProperty(property, null, state)
        || hasTimedProperty(property, state));
    if (object === state.uleft || object === state.uright) {
        await removeHeroAccessory(object, state);
        if (state.program_state.gameover || state.u.uhp <= 0)
            return;
    }
    observeObject(object, state);
    object.known = true;
    if (rn2(object.oclass === RING_CLASS ? 3 : 5))
        return;
    if (NO_DIGESTED_EFFECT.has(object.otyp))
        return;
    if ([ADORNMENT, STRENGTH, CONSTITUTION].includes(object.otyp)) {
        await accessory_has_effect(object);
        const attribute = object.otyp === ADORNMENT ? A_CHA : object.otyp === STRENGTH ? A_STR : A_CON;
        const change = adjustAttribute(attribute, object.spe, state);
        if (change.changed) {
            const message = attributeChangeMessage(attribute, change, state);
            if (message)
                await pline(message);
            if (state._moveloopStarted && [A_STR, A_CON].includes(attribute))
                await encumber_msg(state);
            learnObjectType(object.otyp, state);
        }
    }
    else if ([ACCURACY, DAMAGE].includes(object.otyp)) {
        await accessory_has_effect(object);
        const field = object.otyp === ACCURACY ? 'uhitinc' : 'udaminc';
        state.u[field] = bounded_increase(state.u[field] || 0, object.spe, object.otyp, state);
    }
    else if (object.otyp === PROTECTION || object.otyp === GUARDING) {
        await accessory_has_effect(object);
        grantIntrinsicProperty('protection', 'outside', state);
        state.u.ublessed = bounded_increase(state.u.ublessed || 0, object.otyp === PROTECTION ? object.spe : 2, object.otyp, state);
        // Native eataccessory() leaves find_ac() to the next input boundary,
        // after monsters have used the armor class from before this meal.
        state._armorClassDirty = true;
        state.context.botl = true;
    }
    else if (object.otyp === FREE_ACTION) {
        if (!hasIntrinsicProperty('sleepResistance', 'outside', state))
            await accessory_has_effect(object);
        if (!state.u.sleepResistance)
            await pline(formatFeltMessage('wide awake.', state));
        grantIntrinsicProperty('sleepResistance', 'outside', state);
    }
    else if (object.otyp === CHANGE) {
        await accessory_has_effect(object);
        learnObjectType(object.otyp, state);
        changeHeroSex(state);
        await pline(`You are suddenly very ${state.flags.female ? 'feminine' : 'masculine'}!`);
        state.context.botl = true;
    }
    else if (object.otyp === UNCHANGING) {
        if (!state.u.unchanging && heroIsPolymorphed(state)) {
            await accessory_has_effect(object);
            learnObjectType(object.otyp, state);
            await returnHeroToHumanForm(state);
        }
    }
    else if (object.otyp === STRANGULATION) {
        await choke(object, { state });
    }
    else if (object.otyp === SLEEP) {
        const delay = rnd(100);
        const oldDelay = propertyTimeout('sleepy', state);
        if (!hasIntrinsicProperty('sleepy', 'outside', state))
            await accessory_has_effect(object);
        grantIntrinsicProperty('sleepy', 'outside', state);
        if (!oldDelay || delay < oldDelay)
            setPropertyTimeout('sleepy', delay, state);
    }
    else if (property) {
        if (!hasIntrinsicProperty(property, 'outside', state))
            await accessory_has_effect(object);
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
            const innateSight = monsterPerceives(state.u.umonnum);
            if (heroIsInvisible(state) && !oldIntrinsic && !(hasWornProperty(property, state) || hasInvokedProperty(property, state)
                || hasCarriedProperty(property, null, state))
                && !innateSight && !heroIsBlind(state)) {
                await newsym(state.u.ux, state.u.uy);
                await pline('Suddenly you can see yourself.');
                learnObjectType(object.otyp, state);
            }
        }
        else if (object.otyp === INVISIBILITY) {
            syncHeroInvisibility(state);
            if (!oldIntrinsic && !(hasWornProperty(property, state) || hasInvokedProperty(property, state)
                || hasCarriedProperty(property, null, state)) && !invisibilityIsBlocked(state)
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
// C eat.c:eatspecial().
async function eatspecial(object, meal, state) {
    // C lesshungry() wants an occupation to handle choke messages correctly.
    setOccupation({ key: 'eat-food', text: 'eating non-food' }, state);
    await lesshungry(meal.nmod, { state });
    state._occupation = null;
    state.context.victual = null;
    if (state.program_state.gameover)
        return;
    if (object.oclass === COIN_CLASS) {
        await consumeFoodObject(object, { all: true, state });
        await vaultGdWatching(GD_EATGOLD, state);
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
        await eataccessory(object, { state });
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
    // C eatspecial() unwields one-by-one only while a single item is left.
    if (object === (state.uwep || state.u?.uwep) && objectQuantity(object) === 1)
        await uwepgone(state);
    if (object === (state.uquiver || state.u?.uquiver) && objectQuantity(object) === 1)
        await uqwepgone(state);
    if (object === (state.uswapwep || state.u?.uswapwep) && objectQuantity(object) === 1)
        await uswapwepgone(state);
    const chain = object === state.uchain;
    if (object === state.uball || chain)
        await unpunishHero(state);
    if (!chain)
        await consumeFoodObject(object, { state });
}
// C eat.c:foodword().
export function foodword(food, state = game) {
    if (food.oclass === FOOD_CLASS)
        return 'food';
    const material = objectMaterial(food, state);
    if (food.oclass === GEM_CLASS && material === 19 && food.dknown)
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
export async function fpostfx(food, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    switch (food.otyp) {
        case SPRIG_OF_WOLFSBANE:
            await purifyHeroLycanthropy({ state });
            break;
        case CARROT: {
            let blinds = false;
            if (state.u.uswallow) {
                const swallower = state.u.ustuck;
                if (!swallower)
                    throw new Error('An engulfed hero must have a swallowing monster.');
                blinds = requireMonsterData(MONSTER_ATTACKS, swallower.mnum).some(([method, damage]) => method === AT_ENGL && damage === AD_BLND);
            }
            if (!blinds)
                await makeBlinded(state.u.ucreamed || 0, { state });
            break;
        }
        case FORTUNE_COOKIE:
            await readCookieFortune(food, { state });
            if (!heroIsBlind(state))
                recordLiteracy('became literate by reading the fortune inside a cookie', { state });
            break;
        case LUMP_OF_ROYAL_JELLY: {
            const hero = state.u;
            if (heroIsPolymorphed(state) && hero.umonnum === PM_KILLER_BEE
                && !heroIsUnchanging(state)) {
                const transformation = await polymonHero(PM_QUEEN_BEE);
                if (transformation.transformed)
                    break;
            }
            await gainHeroStrength(food, 1, { state });
            const hitPointChange = rnd(20) * (food.cursed ? -1 : 1);
            state.context.botl = true;
            if (heroIsPolymorphed(state)) {
                hero.mh += hitPointChange;
                if (hero.mh > hero.mhmax) {
                    if (rn2(17) === 0)
                        hero.mhmax++;
                    hero.mh = hero.mhmax;
                }
                else if (hero.mh <= 0) {
                    const restored = await returnHeroToHumanForm(state, { publish: plineWithContinuation, die: finishHeroDeath });
                    if (restored.died)
                        return;
                }
            }
            else {
                hero.uhp += hitPointChange;
                if (hero.uhp > hero.uhpmax) {
                    if (rn2(17) === 0) {
                        hero.uhpmax++;
                        hero.uhppeak = Math.max(hero.uhppeak, hero.uhpmax);
                    }
                    hero.uhp = hero.uhpmax;
                }
                else if (hero.uhp <= 0) {
                    await finishHeroDeath({
                        killer: 'rotten lump of royal jelly',
                        deathType: POISONING,
                    });
                    return;
                }
            }
            if (!food.cursed) {
                await healHeroLegs(state, { publish: plineWithContinuation });
            }
            break;
        }
        case EGG:
            await eatPetrifyingEgg(food);
            break;
        case EUCALYPTUS_LEAF:
            if (!food.cursed) {
                await cureHeroSicknessWithMessages(state);
                await makeHeroVomiting(0, { state, talk: true, publish: pline });
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
}
// C youprop.h:Sleep_resistance expression used by fprefx() and fpostfx().
function heroResistsSleep(state) {
    return !!state.u.sleepResistance || propertyIsActive('sleepResistance', state);
}
// C eat.c:edibility_prompts().
export async function edibility_prompts(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if ('kind' in object || !state.u.uedibility)
        return true;
    let warning = null;
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
    if (corpse && species !== undefined)
        requireMonsterData(MONSTER_FLAGS1, species);
    if (corpse && rotted > 5 && !hero.sicknessResistance)
        warning = `${smell} like ${pronoun} could be tainted!`;
    else if (stoneOrSlime)
        warning = `${smell} like ${pronoun} could be something very dangerous!`;
    else if (corpse && rotted > 5)
        warning = `${smell} like ${pronoun} could be tainted.`;
    else if (object.orotten || corpse && rotted > 3)
        warning = `${smell} like ${pronoun} could be rotten!`;
    else if (corpse && (poisonous(species ?? -1)) && !hero.poisonResistance)
        warning = `${smell} like ${pronoun} might be poisonous!`;
    else if (object.otyp === APPLE && object.cursed && !hero.sleepResistance)
        warning = `${smell} like ${pronoun} might have been poisoned.`;
    else if (corpse && !vegetarianCorpse(species)
        && !conduct.unvegetarian && state.urole.key === 'monk')
        warning = `${smell} unhealthy.`;
    else if (corpse && (acidic(species ?? -1)) && !hero.acidResistance)
        warning = `${smell} rather acidic.`;
    else if (heroIsPolymorphed(state) && hero.umonnum === RUST_MONSTER
        && objectIsMetallic(object, state) && object.oerodeproof)
        warning = `${smell} disgusting to you right now.`;
    else if (!conduct.unvegan && ([LEATHER, BONE, DRAGON_HIDE, WAX].includes(material)
        || corpse && !veganCorpse(species)))
        warning = `${smell} foul and unfamiliar to you.`;
    else if (!conduct.unvegetarian && ([LEATHER, BONE, DRAGON_HIDE].includes(material)
        || corpse && !vegetarianCorpse(species)))
        warning = `${smell} unfamiliar to you.`;
    if (!warning)
        return true;
    const quantity = objectQuantity(object);
    const answer = await promptYesNo(`${warning}  Eat ${quantity === 1 ? 'it' : 'one'} anyway?`);
    await immediatePline(`Your ${body_part(NOSE, state)} stops tingling and your sense of smell returns to normal.`);
    state.u.uedibility = 0;
    return answer === 'y';
}
// C eat.c:doeat_nonfood().
export async function doeat_nonfood(object, state) {
    const material = objectMaterial(object, state);
    const nutrition = object.otyp === SCR_MAIL ? 0 : object.oclass === COIN_CLASS
        ? Math.min(2000, Math.trunc(objectQuantity(object) / 100))
        : [BALL_CLASS, CHAIN_CLASS].includes(object.oclass) ? objectWeight(object)
            : oc_nutrition(object.otyp);
    const meal = { piece: object, o_id: object.o_id, reqtime: 1,
        usedtime: 0, nmod: nutrition, canchoke: currentHungerState(state) === SATIATED, eating: true };
    state.context.victual = meal;
    const name = food_xname(object, { state });
    let logged = incrementFood(`ate for the first time (${name})`, state);
    if ([LEATHER, BONE, DRAGON_HIDE, WAX].includes(material)) {
        if (incrementConduct('unvegan', state) && !logged) {
            recordGameLogEvent(`consumed animal products for the first time, by eating ${withIndefiniteArticle(name)}`, { state, flags: LL_CONDUCT });
            logged = true;
        }
        if (material !== WAX) {
            if (!state.u.uconduct.unvegetarian && !logged)
                recordGameLogEvent(`tasted meat by-products for the first time, by eating ${withIndefiniteArticle(name)}`, { state, flags: LL_CONDUCT });
            await violated_vegetarian(state);
        }
    }
    let noDelicious = object.otyp === SCR_MAIL || material === PAPER;
    if (object.cursed) {
        await rottenfood(object, { state });
        noDelicious = true;
    }
    if (object.oclass === WEAPON_CLASS && object.opoisoned) {
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
    await eatspecial(object, meal, state);
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
    if (exceedsActionCapacity(state)) {
        await pline("You can't do that while carrying so much stuff.");
        state.context.move = 0;
        return;
    }
    if (!await edibility_prompts(selection, { state })) {
        state.context.move = 0;
        return;
    }
    if ('kind' in selection) {
        await chewIronBars({ state });
        state.context.move = state.program_state.gameover ? 0 : 1;
        return;
    }
    if (!isEdibleFood(selection, state)) {
        await pline('You cannot eat that!');
        state.context.move = 0;
        return;
    }
    if ((selection.owornmask ?? 0) & (W_ARMOR | W_TOOL | W_AMUL | W_SADDLE)) {
        await pline("You can't eat something you're wearing.");
        state.context.move = 0;
        return;
    }
    if (selection.where === 'inventory') {
        const touch = await retouchHeroObject(selection, { state });
        if (touch.died || touch.rejected) {
            state.context.move = state.program_state.gameover ? 0 : 1;
            return;
        }
    }
    else {
        const touch = await touchArtifactByHero(selection, artifactById(selection.oartifact, state), { state });
        if (touch.died || touch.allowed === false) {
            state.context.move = state.program_state.gameover ? 0 : 1;
            return;
        }
    }
    if (objectIsMetallic(selection, state)
        && state.u.umonnum === RUST_MONSTER && selection.oerodeproof) {
        let food = selection;
        food.rknown = true;
        if (objectQuantity(food) > 1) {
            const carried = food.where === 'inventory';
            const split = splitObjectStack(food, carried ? 1 : objectQuantity(food) - 1, state);
            if (!split)
                throw new Error(`Edible stack ${food.o_id} could not be split`);
            if (carried)
                food = split;
        }
        await pline(`Ulch - that ${objectName(food, state)} was rustproofed!`);
        food.oerodeproof = false;
        await makeStunned((state.u.stunnedTurns || 0) + rn2(10), { state });
        if (isWeldedPrimary(food, state) || food.cursed && ((food.owornmask ?? 0) & W_RING)) {
            food.bknown = true;
            await pline(`You spit out the ${objectName(food, state)}.`);
            state.context.move = state.program_state.gameover ? 0 : 1;
            return;
        }
        await pline(`You spit the ${objectName(food, state)} out onto the ${surfaceName(state.u.ux, state.u.uy, state)}.`);
        if (food.where === 'inventory') {
            if (food.owornmask)
                await removeWornHeroItem(food, state);
            if (state.program_state.gameover) {
                state.context.move = 0;
                return;
            }
            await freeInventoryObject(food, state);
            if (state.program_state.gameover) {
                state.context.move = 0;
                return;
            }
            await dropObjectAtHero(food, { state });
        }
        if (food.where === 'floor')
            await stack_object(food, state);
        state.context.move = state.program_state.gameover ? 0 : 1;
        return;
    }
    if (selection.otyp === RIN_SLOW_DIGESTION) {
        await pline('This ring is indigestible!');
        await rottenfood(selection, { state });
        if (selection.dknown)
            await tryCallObjectType(selection, state);
        state.context.move = state.program_state.gameover ? 0 : 1;
        return;
    }
    if (selection.oclass !== FOOD_CLASS) {
        await doeat_nonfood(selection, state);
        state.context.move = state.program_state.gameover ? 0 : 1;
        return;
    }
    let food = selection;
    if (food === state.context.victual?.piece) {
        const meal = currentFoodMeal(state);
        const lastBite = meal.usedtime + 1 >= meal.reqtime;
        if (currentHungerState(state) !== SATIATED)
            meal.canchoke = false;
        meal.o_id = 0;
        const resumedFood = await touchfood(food, { state });
        if (resumedFood) {
            meal.piece = resumedFood;
            meal.o_id = resumedFood.o_id;
        }
        else
            await do_reset_eat(state);
        if (state.program_state.gameover)
            return;
        await pline(`You ${lastBite ? 'consume the last bite of' : 'resume'} your meal.`);
        if (resumedFood)
            await start_eating(resumedFood, false, state);
        if (!state.program_state.gameover)
            state.context.move = 1;
        return;
    }
    if (food.otyp === TIN) {
        await start_tin(food, { state });
        if (!state.program_state.gameover)
            state.context.move = 1;
        return;
    }
    const firstFoodLogged = incrementFood(`ate for the first time - ${food_xname(food, { state })}`, state);
    const partlyEaten = !!food.oeaten;
    const preparedFood = await touchfood(food, { state });
    if (!preparedFood) {
        await do_reset_eat(state);
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
        const result = await eatcorpse(food, { state });
        if (result === null)
            return;
        if (result === 2) {
            state.context.victual = null;
            state.context.move = 1;
            return;
        }
        dontStart = result === 1;
    }
    else {
        let logged = firstFoodLogged;
        const name = food_xname(food, { state });
        if (objectMaterial(food, state) === FLESH) {
            if (incrementConduct('unvegan', state) && !logged) {
                recordGameLogEvent(`consumed animal products for the first time, by eating ${withIndefiniteArticle(name)}`, { state, flags: LL_CONDUCT });
                logged = true;
            }
            if (food.otyp !== EGG) {
                if (!state.u.uconduct.unvegetarian && !logged)
                    recordGameLogEvent(`tasted meat for the first time, by eating ${withIndefiniteArticle(name)}`, { state, flags: LL_CONDUCT });
                await violated_vegetarian(state);
            }
        }
        else if (ANIMAL_INGREDIENTS.has(food.otyp)) {
            if (incrementConduct('unvegan', state) && !logged)
                recordGameLogEvent(`consumed animal products (${name}) for the first time`, { state, flags: LL_CONDUCT });
        }
        meal.reqtime = objectDelay(food.otyp);
        if (food.otyp !== FORTUNE_COOKIE && (food.cursed
            || ![LEMBAS_WAFER, CRAM_RATION].includes(food.otyp)
                && state.moves - food.age > (food.blessed ? 50 : 30)
                && (food.orotten || !rn2(7)))) {
            dontStart = await rottenfood(food, { state });
            if (dontStart)
                food.orotten = true;
            await consume_oeaten(food, 1, { state });
        }
        else if (!partlyEaten) {
            const continueMeal = await fprefx(food, { state });
            if (state.program_state.gameover)
                return;
            if (!continueMeal) {
                await do_reset_eat(state);
                state.context.move = 1;
                return;
            }
        }
        else {
            await pline(`You ${meal.reqtime === 1 ? 'eat' : 'begin eating'} ${await inventoryItemDescription(food)}.`);
        }
    }
    const nutrition = obj_nutrition(food);
    if (nutrition) {
        const remainingTime = meal.reqtime * preparedFood.oeaten;
        const quotient = Math.trunc(remainingTime / nutrition);
        meal.reqtime = quotient + Number(2 * (remainingTime % nutrition) >= nutrition);
    }
    else
        meal.reqtime = 0;
    meal.nmod = !meal.reqtime || !preparedFood.oeaten ? 0
        : preparedFood.oeaten >= meal.reqtime ? -Math.trunc(preparedFood.oeaten / meal.reqtime)
            : meal.reqtime % preparedFood.oeaten;
    meal.canchoke = currentHungerState(state) === SATIATED;
    if (dontStart)
        food.owt = objectWeight(food);
    else
        await start_eating(preparedFood, partlyEaten, state);
    if (!state.program_state.gameover)
        state.context.move = 1;
}
// C eat.c:use_tin_opener().
// Also C eat.c:tinopen_ok(): inlined as the "open" chooser callback (tins
// suggested, everything else excluded).
export async function use_tin_opener(tool, { state = game, swapWeapons } = {}) {
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
    const result = await start_tin(tin, { state });
    return { usedTime: true, cancelled: false, heroDied: result.heroDied };
}
// C eat.c:bite().
async function bite(state) {
    const meal = currentFoodMeal(state);
    if (meal.canchoke && state.u.uhunger >= 2000) {
        await choke(meal.piece, { state });
        return true;
    }
    if (meal.doreset) {
        await do_reset_eat(state);
        return false;
    }
    state.context.forceSaveHungerState = true;
    try {
        if (meal.nmod < 0) {
            await lesshungry(adj_victual_nutrition(meal, state), { state });
            if (state.program_state.gameover)
                return true;
            await consume_oeaten(currentMealFood(meal), meal.nmod, { state });
        }
        else if (meal.nmod > 0 && meal.usedtime % meal.nmod) {
            await lesshungry(1, { state });
            if (state.program_state.gameover)
                return true;
            await consume_oeaten(currentMealFood(meal), -1, { state });
        }
    }
    finally {
        delete state.context.forceSaveHungerState;
    }
    const food = currentMealFood(meal);
    recalc_wt(food);
    return false;
}
// C eat.c:gethungry().
export async function gethungry({ invulnerable = false } = {}) {
    const state = requireInitializedGame();
    const u = state.u;
    if (invulnerable || u.invulnerable || game.iflags?.debug_hunger)
        return null;
    if (!Number.isInteger(u.uhunger))
        u.uhunger = 900;
    u.uhs ??= currentHungerState(game);
    // C checks awareness before diet or slow digestion: an unaware hero
    // spends this random draw even in a body which does not eat.
    const currentFormEats = (metallivorous(heroSpecies(game)) || carnivorous(heroSpecies(game)) || herbivorous(heroSpecies(game)));
    if ((!heroIsUnaware(game) || rn2(10) === 0)
        && currentFormEats && !u.slowDigestion)
        u.uhunger--;
    const accessoryTime = rn2(20);
    if (accessoryTime % 2) {
        const sources = u._propertySources?.regeneration;
        const regenerates = u.regenerationIntrinsic || (u.regenerationTurns ?? 0) > 0
            || Object.keys(sources?.intrinsic || {}).some(origin => origin !== 'form')
            || sources?.worn?.some(source => source.slot !== 'uwep')
            || !!sources?.carried?.length;
        if (regenerates)
            u.uhunger--;
        if (nearCapacity(game) > 1)
            u.uhunger--;
    }
    else {
        // Hunger and Conflict are independent C properties and can both charge.
        if (u.hunger)
            u.uhunger--;
        if (hasNonArtifactConflict(game))
            u.uhunger--;
        switch (accessoryTime) {
            case 0:
                if (u.slowDigestion
                    && game.uright?.otyp !== RIN_SLOW_DIGESTION
                    && game.uleft?.otyp !== RIN_SLOW_DIGESTION)
                    u.uhunger--;
                break;
            case 4: {
                const ring = game.uleft;
                if (ring && ring.otyp !== MEAT_RING) {
                    const sources = game.u._propertySources?.protection;
                    const others = (sources?.worn || []).filter(source => source.slot !== 'uleft');
                    const soleProtection = !sources?.invoked && !sources?.carried?.length
                        && (!others.length || others.length === 1 && others[0]?.slot === 'uright'
                            && game.uright?.otyp === RIN_PROTECTION && !(game.uright.spe || 0));
                    if ((ring.spe || 0) !== 0 || !objectCharged(ring.otyp)
                        || ring.otyp === RIN_PROTECTION && soleProtection)
                        u.uhunger--;
                }
                break;
            }
            case 8:
                if (game.uamul?.otyp !== undefined
                    && game.uamul.otyp !== FAKE_AMULET_OF_YENDOR)
                    u.uhunger--;
                break;
            case 12: {
                const ring = game.uright;
                if (ring && ring.otyp !== MEAT_RING) {
                    const sources = game.u._propertySources?.protection;
                    const others = (sources?.worn || []).filter(source => source.slot !== 'uright');
                    const soleProtection = !sources?.invoked && !sources?.carried?.length
                        && (!others.length);
                    if ((ring.spe || 0) !== 0 || !objectCharged(ring.otyp)
                        || ring.otyp === RIN_PROTECTION && soleProtection)
                        u.uhunger--;
                }
                break;
            }
            case 16:
                if (u.uhave?.amulet || u.haveAmulet
                    || game.inventory?.some(object => object.otyp === AMULET_OF_YENDOR))
                    u.uhunger--;
                break;
            default:
                break;
        }
    }
    await newuhs(true);
    return accessoryTime;
}
// C eat.c:morehungry(). A zero or negative amount still runs newuhs(TRUE).
export async function morehungry(amount, { state = game } = {}) {
    requirePlayingGame(state);
    state.u.uhs ??= currentHungerState(state);
    state.u.uhunger = (state.u.uhunger ?? 900) - amount;
    await newuhs(true, { state });
}
// C eat.c:lesshungry(). Fullness belongs to this common boundary, including
// nutrition received outside a meal.
// Also C eat.c:reset_eat(): inlined at the choke and paranoid-refusal
// points below as `victual.doreset = true`; the monster-nearby interruption
// path stops the occupation directly instead of setting the flag.
export async function lesshungry(amount, { state = game } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    hero.uhs ??= currentHungerState(state);
    hero.uhunger = (hero.uhunger ?? 900) + amount;
    const victual = state.context.victual;
    const eating = state._occupation?.key === 'eat-food'
        || state.context.forceSaveHungerState;
    if (hero.uhunger >= 2000) {
        if (!eating || victual?.canchoke) {
            await choke(eating ? victual?.piece
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
    await newuhs(false, { state });
}
// C eat.c:unfaint().
export async function unfaint({ state = game } = {}) {
    requirePlayingGame(state);
    await Hear_again({ state });
    if (state.u.uhs > FAINTING)
        state.u.uhs = FAINTING;
    await stopHeroOccupation(state);
    await bot();
}
// C eat.c:reset_faint() calls unmul("You revive.") only when unfaint
// owns the recovery. A different involuntary delay must remain in place.
export async function reset_faint({ state = game } = {}) {
    requirePlayingGame(state);
    if (state._afterMove?.kind !== 'unfaint')
        return false;
    await finishHeroHelplessness('You revive.', state);
    return true;
}
// Part of C eat.c:newuhs(): the nutrition thresholds, preserving FAINTED and STARVED.
// C eat.c newuhs() thresholds, shared without changing FAINTED or STARVED.
export function currentHungerState(state = game) {
    if (state.u.uhs === FAINTED || state.u.uhs === STARVED)
        return state.u.uhs;
    const nutrition = state.u.uhunger ?? 900;
    return nutrition > 1000 ? SATIATED : nutrition > 150 ? NOT_HUNGRY
        : nutrition > 50 ? HUNGRY : nutrition > 0 ? WEAK : FAINTING;
}
// C eat.c:newuhs().
export async function newuhs(increasing, { state = game } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    const nutrition = hero.uhunger ?? 900;
    let next = nutrition > 1000 ? SATIATED : nutrition > 150 ? NOT_HUNGRY
        : nutrition > 50 ? HUNGRY : nutrition > 0 ? WEAK : FAINTING;
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
                const duration = 10 - rounded;
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
                if (state.program_state.gameover)
                    return;
                next = FAINTED;
            }
        }
        else if (hero.uhunger < -(100 + 10 * currentAttribute(A_CON, state))) {
            hero.uhs = STARVED;
            await bot();
            await plineWithContinuation('You die from starvation.');
            const died = await finishHeroDeath({
                killer: 'starvation', deathCause: 'died of starvation', deathVerb: 'starved',
                deathType: STARVING, deathLineShown: true,
            });
            if (!died)
                await newuhs(false, { state });
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
        let message;
        if (heroIsHallucinating(state)) {
            message = next === HUNGRY
                ? increasing ? 'You are getting the munchies.' : 'You now have a lesser case of the munchies.'
                : increasing ? 'The munchies are interfering with your motor capabilities.' : 'You still have the munchies.';
        }
        else if (next === HUNGRY) {
            message = !increasing ? 'You only feel hungry now.'
                : hero.uhunger < 145 ? 'You feel hungry.' : 'You are beginning to feel hungry.';
        }
        else if (increasing && (['wizard', 'valkyrie'].includes(state.urole.key)
            || state.urace.name === 'elf')) {
            const name = ['wizard', 'valkyrie'].includes(state.urole.key) ? state.urole.name.m : 'Elf';
            message = `${name} needs food, badly!`;
        }
        else {
            message = !increasing ? 'You are still weak.'
                : hero.uhunger < 45 ? 'You feel weak.' : 'You are beginning to feel weak.';
        }
        await plineWithContinuation(message);
        if (increasing && state._occupation
            && !['eat-food', 'open-tin'].includes(state._occupation.key))
            await stopHeroOccupation(state);
        stopRun(state);
    }
    hero.uhs = next;
    state.context.botl = true;
    await bot();
    if ((Upolyd(hero) ? hero.mh : hero.uhp) < 1) {
        await plineWithContinuation('You die from hunger and exhaustion.');
        const died = await finishHeroDeath({
            killer: 'exhaustion', deathCause: 'died of exhaustion', deathVerb: 'starved',
            deathType: STARVING, deathLineShown: true,
        });
        if (!died)
            await newuhs(false, { state });
    }
}
// C eat.c:vomit().
export async function vomit({ state = game, publish = immediatePline, angerAltar = altarWrath, melt = meltIce, random = rn2, rollDice = d, } = {}) {
    const hero = state.u;
    const cannotVomit = heroCannotVomit(state);
    const hungerState = currentHungerState(state);
    hero.uhs = hungerState;
    if (cannotVomit) {
        await publish('Your jaw gapes convulsively.');
    }
    else {
        if ((hero.sickType ?? 0) & SICK_VOMITABLE)
            await cureHeroSicknessWithMessages(state, SICK_VOMITABLE, publish);
        if (hungerState >= FAINTING)
            await publish(`Your ${body_part(STOMACH, state)} heaves convulsively!`);
    }
    if (currentMulti(state) >= -2) {
        nomul(-2, state);
        state._helplessReason = 'vomiting';
        state._helplessDoneMessage = 'You can move again.';
    }
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
        && acidic(form)
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
export async function consume_oeaten(food, adjustment, { state = game } = {}) {
    if (!obj_nutrition(food)) {
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
export function Popeye(threat, state = game) {
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
                || acidic(species));
        case 'slimed':
            return species >= 0 && (is_shapeshifter(species)
                || requireMonsterData(MONSTER_ATTACKS, species).some(([, damage]) => damage === AD_POLY));
        case 'sick':
        case 'vomiting': return false;
    }
}
// C eat.c:Finish_digestion(). Corpse post-effects once digestion completes.
export async function Finish_digestion(state = game) {
    const species = state._digestedMonsterSpecies;
    if (species === undefined || species === null)
        return;
    await cpostfx(species, { state });
    state._digestedMonsterSpecies = null;
}
const PM_KILLER_BEE = 1;
const PM_QUEEN_BEE = 5;
//# sourceMappingURL=eat.js.map