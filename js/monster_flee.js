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

export async function makeMonsterFlee(monster, state = game) {
    if (!monster || (monster.mhp ?? 1) <= 0) return;
    if (state.u?.ustuck === monster) {
        state.u.ustuck = null;
        state.u.uswallow = false;
    }
    if (!monster.mflee
        && canProjectMonster(monster, monster.mx, monster.my)
        && monster.m_ap_type !== M_AP_FURNITURE
        && monster.m_ap_type !== M_AP_OBJECT) {
        const name = MONSTER_NAME[monster.mnum] || 'monster';
        await pline((monster.mcanmove === 0
            || (MONSTER_MOVE[monster.mnum] ?? 0) === 0)
            ? `The immobile ${name} seems to flinch.`
            : `The ${name} turns to flee.`);
    }
    monster.mfleetim = 0;
    monster.mflee = 1;
    monster.mtrack = [];
}
