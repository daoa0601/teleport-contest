// Floor objects thrown outward by an explosion or collapsing structure.
// C ref: explode.c:scatter() and mthrowu.c:ohitmon().

import {
    A_STR, DOOR, D_CLOSED, D_LOCKED, SINK, STATUE_TRAP, Upolyd,
    ZAP_POS, isok,
} from './const.js';
import { exerciseAttribute } from './attrib.js';
import { newsym } from './display.js';
import { finishHeroDeath } from './end.js';
import { landFloorObject } from './floor_effects.js';
import { place_object, remove_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { wakeMonster } from './monster_anger.js';
import { wakeMonstersNear } from './monster_wake.js';
import { MONSTER_NAME } from './monster_data.js';
import { findMonsterArmorClass } from './monworn.js';
import {
    BOULDER, EGG, OBJECT_MATERIAL, OBJECT_NAMES,
    ROCK, STATUE,
} from './object_data.js';
import {
    breakFloorObject,
} from './object_breakage.js';
import { splitObjectStack } from './object_stack.js';
import { hitMonsterWithSupportedPotion } from './potion_hit.js';
import { returnHeroToHumanForm } from './polyself.js';
import { d, rn2, rnd } from './rng.js';
import { objectWeight } from './weight.js';
import {
    rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero,
} from './weapon_damage.js';
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

function placeOnFloor(object, x, y, state) {
    if (state === game) place_object(object, x, y);
    else {
        object.ox = x;
        object.oy = y;
        object.where = 'floor';
        if (!state.level.objects[x]) state.level.objects[x] = [];
        if (!state.level.objects[x][y]) state.level.objects[x][y] = [];
        state.level.objects[x][y].unshift(object);
    }
    stack_object(object, state);
    return object;
}

function removeFloorObject(object, state) {
    remove_object(object, state);
    object.where = 'free';
}

function squareIsVisible(state, x, y) {
    return !state.blind && !(state.u?.blindTurns > 0)
        && (!state.viz_array || !!(state.viz_array?.[y]?.[x] & 0x2));
}

function monsterIsVisible(monster, state) {
    const seesInvisible = state.u?.seeInvisible || state.u?.see_invisible;
    return squareIsVisible(state, monster.mx, monster.my)
        && !monster.mundetected && (!monster.minvis || seesInvisible);
}

function monsterAt(state, x, y) {
    return state.level?.monsters?.find(monster =>
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function openFlightSquare(state, x, y) {
    if (!isok(x, y)) return false;
    const location = state.level.at(x, y);
    return ZAP_POS(location.typ)
        && (location.typ !== DOOR
            || !(location.doormask & (D_CLOSED | D_LOCKED)));
}

function objectName(object) {
    return object.name || OBJECT_NAMES[object.otyp] || 'object';
}

async function finishScatteredMonsterDeath(
    monster, x, y, death, state, options,
) {
    if (options.finishMonsterKill)
        return options.finishMonsterKill(monster, x, y, death);
    if (!options.finishMonsterDeath) {
        throw new TypeError(
            'lethal scattered object requires a monster death handler',
        );
    }
    const result = await options.finishMonsterDeath(monster, {
        ...death,
        visible: squareIsVisible(state, monster.mx, monster.my),
        spotted: monsterIsVisible(monster, state),
        random: options.random,
        publish: options.publish,
    });
    return !result.survived;
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
        finishMonsterKill: (monster, x, y, death) =>
            finishScatteredMonsterDeath(
                monster, x, y, death, state, options,
            ),
    });
    if (result.destroyed) return true;
    placeOnFloor(object, options.x, options.y, state);
    return false;
}

async function hitMonster(monster, node, state, options) {
    const visible = monsterIsVisible(monster, state);
    const threshold = 5 + findMonsterArmorClass(monster)
        + rangedTargetHitBonus(node.object, monster, {
            state, random: options.random, rollOne: options.rollOne,
        });
    if (threshold < options.rollOne(20)) {
        if (visible)
            await options.publish(`The ${objectName(node.object)} misses the ${
                MONSTER_NAME[monster.mnum] || 'monster'
            }.`);
        return false;
    }

    const name = MONSTER_NAME[monster.mnum] || 'monster';
    if (node.object.oclass === POTION_CLASS) {
        const potionOptions = {
            state,
            monster,
            potion: node.object,
            targetVisible: visible,
            targetSpotted: visible,
            publish: options.publish,
            wakeMonster: target => wakeMonster(target, {
                attacked: options.heroCaused,
            }),
            wakeNearby: (nearX, nearY, distance) =>
                wakeMonstersNear(nearX, nearY, distance, state),
            finishKill: (target, deathOptions = {}) =>
                finishScatteredMonsterDeath(
                    target, target.mx, target.my,
                    deathOptions, state, options,
                ),
            heroCaused: options.heroCaused,
        };
        const impact = await hitMonsterWithSupportedPotion(potionOptions);
        if (!impact) {
            await breakAtRest(node.object, state, {
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
        await options.publish(`The ${objectName(node.object)} hits the ${name}.`);
    const damage = rollPhysicalWeaponDamage(node.object, monster, {
        rollOne: options.rollOne,
    });
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    monster.msleeping = 0;
    if (monster.mhp <= 0) {
        if (!options.finishMonsterDeath) {
            throw new TypeError(
                'lethal scattered object requires a monster death handler',
            );
        }
        await options.finishMonsterDeath(monster, {
            deathMessage: visible ? `The ${name} is killed!` : null,
            visible: squareIsVisible(state, monster.mx, monster.my),
            spotted: visible,
            random: options.random,
            publish: options.publish,
        });
    } else {
        await wakeMonster(monster, { attacked: options.heroCaused });
    }
    await breakAtRest(node.object, state, {
        ...options,
        x: node.x,
        y: node.y,
    });
    node.object = null;
    node.stopped = true;
    return true;
}

async function hitHero(node, state, options) {
    const attack = 8 + (node.object.spe ?? 0);
    if ((state.u?.uac ?? 10) + attack < options.rollOne(20)) return false;

    await options.publish(`You are hit by ${objectName(node.object)}.`);
    if (node.object.oclass === POTION_CLASS) {
        await breakAtRest(node.object, state, {
            ...options,
            x: node.x,
            y: node.y,
        });
        node.object = null;
        node.stopped = true;
        return true;
    }

    let damage = rollPhysicalWeaponDamageAgainstHero(
        node.object, state, { rollOne: options.rollOne },
    );
    if (state.u?.halfPhysicalDamage || state.u?.half_physical_damage)
        damage = Math.ceil(damage / 2);
    exerciseAttribute(A_STR, false, state);
    const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
    state.u[hitPoints] = Math.max(0, (state.u[hitPoints] ?? 1) - damage);
    if (state.u[hitPoints] <= 0) {
        if (Upolyd(state.u))
            await returnHeroToHumanForm(state, { publish: options.publish });
        else await finishHeroDeath({ killer: 'flying debris' });
    }
    node.range -= 3;
    return true;
}

async function fractureObject(object, x, y, state, options) {
    if (squareIsVisible(state, x, y)) {
        const verb = object.otyp === BOULDER ? 'breaks apart' : 'crumbles';
        await options.publish(`The ${objectName(object)} ${verb}.`);
    } else if (!state.u?.deaf && !state.deaf) {
        await options.publish(object.otyp === BOULDER
            ? 'You hear stone breaking.'
            : 'You hear stone crumbling.');
    }

    if (object.otyp === STATUE) {
        const contents = object.contents || object.cobj || [];
        for (const item of contents) placeOnFloor(item, x, y, state);
        object.contents = [];
        object.cobj = [];
        state.level.traps = (state.level.traps || []).filter(trap =>
            trap.tx !== x || trap.ty !== y || trap.ttyp !== STATUE_TRAP);
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
    placeOnFloor(object, x, y, state);
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
        if ((destructionRoll === 0 || fragile)
            && (await breakFloorObject(object, {
                state,
                heroCaused: options.heroCaused,
                publish: options.publish,
                random: options.random,
                rollDice: options.rollDice,
                finishMonsterKill: options.finishMonsterKill,
            })).destroyed) return null;
    }

    const direction = DIRECTIONS[options.random(DIRECTIONS.length)];
    const maximumRange = Math.max(
        1, options.force - Math.trunc((object.owt ?? 1) / 40),
    );
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
    if (!object || !pile.includes(object)) return null;
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity <= 1) return { object, lastPiece: true };
    const part = splitObjectStack(
        object, options.rollOne(quantity - 1), state,
    );
    part.where = 'floor';
    return { object: part, lastPiece: false };
}

async function landObject(node, state, options) {
    const { object, x, y } = node;
    await landFloorObject(object, x, y, {
        state,
        publish: options.publish,
        random: options.random,
    });
}

export async function scatterFloorObjects(
    x,
    y,
    force,
    {
        state = game,
        onlyObject = null,
        mayDestroy = true,
        mayFracture = true,
        mayHitHero = true,
        mayHitMonsters = true,
        heroCaused = false,
        publish = async () => {},
        random = rn2,
        rollOne = rnd,
        rollDice = d,
        finishMonsterDeath = null,
        finishMonsterKill = null,
    } = {},
) {
    const options = {
        state, onlyObject, force, mayDestroy, mayFracture,
        mayHitHero, mayHitMonsters, heroCaused, publish,
        random, rollOne, rollDice, finishMonsterDeath, finishMonsterKill,
    };
    const nodes = [];
    const pile = floorPile(state, x, y);
    while (pile.length) {
        const next = nextObjectFromPile(pile, state, options);
        if (!next) break;
        const node = await prepareScatteredObject(
            next.object, x, y, state, options,
        );
        if (node) nodes.push(node);
        if (onlyObject && next.lastPiece) break;
    }

    let farthest = nodes.reduce(
        (maximum, node) => Math.max(maximum, node.range), 0,
    );
    while (farthest-- > 0) {
        for (const node of nodes) {
            if (node.stopped || node.range-- <= 0 || !node.object) continue;
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
            } else if (state.u?.ux === nextX && state.u?.uy === nextY
                && mayHitHero) {
                await hitHero(node, state, options);
            }
            if (state.level.at(nextX, nextY)?.typ === SINK) node.stopped = true;
        }
    }

    let moved = 0;
    for (const node of nodes) {
        if (!node.object) continue;
        const quantity = node.object.quan ?? node.object.quantity ?? 1;
        await landObject(node, state, options);
        if (node.x !== x || node.y !== y) moved += quantity;
        newsym(node.x, node.y);
    }
    newsym(x, y);
    return moved;
}
