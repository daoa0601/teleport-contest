// Damage and blindness rules shared by venom projectiles.
// C refs: weapon.c dmgval() and mondata.c can_blnd().

import { W_ARMH } from './const.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { OBJECT_DESCRIPTIONS } from './object_data.js';

const M1_NOEYES = 0x00001000;

export function acidVenomDamage(rollOne) {
    return rollOne(6) + rollOne(6);
}

export function monsterCanBeBlindedByVenom(
    monster, { heroInsideTarget = false } = {},
) {
    if ((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_NOEYES) return false;
    if (!monster?.mcansee && (monster?.mblinded ?? 0) === 0) return false;
    if (heroInsideTarget) return false;
    return !(monster?.minvent || monster?.inventory || []).some(object =>
        ((object.owornmask ?? 0) & W_ARMH)
        && OBJECT_DESCRIPTIONS[object.otyp] === 'visored helmet');
}
