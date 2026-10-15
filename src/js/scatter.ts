import { publishHeardMessage } from './hero_speech.js';
import { currency } from './currency.js';
// Floor objects thrown outward by an explosion or collapsing structure.
// C ref: explode.c:scatter() and mthrowu.c:ohitmon().

import { monsterHasMapPosition } from './monster_location.js';
import { deleteTrap } from './trap_lifecycle.js';
import {
    DOOR, D_CLOSED, D_LOCKED, SHOPBASE, SINK, STATUE_TRAP,
    ZAP_POS, isok,
} from './const.js';
import { newsym } from './display.js';
import { applyFloorEffects, landFloorObject } from './floor_effects.js';
import {
    placeObject, stack_object,
} from './floor_object.js';
import { game, requireLiveGame } from './gstate.js';
import { unlinkObject } from './object_location.js';
import type { Monster } from './monster_types.js';
import type { Position } from './map_types.js';
import type { PotionHitOptions } from './potion_hit.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';
import type { MonsterDeathHandler } from './monster_death.js';
import type { finishHeroMonsterKill, HeroMonsterKillOptions, HeroMonsterKillOutcome } from './hero_monster_death.js';
import { wakeMonster } from './monster_anger.js';
import { wakeMonstersNear } from './monster_wake.js';
import { heroSpecies } from './hero_species.js';
import { hideHeroUnder, maybeUnhideAt } from './monster_hiding.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { hitHeroWithThrownPotion } from './hero_potion_hit.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { stopHeroOccupation } from './occupation.js';
import { unpunishHero } from './punishment.js';
import { addShopObjectToBill, costlySpot } from './shk.js';
import { roomsAt } from './room.js';
import { MONSTER_FLAGS1, MONSTER_SIZE, MONSTER_NAME } from './monster_data.js';
import { findMonsterArmorClass } from './monworn.js';
import {
    BOULDER, EGG, GOLD_PIECE, OBJECT_MATERIAL, OBJECT_NAMES,
    STATUE,
} from './object_data.js';
import {
    breakFloorObject,
} from './object_breakage.js';
import { splitObjectStack } from './object_stack.js';
import { hitMonsterWithSupportedPotion } from './potion_hit.js';
import { d, rn2, rnd } from './rng.js';
import { breakStatue, fractureRock } from './rock_breakage.js';
import { objectCombatName, objectNameIsPlural } from './objnam.js';
import { verbForSubject } from './object_grammar.js';
import { capitalizedDefiniteName } from './ray_hit_message.js';
import {
    rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero,
} from './weapon_damage.js';
import { rangedTargetHitBonus } from './weapon_accuracy.js';

export interface ScatterOptions {
    state?: GameState;
    onlyObject?: GameObject | null;
    mayDestroy?: boolean;
    mayFracture?: boolean;
    mayHitHero?: boolean;
    mayHitMonsters?: boolean;
    heroCaused?: boolean;
    publish?: MessagePublisher;
    random?: (limit: number) => number;
    rollOne?: (sides: number) => number;
    rollDice?: (count: number, sides: number) => number;
    finishMonsterDeath?: MonsterDeathHandler | null;
    finishMonsterKill?: typeof finishHeroMonsterKill | null;
}

// The public entry point resolves every optional setting before objects move.
type ScatterSettings = Required<ScatterOptions> & { force: number };

interface ScatterNode extends Position {
    object: GameObject | null;
    dx: number;
    dy: number;
    range: number;
    stopped: boolean;
}

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

function floorPile(state: GameState, x: number, y: number): GameObject[] {
    return state.level?.objects?.[x]?.[y] || [];
}

async function placeOnFloor(object: GameObject, x: number, y: number, state: GameState): Promise<GameObject> {
    await placeObject(object, x, y, state);
    await stack_object(object, state);
    return object;
}

function removeFloorObject(object: GameObject, state: GameState): void {
    unlinkObject(object, state);
}

function squareIsVisible(state: GameState, x: number, y: number): boolean {
    return !state.blind && !((state.u.blindTurns ?? 0) > 0)
        && (!state.viz_array || !!((state.viz_array?.[y]?.[x] ?? 0) & 0x2));
}

function monsterIsVisible(monster: Monster, state: GameState): boolean {
    const seesInvisible = !!state.u.seeInvisible;
    return squareIsVisible(state, monster.mx, monster.my)
        && !monster.mundetected && (!monster.minvis || seesInvisible);
}

function monsterAt(state: GameState, x: number, y: number): Monster | null {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function openFlightSquare(state: GameState, x: number, y: number): boolean {
    if (!isok(x, y)) return false;
    const location = state.level?.at(x, y);
    if (!location) return false;
    return ZAP_POS(location.typ)
        && (location.typ !== DOOR
            || !(location.doormask & (D_CLOSED | D_LOCKED)));
}

function objectName(object: GameObject): string {
    return object.name || OBJECT_NAMES[object.otyp] || 'object';
}

async function finishScatteredMonsterDeath(
    monster: Monster, x: number, y: number, death: HeroMonsterKillOptions,
    state: GameState, options: ScatterSettings,
): Promise<HeroMonsterKillOutcome> {
    if (options.finishMonsterKill) {
        const killed = await options.finishMonsterKill(monster, x, y, death);
        return { killed, heroDied: !!state.program_state.gameover };
    }
    if (!options.finishMonsterDeath) {
        throw new TypeError(
            'lethal scattered object requires a monster death handler',
        );
    }
    const result = await options.finishMonsterDeath(monster, {
        ...death,
        random: options.random,
        publish: options.publish,
    });
    return { killed: !result.survived, heroDied: !!result.heroDied };
}

async function breakAtRest(object: GameObject, state: GameState, options: ScatterSettings & Position): Promise<boolean> {
    object.ox = options.x;
    object.oy = options.y;
    const result = await breakFloorObject(object, {
        state,
        heroCaused: options.heroCaused,
        publish: options.publish,
        random: options.random,
        rollDice: options.rollDice,
    });
    if (result.destroyed) return true;
    // A fatal vapor or oil blast ends the scatter even though the bottle
    // itself reports not destroyed.
    if (state.program_state?.gameover) return true;
    await placeOnFloor(object, options.x, options.y, state);
    return false;
}

async function hitMonster(monster: Monster, node: ScatterNode, state: GameState, options: ScatterSettings): Promise<boolean> {
    const object = node.object;
    if (!object) return false;
    const visible = monsterIsVisible(monster, state);
    const threshold = 5 + findMonsterArmorClass(monster)
        + rangedTargetHitBonus(object, monster, {
            state, random: options.random, rollOne: options.rollOne,
        });
    if (threshold < options.rollOne(20)) {
        if (visible)
            await options.publish(`The ${objectName(object)} misses the ${
                MONSTER_NAME[monster.mnum] || 'monster'
            }.`);
        return false;
    }

    const name = MONSTER_NAME[monster.mnum] || 'monster';
    if (object.oclass === POTION_CLASS) {
        const potionOptions: PotionHitOptions = {
            state,
            monster,
            potion: object,
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
        if (impact?.heroDied) return true;
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
            throw new TypeError(
                'lethal scattered object requires a monster death handler',
            );
        }
        await options.finishMonsterDeath(monster, {
            deathMessage: visible ? `The ${name} is killed!` : null,
            random: options.random,
            publish: options.publish,
        });
    } else {
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

async function hitHero(node: ScatterNode, state: GameState, options: ScatterSettings): Promise<boolean> {
    const object = node.object;
    if (!object) return false;
    const attack = 8 + (object.spe ?? 0)
        + ((MONSTER_SIZE[heroSpecies(state)] ?? 2) >= 3 ? 1 : 0);
    if (state.multi) endVoluntaryMultiTurn(state);
    if (object.oclass !== POTION_CLASS) {
        let damage = rollPhysicalWeaponDamageAgainstHero(object, state, { rollOne: options.rollOne });
        if (state.u.halfPhysicalDamage) damage = Math.trunc((damage + 1) / 2);
        const result = await hitHeroWithObject(object, damage, attack, {
            state, publish: options.publish, rollOne: options.rollOne,
        });
        if (result.hit) {
            node.range -= 3;
            await stopHeroOccupation(state, options.publish);
        }
        return result.hit;
    }
    if ((state.u.uac ?? 10) + attack <= options.rollOne(20)) return false;

    await options.publish(`You are hit by ${objectName(object)}.`);
    await hitHeroWithThrownPotion(object, {
        state, publish: options.publish, random: options.random,
        rollOne: options.rollOne, rollDice: options.rollDice, source: 'propelled',
    });
    node.object = null;
    node.stopped = true;
    return true;
}

async function fractureObject(object: GameObject, x: number, y: number, state: GameState, options: ScatterSettings): Promise<void> {
    const boulder = object.otyp === BOULDER;
    if (!boulder) {
        const statueTrap = state.level?.traps.find(trap =>
            trap.tx === x && trap.ty === y && trap.ttyp === STATUE_TRAP);
        if (statueTrap) deleteTrap(statueTrap, state);
    }
    if (squareIsVisible(state, x, y)) {
        const name = capitalizedDefiniteName(objectCombatName(object, { state }), state);
        const verb = boulder ? 'break' : 'crumble';
        const action = objectNameIsPlural(object, state) ? verb : verbForSubject(null, verb);
        await options.publish(`${name} ${action}${boulder ? ' apart' : ''}.`);
    } else {
        await publishHeardMessage(boulder ? 'stone breaking.' : 'stone crumbling.', options.publish, state);
    }
    const fractureOptions = { state, random: options.random, publish: options.publish };
    if (boulder) await fractureRock(object, x, y, fractureOptions);
    else await breakStatue(object, x, y, fractureOptions);
    await placeObject(object, x, y, state);
    if (boulder) {
        // Native scatter() processes all remaining boulders before the debris.
        const nextBoulder = floorPile(state, x, y).find(candidate => candidate.otyp === BOULDER);
        if (nextBoulder) {
            unlinkObject(nextBoulder, state);
            await placeObject(nextBoulder, x, y, state);
        }
    }
    newsym(x, y);
}

async function prepareScatteredObject(object: GameObject, x: number, y: number, state: GameState, options: ScatterSettings): Promise<ScatterNode | null> {
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
            if (broken.destroyed) return null;
            // A fatal vapor or oil blast ends the scatter even though the
            // bottle itself reports not destroyed.
            if (state.program_state?.gameover) return null;
        }
    }

    const direction = DIRECTIONS[options.random(DIRECTIONS.length)];
    if (!direction) throw new RangeError('Scattering selected an invalid direction.');
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

function nextObjectFromPile(pile: GameObject[], state: GameState, options: ScatterSettings): { object: GameObject; lastPiece: boolean } | null {
    const object = options.onlyObject || pile[0];
    if (!object || !options.onlyObject && !pile.includes(object)) return null;
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity <= 1) return { object, lastPiece: true };
    const part = splitObjectStack(
        object, options.rollOne(quantity - 1), state,
    );
    if (!part) throw new Error(`Cannot split scattered object ${object.o_id}.`);
    return { object: part, lastPiece: false };
}

export async function scatterFloorObjects(
    x: number,
    y: number,
    force: number,
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
    }: ScatterOptions = {},
): Promise<number> {
    requireLiveGame(state);
    const options: ScatterSettings = {
        state, onlyObject, force, mayDestroy, mayFracture,
        mayHitHero, mayHitMonsters, heroCaused, publish,
        random, rollOne, rollDice, finishMonsterDeath, finishMonsterKill,
    };
    const shop = costlySpot(x, y, state)?.resident;
    const creditBefore = shop?.eshk.credit ?? 0;
    const debitBefore = shop?.eshk.debit ?? 0;
    const loanBefore = shop?.eshk.loan ?? 0;
    let lostGoods = false;
    const nodes: ScatterNode[] = [];
    const pile = floorPile(state, x, y);
    while (onlyObject || pile.length) {
        const candidate = onlyObject || pile[0];
        const chain = state.uchain || state.u.uchain;
        if (candidate && (candidate === chain || candidate === (state.uball || state.u.uball))) {
            await publish('The chain shatters!');
            await unpunishHero(state);
            if (candidate === chain) {
                if (onlyObject) break;
                continue;
            }
        }
        const next = nextObjectFromPile(pile, state, options);
        if (!next) break;
        const node = await prepareScatteredObject(
            next.object, x, y, state, options,
        );
        if (state.program_state.gameover) return 0;
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
            if (state.program_state?.gameover) return 0;
            if (state.level?.at(nextX, nextY)?.typ === SINK) node.stopped = true;
        }
    }

    let moved = 0;
    for (const node of nodes) {
        if (!node.object) continue;
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
        if (node.x !== x || node.y !== y) moved += quantity;
        newsym(node.x, node.y);
    }
    newsym(x, y);
    if (state.u.ux === x && state.u.uy === y && state.u.uundetected
        && ((MONSTER_FLAGS1[heroSpecies(state)] ?? 0) & 0x80)) hideHeroUnder(state);
    const originMonster = monsterAt(state, x, y);
    if (originMonster?.mtrapped) originMonster.mtrapped = 0;
    maybeUnhideAt(x, y, state);
    if (lostGoods && shop) {
        const creditUsed = creditBefore - (shop.eshk.credit ?? 0);
        const debitAdded = (shop.eshk.debit ?? 0) - debitBefore;
        const loanAdded = (shop.eshk.loan ?? 0) - loanBefore;
        const amount = creditUsed > 0 ? creditUsed : debitAdded > 0 ? debitAdded : loanAdded;
        if (amount > 0) await publish(`Your ${creditUsed > 0
            ? 'credit has been reduced' : 'debt has increased'} by ${amount} ${
            currency(amount, { state })}.`);
    }
    return moved;
}
