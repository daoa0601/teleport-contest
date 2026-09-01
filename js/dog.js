// Tame monster state.
// C refs: dog.c tamedog(), newedog(), and initedog().

import { currentAttribute } from './attrib.js';
import { A_CHA } from './const.js';
import { game } from './gstate.js';
import { MONSTER_FLAGS2 } from './monster_data.js';

const M2_DOMESTIC = 0x00400000;

export function tameMonster(monster, state = game) {
    if (!monster) return false;
    if (monster.mfrozen)
        monster.mfrozen = Math.trunc((monster.mfrozen + 1) / 2);
    monster.msleeping = 0;
    monster.mpeaceful = 1;
    monster.mavenge = 0;
    monster.mflee = 0;
    monster.mfleetim = 0;
    const minimumTameness = (MONSTER_FLAGS2[monster.mnum] & M2_DOMESTIC)
        ? 10 : 5;
    monster.mtame = Math.max(minimumTameness, monster.mtame || 0);
    monster.pet = true;
    monster.mleashed = 0;
    monster.meating = 0;
    delete monster.malign;

    const dog = {
        parentmid: monster.m_id,
        droptime: 0,
        dropdist: 10000,
        apport: currentAttribute(A_CHA, state),
        whistletime: 0,
        hungrytime: (state.moves ?? 0) + 1000,
        ogoal: { x: -1, y: -1 },
        abuse: 0,
        revivals: 0,
        mhpmax_penalty: 0,
        killed_by_u: 0,
    };
    monster.edog = dog;
    monster.mextra = { ...(monster.mextra || {}), edog: dog };
    if (!state.u.uconduct) state.u.uconduct = {};
    state.u.uconduct.pets = (state.u.uconduct.pets || 0) + 1;
    return true;
}
