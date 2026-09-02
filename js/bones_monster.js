import { G_EXTINCT, G_GENOD } from './const.js';
import { sanitizeBonesName } from './bones_name.js';
import { removeMonsterFromGame } from './monster_departure.js';

// C bones.c:getbones(). Names from an older game are cleaned before use.
// Monsters whose species is already extinct or genocided leave without dying.

function sanitizeMonsterName(monster) {
    const name = monster?.mextra?.mgivenname
        || monster?.mgivenname
        || monster?.name;
    if (!name) return;
    const sanitized = sanitizeBonesName(name);
    monster.name = sanitized;
    monster.mgivenname = sanitized;
    monster.mextra = {
        ...(monster.mextra || {}),
        mgivenname: sanitized,
    };
}

function speciesIsGone(monster, state) {
    const flags = state.mvitals?.[monster.mnum]?.mvflags ?? 0;
    return !!(flags & (G_EXTINCT | G_GENOD));
}

export function restoreBonesMonsters(level, state) {
    for (const monster of [...(level?.monsters || [])]) {
        sanitizeMonsterName(monster);
        if (!speciesIsGone(monster, state)) continue;
        removeMonsterFromGame(monster, {
            preserveGlyph: true,
        });
    }
}
