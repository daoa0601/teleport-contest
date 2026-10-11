// C uhitm.c:explum(). The attack caller announces the explosion and ends
// the hero's monster form after this effect, before passive retaliation.
import { monsterResistsBlindingLight } from './blinding_attack.js';
import { EXPL_FIERY, EXPL_FROSTY, EXPL_MAGICAL, M_ATTK_DEF_DIED, M_ATTK_HIT, MON_EXPLODE, } from './const.js';
import { plineWithContinuation } from './display.js';
import { explode } from './explosion.js';
import { game, requirePlayingGame } from './gstate.js';
import { AD_BLND, AD_COLD, AD_ELEC, AD_FIRE, AD_HALU } from './monster_attack_types.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { wakeMonstersNear } from './monster_wake.js';
import { d, rn2 } from './rng.js';
const M1_NOEYES = 0x00001000;
export async function resolveHeroCombatExplosion(defender, attack, { state = game, publish = plineWithContinuation, random = rn2, rollDice = d } = {}) {
    requirePlayingGame(state);
    const [, damageType, dice, sides] = attack;
    const damage = rollDice(dice, sides);
    if (damageType === AD_BLND) {
        if (defender && !monsterResistsBlindingLight(defender, state)) {
            await publish(`${monsterName(defender, { state, capitalized: true })} is blinded by your flash of light!`);
            defender.mblinded = Math.min((defender.mblinded ?? 0) + damage, 127);
            defender.mcansee = 0;
        }
    }
    else if (damageType === AD_HALU) {
        if (defender && !((MONSTER_FLAGS1[defender.mnum] ?? 0) & M1_NOEYES) && defender.mcansee) {
            await publish(`${monsterName(defender, { state, capitalized: true })} is affected by your flash of light!`);
            defender.mconf = 1;
        }
    }
    else if (damageType === AD_COLD || damageType === AD_FIRE || damageType === AD_ELEC) {
        const style = damageType === AD_COLD ? EXPL_FROSTY
            : damageType === AD_FIRE ? EXPL_FIERY : EXPL_MAGICAL;
        const blast = await explode(state.u.ux, state.u.uy, damageType - 1 + 20, damage, MON_EXPLODE, style, { state, publish, random, heroCaused: true });
        const targetDied = defender !== null && defender.mhp <= 0;
        const nativeResult = targetDied ? M_ATTK_DEF_DIED : M_ATTK_HIT;
        if (blast.heroDied)
            return { nativeResult, heroDied: true };
        if (targetDied)
            return { nativeResult, heroDied: false };
    }
    wakeMonstersNear(state.u.ux, state.u.uy, 49, state);
    return { nativeResult: M_ATTK_HIT, heroDied: false };
}
//# sourceMappingURL=hero_combat_explosion.js.map