// Escape attempts by an already trapped monster. C trap.c:mintrap().

import { BEAR_TRAP, HOLE, PIT, SPIKED_PIT, WEB, is_pit } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE } from './monster_data.js';
import { BOULDER } from './object_data.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { rn2 } from './rng.js';
import { monsterTrapVisibility } from './trap.js';

const M1_METALLIVORE = 0x80000000;
const MZ_HUGE = 4;

export async function tryMonsterTrapEscape(monster, state = game, {
    random = rn2,
    publish = plineWithContinuation,
    describeMonster = target => `The ${target.name || MONSTER_NAME[target.mnum]}`,
} = {}) {
    const { mx: x, my: y } = monster;
    const trap = state.level.traps.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (!trap) {
        monster.mtrapped = 0;
        return;
    }
    const { inSight, seeSquare } = monsterTrapVisibility(monster, state);
    const pit = is_pit(trap.ttyp);
    if (!trap.tseen && seeSquare && inSight
        && (pit || [BEAR_TRAP, HOLE, WEB].includes(trap.ttyp))) {
        trap.tseen = true;
        newsym(x, y);
    }
    const climbsEasily = MONSTER_SIZE[monster.mnum] >= MZ_HUGE
        || MONSTER_NAME[monster.mnum] === 'pit fiend';

    if (random(40) === 0 || (pit && climbsEasily)) {
        const boulder = pit && (state.level.objects[x]?.[y] || [])
            .some(object => object.otyp === BOULDER);
        if (boulder) {
            if (random(2) === 0) {
                monster.mtrapped = 0;
                if (inSight) await publish(`${describeMonster(monster)} pulls free...`);
                fillPitWithBoulderAt(x, y, state);
                newsym(x, y);
            }
        } else {
            if (inSight) {
                if (pit) {
                    await publish(`${describeMonster(monster)} climbs ${
                        climbsEasily ? 'easily ' : ''
                    }out of the pit.`);
                } else if (trap.ttyp === BEAR_TRAP || trap.ttyp === WEB) {
                    const name = trap.ttyp === WEB ? 'web' : 'bear trap';
                    await publish(`${describeMonster(monster)} pulls free of the ${name}.`);
                }
            }
            monster.mtrapped = 0;
        }
    } else if (MONSTER_FLAGS1[monster.mnum] & M1_METALLIVORE) {
        if (trap.ttyp === BEAR_TRAP) {
            if (inSight) await publish(`${describeMonster(monster)} eats a bear trap!`);
            state.level.traps.splice(state.level.traps.indexOf(trap), 1);
            monster.meating = 5;
            monster.mtrapped = 0;
            newsym(x, y);
        } else if (trap.ttyp === SPIKED_PIT) {
            if (inSight) await publish(`${describeMonster(monster)} munches on some spikes!`);
            trap.ttyp = PIT;
            monster.meating = 5;
            newsym(x, y);
        }
    }
}
