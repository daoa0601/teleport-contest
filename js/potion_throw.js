// Map flight and impact for potions thrown by the hero.
// C refs: dothrow.c throwit(), throwit_mon_hit(), thitmonst(), tmiss(),
// breaktest(), breakmsg(), breakobj(); zap.c bhit().

import { currentAttribute } from './attrib.js';
import { A_DEX } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { dist2 } from './hacklib.js';
import { hurtleHero } from './hero_hurtle.js';
import { monsterTypeName } from './monster_data.js';
import { POT_OIL } from './object_data.js';
import {
    hitMonsterWithSupportedPotion, potionImpactObjectName,
    SUPPORTED_MONSTER_POTION_TYPES,
} from './potion_hit.js';
import { rn2, rnd } from './rng.js';
import {
    detachThrownUnit, finishHeroThrownObjectLanding, flyHeroThrownObject,
    heroThrowTrajectory,
} from './thrown_object.js';
import { applyLowStaminaThrow, applyThrowSlip } from './throw_state.js';
import { cansee } from './vision.js';
import { nearCapacity } from './weight.js';

const POTION_CLASS = 8;

function containsUnpaidObject(object) {
    if (!object) return false;
    if (object.unpaid) return true;
    return (object.contents || []).some(containsUnpaidObject);
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

function canResolveMapPotionThrow({
    state, item, objectClass, selectedQuantity, dx, dy,
}) {
    if (state.u?.uswallow || objectClass !== POTION_CLASS
        || !SUPPORTED_MONSTER_POTION_TYPES.has(item?.otyp)
        || !Number.isInteger(selectedQuantity) || selectedQuantity < 1
        || !Number.isInteger(dx) || !Number.isInteger(dy)) return false;

    // Leave unsupported inventory and hero states untouched.  This check runs
    // before the potion leaves inventory and before the throw uses randomness.
    const burningOil = item.otyp === POT_OIL && item.lamplit
        && activeTimerCount(item) > 0;
    if (((item.lamplit || activeTimerCount(item) > 0) && !burningOil)
        || item.oartifact || item.artifact
        || containsUnpaidObject(item)
        || (item.contents?.length ?? 0) > 0
        || state.uball || state.u?.uball || state.uchain || state.u?.uchain
        || state.u?.usteed || state._shopRooms?.current
        || (state._encumbranceLevel ?? nearCapacity(state)) > 0) return false;

    return true;
}

function indefiniteObjectName(object, state) {
    const noun = potionImpactObjectName(object, state);
    return `${/^[aeiou]/iu.test(noun) ? 'An' : 'A'} ${noun}`;
}

function distanceFromHero(state, x, y) {
    return dist2(state.u.ux, state.u.uy, x, y);
}

export async function resolveMapPotionThrow({
    state = game,
    item,
    objectClass,
    selectedQuantity,
    splitObjectId,
    dx,
    dy,
    captureFlight,
    wakeMonster,
    wakeNearby,
    finishKill,
    publish = plineWithContinuation,
}) {
    if (!canResolveMapPotionThrow({
        state, item, objectClass, selectedQuantity, dx, dy,
    })) return false;

    const thrown = detachThrownUnit(
        state, item, selectedQuantity, splitObjectId,
    );

    // In C, slipping or low stamina changes the direction after the potion
    // leaves inventory and before it begins moving across the map.
    await applyThrowSlip({ state, object: thrown, publish });
    await applyLowStaminaThrow({ state, object: thrown, publish });

    if (state.u?.dz) {
        await publish(
            `${indefiniteObjectName(thrown, state)} hits the floor.`,
        );
        await finishHeroThrownObjectLanding({
            state,
            object: thrown,
            x: state.u.ux,
            y: state.u.uy,
            publish,
        });
        state.context.move = 1;
        return true;
    }

    const actualDx = state.u?.dx ?? dx;
    const actualDy = state.u?.dy ?? dy;
    const underwater = state.underwater || state.u?.uinwater;
    const trajectory = underwater
        ? { range: 1, recoil: 0 }
        : heroThrowTrajectory(thrown, state);
    const flight = await flyHeroThrownObject({
        state,
        object: thrown,
        dx: actualDx,
        dy: actualDy,
        range: trajectory.range,
        captureFlight,
        publish,
    });
    if (trajectory.recoil) {
        await hurtleHero(
            -actualDx, -actualDy, trajectory.recoil, { verbose: true },
        );
    }
    if (flight.destroyed) {
        state.context.move = 1;
        return true;
    }

    if (flight.contact) {
        rnd(20); // thitmonst() computes this before the potion class test
        if (currentAttribute(A_DEX, state) > rnd(25)) {
            await hitMonsterWithSupportedPotion({
                state,
                monster: flight.contact,
                potion: thrown,
                wakeMonster,
                wakeNearby,
                finishKill,
                publish,
                targetVisible: cansee(
                    flight.contact.mx, flight.contact.my,
                ),
                resolveVapor: true,
                distance: distanceFromHero(
                    state, flight.contact.mx, flight.contact.my,
                ),
            });
            state.context.move = 1;
            return true;
        }

        const visible = cansee(flight.contact.mx, flight.contact.my);
        await publish(visible
            ? `The ${potionImpactObjectName(thrown, state)} misses ${
                monsterName(flight.contact)
            }.`
            : `The ${potionImpactObjectName(thrown, state)} misses.`);
        if (rn2(3) === 0) await wakeMonster?.(flight.contact);
    }

    await finishHeroThrownObjectLanding({
        state,
        object: thrown,
        x: flight.x,
        y: flight.y,
        publish,
    });
    state.context.move = 1;
    return true;
}
