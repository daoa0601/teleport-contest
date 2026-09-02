// Falling rocks from ceiling traps.
// C ref: trap.c:trapeffect_rocktrap().

import { game } from './gstate.js';
import { place_object, stack_object } from './floor_object.js';
import { MONSTER_FLAGS1, MONSTER_NAME } from './monster_data.js';
import { ROCK } from './object_data.js';
import { d, rn2 } from './rng.js';
import { monsterTrapVisibility } from './trap.js';
import { makeTrapMissile } from './trap_missile.js';

const M1_UNSOLID = 0x00100000;
const M1_WALLWALK = 0x00000008;

function ordinaryMonsterSubject(monster) {
    return `The ${monster.name || MONSTER_NAME[monster.mnum] || 'monster'}`;
}

function ordinaryMonsterName(monster) {
    return monster.name || `the ${MONSTER_NAME[monster.mnum] || 'monster'}`;
}

function monsterPassesRocks(monster) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    return !!(flags & M1_WALLWALK) && !(flags & M1_UNSOLID);
}

function removeTrap(trap, state) {
    const index = state.level?.traps?.indexOf(trap) ?? -1;
    if (index >= 0) state.level.traps.splice(index, 1);
}

function placeRock(rock, trap, state) {
    if (state === game) place_object(rock, trap.tx, trap.ty);
    else {
        rock.ox = trap.tx;
        rock.oy = trap.ty;
        rock.where = 'floor';
        if (!state.level.objects[trap.tx]) state.level.objects[trap.tx] = [];
        if (!state.level.objects[trap.tx][trap.ty])
            state.level.objects[trap.tx][trap.ty] = [];
        state.level.objects[trap.tx][trap.ty].unshift(rock);
    }
    return stack_object(rock, state);
}

export function beginMonsterRockTrap(
    monster,
    trap,
    state = game,
    { random = rn2, rollDice = d } = {},
) {
    const visibility = monsterTrapVisibility(monster, state);
    if (trap.once && trap.tseen && random(15) === 0) {
        const event = {
            kind: 'spent-rock-trap',
            trap,
            finished: !(visibility.inSight && visibility.seeSquare),
            ...visibility,
        };
        if (event.finished) removeTrap(trap, state);
        return event;
    }

    trap.once = true;
    if (visibility.inSight) trap.tseen = true;
    return {
        kind: 'falling-rock',
        trap,
        rock: makeTrapMissile(ROCK, trap),
        damage: rollDice(2, 6),
        harmless: monsterPassesRocks(monster),
        killed: false,
        finished: false,
        ...visibility,
    };
}

export function rockTrapNeedsResume(event) {
    return event?.kind === 'falling-rock'
        || (event?.kind === 'spent-rock-trap' && !event.finished);
}

export async function finishMonsterRockTrap(
    monster,
    event,
    state = game,
    {
        finishDeath,
        publish = async () => {},
        random = rn2,
        monsterName = ordinaryMonsterName,
        describeMonster = ordinaryMonsterSubject,
    } = {},
) {
    if (!event || event.finished) return event;
    if (event.kind === 'spent-rock-trap') {
        await publish(`A trap door above ${monsterName(monster)} opens, but nothing falls out!`);
        removeTrap(event.trap, state);
        event.finished = true;
        return event;
    }
    if (typeof finishDeath !== 'function')
        throw new TypeError('falling rock requires the monster death handler');

    const subject = describeMonster(monster);
    if (event.seeSquare) {
        await publish(`${subject} is hit by a rock${
            event.harmless ? ' but is not harmed.' : '!'
        }`);
    }
    if (!event.harmless) {
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - event.damage);
        if (monster.mhp <= 0) {
            const death = await finishDeath(monster, {
                deathMessage: event.seeSquare ? `${subject} is killed!` : null,
                visible: event.seeSquare,
                spotted: event.inSight,
                random,
                publish,
            });
            event.death = death;
            event.killed = !death.survived;
            if (death.survived) monster.dead = false;
        }
    }
    event.rock = placeRock(event.rock, event.trap, state);
    event.finished = true;
    return event;
}
