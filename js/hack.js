// Effects of entering the hero's current square.
// C ref: hack.c pooleffects() and trap.c drown().

import {
    D_CLOSED, D_LOCKED, DOOR, IS_LAVA, IS_OBSTRUCTED, IS_POOL, STONE,
    WATER,
} from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { finishOrdinaryDeath } from './end.js';
import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { waterDamageChain } from './trap.js';
import { vision_recalc } from './vision.js';

const CRAWL_DX = [-1, -1, 0, 1, 1, 1, 0, -1];
const CRAWL_DY = [0, -1, -1, -1, 0, 1, 1, 1];

function squareBlocksHero(state, x, y) {
    const location = state.level?.at?.(x, y);
    if (!location || location.typ === STONE
        || IS_OBSTRUCTED(location.typ)) return true;
    return location.typ === DOOR
        && !!(location.doormask & (D_CLOSED | D_LOCKED));
}

function crawlDestination(state, x, y, random) {
    const directions = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let remaining = directions.length; remaining > 0; remaining--) {
        const index = random(remaining);
        [directions[index], directions[remaining - 1]] = [
            directions[remaining - 1], directions[index],
        ];
    }

    for (const direction of directions) {
        const candidate = {
            x: x + CRAWL_DX[direction],
            y: y + CRAWL_DY[direction],
        };
        const location = state.level?.at?.(candidate.x, candidate.y);
        if (!location || squareBlocksHero(state, candidate.x, candidate.y)
            || IS_POOL(location.typ) || IS_LAVA(location.typ)) continue;
        const occupied = state.level?.monsters?.some(monster =>
            !monster.dead && (monster.mhp ?? 1) > 0
            && monster.mx === candidate.x && monster.my === candidate.y);
        if (!occupied) return candidate;
    }
    return null;
}

function heroFloatsAboveWater(state) {
    const u = state.u || {};
    return !!(u.levitating || u.levitation || u.flying || u.flight
        || u.waterWalking || u.water_walking);
}

function heroCanLiveUnderwater(state) {
    const u = state.u || {};
    return !!(u.amphibious || u.swimming || u.breathless);
}

export async function heroEntersPool({
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    die = finishOrdinaryDeath,
} = {}) {
    const u = state.u;
    const x = u?.ux;
    const y = u?.uy;
    const location = state.level?.at?.(x, y);
    if (!u || !location || !IS_POOL(location.typ)
        || u.ustuck || heroFloatsAboveWater(state)) return null;

    const waterWall = location.typ === WATER;
    if (!u.uinwater) {
        await publish(waterWall
            ? 'You plunge into the wall of water!'
            : 'You fall into the pool of water!');
        if (!u.swimming && !waterWall)
            await publish('You sink like a rock.');
    }

    const damageMessages = [];
    await waterDamageChain(state.inventory || [], damageMessages, state);
    for (const message of damageMessages) await publish(message);

    if (heroCanLiveUnderwater(state)) {
        if (u.amphibious || u.breathless)
            await publish("But you aren't drowning.");
        u.uinwater = 1;
        vision_recalc(1);
        return { entered: true, moved: false, died: false };
    }

    const destination = crawlDestination(state, x, y, random);
    if (destination) {
        await publish('You try to crawl out of the water.');
        await publish('Pheew!  That was close.');
        u.ux0 = x;
        u.uy0 = y;
        u.ux = destination.x;
        u.uy = destination.y;
        newsym(x, y);
        vision_recalc(1);
        newsym(destination.x, destination.y);
        return {
            entered: true, moved: true, died: false,
            from: { x, y }, to: destination,
        };
    }

    u.uinwater = 1;
    await publish('You drown.');
    u.uhp = 0;
    await die({
        killer: 'deep water', possessionAnswer: 'n', deathVerb: 'drowned',
    });
    if (state.context) state.context.move = 0;
    return { entered: true, moved: false, died: true };
}
