// Objects thrown by the hero.
// C refs: dothrow.c throw_obj(), invent.c freeinv(), mkobj.c splitobj(),
// and zap.c bhit().

import { monsterAtPosition, monsterHasMapPosition } from './monster_location.js';
import {
    A_STR,
    BOLT_LIM,
    DOOR,
    D_CLOSED,
    D_LOCKED,
    IRONBARS,
    IS_SOFT,
    IS_WATERWALL,
    Is_airlevel,
    LAVAWALL,
    LOST_THROWN,
    M_AP_OBJECT,
    M_AP_TYPE,
    P_CROSSBOW,
    SINK,
    WEB,
    ZAP_POS,
    isok,
} from './const.js';
import { monsterName } from './monster_name.js';
import { isPoolOrLavaAt } from './terrain_properties.js';
import { dropBall } from './ball.js';
import { containerImpactDamage } from './container_impact.js';
import { currentAttribute } from './attrib.js';
import {
    flush_screen,
    lastDirtyMapCursor,
    newsym,
    plineWithContinuation,
    show_glyph_cell,
    transientObjectGlyph,
} from './display.js';
import { applyFloorEffects } from './floor_effects.js';
import { placeObject, stack_object } from './floor_object.js';
import { game, requireGameLevel, requireInitializedGame, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MapLocation, Position, Trap } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { costlySpot } from './shk.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { finishInventoryRemoval } from './hero_inventory.js';
import { endObjectBurn, objectShedsLight } from './light.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { objectName } from './objnam.js';
import { impactDisturbsZombies } from './object_impact.js';
import { isPick } from './weapon_type.js';
import { MONSTER_MOVE, MONSTER_NAME } from './monster_data.js';
import { breakObjectAtLocation, objectBreaksOnImpact } from './object_breakage.js';
import {
    CANDELABRUM_OF_INVOCATION, HEAVY_IRON_BALL, OBJECT_MATERIAL,
    OBJECT_NAMES, OBJECT_SUBTYPE, TALLOW_CANDLE, WAX_CANDLE,
} from './object_data.js';
import { objectClassForType } from './object_knowledge.js';
import {
    isLauncherAmmunition, launcherMatchesAmmo,
} from './object_properties.js';
import { shipObject } from './object_migration.js';
import { splitObjectStack } from './object_stack.js';
import { projectileHitsIronBars } from './projectile_bars.js';
import { rn2 } from './rng.js';
import { heroIsBlind } from './senses.js';
import { settleThrownShopObject } from './shk.js';
import { objectNoLongerHeld } from './object_release.js';
import { cansee } from './vision.js';

const VENOM_CLASS = 17;

export type ProjectileStop = 'range' | 'edge' | 'liquid-wall' | 'iron-bars'
    | 'web' | 'monster' | 'passage' | 'terrain' | 'liquid' | 'sink';

export interface ProjectileFlight extends Position {
    path: Position[];
    contact: Monster | null;
    stoppedBy: ProjectileStop;
    destroyed: boolean;
    migrated: boolean;
}

export interface ThrowTrajectory {
    range: number;
    recoil: number;
}

export interface ThrownObjectLandingOptions extends Position {
    state?: GameState;
    object: GameObject;
    contactedMonster?: Monster | null;
    publish?: MessagePublisher;
    random?: typeof rn2;
}

export type ProjectileFlightCapture = (
    object: GameObject, path: readonly Position[], state: GameState,
) => Promise<void>;

export interface ProjectileFlightOptions {
    state?: GameState;
    object: GameObject;
    dx: number;
    dy: number;
    range: number;
    captureFlight?: ProjectileFlightCapture | null;
    publish?: MessagePublisher;
    random?: typeof rn2;
}

interface PhysicalFlightOptions extends ProjectileFlightOptions {
    startX: number;
    startY: number;
    kicked?: boolean;
}

const COIN_CLASS = 12;
const GEM_CLASS = 13;

function objectClass(object: GameObject): number {
    return object?.oclass || objectClassForType(object?.otyp);
}

function closedDoor(location: MapLocation): boolean {
    return location?.typ === DOOR
        && !!((location.doormask ?? 0) & (D_CLOSED | D_LOCKED));
}

function liveMonsterAt(state: GameState, x: number, y: number): Monster | null {
    if (!state.level) return null;
    const monster = monsterAtPosition(state.level, x, y);
    return monster && monsterHasMapPosition(monster, state)
        && !monster.dead && monster.mhp > 0 ? monster : null;
}

function webAt(state: GameState, x: number, y: number): Trap | null {
    return (state.level?.traps || []).find(trap =>
        trap?.ttyp === WEB
        && trap.tx === x
        && trap.ty === y) || null;
}

function projectileMonsterAt(state: GameState, object: GameObject, x: number, y: number): Monster | null {
    const monster = liveMonsterAt(state, x, y);
    if (!monster) return null;
    const material = OBJECT_MATERIAL[object?.otyp] ?? 0;
    if (MONSTER_NAME[monster.mnum] === 'shade' && material !== 14)
        return null;
    if (M_AP_TYPE(monster) === M_AP_OBJECT) {
        const remembered = state.level?.at?.(x, y)?.remembered_glyph;
        if (!remembered || !['monster', 'warning', 'invisible'].includes(remembered.kind))
            return null;
    }
    return monster;
}

function thrownObjectSubject(object: GameObject): string {
    if (objectClass(object) === COIN_CLASS) return 'The gold';
    return `The ${object.name || OBJECT_NAMES[object.otyp] || 'object'}`;
}

function heroThrowStrength(state: GameState): number {
    let strength = currentAttribute(A_STR, state);
    if (strength <= 18) strength = Math.max(strength, 3);
    else if (strength <= 121) strength = 19 + Math.trunc(strength / 50);
    else strength = Math.min(strength, 125) - 100;
    return strength;
}

export function heroThrowRange(object: GameObject, state: GameState = game): number {
    return Math.max(
        1,
        Math.trunc(heroThrowStrength(state) / 2)
            - Math.trunc((object.owt ?? 1) / 40),
    );
}

export function heroThrowTrajectory(
    object: GameObject, state: GameState = game, launcher: GameObject | null | undefined = null,
): ThrowTrajectory {
    const launched = launcherMatchesAmmo(object, launcher);
    const crossbowing = launched && launcher !== null && launcher !== undefined
        && OBJECT_SUBTYPE[launcher.otyp] === P_CROSSBOW;
    const unweightedRange = Math.trunc(
        (crossbowing ? 18 : heroThrowStrength(state)) / 2,
    );
    let range = Math.max(
        1,
        unweightedRange - Math.trunc((object.owt ?? 1) / 40),
    );
    if (isLauncherAmmunition(object)) {
        if (launched) range = crossbowing ? BOLT_LIM : range + 1;
        else if (objectClass(object) !== GEM_CLASS)
            range = Math.trunc(range / 2);
    }

    const floating = Is_airlevel(state.u?.uz)
        || state.u?.levitating || state.u?.levitation || state.levitating;
    if (!floating) return { range, recoil: 0 };

    const recoil = Math.max(1, unweightedRange - range);
    return {
        range: Math.max(1, range - recoil),
        recoil,
    };
}

export function prepareHeroThrownTarget(monster: Monster, random: typeof rn2 = rn2): void {
    const immobilized = monster.mcanmove === 0 || monster.mcanmove === false;
    const speciesCanMove = (MONSTER_MOVE[monster.mnum]
        ?? monster.mmove ?? 0) > 0;
    if (immobilized && speciesCanMove && random(10) === 0) {
        monster.mcanmove = 1;
        monster.mfrozen = 0;
    }
}

// Both throwit_mon_hit() and the floor tail own a free thrown object.
export async function snuffThrownCandle(object: GameObject, state: GameState = game,
    publish: MessagePublisher = plineWithContinuation,
): Promise<void> {
    requireLiveGame(state);
    // C snuff_candle(): the thrown object is free, so Shk_Your is "The ".
    const candle = object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE;
    if (object.lamplit && (candle || object.otyp === CANDELABRUM_OF_INVOCATION)) {
        const many = candle ? (object.quan ?? object.quantity ?? 1) > 1
            : object.spe > 1;
        if (!heroIsBlind(state)) {
            await publish(`The ${candle ? '' : "candelabrum's "}candle${
                many ? "s' flames are" : "'s flame is"} extinguished.`);
        }
        endObjectBurn(object, state);
    }

}

export async function finishHeroThrownObjectLanding({
    state = game,
    object,
    x,
    y,
    contactedMonster = null,
    publish = plineWithContinuation,
    random = rn2,
}: ThrownObjectLandingOptions): Promise<GameObject | null> {
    requireLiveGame(state);
    const attachedBall = state.uball || state.u?.uball;
    const landingSquare = requireGameLevel(state).at(x, y);
    if (!landingSquare)
        throw new RangeError(`A thrown object cannot land outside the level at (${x}, ${y}).`);
    const breaksOnImpact = !IS_SOFT(landingSquare.typ) && objectBreaksOnImpact(object, random);
    if (breaksOnImpact || object.oclass === VENOM_CLASS) {
        const { destroyed } = await breakObjectAtLocation(object, {
            x, y, fromInventory: true, inView: cansee(x, y),
            state, publish, random,
        });
        if (state.program_state?.gameover || destroyed) return null;
    }

    const floorEffect = await applyFloorEffects(object, x, y, {
        state,
        publish,
        random,
    });
    if (state.program_state?.gameover) return null;
    if (floorEffect.finished) return floorEffect.object;

    // C dothrow.c:1808: the explicit release after flooreffects, before
    // keeper/pick interception. The later placeObject release is also in
    // the source; both run, exactly like C.
    await objectNoLongerHeld(object, state);
    if (contactedMonster?.isshk && isPick(object)) {
        if (cansee(x, y)) {
            await publish(`${monsterName(contactedMonster, { state, capitalized: true })} snatches up the ${
                objectName(object, state)}.`);
        }
        await settleThrownShopObject(object, x, y, state, publish);
        await addObjectToMonsterInventory(contactedMonster, object, state);
        return null;
    }

    await snuffThrownCandle(object, state, publish);

    if (!contactedMonster && await shipObject(object, x, y, {
        state: requireInitializedGame(state), publish, random,
    })) {
        return null;
    }

    await placeObject(object, x, y, state);
    const placedSquare = requireGameLevel(state).at(x, y);
    if (!placedSquare)
        throw new RangeError(`A placed object is outside the level at (${x}, ${y}).`);
    if (!IS_SOFT(placedSquare.typ)) {
        await containerImpactDamage(object, state.u.ux, state.u.uy, {
            state, publish, random,
        });
        impactDisturbsZombies(object, true, state);
    }
    if (object !== attachedBall)
        await settleThrownShopObject(object, x, y, state, publish);
    const landed = await stack_object(object, state);
    if (object === attachedBall) {
        await dropBall(x, y, { state, publish });
        if (state.program_state?.gameover) return null;
    }
    if (cansee(x, y)) newsym(x, y);
    if (objectShedsLight(landed ?? object)) state.vision_full_recalc = 1;
    return landed;
}

async function flyPhysicalObject({
    state = game,
    object,
    dx,
    dy,
    range,
    startX,
    startY,
    kicked = false,
    captureFlight = null,
    publish = plineWithContinuation,
    random = rn2,
}: PhysicalFlightOptions): Promise<ProjectileFlight> {
    let x = startX;
    let y = startY;
    const path: Position[] = [];
    let contact: Monster | null = null;
    let stoppedBy: ProjectileStop = 'range';
    let destroyed = false;
    let migrated = false;
    const steps = kicked ? Math.max(0, range - 1) : range;

    for (let step = 0; step < steps && (dx || dy); step++) {
        const nextX = x + dx;
        const nextY = y + dy;
        if (!isok(nextX, nextY)) {
            stoppedBy = 'edge';
            break;
        }

        const location = state.level?.at?.(nextX, nextY);
        if (!location) {
            stoppedBy = 'edge';
            break;
        }
        const previousX = x;
        const previousY = y;
        x = nextX;
        y = nextY;

        if (IS_WATERWALL(location.typ) || location.typ === LAVAWALL) {
            stoppedBy = 'liquid-wall';
            break;
        }

        if (location.typ === IRONBARS) {
            const forcedHit = step > 0 && random(5) === 0;
            const impact = await projectileHitsIronBars(object, {
                x: previousX, y: previousY, barsX: x, barsY: y,
                forceHit: forcedHit, heroCaused: true, state, publish, random,
            });
            if (impact.blocked) {
                destroyed = impact.destroyed || impact.heroDied;
                x = previousX;
                y = previousY;
                stoppedBy = 'iron-bars';
                break;
            }
        }

        contact = projectileMonsterAt(state, object, x, y);
        const web = contact ? null : webAt(state, x, y);
        if (web && random(3) === 0) {
            if (cansee(x, y)) {
                await publish(
                    `${thrownObjectSubject(object)} gets stuck in a web!`,
                );
                web.tseen = true;
                newsym(x, y);
            }
            stoppedBy = 'web';
            break;
        }
        if (contact) {
            stoppedBy = 'monster';
            break;
        }

        if (kicked && object.oclass === 12 && state.level?.objects[x]?.[y]?.length) {
            stoppedBy = 'terrain';
            break;
        }
        if (kicked && await shipObject(object, x, y, {
            state: requireInitializedGame(state),
            publish,
            random,
            shopFloorObject: !!costlySpot(x, y, state),
        })) {
            path.push({ x, y });
            migrated = true;
            stoppedBy = 'passage';
            break;
        }

        if (!ZAP_POS(location.typ) || closedDoor(location)) {
            x = previousX;
            y = previousY;
            stoppedBy = 'terrain';
            break;
        }

        path.push({ x, y });
        if (kicked && isPoolOrLavaAt(x, y, state)) {
            stoppedBy = 'liquid';
            break;
        }
        if (location.typ === SINK) {
            stoppedBy = 'sink';
            break;
        }
    }

    if (captureFlight && path.length)
        await captureFlight(object, path, state);
    return { x, y, path, contact, stoppedBy, destroyed, migrated };
}

export function flyHeroThrownObject(options: ProjectileFlightOptions): Promise<ProjectileFlight> {
    const state = options.state ?? game;
    return flyPhysicalObject({
        ...options,
        state,
        startX: state.u?.ux ?? 0,
        startY: state.u?.uy ?? 0,
    });
}

export function flyKickedObject(options: ProjectileFlightOptions): Promise<ProjectileFlight> {
    return flyPhysicalObject({
        ...options,
        startX: options.object?.ox ?? 0,
        startY: options.object?.oy ?? 0,
        kicked: true,
    });
}

// The caller must establish eligibility before crossing this boundary.  A
// stack allocates the source child identity before mutating the parent; a
// singleton detaches the exact carried identity.  Both leave throwit() with a
// free object whose loss provenance is LOST_THROWN.
export async function detachThrownUnit(
    state: GameState, item: GameObject, selectedQuantity: number, splitObjectId: number | null = null,
    publish: MessagePublisher = plineWithContinuation,
): Promise<GameObject> {
    let thrown = item;
    if (selectedQuantity > 1) {
        const split = splitObjectStack(item, 1, state, splitObjectId);
        if (!split)
            throw new Error('A selected projectile stack could not release one object.');
        thrown = split;
        thrown.invlet = null;
    } else {
        await removeWornHeroItem(item, state, { unchainBall: false });
        if (state.program_state?.gameover) return thrown;
    }
    const index = state.inventory.indexOf(thrown);
    if (index >= 0) state.inventory.splice(index, 1);
    thrown.where = 'free';
    await finishInventoryRemoval(thrown, state);
    if (state.program_state?.gameover) return thrown;
    thrown.how_lost = LOST_THROWN;
    state._capacityDirty = true;
    state._thrownObject = thrown;
    return thrown;
}

export async function captureThrownObjectFlight(
    object: GameObject, flightPath: readonly Position[], state: GameState = game,
): Promise<void> {
    const glyph = transientObjectGlyph(object);
    let transientCell: Position | null = null;
    let transientCursor: [number, number] | null = null;
    try {
        for (const cell of flightPath) {
            if (cansee(cell.x, cell.y)) {
                if (transientCell)
                    newsym(transientCell.x, transientCell.y);
                show_glyph_cell(
                    cell.x, cell.y, glyph.ch, glyph.color,
                    glyph.decgfx, glyph.attr, glyph,
                );
                transientCell = cell;
                transientCursor = lastDirtyMapCursor()
                    ?? [cell.x, cell.y + 1];
            }
            const frameCursor = transientCursor ?? lastDirtyMapCursor();
            await flush_screen(1);
            if (frameCursor)
                state.nhDisplay?.setCursor(...frameCursor);
            await state.animationFrame?.();
        }
    } finally {
        if (transientCell)
            newsym(transientCell.x, transientCell.y);
    }
}
