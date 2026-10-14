// botl.c:weapon_status() and armor_status().
import { armorSimpleName } from './armor.js';
import { artifactById } from './artifacts.js';
import { P_LANCE, P_MORNING_STAR, P_POLEARMS, P_QUARTERSTAFF, P_SABER, P_SHORT_SWORD, P_UNICORN_HORN } from './const.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { AKLYS, AMULET_OF_GUARDING, CLOAK_OF_PROTECTION, CREAM_PIE, OBJECT_BIMANUAL, OBJECT_SUBTYPE, RIN_PROTECTION } from './object_data.js';
import { isWeaponTool } from './object_properties.js';
import { weaponDescription } from './weapon_description.js';
export function weaponStatus(state) {
    const weapon = state.uwep;
    if (!weapon) {
        if (state.uarmg)
            return 'Empty-hnd';
        return ((MONSTER_FLAGS1[state.u.umonnum ?? -1] ?? 0) & 0x00020000)
            ? 'Bare-hnds' : 'No-weapon';
    }
    const skill = weaponSkill(weapon);
    if (state.u.twoweap)
        return state.u.usteed && (skill === P_LANCE || weaponSkill(state.uswapwep) === P_LANCE)
            ? 'Dual+joust' : 'Dual-weps';
    let text;
    if (state.u.usteed && skill === P_LANCE)
        text = 'joust';
    else if (weapon.otyp === AKLYS)
        text = 'aklys';
    else if (weapon.oclass === 2 && skill >= P_SHORT_SWORD && skill <= P_SABER)
        text = 'sword';
    else if (skill === P_QUARTERSTAFF)
        text = 'staff';
    else if (skill === P_MORNING_STAR)
        text = 'mrng-star';
    else if (skill === P_POLEARMS)
        text = 'pole';
    else if (skill === P_UNICORN_HORN)
        text = 'unihorn';
    else {
        text = weaponDescription(weapon);
        if (text.toLowerCase() === 'food' && weapon.otyp === CREAM_PIE)
            text = 'pie';
    }
    const twoHanded = (weapon.oclass === 2 || isWeaponTool(weapon))
        && OBJECT_BIMANUAL[weapon.otyp] && !text.startsWith('2')
        && !text.toLowerCase().startsWith('two');
    text = text.charAt(0).toUpperCase() + text.slice(1);
    return `${twoHanded ? '2H-' : ''}${text.replace(/ /g, '-')}`;
}
function weaponSkill(object) {
    return object && [2, 6, 13].includes(object.oclass)
        ? Math.abs(OBJECT_SUBTYPE[object.otyp] ?? 0) : 0;
}
export function armorStatus(state) {
    const armor = [
        [state.uarmg, 'G', 'gloves'], [state.uarmc, 'C', 'cloak'],
        [state.uarm, 'A', 'suit'], [state.uarmu, 'U', 'shirt'],
        [state.uarmh, 'H', state.uarmh ? armorSimpleName(state.uarmh, state) : ''],
        [state.uarmf, 'B', 'boots'], [state.uarms, 'S', 'shield'],
    ];
    const worn = armor.filter(([object]) => !!object);
    let text = worn.length === 0 ? 'naked' : worn.length === 1
        ? worn[0]?.[2] ?? '' : worn.map(([, letter]) => letter).join('');
    const protection = state.uright?.otyp === RIN_PROTECTION || state.uleft?.otyp === RIN_PROTECTION
        || state.uamul?.otyp === AMULET_OF_GUARDING || state.uarmc?.otyp === CLOAK_OF_PROTECTION
        || artifactById(state.uarmh?.oartifact, state)?.name === 'The Mitre of Holiness'
        || artifactById(state.uwep?.oartifact, state)?.name === 'The Tsurugi of Muramasa';
    if (protection)
        text += '+';
    return text.charAt(0).toUpperCase() + text.slice(1);
}
//# sourceMappingURL=status_equipment.js.map