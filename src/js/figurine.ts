// Cursed figurines which come to life on their own.
// C refs: apply.c:fig_transform() and dog.c:make_familiar()/initedog().

import { formatFeltMessage, formatSeenMessage, plineWithContinuation } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { makeFamiliar } from './dog.js';
import { IS_OBSTRUCTED, STONE, TREE, W_NONPASSWALL, OBJECT_TIMER_KIND } from './const.js';
import { isok } from './cmd.js';
import { canSeeMonster, newsym } from './display.js';
import { isPoolAt } from './dbridge.js';
import { game } from './gstate.js';
import {
    enexto,
} from './teleport.js';
import { MONSTER_MOVE, MONSTER_SYMBOL } from './monster_data.js';
import { BOULDER, FIGURINE } from './object_data.js';
import {unlinkMonsterObject, remove_object} from './mkobj.js';
import { scheduleObjectTimer } from './timeout.js';
import { rnd } from './rng.js';
import { cansee } from './vision.js';
import type { GameState } from './game_state.js';
import type { GameObject, ObjectWhere } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { Position } from './map_types.js';
import type { DueObjectTimer } from './timeout.js';
import { monsterName } from './do_name.js';
import { objectCombatName, objectDescription, withIndefiniteArticle } from './objnam.js';
import {
    monsterHasNoLimbs, monsterHidesUnder, monsterIsAmorphous, monsterIsEel, monsterIsFlyer, monsterIsSlithy,
    monsterPassesWalls, monsterThrowsRocks,
} from './mondata.js';

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

const S_EYE = 5;
const S_MIMIC = 13;
const S_LIGHT = 25;

// Part of C mondata.c:locomotion(): figurine-message copy of the motion-verb
// mapping; C fig_transform() calls locomotion(mtmp->data, "drop"). The
// general port is monsterLocomotion() in mondata.ts.
function figurineLocomotion(mnum: number, fallback = 'drop') {
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_EYE || symbol === S_LIGHT) return 'float';
    if (monsterIsFlyer(mnum)) return 'fly';
    if (monsterIsSlithy(mnum)) return 'slither';
    if (monsterIsAmorphous({ mnum })) return 'ooze';
    if ((MONSTER_MOVE[mnum] ?? 0) === 0) return 'wiggle';
    if (monsterHasNoLimbs(mnum)) return 'crawl';
    return fallback;
}

// Part of C apply.c:figurine_location_checks(): the silent quietly==TRUE
// verdict fig_transform() applies to the chosen spot.
function figurineMayTransformAt(figurine: GameObject, x: number, y: number, state: GameState) {
    return figurinePlacementFailure(figurine, x, y, state) === null;
}

// C apply.c:figurine_location_checks(): timers use the same rules silently.
export function figurinePlacementFailure(figurine: GameObject, x: number, y: number, state: GameState): string | null {
    if (figurine.where === 'inventory' && state.u.uswallow)
        return "You don't have enough room in here.";
    if (!isok(x, y)) return 'You cannot put the figurine there.';
    const level = state.level;
    const location = level?.at(x, y);
    if (!level || !location) return 'You cannot put the figurine there.';
    const species = figurine.corpsenm;
    if (species === undefined) throw new TypeError('A figurine requires a monster species.');

    const passesWalls = monsterPassesWalls(species);
    const mayPassWall = passesWalls
        && !(location.wall_info & W_NONPASSWALL);
    if (IS_OBSTRUCTED(location.typ) && !mayPassWall) {
        const tree = location.typ === TREE || location.typ === STONE && level.flags.arboreal;
        return `You cannot place a figurine in ${tree ? 'a tree' : 'solid rock'}!`;
    }
    const boulder = state.level?.objects?.[x]?.[y]?.some(
        object => object !== figurine && object.otyp === BOULDER,
    );
    if (boulder && !passesWalls && !monsterThrowsRocks(species))
        return 'You cannot fit the figurine on the boulder.';
    return null;
}

// Part of C zap.c:get_obj_location(): resolves the carrying monster
// (C's figurine->ocarry) for the OBJ_MINVENT case of fig_transform().
function monsterCarryingFigurine(figurine: GameObject, state: GameState) {
    return state.level?.monsters?.find(monster =>
        (monster.minvent || monster.inventory || []).includes(figurine)
    ) || null;
}

// Part of C zap.c:get_obj_location(): the INVENT/FLOOR/MINVENT location
// cases fig_transform() relies on.
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

// Part of C apply.c:fig_transform(): the start_timer(rnd(5000), FIG_TRANSFORM)
// retry when the spot is not okay.
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

// Part of C hacklib.c:s_suffix(): local possessive for the "pack" phrase;
// the general port is possessiveName() in hacklib.ts.
function possessive(noun: string) {
    return /s$/i.test(noun) ? `${noun}'` : `${noun}'s`;
}

// Part of C apply.c:fig_transform(): the OBJ_MINVENT "%s pack|empty water|
// thin air" carrier description (canseemon + wormno + is_pool).
function monsterCarrierDescription(monster: Monster, state: GameState) {
    if (canSeeMonster(monster)
        && (!monster.wormno || cansee(monster.mx, monster.my))) {
        const owner = monsterName(monster, { state, article: 'a' });
        return `${possessive(owner)} pack`;
    }
    return isPoolAt(monster.mx, monster.my, state) ? 'empty water' : 'thin air';
}

// Part of C apply.c:fig_transform(): the You_feel/You_see message switch
// for the newly created familiar, including the mundetected "and vanish"
// and hides_under endings.
async function familiarPresentation(
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
        if (monsterHidesUnder(monster.mnum)
            && shelter) {
            ending = ` and ${figurineLocomotion(monster.mnum, 'crawl')} under ${
                await objectDescription(shelter, { state })
            }`;
        } else if (MONSTER_SYMBOL[monster.mnum] === S_MIMIC
            || monsterIsEel(monster.mnum)) {
            suppressSight = true;
        } else {
            ending = ' and vanish';
        }
    }

    const movement = figurineLocomotion(monster.mnum);
    const familiar = withIndefiniteArticle(monsterName(monster, { state, article: 'none', exact: true }));
    const visible = cansee(location.x, location.y);
    if (location.carrier === 'inventory') {
        return blind || suppressSight
            ? formatFeltMessage(`something ${movement} from your pack!`, state)
            : formatSeenMessage(`${familiar} ${movement} out of your pack${ending}!`, state);
    }
    if (location.carrier === 'floor') {
        if (!visible || overdue) return null;
        return suppressSight
            ? `${withIndefiniteArticle(objectCombatName(figurine, { state, includeCorpseSpecies: false }))} suddenly vanishes!`
            : formatSeenMessage(`a figurine transform into ${familiar}${ending}!`, state);
    }
    if (!visible || overdue || suppressSight) return null;
    return formatSeenMessage(`${familiar} ${movement} out of ${
        monsterCarrierDescription(location.monsterCarrier, state)
    }${ending}!`, state);
}

// Part of C apply.c:fig_transform(): the "free figurine now" disposition
// (useup when carried, obj_extract_self + obfree otherwise).
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

// Part of C apply.c:fig_transform(): the timer callback up to make_familiar()
// and the presentation message, split so the caller publishes the message
// before the finishing phase frees the figurine.
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
        : enexto(
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
    const message = await familiarPresentation(
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

// Part of C apply.c:fig_transform(): the tail of the timer callback, after
// the message: free the figurine and redraw its former location.
export async function finishFigurineTimer<T extends FigurineTimerEvent | null | undefined>(
    event: T, state: GameState = game,
): Promise<T> {
    if (!event?.transformed || !event.finishPending) return event;
    deleteFigurine(event.figurine, state);
    if (event.redraw) await newsym(event.x, event.y);
    event.finishPending = false;
    event.finished = true;
    return event;
}

// C apply.c:fig_transform()
// The whole timer callback: runClaimedFigurineTimer() ports the body up to
// the presentation message, the messages publish here (C pline()/You_see()
// run before the figurine is freed), and finishFigurineTimer() ports the
// free-and-redraw tail.
export async function figTransform(
    claimed: DueObjectTimer | null | undefined, state: GameState = game,
    currentTurn: number = state.moves ?? 0,
    publish: MessagePublisher = plineWithContinuation,
): Promise<FigurineTimerEvent | null | undefined> {
    const event = await runClaimedFigurineTimer(claimed, state, currentTurn);
    for (const message of event?.waterMessages || []) await publish(message);
    if (event?.message) await publish(event.message);
    return await finishFigurineTimer(event, state);
}
