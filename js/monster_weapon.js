// Monster wielded-weapon state.
// C refs: weapon.c setmnotwielded(), mwepgone(), and possibly_unwield().

import { NEED_WEAPON, NO_WEAPON_WANTED, W_WEP } from './const.js';
import { artifactById, artifactEmitsLight } from './artifacts.js';
import { monsterHandName } from './body_parts.js';
import { canSeeMonster, newsym, plineWithContinuation } from './display.js';
import { applyFloorEffects } from './floor_effects.js';
import { place_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { inventoryItemDescription } from './invent.js';
import { endObjectBurn } from './light.js';
import { MONSTER_HAS_WEAPON_ATTACK } from './monster_data.js';
import { removeObjectFromMonsterInventory } from './monster_inventory.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { OBJECT_NAMES } from './object_data.js';
import { cansee } from './vision.js';

export function monsterWieldedWeapon(monster) {
    return monster?.mw
        || (monster?.minvent || monster?.inventory || [])
            .find(object => object?.wielded
                || ((object?.owornmask ?? 0) & W_WEP));
}

export async function unwieldMonsterWeapon(monster, state = game, {
    weapon = monsterWieldedWeapon(monster),
    publish = plineWithContinuation,
} = {}) {
    if (!weapon) return null;

    if (weapon.lamplit && artifactEmitsLight(weapon)) {
        endObjectBurn(weapon, state);
        if (canSeeMonster(monster, monster.mx, monster.my)) {
            const name = artifactById(weapon.oartifact, state)?.name
                || `The ${OBJECT_NAMES[weapon.otyp]}`;
            const subject = monsterSentenceSubject(monster);
            const owner = monster.name ? subject
                : subject.charAt(0).toLowerCase() + subject.slice(1);
            const possessive = owner.endsWith('s') ? `${owner}'` : `${owner}'s`;
            const hand = monsterHandName(monster.mnum);
            await publish(`${name} in ${possessive} ${hand} stops shining.`);
        }
    }
    if (monster.mw === weapon) monster.mw = null;
    weapon.owornmask = (weapon.owornmask ?? 0) & ~W_WEP;
    weapon.wielded = false;
    weapon.worn = weapon.owornmask !== 0;
    monster.weaponCheck = NEED_WEAPON;
    return weapon;
}

export async function updateMonsterWeaponAfterPolymorph(monster, state = game, {
    polyspot = false,
    publish = plineWithContinuation,
} = {}) {
    const weapon = monsterWieldedWeapon(monster);
    if (!weapon) return null;

    const inventory = monster.minvent || monster.inventory || [];
    if (!inventory.includes(weapon)) {
        monster.mw = null;
        monster.weaponCheck = NEED_WEAPON;
        return null;
    }

    if (!MONSTER_HAS_WEAPON_ATTACK.has(monster.mnum)) {
        await unwieldMonsterWeapon(monster, state, { weapon, publish });
        monster.weaponCheck = NO_WEAPON_WANTED;
        if (cansee(monster.mx, monster.my)) {
            const description = inventoryItemDescription(weapon);
            await publish(`${monsterSentenceSubject(monster)} drops ${description}.`);
            newsym(monster.mx, monster.my);
        }
        await removeObjectFromMonsterInventory(monster, weapon, state, { publish });
        const landing = await applyFloorEffects(
            weapon, monster.mx, monster.my, { state, publish },
        );
        if (landing.finished) return landing.object;
        if (polyspot) {
            weapon.bypass = true;
            state.context.bypasses = true;
        }
        place_object(weapon, monster.mx, monster.my, state);
        return stack_object(weapon, state);
    }

    const welded = weapon.cursed && ((weapon.owornmask ?? 0) & W_WEP);
    if (!(welded && monster.weaponCheck === NO_WEAPON_WANTED))
        monster.weaponCheck = NEED_WEAPON;
    return null;
}
