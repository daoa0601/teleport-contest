// Effects released when an expensive camera is destroyed.
// C ref: dothrow.c release_camera_demon().

import {
    canProjectMonster, plineWithContinuation, randomDisplayMonsterName,
} from './display.js';
import { game } from './gstate.js';
import { makemonAt } from './mklev.js';
import { setMonsterMalign } from './monster_alignment.js';
import { rn2 } from './rng.js';

const PM_HOMUNCULUS = 52;
const PM_IMP = 53;

export async function releaseCameraDemon(object, x, y, {
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    summonMonster = makemonAt,
} = {}) {
    if (random(3) !== 0) return null;
    const mnum = random(3) === 0 ? PM_IMP : PM_HOMUNCULUS;
    const monster = await summonMonster(mnum, x, y, 0);
    if (!monster) return null;

    if (canProjectMonster(monster, monster.mx, monster.my)) {
        const subject = state.u?.hallucinating
            ? `A ${randomDisplayMonsterName()}`
            : 'The picture-painting demon';
        await publish(`${subject} is released!`);
    }
    monster.mpeaceful = object.cursed ? 0 : 1;
    setMonsterMalign(monster, state);
    return monster;
}
