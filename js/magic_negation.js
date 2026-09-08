// Protection against special attacks. C mhitu.c:magic_negation()
// and uhitm.c:mhitm_mgc_atk_negated().

import { artifactById } from './artifacts.js';
import { W_ACCESSORY, W_AMUL, W_ARMOR, W_WEP } from './const.js';
import { game } from './gstate.js';
import { MONSTER_FLAGS2, MONSTER_NAME } from './monster_data.js';
import {
    AMULET_OF_GUARDING, OBJECT_PROPERTY, OBJECT_SPELL_LEVEL, OBJECT_SUBTYPE,
} from './object_data.js';
import { hasInvokedProperty } from './properties.js';
import { rn2 } from './rng.js';

const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const M2_MINION = 0x00001000;
const PM_HIGH_CLERIC = MONSTER_NAME.indexOf('high cleric');
const PM_ALIGNED_CLERIC = MONSTER_NAME.indexOf('aligned cleric');

export function magicNegation(defender, state = game) {
    const hero = defender === state.u;
    const species = hero ? defender.umonnum : defender.mnum;
    const inventory = hero ? state.inventory : defender.minvent;
    let cancellation = 0;
    let guardingAmulet = false;
    let protection = hero ? hasInvokedProperty('protection', state)
        : species === PM_HIGH_CLERIC;

    for (const object of inventory || []) {
        if (object.owornmask & W_ARMOR) {
            cancellation = Math.max(cancellation, OBJECT_SPELL_LEVEL[object.otyp]);
        } else if (object.owornmask & W_AMUL) {
            guardingAmulet = object.otyp === AMULET_OF_GUARDING;
        }
        if (!protection) {
            const weapon = object.oclass === WEAPON_CLASS
                || (object.oclass === TOOL_CLASS && OBJECT_SUBTYPE[object.otyp] !== 0);
            const worn = !!(object.owornmask
                & (W_ARMOR | W_ACCESSORY | (weapon ? W_WEP : 0)));
            const artifact = artifactById(object.oartifact, state);
            protection = (worn && OBJECT_PROPERTY[object.otyp] === 'protection')
                || !!artifact?.carriedFlags.includes('SPFX_PROTECT')
                || (worn && !!artifact?.flags.includes('SPFX_PROTECT'));
        }
    }
    if (protection) return Math.min(3, cancellation + (guardingAmulet ? 2 : 1));
    const innateProtection = species === PM_ALIGNED_CLERIC
        || !!(MONSTER_FLAGS2[species] & M2_MINION)
        || (hero && ((defender.intrinsicProtection && defender.ublessed > 0)
            || defender.uspellprot > 0));
    return innateProtection ? Math.max(1, cancellation) : cancellation;
}

export function specialAttackNegated(attacker, defender, {
    state = game, random = rn2,
} = {}) {
    if (attacker !== state.u && attacker.mcan) return true;
    return random(10) < 3 * magicNegation(defender, state);
}
