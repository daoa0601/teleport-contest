// Hero nutrition, hunger transitions, and meal fullness.
// C refs: eat.c:gethungry(), newuhs(), morehungry(), lesshungry(), choke().

import { objectMaterial } from './object_material.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { WornPropertySlot } from './property_types.js';
import { heroIsUnaware } from './hero_sleep.js';
import { game, requirePlayingGame, requireInitializedGame } from './gstate.js';
import { propertyIsActive } from './properties.js';
import {
    A_CON, A_LAWFUL, A_STR, CHOKING, FAINTED, FAINTING, HUNGRY, NOT_HUNGRY,
    PARANOID_EATING, SATIATED, STARVED, STARVING, Upolyd, WEAK,
} from './const.js';
import { hasNonArtifactConflict } from './hero_conflict.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { adjustHeroAlignment } from './alignment.js';
import { bot, plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { makeDeaf } from './hero_hearing.js';
import { stopHeroOccupation } from './occupation.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { stopRun } from './runmode.js';
import { heroIsHallucinating } from './senses.js';
import { selfTouchPetrifyingWeapons } from './stoning.js';
import { vomitHero } from './hero_illness.js';
import { killerObjectName } from './objnam.js';
import { paranoidQuery } from './query.js';
import { rn2 } from './rng.js';
import { MONSTER_FLAGS1, requireMonsterData } from './monster_data.js';
import { heroIsBreathless, heroSpecies } from './hero_species.js';
import { encumbranceLabel, encumbranceMessage, nearCapacity } from './weight.js';
import {
    AMULET_OF_STRANGULATION, AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, MEAT_RING,
    OBJECT_CHARGED, RIN_PROTECTION, RIN_SLOW_DIGESTION,
} from './object_data.js';
import { recordObjectKnowledge } from './object_knowledge.js';

interface HungerOptions { state?: GameState; }

const M1_METALLIVORE = 0x80000000;
const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;

export function currentHungerState(state: GameState = game) {
    if (state.u.uhs === FAINTED || state.u.uhs === STARVED) return state.u.uhs;
    const nutrition = state.u.uhunger ?? 900;
    return nutritionState(nutrition);
}

function nutritionState(nutrition: number) {
    return nutrition > 1000 ? SATIATED : nutrition > 150 ? NOT_HUNGRY
        : nutrition > 50 ? HUNGRY : nutrition > 0 ? WEAK : FAINTING;
}

// C eat.c:morehungry(). A zero or negative amount still runs newuhs(TRUE).
export async function spendHeroNutrition(amount: number, { state = game }: HungerOptions = {}) {
    requirePlayingGame(state);
    state.u.uhs ??= currentHungerState(state);
    state.u.uhunger = (state.u.uhunger ?? 900) - amount;
    await updateHeroHunger(true, { state });
}

// C eat.c:lesshungry(). Fullness belongs to this common boundary, including
// nutrition received outside a meal.
export async function gainHeroNutrition(amount: number, { state = game }: HungerOptions = {}) {
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
                : state._occupation?.key === 'open-tin' ? state._occupation.object : null, { state });
            if (state.program_state.gameover) return;
            if (eating && victual?.eating) victual.doreset = true;
        }
    } else if (hero.uhunger >= 1500 && !hero.hunger
        && (!victual?.eating || !victual.fullwarn)) {
        await plineWithContinuation("You're having a hard time getting all of it down.");
        if (!victual?.eating) {
            endVoluntaryMultiTurn(state);
            state._helplessTurns = 2;
            state._helplessReason = 'finishing a meal';
            state._helplessDoneMessage = "You're finally finished.";
            state._helplessAfter = null;
        } else {
            victual.fullwarn = true;
            state._helplessDoneMessage = "You're finally finished.";
            if (victual.canchoke && victual.reqtime - victual.usedtime > 1
                && !await paranoidQuery(
                    !!((state.flags?.paranoia_bits ?? 0) & PARANOID_EATING),
                    'Continue eating?',
                )) {
                victual.doreset = true;
                state._helplessDoneMessage = null;
            }
        }
    }
    await updateHeroHunger(false, { state });
}

// C eat.c:choke(). An initially hungry eater cannot choke merely because
// the meal fills her up; canchoke retains the state from before the meal.
export async function chokeHeroOnFood(food: GameObject | null | undefined, { state = game }: HungerOptions = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    if (hero.uhs !== SATIATED && food?.otyp !== AMULET_OF_STRANGULATION) return;
    if (hero.uhs === SATIATED && state.urole?.key === 'knight'
        && hero.ualign.type === A_LAWFUL) {
        adjustHeroAlignment(-1, state);
        await plineWithContinuation('You feel like a glutton!');
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
        if (state.program_state.gameover) return;
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
    if (!died) await updateHeroHunger(false, { state });
}

export function foodWord(food: GameObject, state: GameState = game) {
    if (food.oclass === 7) return 'food';
    const material = objectMaterial(food, state);
    if (food.oclass === 13 && material === 19 && food.dknown)
        recordObjectKnowledge(food.otyp, state);
    // C eat.c:foodwords[], indexed by the native oc_material enum.
    const word = ['meal', 'liquid', 'wax', 'food', 'meat', 'paper', 'cloth', 'leather',
        'wood', 'bone', 'scale', 'metal', 'metal', 'metal', 'silver', 'gold',
        'platinum', 'mithril', 'plastic', 'glass', 'rich food', 'stone'][material];
    if (word === undefined) throw new RangeError(`Unknown food material ${material}`);
    return word;
}

// C eat.c:newuhs(). Eating saves the state from before the first bite so
// recovery prose describes the whole meal, rather than each intermediate bite.
export async function updateHeroHunger(increasing: boolean, { state = game }: HungerOptions = {}) {
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
        if (old === FAINTED) next = FAINTED;
        if (old <= WEAK || rn2(20 - rounded) >= 19) {
            if (old !== FAINTED && (state.multi ?? 0) >= 0
                && !((state._helplessTurns ?? 0) > 0)) {
                await faintFromHunger(10 - rounded, state);
                if (state.program_state.gameover) return;
                next = FAINTED;
            }
        } else if (hero.uhunger < -(100 + 10 * currentAttribute(A_CON, state))) {
            hero.uhs = STARVED;
            await bot();
            await dieFromHunger('starvation', state);
            return;
        }
    }
    if (next === old) return;

    hero.atemp ||= { a: [0, 0, 0, 0, 0, 0] };
    if (next >= WEAK && old < WEAK) hero.atemp.a[A_STR] = -1;
    else if (next < WEAK && old >= WEAK) hero.atemp.a[A_STR] = 0;
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

function hungerMessage(next: number, increasing: boolean, state: PlayingGameState) {
    if (heroIsHallucinating(state)) {
        if (next === HUNGRY) return increasing
            ? 'You are getting the munchies.' : 'You now have a lesser case of the munchies.';
        return increasing ? 'The munchies are interfering with your motor capabilities.'
            : 'You still have the munchies.';
    }
    if (next === HUNGRY) return !increasing ? 'You only feel hungry now.'
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

async function faintFromHunger(duration: number, state: PlayingGameState) {
    await stopHeroOccupation(state);
    await plineWithContinuation('You faint from lack of food.');
    await makeDeaf((state.u.deafTurns ?? 0) + duration, { state, talk: false });
    endVoluntaryMultiTurn(state);
    state._helplessTurns = duration;
    state._helplessReason = 'fainted from lack of food';
    state._helplessDoneMessage = 'You regain consciousness.';
    state._helplessAfter = 'unfaint';
    if (!propertyIsActive('levitation', state)
        && !(state.uarmg || state.u?.uarmg)) {
        await selfTouchPetrifyingWeapons({
            messageStart: 'Falling, you', state, publish: plineWithContinuation,
        });
    }
}

async function dieFromHunger(cause: 'starvation' | 'exhaustion', state: PlayingGameState) {
    await plineWithContinuation(cause === 'starvation'
        ? 'You die from starvation.' : 'You die from hunger and exhaustion.');
    const died = await finishHeroDeath({
        killer: cause, deathCause: `died of ${cause}`, deathVerb: 'starved',
        deathType: STARVING, deathLineShown: true,
    });
    if (!died) await updateHeroHunger(false, { state });
}

// C eat.c:Hear_again()/unfaint(). allmain calls this after the awaited
// recovery message, so neither hearing nor hunger changes before acknowledgment.
export async function regainHearingAfterHelplessness({ state = game }: HungerOptions = {}) {
    if (rn2(2) === 0) {
        await makeDeaf(0, { state, talk: false });
        state.context.botl = true;
    }
}

export async function recoverHeroFromFainting({ state = game }: HungerOptions = {}) {
    requirePlayingGame(state);
    await regainHearingAfterHelplessness({ state });
    if (state.u.uhs > FAINTING) state.u.uhs = FAINTING;
    await stopHeroOccupation(state);
    await bot();
}

// C eat.c:reset_faint() calls unmul("You revive.") only when unfaint
// owns the recovery. A different involuntary delay must remain in place.
export async function resetHeroFaint({ state = game }: HungerOptions = {}) {
    requirePlayingGame(state);
    if (state._helplessAfter !== 'unfaint') return false;
    state.multi = 0;
    state._helplessTurns = 0;
    state._queuedHelplessRecoveryMessage = null;
    await plineWithContinuation('You revive.');
    state.u.usleep = 0;
    state._helplessReason = null;
    state._helplessDoneMessage = null;
    state._helplessAfter = null;
    await recoverHeroFromFainting({ state });
    return true;
}

// C eat.c:init_uhunger(). Hunger weakens temporary, not innate, strength.
export function restoreHeroNutrition(state: GameState = game) {
    requirePlayingGame(state);
    const hero = state.u;
    const before = nearCapacity(state);
    state.context.botl = hero.uhs !== NOT_HUNGRY || (hero.atemp?.a[A_STR] ?? 0) < 0;
    hero.uhunger = 900;
    hero.uhs = NOT_HUNGRY;
    if (!hero.atemp || !(hero.atemp.a[A_STR] < 0)) return '';
    hero.atemp.a[A_STR] = 0;
    const after = nearCapacity(state);
    state._encumbranceLevel = after;
    hero._encumbrance = encumbranceLabel(after);
    return encumbranceMessage(before, after);
}

function ringCostsNutrition(ring: GameObject | null | undefined, slot: Extract<WornPropertySlot, 'uleft' | 'uright'>) {
    if (!ring || ring.otyp === MEAT_RING) return false;
    if ((ring.spe || 0) !== 0 || !OBJECT_CHARGED[ring.otyp]) return true;
    if (ring.otyp !== RIN_PROTECTION) return false;
    const sources = game.u._propertySources?.protection;
    const others = (sources?.worn || []).filter(source => source.slot !== slot);
    if (sources?.invoked || sources?.carried?.length) return false;
    if (!others.length) return true;
    // Two +0 protection rings charge the left ring only.
    return slot === 'uleft' && others.length === 1 && others[0]?.slot === 'uright'
        && game.uright?.otyp === RIN_PROTECTION && !(game.uright.spe || 0);
}

function regenerationCostsNutrition() {
    const hero = game.u;
    const sources = hero._propertySources?.regeneration;
    return hero.regenerationIntrinsic || (hero.regenerationTurns ?? 0) > 0
        || Object.keys(sources?.intrinsic || {}).some(origin => origin !== 'form')
        || sources?.worn?.some(source => source.slot !== 'uwep')
        || !!sources?.carried?.length;
}

function accessoryNutritionCost(accessoryTime: number) {
    const u = game.u;
    let cost = 0;
    if (accessoryTime % 2) {
        if (regenerationCostsNutrition()) cost++;
        if (nearCapacity(game) > 1) cost++;
        return cost;
    }

    // Hunger and Conflict are independent C properties and can both charge.
    if (u.hunger) cost++;
    if (hasNonArtifactConflict(game)) cost++;
    switch (accessoryTime) {
    case 0:
        if (u.slowDigestion
            && game.uright?.otyp !== RIN_SLOW_DIGESTION
            && game.uleft?.otyp !== RIN_SLOW_DIGESTION) cost++;
        break;
    case 4:
        if (ringCostsNutrition(game.uleft, 'uleft')) cost++;
        break;
    case 8:
        if (game.uamul?.otyp !== undefined
            && game.uamul.otyp !== FAKE_AMULET_OF_YENDOR) cost++;
        break;
    case 12:
        if (ringCostsNutrition(game.uright, 'uright')) cost++;
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

export async function getHungry({ invulnerable = false } = {}) {
    const state = requireInitializedGame();
    const u = state.u;
    if (invulnerable || u.invulnerable || game.iflags?.debug_hunger) return null;
    if (!Number.isInteger(u.uhunger)) u.uhunger = 900;
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
