// Squeaky boards triggered by monsters.
// C ref: trap.c:trapeffect_sqky_board().

import {
    BOLT_LIM, COULD_SEE, squeakyBoardNoteWithArticle,
} from './const.js';
import { game } from './gstate.js';
import { dist2 } from './hacklib.js';
import { monsterInAir, wakeMonstersNear } from './mon.js';
import {
    monsterIsMindless, monsterTypeName,
} from './monster_data.js';
import { heroIsDeaf } from './senses.js';
import { monsterTrapVisibility } from './trap.js';

function ordinaryMonsterName(monster) {
    return monster?.name || monsterTypeName(monster?.mnum, !!monster?.female);
}

function ordinaryMonsterSubject(monster) {
    return monster?.name || `The ${ordinaryMonsterName(monster)}`;
}

function canAlmostSee(state, x, y) {
    return !!(state.viz_array?.[y]?.[x] & COULD_SEE);
}

export function beginMonsterSqueakyBoard(
    monster, trap, state = game,
) {
    if (monsterInAir(monster, state)) return null;

    const visibility = monsterTrapVisibility(monster, state);
    const deaf = !!state.deaf || heroIsDeaf(state);
    const range = canAlmostSee(state, monster.mx, monster.my)
        ? BOLT_LIM + 1 : BOLT_LIM - 3;
    return {
        kind: 'squeaky-board',
        trap,
        note: squeakyBoardNoteWithArticle(trap.tnote),
        deaf,
        mindless: monsterIsMindless(monster.mnum),
        nearby: dist2(
            monster.mx, monster.my,
            state.u?.ux ?? monster.mx,
            state.u?.uy ?? monster.my,
        ) <= range * range,
        finished: false,
        ...visibility,
    };
}

export async function finishMonsterSqueakyBoard(
    monster,
    event,
    state = game,
    {
        publish = async () => {},
        monsterName = ordinaryMonsterName,
        describeMonster = ordinaryMonsterSubject,
    } = {},
) {
    if (!event || event.finished) return event;

    if (event.inSight) {
        if (!event.deaf) {
            await publish(
                `A board beneath the ${monsterName(monster)} squeaks ${
                    event.note
                } loudly.`,
            );
            event.trap.tseen = true;
        } else if (!event.mindless) {
            await publish(
                `${describeMonster(monster)} stops momentarily and appears to cringe.`,
            );
        }
    } else if (!event.deaf) {
        await publish(
            `You hear ${event.note} squeak ${
                event.nearby ? 'nearby' : 'in the distance'
            }.`,
        );
    }

    wakeMonstersNear(event.trap.tx, event.trap.ty, 40, state);
    event.finished = true;
    return event;
}
