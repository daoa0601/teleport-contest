// C uhitm.c:mhitm_mgc_atk_negated(), for monster-vs-monster effects.
import { canSeeMonster } from './display.js';
import { plineWithContinuation } from './pline.js';
import { game } from './gstate.js';
import { specialAttackNegated } from './magic_negation.js';
import { monsterName } from './monster_name.js';
import { rn2 } from './rng.js';
export async function monsterCombatAttackNegated(attacker, defender, { state = game, visible, verbose = true, publish = plineWithContinuation, random = rn2, }) {
    const negated = specialAttackNegated(attacker, defender, { state, random });
    if (negated && !attacker.mcan && verbose && visible && canSeeMonster(defender))
        await publish(`${monsterName(defender, { state, capitalized: true })} avoids harm.`);
    return negated;
}
//# sourceMappingURL=monster_combat_negation.js.map