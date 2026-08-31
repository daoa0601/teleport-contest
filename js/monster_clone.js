// Monster cloning and splitting.
// C refs: makemon.c clone_mon() and potion.c split_mon().

import { G_EXTINCT } from './const.js';
import { newsym } from './display.js';
import { game } from './gstate.js';
import { nextIdent } from './ident.js';
import { findMonsterNearPosition } from './mklev.js';
import { rn2 } from './rng.js';

function copyPetState(monster, clone) {
    const source = monster.edog || monster.mextra?.edog;
    if (!source) return;
    const edog = {
        ...source,
        ogoal: source.ogoal ? { ...source.ogoal } : source.ogoal,
    };
    clone.edog = edog;
    clone.mextra = { ...(clone.mextra || {}), edog };
}

export function cloneMonster(
    monster,
    state = game,
    { monsterMoving = false, random = rn2 } = {},
) {
    if (!monster || (monster.mhp ?? 0) <= 1) return null;
    if ((state.mvitals?.[monster.mnum]?.mvflags ?? 0) & G_EXTINCT)
        return null;

    const position = findMonsterNearPosition(
        monster.mnum, monster.mx, monster.my, { state },
    );
    if (!position) return null;

    const clone = {
        ...monster,
        mextra: monster.mextra ? { ...monster.mextra } : monster.mextra,
        m_id: nextIdent(state),
        mx: position.x,
        my: position.y,
        mundetected: 0,
        mtrapped: 0,
        mcloned: 1,
        mleashed: 0,
        isshk: 0,
        isgd: 0,
        ispriest: 0,
        minvent: [],
        hasInventory: false,
        mtrack: [],
        _track: [],
    };
    clone.inventory = clone.minvent;
    clone.mhpmax = monster.mhpmax;
    clone.mhp = Math.trunc(monster.mhp / 2);
    monster.mhp -= clone.mhp;

    if (!monsterMoving && monster.mpeaceful) {
        const attitudeRange = Math.max(2 + (state.u?.uluck ?? 0), 2);
        if ((monster.mtame ?? 0) > 0) {
            clone.mtame = random(attitudeRange) ? monster.mtame : 0;
        } else {
            clone.mpeaceful = random(attitudeRange) ? 1 : 0;
        }
    }

    if (clone.isminion && monster.emin) {
        clone.emin = { ...monster.emin };
    } else if ((clone.mtame ?? 0) > 0) {
        clone.pet = true;
        copyPetState(monster, clone);
    } else {
        clone.pet = false;
        delete clone.edog;
        if (clone.mextra) delete clone.mextra.edog;
    }

    state.level.monsters.push(clone);
    if (state === game) newsym(clone.mx, clone.my);
    return clone;
}

export function splitMonster(monster, state = game, options = {}) {
    if (!monster) return null;
    const maximumHp = monster.mhpmax ?? monster.mhp ?? 0;
    if ((monster.mhp ?? 0) > maximumHp) monster.mhp = maximumHp;
    const clone = cloneMonster(monster, state, options);
    if (!clone) return null;

    clone.mhpmax = Math.trunc(maximumHp / 2);
    monster.mhpmax = maximumHp - clone.mhpmax;
    return clone;
}
