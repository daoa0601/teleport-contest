// Alignment value assigned to a live monster.
// C ref: makemon.c set_malign().

import { A_NONE } from './const.js';
import { game } from './gstate.js';
import {
    MONSTER_ALIGNMENT, MONSTER_FLAGS2,
} from './monster_data.js';

const M2_HOSTILE = 0x00100000;
const M2_PEACEFUL = 0x00200000;

export function setMonsterMalign(monster, state = game) {
    let alignment = MONSTER_ALIGNMENT[monster?.mnum] ?? 0;
    if (monster?.ispriest || monster?.isminion) {
        if (monster.ispriest && monster.epri)
            alignment = monster.epri.shralign;
        else if (monster.isminion && monster.emin)
            alignment = monster.emin.min_align;
        if (alignment !== A_NONE) alignment *= 5;
    }

    const peaceful = !!monster?.mpeaceful;
    const coaligned = Math.sign(alignment)
        === Math.sign(state.u?.ualign?.type ?? 0);
    const absoluteAlignment = Math.abs(alignment);
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;

    if (monster?.mnum === state.urole?.ldrnum) {
        monster.malign = -20;
    } else if (alignment === A_NONE) {
        monster.malign = peaceful ? 0 : 20;
    } else if (flags & M2_PEACEFUL) {
        monster.malign = (peaceful ? -3 : 3)
            * Math.max(5, absoluteAlignment);
    } else if (flags & M2_HOSTILE) {
        monster.malign = coaligned ? 0 : Math.max(5, absoluteAlignment);
    } else if (coaligned) {
        monster.malign = peaceful
            ? -3 * Math.max(3, absoluteAlignment)
            : Math.max(3, absoluteAlignment);
    } else {
        monster.malign = absoluteAlignment;
    }
}
