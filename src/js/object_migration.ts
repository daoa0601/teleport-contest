// Objects which fall through downward passages and arrive on another level.
// C refs: dokick.c down_gate(), impact_drop(), ship_object(), obj_delivery(),
// and teleport.c rloco().

import {
    IS_SOFT, MIGR_LADDER_UP, SHOPBASE,
    MIGR_NOBREAK, MIGR_NOSCATTER, MIGR_RANDOM, MIGR_SSTAIRS,
    MIGR_STAIRS_UP, MIGR_TO_SPECIES, MIGR_WITH_HERO, TRAPDOOR,
    is_hole,
} from './const.js';
import { newsym } from './display.js';
import {
    placeObject, remove_object, stack_object,
} from './floor_object.js';
import { game } from './gstate.js';
import { requireInitializedGame } from './gstate.js';
import type { PlayingGameState } from './game_state.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { GameObject, ObjectMigration } from './object_types.js';
import type { Position, Stairway, Trap } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { isContainer } from './container.js';
import { maybeResetPick } from './lock_context.js';
import { unlinkObject } from './object_location.js';
import { maybeUnhideAt } from './monster_hiding.js';
import { angerWatchGuards } from './monster_anger.js';
import { hotPursuitShopkeeper } from './shop_damage.js';
import { shopkeeperName } from './monster_name.js';
import { corpseName, objectCombatName, objectNameIsPlural } from './objnam.js';
import { currency } from './currency.js';
import { costlySpot, objectIsUnpaid } from './shk.js';
import { pickedContainer, stolenValue } from './shop_loss.js';
import { roomsAt } from './room.js';
import { deleteObject, delobj } from './object_delete.js';
import { relocateObjectRandomly } from './object_teleport.js';
import {
    BOULDER, CORPSE, EGG, EXPENSIVE_CAMERA, MIRROR, OBJECT_MATERIAL, ROCK,
} from './object_data.js';
import { onQuestStart, okToQuest } from './quest.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { cansee } from './vision.js';

const COIN_CLASS = 12;
const GLASS = 19;

type RandomBelow = (limit: number) => number;

interface MigrationGate {
    arrival: number;
    destination: DungeonLocation;
    text: string;
}

interface PileImpact {
    count: number;
    chainThere: boolean;
}

interface MigrationOptions {
    state?: PlayingGameState;
    publish?: MessagePublisher;
    random?: RandomBelow;
}

interface ImpactOptions extends MigrationOptions {
    destinationLevel?: number;
}

interface ShippingOptions extends MigrationOptions {
    shopFloorObject?: boolean;
}

interface DeliveryOptions {
    nearHero?: boolean;
    publish?: MessagePublisher;
    random?: RandomBelow;
    rollOne?: (sides: number) => number;
}

function sameLevel(first: DungeonLocation | null | undefined, second: DungeonLocation | null | undefined): boolean {
    return !!first && !!second
        && first.dnum === second.dnum
        && first.dlevel === second.dlevel;
}

function stairwayAt(state: PlayingGameState, x: number, y: number): Stairway | null {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (stair.sx === x && stair.sy === y) return stair;
    }
    return null;
}

function trapAt(state: PlayingGameState, x: number, y: number): Trap | null {
    return state.level?.traps?.find(trap =>
        trap.tx === x && trap.ty === y) || null;
}

function nextLevel(state: PlayingGameState): DungeonLocation {
    const current = state.u?.uz || { dnum: 0, dlevel: 1 };
    return { ...current, dlevel: (current.dlevel ?? 1) + 1 };
}

function onBottomLevel(state: PlayingGameState): boolean {
    const current = state.u?.uz;
    const dungeon = state.dungeons?.[current?.dnum];
    return !!current && !!dungeon
        && current.dlevel === dungeon.num_dunlevs;
}

function inEndgame(state: PlayingGameState): boolean {
    const current = state.u?.uz;
    return !!current && !!state.astral_level
        && current.dnum === state.astral_level.dnum;
}

function onStronghold(state: PlayingGameState): boolean {
    return sameLevel(state.u?.uz, state.stronghold_level);
}

function trapDestination(state: PlayingGameState): DungeonLocation | null {
    if (onStronghold(state)) return state.valley_level || null;
    if (inEndgame(state) || onBottomLevel(state)) return null;
    return nextLevel(state);
}

function downwardGate(state: PlayingGameState, x: number, y: number): MigrationGate | null {
    if (onQuestStart(state) && !okToQuest(state)) return null;

    const stair = stairwayAt(state, x, y);
    if (stair && !stair.up) {
        const destination = stair.tolev || nextLevel(state);
        if (stair.isladder) {
            return {
                arrival: MIGR_LADDER_UP,
                destination,
                text: 'down the ladder',
            };
        }
        return {
            arrival: destination.dnum === state.u?.uz?.dnum
                ? MIGR_STAIRS_UP : MIGR_SSTAIRS,
            destination,
            text: 'down the stairs',
        };
    }

    const trap = trapAt(state, x, y);
    if (!trap || !trap.tseen || !is_hole(trap.ttyp))
        return null;
    const destination = trapDestination(state);
    if (!destination) return null;
    return {
        arrival: MIGR_RANDOM,
        destination,
        text: trap.ttyp === TRAPDOOR
            ? 'through the trap door' : 'through the hole',
    };
}

function quantity(object: GameObject): number {
    return object.quan ?? object.quantity ?? 1;
}

function transitSubject(object: GameObject, state: PlayingGameState): string {
    const subject = object.otyp === CORPSE ? corpseName(object, { definite: true })
        : `the ${objectCombatName(object, { state })}`;
    return subject.charAt(0).toUpperCase() + subject.slice(1);
}

function squareIsVisible(state: PlayingGameState, x: number, y: number): boolean {
    if (heroIsBlind(state)) return false;
    if (state === game) return cansee(x, y);
    return !state.viz_array || !!((state.viz_array[y]?.[x] ?? 0) & 0x2);
}

function pileAt(state: PlayingGameState, x: number, y: number): GameObject[] {
    return state.level?.objects?.[x]?.[y] || [];
}

function pileImpact(state: PlayingGameState, object: GameObject | null, x: number, y: number): PileImpact {
    let count = 0;
    let chainThere = false;
    for (const candidate of pileAt(state, x, y)) {
        if (candidate === state.uchain || candidate === state.u?.uchain) {
            chainThere = true;
        } else if (candidate !== object) {
            count += quantity(candidate);
        }
    }
    return { count, chainThere };
}

function addToMigration(object: GameObject, gate: MigrationGate, state: PlayingGameState): void {
    object.no_charge = false;
    if (isContainer(object)) maybeResetPick(object, state);
    object.where = 'migrating';
    object.migration = {
        destination: { ...gate.destination },
        source: { ...(state.u?.uz || { dnum: 0, dlevel: 1 }) },
        arrival: gate.arrival,
    };
    object.ox = gate.destination.dnum;
    object.oy = gate.destination.dlevel;
    state.migratingObjects ||= [];
    state.migratingObjects.unshift(object);
}

async function publishTransitMessage(
    object: GameObject, gate: MigrationGate, stays: boolean, impact: PileImpact,
    publish: MessagePublisher, state: PlayingGameState,
): Promise<void> {
    const plural = objectNameIsPlural(object, state);
    if (!impact.count && !impact.chainThere) {
        if (!stays)
            await publish(`${transitSubject(object, state)} ${plural ? 'fall' : 'falls'} ${gate.text}.`);
        return;
    }

    const verb = impact.count ? (plural ? 'hit' : 'hits')
        : (plural ? 'rattle' : 'rattles');
    const target = impact.count
        ? `${impact.count === 1 ? 'another' : 'other'} object${
            impact.count === 1 ? '' : 's'}`
        : 'your chain';
    const fall = stays ? '.'
        : ` and ${plural ? 'fall' : 'falls'} ${gate.text}.`;
    await publish(`${transitSubject(object, state)} ${verb} ${target}${fall}`);
}

async function breaksInTransit(object: GameObject, state: PlayingGameState, publish: MessagePublisher, random: RandomBelow): Promise<boolean> {
    const { objectBreaksOnImpact } = await import('./object_breakage.js');
    if (!objectBreaksOnImpact(object, random)) return false;

    if (object.otyp === MIRROR)
        state.u.uluck = Math.max(-13, (state.u?.uluck ?? 0) - 2);
    if (object.otyp === EGG && object.spe
        && object.corpsenm !== undefined && Number.isInteger(object.corpsenm) && object.corpsenm >= 0) {
        state.u.uluck = Math.max(
            -13,
            (state.u?.uluck ?? 0) - Math.min(quantity(object), 5),
        );
    }
    if (!heroIsDeaf(state)) {
        const crash = OBJECT_MATERIAL[object.otyp] === GLASS
            || object.otyp === EXPENSIVE_CAMERA;
        await publish(`You hear a muffled ${crash ? 'crash' : 'splat'}.`);
    }
    await deleteObject(object, state);
    return true;
}

export async function impactDrop(
    missile: GameObject | null,
    x: number,
    y: number,
    {
        state = requireInitializedGame(),
        publish = async () => {},
        random = rn2,
        destinationLevel = 0,
    }: ImpactOptions = {},
): Promise<number> {
    const gate = downwardGate(state, x, y);
    if (!gate) return 0;
    if (destinationLevel) {
        gate.arrival = MIGR_WITH_HERO;
        gate.destination = { ...gate.destination, dlevel: destinationLevel };
    }

    const pile = [...pileAt(state, x, y)];
    const shop = costlySpot(x, y, state);
    const owner = shop?.resident;
    const debit = owner?.eshk.debit ?? 0;
    const robbed = owner?.eshk.robbed ?? 0;
    const angry = owner && !owner.mpeaceful;
    let price = 0;
    const total = pile.reduce((count, object) =>
        count + (object === missile ? 0 : quantity(object)), 0);
    let fallen = 0;
    for (const object of pile) {
        if (object === missile
            || object === state.uball || object === state.u?.uball
            || object === state.uchain || object === state.u?.uchain) continue;
        if (missile?.otyp === ROCK && object.otyp === BOULDER) continue;
        if (random(object.otyp === BOULDER ? 30 : 3) !== 0) continue;
        remove_object(object, state);
        if (shop) {
            const sameShop = !!costlySpot(state.u.ux, state.u.uy, state)
                && state.u.urooms.includes(shop.roomno);
            price += await stolenValue(object, x, y, sameShop, { state, publish, silent: true });
            if (object.contents?.length) pickedContainer(object);
            if (object.oclass !== COIN_CLASS) object.no_charge = false;
        }
        addToMigration(object, gate, state);
        fallen += quantity(object);
    }

    if (fallen && squareIsVisible(state, x, y)) {
        const all = fallen === total;
        const what = fallen === 1 ? 'object falls' : 'objects fall';
        if (missile) {
            const article = all ? 'the '
                : fallen === 1 ? 'an' : '';
            await publish(`From the impact, ${article}other ${what}.`);
        } else {
            const subject = all
                ? (fallen === 1
                    ? 'The adjacent object' : 'All the adjacent objects')
                : (fallen === 1
                    ? 'One of the adjacent objects'
                    : 'Some of the adjacent objects');
            await publish(`${subject} ${fallen === 1
                ? 'falls' : 'fall'} ${gate.text}.`);
        }
    }
    if (owner && price > 0) {
        if ((owner.eshk.robbed ?? 0) > robbed) {
            await publish(`You removed ${price} ${currency(price)} worth of goods!`);
            if (squareIsVisible(state, owner.mx, owner.my)) {
                owner.eshk.customer ||= state.plname || 'player';
                await publish(angry ? `${shopkeeperName(owner, { state, capitalized: true })} is infuriated!`
                    : `"${state.plname || 'player'}, you are a thief!"`);
            } else if (!heroIsDeaf(state)) await publish('You hear a scream, "Thief!"');
            hotPursuitShopkeeper(owner, state);
            await angerWatchGuards(false, { state, publish });
        } else if ((owner.eshk.debit ?? 0) > debit) {
            const amount = (owner.eshk.debit ?? 0) - debit;
            await publish(`You owe ${shopkeeperName(owner, { state })} ${amount} ${currency(amount)} for goods lost.`);
        }
    }
    return fallen;
}

export async function shipObject(
    object: GameObject | null,
    x: number,
    y: number,
    {
        state = requireInitializedGame(),
        publish = async () => {},
        random = rn2,
        shopFloorObject = false,
    }: ShippingOptions = {},
): Promise<boolean> {
    if (!object) return false;
    const gate = downwardGate(state, x, y);
    if (!gate) return false;

    const attached = object === state.uball || object === state.u?.uball
        || object === state.uchain || object === state.u?.uchain;
    const stays = attached
        || (gate.arrival !== MIGR_LADDER_UP && random(3) !== 0);
    const unpaid = objectIsUnpaid(object);
    const container = !!object.contents?.length;
    const impact = pileImpact(state, object, x, y);
    const hole = gate.arrival === MIGR_RANDOM;
    if (object.otyp === BOULDER && hole) {
        if (impact.count) {
            await impactDrop(object, x, y, { state, publish, random });
        }
        return false;
    }

    if (squareIsVisible(state, x, y)) {
        await publishTransitMessage(object, gate, stays, impact, publish, state);
    }
    if (stays) {
        if (impact.count) {
            await impactDrop(object, x, y, { state, publish, random });
            maybeUnhideAt(x, y, state);
        }
        return false;
    }

    if (unpaid || shopFloorObject) {
        if (unpaid) {
            await stolenValue(object, state.u.ux, state.u.uy, true, {
                state, publish, silent: false,
            });
        } else {
            const { ox, oy } = object;
            const room = roomsAt(state.level, ox, oy, SHOPBASE)[0];
            const sameShop = !!costlySpot(state.u.ux, state.u.uy, state)
                && room !== undefined && state.u.urooms.includes(room);
            await stolenValue(object, ox, oy, sameShop, {
                state, publish, silent: false,
            });
        }
        if (container) pickedContainer(object);
        if (object.oclass !== COIN_CLASS) object.no_charge = false;
    }
    if (object.owornmask) {
        await removeWornHeroItem(object, state);
        if (state.program_state.gameover) return true;
    }

    if (await breaksInTransit(object, state, publish, random)) return true;
    addToMigration(object, gate, state);
    if (object.otyp === BOULDER) object.otrapped = false;
    if (impact.count) {
        await impactDrop(object, x, y, { state, publish, random });
        newsym(x, y);
    }
    return true;
}

function arrivalStairway(state: PlayingGameState, migration: ObjectMigration, ladder: boolean): Stairway | null {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (sameLevel(stair.tolev, migration.source)
            && !!stair.isladder === ladder) return stair;
    }
    return null;
}

async function breaksOnArrival(object: GameObject, state: PlayingGameState, x: number, y: number,
    random: RandomBelow, noBreak: boolean, withHero: boolean, publish: MessagePublisher,
): Promise<boolean> {
    const location = state.level.at(x, y);
    if (noBreak || (location !== null && IS_SOFT(location.typ))) return false;
    const { objectBreaksOnImpact, breakFloorObject } = await import('./object_breakage.js');
    if (withHero) {
        const result = await breakFloorObject(object, { state, x, y, publish, random, heroCaused: false });
        return result.destroyed || !!state.program_state.gameover;
    }
    if (!objectBreaksOnImpact(object, random)) return false;
    await delobj(object, state);
    return true;
}

async function deliverAtRandomPosition(
    object: GameObject, state: PlayingGameState, random: RandomBelow, publish: MessagePublisher, noBreak: boolean,
): Promise<void> {
    object.ox = object.oy = 0;
    if (!await relocateObjectRandomly(object, { state, random, publish })
        || noBreak) return;
    const { objectBreaksOnImpact } = await import('./object_breakage.js');
    if (objectBreaksOnImpact(object, random)) await delobj(object, state);
}

async function deliverAtPassage(
    object: GameObject, migration: ObjectMigration, state: PlayingGameState, position: Position,
    publish: MessagePublisher, random: RandomBelow, rollOne: (sides: number) => number, noBreak: boolean,
): Promise<void> {
    const arrival = migration.arrival & ~(MIGR_NOBREAK | MIGR_NOSCATTER);
    await placeObject(object, position.x, position.y, state);
    if (await breaksOnArrival(
        object, state, position.x, position.y, random, noBreak,
        arrival === MIGR_WITH_HERO, publish,
    )) return;
    const landed = await stack_object(object, state);
    // The pinned C tests this mask before removing migration flags. Its
    // stair and ladder codes share a bit with MIGR_WITH_HERO too.
    if (migration.arrival & MIGR_WITH_HERO) {
        newsym(position.x, position.y);
        return;
    }
    const { scatterFloorObjects } = await import('./scatter.js');
    await scatterFloorObjects(position.x, position.y, rollOne(2), {
        state,
        onlyObject: landed,
        mayDestroy: false,
        mayFracture: false,
        mayHitHero: false,
        mayHitMonsters: false,
        publish,
        random,
        rollOne,
    });
}

export async function deliverMigratingObjects(
    state: PlayingGameState = requireInitializedGame(),
    {
        nearHero = false,
        publish = async () => {},
        random = rn2,
        rollOne = rnd,
    }: DeliveryOptions = {},
): Promise<number> {
    let delivered = 0;
    let position: Position | null = null;
    for (const object of [...(state.migratingObjects || [])]) {
        const migration = object.migration;
        if (!migration || !sameLevel(migration.destination, state.u?.uz))
            continue;
        if (migration.arrival & MIGR_TO_SPECIES) continue;
        const arrival = migration.arrival
            & ~(MIGR_NOBREAK | MIGR_NOSCATTER);
        if (nearHero !== (arrival === MIGR_WITH_HERO)) continue;

        unlinkObject(object, state);
        object.owornmask = 0;
        delete object.migration;
        let passage: Stairway | Position | null = null;
        if ([MIGR_STAIRS_UP, MIGR_SSTAIRS].includes(arrival))
            passage = arrivalStairway(state, migration, false);
        else if (arrival === MIGR_LADDER_UP)
            passage = arrivalStairway(state, migration, true);
        else if (arrival === MIGR_WITH_HERO) {
            passage = { x: state.u.ux, y: state.u.uy };
        }
        else position = null;
        if (passage) position = 'sx' in passage ? { x: passage.sx, y: passage.sy } : passage;

        const noBreak = !!(migration.arrival & MIGR_NOBREAK);
        if (position) {
            await deliverAtPassage(
                object, migration, state,
                position,
                publish, random, rollOne, noBreak,
            );
        } else {
            await deliverAtRandomPosition(
                object, state, random, publish, noBreak,
            );
        }
        delivered++;
    }
    return delivered;
}
