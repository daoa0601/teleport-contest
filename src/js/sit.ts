import { stack_object, delobj } from './invent.js';
import { COIN_CLASS } from './objclass.js';
import { eggTypeFromParent } from './mon.js';
// #sit and the immediate consequences of sitting down.
// C ref: sit.c dosit(), take_gold(), and lay_an_egg(); the hero's carried
// gold helpers (money_cnt/addinv/freeinv/splitobj refs) live here too.

import { objectMaterial, observeObject } from './o_init.js';
import { A_STR, A_WIS, ALTAR, DRAWBRIDGE_DOWN, FOUNTAIN, GRAVE, Is_waterlevel, is_hole, is_pit, LADDER, SINK, SPIKED_PIT, STAIRS, THRONE, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB, FOOT } from './const.js';
import { exerciseAttribute } from './attrib.js';
import { plineWithContinuation, plineWithContinuation as pline, formatFeltMessage } from './pline.js';

import { game, requireLiveGame, requirePlayingGame, requireInitializedGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Trap } from './map_types.js';
import { waterDamageObject, dotrap } from './trap.js';
import { exerciseScrollWisdom, removeCurseEffect } from './read.js';
import type { RemoveCurseOptions, ScrollEffectResult } from './read.js';
import type { HeroTrapOptions } from './trap.js';
import { throneSitEffect } from './throne.js';
import type { ThroneOptions } from './throne.js';
import { morehungry } from './eat.js';
import { heroCanReachFloor } from './engrave.js';
import { burnAwayHeroSlime, heroGoldAmount, loseHeroHp } from './hack.js';
import { dropObjectAtHero } from './do.js';
import { useUpFloorObject } from './invent.js';
import { removeWornHeroItem } from './steal.js';
import { markJustPicked } from './pickup.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { mksobj, set_corpsenm, objectWeight, splitObjectStack, unlinkObject, createObjectBase, nextIdent } from './mkobj.js';
import { MONSTER_SYMBOL } from './monster_data.js';
import { SPE_REMOVE_CURSE, CHEST, CORPSE, CREAM_PIE, EGG, GOLD_PIECE, LARGE_BOX, TOWEL, WATER_WALKING_BOOTS, oc_nutrition } from './object_data.js';
import { objectCombatName, definiteName } from './objnam.js';
import { displayLiquidName, monsterName } from './do_name.js';
import {
    monsterPossessive, lays_eggs, monsterIsAmorphous, monsterIsHumanoid, monsterIsSlithy,
    eggs_in_water,
} from './mondata.js';
import { surfaceName } from './dungeon.js';
import { isIceAt, isLavaAt, isPoolAt } from './dbridge.js';
import { heroFormHidesWithoutCover, heroMonsterForm, heroFormSticks, body_part } from './polyself.js';
import { altarWrath } from './pray.js';
import { d, rnd, rn2 } from './rng.js';
import { splitSittingGremlin } from './fountain.js';

const CLOTH = 6;

const S_DRAGON = 30;

const PM_GREMLIN = 40;
const PM_TRAPPER = 99;
const PM_FIRE_ELEMENTAL = 155;
const PM_GIANT_EEL = 319;
const PM_ELECTRIC_EEL = 320;
const PM_SALAMANDER = 329;

// Part of C sit.c:dosit(): choose the hero's sitting anatomy.
function formIsHumanoid() {
    return heroMonsterForm(game) == null
        || monsterIsHumanoid(heroMonsterForm(game) ?? -1);
}

// Port only: read object quantities from the runtime representation.
function objectQuantity(object: GameObject): number {
    return object?.quan ?? object?.quantity ?? 1;
}

// Part of C sit.c:dosit(), sit.c:lay_an_egg(): check the current form's aquatic egg laying.
function waterEggLayer() {
    const form = heroMonsterForm(game);
    return form !== null && eggs_in_water(form);
}

// The hero's carried gold is the COIN_CLASS object in inventory.
// C refs: hack.c money_cnt(), invent.c addinv()/freeinv()/splitobj().

type GoldInventoryState = Pick<GameState, 'inventory' | 'uquiver' | 'u' | 'moves' | 'context'>;

interface GoldAddition {
    object: GameObject | null;
    merged: boolean;
}

// C sit.c:take_gold(). Contained coins are not exposed to the effect.
export async function takeHeroGold(state: GameState = game): Promise<void> {
    let lostMoney = false;
    for (const object of [...state.inventory]) {
        if (object.oclass !== COIN_CLASS) continue;
        lostMoney = true;
        await removeWornHeroItem(object, state);
        await delobj(object, state);
    }
    await pline(lostMoney
        ? 'You notice you have no gold!'
        : formatFeltMessage('a strange sensation.', state));
    if (lostMoney) state.context.botl = true;
}

// Port only: read a nonnegative carried coin quantity.
export function heroGoldQuantity(object: GameObject | null | undefined): number {
    return Math.max(0, Math.trunc(
        object?.quan ?? object?.quantity ?? 0,
    ));
}

// Part of C mkobj.c:weight(): compute coin-stack weight.
function coinWeight(amount: number): number {
    return Math.max(1, Math.trunc((amount + 50) / 100));
}

// Port only: synchronize the runtime fields of a coin stack.
function normalizeGoldObject(object: GameObject, amount = heroGoldQuantity(object)): GameObject {
    object.otyp = GOLD_PIECE;
    object.oclass = COIN_CLASS;
    object.invlet = '$';
    object.name = 'gold piece';
    object.plural = 'gold pieces';
    object.quan = object.quantity = amount;
    object.owt = coinWeight(amount);
    return object;
}

// Port only: find the hero's coin stack in the inventory array.
export function heroGoldObject(state: Pick<GameState, 'inventory'>): GameObject | null {
    return (state?.inventory || []).find(object =>
        object?.otyp === GOLD_PIECE || object?.oclass === COIN_CLASS) || null;
}

// Port only: merge coin stacks in the runtime inventory representation.
export function addHeroGoldObject(state: GoldInventoryState, incoming: GameObject | null | undefined): GoldAddition {
    if (!incoming) return { object: heroGoldObject(state), merged: false };
    const amount = heroGoldQuantity(incoming);
    if (!amount) return { object: heroGoldObject(state), merged: false };
    state.context.botl = true;
    const existing = heroGoldObject(state);
    if (existing && existing !== incoming) {
        const total = heroGoldQuantity(existing) + amount;
        normalizeGoldObject(existing, total);
        incoming.where = 'gone';
        incoming.ox = incoming.oy = 0;
        incoming.quan = incoming.quantity = 0;
        return { object: markJustPicked(existing), merged: true };
    }
    normalizeGoldObject(incoming, amount);
    incoming.where = 'inventory';
    incoming.container = null;
    incoming.ox = incoming.oy = 0;
    incoming.owornmask = incoming.owornmask ?? 0;
    state.inventory ||= [];
    if (!state.inventory.includes(incoming)) state.inventory.unshift(incoming);
    return { object: markJustPicked(incoming), merged: false };
}

// Port only: update or construct the hero's runtime coin stack.
export function setHeroGoldAmount(state: GoldInventoryState, amount: number): GameObject | null {
    amount = Math.max(0, Math.trunc(amount ?? 0));
    let object = heroGoldObject(state);
    if (amount !== heroGoldAmount(state)) state.context.botl = true;
    if (!amount) {
        if (object) {
            state.inventory = (state.inventory || [])
                .filter(candidate => candidate !== object);
            if (state.uquiver === object) state.uquiver = null;
            if (state.u?.uquiver === object) state.u.uquiver = null;
            object.ready = false;
            object.owornmask = 0;
            object.where = 'gone';
            object.quan = object.quantity = 0;
        }
        return null;
    }
    if (!object) {
        object = normalizeGoldObject({
            ...createObjectBase(GOLD_PIECE, nextIdent(), state.moves),
            where: 'inventory',
            worn: false,
            wielded: false,
            alternate: false,
            ready: false,
            owornmask: 0,
            contents: [],
            objectTimers: [],
            timed: 0,
        }, amount);
        state.inventory ||= [];
        state.inventory.unshift(object);
    }
    normalizeGoldObject(object, amount);
    return object;
}

// Port only: detach a requested coin quantity through shared ownership operations.
export function detachHeroGold(state: GameState, requested: number | null = null): GameObject | null {
    const object = heroGoldObject(state);
    if (!object) return null;
    const amount = heroGoldQuantity(object);
    const count = requested === null
        ? amount : Math.max(1, Math.min(Math.trunc(requested), amount));
    const detached = count < amount ? splitObjectStack(object, count, state) : object;
    if (!detached) throw new Error('A gold stack must yield the requested coins.');
    unlinkObject(detached, state);
    state.context.botl = true;
    if (state.uquiver === detached) state.uquiver = null;
    if (state.u?.uquiver === detached) state.u.uquiver = null;
    detached.ready = false;
    detached.owornmask = 0;
    return detached;
}

// C sit.c:lay_an_egg().
async function layEgg(): Promise<boolean> {
    const form = heroMonsterForm(game);
    if (form === null) throw new Error('Laying an egg requires an egg-laying monster form.');
    if (game.flags?.female !== true) {
        await pline(`${heroIsHallucinating()
            ? 'You may think you are a platypus, but a male still'
            : 'Males'} can't lay eggs!`);
        return false;
    }
    const nutrition = oc_nutrition(EGG) ?? 0;
    if ((game.u?.uhunger ?? 0) < nutrition) {
        await pline("You don't have enough energy to lay an egg.");
        return false;
    }
    if (waterEggLayer()) {
        if (!(game.underwater || game.u?.uinwater
            || Is_waterlevel(game.u.uz))) {
            await pline('A splash tetra you are not.');
            return false;
        }
        if (form === PM_GIANT_EEL || form === PM_ELECTRIC_EEL) {
            await pline('You yearn for the Sargasso Sea.');
            return false;
        }
    }

    const egg = await mksobj(EGG, false, false);
    egg.spe = 1;
    egg.quan = egg.quantity = 1;
    set_corpsenm(egg, eggTypeFromParent(form));
    egg.known = true;
    egg.owt = objectWeight(egg);
    observeObject(egg);
    await pline(`You ${waterEggLayer() ? 'spawn' : 'lay'} an egg.`);
    await dropObjectAtHero(egg);
    if (egg.where === 'floor') await stack_object(egg);
    await morehungry(nutrition);
    return !game.program_state.gameover;
}

// Part of C sit.c:dosit(): sitting on the floor's top object.
async function sitOnObject(object: GameObject): Promise<void> {
    if (MONSTER_SYMBOL[heroMonsterForm(game) ?? -1] === S_DRAGON
        && object.oclass === COIN_CLASS) {
        const wealth = objectQuantity(object) + heroGoldAmount(game);
        const meager = wealth < (game.u?.ulevel ?? 1) * 1000 ? 'meager ' : '';
        await pline(`You coil up around your ${meager}hoard.`);
        return;
    }
    if (object.otyp === TOWEL) {
        await pline("It's probably not a good time for a picnic...");
        return;
    }

    const name = definiteName(objectCombatName(object, { includeCorpseSpecies: false }));
    await pline(monsterIsSlithy(heroMonsterForm(game) ?? -1)
        ? `You coil up around ${name}.`
        : `You sit on ${name}.`);
    if (object.otyp === CORPSE
        && monsterIsAmorphous({ mnum: object.corpsenm ?? -1 })) {
        await pline("It's squishy...");
    } else if (object.otyp === CREAM_PIE) {
        if (!heroIsDeaf()) await pline('Squelch!');
        await useUpFloorObject(object, object.quan);
    } else if (object.otyp !== LARGE_BOX && object.otyp !== CHEST
        && objectMaterial(object.otyp) !== CLOTH) {
        await pline("It's not very comfortable...");
    }
}

// Part of C sit.c:dosit(): sitting while already held by a trap.
// Returns true when the hero died.
async function sitWhileTrapped(trap: Trap | null): Promise<boolean> {
    const game = requireInitializedGame();
    const u = game.u;
    if (u.utrap === undefined) throw new Error('Sitting while trapped requires an active trap duration.');
    await exerciseAttribute(A_WIS, false);
    if (u.utraptype === TT_BEARTRAP) {
        await pline(`You can't sit down with your ${body_part(FOOT)} in the bear trap.`);
        u.utrap++;
    } else if (u.utraptype === TT_PIT) {
        if (trap?.ttyp === SPIKED_PIT) {
            await pline('You sit down on a spike.  Ouch!');
            const damage = u.halfPhysicalDamage
                ? rn2(2) : 1;
            if (await loseHeroHp(damage, 'sitting on an iron spike',
                { deathCause: 'killed by sitting on an iron spike' })) return true;
            await exerciseAttribute(A_STR, false);
        } else {
            await pline('You sit down in the pit.');
        }
        u.utrap += rn2(5);
    } else if (u.utraptype === TT_WEB) {
        await pline('You sit in the spider web and get entangled further!');
        u.utrap += 5 + rn2(10);
    } else if (u.utraptype === TT_LAVA) {
        await pline(`You sit in the ${displayLiquidName('lava')}!`);
        await burnAwayHeroSlime(game, pline);
        u.utrap += rnd(4);
        if (await loseHeroHp(d(2, 10), 'sitting in lava',
            { deathCause: 'killed by sitting in lava' })) return true;
    } else if (u.utraptype === TT_INFLOOR
        || u.utraptype === TT_BURIEDBALL) {
        await pline("You can't maneuver to sit!");
        u.utrap++;
    }
    return false;
}

// Part of C sit.c:dosit(): water exposure while sitting.
async function sitInWater() {
    await pline(`You sit in the ${displayLiquidName('water')}.`);
    if (heroMonsterForm(game) === PM_GREMLIN) {
        await splitSittingGremlin();
        return;
    }

    const armor = game.uarm || game.u?.uarm;
    const boots = game.uarmf || game.u?.uarmf;
    if (rn2(10) === 0 && armor)
        await waterDamageObject(armor, [], game,
            { force: true, description: 'armor', publish: pline });
    if (rn2(10) === 0 && boots && boots.otyp !== WATER_WALKING_BOOTS) {
        // sit.c passes uarm here too; preserve that behavior from the pinned
        // source rather than silently changing which item gets wet.
        await waterDamageObject(armor, [], game,
            { force: true, description: 'armor', publish: pline });
    }
}

// Part of C sit.c:dosit(): recognize forms comfortable sitting in lava.
function formLikesLava() {
    const form = heroMonsterForm(game);
    return form === PM_FIRE_ELEMENTAL || form === PM_SALAMANDER;
}

// C sit.c:dosit()
export async function dosit({
    finishTeleport = null,
    gotoLevel = null,
    chooseTeleportDestination = null,
}: Pick<HeroTrapOptions, 'finishTeleport' | 'gotoLevel'> & ThroneOptions = {}): Promise<void> {
    const game = requireInitializedGame();
    const u = game.u;
    const x = u?.ux;
    const y = u?.uy;
    const location = game.level.requireAt(x, y);
    const typ = location.typ;
    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y) || null;

    if (u?.usteed) {
        await pline(`You are already sitting on ${monsterName(u.usteed)}.`);
        game.context.move = 0;
        return;
    }
    if (u?.uundetected && heroFormHidesWithoutCover(game)
        && heroMonsterForm(game) !== PM_TRAPPER) u.uundetected = 0;

    if (!heroCanReachFloor(game)) {
        if (u?.uswallow) await pline('There are no seats in here!');
        else if (u?.levitating || game.levitating)
            await pline('You tumble in place.');
        else await pline('You are sitting on air.');
        game.context.move = 0;
        return;
    }
    if (u?.ustuck && !heroFormSticks(game)) {
        const holder = u.ustuck;
        const humanoid = monsterIsHumanoid(holder.mnum);
        const subject = monsterName(holder, { capitalized: true });
        await pline(humanoid
            ? `${subject} won't offer ${monsterPossessive(holder)} lap.`
            : `${subject} has no lap.`);
        game.context.move = 0;
        return;
    }

    const onPool = isPoolAt(x, y);
    if ((onPool && !(game.underwater || u?.uinwater))
        || (heroMonsterForm(game) === PM_GREMLIN
            && (typ === FOUNTAIN || onPool))) {
        await sitInWater();
        game.context.move = 1;
        return;
    }

    const object = game.level?.objects?.[x]?.[y]?.[0];
    const atPitEdge = trap?.tseen && (is_hole(trap.ttyp)
        || is_pit(trap.ttyp) && !(u.utrap && u.utraptype === TT_PIT));
    if (object && !atPitEdge) {
        await sitOnObject(object);
    } else if (trap || (u?.utrap && (u.utraptype ?? 0) >= TT_LAVA)) {
        if (u?.utrap) {
            if (await sitWhileTrapped(trap)) return;
        } else {
            await pline(`You ${u?.flying || game.flying ? 'land' : 'sit down'}.`);
            const result = await dotrap(trap, {
                finishTeleport,
                gotoLevel,
                viaSitting: true,
            });
            if (result.died) return;
        }
    } else if ((game.underwater || u?.uinwater
        || Is_waterlevel(game.u.uz)) && !waterEggLayer()) {
        await pline(Is_waterlevel(game.u.uz)
            ? 'There are no cushions floating nearby.'
            : 'You sit down on the muddy bottom.');
    } else if (onPool && !waterEggLayer()) {
        await sitInWater();
    } else if (typ === SINK) {
        await pline('You sit on the sink.');
        await pline(`Your ${formIsHumanoid() ? 'rump' : 'underside'} gets wet.`);
    } else if (typ === ALTAR) {
        await pline('You sit on the altar.');
        await altarWrath(x, y);
    } else if (typ === GRAVE) {
        await pline('You sit on the grave.');
    } else if (typ === STAIRS) {
        await pline('You sit on the stairs.');
    } else if (typ === LADDER) {
        await pline('You sit on the ladder.');
    } else if (isLavaAt(x, y)) {
        await pline(`You sit on the ${displayLiquidName('lava')}.`);
        await burnAwayHeroSlime(game, pline);
        if (formLikesLava()) {
            await pline(`The ${displayLiquidName('lava')} feels warm.`);
        } else {
            await pline(`The ${displayLiquidName('lava')} burns you!`);
            const dice = u?.fireResistance ? 2 : 10;
            if (await loseHeroHp(d(dice, 10), 'sitting on lava',
                { deathCause: 'killed by sitting on lava' })) return;
        }
    } else if (isIceAt(x, y)) {
        await pline('You sit on the ice.');
        if (!u?.coldResistance)
            await pline('The ice feels cold.');
    } else if (typ === DRAWBRIDGE_DOWN) {
        await pline('You sit on the drawbridge.');
    } else if (typ === THRONE) {
        await pline('You sit on the opulent throne.');
        await throneSitEffect({ gotoLevel, chooseTeleportDestination });
    } else if (lays_eggs(heroMonsterForm(game) ?? -1)) {
        if (!await layEgg()) {
            game.context.move = 0;
            return;
        }
    } else {
        await pline(`Having fun sitting on the ${surfaceName(x, y)}?`);
    }
    game.context.move = 1;
}

// C sit.c:special_throne_effect(): its case 10 sends seffects() a zeroobj
// SPE_REMOVE_CURSE spellbook with temporary confusion, so the fake spell
// has no inventory identity or creation effects but still passes through
// seffects' Wisdom gain. trap.c:4440's magic trap uses the same entry.
export async function applyRemoveCurseSpell({
    state = game, blessed = false, cursed = false,
}: Pick<RemoveCurseOptions, 'state' | 'blessed' | 'cursed'> = {}): Promise<ScrollEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    await exerciseScrollWisdom(SPE_REMOVE_CURSE, state);
    await removeCurseEffect({
        source: { otyp: SPE_REMOVE_CURSE, blessed, cursed },
        state,
        publish: plineWithContinuation,
    });
    return { known: false, consumed: false, heroDied: !!state.program_state.gameover };
}
