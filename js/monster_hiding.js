// C restore.c:getlev(): rechecked cover and a fresh hiding attempt for a
// restored monster. The native hiding decisions themselves live in mon.ts
// (restrap()/hideunder()/maybe_unhide_at()) and monmove.ts
// (can_hide_under_obj()).
import { COULD_SEE, IN_SIGHT, M_AP_TYPE } from './const.js';
import { game, requireLiveGame } from './gstate.js';
import { MONSTER_FLAGS1, MONSTER_SYMBOL } from './monster_data.js';
import { attemptMonsterRestrap, hideMonsterUnder } from './mon.js';
const M1_CONCEAL = 0x80, M1_HIDE = 0x100;
const S_EEL = 57, S_MIMIC = 13;
// C restore.c:getlev() rechecks existing cover before catch-up and shape
// changes. A saved mundetected bit alone does not establish valid cover.
export async function restoreMonsterCover(monster, state = game) {
    if (monster !== state.u.usteed && monster.mundetected
        && ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CONCEAL))
        await hideMonsterUnder(monster, state);
}
// Restored hiders get their attempt before normal vision can expose their spot.
// Only that square's vision bits are hidden, and hideunder sees restored vision.
export async function hideMonsterOnRestore(monster, state = game) {
    requireLiveGame(state);
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const hiderUnder = !!(flags & M1_CONCEAL) || MONSTER_SYMBOL[monster.mnum] === S_EEL;
    if (!(flags & M1_HIDE) && !hiderUnder)
        return;
    if (monster.mundetected || M_AP_TYPE(monster))
        return;
    const row = state.viz_array?.[monster.my];
    const savedVision = row?.[monster.mx];
    if (!row || savedVision === undefined)
        throw new Error('Restoring monster hiding requires an initialized vision square.');
    row[monster.mx] = savedVision & ~(IN_SIGHT | COULD_SEE);
    try {
        if (flags & M1_HIDE)
            await attemptMonsterRestrap(monster, state);
        if (MONSTER_SYMBOL[monster.mnum] === S_MIMIC && !M_AP_TYPE(monster))
            await attemptMonsterRestrap(monster, state);
    }
    finally {
        row[monster.mx] = savedVision;
    }
    if (hiderUnder)
        await hideMonsterUnder(monster, state);
}
//# sourceMappingURL=monster_hiding.js.map