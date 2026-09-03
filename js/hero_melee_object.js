// Effects of a non-weapon wielded by the hero.
// C ref: uhitm.c hmon_hitmon_misc_obj().

import { game } from './gstate.js';
import { makeMonsterFlee } from './monster_flee.js';
import {
    monsterIsUndead, monsterIsVampireShifter,
} from './monster_data.js';
import { CLOVE_OF_GARLIC } from './object_data.js';
import { rnd } from './rng.js';

export async function resolveHeroMeleeObjectContact(
    monster,
    object,
    { state = game, rollOne = rnd } = {},
) {
    if (object?.otyp !== CLOVE_OF_GARLIC) return null;

    if (monsterIsUndead(monster.mnum) || monsterIsVampireShifter(monster)) {
        await makeMonsterFlee(monster, {
            state,
            turns: rollOne(4) + rollOne(4),
        });
    }
    return { damage: 1 };
}
