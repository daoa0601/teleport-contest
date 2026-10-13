// Alignment value assigned to a live monster.
// C refs: priest.c mon_aligntyp() and makemon.c set_malign().
import { A_NONE } from './const.js';
import { game } from './gstate.js';
import { MONSTER_ALIGNMENT, MONSTER_FLAGS2, MONSTER_SOUND, requireMonsterData, } from './monster_data.js';
const M2_HOSTILE = 0x00100000;
const M2_PEACEFUL = 0x00200000;
const MS_LEADER = 36;
function monsterAlignmentValue(monster) {
    if (monster.ispriest) {
        if (!monster.epri)
            throw new Error(`Priest ${monster.m_id} has no temple state`);
        return monster.epri.shralign;
    }
    if (monster.isminion) {
        if (!monster.emin)
            throw new Error(`Minion ${monster.m_id} has no alignment state`);
        return monster.emin.min_align;
    }
    return requireMonsterData(MONSTER_ALIGNMENT, monster.mnum);
}
export function monsterAlignmentType(monster) {
    const alignment = monsterAlignmentValue(monster);
    return alignment === A_NONE ? A_NONE : Math.sign(alignment);
}
export function setMonsterMalign(monster, state = game) {
    let alignment = monsterAlignmentValue(monster);
    if ((monster.ispriest || monster.isminion) && alignment !== A_NONE)
        alignment *= 5;
    const peaceful = !!monster?.mpeaceful;
    const coaligned = Math.sign(alignment)
        === Math.sign(state.u?.ualign?.type ?? 0);
    const absoluteAlignment = Math.abs(alignment);
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    if (MONSTER_SOUND[monster.mnum] === MS_LEADER) {
        monster.malign = -20;
    }
    else if (alignment === A_NONE) {
        monster.malign = peaceful ? 0 : 20;
    }
    else if (flags & M2_PEACEFUL) {
        monster.malign = (peaceful ? -3 : 3)
            * Math.max(5, absoluteAlignment);
    }
    else if (flags & M2_HOSTILE) {
        monster.malign = coaligned ? 0 : Math.max(5, absoluteAlignment);
    }
    else if (coaligned) {
        monster.malign = peaceful
            ? -3 * Math.max(3, absoluteAlignment)
            : Math.max(3, absoluteAlignment);
    }
    else {
        monster.malign = absoluteAlignment;
    }
}
//# sourceMappingURL=monster_alignment.js.map