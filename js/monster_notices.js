// C hack.c:notice_mon() and notice_all_mons(): the accessibility notices
// behind the spot_monsters option (C a11y.mon_notices). C latches each
// monster's mspotted and prints "You see <mon>." once per sighting; a
// monster that can no longer be spotted drops its latch silently.
// vision_recalc() owns the catch-up, including recalculations triggered by
// message output. Startup, level arrival, mapping, and teleport landings
// block both monster and glyph notices until their own messages finish.
import { canSeeMonster, canSpotMonster, plineWithContinuation, } from './display.js';
import { game } from './gstate.js';
import { MGIVENNAME, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE } from './const.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2 } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { impossible } from './diagnostics.js';
// C include/monflag.h: M1_HIDE (is_hider) and M2_PNAME (type_is_pname).
const M1_HIDE = 0x100;
const M2_PNAME = 0x80000;
// C flag.h:notice_mon_off()/notice_mon_on(). A nested landing must leave
// its caller's notices blocked until that caller has finished its messages.
export function blockMonsterNotices(state) {
    state._monsterNoticesBlocked = (state._monsterNoticesBlocked ?? 0) + 1;
}
export async function unblockMonsterNotices(state) {
    state._monsterNoticesBlocked = (state._monsterNoticesBlocked ?? 0) - 1;
    if (state._monsterNoticesBlocked < 0) {
        await impossible('mon_notices_blocked<0', { state });
        state._monsterNoticesBlocked = 0;
    }
}
export async function withMonsterNoticesBlocked(state, action) {
    blockMonsterNotices(state);
    try {
        return await action();
    }
    finally {
        await unblockMonsterNotices(state);
    }
}
function monsterIsSpottable(monster) {
    if (!canSpotMonster(monster))
        return false;
    // C: a hider that is still concealing itself never counts as spotted,
    // whether mundetected or mimicking furniture or an object.
    if (((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_HIDE)
        && (monster.mundetected
            || M_AP_TYPE(monster) === M_AP_FURNITURE
            || M_AP_TYPE(monster) === M_AP_OBJECT)) {
        return false;
    }
    return true;
}
// C hack.c:notice_mon(). The announcement names the monster with its own
// article rules: pets are yours, unnamed common monsters take "a", and
// named or proper-name monsters take no article at all. A peaceful monster
// that is not a pet is described as peaceful.
export async function noticeMonster(monster, state = game, publish = plineWithContinuation) {
    if (!state.flags.spot_monsters || state._monsterNoticesBlocked)
        return;
    const spottable = monsterIsSpottable(monster);
    if (spottable && !monster.mspotted && !monster.dead && monster.mhp > 0) {
        monster.mspotted = 1;
        const named = MGIVENNAME(monster) !== '';
        const article = monster.mtame ? 'your'
            : !named && !((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_PNAME) ? 'a'
                : 'none';
        // C hack.c:1727 suppresses the saddle only for a named monster, so
        // an unnamed steed is announced as "your saddled pony".
        const name = monsterName(monster, {
            state,
            article,
            suppressSaddle: named,
            ...(monster.mpeaceful && !monster.mtame ? { adjective: 'peaceful' } : {}),
        });
        await publish(`You ${canSeeMonster(monster) ? 'see' : 'notice'} ${name}.`, {
            position: { x: monster.mx, y: monster.my },
        });
    }
    else if (!spottable) {
        monster.mspotted = 0;
    }
}
// C hack.c:notice_all_mons(). Monsters that can no longer be spotted drop
// their latch (the native reset flag is always TRUE at every call site),
// and the spottable ones are announced nearest first, like the native
// distance sort of notice_mons_cmp().
export async function noticeAllMonsters(state = game, publish = plineWithContinuation) {
    if (!state.flags.spot_monsters || state._monsterNoticesBlocked)
        return;
    const spottable = [];
    for (const monster of state.level?.monsters ?? []) {
        if (monster.dead || monster.mhp <= 0)
            continue;
        if (canSpotMonster(monster))
            spottable.push(monster);
        else
            monster.mspotted = 0;
    }
    const { ux, uy } = state.u;
    spottable.sort((one, two) => (one.mx - ux) ** 2 + (one.my - uy) ** 2 - ((two.mx - ux) ** 2 + (two.my - uy) ** 2));
    for (const monster of spottable) {
        await noticeMonster(monster, state, publish);
    }
}
//# sourceMappingURL=monster_notices.js.map