// glob.js — Source-owned SHRINK_GLOB callback for the ordinary floor carrier.
// C refs: mkobj.c start_glob_timeout()/shrink_glob().

import { newsym } from './display.js';
import { ICE } from './const.js';
import { game } from './gstate.js';
import { remove_object } from './mklev.js';
import {
    GLOB_OF_BLACK_PUDDING, GLOB_OF_GRAY_OOZE, OBJECT_NAMES,
} from './object_data.js';
import {
    OBJECT_TIMER_KIND, scheduleObjectTimer,
} from './object_timers.js';
import { rn2 } from './rng.js';
import { cansee } from './vision.js';

function isGlobType(otyp) {
    return otyp >= GLOB_OF_GRAY_OOZE && otyp <= GLOB_OF_BLACK_PUDDING;
}

function scheduleNextGlobAttempt(glob, state, currentTurn, delay = 0) {
    const turns = delay > 0 ? delay : 23 + rn2(5);
    return scheduleObjectTimer(
        glob, OBJECT_TIMER_KIND.SHRINK_GLOB,
        currentTurn + turns, state,
    );
}

function floorGlobName(glob) {
    const partlyEaten = (glob.oeaten ?? 0) > 0 ? 'partly eaten ' : '';
    const type = OBJECT_NAMES[glob.otyp] || 'glob';
    const given = glob.oextra?.oname || glob.oname;
    return `${partlyEaten}${type}${given ? ` named ${given}` : ''}`;
}

function deleteFloorGlob(glob) {
    remove_object(glob);
    glob.where = 'gone';
    glob.ox = glob.oy = 0;
}

export function runClaimedFloorGlobTimer(
    claimed, state = game, currentTurn = state.moves ?? 0,
) {
    if (!claimed || claimed.timer?.kind !== OBJECT_TIMER_KIND.SHRINK_GLOB)
        return null;
    const glob = claimed.object;
    if (!glob?.globby || !isGlobType(glob.otyp)) {
        throw new Error('SHRINK_GLOB requires a live glob identity');
    }
    // Keep the first carrier source-complete.  Each rejected location owns
    // different ice, container-weight, inventory, eating, or migration state.
    if (glob.where !== 'floor') {
        throw new Error(
            'SHRINK_GLOB floor owner excludes carried, contained, buried, migrating, and monster-carried globs',
        );
    }
    const x = glob.ox, y = glob.oy;
    if (state.level?.at(x, y)?.typ === ICE) {
        throw new Error('SHRINK_GLOB floor owner excludes ice cadence');
    }
    if (!Number.isInteger(glob.owt) || glob.owt < 0)
        throw new Error('SHRINK_GLOB requires nonnegative integer weight');

    const deadline = claimed.timer.deadline;
    if (deadline < currentTurn) {
        const delta = Math.trunc((currentTurn - deadline + 24) / 25);
        if (delta >= glob.owt) {
            glob.owt = 0;
            deleteFloorGlob(glob);
            return {
                glob, x, y, overdue: true, delta,
                gone: true, message: null,
            };
        }
        glob.owt -= delta;
        const delay = 25 - (delta % 25);
        scheduleNextGlobAttempt(glob, state, currentTurn, delay);
        return {
            glob, x, y, overdue: true, delta, delay,
            gone: false, message: null,
        };
    }

    const visible = cansee(x, y);
    const name = floorGlobName(glob);
    const shrinkThreshold = glob.owt > 0 && glob.owt % 10 === 0;
    if (glob.owt > 0) {
        glob.owt--;
        if ((glob.oeaten ?? 0) > 1) glob.oeaten--;
    }
    const gone = glob.owt === 0;
    let message = null;
    if (gone) {
        deleteFloorGlob(glob);
        if (visible) {
            newsym(x, y);
            const article = (x === state.u?.ux && y === state.u?.uy)
                ? 'The' : 'A';
            message = `${article} ${name} fades away.`;
        }
    } else {
        scheduleNextGlobAttempt(glob, state, currentTurn);
    }
    return {
        glob, x, y, overdue: false, delta: 1,
        shrinkThreshold, gone, message,
    };
}
