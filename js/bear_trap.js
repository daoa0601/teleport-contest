// Bear traps triggered by monsters.
// C ref: trap.c:trapeffect_bear_trap().

import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { monsterInAir } from './mon.js';
import {
    MONSTER_SIZE, monsterIsAmorphous, monsterIsNonliving,
    monsterIsUnsolid, monsterIsWhirly, monsterTypeName,
} from './monster_data.js';
import { monsterWearsIronShoes } from './monworn.js';
import { d, rn2 } from './rng.js';
import { monsterTrapVisibility } from './trap.js';

const MZ_SMALL = 1;

function ordinaryMonsterSubject(monster) {
    return monster?.name
        || `The ${monsterTypeName(monster?.mnum, !!monster?.female)}`;
}

function bearTrapCanCatch(monster, state) {
    return (MONSTER_SIZE[monster?.mnum] ?? 0) > MZ_SMALL
        && !monsterIsAmorphous(monster)
        && !monsterIsWhirly(monster)
        && !monsterIsUnsolid(monster)
        && !monsterInAir(monster, state);
}

export function beginMonsterBearTrap(monster, trap, state = game) {
    const event = {
        kind: 'bear-trap', trap,
        caught: false, damage: 0, killed: false, finished: false,
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
    monster,
    event,
    {
        finishDeath,
        publish = plineWithContinuation,
        random = rn2,
        rollDice = d,
        describeMonster = ordinaryMonsterSubject,
    } = {},
) {
    if (!event || event.finished) return event;
    if (typeof finishDeath !== 'function')
        throw new TypeError('bear trap requires the monster death handler');

    if (event.inSight) {
        const owner = event.trap.madeby_u ? 'your' : 'a';
        await publish(
            `${describeMonster(monster)} is caught in ${owner} bear trap!`,
        );
        event.trap.tseen = true;
    }

    if (!monsterWearsIronShoes(monster)) {
        event.damage = rollDice(2, 4);
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - event.damage);
    }

    if (monster.mhp <= 0) {
        const verb = monsterIsNonliving(monster.mnum)
            ? 'destroyed' : 'killed';
        const death = await finishDeath(monster, {
            deathMessage: event.seeSquare
                ? `${describeMonster(monster)} is ${verb}!` : null,
            visible: event.seeSquare,
            spotted: event.inSight,
            random,
            publish,
        });
        event.death = death;
        event.killed = !death.survived;
    }

    event.finished = true;
    return event;
}
