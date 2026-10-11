// C uhitm.c:mhitm_mgc_atk_negated(), for monster-vs-monster effects.
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { specialAttackNegated } from './magic_negation.js';
import { monsterName } from './monster_name.js';
import { rn2 } from './rng.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';

export async function monsterCombatAttackNegated(
    attacker: Monster, defender: Monster, {
        state = game, visible, verbose = true, publish = plineWithContinuation, random = rn2,
    }: { state?: GameState; visible: boolean; verbose?: boolean; publish?: MessagePublisher; random?: typeof rn2 },
): Promise<boolean> {
    const negated = specialAttackNegated(attacker, defender, { state, random });
    if (negated && !attacker.mcan && verbose && visible && canSeeMonster(defender))
        await publish(`${monsterName(defender, { state, capitalized: true })} avoids harm.`);
    return negated;
}
