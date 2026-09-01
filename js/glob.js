// Glob shrink timers.
// C refs: mkobj.c start_glob_timeout()/shrink_glob().

import { newsym } from './display.js';
import { ICE } from './const.js';
import { game } from './gstate.js';
import { remove_object } from './mklev.js';
import { removeObjectFromMonsterInventory } from './monster_inventory.js';
import {
    GLOB_OF_BLACK_PUDDING, GLOB_OF_GRAY_OOZE, OBJECT_NAMES,
} from './object_data.js';
import {
    OBJECT_TIMER_KIND, objectsInTimerGraph, scheduleObjectTimer,
} from './object_timers.js';
import { rn2 } from './rng.js';
import { cansee } from './vision.js';
import {
    encumbranceMessage, nearCapacity, objectWeight,
} from './weight.js';

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

export function startGlobTimeout(
    glob, state = game, currentTurn = state.moves ?? 0,
) {
    return scheduleNextGlobAttempt(glob, state, currentTurn);
}

function floorGlobName(glob) {
    const partlyEaten = (glob.oeaten ?? 0) > 0 ? 'partly eaten ' : '';
    const type = OBJECT_NAMES[glob.otyp] || 'glob';
    const given = glob.oextra?.oname || glob.oname;
    return `${partlyEaten}${type}${given ? ` named ${given}` : ''}`;
}

function parentContainer(object, state) {
    if (object.container) return object.container;
    return objectsInTimerGraph(state).find(candidate =>
        candidate !== object && candidate.contents?.includes(object));
}

function carryingMonster(object, state) {
    if (object.ocarry) return object.ocarry;
    return (state.level?.monsters || []).find(monster =>
        monster.m_id === object.carrierMid
        || (monster.minvent || monster.inventory || []).includes(object));
}

function outermostContainer(object, state) {
    let outer = object;
    const seen = new Set();
    while (outer?.where === 'contained' && !seen.has(outer)) {
        seen.add(outer);
        const parent = parentContainer(outer, state);
        if (!parent) break;
        outer = parent;
    }
    return outer;
}

function objectLocation(object, state) {
    const outer = outermostContainer(object, state);
    if (!outer) return null;
    if (outer.where === 'floor' || outer.where === 'buried')
        return { x: outer.ox, y: outer.oy };
    if (outer.where === 'inventory')
        return { x: state.u?.ux, y: state.u?.uy };
    if (outer.where === 'minvent') {
        const monster = carryingMonster(outer, state);
        if (monster) return { x: monster.mx, y: monster.my };
    }
    return null;
}

function globIceState(glob, state) {
    const outer = outermostContainer(glob, state);
    if (!outer || !['floor', 'buried'].includes(outer.where)) return 'none';
    if (state.level?.at?.(outer.ox, outer.oy)?.typ !== ICE) return 'none';
    return outer.where === 'buried' ? 'buried' : 'on-ice';
}

function updateContainerWeights(container, state) {
    let current = container;
    const seen = new Set();
    while (current && !seen.has(current)) {
        seen.add(current);
        current.owt = objectWeight(current);
        current = current.where === 'contained'
            ? parentContainer(current, state) : null;
    }
}

function objectName(object) {
    const type = OBJECT_NAMES[object.otyp] || 'object';
    const given = object.oextra?.oname || object.oname;
    return `${type}${given ? ` named ${given}` : ''}`;
}

function clearHeroEquipment(object, state) {
    const slots = [
        'uwep', 'uswapwep', 'uquiver',
        'uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu',
        'uleft', 'uright', 'uamul', 'ublindf',
    ];
    let removed = !!(object.owornmask || object.worn || object.wielded
        || object.alternate || object.ready);
    for (const slot of slots) {
        if (state[slot] === object) {
            state[slot] = null;
            removed = true;
        }
        if (state.u?.[slot] === object) {
            state.u[slot] = null;
            removed = true;
        }
    }
    object.owornmask = 0;
    object.worn = false;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
    if (removed) state._occupation = null;
}

function deleteGlob(glob, state, carrier = null) {
    const where = glob.where;
    if (where === 'floor') {
        remove_object(glob);
    } else if (where === 'inventory') {
        clearHeroEquipment(glob, state);
        const index = (state.inventory || []).indexOf(glob);
        if (index >= 0) state.inventory.splice(index, 1);
    } else if (where === 'contained') {
        const container = parentContainer(glob, state);
        const index = container?.contents?.indexOf(glob) ?? -1;
        if (index >= 0) container.contents.splice(index, 1);
        if (container) updateContainerWeights(container, state);
        glob.container = null;
    } else if (where === 'minvent') {
        const monster = carrier || carryingMonster(glob, state);
        if (monster) {
            removeObjectFromMonsterInventory(monster, glob);
            if (monster.mw === glob) monster.mw = null;
        }
    } else if (where === 'buried') {
        const index = state.level?.buriedObjects?.indexOf(glob) ?? -1;
        if (index >= 0) state.level.buriedObjects.splice(index, 1);
        glob.buried = false;
    } else if (where === 'migrating') {
        const migrating = state.migratingObjects || state._migratingObjects;
        const index = migrating?.indexOf(glob) ?? -1;
        if (index >= 0) migrating.splice(index, 1);
    }
    glob.where = 'gone';
    glob.ocarry = null;
    delete glob.carrierMid;
    glob.ox = glob.oy = 0;
}

function activelyEatingGlob(glob, state) {
    const victual = state.context?.victual;
    return victual?.piece === glob || victual?.object === glob
        || state.context?.eatingObject === glob;
}

export function runClaimedGlobTimer(
    claimed, state = game, currentTurn = state.moves ?? 0,
) {
    if (!claimed || claimed.timer?.kind !== OBJECT_TIMER_KIND.SHRINK_GLOB)
        return null;
    const glob = claimed.object;
    if (!glob?.globby || !isGlobType(glob.otyp)) {
        throw new Error('SHRINK_GLOB requires a live glob');
    }
    if (!Number.isInteger(glob.owt) || glob.owt < 0)
        throw new Error('SHRINK_GLOB requires a nonnegative weight');

    const where = glob.where;
    const inInventory = where === 'inventory';
    const container = where === 'contained'
        ? parentContainer(glob, state) : null;
    const outer = container ? outermostContainer(glob, state) : glob;
    const containerInInventory = !!container && outer?.where === 'inventory';
    const updatesHeroInventory = inInventory || containerInInventory;
    const carrier = where === 'minvent'
        ? carryingMonster(glob, state) : null;
    const location = objectLocation(glob, state);
    const x = location?.x ?? 0;
    const y = location?.y ?? 0;
    const ice = globIceState(glob, state);
    const oldCapacity = updatesHeroInventory ? nearCapacity(state) : null;

    const deadline = claimed.timer.deadline;
    if (deadline < currentTurn && ice !== 'buried') {
        const missedShrinks = Math.trunc(
            (currentTurn - deadline + 24) / 25,
        );
        const delay = 25 - (missedShrinks % 25);
        const delta = ice === 'on-ice'
            ? Math.trunc((missedShrinks + 2) / 3)
            : missedShrinks;
        if (delta >= glob.owt) {
            glob.owt = 0;
            deleteGlob(glob, state, carrier);
            return {
                glob, x, y, overdue: true, delta,
                gone: true, message: null,
            };
        }
        glob.owt -= delta;
        if (container) updateContainerWeights(container, state);
        scheduleNextGlobAttempt(glob, state, currentTurn, delay);
        return {
            glob, x, y, overdue: true, delta, delay,
            gone: false, message: null,
        };
    }

    const beingEaten = activelyEatingGlob(glob, state);
    const waitsOnIce = ice === 'buried'
        || (ice === 'on-ice' && currentTurn % 3 === 1);
    if (beingEaten || waitsOnIce) {
        scheduleNextGlobAttempt(glob, state, currentTurn);
        return {
            glob, x, y, overdue: false,
            skippedEating: beingEaten,
            skippedIce: waitsOnIce,
            delta: 0, gone: false, message: null,
        };
    }

    const name = floorGlobName(glob);
    const oldTopWeight = containerInInventory ? objectWeight(outer) : null;
    const shrinkThreshold = glob.owt > 0 && glob.owt % 10 === 0;
    if (glob.owt > 0) {
        glob.owt--;
        if ((glob.oeaten ?? 0) > 1) glob.oeaten--;
    }
    const gone = glob.owt === 0;
    if (container) updateContainerWeights(container, state);

    let message = null;
    if (inInventory && (shrinkThreshold || gone)) {
        message = `Your ${name} ${
            gone ? 'dissolves completely' : 'shrinks'
        }.`;
    } else if (containerInInventory) {
        const newTopWeight = outer.owt;
        const newCapacity = nearCapacity(state);
        if (gone
            || (shrinkThreshold && newTopWeight !== oldTopWeight)
            || newCapacity !== oldCapacity) {
            const change = newTopWeight !== oldTopWeight
                ? 'becomes' : 'seems';
            message = `Your ${objectName(outer)} ${change}${
                gone ? '' : ' slightly'
            } lighter.`;
        }
    }

    if (updatesHeroInventory) {
        return {
            glob, x, y, carrier, overdue: false, delta: 1,
            shrinkThreshold, gone, message, oldCapacity,
            finishPending: true,
        };
    }

    if (gone) {
        const visible = where === 'floor' && cansee(x, y);
        deleteGlob(glob, state, carrier);
        if (visible) {
            newsym(x, y);
            const article = x === state.u?.ux && y === state.u?.uy
                ? 'The' : 'A';
            message = `${article} ${name} fades away.`;
        }
    } else {
        scheduleNextGlobAttempt(glob, state, currentTurn);
    }
    return {
        glob, x, y, carrier, overdue: false, delta: 1,
        shrinkThreshold, gone, message,
    };
}

export function finishGlobTimer(
    event, state = game, currentTurn = state.moves ?? 0,
) {
    if (!event?.finishPending || !event.glob) return event;
    if (event.gone) deleteGlob(event.glob, state, event.carrier);
    else scheduleNextGlobAttempt(event.glob, state, currentTurn);
    const newCapacity = nearCapacity(state);
    event.followupMessage = encumbranceMessage(
        event.oldCapacity, newCapacity,
    ) || null;
    event.newCapacity = newCapacity;
    event.finishPending = false;
    event.finished = true;
    return event;
}
