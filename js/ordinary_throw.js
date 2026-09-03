// Hero throws which do not have a class-specific effect.
// C refs: dothrow.c throwit() and thitmonst(), zap.c bhit().

import { game } from './gstate.js';
import { hitMonsterWithThrownObject } from './hero_ranged_attack.js';
import { hurtleHero } from './hero_hurtle.js';
import {
    captureThrownObjectFlight, detachThrownUnit,
    finishHeroThrownObjectLanding, flyHeroThrownObject,
    heroThrowTrajectory,
} from './thrown_object.js';

export async function throwOrdinaryObject({
    state = game,
    item,
    quantity,
    splitObjectId = null,
    dx,
    dy,
}) {
    const thrown = detachThrownUnit(
        state, item, quantity, splitObjectId,
    );
    const trajectory = heroThrowTrajectory(thrown, state);
    const flight = await flyHeroThrownObject({
        state,
        object: thrown,
        dx,
        dy,
        range: trajectory.range,
        captureFlight: captureThrownObjectFlight,
    });

    if (trajectory.recoil) {
        await hurtleHero(-dx, -dy, trajectory.recoil, { verbose: true });
    }
    if (flight.destroyed || flight.migrated) return flight;

    if (flight.contact) {
        const contact = await hitMonsterWithThrownObject(
            flight.contact, thrown, { state },
        );
        if (contact.consumed) return { ...flight, consumed: true };
    }

    const landed = await finishHeroThrownObjectLanding({
        state,
        object: thrown,
        x: flight.x,
        y: flight.y,
        contactedMonster: !!flight.contact,
    });
    return { ...flight, object: thrown, landed };
}
