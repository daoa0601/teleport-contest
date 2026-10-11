import { isPoolAt } from './terrain_properties.js';
// The #monster water-splitting ability for a hero in gremlin form.
// C ref: cmd.c domonability().

import { FOUNTAIN } from './const.js';

import { plineWithContinuation } from './display.js';
import { dryFountainAt } from './fountain.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import { splitHeroMonsterForm } from './mklev.js';
import { MONSTER_NAME } from './monster_data.js';
import { heroMonsterForm } from './polyself.js';

const PM_GREMLIN = MONSTER_NAME.indexOf('gremlin');

export function heroCanSplitLikeGremlin(state: GameState = game) {
    return heroMonsterForm(state) === PM_GREMLIN;
}

async function splitGremlin(state: GameState, publish: MessagePublisher) {
    const clone = await splitHeroMonsterForm(state);
    if (clone) await publish('You multiply!');
    return clone;
}

export async function useHeroGremlinSplit({
    state = game,
    publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}) {
    if (!heroCanSplitLikeGremlin(state))
        return { used: false, spentTime: false, reason: 'not-gremlin' };

    const location = state.level?.at(state.u.ux, state.u.uy);
    if (location?.typ === FOUNTAIN) {
        const clone = await splitGremlin(state, publish);
        if (clone) {
            await dryFountainAt(state.u.ux, state.u.uy, { state, publish });
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
