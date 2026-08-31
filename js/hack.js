// Effects of entering the hero's current square.
// C ref: hack.c pooleffects() and trap.c drown().

import {
    D_BROKEN, D_CLOSED, D_LOCKED, DISMOUNT_GENERIC, DOOR, IS_LAVA,
    IS_OBSTRUCTED, IS_POOL, IS_WALL, Is_waterlevel, STONE, TREE, WATER,
    W_NONDIGGABLE, W_NONPASSWALL,
    WT_TOOMUCH_DIAGONAL,
} from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import {
    beginHeroLifeSaving, completeHeroLifeSaving, finishOrdinaryDeath,
} from './end.js';
import { game } from './gstate.js';
import { splitHeroMonsterForm, place_object, stack_object } from './mklev.js';
import {
    MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_SIZE, MONSTER_SYMBOL,
} from './monster_data.js';
import { BOULDER, LEASH, LOADSTONE } from './object_data.js';
import { rehumanizeHero } from './polyself.js';
import { d, rn2, rnd } from './rng.js';
import { waterDamageChain } from './trap.js';
import { dismountHero, steedIsGrounded } from './steed.js';
import {
    heroCanTeleport, heroControlsTeleport, heroIsUnaware,
    moveHeroByTeleport, safeTeleportDestination, teleportHeroAtWill,
} from './teleport.js';
import { heroTeleportRestricted } from './teleport_rules.js';
import { vision_recalc, vision_reset } from './vision.js';
import {
    inventoryWeight, nearCapacity, SLT_ENCUMBER, UNENCUMBERED,
} from './weight.js';
import { findArmorClass } from './armor.js';

const CRAWL_DX = [-1, -1, 0, 1, 1, 1, 0, -1];
const CRAWL_DY = [0, -1, -1, -1, 0, 1, 1, 1];
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_TUNNEL = 0x00000020;
const M1_NEEDPICK = 0x00000040;
const M1_SWIM = 0x00000002;
const M1_SLITHY = 0x00080000;
const M1_UNSOLID = 0x00100000;
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;
const S_VORTEX = 22;
const PM_GREMLIN = 40;
const PM_GRID_BUG = 112;
const PM_AIR_ELEMENTAL = 154;
const PM_IRON_GOLEM = 259;

function heroFormFlags(state) {
    if (!(state.u?.mtimedone > 0)
        || !Number.isInteger(state.u?.umonnum)) return 0;
    return MONSTER_FLAGS1[state.u.umonnum] ?? 0;
}

function squareBlocksHero(state, x, y) {
    const location = state.level?.at?.(x, y);
    if (!location || location.typ === STONE
        || IS_OBSTRUCTED(location.typ)) return true;
    return location.typ === DOOR
        && !!(location.doormask & (D_CLOSED | D_LOCKED));
}

function doorlessDoor(location) {
    return location?.typ === DOOR
        && !((location.doormask || 0) & ~D_BROKEN);
}

export function blocksDiagonalDoor(current, destination) {
    return (destination?.typ === DOOR && !doorlessDoor(destination))
        || (current?.typ === DOOR && !doorlessDoor(current));
}

export function heroBadRock(state, x, y) {
    const location = state.level?.at?.(x, y);
    if (!location) return true;
    const pile = state.level?.objects?.[x]?.[y] || [];
    if (state.level?.flags?.sokoban_rules
        && pile.some(object => object.otyp === BOULDER)) return true;
    if (!IS_OBSTRUCTED(location.typ)) return false;

    const flags = heroFormFlags(state);
    const mayDig = !((IS_WALL(location.typ) || location.typ === TREE)
        && ((location.wall_info ?? 0) & W_NONDIGGABLE));
    const mayPassWall = !(IS_WALL(location.typ)
        && ((location.wall_info ?? 0) & W_NONPASSWALL));
    const cannotTunnel = !(flags & M1_TUNNEL)
        || !!(flags & M1_NEEDPICK) || !mayDig;
    const cannotPass = !((flags & M1_WALLWALK) && mayPassWall);
    return cannotTunnel && cannotPass;
}

export function heroTightDiagonalReason(state = game) {
    const u = state.u || {};
    const flags = heroFormFlags(state);
    if (flags & M1_WALLWALK) return 0;

    const mnum = u.mtimedone > 0 ? u.umonnum : null;
    const flexible = !!(flags & (M1_AMORPHOUS | M1_SLITHY | M1_UNSOLID))
        || MONSTER_SYMBOL[mnum] === S_VORTEX
        || mnum === PM_AIR_ELEMENTAL;
    if (mnum !== null && (MONSTER_SIZE[mnum] ?? 2) >= 3 && !flexible)
        return 1;
    if (inventoryWeight(state) > WT_TOOMUCH_DIAGONAL) return 2;
    if (state.level?.flags?.sokoban_rules) return 3;
    return 0;
}

function crawlDestinationAllowed(state, x, y) {
    const u = state.u;
    const location = state.level?.at?.(x, y);
    if (!u || !location || squareBlocksHero(state, x, y)
        || IS_POOL(location.typ) || IS_LAVA(location.typ)) return false;
    if (state.level?.monsters?.some(monster =>
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y)) return false;
    if (x === u.ux || y === u.uy) return true;
    if (u.mtimedone > 0 && u.umonnum === PM_GRID_BUG) return false;
    if (heroFormFlags(state) & M1_WALLWALK) return true;
    if (location.typ === DOOR && !doorlessDoor(location)) return false;
    return !(heroBadRock(state, u.ux, y)
        && heroBadRock(state, x, u.uy)
        && heroTightDiagonalReason(state));
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
        if (crawlDestinationAllowed(state, candidate.x, candidate.y))
            return candidate;
    }
    return null;
}

function heroStaysAboveWater(state, location) {
    const u = state.u || {};
    if (u.levitating || u.levitation || u.flying || u.flight) return true;
    const waterWalking = !!(u.waterWalking || u.water_walking);
    return waterWalking && location?.typ !== WATER;
}

function heroCanLiveUnderwater(state) {
    const u = state.u || {};
    const flags = heroFormFlags(state);
    return !!(u.amphibious || u.swimming || u.breathless
        || (flags & (M1_SWIM | M1_AMPHIBIOUS | M1_BREATHLESS)));
}

function heroDoesNotNeedAir(state) {
    const u = state.u || {};
    const flags = heroFormFlags(state);
    return !!(u.amphibious || u.breathless
        || (flags & (M1_AMPHIBIOUS | M1_BREATHLESS)));
}

function heroCanSwim(state) {
    return !!(state.u?.swimming || (heroFormFlags(state) & M1_SWIM));
}

function equippedObject(state, slot) {
    return state[slot] || state.u?.[slot] || null;
}

function canDropWhileDrowning(object, state) {
    const beingStolen = object?.o_id !== undefined
        && (object.o_id === state.stealoid
            || object.o_id === state._stealoid);
    if (!object || object.in_use || beingStolen) return false;
    if (object.otyp === LOADSTONE && object.cursed) return false;
    for (const slot of [
        'uamul', 'uleft', 'uright', 'ublindf',
        'uarm', 'uarmc', 'uarmg', 'uarmf', 'uarmu',
    ]) {
        if (equippedObject(state, slot) === object) return false;
    }
    if (object.cursed && [
        equippedObject(state, 'uarmh'), equippedObject(state, 'uarms'),
    ].includes(object)) return false;
    const weapon = equippedObject(state, 'uwep');
    if (weapon === object && object.cursed) return false;
    return true;
}

function pickEmergencyDrop(state, random) {
    const inventory = state.inventory || [];
    if (!inventory.length) return null;
    let remaining = random(inventory.length);
    let candidate = null;
    for (const object of inventory) {
        if (canDropWhileDrowning(object, state)) candidate = object;
        remaining--;
        if (remaining < 0 && candidate) break;
    }
    return candidate;
}

function dropEmergencyObject(object, state) {
    state.inventory = (state.inventory || []).filter(item => item !== object);
    for (const slot of [
        'uwep', 'uswapwep', 'uquiver', 'uarmh', 'uarms',
    ]) {
        if (state[slot] === object) state[slot] = null;
        if (state.u?.[slot] === object) state.u[slot] = null;
    }
    object.owornmask = 0;
    object.worn = false;
    object.wornSlot = null;
    object.wielded = false;
    place_object(object, state.u.ux, state.u.uy);
    stack_object(object, state);
}

function emergencyDisrobe(state, random) {
    const capacityLimit = state.uball || state.u?.uball
        ? UNENCUMBERED : SLT_ENCUMBER;
    let dropped = false;
    while (nearCapacity(state) > capacityLimit) {
        const object = pickEmergencyDrop(state, random);
        if (!object) return { escaped: false, dropped };
        dropEmergencyObject(object, state);
        dropped = true;
    }
    if (dropped) findArmorClass(state);
    return { escaped: true, dropped };
}

function releaseLeashes(state) {
    const leashed = (state.level?.monsters || []).filter(monster =>
        monster?.mleashed && (monster.mhp ?? 1) > 0);
    if (!leashed.length) return 0;
    for (const monster of leashed) monster.mleashed = 0;
    for (const object of state.inventory || []) {
        if (object.otyp === LEASH) object.leashmon = 0;
    }
    return leashed.length;
}

function heroMovedWithinPool(state, x, y) {
    if (!state.u?.uinwater) return false;
    const previousX = Number.isInteger(state.u.ux0) ? state.u.ux0 : x;
    const previousY = Number.isInteger(state.u.uy0) ? state.u.uy0 : y;
    return IS_POOL(state.level?.at?.(previousX, previousY)?.typ);
}

function heroIsOnWaterLevel(state) {
    if (state.level?.flags?.is_waterlevel) return true;
    if (state !== game) {
        const current = state.u?.uz;
        const water = state.water_level;
        return !!current && !!water
            && current.dnum === water.dnum
            && current.dlevel === water.dlevel;
    }
    return Is_waterlevel(state.u?.uz);
}

async function wakeHeroForCrawl(state, publish) {
    const u = state.u;
    if (u.usleep) {
        u.usleep = 0;
        state._helplessTurns = 0;
        state._helplessReason = null;
        state._helplessDoneMessage = null;
        await publish('Suddenly you wake up!');
        return;
    }
    if (state._helplessReason === 'unconscious from rotten food'
        || state._helplessReason === 'unconscious from drinking') {
        state._helplessTurns = 0;
        state._helplessReason = null;
        state._helplessDoneMessage = null;
    }
}

async function applyHeroFormWaterEffect(state, publish, random, rollDice) {
    const u = state.u;
    if (!(u.mtimedone > 0)) return null;
    if (u.umonnum === PM_GREMLIN && random(3) !== 0) {
        const clone = await splitHeroMonsterForm(state);
        if (clone) await publish('You multiply!');
        return clone ? { kind: 'split', clone } : null;
    }
    if (u.umonnum !== PM_IRON_GOLEM) return null;

    await publish('You rust!');
    let damage = rollDice(2, 6);
    if (u.halfPhysicalDamage || u.half_physical_damage)
        damage = Math.trunc((damage + 1) / 2);
    if ((u.mhmax ?? 0) > damage) u.mhmax -= damage;
    u.mh = Math.max(0, (u.mh ?? 1) - damage);
    if (u.mh > 0) return { kind: 'rust', damage };

    const restored = rehumanizeHero(state);
    if (restored.changed)
        await publish(`You return to ${restored.race} form!`);
    return { kind: 'rust', damage, rehumanized: restored.changed };
}

async function finishWaterTeleport(
    movement,
    {
        state,
        repaint,
        resetVision,
        recalculateVision,
        applyLandingEffects,
    },
) {
    state.u.uinwater = 0;
    state.underwater = false;
    repaint(movement.oldx, movement.oldy);
    resetVision();
    recalculateVision(0);
    repaint(movement.x, movement.y);
    const from = { x: movement.oldx, y: movement.oldy };
    const to = { x: movement.x, y: movement.y };
    await applyLandingEffects({ from, to });
    return { entered: true, moved: true, died: false, from, to };
}

export async function heroEntersPool({
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    recalculateVision = vision_recalc,
    resetVision = vision_reset,
    repaint = newsym,
    rollDice = d,
    rollOne = rnd,
    chooseTeleportDestination = null,
    applyLandingEffects = async () => {},
    die = finishOrdinaryDeath,
} = {}) {
    const u = state.u;
    let x = u?.ux;
    let y = u?.uy;
    let location = state.level?.at?.(x, y);
    if (!u || !location || !IS_POOL(location.typ) || u.ustuck) return null;
    if (u.usteed && !steedIsGrounded(u.usteed, state)) return null;
    if (heroStaysAboveWater(state, location)) return null;

    if (u.usteed) {
        const dismount = await dismountHero(DISMOUNT_GENERIC, {
            state,
            random,
            announce: publish,
        });
        if (dismount.movement) {
            const from = {
                x: dismount.movement.oldx,
                y: dismount.movement.oldy,
            };
            repaint(from.x, from.y);
            resetVision();
            recalculateVision(0);
            repaint(u.ux, u.uy);
            await applyLandingEffects({
                from,
                to: { x: u.ux, y: u.uy },
            });
            x = u.ux;
            y = u.uy;
            location = state.level?.at?.(x, y);
            if (!IS_POOL(location?.typ)) {
                u.uinwater = 0;
                state.underwater = false;
                return {
                    entered: true, moved: true, died: false,
                    from, to: { x, y },
                };
            }
        }
    }

    const waterWall = location.typ === WATER;
    let canLiveUnderwater = heroCanLiveUnderwater(state);
    let stayingInPool = false;
    if (heroMovedWithinPool(state, x, y) && canLiveUnderwater) {
        if (random(5) !== 0)
            return { entered: true, moved: false, died: false };
        stayingInPool = true;
    }
    if (!u.uinwater) {
        await publish(waterWall
            ? 'You plunge into the wall of water!'
            : 'You fall into the pool of water!');
        if (!heroCanSwim(state) && !waterWall)
            await publish(u.hallucinating || u.hallucinationTurns > 0
                ? 'You sink like the Titanic.' : 'You sink like a rock.');
    }

    const damageMessages = [];
    await waterDamageChain(state.inventory || [], damageMessages, state);
    for (const message of damageMessages) await publish(message);

    const formEffect = await applyHeroFormWaterEffect(
        state, publish, random, rollDice,
    );
    canLiveUnderwater = heroCanLiveUnderwater(state);
    if (stayingInPool) {
        return {
            entered: true, moved: false, died: false, formEffect,
        };
    }

    const leashCount = releaseLeashes(state);
    if (leashCount) {
        await publish(leashCount === 1
            ? 'The leash slips loose.' : 'The leashes slip loose.');
    }

    if (canLiveUnderwater) {
        if (heroDoesNotNeedAir(state))
            await publish("But you aren't drowning.");
        u.uinwater = 1;
        recalculateVision(1);
        return { entered: true, moved: false, died: false };
    }

    const luck = u.uluck ?? u.luck ?? 0;
    if (heroCanTeleport(state) && !heroIsUnaware(state)
        && (heroControlsTeleport(state) || random(3) < luck + 2)) {
        await publish('You attempt a teleport spell.');
        if (heroTeleportRestricted(state)) {
            await publish('The attempted teleport spell fails.');
        } else {
            const teleport = await teleportHeroAtWill({
                state, random, rollOne,
                chooseDestination: chooseTeleportDestination,
            });
            for (const message of teleport.messages)
                await publish(message);
            if (teleport.moved) {
                return finishWaterTeleport(teleport.movement, {
                    state,
                    repaint,
                    resetVision,
                    recalculateVision,
                    applyLandingEffects,
                });
            }
        }
    }

    await wakeHeroForCrawl(state, publish);
    const canMove = !(state._helplessTurns > 0)
        && (!(u.mtimedone > 0) || (MONSTER_MOVE[u.umonnum] ?? 0) > 0);
    const destination = canMove
        ? crawlDestination(state, x, y, random) : null;
    if (destination) {
        const escape = heroIsOnWaterLevel(state)
            ? { escaped: true, dropped: false }
            : emergencyDisrobe(state, random);
        await publish('You try to crawl out of the water.');
        if (escape.dropped)
            await publish('You dump some of your gear to lose weight...');
        if (escape.escaped) {
            await publish('Pheew!  That was close.');
            u.ux0 = x;
            u.uy0 = y;
            u.ux = destination.x;
            u.uy = destination.y;
            repaint(x, y);
            recalculateVision(1);
            repaint(destination.x, destination.y);
            await applyLandingEffects({
                from: { x, y },
                to: destination,
            });
            return {
                entered: true, moved: true, died: false,
                from: { x, y }, to: destination,
            };
        }
        await publish('But in vain.');
    }

    u.uinwater = 1;
    await publish('You drown.');
    for (let attempt = 0; attempt < 2; attempt++) {
        u.uhp = 0;
        const lifeSaving = state === game ? beginHeroLifeSaving(random) : null;
        if (!lifeSaving) {
            await die({
                killer: 'deep water',
                possessionAnswer: 'n',
                deathVerb: 'drowned',
            });
            if (state.context) state.context.move = 0;
            return { entered: true, moved: false, died: true };
        }

        await publish('But wait...  Your medallion begins to glow!');
        completeHeroLifeSaving(lifeSaving);
        await publish('You feel much better!');
        await publish('The medallion crumbles to dust!');

        const destination = safeTeleportDestination(state, random, rollOne);
        if (destination) {
            const movement = moveHeroByTeleport(
                destination.x, destination.y, state,
            );
            if (state.flags?.verbose !== false) {
                await publish('You materialize in a different location!');
            }
            return finishWaterTeleport(movement, {
                state,
                repaint,
                resetVision,
                recalculateVision,
                applyLandingEffects,
            });
        }
        if (attempt === 0) await publish("You're still drowning.");
    }

    if (state.context) state.context.move = 0;
    return { entered: true, moved: false, died: true };
}
