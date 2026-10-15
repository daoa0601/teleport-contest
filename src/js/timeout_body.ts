// C timeout.c:nh_timeout(), counters between dialogue and property expiry.
import { game } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { MONSTER_LEVEL, requireMonsterData } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { heroIsUnchanging, returnHeroToHumanForm } from './polyself.js';
import { rnd } from './rng.js';
import { isWereMonster, revertHeroWereForm } from './were.js';

export async function advanceBodyTimeouts(state = game): Promise<void> {
    const hero = state.u;
    if (hero.mtimedone !== undefined && hero.mtimedone > 0 && --hero.mtimedone === 0) {
        if (hero.umonnum === undefined) throw new Error('Timed polymorph has no species');
        if (heroIsUnchanging(state)) {
            hero.mtimedone = rnd(100 * requireMonsterData(MONSTER_LEVEL, hero.umonnum) + 1);
        } else if (isWereMonster({ mnum: hero.umonnum })) {
            await revertHeroWereForm({ state });
        } else {
            await returnHeroToHumanForm(state);
        }
    }
    if ((hero.ucreamed ?? 0) > 0) hero.ucreamed = (hero.ucreamed ?? 0) - 1;
}

export async function advanceGallopingTimeout(state = game): Promise<void> {
    const hero = state.u;
    if ((hero.ugallop ?? 0) <= 0) return;
    hero.ugallop = (hero.ugallop ?? 0) - 1;
    if (hero.ugallop === 0 && hero.usteed)
        await plineWithContinuation(`${monsterName(hero.usteed, { state, capitalized: true })} stops galloping.`);
}
