// Native mthrowu.c:thrwmm(). A weapon change spends the slot without a hit.
import { M_ATTK_HIT, M_ATTK_MISS } from './const.js';
import { throwMonsterWeaponAtMonster } from './monster_throw.js';
export async function resolveMonsterCombatThrow(source, target, { state, random, rollOne, publish, }) {
    const volley = await throwMonsterWeaponAtMonster(source, target, state, {
        ...(random ? { random } : {}), ...(rollOne ? { rollOne } : {}), ...(publish ? { publish } : {}),
    });
    return {
        nativeResult: volley?.madeAttack ? M_ATTK_HIT : M_ATTK_MISS,
        heroDied: volley?.heroDied ?? false,
    };
}
//# sourceMappingURL=monster_combat_throw.js.map