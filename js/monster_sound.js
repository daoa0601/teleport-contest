// Animal noises shared by #chat and mounted breath fallback.
// C ref: sounds.c domonnoise().

import { game } from './gstate.js';
import {
    MONSTER_NAME, MONSTER_SOUND, monsterTypeName,
} from './monster_data.js';

const MS_BARK = 1;
const MS_MEW = 2;
const MS_ROAR = 3;
const MS_NEIGH = 12;

export function monsterSentenceSubject(monster) {
    if (monster.name)
        return monster.name.charAt(0).toUpperCase() + monster.name.slice(1);
    const saddle = monster.saddled ? 'saddled ' : '';
    return `The ${saddle}${monsterTypeName(
        monster.mnum, !!monster.female,
    )}`;
}

export function sessionIsNight(datetime) {
    const hour = Number(String(datetime || '').slice(8, 10));
    return Number.isInteger(hour) && (hour < 6 || hour > 21);
}

export function monsterNoiseMessage(monster, state = game) {
    if (!monster || state.deaf || state.u?.deaf) return null;
    const sound = MONSTER_SOUND[monster.mnum] ?? 0;
    const hungryTime = monster.edog?.hungrytime ?? 0;
    const moves = state.moves ?? 1;
    let noise = null;

    if (sound === MS_BARK) {
        if (state.flags?.moonphase === 4 && sessionIsNight(state.datetime))
            noise = 'howls.';
        else if (!monster.mpeaceful) noise = 'growls.';
        else if (monster.mtame && (monster.mconf || monster.mflee
            || monster.mtrapped || moves > hungryTime
            || monster.mtame < 5)) noise = 'whines.';
        else if (monster.mtame && hungryTime > moves + 1000) noise = 'yips.';
        else if (MONSTER_NAME[monster.mnum] !== 'dingo') noise = 'barks.';
    } else if (sound === MS_MEW) {
        if (monster.mtame && (monster.mconf || monster.mflee
            || monster.mtrapped || monster.mtame < 5)) noise = 'yowls.';
        else if (monster.mtame && moves > hungryTime) noise = 'meows.';
        else if (monster.mtame && hungryTime > moves + 1000)
            noise = 'purrs.';
        else noise = monster.mtame ? 'mews.'
            : monster.mpeaceful ? 'snarls.' : 'growls!';
    } else if (sound === MS_ROAR) {
        noise = monster.mpeaceful ? 'snarls.' : 'roars!';
    } else if (sound === MS_NEIGH) {
        noise = monster.mtame < 5 ? 'neighs.'
            : moves > hungryTime ? 'whinnies.' : 'whickers.';
    }
    return noise ? `${monsterSentenceSubject(monster)} ${noise}` : null;
}
