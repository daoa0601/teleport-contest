// Vibrating squares triggered by monsters.
// C ref: trap.c:trapeffect_vibrating_square().

import { formatSeenMessage } from './hero_speech.js';
import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { Trap } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { game } from './gstate.js';
import { monsterFootName } from './body_parts.js';
import { dist2 } from './hacklib.js';
import { monsterHasNoLimbs } from './monster_data.js';
import { makePlural } from './object_grammar.js';
import { monsterTrapVisibility, seeTrap } from './trap.js';
import { monsterInAir } from './terrain_properties.js';
import { monsterName } from './monster_name.js';

export interface MonsterVibratingSquareEvent {
    kind: 'vibrating-square';
    wholeBody: boolean;
    nearby: boolean;
    trap: Trap;
    finished: boolean;
    inSight: boolean;
    seeSquare: boolean;
}

interface FinishTrapOptions {
    state?: GameState;
    publish?: MessagePublisher;
    describeMonster?: (monster: Monster) => string;
}

function sentenceObject(subject: string) {
    return subject.startsWith('The ') ? `the ${subject.slice(4)}` : subject;
}

function possessive(subject: string) {
    return /s$/iu.test(subject) ? `${subject}'` : `${subject}'s`;
}

export function beginMonsterVibratingSquare(
    monster: Monster,
    trap: Trap,
    state: GameState = game,
): MonsterVibratingSquareEvent {
    const visibility = monsterTrapVisibility(monster, state);
    return {
        kind: 'vibrating-square',
        trap,
        wholeBody: monsterHasNoLimbs(monster.mnum) || monsterInAir(monster, state),
        nearby:
            dist2(monster.mx, monster.my, state.u?.ux ?? monster.mx, state.u?.uy ?? monster.my) <=
            4,
        finished: !visibility.seeSquare,
        ...visibility,
    };
}

export async function finishMonsterVibratingSquare(
    monster: Monster,
    event: MonsterVibratingSquareEvent | null,
    {
        state = game,
        publish = async () => {},
        describeMonster = target => monsterName(target, { state, capitalized: true }),
    }: FinishTrapOptions = {},
) {
    if (!event || event.finished) return event;

    seeTrap(event.trap, state);
    if (!event.inSight) {
        await publish(formatSeenMessage(`the ground vibrate ${event.nearby ? 'nearby' : 'in the distance'}.`));
    } else {
        const subject = sentenceObject(describeMonster(monster));
        const location = event.wholeBody
            ? subject
            : `${possessive(subject)} ${makePlural(
                  monsterFootName(monster.mnum).replace(/^rear /u, ''),
              )}`;
        await publish(formatSeenMessage(`a strange vibration beneath ${location}.`));
    }

    event.finished = true;
    return event;
}
