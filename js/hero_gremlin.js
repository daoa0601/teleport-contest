// The #monster water-splitting ability for a hero in gremlin form.
// C ref: cmd.c domonability().

import { FOUNTAIN } from './const.js';
import { isPoolAt } from './dbridge.js';
import { plineWithContinuation } from './display.js';
import {
    dryFountainTerrain, reportFountainWarning,
} from './fountain.js';
import { game } from './gstate.js';
import { splitHeroMonsterForm } from './mklev.js';
import { MONSTER_NAME } from './monster_data.js';
import { heroMonsterForm } from './polyself.js';

const PM_GREMLIN = MONSTER_NAME.indexOf('gremlin');

export function heroCanSplitLikeGremlin(state = game) {
    return heroMonsterForm(state) === PM_GREMLIN;
}

async function splitGremlin(state, publish) {
    const clone = await splitHeroMonsterForm(state);
    if (clone) await publish('You multiply!');
    return clone;
}

export async function useHeroGremlinSplit({
    state = game,
    publish = plineWithContinuation,
} = {}) {
    if (!heroCanSplitLikeGremlin(state))
        return { used: false, spentTime: false, reason: 'not-gremlin' };

    const location = state.level?.at(state.u.ux, state.u.uy);
    if (location?.typ === FOUNTAIN) {
        const clone = await splitGremlin(state, publish);
        if (clone) {
            const result = dryFountainTerrain(location, true);
            if (result.dried)
                await publish('The fountain dries up!');
            await reportFountainWarning(result.warning);
        }
        return { used: true, spentTime: false, clone };
    }

    if (isPoolAt(state.u.ux, state.u.uy, state)) {
        const clone = await splitGremlin(state, publish);
        return { used: true, spentTime: false, clone };
    }

    await publish('There is no fountain here.');
    return { used: true, spentTime: false, clone: null };
}
