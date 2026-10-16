// Sleeping-gas traps affecting monsters.
// C ref: trap.c:trapeffect_slp_gas_trap().
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterIsBreathless, monsterIsHelpless, monsterResistsSleep, putMonsterToSleep, } from './monster_sleep.js';
import { rnd } from './rng.js';
import { monsterTrapVisibility, seeTrap } from './trap.js';
function ordinaryMonsterSubject(monster) {
    if (monster.name)
        return monster.name;
    return `The ${MONSTER_NAME[monster.mnum] || 'monster'}`;
}
export function beginMonsterSleepGasTrap(monster, trap, state = game, { rollOne = rnd } = {}) {
    const visibility = monsterTrapVisibility(monster, state);
    const susceptible = !monsterResistsSleep(monster) &&
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
export function sleepGasTrapNeedsResume(event) {
    return event?.kind === 'sleep-gas' && !event.finished;
}
export async function finishMonsterSleepGasTrap(monster, event, { state = game, publish = async () => { }, describeMonster = ordinaryMonsterSubject } = {}) {
    if (!event || event.finished)
        return event;
    await publish(`${describeMonster(monster)} suddenly falls asleep!`);
    seeTrap(event.trap, state);
    event.finished = true;
    return event;
}
//# sourceMappingURL=sleep_gas_trap.js.map