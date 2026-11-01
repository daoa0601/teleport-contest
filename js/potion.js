// Monster-side potion effects: splitting a monster by heat.
// C ref: potion.c:split_mon().
import { canSpotMonster } from './display.js';
import { game } from './gstate.js';
import { cloneMonster } from './makemon.js';
import { plineWithContinuation } from './pline.js';
import { monsterName } from './do_name.js';
import { possessiveName } from './hacklib.js';
// C potion.c:split_mon() for a monster.  The heat source is named before
// cloning, and a spotted monster announces the division.
export async function splitMonster(monster, state = game, { heatSource = null, publish = plineWithContinuation, ...options } = {}) {
    if (!monster)
        return null;
    const reason = heatSource === 'hero' ? ' from your heat'
        : heatSource ? ` from ${possessiveName(monsterName(heatSource, { state }))} heat` : '';
    const maximumHp = monster.mhpmax ?? monster.mhp ?? 0;
    if ((monster.mhp ?? 0) > maximumHp)
        monster.mhp = maximumHp;
    const clone = await cloneMonster(monster, state, options);
    if (!clone)
        return null;
    clone.mhpmax = Math.trunc(maximumHp / 2);
    monster.mhpmax = maximumHp - clone.mhpmax;
    if (canSpotMonster(monster))
        await publish(`${monsterName(monster, { state, capitalized: true })} multiplies${reason}!`);
    return clone;
}
//# sourceMappingURL=potion.js.map