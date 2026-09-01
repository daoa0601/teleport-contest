// Monster magic resistance.
// C ref: zap.c resist().

import {
    MONSTER_MAGIC_RESISTANCE,
} from './monster_data.js';
import { rn2 } from './rng.js';

export function monsterResistsEffect(
    monster, attackLevel, random = rn2,
) {
    let defenseLevel = monster?.m_lev ?? 1;
    if (defenseLevel > 50) defenseLevel = 50;
    else if (defenseLevel < 1) defenseLevel = 1;
    const resistance = MONSTER_MAGIC_RESISTANCE[monster?.mnum] ?? 0;
    return random(100 + attackLevel - defenseLevel) < resistance;
}
