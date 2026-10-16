// Bear traps triggered by monsters.
// C ref: trap.c:trapeffect_bear_trap().

import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { Trap } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { finishMonsterKilled } from './monster_death.js';
import type { MonsterDeathResult } from './monster_death.js';
import { AD_PHYS } from './monster_attack_types.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import {
    MONSTER_SIZE,
    monsterIsAmorphous,
    monsterIsUnsolid,
    monsterIsWhirly,
    monsterTypeName,
} from './monster_data.js';
import { monsterWearsIronShoes } from './monworn.js';
import { d, rn2 } from './rng.js';
import { monsterTrapVisibility, seeTrap } from './trap.js';
import { monsterInAir } from './terrain_properties.js';

export interface MonsterBearTrapEvent {
    kind: 'bear-trap';
    forced: boolean;
    caught: boolean;
    damage: number;
    killed: boolean;
    death?: MonsterDeathResult;
    trap: Trap;
    finished: boolean;
    inSight: boolean;
    seeSquare: boolean;
}

interface FinishTrapOptions {
    random?: (limit: number) => number;
    rollDice?: (count: number, sides: number) => number;
    publish?: MessagePublisher;
    describeMonster?: (monster: Monster) => string;
}

const MZ_SMALL = 1;

function ordinaryMonsterSubject(monster: Monster) {
    return monster?.name || `The ${monsterTypeName(monster?.mnum, !!monster?.female)}`;
}

function bearTrapCanCatch(monster: Monster, state: GameState) {
    return (
        (MONSTER_SIZE[monster?.mnum] ?? 0) > MZ_SMALL &&
        !monsterIsAmorphous(monster) &&
        !monsterIsWhirly(monster) &&
        !monsterIsUnsolid(monster) &&
        !monsterInAir(monster, state)
    );
}

export function beginMonsterBearTrap(
    monster: Monster,
    trap: Trap,
    state: GameState = game,
    { forced = false } = {},
): MonsterBearTrapEvent {
    const event: MonsterBearTrapEvent = {
        kind: 'bear-trap',
        trap,
        forced,
        caught: false,
        damage: 0,
        killed: false,
        finished: false,
        ...monsterTrapVisibility(monster, state),
    };
    if (!bearTrapCanCatch(monster, state)) {
        event.finished = true;
        return event;
    }

    monster.mtrapped = 1;
    event.caught = true;
    return event;
}

export async function finishMonsterBearTrap(
    monster: Monster,
    event: MonsterBearTrapEvent | null,
    state: GameState = game,
    {
        publish = plineWithContinuation,
        random = rn2,
        rollDice = d,
        describeMonster = ordinaryMonsterSubject,
    }: FinishTrapOptions = {},
) {
    if (!event) return event;
    if (event.finished) {
        if (event.forced && event.inSight) {
            await publish(
                `${describeMonster(monster)} evades ${event.trap.madeby_u ? 'your' : 'a'} bear trap!`,
            );
            seeTrap(event.trap, state);
        }
        return event;
    }
    if (event.inSight) {
        const owner = event.trap.madeby_u ? 'your' : 'a';
        await publish(`${describeMonster(monster)} is caught in ${owner} bear trap!`);
        seeTrap(event.trap, state);
    }

    if (!monsterWearsIronShoes(monster)) {
        event.damage = rollDice(2, 4);
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - event.damage);
    }

    if (monster.mhp <= 0) {
        const death = await finishMonsterKilled(monster, state, {
            damageType: AD_PHYS,
            random,
            publish,
        });
        event.death = death;
        event.killed = !death.survived;
    }

    event.finished = true;
    return event;
}
