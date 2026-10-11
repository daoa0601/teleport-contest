// Sleeping-gas traps affecting monsters.
// C ref: trap.c:trapeffect_slp_gas_trap().

import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { Trap } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import {
    monsterIsBreathless,
    monsterIsHelpless,
    monsterResistsSleep,
    putMonsterToSleep,
} from './monster_sleep.js';
import { rnd } from './rng.js';
import { monsterTrapVisibility } from './trap.js';

export interface MonsterSleepGasTrapEvent {
    kind: 'sleep-gas';
    slept: boolean;
    trap: Trap;
    finished: boolean;
    inSight: boolean;
    seeSquare: boolean;
}

interface FinishTrapOptions {
    publish?: MessagePublisher;
    describeMonster?: (monster: Monster) => string;
}

function ordinaryMonsterSubject(monster: Monster) {
    if (monster.name) return monster.name;
    return `The ${MONSTER_NAME[monster.mnum] || 'monster'}`;
}

export function beginMonsterSleepGasTrap(
    monster: Monster,
    trap: Trap,
    state: GameState = game,
    { rollOne = rnd } = {},
): MonsterSleepGasTrapEvent {
    const visibility = monsterTrapVisibility(monster, state);
    const susceptible =
        !monsterResistsSleep(monster) &&
        !monsterIsBreathless(monster) &&
        !monsterIsHelpless(monster);
    const slept = susceptible ? putMonsterToSleep(monster, rollOne(25)) : false;
    return {
        kind: 'sleep-gas',
        trap,
        slept,
        finished: !(slept && visibility.inSight),
        ...visibility,
    };
}

export function sleepGasTrapNeedsResume(
    event: { kind: string; finished?: boolean } | null | undefined,
) {
    return event?.kind === 'sleep-gas' && !event.finished;
}

export async function finishMonsterSleepGasTrap(
    monster: Monster,
    event: MonsterSleepGasTrapEvent | null,
    { publish = async () => {}, describeMonster = ordinaryMonsterSubject }: FinishTrapOptions = {},
) {
    if (!event || event.finished) return event;
    await publish(`${describeMonster(monster)} suddenly falls asleep!`);
    event.trap.tseen = true;
    event.finished = true;
    return event;
}
