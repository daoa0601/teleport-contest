// Eating and meal occupations.
// C ref: eat.c.

import { adjustHeroAlignment } from './alignment.js';
import { A_STR, SICK_VOMITABLE } from './const.js';
import {
    flush_screen, newsym, pline, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { inventoryItemDescription } from './invent.js';
import { nextIdent } from './ident.js';
import { getRumor } from './mklev.js';
import {
    cureHeroSickness, cureHeroVomiting, heroIsSick, startHeroSickness,
} from './hero_illness.js';
import { putHeroToSleep } from './hero_sleep.js';
import {
    MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL,
} from './monster_data.js';
import {
    APPLE, CARROT, CLOVE_OF_GARLIC, CORPSE, CRAM_RATION, EGG,
    EUCALYPTUS_LEAF, FOOD_RATION, FORTUNE_COOKIE, LEMBAS_WAFER,
    LUMP_OF_ROYAL_JELLY, OBJECT_DELAY, OBJECT_MATERIAL, OBJECT_NAMES,
    OBJECT_NUTRITION, SPRIG_OF_WOLFSBANE,
} from './object_data.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { eatRoyalJelly } from './royal_jelly.js';
import {
    heroIsBlind, heroIsDeaf, setHeroBlindnessTurns,
    syncBlindness, syncDeafness,
} from './senses.js';
import { promptKey } from './tty_prompts.js';
import { assignInventoryLetter } from './u_init.js';
import {
    heroCanBeSlimed, PM_GREEN_SLIME, startHeroSliming,
} from './slime.js';
import {
    eatPetrifyingEgg, heroWouldPetrifyFromFlesh,
    tastePetrifyingFlesh,
} from './stoning.js';
import {
    catchLycanthropyFromCorpse, purifyHeroLycanthropy,
} from './were.js';
import { retouchEquipment } from './hero_retouch.js';
import { exceedsActionCapacity, objectWeight } from './weight.js';

const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;
const M1_OMNIVORE = M1_CARNIVORE | M1_HERBIVORE;
const M1_POIS = 0x10000000;

const PM_ACID_BLOB = 6;
const PM_STALKER = 153;
const PM_LICHEN = 158;
const PM_BLACK_PUDDING = 209;
const PM_LEATHER_GOLEM = 253;
const PM_FLESH_GOLEM = 255;
const PM_DEATH = 311;
const PM_FAMINE = 313;
const PM_LIZARD = 326;

const S_BLOB = 2;
const S_JELLY = 10;
const S_VORTEX = 22;
const S_LIGHT = 25;
const S_ELEMENTAL = 31;
const S_FUNGUS = 32;
const S_PUDDING = 42;
const S_GHOST = 54;
const S_GOLEM = 55;

function objectQuantity(object) {
    return object?.quantity ?? object?.quan ?? 1;
}

function nonrottingCorpse(mnum) {
    return mnum === PM_ACID_BLOB || mnum === PM_LICHEN
        || mnum === PM_LIZARD
        || (mnum >= PM_DEATH && mnum <= PM_FAMINE);
}

// C ref: mondata.h vegan()/vegetarian().  These classifications describe
// what the corpse is made of; the hero's M1 diet flags separately describe
// whether that food is palatable.
function veganCorpse(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    return symbol === S_BLOB || symbol === S_JELLY || symbol === S_FUNGUS
        || symbol === S_VORTEX || symbol === S_LIGHT || symbol === S_GHOST
        || (symbol === S_ELEMENTAL && mnum !== PM_STALKER)
        || (symbol === S_GOLEM
            && mnum !== PM_FLESH_GOLEM && mnum !== PM_LEATHER_GOLEM);
}

function vegetarianCorpse(mnum) {
    return veganCorpse(mnum)
        || (MONSTER_SYMBOL[mnum] === S_PUDDING
            && mnum !== PM_BLACK_PUDDING);
}

function heroDietFlags() {
    const currentForm = game.u?.umonnum;
    if (Number.isInteger(currentForm) && currentForm >= 0)
        return MONSTER_FLAGS1[currentForm] ?? M1_OMNIVORE;
    // All five playable base races in NetHack 5.0 are omnivorous.
    return M1_OMNIVORE;
}

// C hack.c:rounddiv() for the positive values used by doeat().  A partly eaten
// item takes only the fraction of its original eating time that remains.
function roundDivPositive(value, divisor) {
    if (divisor <= 0) return 0;
    const quotient = Math.trunc(value / divisor);
    const remainder = value % divisor;
    return quotient + Number(2 * remainder >= divisor);
}

function mealTiming(food, baseReqtime, baseNutrition) {
    const remainingNutrition = food.oeaten ?? 0;
    const reqtime = baseNutrition === 0 ? 0
        : roundDivPositive(baseReqtime * remainingNutrition, baseNutrition);
    const nutritionPerBite = reqtime && remainingNutrition >= reqtime
        ? Math.trunc(remainingNutrition / reqtime) : 0;
    const nutritionSkipInterval = reqtime && remainingNutrition < reqtime
        ? reqtime % remainingNutrition : 0;
    return { reqtime, nutritionPerBite, nutritionSkipInterval };
}

// C eat.c:rottenfood().  The three tests are deliberately separate and in
// source order: even a blind hero consumes the second rn2(4) before the
// blindness guard, and the fainting test belongs after both four-way tests.
function rottenFoodEffect() {
    const messages = ['Blecch!  Rotten food!'];
    if (rn2(4) === 0) {
        messages.push(game.u?.hallucinating
            || (game.u?.hallucinationTurns ?? 0) > 0
            ? 'You feel rather trippy.'
            : 'You feel rather light headed.');
        game.u.confusionTurns = (game.u.confusionTurns ?? 0) + d(2, 4);
        return { message: messages.join('  '), passedOut: false };
    } else if (rn2(4) === 0 && !game.blind) {
        messages.push('Everything suddenly goes dark.');
        game.u.blindTurns = (game.u.blindTurns ?? 0) + d(2, 10);
        syncBlindness(game);
        game.vision_full_recalc = 1;
        return { message: messages.join('  '), passedOut: false };
    } else if (rn2(3) === 0) {
        const duration = rnd(10);
        const floating = !!(game.u?.levitating || game.levitating);
        const ending = !game.blind ? 'goes dark'
            : floating ? 'you lose control of yourself'
                : `you slap against the ${game.u?.usteed ? 'saddle' : 'floor'}`;
        messages.push(`The world spins and ${ending}.`);
        game.u.deafTurns = (game.u.deafTurns ?? 0) + duration;
        syncDeafness(game);
        game._helplessTurns = duration;
        game._helplessReason = 'unconscious from rotten food';
        game._helplessDoneMessage = 'You are conscious again.';
        game._helplessAfter = 'hear-again';
        return { message: messages.join('  '), passedOut: true };
    }
    return { message: messages[0], passedOut: false };
}

// C eat.c:touchfood().  Eating one object from a carried stack creates a
// distinct object before any spoilage or first-bite logic runs.  The split
// child is removed and re-added without merging, so it receives the next
// free inventory letter while the untouched parent retains its original one.
function touchFood(item, floorPile = null) {
    const quantity = item.quantity ?? item.quan ?? 1;
    let touched = item;
    if (quantity > 1) {
        if (floorPile?.includes(item)) {
            // splitobj(otmp, otmp->quan - 1) leaves the selected original as
            // the one-item floor object and links the untouched remainder
            // beside it in the same pile.
            const remainder = {
                ...item,
                o_id: nextIdent(),
                quantity: quantity - 1,
                quan: quantity - 1,
            };
            item.quantity = item.quan = 1;
            const index = floorPile.indexOf(item);
            floorPile.splice(index + 1, 0, remainder);
        } else {
            item.quantity = item.quan = quantity - 1;
            touched = {
                ...item,
                o_id: nextIdent(),
                quantity: 1,
                quan: 1,
                invlet: null,
                worn: false,
                ready: false,
            };
            assignInventoryLetter(touched);
            game.inventory.push(touched);
        }
    }
    if (!touched.oeaten) {
        touched.oeaten = touched.globby
            ? touched.owt ?? 0
            : OBJECT_NUTRITION[touched.otyp] || 0;
    }
    return touched;
}

function consumeTouchedFood(item, floorPile = null) {
    if (floorPile?.includes(item)) {
        floorPile.splice(floorPile.indexOf(item), 1);
        newsym(item.ox, item.oy);
        return;
    }
    game.inventory = (game.inventory || []).filter(candidate =>
        candidate !== item);
    if (game.uwep === item) game.uwep = null;
    if (game.uswapwep === item) game.uswapwep = null;
    if (game.uquiver === item) game.uquiver = null;
}

function recordFoodConduct(item, corpseMnum = null) {
    if (!game.u.uconduct) game.u.uconduct = {};
    const conduct = game.u.uconduct;
    conduct.food = (conduct.food || 0) + 1;
    const violateVegetarian = () => {
        conduct.unvegetarian = (conduct.unvegetarian || 0) + 1;
        if (game.urole?.key !== 'monk') return null;
        // eat.c:violated_vegetarian() applies this every time, not only when
        // the conduct counter first becomes nonzero.
        adjustHeroAlignment(-1);
        return 'You feel guilty.';
    };

    if (Number.isInteger(corpseMnum)) {
        if (!veganCorpse(corpseMnum))
            conduct.unvegan = (conduct.unvegan || 0) + 1;
        return !vegetarianCorpse(corpseMnum)
            ? violateVegetarian() : null;
    }

    const material = OBJECT_MATERIAL[item?.otyp] ?? 0;
    const name = OBJECT_NAMES[item?.otyp] || item?.name || '';
    if (material === 4
        || ['pancake', 'fortune cookie', 'cream pie', 'candy bar',
            'lump of royal jelly'].includes(name)) {
        conduct.unvegan = (conduct.unvegan || 0) + 1;
    }
    return material === 4 && name !== 'egg'
        ? violateVegetarian() : null;
}

// C eat.c:doeat() non-corpse freshness gate.  Cram and lembas never rot;
// fortune cookies bypass this gate separately.  Object age comes from
// mksobj(), including for starting inventory, rather than being inferred at
// the moment the hero finally selects the food.
function ordinaryFoodIsRotten(item) {
    if (item.cursed) return true;
    if (item.otyp === FORTUNE_COOKIE
        || item.otyp === LEMBAS_WAFER || item.otyp === CRAM_RATION)
        return false;
    const age = Number.isInteger(item.age) ? item.age : 1;
    const oldEnough = (game.moves ?? 1) - age
        > (item.blessed ? 50 : 30);
    return oldEnough && (item.orotten || rn2(7) === 0);
}

function normalCorpseMeal(corpse, corpseName) {
    const mnum = corpse.corpsenm;
    const glob = !!corpse.globby;
    const neverRots = nonrottingCorpse(mnum);
    let rotted = 0;
    if (!neverRots) {
        const age = Number.isInteger(corpse.age)
            ? corpse.age : (game.moves ?? 1);
        rotted = Math.trunc(((game.moves ?? 1) - age) / (10 + rn2(20)));
        if (corpse.cursed) rotted += 2;
        else if (corpse.blessed) rotted -= 2;
    }

    const stoneable = heroWouldPetrifyFromFlesh(mnum, game);
    const slimeable = mnum === PM_GREEN_SLIME && heroCanBeSlimed(game);
    if (!glob && !stoneable && !slimeable && rotted > 5) {
        const foodKind = MONSTER_SYMBOL[mnum] === S_FUNGUS
            ? 'fungoid vegetation'
            : vegetarianCorpse(mnum) ? 'protoplasm' : 'meat';
        const sickResistance = !!(
            game.u?.sickResistance || game.u?.sick_resistance
        );
        let sicknessTurns = null;
        if (!sickResistance) {
            sicknessTurns = rn1(10, 10);
            if (heroIsSick(game) && sicknessTurns > game.u.sickTurns) {
                sicknessTurns = game.u.sickTurns > 1
                    ? game.u.sickTurns - 1 : 1;
            }
        }
        return {
            object: corpse,
            tainted: true,
            tasteMessage: `Ulch - that ${foodKind} was tainted!`,
            sicknessTurns,
            sicknessCause: `rotted ${corpseName}`,
            followupMessage: sickResistance
                ? "It doesn't seem at all sickening, though..."
                : '(It must have died too long ago to be safe to eat.)',
        };
    }

    const [speciesWeight = 0, speciesNutrition = 0]
        = MONSTER_BODY_META[mnum] ?? [];
    const weight = glob ? corpse.owt ?? 0 : speciesWeight;
    const nutrition = glob ? corpse.owt ?? 0 : speciesNutrition;
    const baseReqtime = 3 + (weight >> 6);
    // doeat() calls touchfood() before eatcorpse().  oeaten is persistent
    // object state so interrupted and rotten meals resume from the right
    // remaining nutrition rather than reconstructing a full corpse.
    if (!corpse.oeaten) corpse.oeaten = nutrition;

    // eat.c:eatcorpse(): poisonous() is a monster-species predicate, not a
    // corpse-resistance predicate.  Its nonzero four-in-five gate precedes
    // both the mildly stale check and rottenfood().  Poison skips those later
    // checks without changing the ordinary meal timer.
    if ((MONSTER_FLAGS1[mnum] & M1_POIS) && rn2(5) !== 0) {
        const poisonResistance = !!game.u?.poisonResistance;
        return {
            ...mealTiming(corpse, baseReqtime, nutrition),
            object: corpse,
            tasteMessage: poisonResistance
                ? 'Ecch - that must have been poisonous!  You seem unaffected by the poison.'
                : 'Ecch - that must have been poisonous!',
            poisonStrengthLoss: poisonResistance ? 0 : rnd(4),
            poisonDamage: poisonResistance ? 0 : rnd(15),
            poisonBranch: true,
        };
    }

    // eat.c handles a mildly stale cadaver before rottenfood() and before
    // ordinary taste prose.  This branch still starts the full meal, but its
    // first bite immediately damages the hero and owns the only message.
    const sickResistance = !!game.u?.sickResistance;
    if ((rotted > 5 || (rotted > 3 && rn2(5) !== 0)) && !sickResistance) {
        return {
            ...mealTiming(corpse, baseReqtime, nutrition),
            object: corpse,
            tasteMessage: game.u?.sick ? 'You feel very sick.' : 'You feel sick.',
            illnessDamage: rnd(8),
        };
    }

    // Keep the rottenfood() check before the normal corpse meal effects.
    const rotten = !neverRots && (corpse.orotten || rn2(7) === 0);
    if (rotten) {
        const effect = rottenFoodEffect();
        if (effect.passedOut) corpse.orotten = true;
        if (!effect.passedOut && nutrition > 0)
            corpse.oeaten >>= 2;
        return {
            ...mealTiming(corpse, baseReqtime, nutrition),
            object: corpse,
            tasteMessage: effect.message,
            passedOut: effect.passedOut,
            rotsAway: speciesNutrition === 0,
        };
    }

    const corpseIsVegan = veganCorpse(mnum);
    const corpseIsVegetarian = vegetarianCorpse(mnum);
    const diet = heroDietFlags();
    const carnivorous = !!(diet & M1_CARNIVORE);
    const herbivorous = !!(diet & M1_HERBIVORE);
    const yummy = corpseIsVegan
        ? !carnivorous && herbivorous
        : carnivorous && !herbivorous;

    const dietMatches = corpseIsVegetarian ? herbivorous : carnivorous;
    let palatable = false;
    if (dietMatches && rn2(10) !== 0)
        palatable = rotted < 1 || rn2(rotted + 1) === 0;

    const palatableMessages = [
        'Tokay', 'Istringy', 'Igamey', 'Ifatty', 'Itough',
    ];
    const messageIndex = corpseIsVegetarian ? 0 : rn2(5);
    const flavor = palatableMessages[messageIndex];
    const useIs = palatable && flavor[0] === 'I';
    const adjective = yummy ? 'delicious'
        : palatable ? flavor.slice(1) : 'terrible';
    const punctuation = yummy || !palatable ? '!' : '.';
    return {
        ...mealTiming(corpse, baseReqtime, nutrition),
        object: corpse,
        tasteMessage: `This ${corpseName} ${useIs ? 'is' : 'tastes'} ${adjective}${punctuation}`,
    };
}

// attrib.c:poison_strdmg()->losestr() plus losehp().  Strength which would
// cross its natural minimum is converted into 3..6 HP/max-HP frailty damage;
// any remaining loss changes the base attribute and clears its exercise.
function applyCorpsePoisonDamage(meal) {
    let strengthLoss = meal.poisonStrengthLoss ?? 0;
    const attributes = game.u?.acurr?.a;
    const currentStrength = attributes?.[A_STR] ?? 3;
    let reducedStrength = currentStrength - strengthLoss;
    let frailtyDamage = 0;
    while (reducedStrength < 3) {
        reducedStrength++;
        strengthLoss--;
        frailtyDamage += 3 + rn2(4);
    }
    if (frailtyDamage) {
        game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - frailtyDamage);
        game.u.uhpmax = Math.max(1,
            (game.u.uhpmax ?? 1) - frailtyDamage);
    }
    if (attributes && strengthLoss > 0) {
        attributes[A_STR] = reducedStrength;
        if (!Array.isArray(game.u._exercise))
            game.u._exercise = Array(6).fill(0);
        game.u._exercise[A_STR] = 0;
    }
    if ((meal.poisonDamage ?? 0) > 0) {
        game.u.uhp = Math.max(
            0, (game.u.uhp ?? 1) - meal.poisonDamage,
        );
    }
}

function applyMealNutrition(g, meal, usedtime) {
    const perBite = meal.nutritionPerBite ?? 0;
    const skipInterval = meal.nutritionSkipInterval ?? 0;
    const amount = perBite || (skipInterval > 0
        && usedtime % skipInterval !== 0 ? 1 : 0);
    if (amount > 0)
        g.u.uhunger = (g.u.uhunger ?? 900) + amount;
    if (amount > 0 && meal.object && Number.isInteger(meal.object.oeaten)) {
        meal.object.oeaten = Math.max(1, meal.object.oeaten - amount);
        meal.object.owt = objectWeight(meal.object);
    }
}

async function applyCorpsePreEffects(g, food) {
    const petrification = await tastePetrifyingFlesh(food);
    if (petrification.stopped)
        return { stopped: true, message: null };
    if (food?.corpsenm !== PM_GREEN_SLIME)
        return { stopped: false, message: null };
    const message = startHeroSliming({ state: g })
        ? "You don't feel very well." : null;
    return { stopped: false, message };
}

// C eat.c:cpostfx()/eye_of_newt_buzz().  Corpse post-effects happen after
// the finish message and before the consumed floor identity is released.
async function applyCorpsePostEffects(g, corpse) {
    if (catchLycanthropyFromCorpse(corpse?.corpsenm, g)) {
        await retouchEquipment(2);
        return null;
    }
    if (corpse?.corpsenm !== 322) return null; // PM_NEWT
    const u = g.u;
    if (rn2(3) !== 0 || 3 * (u.uen ?? 0) <= 2 * (u.uenmax ?? 0)) {
        const oldEnergy = u.uen ?? 0;
        u.uen = oldEnergy + rnd(3);
        if (u.uen > (u.uenmax ?? 0)) {
            if (rn2(3) === 0) {
                u.uenmax = (u.uenmax ?? 0) + 1;
                u.uenpeak = Math.max(u.uenpeak ?? 0, u.uenmax);
            }
            u.uen = u.uenmax;
        }
        if (u.uen !== oldEnergy) return 'You feel a mild buzz.';
    }
    return null;
}

async function applyOrdinaryFoodPostEffects(g, food) {
    if (food.otyp === FORTUNE_COOKIE) {
        await applyFortuneCookiePostEffect(g, food);
        return;
    }
    if (food.otyp === LUMP_OF_ROYAL_JELLY) {
        await eatRoyalJelly(food, { state: g });
        return;
    }
    if (food.otyp === APPLE && food.cursed
        && !(g.u?.sleepResistance || g.u?.sleep_resistance)) {
        const hallucinating = !!g.u?.hallucinating
            || (g.u?.hallucinationTurns ?? 0) > 0;
        if (g.urace?.name === 'dwarf' && hallucinating) {
            await plineWithContinuation(
                '"Heigh-ho, ho-hum, I think I\'ll skip work today."',
            );
        } else if (heroIsDeaf(g) || g.flags?.acoustics === false) {
            await plineWithContinuation('You fall asleep.');
        } else {
            await plineWithContinuation(
                'You hear sinister laughter as you fall asleep...',
            );
        }
        putHeroToSleep(rn1(11, 20), { state: g });
        return;
    }
    if (food.otyp === EGG) {
        await eatPetrifyingEgg(food);
        return;
    }
    if (food.otyp === CARROT) {
        const sight = setHeroBlindnessTurns(g.u?.ucreamed ?? 0, g);
        if (sight.regainedSight)
            await plineWithContinuation('You can see again.');
        return;
    }
    if (food.otyp === SPRIG_OF_WOLFSBANE) {
        await purifyHeroLycanthropy({ state: g });
        return;
    }
    if (food.otyp === EUCALYPTUS_LEAF && !food.cursed) {
        if (cureHeroSickness(g)) {
            await plineWithContinuation(
                'You feel cured.  What a relief!',
            );
        }
        if (cureHeroVomiting(g))
            await plineWithContinuation('You feel much less nauseated now.');
    }
}

async function applyFortuneCookiePostEffect(g, cookie) {
    if (heroIsBlind(g)) {
        await plineWithContinuation(
            'This cookie has a scrap of paper inside.',
        );
        await plineWithContinuation(
            'What a pity that you cannot read it!',
        );
        return;
    }

    const truth = cookie.blessed ? 1 : cookie.cursed ? -1 : 0;
    const rumor = getRumor(false, true, truth);
    await plineWithContinuation(
        'This cookie has a scrap of paper inside.',
    );
    await plineWithContinuation('It reads:');
    await plineWithContinuation(rumor);
    if (!g.u.uconduct) g.u.uconduct = {};
    g.u.uconduct.literate = (g.u.uconduct.literate || 0) + 1;
}

async function finishFoodMeal(g, meal, showFinishMessage) {
    if (g.context?.victual?.piece === meal.object)
        g.context.victual = null;
    if (showFinishMessage && meal.finishMessage) {
        // done_eating(TRUE) prints this after the initial taste or hazard.
        await plineWithContinuation(meal.finishMessage);
    }
    const postEffectMessage = meal.corpseLike
        ? await applyCorpsePostEffects(g, meal.object) : null;
    if (postEffectMessage)
        await plineWithContinuation(postEffectMessage);
    if (!meal.corpseLike)
        await applyOrdinaryFoodPostEffects(g, meal.object);
    if (meal.carried) {
        consumeTouchedFood(meal.object);
    } else {
        const pile = g.level?.objects?.[meal.x]?.[meal.y];
        if (Array.isArray(pile)) {
            const index = pile.indexOf(meal.object);
            if (index >= 0) pile.splice(index, 1);
        }
        newsym(meal.x, meal.y);
    }
}

export async function continueFoodMeal(occupation, state = game) {
    occupation.remaining--;
    occupation.usedtime = (occupation.usedtime ?? 1) + 1;
    if (occupation.remaining > 0)
        applyMealNutrition(state, occupation, occupation.usedtime);
    if (occupation.remaining <= 0) {
        await finishFoodMeal(state, occupation, true);
        state._occupation = null;
    }
    state.context.move = 1;
    return true;
}

async function startFoodMeal(meal, messages) {
    game._pending_message = messages.filter(Boolean).join('  ');
    applyMealNutrition(game, meal, 0);
    const occupation = {
        key: 'eat-food',
        ...meal,
        remaining: meal.reqtime,
        usedtime: 1,
    };
    game.context.victual = { piece: meal.object };
    if (meal.reqtime <= 1) {
        await finishFoodMeal(game, occupation, false);
        game._occupation = null;
    } else {
        game._occupation = occupation;
    }
    game.context.move = 1;
}

async function beginCorpseMeal(corpse, floorPile = null) {
    const x = floorPile ? (corpse.ox ?? game.u?.ux) : game.u?.ux;
    const y = floorPile ? (corpse.oy ?? game.u?.uy) : game.u?.uy;
    const corpseName = corpse.name || (corpse.globby
        ? OBJECT_NAMES[corpse.otyp]
        : `${MONSTER_NAME[corpse.corpsenm] || 'monster'} corpse`);
    const conductMessage = recordFoodConduct(corpse, corpse.corpsenm);
    const meal = normalCorpseMeal(corpse, corpseName);
    if (meal.tainted) {
        let sicknessMessage = null;
        if (meal.sicknessTurns !== null) {
            const sickness = startHeroSickness({
                state: game,
                turns: meal.sicknessTurns,
                cause: meal.sicknessCause,
                type: SICK_VOMITABLE,
            });
            sicknessMessage = sickness.message;
        }
        game._pending_message = [
            conductMessage, meal.tasteMessage,
            sicknessMessage, meal.followupMessage,
        ].filter(Boolean).join('  ');
        consumeTouchedFood(corpse, floorPile);
        game.context.move = 1;
        return;
    }
    if (meal.poisonBranch) applyCorpsePoisonDamage(meal);
    if (meal.illnessDamage) {
        game.u.uhp = Math.max(0,
            (game.u.uhp ?? 1) - meal.illnessDamage);
    }
    if (meal.rotsAway) {
        game._pending_message = [conductMessage, meal.tasteMessage]
            .filter(Boolean).join('  ');
        consumeTouchedFood(corpse, floorPile);
        game.context.move = 1;
        return;
    }
    if (meal.passedOut) {
        game._pending_message = [conductMessage, meal.tasteMessage]
            .filter(Boolean).join('  ');
        game.context.move = 1;
        return;
    }
    game._pending_message = [conductMessage, meal.tasteMessage]
        .filter(Boolean).join('  ');
    const preEffect = await applyCorpsePreEffects(game, corpse);
    if (preEffect.stopped) {
        game.context.move = 1;
        return;
    }
    await startFoodMeal({
        ...meal,
        object: corpse,
        x,
        y,
        carried: !floorPile,
        corpseLike: true,
        finishMessage: `You finish eating the ${corpseName}.`,
    }, [conductMessage, meal.tasteMessage, preEffect.message]);
}

function ordinaryFoodName(item) {
    return item.name || OBJECT_NAMES[item.otyp] || 'food';
}

function ordinaryFirstBiteMessage(item) {
    const name = ordinaryFoodName(item);
    if (item.otyp === FOOD_RATION) {
        if ((game.u?.uhunger ?? 900) <= 200)
            return 'This food really hits the spot!';
        if ((game.u?.uhunger ?? 900) < 700)
            return 'This satiates your stomach!';
        return null;
    }
    if (item.otyp === CRAM_RATION)
        return `This ${name} is ${item.cursed ? 'terrible!' : 'bland.'}`;
    return `This ${name} is ${item.cursed ? 'terrible!' : 'delicious!'}`;
}

async function beginOrdinaryFoodMeal(item, floorPile, conductMessage) {
    const baseNutrition = OBJECT_NUTRITION[item.otyp] || 0;
    let firstBiteMessage;
    if (ordinaryFoodIsRotten(item)) {
        const effect = rottenFoodEffect();
        item.oeaten = Math.max(1, (item.oeaten || 0) >> 1);
        if (effect.passedOut) {
            item.orotten = true;
            game._pending_message = [conductMessage, effect.message]
                .filter(Boolean).join('  ');
            game.context.move = 1;
            return;
        }
        firstBiteMessage = effect.message;
    } else {
        if (item.otyp === CLOVE_OF_GARLIC) garlicBreath();
        firstBiteMessage = ordinaryFirstBiteMessage(item);
    }

    const name = ordinaryFoodName(item);
    await startFoodMeal({
        ...mealTiming(item, OBJECT_DELAY[item.otyp] || 0, baseNutrition),
        object: item,
        x: floorPile ? (item.ox ?? game.u?.ux) : game.u?.ux,
        y: floorPile ? (item.oy ?? game.u?.uy) : game.u?.uy,
        carried: !floorPile,
        corpseLike: false,
        finishMessage: `You finish eating the ${name}.`,
    }, [conductMessage, firstBiteMessage]);
}

// C refs: mondata.c:olfaction(), eat.c:garlic_breath(), and
// monmove.c:monflee().  Monster symbols are the generated S_* class indexes.
// Smell is deliberately class-based rather than inferred from eyes, a head,
// or nonliving status: insects and ghosts can smell while golems cannot.
const NO_OLFACTION_MONSTER_CLASSES = new Set([
    2,  // S_BLOB
    5,  // S_EYE
    10, // S_JELLY
    22, // S_VORTEX
    25, // S_LIGHT
    31, // S_ELEMENTAL
    32, // S_FUNGUS
    42, // S_PUDDING
    55, // S_GOLEM
]);

function monsterHasOlfaction(monster) {
    return !NO_OLFACTION_MONSTER_CLASSES.has(
        MONSTER_SYMBOL[monster?.mnum],
    );
}

function garlicBreath() {
    const ux = game.u?.ux ?? 0;
    const uy = game.u?.uy ?? 0;
    for (const monster of game.level?.monsters || []) {
        if (!monster || (monster.mhp ?? 1) <= 0 || monster.mx === 0
            || !monsterHasOlfaction(monster)) continue;
        const dx = monster.mx - ux;
        const dy = monster.my - uy;
        if (dx * dx + dy * dy >= 7) continue;

        // monflee(monster, 0, FALSE, FALSE): an untimed scare replaces a
        // timed one and invalidates the actor's remembered movement path.
        monster.mflee = 1;
        monster.mfleetim = 0;
        monster.mtrack = [];
    }
}

// C refs: eat.c doeat(), eatcorpse(), start_eating(), eatfood(),
// done_eating(), fpostfx(); rumors.c outrumor().
// Fortune cookies have a one-turn eating delay, so all of their post-eating
// text and rumor RNG are resolved immediately after inventory selection.
export async function doeat() {
    const floorX = game.u?.ux, floorY = game.u?.uy;
    const floorPile = game.level?.objects?.[floorX]?.[floorY] || [];
    const floorCorpse = floorPile.find(object => object.otyp === CORPSE);
    if (floorCorpse) {
        const corpseName = floorCorpse.name
            || `${MONSTER_NAME[floorCorpse.corpsenm] || 'monster'} corpse`;
        const answer = String.fromCharCode(await promptKey(
            `There is a ${corpseName} here; eat it? [ynq] (n) `,
        )).toLowerCase();
        if (answer !== 'y') {
            game._pending_message = '';
            game.context.move = 0;
            return;
        }
        if (exceedsActionCapacity(game)) {
            await pline("You can't do that while carrying so much stuff.");
            game.context.move = 0;
            return;
        }

        const touched = touchFood(floorCorpse, floorPile);
        await beginCorpseMeal(touched, floorPile);
        return;
    }

    // eat.c:floorfood() offers ordinary edible floor stacks before getobj().
    // Invalid keys keep the question open.  A blank accepts the default and
    // continues to the inventory selector.
    let item = null;
    let itemFloorPile = null;
    const floorFood = floorPile.find(object => object.oclass === 7);
    if (floorFood) {
        const quantity = objectQuantity(floorFood);
        const one = quantity === 1;
        const prompt = `There ${one ? 'is' : 'are'} ${
            inventoryItemDescription(floorFood)} here; eat ${
            one ? 'it' : 'one'}? [ynq] (n) `;
        await pline(prompt);
        await flush_screen(1);
        game.nhDisplay?.setCursor(prompt.length, 0);
        let answer;
        for (;;) {
            const key = await nhgetch();
            answer = String.fromCharCode(key).toLowerCase();
            if (answer === 'y' || answer === 'n' || answer === 'q') break;
            if ([27, 32, 10, 13].includes(key)) {
                answer = 'n';
                break;
            }
        }
        game._pending_message = '';
        game._retained_message = '';
        if (answer === 'q') {
            game.context.move = 0;
            return;
        }
        if (answer === 'y') {
            item = floorFood;
            itemFloorPile = floorPile;
        }
    }

    const inventory = game.inventory || [];
    const edible = inventory.filter(candidate => candidate.oclass === 7);
    if (!item && !edible.length) {
        await pline("You don't have anything to eat.");
        game.context.move = 0;
        return;
    }

    if (!item) {
        const letters = edible.map(candidate => candidate.invlet).join('');
        const compactLetters = letters.length >= 6
            && [...letters].every((letter, index) => index === 0
                || letter.charCodeAt(0)
                    === letters.charCodeAt(index - 1) + 1)
            ? `${letters[0]}-${letters.at(-1)}` : letters;
        const prompt = `What do you want to eat? [${compactLetters} or ?*] `;
        let key = await promptKey(prompt);
        for (;;) {
            // invent.c:getobj() uses the shared quitchars set: space, Return,
            // and Escape all cancel. `Never mind.` is conditional on verbose.
            if ([27, 32, 10, 13].includes(key)) {
                if (game.flags?.verbose !== false)
                    await pline('Never mind.');
                game.context.move = 0;
                return;
            }

            // eat_ok() suggests food but leaves ordinary non-food inventory
            // letters directly selectable.  doeat() checks carrying capacity
            // before it reaches the later "cannot eat that" rejection.
            item = inventory.find(candidate =>
                candidate.invlet === String.fromCharCode(key));
            if (item) break;

            const invalid = "You don't have that object.--More--";
            await pline(invalid);
            await flush_screen(1);
            game.nhDisplay?.setCursor(invalid.length, 0);
            do key = await nhgetch();
            while (key !== 27 && key !== 32 && key !== 10 && key !== 13);

            await pline(prompt);
            await flush_screen(1);
            game.nhDisplay?.setCursor(prompt.length, 0);
            key = await nhgetch();
        }
    }

    if (exceedsActionCapacity(game)) {
        await pline("You can't do that while carrying so much stuff.");
        game.context.move = 0;
        return;
    }
    if (item.oclass !== 7) {
        await pline('You cannot eat that!');
        game.context.move = 0;
        return;
    }

    // doeat() breaks food conduct as soon as a committed meal begins, before
    // touchfood(), freshness, and first-bite effects.
    const corpseLike = item.otyp === CORPSE || item.globby;
    const conductMessage = corpseLike
        ? null : recordFoodConduct(item);

    // touchfood() precedes both the freshness gate and every first-bite
    // effect.  In particular, even one-turn apples and carrots split from
    // their starting stacks before doeat() rolls rn2(7).
    item = touchFood(item, itemFloorPile);

    if (corpseLike) {
        await beginCorpseMeal(item, itemFloorPile);
        return;
    }

    await beginOrdinaryFoodMeal(item, itemFloorPile, conductMessage);
}
