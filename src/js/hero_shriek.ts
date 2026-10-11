// The #monster shriek used by a polymorphed shrieker.
// C ref: cmd.c domonability().

import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import { aggravateMonsters } from './monster_anger.js';
import { MONSTER_SOUND } from './monster_data.js';
import { heroMonsterForm } from './polyself.js';
import { rn2 } from './rng.js';

const MS_SHRIEK = 18;

export function heroCanShriek(state: GameState = game) {
    const form = heroMonsterForm(state);
    return form !== null && form !== undefined && MONSTER_SOUND[form] === MS_SHRIEK;
}

export async function useHeroShriek({
    state = game,
    publish = plineWithContinuation,
    random = rn2,
}: { state?: GameState; publish?: MessagePublisher; random?: (bound: number) => number } = {}) {
    if (!heroCanShriek(state))
        return { used: false, spentTime: false, reason: 'cannot-shriek' };

    await publish('You shriek.');
    if (state.u.uburied) {
        await publish(
            'Unfortunately sound does not carry well through rock.',
        );
        return { used: true, spentTime: false, awakened: [] };
    }

    const awakened = aggravateMonsters(state, random);
    return { used: true, spentTime: false, awakened };
}
