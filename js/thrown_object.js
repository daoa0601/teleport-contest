// Objects thrown by the hero.
// C refs: dothrow.c throw_obj(), invent.c freeinv(), mkobj.c splitobj(),
// and zap.c bhit().

import {
    A_STR, BOLT_LIM, DOOR, D_CLOSED, D_LOCKED, IRONBARS, IS_LAVA, IS_POOL,
    IS_SOFT, IS_WATERWALL, Is_airlevel, LAVAWALL, LOST_THROWN,
    M_AP_OBJECT, P_CROSSBOW, SINK, WEB, ZAP_POS, isok,
} from './const.js';
import { currentAttribute } from './attrib.js';
import {
    flush_screen, lastDirtyMapCursor, newsym, plineWithContinuation,
    show_glyph_cell, transientObjectGlyph,
} from './display.js';
import { applyFloorEffects } from './floor_effects.js';
import { place_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { wakeMonstersNear } from './monster_wake.js';
import {
    MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE,
} from './monster_data.js';
import { breakFloorObject } from './object_breakage.js';
import {
    BOULDER, CORPSE, CREDIT_CARD, ENORMOUS_MEATBALL, HEAVY_IRON_BALL,
    LENSES, LOCK_PICK, MAGIC_WHISTLE, MEAT_STICK, OBJECT_MATERIAL,
    OBJECT_NAMES, OBJECT_SUBTYPE, SKELETON_KEY, STATUE, TALLOW_CANDLE,
    TIN_WHISTLE, WAX_CANDLE,
} from './object_data.js';
import { objectClassForType } from './object_knowledge.js';
import {
    isLauncherAmmunition, launcherMatchesAmmo,
} from './object_properties.js';
import { shipObject } from './object_migration.js';
import { splitObjectStack } from './object_stack.js';
import { rn2 } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { settleThrownShopObject } from './shk.js';
import { cansee } from './vision.js';

const EQUIPMENT_SLOTS = [
    'uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmu', 'uarmc', 'uarmh',
    'uarmg', 'uarmf', 'uarms', 'uleft', 'uright', 'uamul', 'ublindf',
];

const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const TOOL_CLASS = 6;
const FOOD_CLASS = 7;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const ROCK_CLASS = 14;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const ARM_GLOVES = 3;
const LEATHER = 7;

const SMALL_WEAPON_SKILLS = new Set([-20, -22, -23, -24, 17, 2]);
const SMALL_TOOLS = new Set([
    SKELETON_KEY, LOCK_PICK, CREDIT_CARD, TALLOW_CANDLE, WAX_CANDLE,
    LENSES, TIN_WHISTLE, MAGIC_WHISTLE,
]);
const BAR_BLOCKED_CLASSES = new Set([
    SPBOOK_CLASS, WAND_CLASS, BALL_CLASS, CHAIN_CLASS,
]);

function objectClass(object) {
    return object?.oclass || objectClassForType(object?.otyp);
}

function closedDoor(location) {
    return location?.typ === DOOR
        && !!((location.doormask ?? 0) & (D_CLOSED | D_LOCKED));
}

function liveMonsterAt(state, x, y) {
    return (state.level?.monsters || []).find(monster =>
        monster && !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function webAt(state, x, y) {
    return (state.level?.traps || []).find(trap =>
        trap?.ttyp === WEB
        && (trap.tx ?? trap.x) === x
        && (trap.ty ?? trap.y) === y) || null;
}

function projectileMonsterAt(state, object, x, y) {
    const monster = liveMonsterAt(state, x, y);
    if (!monster) return null;
    const material = OBJECT_MATERIAL[object?.otyp] ?? 0;
    if (MONSTER_NAME[monster.mnum] === 'shade' && material !== 14)
        return null;
    if (monster.m_ap_type === M_AP_OBJECT) {
        const remembered = state.level?.at?.(x, y)?.remembered_glyph;
        if (!['monster', 'warning', 'invisible'].includes(remembered?.kind))
            return null;
    }
    return monster;
}

function objectHitsBars(object) {
    const oclass = objectClass(object);
    if (oclass === WEAPON_CLASS)
        return !SMALL_WEAPON_SKILLS.has(OBJECT_SUBTYPE[object.otyp]);
    if (oclass === ARMOR_CLASS)
        return OBJECT_SUBTYPE[object.otyp] !== ARM_GLOVES;
    if (oclass === TOOL_CLASS) return !SMALL_TOOLS.has(object.otyp);
    if (oclass === ROCK_CLASS) {
        return object.otyp !== STATUE
            || (MONSTER_SIZE[object.corpsenm] ?? 1) > 0;
    }
    if (oclass === FOOD_CLASS) {
        return (object.otyp === CORPSE
                && (MONSTER_SIZE[object.corpsenm] ?? 1) > 0)
            || object.otyp === MEAT_STICK
            || object.otyp === ENORMOUS_MEATBALL;
    }
    return BAR_BLOCKED_CLASSES.has(oclass);
}

function harmlessMissile(object) {
    const name = OBJECT_NAMES[object.otyp];
    if (['sling', 'eucalyptus leaf', 'kelp frond', 'sprig of wolfsbane',
        'fortune cookie', 'pancake'].includes(name)) return true;
    if (name === 'rubber hose' || name === 'bag of tricks')
        return (object.spe ?? 0) < 1;
    if (['sack', 'oilskin sack', 'bag of holding'].includes(name))
        return !(object.contents?.length);
    return objectClass(object) === 9
        || OBJECT_MATERIAL[object.otyp] === 6;
}

function barSound(object) {
    if ([BOULDER, HEAVY_IRON_BALL].includes(object.otyp)) return 'Whang';
    if (objectClass(object) === COIN_CLASS
        || [14, 15].includes(OBJECT_MATERIAL[object.otyp])) return 'Clink';
    if (harmlessMissile(object)) return 'Whap';
    if ((OBJECT_MATERIAL[object.otyp] ?? 0) <= LEATHER
        || OBJECT_NAMES[object.otyp] === 'rubber hose') return 'Flapp';
    return 'Clonk';
}

function thrownObjectSubject(object) {
    if (objectClass(object) === COIN_CLASS) return 'The gold';
    return `The ${object.name || OBJECT_NAMES[object.otyp] || 'object'}`;
}

async function hitIronBars(object, x, y, barsX, barsY, {
    state, publish, random,
}) {
    object.ox = x;
    object.oy = y;
    const { destroyed } = await breakFloorObject(object, {
        state, publish, random,
    });
    if (destroyed) return true;

    if (!heroIsDeaf(state)) await publish(`${barSound(object)}!`);
    if (!harmlessMissile(object)
        && (OBJECT_MATERIAL[object.otyp] ?? 0) > LEATHER) {
        wakeMonstersNear(barsX, barsY, 16, state);
    }
    return false;
}

function heroThrowStrength(state) {
    let strength = currentAttribute(A_STR, state);
    if (strength <= 18) strength = Math.max(strength, 3);
    else if (strength <= 121) strength = 19 + Math.trunc(strength / 50);
    else strength = Math.min(strength, 125) - 100;
    return strength;
}

export function heroThrowRange(object, state = game) {
    return Math.max(
        1,
        Math.trunc(heroThrowStrength(state) / 2)
            - Math.trunc((object.owt ?? 1) / 40),
    );
}

export function heroThrowTrajectory(object, state = game, launcher = null) {
    const launched = launcherMatchesAmmo(object, launcher);
    const crossbowing = launched
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

export function prepareHeroThrownTarget(monster, random = rn2) {
    const immobilized = monster.mcanmove === 0 || monster.mcanmove === false;
    const speciesCanMove = (MONSTER_MOVE[monster.mnum]
        ?? monster.mmove ?? 0) > 0;
    if (immobilized && speciesCanMove && random(10) === 0) {
        monster.mcanmove = 1;
        monster.mfrozen = 0;
    }
}

export async function finishHeroThrownObjectLanding({
    state = game,
    object,
    x,
    y,
    contactedMonster = false,
    publish = plineWithContinuation,
    random = rn2,
}) {
    object.ox = x;
    object.oy = y;

    if (!IS_SOFT(state.level?.at?.(x, y)?.typ)) {
        const { destroyed } = await breakFloorObject(object, {
            state,
            publish,
            random,
        });
        if (destroyed) return null;
    }

    const floorEffect = await applyFloorEffects(object, x, y, {
        state,
        publish,
        random,
    });
    if (floorEffect.finished) return floorEffect.object;

    if (!contactedMonster && !liveMonsterAt(state, x, y)
        && await shipObject(object, x, y, { state, publish, random })) {
        return null;
    }

    place_object(object, x, y, state);
    await settleThrownShopObject(object, x, y, state);
    const landed = stack_object(object, state);
    newsym(x, y);
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
}) {
    let x = startX;
    let y = startY;
    const path = [];
    let contact = null;
    let stoppedBy = 'range';
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
            if (forcedHit || objectHitsBars(object)) {
                destroyed = await hitIronBars(
                    object, previousX, previousY, x, y,
                    { state, publish, random },
                );
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

        if (kicked && await shipObject(object, x, y, {
            state,
            publish,
            random,
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
        if (kicked && (IS_POOL(location.typ) || IS_LAVA(location.typ))) {
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

export function flyHeroThrownObject(options) {
    const state = options.state ?? game;
    return flyPhysicalObject({
        ...options,
        state,
        startX: state.u?.ux ?? 0,
        startY: state.u?.uy ?? 0,
    });
}

export function flyKickedObject(options) {
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
export function detachThrownUnit(
    state, item, selectedQuantity, splitObjectId = null,
) {
    let thrown = item;
    if (selectedQuantity > 1) {
        thrown = splitObjectStack(
            item, 1, state, splitObjectId,
        );
        thrown.invlet = null;
        thrown.where = 'free';
    } else {
        const index = state.inventory.indexOf(item);
        if (index >= 0) state.inventory.splice(index, 1);
        for (const slot of EQUIPMENT_SLOTS) {
            if (state[slot] === item) state[slot] = null;
            if (state.u?.[slot] === item) state.u[slot] = null;
        }
        thrown.owornmask = 0;
        thrown.worn = false;
        thrown.wornSlot = null;
        thrown.wielded = false;
        thrown.alternate = false;
        thrown.ready = false;
        thrown.where = 'free';
    }
    thrown.how_lost = LOST_THROWN;
    return thrown;
}

export async function captureThrownObjectFlight(
    object, flightPath, state = game,
) {
    const glyph = transientObjectGlyph(object);
    let transientCell = null;
    let transientCursor = null;
    try {
        for (const cell of flightPath) {
            if (cansee(cell.x, cell.y)) {
                if (transientCell)
                    newsym(transientCell.x, transientCell.y);
                show_glyph_cell(
                    cell.x, cell.y, glyph.ch, glyph.color,
                    glyph.decgfx, glyph.attr,
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
