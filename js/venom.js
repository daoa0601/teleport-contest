// Damage and blindness rules shared by venom projectiles.
// C refs: weapon.c dmgval() and mondata.c can_blnd().

import { W_ARMH } from './const.js';
import { game } from './gstate.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { OBJECT_DESCRIPTIONS } from './object_data.js';
import { heroMonsterForm } from './polyself.js';

const M1_NOEYES = 0x00001000;

export function acidVenomDamage(rollOne) {
    return rollOne(6) + rollOne(6);
}

function wearsVisoredHelmet(objects, state) {
    return objects.some(object =>
        ((object?.owornmask ?? 0) & W_ARMH)
        && (state.objectDescriptions?.[object.otyp]
            ?? OBJECT_DESCRIPTIONS[object.otyp]) === 'visored helmet');
}

export function monsterCanBeBlindedByVenom(
    monster, { heroInsideTarget = false, state = game } = {},
) {
    if ((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_NOEYES) return false;
    if (!monster?.mcansee && (monster?.mblinded ?? 0) === 0) return false;
    if (heroInsideTarget) return false;
    return !wearsVisoredHelmet(
        monster?.minvent || monster?.inventory || [],
        state,
    );
}

export function heroCanBeBlindedByVenom(state = game) {
    const hero = state.u || {};
    const form = heroMonsterForm(state);
    const noEyes = hero.noEyes || hero.eyeless
        || (form !== null
            && !!((MONSTER_FLAGS1[form] ?? 0) & M1_NOEYES));
    if (noEyes || state.ublindf || hero.ublindf || hero.ucreamed)
        return false;

    const helmet = state.uarmh || hero.uarmh;
    const wornObjects = helmet
        ? [helmet, ...(state.inventory || [])]
        : state.inventory || [];
    return !wearsVisoredHelmet(wornObjects, state);
}
