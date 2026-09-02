// A monster beginning to flee.
// C ref: monmove.c monflee().

import {
    M_AP_FURNITURE, M_AP_OBJECT,
} from './const.js';
import { canProjectMonster, pline } from './display.js';
import { game } from './gstate.js';
import {
    MONSTER_MOVE, MONSTER_NAME,
} from './monster_data.js';

export async function makeMonsterFlee(monster, {
    state = game,
    turns = 0,
    first = false,
    announce = true,
    publish = pline,
} = {}) {
    if (!monster || (monster.mhp ?? 1) <= 0) return false;
    if (state.u?.ustuck === monster) {
        state.u.ustuck = null;
        state.u.uswallow = false;
    }

    const canStart = !first || !monster.mflee;
    if (canStart) {
        if (turns === 0) {
            monster.mfleetim = 0;
        } else if (!monster.mflee || monster.mfleetim) {
            const current = monster.mfleetim ?? 0;
            const total = turns + current;
            monster.mfleetim = Math.min(total === 1 ? 2 : total, 127);
        }
        if (!monster.mflee && announce
            && canProjectMonster(monster, monster.mx, monster.my)
            && monster.m_ap_type !== M_AP_FURNITURE
            && monster.m_ap_type !== M_AP_OBJECT) {
            const name = MONSTER_NAME[monster.mnum] || 'monster';
            await publish((monster.mcanmove === 0
                || (MONSTER_MOVE[monster.mnum] ?? 0) === 0)
                ? `The immobile ${name} seems to flinch.`
                : `The ${name} turns to flee.`);
        }
        monster.mflee = 1;
    }
    monster.mtrack = [];
    return canStart;
}
