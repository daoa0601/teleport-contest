// Cursed figurines which come to life on their own.
// C refs: apply.c:fig_transform() and dog.c:make_familiar()/initedog().

import { formatFeltMessage, formatSeenMessage } from './hero_speech.js';
import { makeFamiliar } from './familiar.js';
import {
    IS_OBSTRUCTED, IS_POOL, STONE, TREE, W_NONPASSWALL, isok,
} from './const.js';
import { canSeeMonster, newsym } from './display.js';
import { remove_object } from './floor_object.js';
import { game } from './gstate.js';
import {
    findMonsterNearPosition,
} from './mklev.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_MOVE, MONSTER_SYMBOL,
    monsterTypeName,
} from './monster_data.js';
import { BOULDER, FIGURINE, OBJECT_NAMES } from './object_data.js';
import { unlinkMonsterObject } from './monster_inventory.js';
import {
    OBJECT_TIMER_KIND, scheduleObjectTimer,
} from './object_timers.js';
import { rnd } from './rng.js';
import { cansee } from './vision.js';
import type { GameState } from './game_state.js';
import type { GameObject, ObjectWhere } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { Position } from './map_types.js';
import type { DueObjectTimer } from './object_timers.js';

type FigurineLocation = Position & (
    { carrier: 'inventory'; monsterCarrier: null }
    | { carrier: 'floor'; monsterCarrier: null }
    | { carrier: 'minvent'; monsterCarrier: Monster }
);

interface FigurineEventBase {
    figurine: GameObject;
    carrier: ObjectWhere;
    message: string | null;
    finished?: true;
}

export interface FigurineTransformation extends FigurineEventBase, Position {
    transformed: true;
    monster: Monster;
    finishPending: boolean;
    waterMessages: string[];
    overdue: boolean;
    redraw: boolean;
    retryScheduled?: never;
}

export interface FigurineRetry extends FigurineEventBase {
    transformed: false;
    monster: null;
    finishPending: false;
    retryScheduled: true;
    retryDelay: number;
    retryDeadline: number;
    waterMessages?: never;
}

export interface FigurineConsumed extends FigurineEventBase {
    transformed: false;
    monster: null;
    finishPending: false;
    retryScheduled?: never;
    waterMessages: string[];
}

export type FigurineTimerEvent = FigurineTransformation | FigurineRetry | FigurineConsumed;


const M1_FLY = 0x00000001;
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_CONCEAL = 0x00000080;
const M1_NOLIMBS = 0x00006000;
const M1_SLITHY = 0x00080000;
const M2_ROCKTHROW = 0x08000000;
const S_EYE = 5;
const S_MIMIC = 13;
const S_LIGHT = 25;
const S_EEL = 57;

function articleFor(noun: string) {
    return /^[aeiou]/i.test(noun) ? 'an' : 'a';
}

function figurineLocomotion(mnum: number, fallback = 'drop') {
    const flags = MONSTER_FLAGS1[mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_EYE || symbol === S_LIGHT) return 'float';
    if (flags & M1_FLY) return 'fly';
    if (flags & M1_SLITHY) return 'slither';
    if (flags & M1_AMORPHOUS) return 'ooze';
    if ((MONSTER_MOVE[mnum] ?? 0) === 0) return 'wiggle';
    if ((flags & M1_NOLIMBS) === M1_NOLIMBS) return 'crawl';
    return fallback;
}

function figurineMayTransformAt(figurine: GameObject, x: number, y: number, state: GameState) {
    return figurinePlacementFailure(figurine, x, y, state) === null;
}

// C figurine_location_checks(): timers use the same rules silently.
export function figurinePlacementFailure(figurine: GameObject, x: number, y: number, state: GameState): string | null {
    if (figurine.where === 'inventory' && state.u.uswallow)
        return "You don't have enough room in here.";
    if (!isok(x, y)) return 'You cannot put the figurine there.';
    const level = state.level;
    const location = level?.at(x, y);
    if (!level || !location) return 'You cannot put the figurine there.';
    const species = figurine.corpsenm;
    if (species === undefined) throw new TypeError('A figurine requires a monster species.');
    const flags1 = MONSTER_FLAGS1[species] ?? 0;
    const flags2 = MONSTER_FLAGS2[species] ?? 0;
    const passesWalls = !!(flags1 & M1_WALLWALK);
    const mayPassWall = passesWalls
        && !(location.wall_info & W_NONPASSWALL);
    if (IS_OBSTRUCTED(location.typ) && !mayPassWall) {
        const tree = location.typ === TREE || location.typ === STONE && level.flags.arboreal;
        return `You cannot place a figurine in ${tree ? 'a tree' : 'solid rock'}!`;
    }
    const boulder = state.level?.objects?.[x]?.[y]?.some(
        object => object !== figurine && object.otyp === BOULDER,
    );
    if (boulder && !passesWalls && !(flags2 & M2_ROCKTHROW))
        return 'You cannot fit the figurine on the boulder.';
    return null;
}

function monsterCarryingFigurine(figurine: GameObject, state: GameState) {
    return state.level?.monsters?.find(monster =>
        (monster.minvent || monster.inventory || []).includes(figurine)
    ) || null;
}

function figurineLocation(figurine: GameObject, state: GameState): FigurineLocation | null {
    if (figurine.where === 'inventory') {
        return {
            carrier: 'inventory', monsterCarrier: null,
            x: state.u?.ux, y: state.u?.uy,
        };
    }
    if (figurine.where === 'floor') {
        return {
            carrier: 'floor', monsterCarrier: null,
            x: figurine.ox, y: figurine.oy,
        };
    }
    if (figurine.where === 'minvent') {
        const monsterCarrier = monsterCarryingFigurine(figurine, state);
        if (!monsterCarrier?.mx) return null;
        return {
            carrier: 'minvent', monsterCarrier,
            x: monsterCarrier.mx, y: monsterCarrier.my,
        };
    }
    return null;
}

function scheduleFigurineRetry(
    figurine: GameObject, carrier: ObjectWhere, currentTurn: number, state: GameState,
): FigurineRetry {
    const retryDelay = rnd(5000);
    const retryTimer = scheduleObjectTimer(
        figurine, OBJECT_TIMER_KIND.FIG_TRANSFORM,
        currentTurn + retryDelay, state,
    );
    if (!retryTimer) throw new Error('Could not schedule the figurine retry timer.');
    return {
        figurine, monster: null, transformed: false,
        retryScheduled: true, retryDelay,
        retryDeadline: retryTimer.deadline,
        finishPending: false, message: null,
        carrier,
    };
}

function possessive(noun: string) {
    return /s$/i.test(noun) ? `${noun}'` : `${noun}'s`;
}

function monsterCarrierDescription(monster: Monster, state: GameState) {
    if (canSeeMonster(monster)
        && (!monster.wormno || cansee(monster.mx, monster.my))) {
        const given = monster.name || monster.givenName;
        const name = given || monsterTypeName(monster.mnum, !!monster.female);
        const owner = given ? name : `${articleFor(name)} ${name}`;
        return `${possessive(owner)} pack`;
    }
    const location = state.level?.at(monster.mx, monster.my);
    return location && IS_POOL(location.typ) ? 'empty water' : 'thin air';
}

function objectDescription(object: GameObject) {
    const name = object?.oextra?.oname || object?.oname
        || OBJECT_NAMES[object?.otyp] || object?.name || 'object';
    return `${articleFor(name)} ${name}`;
}

function familiarDescription(monster: Monster) {
    if (monster.name) return monster.name;
    const name = monsterTypeName(monster.mnum, !!monster.female);
    return `${articleFor(name)} ${name}`;
}

function figurineDescription(figurine: GameObject) {
    const given = figurine.oextra?.oname || figurine.oname;
    return given ? `A figurine named ${given}` : 'A figurine';
}

function familiarPresentation(
    monster: Monster, figurine: GameObject, location: FigurineLocation, overdue: boolean,
    state: GameState,
) {
    const blind = !!state.blind || (state.u?.blindTurns ?? 0) > 0;
    const seesInvisible = !!(state.u?.seeInvisible
        || (state.u?.seeInvisibleTurns ?? 0) > 0);
    let suppressSight = (!!monster.minvis && !seesInvisible)
        || (MONSTER_SYMBOL[monster.mnum] === S_MIMIC
            && !!monster.m_ap_type);
    let ending = '';
    if (monster.mundetected) {
        const shelter = state.level?.objects?.[monster.mx]?.[monster.my]?.[0];
        if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CONCEAL
            && shelter) {
            ending = ` and ${figurineLocomotion(monster.mnum, 'crawl')} under ${
                objectDescription(shelter)
            }`;
        } else if (MONSTER_SYMBOL[monster.mnum] === S_MIMIC
            || MONSTER_SYMBOL[monster.mnum] === S_EEL) {
            suppressSight = true;
        } else {
            ending = ' and vanish';
        }
    }

    const movement = figurineLocomotion(monster.mnum);
    const familiar = familiarDescription(monster);
    const visible = cansee(location.x, location.y);
    if (location.carrier === 'inventory') {
        return blind || suppressSight
            ? formatFeltMessage(`something ${movement} from your pack!`, state)
            : formatSeenMessage(`${familiar} ${movement} out of your pack${ending}!`, state);
    }
    if (location.carrier === 'floor') {
        if (!visible || overdue) return null;
        return suppressSight
            ? `${figurineDescription(figurine)} suddenly vanishes!`
            : formatSeenMessage(`a figurine transform into ${familiar}${ending}!`, state);
    }
    if (!visible || overdue || suppressSight) return null;
    return formatSeenMessage(`${familiar} ${movement} out of ${
        monsterCarrierDescription(location.monsterCarrier, state)
    }${ending}!`, state);
}

function deleteFigurine(figurine: GameObject, state: GameState) {
    if (figurine.where === 'floor') remove_object(figurine);
    else if (figurine.where === 'minvent') {
        const carrier = monsterCarryingFigurine(figurine, state);
        if (carrier) unlinkMonsterObject(carrier, figurine);
    }
    else {
        const index = (state.inventory || []).indexOf(figurine);
        if (index >= 0) state.inventory.splice(index, 1);
    }
    figurine.where = 'gone';
    figurine.ox = figurine.oy = 0;
}

export async function runClaimedFigurineTimer(
    claimed: DueObjectTimer | null | undefined, state: GameState = game, currentTurn = state.moves ?? 0,
): Promise<FigurineTimerEvent | null> {
    if (!claimed || claimed.timer?.kind !== OBJECT_TIMER_KIND.FIG_TRANSFORM)
        return null;
    const figurine = claimed.object;
    if (!figurine || figurine.otyp !== FIGURINE) return null;
    if (typeof figurine.corpsenm !== 'number')
        throw new TypeError('A figurine transformation requires a monster species.');
    const location = figurineLocation(figurine, state);
    if (!location)
        return scheduleFigurineRetry(
            figurine, figurine.where, currentTurn, state,
        );
    const { carrier } = location;
    const onFloor = carrier === 'floor';

    const position = onFloor ? { x: location.x, y: location.y }
        : findMonsterNearPosition(
            figurine.corpsenm, location.x, location.y,
        );
    if (!position || !figurineMayTransformAt(
        figurine, position.x, position.y, state,
    )) {
        return scheduleFigurineRetry(
            figurine, carrier, currentTurn, state,
        );
    }
    const waterMessages: string[] = [];
    const monster = await makeFamiliar(
        figurine, position.x, position.y, true,
        { state, announce: async (message: string) => { waterMessages.push(message); } },
    );
    if (!monster) {
        deleteFigurine(figurine, state);
        return {
            figurine, monster: null, transformed: false,
            finishPending: false, message: null, waterMessages, carrier,
        };
    }

    const overdue = claimed.timer.deadline !== currentTurn;
    const message = familiarPresentation(
        monster, figurine, { ...location, x: position.x, y: position.y },
        overdue, state,
    );
    const floorVisible = onFloor && cansee(position.x, position.y);
    return {
        figurine, monster,
        transformed: true, finishPending: true, message,
        waterMessages,
        overdue,
        carrier,
        x: onFloor ? location.x : monster.mx,
        y: onFloor ? location.y : monster.my,
        redraw: floorVisible && !overdue,
    };
}

export function finishFigurineTimer<T extends FigurineTimerEvent | null | undefined>(
    event: T, state: GameState = game,
): T {
    if (!event?.transformed || !event.finishPending) return event;
    deleteFigurine(event.figurine, state);
    if (event.redraw) newsym(event.x, event.y);
    event.finishPending = false;
    event.finished = true;
    return event;
}
