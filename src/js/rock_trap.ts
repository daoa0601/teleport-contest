// Falling rocks from ceiling traps.
// C ref: trap.c:trapeffect_rocktrap().

import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { Trap } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { finishMonsterKilled } from './monster_death.js';
import type { MonsterDeathResult } from './monster_death.js';
import { AD_PHYS } from './monster_attack_types.js';
import { deleteTrap } from './trap_lifecycle.js';
import { game, requireGameLevel } from './gstate.js';
import { placeCreatedObject, stack_object } from './floor_object.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { ROCK } from './object_data.js';
import { inventoryItemDescription } from './invent.js';
import { observeObjectForNaming } from './objnam.js';
import { d, rn2 } from './rng.js';
import { monsterTrapVisibility, seeTrap } from './trap.js';
import { makeTrapMissile } from './trap_missile.js';
import { monsterName as canonicalMonsterName } from './monster_name.js';

interface TrapVisibility {
    trap: Trap;
    inSight: boolean;
    seeSquare: boolean;
    finished: boolean;
}

export interface SpentRockTrapEvent extends TrapVisibility {
    kind: 'spent-rock-trap';
}

export interface FallingRockEvent extends TrapVisibility {
    kind: 'falling-rock';
    rock: GameObject;
    damage: number;
    harmless: boolean;
    killed: boolean;
    death?: MonsterDeathResult;
}

export type MonsterRockTrapEvent = SpentRockTrapEvent | FallingRockEvent;

interface FinishTrapOptions {
    publish?: MessagePublisher;
    random?: (limit: number) => number;
    monsterName?: (monster: Monster) => string;
    describeMonster?: (monster: Monster) => string;
}

const M1_UNSOLID = 0x00100000;
const M1_WALLWALK = 0x00000008;

function monsterPassesRocks(monster: Monster) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    return !!(flags & M1_WALLWALK) && !(flags & M1_UNSOLID);
}

async function placeRock(rock: GameObject, trap: Trap, state: GameState) {
    if (state === game) placeCreatedObject(rock, trap.tx, trap.ty);
    else {
        rock.ox = trap.tx;
        rock.oy = trap.ty;
        rock.where = 'floor';
        const level = requireGameLevel(state);
        const column = (level.objects[trap.tx] ??= []);
        const pile = (column[trap.ty] ??= []);
        pile.unshift(rock);
    }
    return await stack_object(rock, state);
}

export async function beginMonsterRockTrap(
    monster: Monster,
    trap: Trap,
    state: GameState = game,
    { random = rn2, rollDice = d } = {},
): Promise<MonsterRockTrapEvent> {
    const visibility = monsterTrapVisibility(monster, state);
    if (trap.once && trap.tseen && random(15) === 0) {
        const event: SpentRockTrapEvent = {
            kind: 'spent-rock-trap',
            trap,
            finished: !(visibility.inSight && visibility.seeSquare),
            ...visibility,
        };
        if (event.finished) deleteTrap(trap, state);
        return event;
    }

    trap.once = true;
    const rock = await makeTrapMissile(ROCK, trap);
    if (visibility.inSight) seeTrap(trap, state);
    return {
        kind: 'falling-rock',
        trap,
        rock,
        damage: rollDice(2, 6),
        harmless: monsterPassesRocks(monster),
        killed: false,
        finished: false,
        ...visibility,
    };
}

export function rockTrapNeedsResume(
    event: { kind: string; finished?: boolean } | null | undefined,
) {
    return event?.kind === 'falling-rock' || (event?.kind === 'spent-rock-trap' && !event.finished);
}

export async function finishMonsterRockTrap(
    monster: Monster,
    event: MonsterRockTrapEvent | null,
    state: GameState = game,
    {
        publish = async () => {},
        random = rn2,
        monsterName = target => canonicalMonsterName(target, { state }),
        describeMonster = target => canonicalMonsterName(target, { state, capitalized: true }),
    }: FinishTrapOptions = {},
) {
    if (!event || event.finished) return event;
    if (event.kind === 'spent-rock-trap') {
        await publish(`A trap door above ${monsterName(monster)} opens, but nothing falls out!`);
        deleteTrap(event.trap, state);
        event.finished = true;
        return event;
    }
    if (event.seeSquare) {
        const subject = describeMonster(monster);
        // thitm() names the missile before stackobj(); seeing it makes it
        // eligible to join an already observed pile.
        observeObjectForNaming(event.rock, { state });
        await publish(`${subject} is hit by ${inventoryItemDescription(event.rock)}${event.harmless ? ' but is not harmed.' : '!'}`);
    }
    if (!event.harmless) {
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - event.damage);
        if (monster.mhp <= 0) {
            const death = await finishMonsterKilled(monster, state, {
                damageType: AD_PHYS,
                random,
                publish,
            });
            event.death = death;
            event.killed = !death.survived;
            if (death.heroDied) return event;
            if (death.survived) monster.dead = false;
        }
    }
    event.rock = await placeRock(event.rock, event.trap, state);
    event.finished = true;
    return event;
}
