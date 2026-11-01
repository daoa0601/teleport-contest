// Monster-side potion effects: splitting a monster by heat.
// C ref: potion.c:split_mon().

import { canSpotMonster } from './display.js';
import { game } from './gstate.js';
import { cloneMonster } from './makemon.js';
import type { CloneOptions } from './makemon.js';
import { plineWithContinuation } from './pline.js';
import type { MessagePublisher } from './pline.js';
import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import { monsterName } from './do_name.js';
import { possessiveName } from './hacklib.js';

interface SplitOptions extends CloneOptions {
    // split_mon()'s second argument: whose heat made the monster divide.
    heatSource?: Monster | 'hero' | null;
    publish?: MessagePublisher;
}

// C potion.c:split_mon() for a monster.  The heat source is named before
// cloning, and a spotted monster announces the division.
export async function splitMonster(
    monster: Monster | null | undefined, state: GameState = game,
    { heatSource = null, publish = plineWithContinuation, ...options }: SplitOptions = {},
): Promise<Monster | null> {
    if (!monster) return null;
    const reason = heatSource === 'hero' ? ' from your heat'
        : heatSource ? ` from ${possessiveName(monsterName(heatSource, { state }))} heat` : '';
    const maximumHp = monster.mhpmax ?? monster.mhp ?? 0;
    if ((monster.mhp ?? 0) > maximumHp) monster.mhp = maximumHp;
    const clone = await cloneMonster(monster, state, options);
    if (!clone) return null;

    clone.mhpmax = Math.trunc(maximumHp / 2);
    monster.mhpmax = maximumHp - clone.mhpmax;
    if (canSpotMonster(monster))
        await publish(`${monsterName(monster, { state, capitalized: true })} multiplies${reason}!`);
    return clone;
}
