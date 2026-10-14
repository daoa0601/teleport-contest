import { rotCorpse } from './corpse_rot.js';
// Corpse revival timers.
// C refs: do.c revive_corpse()/revive_mon()/zombify_mon() and zap.c revive().

import { tameMonster } from './monster_taming.js';
import { setMonsterGivenName } from './monster_given_name.js';
import {
    RLOC_NOMSG,
    CORR, G_GENOD, GRAVE, IS_POOL, MFAST,
    MM_NOCOUNTBIRTH, MM_NOTAIL,
    MM_NOMSG, MM_NOWAIT, NO_MINVENT, PIT, PLNMSG_OBJ_GLOWS, ROOM,
} from './const.js';
import { isReviver, isRider, zombieForm } from './corpse_species.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { makePetWary } from './dog.js';
import { game, requireGameLevel } from './gstate.js';
import { updateHeroHunger } from './hunger.js';
import { stopHeroOccupation } from './occupation.js';
import { deleteObject, delobjCore } from './object_delete.js';
import { splitObjectStack } from './object_stack.js';
import { useUpInventoryStack } from './hero_inventory.js';
import {
    findMonsterNearPosition, makemonAt, makemonNear, maketrap,
    riderRevivalTime, set_corpsenm,
} from './mklev.js';
import {
    MONSTER_BODY_META, MONSTER_GENO, MONSTER_NAME,
    MONSTER_SYMBOL,
    monsterIsDisplacer, monsterTypeName,
} from './monster_data.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { ownedObjectName } from './objnam.js';
import { costlySpot } from './shk.js';
import { stolenValue } from './shop_loss.js';
import { restoreMonsterTraits } from './monster_traits.js';
import { changeMonsterForm, restoreMonsterShape } from './monster_polymorph.js';
import {
    destroyObjectFromMonsterInventory, linkObjectToMonsterInventory, unlinkMonsterObject,
} from './monster_inventory.js';
import { BAG_OF_HOLDING, OBJECT_NAMES, STATUE } from './object_data.js';
import {
    OBJECT_TIMER_KIND, objectTimers, objectsInTimerGraph,
    scheduleObjectTimer, stopAllObjectTimers,
} from './object_timers.js';
import { d, rn2 } from './rng.js';
import { randomMonsterRelocation } from './teleport.js';
import { cansee } from './vision.js';
import { markQuestLeaderAlive } from './quest.js';
import {
    bodyGenderFlags, PM_DOPPELGANGER, PM_HUMAN_ZOMBIE,
    revivalReplacement,
} from './revival_species.js';

import type { GameState } from './game_state.js';
import type { GameObject, ObjectTimerKind, ObjectWhere } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { Position, Trap } from './map_types.js';
import type { DueObjectTimer } from './object_timers.js';

type CorpseObject = GameObject & { corpsenm: number };

export interface ObjectRevivalLocation extends Position {
    monsterCarrier: Monster | null;
}

export interface ContainerRevivalLocation extends ObjectRevivalLocation {
    directContainer: GameObject;
    nesting: number;
    outer: GameObject;
}

export type CorpseRevivalLocation = ObjectRevivalLocation | ContainerRevivalLocation;

export interface CorpseRevived {
    kind: 'revived';
    corpse: GameObject;
    monster: Monster;
    trap: Trap | null;
    buried: boolean;
    originalWhere: ObjectWhere;
    location: CorpseRevivalLocation;
    messages: string[];
    finished?: boolean;
    pitFilled?: boolean;
    filledByBoulder?: GameObject | null;
    buriedFloorObjects?: GameObject[];
}

export interface CorpseRevivalFailure {
    kind?: never;
    monster: null;
    messages: string[];
    originalWhere: ObjectWhere;
    location: CorpseRevivalLocation | null;
}

export interface CorpseRevivalRetry {
    kind: ObjectTimerKind;
    delay: number;
}

export interface CorpseRevivalTimerFailure extends Omit<CorpseRevivalFailure, 'kind'> {
    kind: 'failed';
    corpse: GameObject;
    retry: CorpseRevivalRetry;
    buried?: never;
}

export interface CorpseRotted {
    kind: 'rotted';
    corpse: GameObject;
    monster: null;
    messages: string[];
    buried?: never;
}

export type CorpseRevivalResult = CorpseRevived | CorpseRevivalFailure;
export type CorpseRevivalTimerEvent = CorpseRevived | CorpseRevivalTimerFailure | CorpseRotted;

function requireCorpseSpecies(corpse: GameObject): asserts corpse is CorpseObject {
    if (typeof corpse.corpsenm !== 'number')
        throw new TypeError('Corpse revival requires a monster species.');
}

function isContainerLocation(location: CorpseRevivalLocation): location is ContainerRevivalLocation {
    return 'directContainer' in location;
}

const S_EEL = 57;
const S_ZOMBIE = 52;
const G_UNIQ = 0x1000;
const PM_GHOST = 287;

function parentContainer(object: GameObject, state: GameState) {
    if (object?.container) return object.container;
    return objectsInTimerGraph(state).find(candidate =>
        candidate !== object && candidate.contents?.includes(object));
}

function carryingMonster(object: GameObject, state: GameState) {
    if (object?.ocarry) return object.ocarry;
    return (state.level?.monsters || []).find(monster =>
        monster.m_id === object?.carrierMid
        || (monster.minvent || monster.inventory || []).includes(object));
}

function containerLocation(corpse: GameObject, state: GameState): ContainerRevivalLocation | null {
    const directContainer = parentContainer(corpse, state);
    if (!directContainer) return null;
    let outer = directContainer;
    let nesting = 0;
    const seen = new Set<GameObject>();
    while (outer?.where === 'contained' && !seen.has(outer)) {
        seen.add(outer);
        const parent = parentContainer(outer, state);
        if (!parent) return null;
        outer = parent;
        nesting++;
    }
    if (outer.where === 'buried') return null;
    const location = objectLocation(outer, state);
    return location ? { ...location, directContainer, nesting, outer } : null;
}

function objectLocation(object: GameObject, state: GameState): ObjectRevivalLocation | null {
    if (object?.where === 'inventory') {
        return { x: state.u?.ux, y: state.u?.uy, monsterCarrier: null };
    }
    if (object?.where === 'floor' || object?.where === 'buried') {
        return { x: object.ox, y: object.oy, monsterCarrier: null };
    }
    if (object?.where === 'minvent') {
        const monsterCarrier = carryingMonster(object, state);
        if (monsterCarrier?.mx) {
            return {
                x: monsterCarrier.mx, y: monsterCarrier.my,
                monsterCarrier,
            };
        }
    }
    return null;
}

function revivalLocation(corpse: GameObject, state: GameState, buriedReviver: boolean): CorpseRevivalLocation | null {
    if (corpse.where === 'contained') return containerLocation(corpse, state);
    if (corpse.where === 'buried' && !buriedReviver) return null;
    return objectLocation(corpse, state);
}

function zombieCanDig(x: number, y: number, state: GameState) {
    if (state.level?.traps?.some(trap => trap.tx === x && trap.ty === y))
        return false;
    const location = state.level?.at(x, y);
    return !!location && [ROOM, CORR, GRAVE].includes(location.typ);
}

function corpseName(corpse: CorpseObject) {
    const species = MONSTER_NAME[corpse.corpsenm] || 'monster';
    const given = corpse.oextra?.oname || corpse.oname;
    const chewed = corpse.oeaten ? 'bite-covered ' : '';
    return `${chewed}${species} corpse${given ? ` named ${given}` : ''}`;
}

function corpseWithArticle(corpse: CorpseObject) {
    const name = corpseName(corpse);
    return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

function monsterDescription(monster: Monster) {
    if (monster.name) return monster.name;
    const name = monsterTypeName(monster.mnum, !!monster.female);
    const article = /^[aeiou]/i.test(name) ? 'An' : 'A';
    return `${article} ${name}`;
}

function carrierDescription(monster: Monster) {
    if (monster?.name) return monster.name;
    return `the ${monsterTypeName(monster?.mnum, !!monster?.female)}`;
}

function containerDescription(container: GameObject) {
    const name = container?.oextra?.oname || container?.oname
        || OBJECT_NAMES[container?.otyp] || container?.name || 'container';
    const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
    return `${article} ${name}`;
}

function revivalMessage(
    corpse: CorpseObject, monster: Monster, location: CorpseRevivalLocation,
    originalWhere: ObjectWhere, state: GameState,
) {
    if (originalWhere === 'inventory') {
        return state.uwep === corpse
            ? `The ${corpseName(corpse)} writhes out of your grasp!`
            : 'You feel squirming in your backpack!';
    }
    if (originalWhere === 'floor') {
        if (!cansee(location.x, location.y)
            && !canSeeMonster(monster)) return null;
        if (!canSeeMonster(monster))
            return `The ${corpseName(corpse)} disappears!`;
        const effects = new Map([
            [311, ' in a whirl of spectral skulls'],
            [312, ' in a churning pillar of flies'],
            [313, ' in a ring of withered crops'],
        ]);
        const subject = monster.name
            || `The ${monsterTypeName(monster.mnum, !!monster.female)}`;
        return `${subject} rises from the dead${effects.get(monster.mnum) || ''}!`;
    }
    if (originalWhere === 'minvent') {
        if (!cansee(monster.mx, monster.my)) return null;
        const carrier = location.monsterCarrier;
        if (carrier && canSeeMonster(carrier)) {
            const result = canSpotMonster(monster) ? 'revives' : 'disappears';
            return `Startled, ${carrierDescription(carrier)} drops ${
                corpseWithArticle(corpse)
            } as it ${result}!`;
        }
        return canSpotMonster(monster)
            ? `${monsterDescription(monster)} suddenly appears!` : null;
    }
    if (originalWhere === 'contained' && isContainerLocation(location)) {
        const container = location.directContainer;
        const outer = location.outer;
        const description = containerDescription(container);
        const revived = canSpotMonster(monster)
            ? monsterDescription(monster) : 'Something';
        if (location.monsterCarrier
            && canSeeMonster(
                location.monsterCarrier,
            )) return `${revived} writhes out of ${description}!`;
        if (outer.where === 'inventory')
            return `${revived} writhes out of ${description} in your pack!`;
        if (outer.where === 'floor' && cansee(location.x, location.y))
            return `${revived} escapes from ${description}!`;
    }
    return null;
}

async function consumeRevivedCorpse(
    corpse: GameObject, location: CorpseRevivalLocation, state: GameState,
): Promise<void> {
    if (corpse.where === 'floor') {
        await delobjCore(corpse, true, state);
    } else if (corpse.where === 'inventory') {
        await useUpInventoryStack(corpse, state);
    } else if (corpse.where === 'minvent') {
        const carrier = location.monsterCarrier || carryingMonster(corpse, state);
        if (!carrier) throw new Error('A reviving monster-carried corpse has no carrier');
        await destroyObjectFromMonsterInventory(carrier, corpse, state);
    } else {
        await deleteObject(corpse, state);
    }
}

function restoreCorpseNameAndHealth(monster: Monster, corpse: CorpseObject) {
    const name = corpse.oextra?.oname || corpse.oname;
    if (name && !((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ)) {
        setMonsterGivenName(monster, name);
    }
    if ((corpse.oeaten ?? 0) > 0) {
        const nutrition = MONSTER_BODY_META[corpse.corpsenm]?.[1] ?? 0;
        const remaining = Math.min(corpse.oeaten ?? 0, nutrition);
        monster.mhp = Math.max(
            1,
            nutrition ? Math.trunc(monster.mhp * remaining / nutrition) : 1,
        );
    }
}

async function mergeGhostIntoBody(monster: Monster, corpse: GameObject, state: GameState) {
    const ghostId = corpse.oextra?.omid ?? corpse.omid;
    if (!ghostId) return;
    const ghost = (state.level?.monsters || []).find(candidate =>
        candidate.m_id === ghostId && candidate.mnum === PM_GHOST);
    if (ghost) {
        if (canSeeMonster(ghost))
            await plineWithContinuation(`${monsterName(ghost, { state, capitalized: true })} is suddenly drawn into its former body!`);
        for (;;) {
            const object = (ghost.minvent || ghost.inventory)?.[0];
            if (!object) break;
            unlinkMonsterObject(ghost, object);
            await linkObjectToMonsterInventory(monster, object, { state });
        }
        if (ghost.mtame && !monster.mtame) {
            if (await tameMonster(monster, null, { state }))
                monster.mtame = ghost.mtame;
        }
        monster.mconf = 1;
        ghost.dead = true;
        ghost.mhp = 0;
        const level = requireGameLevel(state);
        level.monsters = level.monsters.filter(
            candidate => candidate !== ghost,
        );
    }
    if (corpse.oextra) delete corpse.oextra.omid;
    delete corpse.omid;
}

function discardSavedBody(corpse: GameObject) {
    if (corpse.oextra) {
        delete corpse.oextra.omid;
        delete corpse.oextra.omonst;
    }
    delete corpse.omid;
}

async function createRevivedMonster(corpse: CorpseObject, location: CorpseRevivalLocation, state: GameState) {
    const originalMnum = corpse.corpsenm;
    const savedTraits = corpse.oextra?.omonst;
    let x = location.x, y = location.y;
    const occupant = monsterAtPosition(requireGameLevel(state), x, y);
    if (occupant) {
        const nearby = findMonsterNearPosition(originalMnum, x, y);
        if (nearby) ({ x, y } = nearby);
    }

    const targetLocation = state.level?.at?.(x, y);
    if (corpse.norevive
        || (MONSTER_SYMBOL[originalMnum] === S_EEL
            && (!targetLocation || !IS_POOL(targetLocation.typ)))) {
        return {
            monster: null,
            twitchMessage: cansee(x, y)
                ? `The ${corpseName(corpse)} twitches feebly.` : null,
        };
    }

    const replacement = revivalReplacement(originalMnum, corpse);
    const useSavedTraits = savedTraits && replacement == null;
    const targetMnum = replacement ?? savedTraits?.mnum ?? originalMnum;
    let flags = NO_MINVENT | MM_NOWAIT | MM_NOMSG;
    if (replacement == null) flags |= MM_NOCOUNTBIRTH;
    if (useSavedTraits) flags |= MM_NOTAIL;
    else flags |= bodyGenderFlags(corpse);
    const heroAt = state.u?.ux === x && state.u?.uy === y;
    const monster = heroAt
        ? await makemonNear(targetMnum, x, y, flags, heroAt)
        : await makemonAt(targetMnum, x, y, flags);
    if (!monster) return { monster: null, twitchMessage: null };

    if (replacement != null) discardSavedBody(corpse);
    if (useSavedTraits) {
        restoreMonsterTraits(monster, savedTraits);
        markQuestLeaderAlive(monster, state);
        newsym(monster.mx, monster.my);
        await restoreMonsterShape(monster, state);
        if (monster.mtame && !monster.isminion)
            makePetWary(monster, { wasDead: true, state });
    } else if (replacement === PM_DOPPELGANGER) {
        if (monster.cham === PM_DOPPELGANGER)
            await changeMonsterForm(monster, originalMnum);
    } else if (replacement === PM_HUMAN_ZOMBIE) {
        monster.mhp = monster.mhpmax = 100;
        monster.permspeed = MFAST;
        monster.mspeed = MFAST;
    }
    monster.mundetected = 0;
    monster.m_ap_type = 0;
    return { monster, twitchMessage: null };
}

function retryRevival(
    corpse: CorpseObject, state: GameState, currentTurn: number, messages: string[],
): CorpseRevivalRetry {
    let kind: ObjectTimerKind;
    let delay: number;
    if (isRider(corpse.corpsenm) && rn2(99)) {
        kind = OBJECT_TIMER_KIND.REVIVE_MON;
        delay = riderRevivalTime(corpse, true);
    } else {
        kind = OBJECT_TIMER_KIND.ROT_CORPSE;
        if (isRider(corpse.corpsenm)
            && !objectTimers(corpse).some(timer => timer.kind === kind)) {
            messages.push('You feel much less hassled.');
        }
        delay = Math.max(
            1,
            d(5, 50) - (currentTurn - (corpse.age ?? currentTurn)),
        );
    }
    if (!objectTimers(corpse).some(timer => timer.kind === kind)) {
        scheduleObjectTimer(corpse, kind, currentTurn + delay, state);
    }
    return { kind, delay };
}

async function displaceRevivalBlocker(corpse: CorpseObject, state: GameState, currentTurn: number) {
    if (!monsterIsDisplacer(corpse.corpsenm) || corpse.where !== 'floor') return;
    const level = requireGameLevel(state);
    if ((level.flags.stasis_until ?? 0) >= currentTurn) return;
    const occupant = monsterAtPosition(level, corpse.ox, corpse.oy);
    if (!occupant) return;
    const wasVisible = canSeeMonster(occupant);
    const name = monsterName(occupant, { capitalized: true, state });
    if (!(await randomMonsterRelocation(occupant, { state, flags: RLOC_NOMSG }))) return;
    const nowVisible = canSeeMonster(occupant);
    if (wasVisible && !nowVisible) {
        await plineWithContinuation(`${name} vanishes.`);
    } else if (!wasVisible && nowVisible) {
        const currentName = monsterName(occupant, { capitalized: true, state });
        await plineWithContinuation(`${currentName} appears.`);
    } else if (wasVisible) {
        const dx = occupant.mx - corpse.ox;
        const dy = occupant.my - corpse.oy;
        if (dx * dx + dy * dy > 2)
            await plineWithContinuation(`${name} teleports.`);
    }
}

function containerBlocksRevival(location: ContainerRevivalLocation) {
    const container = location.directContainer;
    if (container.olocked || location.nesting > 2
        || container.otyp === STATUE) return true;
    return container.otyp === BAG_OF_HOLDING && rn2(40) !== 0;
}

async function stopCorpseMeal(corpse: GameObject, state: GameState) {
    const occupation = state._occupation;
    if (occupation?.key !== 'eat-food' || state.context.victual?.piece !== corpse)
        return;
    state.context.victual = null;
    if (!corpse.oeaten) corpse.oeaten = 1;
    // Revival retains the body until makemon has used it, even on the last bite.
    await stopHeroOccupation(state, plineWithContinuation, { finishMeal: false });
    await updateHeroHunger(false, { state });
}

async function reviveCorpse(
    corpse: GameObject, state: GameState, { announce = true, byHero = false } = {},
): Promise<CorpseRevivalResult> {
    requireCorpseSpecies(corpse);
    const originalWhere = corpse.where;
    await stopCorpseMeal(corpse, state);
    const digsOut = originalWhere === 'buried'
        && (isReviver(corpse.corpsenm)
            || MONSTER_SYMBOL[corpse.corpsenm] === S_ZOMBIE);
    const location = revivalLocation(corpse, state, digsOut);
    const messages: string[] = [];
    if (!location?.x
        || (originalWhere === 'contained' && isContainerLocation(location) && containerBlocksRevival(location))
        || (digsOut && !zombieCanDig(location.x, location.y, state))) {
        return { monster: null, messages, originalWhere, location };
    }

    corpse.ox = location.x;
    corpse.oy = location.y;
    const creation = await createRevivedMonster(corpse, location, state);
    if (!creation.monster) {
        if (creation.twitchMessage) messages.push(creation.twitchMessage);
        return { monster: null, messages, originalWhere, location };
    }

    const monster = creation.monster;
    const oneOf = corpse.quan > 1;
    const revivedCorpse = oneOf
        ? splitObjectStack(corpse, 1, state) : corpse;
    if (!revivedCorpse) throw new Error('A successful revival could not split its corpse stack');
    requireCorpseSpecies(revivedCorpse);
    if (byHero) await announceHeroRevival(revivedCorpse, monster, oneOf, state);
    await mergeGhostIntoBody(monster, revivedCorpse, state);
    restoreCorpseNameAndHealth(monster, revivedCorpse);
    monster.mrevived = 1;
    if (announce) {
        const message = revivalMessage(
            corpse, monster, location, originalWhere, state,
        );
        if (message) messages.push(message);
    }
    await consumeRevivedCorpse(revivedCorpse, location, state);
    newsym(monster.mx, monster.my);

    let trap: Trap | null = null;
    if (digsOut) trap = await maketrap(monster.mx, monster.my, PIT);
    return {
        kind: 'revived', corpse, monster, trap,
        buried: digsOut, originalWhere, location, messages,
    };
}

async function announceHeroRevival(corpse: GameObject, monster: Monster, oneOf: boolean, state: GameState): Promise<void> {
    const { ox: x, oy: y } = corpse;
    const keeper = costlySpot(x, y, state)?.resident;
    const charge = keeper && (corpse.where === 'inventory' ? corpse.unpaid : !corpse.no_charge);
    if (cansee(x, y)) {
        const name = oneOf
            ? `One of ${ownedObjectName({ ...corpse, quan: 2, quantity: 2 }, state, { capitalized: false })}`
            : ownedObjectName(corpse, state);
        await plineWithContinuation(`${name} glows iridescently.`);
        state._lastPlineKind = PLNMSG_OBJ_GLOWS;
    } else if (charge) {
        await plineWithContinuation('A corpse is resuscitated.');
    }
    if (charge && keeper !== monster)
        await stolenValue(corpse, x, y, keeper.mpeaceful, { silent: false, state });
}

export async function reviveCorpseImmediately(corpse: GameObject | null | undefined, state: GameState = game, { announce = true } = {}): Promise<CorpseRevivalResult | null> {
    if (!corpse) return null;
    return reviveCorpse(corpse, state, { announce });
}

export async function reviveCorpseByMagic(
    corpse: GameObject | null | undefined, state: GameState = game, { byHero = true } = {},
): Promise<CorpseRevivalResult | null> {
    if (!corpse) return null;
    const noRevive = corpse.norevive;
    corpse.norevive = false;
    const event = await reviveCorpse(corpse, state, { announce: false, byHero });
    if (event.kind !== 'revived') {
        if (noRevive === undefined) delete corpse.norevive;
        else corpse.norevive = noRevive;
        for (const message of event.messages) await plineWithContinuation(message);
    }
    return event;
}

async function rotCorpseNow(corpse: GameObject, state: GameState): Promise<CorpseRotted> {
    await rotCorpse(corpse, state);
    return { kind: 'rotted', corpse, monster: null, messages: [] };
}

export async function runClaimedCorpseRevivalTimer(
    claimed: DueObjectTimer | null | undefined, state: GameState = game, currentTurn = state.moves ?? 0,
): Promise<CorpseRevivalTimerEvent | null> {
    const corpse = claimed?.object;
    const timerKind = claimed?.timer?.kind;
    if (!corpse || (timerKind !== OBJECT_TIMER_KIND.REVIVE_MON
        && timerKind !== OBJECT_TIMER_KIND.ZOMBIFY_MON)) return null;
    requireCorpseSpecies(corpse);

    if (timerKind === OBJECT_TIMER_KIND.ZOMBIFY_MON) {
        const target = zombieForm(corpse.corpsenm);
        if (target == null
            || ((state.mvitals?.[target]?.mvflags ?? 0) & G_GENOD)) {
            return rotCorpseNow(corpse, state);
        }
        if (corpse.oextra) {
            delete corpse.oextra.omid;
            delete corpse.oextra.omonst;
        }
        set_corpsenm(corpse, target);
    }

    await displaceRevivalBlocker(corpse, state, currentTurn);
    const event = await reviveCorpse(corpse, state);
    if (event.kind === 'revived') return event;
    const retry = retryRevival(corpse, state, currentTurn, event.messages);
    return { kind: 'failed', corpse, ...event, retry };
}
