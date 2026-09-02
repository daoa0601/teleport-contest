// Waking monsters near a noise or disturbance.
// C ref: mon.c wake_nearto_core().

import { STRAT_WAITMASK } from './const.js';
import {
    canSeeMonster, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import {
    MONSTER_GENO, monsterTypeName,
} from './monster_data.js';

const G_UNIQ = 0x1000;

function monstersNear(x, y, distance, state) {
    return (state.level?.monsters || []).filter(monster => {
        if (!monster || (monster.mhp ?? 1) <= 0) return false;
        const dx = (monster.mx ?? 0) - x;
        const dy = (monster.my ?? 0) - y;
        return !distance || dx * dx + dy * dy < distance;
    });
}

function wakeMonster(monster) {
    monster.msleeping = 0;
    if (!((MONSTER_GENO[monster.mnum] || 0) & G_UNIQ))
        monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
}

export function wakeMonstersNear(x, y, distance, state = game) {
    for (const monster of monstersNear(x, y, distance, state))
        wakeMonster(monster);
}

export async function wakeMonstersNearWithMessages(
    x, y, distance, state = game, publish = plineWithContinuation,
) {
    for (const monster of monstersNear(x, y, distance, state)) {
        if (monster.msleeping
            && canSeeMonster(monster, monster.mx, monster.my)) {
            const name = monster.name
                || `The ${monsterTypeName(monster.mnum, !!monster.female)}`;
            await publish(`${name} wakes up.`);
        }
        wakeMonster(monster);
    }
}
