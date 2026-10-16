// Squeaky boards triggered by monsters.
// C ref: trap.c:trapeffect_sqky_board().

import { publishHeardMessage } from './hero_speech.js';
import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { Trap } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { BOLT_LIM, COULD_SEE, squeakyBoardNoteWithArticle } from './const.js';
import { game } from './gstate.js';
import { dist2 } from './hacklib.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { monsterIsMindless } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { heroIsDeaf } from './senses.js';
import { monsterTrapVisibility, seeTrap } from './trap.js';
import { monsterInAir } from './terrain_properties.js';

export interface MonsterSqueakyBoardEvent {
    kind: 'squeaky-board';
    note: string;
    deaf: boolean;
    mindless: boolean;
    nearby: boolean;
    trap: Trap;
    finished: boolean;
    inSight: boolean;
    seeSquare: boolean;
}

interface FinishTrapOptions {
    publish?: MessagePublisher;
}

function canAlmostSee(state: GameState, x: number, y: number) {
    return !!((state.viz_array?.[y]?.[x] ?? 0) & COULD_SEE);
}

export function beginMonsterSqueakyBoard(
    monster: Monster,
    trap: Trap,
    state: GameState = game,
): MonsterSqueakyBoardEvent | null {
    if (monsterInAir(monster, state)) return null;

    const visibility = monsterTrapVisibility(monster, state);
    const deaf = !!state.deaf || heroIsDeaf(state);
    const range = canAlmostSee(state, monster.mx, monster.my) ? BOLT_LIM + 1 : BOLT_LIM - 3;
    return {
        kind: 'squeaky-board',
        trap,
        note: squeakyBoardNoteWithArticle(trap.tnote ?? -1),
        deaf,
        mindless: monsterIsMindless(monster.mnum),
        nearby:
            dist2(monster.mx, monster.my, state.u?.ux ?? monster.mx, state.u?.uy ?? monster.my) <=
            range * range,
        finished: false,
        ...visibility,
    };
}

export async function finishMonsterSqueakyBoard(
    monster: Monster,
    event: MonsterSqueakyBoardEvent | null,
    state: GameState = game,
    {
        publish = async () => {},
    }: FinishTrapOptions = {},
) {
    if (!event || event.finished) return event;

    if (event.inSight) {
        if (!event.deaf) {
            await publish(
                `A board beneath ${monsterName(monster, { state })} squeaks ${event.note} loudly.`,
            );
            seeTrap(event.trap, state);
        } else if (!event.mindless) {
            await publish(`${monsterName(monster, { state, capitalized: true })} stops momentarily and appears to cringe.`);
        }
    } else {
        await publishHeardMessage(`${event.note} squeak ${event.nearby ? 'nearby' : 'in the distance'}.`, publish, state);
    }

    await wakeMonstersNearWithMessages(event.trap.tx, event.trap.ty, 40, state, publish);
    event.finished = true;
    return event;
}
