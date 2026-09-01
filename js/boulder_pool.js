// A loose boulder settling into water or lava.
// C ref: do.c boulder_hits_pool().

import {
    Is_waterlevel, LAVAPOOL, MOAT, POOL, ROOM, WATER,
} from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { buryFloorObjectsAt, remove_object } from './mklev.js';
import { monsterInAir, wakeMonstersNear } from './mon.js';
import { finishMonsterLiquidDeath } from './monmove.js';
import { stopAllObjectTimers } from './object_timers.js';
import { d, rn2 } from './rng.js';
import { cansee, vision_note_blocker_change } from './vision.js';

function monsterAt(x, y, state) {
    return state.level?.monsters?.find(monster =>
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y,
    ) || null;
}

function heroBeside(x, y, state) {
    return Math.abs((state.u?.ux ?? 0) - x) <= 1
        && Math.abs((state.u?.uy ?? 0) - y) <= 1;
}

function finishBoulder(boulder) {
    stopAllObjectTimers(boulder);
    boulder.where = 'gone';
    boulder.ox = 0;
    boulder.oy = 0;
}

export async function dropBoulderIntoLiquid(boulder, x, y, state) {
    const location = state.level?.at(x, y);
    if (!location || ![POOL, MOAT, WATER, LAVAPOOL].includes(location.typ))
        return false;
    const lava = location.typ === LAVAPOOL;
    const liquid = lava ? 'lava' : location.typ === MOAT ? 'moat' : 'pool';
    const chance = rn2(10);
    const fills = !Is_waterlevel(state.u?.uz)
        && (lava ? chance === 0 : chance !== 0);

    remove_object(boulder);
    if (fills) {
        location.typ = ROOM;
        location.flags = 0;
        location.icedpool = 0;
        vision_note_blocker_change(x, y);
        const monster = monsterAt(x, y, state);
        if (monster && !monsterInAir(monster, state)) {
            monster.mhp = 0;
            finishMonsterLiquidDeath(monster, state, rn2, [], false);
        }
        state.level.traps = (state.level.traps || []).filter(
            trap => trap.tx !== x || trap.ty !== y,
        );
        buryFloorObjectsAt(x, y, state);
        newsym(x, y);
    }

    if (!state.u?.uinwater && !state.underwater) {
        if (cansee(x, y)) {
            await plineWithContinuation(
                `There is a large splash as the boulder ${
                    fills ? 'fills' : 'falls into'
                } the ${liquid}.`,
            );
        } else if (!state.u?.deaf && !state.deaf) {
            await plineWithContinuation(
                `You hear a${lava ? ' sizzling' : ''} splash.`,
            );
        }
        wakeMonstersNear(x, y, 40, state);
    }

    if (fills && (state.u?.uinwater || state.underwater)
        && state.u?.ux === x && state.u?.uy === y) {
        state.u.uinwater = 0;
        state.underwater = false;
        await plineWithContinuation('You find yourself on dry land again!');
    } else if (lava && heroBeside(x, y, state)) {
        await plineWithContinuation(
            `You are hit by molten lava${
                state.u?.fireResistance ? '.' : '!'
            }`,
        );
        let damage = d(state.u?.fireResistance ? 1 : 3, 6);
        if (state.u?.halfPhysicalDamage || state.u?.half_physical_damage)
            damage = Math.ceil(damage / 2);
        state.u.uhp = Math.max(0, (state.u.uhp ?? 1) - damage);
        if (state.u.uhp <= 0)
            await finishHeroDeath({ killer: 'molten lava' });
    } else if (!fills && cansee(x, y) && state.flags?.verbose !== false) {
        await plineWithContinuation('It sinks without a trace!');
    }

    finishBoulder(boulder);
    return true;
}
