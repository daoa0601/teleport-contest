// Native uhitm.c:hmon_hitmon_dmg_recalc() and weapon.c:weapon_dam_bonus().
import { P_TWO_WEAPON_COMBAT } from './const.js';
import { game, requireLiveGame } from './gstate.js';
import { OBJECT_BIMANUAL } from './object_data.js';
import { launcherMatchesAmmo } from './object_properties.js';
import { useHeroSkill, weaponSkillDamageBonus, weaponSkillType } from './skills.js';
import { heroStrengthDamageBonus } from './weapon_damage.js';
// The hmon caller enters this stage only after positive contact damage.
// Zero-damage shade contacts keep their separate admission and message rules.
export async function recalculateHeroPhysicalDamage(damage, object, { mode, twoHits, getDamageBonus, useWeaponSkill, trainWeaponSkill, state = game, }) {
    requireLiveGame(state);
    const primary = state.uwep || state.u.uwep || null;
    const launched = launcherMatchesAmmo(object, primary);
    let bonus = 0;
    if (getDamageBonus) {
        bonus = state.u.udaminc ?? 0;
        if (mode !== 'thrown' || !launched) {
            let strength = heroStrengthDamageBonus(state);
            const magnitude = Math.abs(strength);
            if (twoHits)
                strength = Math.trunc((3 * magnitude + 2) / 4) * Math.sign(strength);
            else if (mode === 'melee' && primary && OBJECT_BIMANUAL[primary.otyp])
                strength = Math.trunc((3 * magnitude + 1) / 2) * Math.sign(strength);
            bonus += strength;
        }
    }
    if (useWeaponSkill) {
        const skillWeapon = launched ? primary : object;
        bonus += weaponSkillDamageBonus(skillWeapon, state);
        if (trainWeaponSkill) {
            const skill = mode !== 'melee' ? weaponSkillType(skillWeapon)
                : state.u.twoweap ? P_TWO_WEAPON_COMBAT : weaponSkillType(primary);
            await useHeroSkill(skill, 1, { state });
        }
    }
    return Math.max(1, damage + bonus);
}
//# sourceMappingURL=hero_physical_damage.js.map