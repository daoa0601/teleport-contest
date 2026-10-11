// C u_init.c:ini_inv_use_obj(), after starting-item discovery.

import { armorSlotFor, wearHeroArmor } from './armor.js';
import type { GameState } from './game_state.js';
import {
    FLINT, OBJECT_BIMANUAL, ROCK, SPE_BLANK_PAPER, TIN_OPENER,
} from './object_data.js';
import {
    isLauncherAmmunition, isMissileObject, isWeaponTool,
} from './object_properties.js';
import type { GameObject } from './object_types.js';
import { learnInitialSpell } from './spell.js';
import {
    setPrimaryWeapon, setQuiverObject, setSecondaryWeapon, setTwoWeaponCombat,
} from './weapon_slots.js';

const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const SPBOOK_CLASS = 10;

export async function useStartingItem(item: GameObject, state: GameState): Promise<void> {
    const weapon = state.uwep || state.u.uwep;
    const shield = state.uarms || state.u.uarms;

    if (item.oclass === ARMOR_CLASS) {
        const slot = armorSlotFor(item.otyp);
        if (slot && !state[slot] && !state.u[slot]
            && !(slot === 'uarms' && weapon && OBJECT_BIMANUAL[weapon.otyp])) {
            if (slot === 'uarms') setTwoWeaponCombat(false, state);
            wearHeroArmor(item, state);
        }
    }

    if (item.oclass === WEAPON_CLASS || isWeaponTool(item)
        || item.otyp === TIN_OPENER || item.otyp === FLINT || item.otyp === ROCK) {
        if (isLauncherAmmunition(item) || isMissileObject(item)) {
            if (!state.uquiver && !state.u.uquiver)
                await setQuiverObject(item, state);
        } else if (!weapon && (!shield || !OBJECT_BIMANUAL[item.otyp])) {
            await setPrimaryWeapon(item, state);
        } else if (!state.uswapwep && !state.u.uswapwep) {
            await setSecondaryWeapon(item, state);
        }
    }

    if (item.oclass === SPBOOK_CLASS && item.otyp !== SPE_BLANK_PAPER)
        await learnInitialSpell(item, state);
}
