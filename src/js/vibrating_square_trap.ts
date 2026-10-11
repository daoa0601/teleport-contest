// Vibrating squares triggered by monsters.
// C ref: trap.c:trapeffect_vibrating_square().

import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { Trap } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { game } from './gstate.js';
import { monsterFootName } from './body_parts.js';
import { dist2 } from './hacklib.js';
import { monsterHasNoLimbs, monsterTypeName } from './monster_data.js';
import { makePlural } from './object_grammar.js';
import { monsterTrapVisibility } from './trap.js';
import { monsterInAir } from './terrain_properties.js';

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
    revealTrap?: (trap: Trap) => void;
    publish?: MessagePublisher;
    describeMonster?: (monster: Monster) => string;
}

function ordinaryMonsterSubject(monster: Monster) {
    if (monster?.name) return monster.name;
    return `The ${monsterTypeName(monster?.mnum, !!monster?.female)}`;
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
        publish = async () => {},
        describeMonster = ordinaryMonsterSubject,
        revealTrap = () => {},
    }: FinishTrapOptions = {},
) {
    if (!event || event.finished) return event;

    event.trap.tseen = true;
    revealTrap(event.trap);
    if (!event.inSight) {
        await publish(`You see the ground vibrate ${event.nearby ? 'nearby' : 'in the distance'}.`);
    } else {
        const subject = sentenceObject(describeMonster(monster));
        const location = event.wholeBody
            ? subject
            : `${possessive(subject)} ${makePlural(
                  monsterFootName(monster.mnum).replace(/^rear /u, ''),
              )}`;
        await publish(`You see a strange vibration beneath ${location}.`);
    }

    event.finished = true;
    return event;
}
