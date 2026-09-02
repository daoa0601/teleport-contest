// The #monster ability for a hero in nymph form.
// C refs: cmd.c domonability() and polyself.c doremove().

import { TT_BURIEDBALL } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { MONSTER_SYMBOL } from './monster_data.js';
import { heroIsPolymorphed } from './polyself.js';
import { unpunishHero } from './punishment.js';
import { surfaceName } from './terrain_name.js';

const S_NYMPH = 14;

export function heroCanRemovePunishment(state = game) {
    return heroIsPolymorphed(state)
        && MONSTER_SYMBOL[state.u?.umonnum] === S_NYMPH;
}

export async function useHeroNymphAbility({
    state = game,
    publish = plineWithContinuation,
} = {}) {
    if (!heroCanRemovePunishment(state))
        return { used: false, spentTime: false, reason: 'not-nymph' };

    const ball = state.uball || state.u?.uball;
    if (!ball) {
        if (state.u?.utrap && state.u.utraptype === TT_BURIEDBALL) {
            await publish(
                `The ball and chain are buried firmly in the ${
                    surfaceName(state.u.ux, state.u.uy, state)
                }.`,
            );
            return { used: true, spentTime: false, reason: 'buried' };
        }
        await publish('You are not chained to anything!');
        return { used: true, spentTime: false, reason: 'not-punished' };
    }

    unpunishHero(state);
    return { used: true, spentTime: true };
}
