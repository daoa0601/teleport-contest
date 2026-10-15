// C mhitu.c:diseasemu(). Disease bypasses cancellation and magic negation.
import { formatFeltMessage } from './hero_speech.js';
import { currentAttribute } from './attrib.js';
import { A_CON, SICK_NONVOMITABLE } from './const.js';
import { startHeroSickness } from './hero_illness.js';
import { monsterTypeName } from './monster_data.js';
export async function infectHeroWithMonsterDisease(monster, state, publish, random) {
    if (state.u.sicknessResistance) {
        await publish(formatFeltMessage('a slight illness.', state));
        return false;
    }
    const turns = state.u.sickTurns ? Math.trunc(state.u.sickTurns / 3) + 1
        : random(currentAttribute(A_CON, state)) + 20;
    await startHeroSickness({
        state, turns, cause: monsterTypeName(monster.mnum),
        type: SICK_NONVOMITABLE, publish,
    });
    return true;
}
//# sourceMappingURL=monster_disease.js.map