// Permanent monster invisibility and effects which block it.
// C ref: worn.c mon_set_minvis().
import type { Monster } from './monster_types.js';

export function setMonsterPermanentInvisibility(monster: Monster, permanent = true) {
    const oldPermanent = !!monster.perminvis;
    const oldInvisible = !!monster.minvis;
    monster.perminvis = permanent ? 1 : 0;
    if (!monster.invis_blkd) monster.minvis = monster.perminvis;
    return {
        oldPermanent,
        oldInvisible,
        permanent: !!monster.perminvis,
        invisible: !!monster.minvis,
        changed: oldInvisible !== !!monster.minvis,
    };
}
