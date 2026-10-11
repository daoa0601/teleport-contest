// Native uhitm.c:hmon_hitmon_dmg_recalc() and weapon.c:weapon_dam_bonus().
import { heroUsesMartialArts } from './barehand_combat.js';
import {
    P_BARE_HANDED_COMBAT, P_BASIC, P_EXPERT, P_LAST_WEAPON, P_NONE,
    P_RIDING, P_SKILLED, P_TWO_WEAPON_COMBAT, P_UNSKILLED,
} from './const.js';
import { game, requireLiveGame } from './gstate.js';
import { OBJECT_BIMANUAL, OBJECT_SUBTYPE, requireObjectData } from './object_data.js';
import { launcherMatchesAmmo } from './object_properties.js';
import { ensureHeroSkills, useHeroSkill } from './skills.js';
import { heroStrengthDamageBonus } from './weapon_damage.js';
import type { GameState } from './game_state.js';
import type { HeroPhysicalAttackMode } from './hero_physical_types.js';
import type { GameObject } from './object_types.js';

interface HeroPhysicalDamageOptions {
    mode: HeroPhysicalAttackMode;
    twoHits: number;
    getDamageBonus: boolean;
    useWeaponSkill: boolean;
    trainWeaponSkill: boolean;
    state?: GameState;
}

// The hmon caller enters this stage only after positive contact damage.
// Zero-damage shade contacts keep their separate admission and message rules.
export async function recalculateHeroPhysicalDamage(
    damage: number, object: GameObject | null, {
        mode, twoHits, getDamageBonus, useWeaponSkill, trainWeaponSkill,
        state = game,
    }: HeroPhysicalDamageOptions,
): Promise<number> {
    requireLiveGame(state);
    const primary = state.uwep || state.u.uwep || null;
    const launched = launcherMatchesAmmo(object, primary);
    let bonus = 0;
    if (getDamageBonus) {
        bonus = state.u.udaminc ?? 0;
        if (mode !== 'thrown' || !launched) {
            let strength = heroStrengthDamageBonus(state);
            const magnitude = Math.abs(strength);
            if (twoHits) strength = Math.trunc((3 * magnitude + 2) / 4) * Math.sign(strength);
            else if (mode === 'melee' && primary && OBJECT_BIMANUAL[primary.otyp])
                strength = Math.trunc((3 * magnitude + 1) / 2) * Math.sign(strength);
            bonus += strength;
        }
    }

    if (useWeaponSkill) {
        const skillWeapon = launched ? primary : object;
        bonus += weaponDamageSkillBonus(skillWeapon, state);
        if (trainWeaponSkill) {
            const skill = mode !== 'melee' ? weaponSkillType(skillWeapon)
                : state.u.twoweap ? P_TWO_WEAPON_COMBAT : weaponSkillType(primary);
            await useHeroSkill(skill, 1, { state });
        }
    }
    return Math.max(1, damage + bonus);
}

function weaponDamageSkillBonus(object: GameObject | null, state: GameState): number {
    const weaponSkill = weaponSkillType(object);
    const twoWeaponAttack = !!state.u.twoweap && object !== null
        && (object === (state.uwep || state.u.uwep)
            || object === (state.uswapwep || state.u.uswapwep));
    const skill = twoWeaponAttack ? P_TWO_WEAPON_COMBAT : weaponSkill;
    let bonus = 0;
    if (skill !== P_NONE && skill <= P_LAST_WEAPON) {
        const level = proficiency(skill, state);
        bonus = level <= P_UNSKILLED ? -2 : level === P_BASIC ? 0
            : level === P_SKILLED ? 1 : level === P_EXPERT ? 2 : -2;
    } else if (skill === P_TWO_WEAPON_COMBAT) {
        const level = Math.min(proficiency(skill, state), proficiency(weaponSkill, state));
        bonus = level <= P_UNSKILLED ? -3 : level === P_BASIC ? -1
            : level === P_SKILLED ? 0 : level === P_EXPERT ? 1 : -3;
    } else if (skill === P_BARE_HANDED_COMBAT) {
        const level = Math.max(proficiency(skill, state), P_UNSKILLED);
        bonus = Math.trunc(level * (heroUsesMartialArts(state) ? 3 : 1) / 2);
    }
    if (state.u.usteed && skill !== P_TWO_WEAPON_COMBAT) {
        const riding = proficiency(P_RIDING, state);
        if (riding === P_SKILLED) bonus++;
        else if (riding === P_EXPERT) bonus += 2;
    }
    return bonus;
}

function weaponSkillType(object: GameObject | null): number {
    if (!object) return P_BARE_HANDED_COMBAT;
    // weapon_type accepts weapons, tools, and gems (sling ammunition).
    if (![2, 6, 13].includes(object.oclass)) return P_NONE;
    return Math.abs(requireObjectData(OBJECT_SUBTYPE, object.otyp));
}

function proficiency(skill: number, state: GameState): number {
    const entry = ensureHeroSkills(state)?.[skill];
    if (!entry) throw new Error(`Hero damage requires initialized skill ${skill}.`);
    return entry.skill;
}
