// Escape attempts by an already trapped monster. C trap.c:mintrap().
// dochug refreshes stationary monsters; a settling boulder owns its redraw.

import { trapName } from './trap_name.js';
import { deleteTrap } from './trap_lifecycle.js';
import { BEAR_TRAP, HOLE, PIT, SPIKED_PIT, WEB, is_pit } from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requireGameLevel } from './gstate.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE } from './monster_data.js';
import { BOULDER } from './object_data.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { rn2 } from './rng.js';
import { monsterTrapVisibility, seeTrap } from './trap.js';
import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import { monsterName } from './monster_name.js';

const M1_METALLIVORE = 0x80000000;
const MZ_HUGE = 4;

export async function tryMonsterTrapEscape(monster: Monster, state: GameState = game, {
    random = rn2,
    publish = plineWithContinuation,
    describeMonster = target => monsterName(target, { state, capitalized: true }),
}: { random?: (limit: number) => number; publish?: MessagePublisher;
    describeMonster?: (target: Monster) => string } = {}): Promise<void> {
    const { mx: x, my: y } = monster;
    const level = requireGameLevel(state);
    const trap = level.traps.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (!trap) {
        monster.mtrapped = 0;
        return;
    }
    const { inSight, seeSquare } = monsterTrapVisibility(monster, state);
    const pit = is_pit(trap.ttyp);
    if (!trap.tseen && seeSquare && inSight
        && (pit || [BEAR_TRAP, HOLE, WEB].includes(trap.ttyp))) {
        seeTrap(trap, state);
    }
    const climbsEasily = (MONSTER_SIZE[monster.mnum] ?? 0) >= MZ_HUGE
        || MONSTER_NAME[monster.mnum] === 'pit fiend';

    if (random(40) === 0 || (pit && climbsEasily)) {
        const boulder = pit && (level.objects[x]?.[y] || [])
            .some(object => object.otyp === BOULDER);
        if (boulder) {
            if (random(2) === 0) {
                monster.mtrapped = 0;
                if (inSight) await publish(`${describeMonster(monster)} pulls free...`);
                await fillPitWithBoulderAt(x, y, state, { publish });
            }
        } else {
            if (inSight) {
                if (pit) {
                    await publish(`${describeMonster(monster)} climbs ${
                        climbsEasily ? 'easily ' : ''
                    }out of the pit.`);
                } else if (trap.ttyp === BEAR_TRAP || trap.ttyp === WEB) {
                    // C trapname() draws a hallucinated trap name after Monnam().
                    const subject = describeMonster(monster);
                    await publish(`${subject} pulls free of the ${trapName(trap.ttyp, { state })}.`);
                }
            }
            monster.mtrapped = 0;
        }
    } else if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_METALLIVORE) {
        if (trap.ttyp === BEAR_TRAP) {
            if (inSight) await publish(`${describeMonster(monster)} eats a bear trap!`);
            deleteTrap(trap, state);
            monster.meating = 5;
            monster.mtrapped = 0;
        } else if (trap.ttyp === SPIKED_PIT) {
            if (inSight) await publish(`${describeMonster(monster)} munches on some spikes!`);
            trap.ttyp = PIT;
            monster.meating = 5;
        }
    }
}
