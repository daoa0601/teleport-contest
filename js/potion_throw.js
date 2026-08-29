// potion_throw.js — Source-shaped ordinary map flight for thrown potions.
// C refs: dothrow.c throwit(), throwit_mon_hit(), thitmonst(), tmiss(),
// breaktest(), breakmsg(), breakobj(); zap.c bhit().

import { currentAttribute } from './attrib.js';
import { CORR, DOOR, Is_airlevel, ROOM, W_SADDLE } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { place_object, stack_object } from './mklev.js';
import {
    MONSTER_GENO, monsterTypeName,
} from './monster_data.js';
import { OBJECT_WEIGHT } from './object_data.js';
import {
    applySupportedPotionVapor, destroyPotionIdentity,
    hitMonsterWithSupportedPotion, potionImpactObjectName,
    SUPPORTED_MONSTER_POTION_TYPES,
} from './potion_hit.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { objectTypeKnown } from './shk.js';
import { detachThrownUnit } from './thrown_object.js';
import { cansee } from './vision.js';
import { nearCapacity } from './weight.js';

const POTION_CLASS = 8;
const G_UNIQ = 0x1000;
const SUPPORTED_PATH_TYPES = new Set([ROOM, CORR, DOOR]);
const EQUIPMENT_SLOTS = [
    'uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmu', 'uarmc', 'uarmh',
    'uarmg', 'uarmf', 'uarms', 'uleft', 'uright', 'uamul', 'ublindf',
];

function containsUnpaidObject(object) {
    if (!object) return false;
    if (object.unpaid) return true;
    return (object.contents || []).some(containsUnpaidObject);
}

function equipped(state, item) {
    return !!(item.owornmask ?? 0) || EQUIPMENT_SLOTS.some(slot =>
        state[slot] === item || state.u?.[slot] === item);
}

function activeTimerCount(item) {
    return Math.max(
        item.timed ?? 0,
        Array.isArray(item.objectTimers) ? item.objectTimers.length : 0,
    );
}

function monsterName(monster) {
    return monster.name
        || `the ${monsterTypeName(monster.mnum, !!monster.female)}`;
}

function targetIsOrdinary(monster) {
    return monster && !monster.dead && (monster.mhp ?? 1) > 0
        && !monster.isshk && !monster.ispriest && !monster.isminion
        && !monster.iswiz && !monster.isgd && !monster.mleashed
        && !monster.mtrapped && !monster.m_ap_type && !monster.mundetected
        && !monster.wormno && !(monster.mtame ?? 0) && !monster.mpeaceful
        && !((monster.misc_worn_check ?? 0) & W_SADDLE)
        && !monster.saddle
        && !((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ);
}

function pathTrapAt(state, x, y) {
    return state.level?.traps?.some(trap =>
        (trap.tx ?? trap.x) === x && (trap.ty ?? trap.y) === y);
}

function traceOrdinaryPath(state, dx, dy, range, blocksMove) {
    let x = state.u.ux;
    let y = state.u.uy;
    const path = [];
    let contact = null;
    for (let distance = 0; distance < range; distance++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!dx && !dy) break;
        if (blocksMove(nx, ny)) break;
        const typ = state.level?.at?.(nx, ny)?.typ;
        if (!SUPPORTED_PATH_TYPES.has(typ) || pathTrapAt(state, nx, ny))
            return null;
        x = nx;
        y = ny;
        path.push({ x, y });
        contact = state.level?.monsters?.find(monster =>
            !monster.dead && (monster.mhp ?? 1) > 0
            && monster.mx === x && monster.my === y) || null;
        if (contact) break;
    }
    return { x, y, path, contact };
}

function ordinaryEligibility({
    state, item, objectClass, selectedQuantity, dx, dy, blocksMove,
}) {
    if (state.u?.uswallow || objectClass !== POTION_CLASS
        || !SUPPORTED_MONSTER_POTION_TYPES.has(item?.otyp)
        || !Number.isInteger(selectedQuantity) || selectedQuantity < 1
        || !Number.isInteger(dx) || !Number.isInteger(dy)) return null;

    // These branches change flight, billing, object lifecycle, or naming.
    // Reject them before splitobj()/freeinv() and before any throw RNG.
    if (item.greased || item.lamplit
        || item.oartifact || item.artifact || equipped(state, item)
        || containsUnpaidObject(item) || activeTimerCount(item) > 0
        || (item.contents?.length ?? 0) > 0
        || (item.dknown !== false && !objectTypeKnown(item, state))
        || heroIsBlind(state)
        || state.underwater || state.u?.uinwater
        || state.u?.levitating || state.u?.levitation || state.levitating
        || Is_airlevel(state.u?.uz)
        || state.uball || state.u?.uball || state.uchain || state.u?.uchain
        || state.u?.usteed || state._shopRooms?.current
        || (state._encumbranceLevel ?? nearCapacity(state)) > 0) return null;

    const weight = OBJECT_WEIGHT[item.otyp]
        ?? Math.max(1, Math.trunc((item.owt ?? 1) / selectedQuantity));
    const range = Math.max(
        1,
        Math.trunc(currentAttribute(0, state) / 2)
            - Math.trunc(weight / 40),
    );
    const flight = traceOrdinaryPath(state, dx, dy, range, blocksMove);
    if (!flight || (flight.contact && !targetIsOrdinary(flight.contact)))
        return null;
    return { ...flight, range };
}

function indefiniteObjectName(object, state) {
    const noun = potionImpactObjectName(object, state);
    return `${/^[aeiou]/iu.test(noun) ? 'An' : 'A'} ${noun}`;
}

function distanceFromHero(state, x, y) {
    return Math.max(Math.abs(x - state.u.ux), Math.abs(y - state.u.uy));
}

async function settlePotionAfterMiss({
    state, potion, x, y, publish,
}) {
    // breaktest()->obj_resists(obj, 1, 99): ordinary potions survive one
    // percent of hard-floor arrivals and otherwise break unconditionally.
    if (rn2(100) < 1) {
        place_object(potion, x, y);
        stack_object(potion, state);
        newsym(x, y);
        return { broke: false };
    }

    await publish(`${indefiniteObjectName(potion, state)} shatters!`);
    if (distanceFromHero(state, x, y) <= 1) {
        await publish('You smell a peculiar odor...');
        await applySupportedPotionVapor({ state, potion, publish });
    }
    destroyPotionIdentity(potion);
    return { broke: true };
}

export async function resolveMapPotionThrow({
    state = game,
    item,
    objectClass,
    selectedQuantity,
    splitObjectId,
    dx,
    dy,
    blocksMove,
    captureFlight,
    wakeMonster,
    publish = plineWithContinuation,
}) {
    const eligible = ordinaryEligibility({
        state, item, objectClass, selectedQuantity, dx, dy, blocksMove,
    });
    if (!eligible) return false;

    const thrown = detachThrownUnit(
        state, item, selectedQuantity, splitObjectId,
    );

    // dothrow.c:throwit() consumes the cursed/greased slip gate after
    // splitobj()/freeinv() and before bhit() flight.  An ungreased potion is
    // neither launcher ammunition nor throwing_weapon(), so even a zero gate
    // sets slipok false and cannot reroll direction.  Greased potions remain
    // excluded by ordinaryEligibility() because they do reroll two axes.
    if (thrown.cursed && (dx || dy)) rn2(7);

    await captureFlight?.(thrown, eligible.path);

    if (eligible.contact) {
        rnd(20); // thitmonst() computes this before the potion class test
        if (currentAttribute(1, state) > rnd(25)) {
            await hitMonsterWithSupportedPotion({
                state,
                monster: eligible.contact,
                potion: thrown,
                wakeMonster,
                publish,
                targetVisible: cansee(
                    eligible.contact.mx, eligible.contact.my,
                ),
                resolveVapor: true,
                distance: distanceFromHero(
                    state, eligible.contact.mx, eligible.contact.my,
                ),
            });
            state.context.move = 1;
            return true;
        }

        const visible = cansee(eligible.contact.mx, eligible.contact.my);
        await publish(visible
            ? `The ${potionImpactObjectName(thrown, state)} misses ${
                monsterName(eligible.contact)
            }.`
            : `The ${potionImpactObjectName(thrown, state)} misses.`);
        if (rn2(3) === 0) await wakeMonster?.(eligible.contact);
    }

    await settlePotionAfterMiss({
        state,
        potion: thrown,
        x: eligible.x,
        y: eligible.y,
        publish,
    });
    state.context.move = 1;
    return true;
}
