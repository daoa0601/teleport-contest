// Eating and meal occupations.
// C ref: eat.c.

import { adjustHeroAlignment } from './alignment.js';
import { A_STR } from './const.js';
import {
    flush_screen, newsym, pline, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { inventoryItemDescription } from './invent.js';
import { nextIdent } from './ident.js';
import { getRumor } from './mklev.js';
import {
    MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL,
} from './monster_data.js';
import {
    CLOVE_OF_GARLIC, CORPSE, CRAM_RATION, FORTUNE_COOKIE, LEMBAS_WAFER,
    OBJECT_DELAY, OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_NUTRITION,
} from './object_data.js';
import { d, rn2, rnd } from './rng.js';
import { syncBlindness, syncDeafness } from './senses.js';
import { promptKey } from './tty_prompts.js';
import { assignInventoryLetter } from './u_init.js';
import { exceedsActionCapacity } from './weight.js';

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

// C hack.c:rounddiv() for the positive values used by doeat().  Corpse eating
// delay is rounded after touchfood()/consume_oeaten() has established how much
// nutrition remains, rather than being fixed from the original corpse weight.
function roundDivPositive(value, divisor) {
    if (divisor <= 0) return 0;
    const quotient = Math.trunc(value / divisor);
    const remainder = value % divisor;
    return quotient + Number(2 * remainder >= divisor);
}

function corpseMealTiming(corpse, baseReqtime, baseNutrition) {
    const remainingNutrition = corpse.oeaten ?? 0;
    const reqtime = baseNutrition === 0 ? 0
        : roundDivPositive(baseReqtime * remainingNutrition, baseNutrition);
    const nutritionNmod = !reqtime || !remainingNutrition ? 0
        : remainingNutrition >= reqtime
            ? -Math.trunc(remainingNutrition / reqtime)
            : reqtime % remainingNutrition;
    return { reqtime, nutritionNmod, remainingNutrition };
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
    if (!touched.oeaten)
        touched.oeaten = OBJECT_NUTRITION[touched.otyp] || 0;
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
    const neverRots = nonrottingCorpse(mnum);
    let rotted = 0;
    if (!neverRots) {
        const age = Number.isInteger(corpse.age)
            ? corpse.age : (game.moves ?? 1);
        rotted = Math.trunc(((game.moves ?? 1) - age) / (10 + rn2(20)));
        if (corpse.cursed) rotted += 2;
        else if (corpse.blessed) rotted -= 2;
    }

    const [weight = 0, nutrition = 0] = MONSTER_BODY_META[mnum] ?? [];
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
            ...corpseMealTiming(corpse, baseReqtime, nutrition),
            object: corpse,
            tasteMessage: poisonResistance
                ? 'Ecch - that must have been poisonous!  You seem unaffected by the poison.'
                : 'Ecch - that must have been poisonous!',
            poisonStrengthLoss: poisonResistance ? 0 : rnd(4),
            poisonDamage: poisonResistance ? 0 : rnd(15),
            poisonBranch: true,
            rottenBranch: false,
        };
    }

    // eat.c handles a mildly stale cadaver before rottenfood() and before
    // ordinary taste prose.  This branch still starts the full meal, but its
    // first bite immediately damages the hero and owns the only message.
    const sickResistance = !!game.u?.sickResistance;
    if ((rotted > 5 || (rotted > 3 && rn2(5) !== 0)) && !sickResistance) {
        return {
            ...corpseMealTiming(corpse, baseReqtime, nutrition),
            object: corpse,
            tasteMessage: game.u?.sick ? 'You feel very sick.' : 'You feel sick.',
            illnessDamage: rnd(8),
            rottenBranch: false,
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
            ...corpseMealTiming(corpse, baseReqtime, nutrition),
            object: corpse,
            tasteMessage: effect.message,
            rottenBranch: true,
            passedOut: effect.passedOut,
            rotsAway: nutrition === 0,
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
        ...corpseMealTiming(corpse, baseReqtime, nutrition),
        object: corpse,
        tasteMessage: `This ${corpseName} ${useIs ? 'is' : 'tastes'} ${adjective}${punctuation}`,
        rottenBranch: false,
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

function applyCorpseNutrition(g, meal, usedtime) {
    const nmod = meal.nutritionNmod ?? 0;
    const amount = nmod < 0 ? -nmod
        : nmod > 0 && (usedtime % nmod) !== 0 ? 1 : 0;
    if (amount > 0)
        g.u.uhunger = (g.u.uhunger ?? 900) + amount;
    if (amount > 0 && meal.object && Number.isInteger(meal.object.oeaten))
        meal.object.oeaten = Math.max(0, meal.object.oeaten - amount);
}

// C eat.c:cpostfx()/eye_of_newt_buzz().  Corpse post-effects happen after
// the finish message and before the consumed floor identity is released.
function applyCorpsePostEffects(g, corpse) {
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

async function finishCorpseMeal(g, meal, showFinishMessage) {
    if (showFinishMessage && meal.finishMessage) {
        // done_eating(TRUE) prints this after the initial taste or hazard.
        await plineWithContinuation(meal.finishMessage);
    }
    const postEffectMessage = applyCorpsePostEffects(g, meal.object);
    if (postEffectMessage)
        await plineWithContinuation(postEffectMessage);
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

export async function continueCorpseMeal(occupation, state = game) {
    occupation.remaining--;
    occupation.usedtime = (occupation.usedtime ?? 1) + 1;
    if (occupation.remaining > 0)
        applyCorpseNutrition(state, occupation, occupation.usedtime);
    if (occupation.remaining <= 0) {
        await finishCorpseMeal(state, occupation, true);
        state._occupation = null;
    }
    state.context.move = 1;
    return true;
}

async function beginCorpseMeal(corpse, floorPile = null) {
    const x = floorPile ? (corpse.ox ?? game.u?.ux) : game.u?.ux;
    const y = floorPile ? (corpse.oy ?? game.u?.uy) : game.u?.uy;
    const corpseName = corpse.name
        || `${MONSTER_NAME[corpse.corpsenm] || 'monster'} corpse`;
    const conductMessage = recordFoodConduct(corpse, corpse.corpsenm);
    const meal = normalCorpseMeal(corpse, corpseName);
    if (meal.poisonBranch) applyCorpsePoisonDamage(meal);
    if (meal.illnessDamage) {
        game.u.uhp = Math.max(0,
            (game.u.uhp ?? 1) - meal.illnessDamage);
    }
    game._pending_message = [conductMessage, meal.tasteMessage]
        .filter(Boolean).join('  ');
    if (meal.rotsAway) {
        consumeTouchedFood(corpse, floorPile);
        game.context.move = 1;
        return;
    }
    if (meal.passedOut) {
        game.context.move = 1;
        return;
    }
    applyCorpseNutrition(game, meal, 0);
    const corpseOccupation = {
        key: 'eat-corpse',
        object: corpse,
        x,
        y,
        carried: !floorPile,
        // start_eating() takes the first bite now.  eatfood() remains busy
        // through usedtime == reqtime and finishes on the next callback.
        remaining: meal.reqtime,
        usedtime: 1,
        nutritionNmod: meal.nutritionNmod,
        finishMessage: `You finish eating the ${corpseName}.`,
        rottenBranch: meal.rottenBranch,
    };
    if (meal.reqtime <= 1) {
        await finishCorpseMeal(game, corpseOccupation, false);
        game._occupation = null;
    } else {
        game._occupation = corpseOccupation;
    }
    game.context.move = 1;
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
    const conductMessage = item.otyp === CORPSE
        ? null : recordFoodConduct(item);

    // touchfood() precedes both the freshness gate and every first-bite
    // effect.  In particular, even one-turn apples and carrots split from
    // their starting stacks before doeat() rolls rn2(7).
    item = touchFood(item, itemFloorPile);

    if (item.otyp === CORPSE) {
        await beginCorpseMeal(item, itemFloorPile);
        return;
    }

    if (item.otyp === FORTUNE_COOKIE) {
        const rumor = getRumor(false, true);
        game._useInitialMaintenance = true;
        consumeTouchedFood(item, itemFloorPile);
        await promptKey('This fortune cookie is delicious!--More--');
        await promptKey('This cookie has a scrap of paper inside.  It reads:--More--');
        await pline(rumor);
        game.context.move = 1;
        return;
    }

    const rotten = ordinaryFoodIsRotten(item);
    if (rotten) {
        const effect = rottenFoodEffect();
        item.oeaten = Math.max(1, (item.oeaten || 0) >> 1);
        if (effect.passedOut) {
            item.orotten = true;
            await pline([conductMessage, effect.message]
                .filter(Boolean).join('  '));
            game.context.move = 1;
            return;
        }

        // A non-fainting rotten result still takes the first bite.  One-turn
        // food is consumed immediately, but only its halved nutrition remains.
        if ((OBJECT_DELAY[item.otyp] || 0) === 1) {
            game.u.uhunger = (game.u.uhunger ?? 900) + item.oeaten;
            consumeTouchedFood(item, itemFloorPile);
        }
        await pline([conductMessage, effect.message]
            .filter(Boolean).join('  '));
        game.context.move = 1;
        return;
    }

    // eat.c:fprefx() applies garlic_breath() on the first bite, before the
    // command returns ECMD_TIME and moveloop_core scans retained actors.
    if (item.otyp === CLOVE_OF_GARLIC)
        garlicBreath();

    // A one-turn food takes its sole bite immediately.  OBJECT_NUTRITION is
    // generated from objects[].oc_nutrition, so garlic and other instant
    // foods use the same nutrition table without name-specific values.
    if ((OBJECT_DELAY[item.otyp] || 0) === 1) {
        game.u.uhunger = (game.u.uhunger ?? 900)
            + (OBJECT_NUTRITION[item.otyp] || 0);
    }

    consumeTouchedFood(item, itemFloorPile);
    await pline([conductMessage, `This ${item.name} is delicious!`]
        .filter(Boolean).join('  '));
    game.context.move = 1;
}
