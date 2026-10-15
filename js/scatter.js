import { currency } from './currency.js';
// Floor objects thrown outward by an explosion or collapsing structure.
// C ref: explode.c:scatter() and mthrowu.c:ohitmon().
import { monsterHasMapPosition } from './monster_location.js';
import { deleteTrap } from './trap_lifecycle.js';
import { DOOR, D_CLOSED, D_LOCKED, SHOPBASE, SINK, STATUE_TRAP, ZAP_POS, isok, } from './const.js';
import { newsym } from './display.js';
import { applyFloorEffects, landFloorObject } from './floor_effects.js';
import { placeObject, stack_object, } from './floor_object.js';
import { game, requireLiveGame } from './gstate.js';
import { unlinkObject } from './object_location.js';
import { wakeMonster } from './monster_anger.js';
import { wakeMonstersNear } from './monster_wake.js';
import { heroSpecies } from './hero_species.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { hitHeroWithThrownPotion } from './hero_potion_hit.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { stopHeroOccupation } from './occupation.js';
import { addShopObjectToBill, costlySpot } from './shk.js';
import { roomsAt } from './room.js';
import { MONSTER_SIZE, MONSTER_NAME } from './monster_data.js';
import { findMonsterArmorClass } from './monworn.js';
import { BOULDER, EGG, GOLD_PIECE, OBJECT_MATERIAL, OBJECT_NAMES, ROCK, STATUE, } from './object_data.js';
import { breakFloorObject, } from './object_breakage.js';
import { splitObjectStack } from './object_stack.js';
import { hitMonsterWithSupportedPotion } from './potion_hit.js';
import { d, rn2, rnd } from './rng.js';
import { objectWeight } from './weight.js';
import { rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero, } from './weapon_damage.js';
import { rangedTargetHitBonus } from './weapon_accuracy.js';
const GEM_CLASS = 13;
const GLASS = 19;
const POTION_CLASS = 8;
const DIRECTIONS = [
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 1 },
];
function floorPile(state, x, y) {
    return state.level?.objects?.[x]?.[y] || [];
}
async function placeOnFloor(object, x, y, state) {
    await placeObject(object, x, y, state);
    await stack_object(object, state);
    return object;
}
function removeFloorObject(object, state) {
    unlinkObject(object, state);
}
function squareIsVisible(state, x, y) {
    return !state.blind && !((state.u.blindTurns ?? 0) > 0)
        && (!state.viz_array || !!((state.viz_array?.[y]?.[x] ?? 0) & 0x2));
}
function monsterIsVisible(monster, state) {
    const seesInvisible = !!state.u.seeInvisible;
    return squareIsVisible(state, monster.mx, monster.my)
        && !monster.mundetected && (!monster.minvis || seesInvisible);
}
function monsterAt(state, x, y) {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}
function openFlightSquare(state, x, y) {
    if (!isok(x, y))
        return false;
    const location = state.level?.at(x, y);
    if (!location)
        return false;
    return ZAP_POS(location.typ)
        && (location.typ !== DOOR
            || !(location.doormask & (D_CLOSED | D_LOCKED)));
}
function objectName(object) {
    return object.name || OBJECT_NAMES[object.otyp] || 'object';
}
async function finishScatteredMonsterDeath(monster, x, y, death, state, options) {
    if (options.finishMonsterKill) {
        const killed = await options.finishMonsterKill(monster, x, y, death);
        return { killed, heroDied: !!state.program_state.gameover };
    }
    if (!options.finishMonsterDeath) {
        throw new TypeError('lethal scattered object requires a monster death handler');
    }
    const result = await options.finishMonsterDeath(monster, {
        ...death,
        random: options.random,
        publish: options.publish,
    });
    return { killed: !result.survived, heroDied: !!result.heroDied };
}
async function breakAtRest(object, state, options) {
    object.ox = options.x;
    object.oy = options.y;
    const result = await breakFloorObject(object, {
        state,
        heroCaused: options.heroCaused,
        publish: options.publish,
        random: options.random,
        rollDice: options.rollDice,
    });
    if (result.destroyed)
        return true;
    // A fatal vapor or oil blast ends the scatter even though the bottle
    // itself reports not destroyed.
    if (state.program_state?.gameover)
        return true;
    await placeOnFloor(object, options.x, options.y, state);
    return false;
}
async function hitMonster(monster, node, state, options) {
    const object = node.object;
    if (!object)
        return false;
    const visible = monsterIsVisible(monster, state);
    const threshold = 5 + findMonsterArmorClass(monster)
        + rangedTargetHitBonus(object, monster, {
            state, random: options.random, rollOne: options.rollOne,
        });
    if (threshold < options.rollOne(20)) {
        if (visible)
            await options.publish(`The ${objectName(object)} misses the ${MONSTER_NAME[monster.mnum] || 'monster'}.`);
        return false;
    }
    const name = MONSTER_NAME[monster.mnum] || 'monster';
    if (object.oclass === POTION_CLASS) {
        const potionOptions = {
            state,
            monster,
            potion: object,
            targetVisible: visible,
            targetSpotted: visible,
            publish: options.publish,
            wakeMonster: target => wakeMonster(target, {
                attacked: options.heroCaused,
            }),
            wakeNearby: (nearX, nearY, distance) => wakeMonstersNear(nearX, nearY, distance, state),
            finishKill: (target, deathOptions = {}) => finishScatteredMonsterDeath(target, target.mx, target.my, deathOptions, state, options),
            heroCaused: options.heroCaused,
        };
        const impact = await hitMonsterWithSupportedPotion(potionOptions);
        if (impact?.heroDied)
            return true;
        if (!impact) {
            await breakAtRest(object, state, {
                ...options,
                x: node.x,
                y: node.y,
            });
        }
        node.object = null;
        node.stopped = true;
        return true;
    }
    if (visible)
        await options.publish(`The ${objectName(object)} hits the ${name}.`);
    const damage = rollPhysicalWeaponDamage(object, monster, {
        rollOne: options.rollOne,
    });
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    monster.msleeping = 0;
    if (monster.mhp <= 0) {
        if (!options.finishMonsterDeath) {
            throw new TypeError('lethal scattered object requires a monster death handler');
        }
        await options.finishMonsterDeath(monster, {
            deathMessage: visible ? `The ${name} is killed!` : null,
            random: options.random,
            publish: options.publish,
        });
    }
    else {
        await wakeMonster(monster, { attacked: options.heroCaused });
    }
    await breakAtRest(object, state, {
        ...options,
        x: node.x,
        y: node.y,
    });
    node.object = null;
    node.stopped = true;
    return true;
}
async function hitHero(node, state, options) {
    const object = node.object;
    if (!object)
        return false;
    const attack = 8 + (object.spe ?? 0)
        + ((MONSTER_SIZE[heroSpecies(state)] ?? 2) >= 3 ? 1 : 0);
    if (state.multi)
        endVoluntaryMultiTurn(state);
    if (object.oclass !== POTION_CLASS) {
        let damage = rollPhysicalWeaponDamageAgainstHero(object, state, { rollOne: options.rollOne });
        if (state.u.halfPhysicalDamage)
            damage = Math.trunc((damage + 1) / 2);
        const result = await hitHeroWithObject(object, damage, attack, {
            state, publish: options.publish, rollOne: options.rollOne,
        });
        if (result.hit) {
            node.range -= 3;
            await stopHeroOccupation(state, options.publish);
        }
        return result.hit;
    }
    if ((state.u.uac ?? 10) + attack <= options.rollOne(20))
        return false;
    await options.publish(`You are hit by ${objectName(object)}.`);
    await hitHeroWithThrownPotion(object, {
        state, publish: options.publish, random: options.random,
        rollOne: options.rollOne, rollDice: options.rollDice, source: 'propelled',
    });
    node.object = null;
    node.stopped = true;
    return true;
}
async function fractureObject(object, x, y, state, options) {
    if (squareIsVisible(state, x, y)) {
        const verb = object.otyp === BOULDER ? 'breaks apart' : 'crumbles';
        await options.publish(`The ${objectName(object)} ${verb}.`);
    }
    else if (!state.u?.deaf && !state.deaf) {
        await options.publish(object.otyp === BOULDER
            ? 'You hear stone breaking.'
            : 'You hear stone crumbling.');
    }
    if (object.otyp === STATUE) {
        const contents = object.contents || [];
        for (const item of contents) {
            unlinkObject(item, state);
            await placeOnFloor(item, x, y, state);
        }
        object.contents = [];
        const statueTrap = state.level?.traps.find(trap => trap.tx === x && trap.ty === y && trap.ttyp === STATUE_TRAP);
        if (statueTrap)
            deleteTrap(statueTrap, state);
    }
    object.otyp = ROCK;
    object.oclass = GEM_CLASS;
    object.quan = object.quantity = options.rollOne(60) + 6;
    object.owt = objectWeight(object);
    object.dknown = false;
    object.bknown = false;
    object.rknown = false;
    object.known = true;
    delete object.oextra;
    await placeOnFloor(object, x, y, state);
}
async function prepareScatteredObject(object, x, y, state, options) {
    removeFloorObject(object, state);
    if (options.mayFracture
        && (object.otyp === BOULDER || object.otyp === STATUE)
        && options.random(10) !== 0) {
        await fractureObject(object, x, y, state, options);
        return null;
    }
    if (options.mayDestroy) {
        const destructionRoll = options.random(10);
        const fragile = OBJECT_MATERIAL[object.otyp] === GLASS
            || object.otyp === EGG;
        if (destructionRoll === 0 || fragile) {
            // Native scatter() uses breaks(), even during the hero's turn.
            // Combat credit still depends on who caused the scatter.
            const broken = await breakFloorObject(object, {
                state,
                heroCaused: false,
                publish: options.publish,
                random: options.random,
                rollDice: options.rollDice,
            });
            if (broken.destroyed)
                return null;
            // A fatal vapor or oil blast ends the scatter even though the
            // bottle itself reports not destroyed.
            if (state.program_state?.gameover)
                return null;
        }
    }
    const direction = DIRECTIONS[options.random(DIRECTIONS.length)];
    if (!direction)
        throw new RangeError('Scattering selected an invalid direction.');
    const maximumRange = Math.max(1, options.force - Math.trunc((object.owt ?? 1) / 40));
    return {
        object,
        x,
        y,
        dx: direction.dx,
        dy: direction.dy,
        range: options.rollOne(maximumRange),
        stopped: false,
    };
}
function nextObjectFromPile(pile, state, options) {
    const object = options.onlyObject || pile[0];
    if (!object || !options.onlyObject && !pile.includes(object))
        return null;
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity <= 1)
        return { object, lastPiece: true };
    const part = splitObjectStack(object, options.rollOne(quantity - 1), state);
    if (!part)
        throw new Error(`Cannot split scattered object ${object.o_id}.`);
    return { object: part, lastPiece: false };
}
export async function scatterFloorObjects(x, y, force, { state = game, onlyObject = null, mayDestroy = true, mayFracture = true, mayHitHero = true, mayHitMonsters = true, heroCaused = false, publish = async () => { }, random = rn2, rollOne = rnd, rollDice = d, finishMonsterDeath = null, finishMonsterKill = null, } = {}) {
    requireLiveGame(state);
    const options = {
        state, onlyObject, force, mayDestroy, mayFracture,
        mayHitHero, mayHitMonsters, heroCaused, publish,
        random, rollOne, rollDice, finishMonsterDeath, finishMonsterKill,
    };
    const shop = costlySpot(x, y, state)?.resident;
    const creditBefore = shop?.eshk.credit ?? 0;
    const debitBefore = shop?.eshk.debit ?? 0;
    const loanBefore = shop?.eshk.loan ?? 0;
    let lostGoods = false;
    const nodes = [];
    const pile = floorPile(state, x, y);
    while (onlyObject || pile.length) {
        const next = nextObjectFromPile(pile, state, options);
        if (!next)
            break;
        const node = await prepareScatteredObject(next.object, x, y, state, options);
        if (state.program_state.gameover)
            return 0;
        if (node)
            nodes.push(node);
        if (onlyObject && next.lastPiece)
            break;
    }
    let farthest = nodes.reduce((maximum, node) => Math.max(maximum, node.range), 0);
    while (farthest-- > 0) {
        for (const node of nodes) {
            if (node.stopped || node.range-- <= 0 || !node.object)
                continue;
            const nextX = node.x + node.dx;
            const nextY = node.y + node.dy;
            if (!openFlightSquare(state, nextX, nextY)) {
                node.stopped = true;
                continue;
            }
            node.x = nextX;
            node.y = nextY;
            const monster = monsterAt(state, nextX, nextY);
            if (monster && mayHitMonsters) {
                node.range--;
                await hitMonster(monster, node, state, options);
            }
            else if (state.u?.ux === nextX && state.u?.uy === nextY
                && mayHitHero) {
                await hitHero(node, state, options);
            }
            if (state.program_state?.gameover)
                return 0;
            if (state.level?.at(nextX, nextY)?.typ === SINK)
                node.stopped = true;
        }
    }
    let moved = 0;
    for (const node of nodes) {
        if (!node.object)
            continue;
        const quantity = node.object.quan ?? node.object.quantity ?? 1;
        const object = node.object;
        const effect = await applyFloorEffects(object, node.x, node.y, {
            state, publish, random, verb: 'land',
        });
        if (!effect.finished) {
            const heroRoom = roomsAt(state.level, state.u.ux, state.u.uy, SHOPBASE)[0];
            if (shop && object.otyp === GOLD_PIECE && !costlySpot(node.x, node.y, state)
                && heroRoom !== undefined && state.u.urooms?.includes(heroRoom)) {
                await addShopObjectToBill(object, state, { ininv: false, silent: true, publish });
                lostGoods = true;
            }
            await placeObject(object, node.x, node.y, state);
            await stack_object(object, state);
        }
        if (node.x !== x || node.y !== y)
            moved += quantity;
        newsym(node.x, node.y);
    }
    newsym(x, y);
    if (lostGoods && shop) {
        const creditUsed = creditBefore - (shop.eshk.credit ?? 0);
        const debitAdded = (shop.eshk.debit ?? 0) - debitBefore;
        const loanAdded = (shop.eshk.loan ?? 0) - loanBefore;
        const amount = creditUsed > 0 ? creditUsed : debitAdded > 0 ? debitAdded : loanAdded;
        if (amount > 0)
            await publish(`Your ${creditUsed > 0
                ? 'credit has been reduced' : 'debt has increased'} by ${amount} ${currency(amount, { state })}.`);
    }
    return moved;
}
//# sourceMappingURL=scatter.js.map