// Monster wielded-weapon state.
// C ref: weapon.c possibly_unwield().

import { NEED_WEAPON, NO_WEAPON_WANTED, W_WEP } from './const.js';
import { stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { MONSTER_HAS_WEAPON_ATTACK } from './monster_data.js';
import { dropObjectFromMonsterInventory } from './monster_inventory.js';

export function monsterWieldedWeapon(monster) {
    return monster?.mw
        || (monster?.minvent || monster?.inventory || [])
            .find(object => object?.wielded
                || ((object?.owornmask ?? 0) & W_WEP));
}

export function unwieldMonsterWeapon(monster) {
    const weapon = monsterWieldedWeapon(monster);
    if (!weapon) return null;

    monster.mw = null;
    weapon.owornmask = (weapon.owornmask ?? 0) & ~W_WEP;
    weapon.wielded = false;
    weapon.worn = weapon.owornmask !== 0;
    monster.weaponCheck = NEED_WEAPON;
    return weapon;
}

export async function updateMonsterWeaponAfterPolymorph(monster, state = game) {
    const weapon = monsterWieldedWeapon(monster);
    if (!weapon) return null;

    const inventory = monster.minvent || monster.inventory || [];
    if (!inventory.includes(weapon)) {
        monster.mw = null;
        monster.weaponCheck = NEED_WEAPON;
        return null;
    }

    if (!MONSTER_HAS_WEAPON_ATTACK.has(monster.mnum)) {
        const dropped = await dropObjectFromMonsterInventory(monster, weapon, state);
        monster.weaponCheck = NO_WEAPON_WANTED;
        return stack_object(dropped, state);
    }

    const welded = weapon.cursed && ((weapon.owornmask ?? 0) & W_WEP);
    if (!(welded && monster.weaponCheck === NO_WEAPON_WANTED))
        monster.weaponCheck = NEED_WEAPON;
    return null;
}
