// Once-per-world-turn HP recovery. C allmain.c:regen_hp().
import { currentAttribute } from './attrib.js';
import { A_CON, Is_waterlevel, MOD_ENCUMBER, Upolyd } from './const.js';
import { requireInitializedGame } from './gstate.js';
import { heroIsBreathless, heroSpecies } from './hero_species.js';
import { MONSTER_SYMBOL } from './monster_data.js';
import { returnHeroToHumanForm } from './polyself.js';
import { propertyIsActive } from './properties.js';
import { rn2 } from './rng.js';
import { isPoolAt } from './terrain_properties.js';
const S_EEL = 57;
// The caller owns interrupt_multi() when this recovery reaches full health.
export async function regenerateHeroHp(capacity, turn) {
    const state = requireInitializedGame();
    const hero = state.u;
    if (hero.invulnerable)
        return false;
    const encumbranceAllowsRecovery = capacity < MOD_ENCUMBER || !hero.umoved;
    const regeneration = propertyIsActive('regeneration', state);
    const sleepingRecovery = propertyIsActive('sleepy', state) && !!hero.usleep;
    const canRegenerate = regeneration || sleepingRecovery;
    if (Upolyd(hero)) {
        if (hero.mh < 1) {
            await returnHeroToHumanForm(state);
            return false;
        }
        let healing = 0;
        if (MONSTER_SYMBOL[heroSpecies(state)] === S_EEL
            && !isPoolAt(hero.ux, hero.uy, state) && !Is_waterlevel(hero.uz)
            && !heroIsBreathless(state)) {
            if (hero.mh > 1 && !regeneration && rn2(hero.mh) > rn2(8)
                && (!propertyIsActive('halfPhysicalDamage', state) || turn % 2 === 0))
                healing = -1;
        }
        else if (hero.mh < hero.mhmax
            && (canRegenerate || encumbranceAllowsRecovery && turn % 20 === 0)) {
            healing = 1;
        }
        if (!healing)
            return false;
        hero.mh += healing;
        return hero.mh === hero.mhmax;
    }
    if (hero.uhp >= hero.uhpmax || !encumbranceAllowsRecovery && !canRegenerate)
        return false;
    let healing = Number(hero.ulevel + currentAttribute(A_CON, state) > rn2(100));
    if (canRegenerate)
        healing++;
    if (sleepingRecovery)
        healing++;
    if (!healing)
        return false;
    hero.uhp = Math.min(hero.uhpmax, hero.uhp + healing);
    return hero.uhp === hero.uhpmax;
}
//# sourceMappingURL=hero_regeneration.js.map