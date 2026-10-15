// Vibrating squares triggered by monsters.
// C ref: trap.c:trapeffect_vibrating_square().
import { formatSeenMessage } from './hero_speech.js';
import { game } from './gstate.js';
import { monsterFootName } from './body_parts.js';
import { dist2 } from './hacklib.js';
import { monsterHasNoLimbs, monsterTypeName } from './monster_data.js';
import { makePlural } from './object_grammar.js';
import { monsterTrapVisibility } from './trap.js';
import { monsterInAir } from './terrain_properties.js';
function ordinaryMonsterSubject(monster) {
    if (monster?.name)
        return monster.name;
    return `The ${monsterTypeName(monster?.mnum, !!monster?.female)}`;
}
function sentenceObject(subject) {
    return subject.startsWith('The ') ? `the ${subject.slice(4)}` : subject;
}
function possessive(subject) {
    return /s$/iu.test(subject) ? `${subject}'` : `${subject}'s`;
}
export function beginMonsterVibratingSquare(monster, trap, state = game) {
    const visibility = monsterTrapVisibility(monster, state);
    return {
        kind: 'vibrating-square',
        trap,
        wholeBody: monsterHasNoLimbs(monster.mnum) || monsterInAir(monster, state),
        nearby: dist2(monster.mx, monster.my, state.u?.ux ?? monster.mx, state.u?.uy ?? monster.my) <=
            4,
        finished: !visibility.seeSquare,
        ...visibility,
    };
}
export async function finishMonsterVibratingSquare(monster, event, { publish = async () => { }, describeMonster = ordinaryMonsterSubject, revealTrap = () => { }, } = {}) {
    if (!event || event.finished)
        return event;
    event.trap.tseen = true;
    revealTrap(event.trap);
    if (!event.inSight) {
        await publish(formatSeenMessage(`the ground vibrate ${event.nearby ? 'nearby' : 'in the distance'}.`));
    }
    else {
        const subject = sentenceObject(describeMonster(monster));
        const location = event.wholeBody
            ? subject
            : `${possessive(subject)} ${makePlural(monsterFootName(monster.mnum).replace(/^rear /u, ''))}`;
        await publish(formatSeenMessage(`a strange vibration beneath ${location}.`));
    }
    event.finished = true;
    return event;
}
//# sourceMappingURL=vibrating_square_trap.js.map