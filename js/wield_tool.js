// Wielding a tool so another command can use it.
// C ref: wield.c wield_tool().
import { W_ACCESSORY, W_ARMOR } from './const.js';
import { heroHandName } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { observeObjectForNaming } from './objnam.js';
import { pline, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { lightWieldedArtifact } from './light.js';
import { inventoryItemDescription } from './invent.js';
import { OBJECT_BIMANUAL } from './object_data.js';
import { willWeld } from './weapon_type.js';
import { announceWeaponWeld, explainTwoWeaponEnd } from './weapon_feedback.js';
import { stopTwoWeaponCombat } from './two_weapon.js';
import { heroHasNoHands, heroIsVerySmall, } from './polyself.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon, } from './weapon_slots.js';
function quantityOf(object) {
    return object.quan ?? object.quantity ?? 1;
}
function objectIsPlural(object) {
    const name = object.name || '';
    return quantityOf(object) > 1
        || name.includes('pair of ')
        || name.includes('s of ');
}
function simpleName(object) {
    const quantity = quantityOf(object);
    const name = quantity === 1
        ? object.name || 'object'
        : object.plural || `${object.name || 'object'}s`;
    const blessing = object.bknown
        ? object.blessed ? 'blessed '
            : object.cursed ? 'cursed ' : 'uncursed '
        : '';
    return quantity === 1
        ? `${blessing}${name}`
        : `${quantity} ${blessing}${name}`;
}
function isWeapon(object) {
    return object.class === 'Weapons' || object.oclass === 2;
}
function isTwoHanded(object) {
    return !!(object.bimanual || OBJECT_BIMANUAL[object.otyp]);
}
function weldedPrimary(state) {
    const primary = state.uwep || state.u?.uwep || null;
    return willWeld(primary) ? primary : null;
}
async function explainWeldedPrimary(primary, verb, object, state) {
    primary.bknown = true;
    if (state.flags?.verbose === false) {
        await pline("You can't do that.");
        return;
    }
    const noun = heroHandName(state);
    const hand = isTwoHanded(primary) ? makePlural(noun) : noun;
    const demonstrative = quantityOf(object) > 1 ? 'those' : 'that';
    await pline(`Since your weapon is welded to your ${hand}, `
        + `you cannot ${verb} ${demonstrative} ${object.name || 'object'}.`);
}
export async function wieldTool(object, verb = 'wield', { swapWeapons } = {}, state = game) {
    const current = state.uwep || state.u?.uwep || null;
    if (object === current)
        return { ready: true, newlyWielded: false };
    const plural = objectIsPlural(object);
    if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY)) {
        await pline(`You can't ${verb} your ${simpleName(object)} while wearing ${plural ? 'them' : 'it'}.`);
        return { ready: false, newlyWielded: false };
    }
    const welded = weldedPrimary(state);
    if (welded) {
        await explainWeldedPrimary(welded, verb, object, state);
        return { ready: false, newlyWielded: false };
    }
    if (heroHasNoHands(state) || heroIsVerySmall(state)) {
        await pline(`You can't hold ${plural ? 'them' : 'it'} strongly enough.`);
        return { ready: false, newlyWielded: false };
    }
    if ((state.uarms || state.u?.uarms) && isTwoHanded(object)) {
        await pline(`You cannot ${verb} a two-handed ${isWeapon(object) ? 'weapon' : 'tool'} while wearing a shield.`);
        return { ready: false, newlyWielded: false };
    }
    if (state.uquiver === object || state.u?.uquiver === object)
        await setQuiverObject(null, state);
    if (state.uswapwep === object || state.u?.uswapwep === object) {
        if (!swapWeapons)
            return { ready: false, newlyWielded: false };
        await swapWeapons();
        if ((state.uwep || state.u?.uwep) !== object)
            return { ready: false, newlyWielded: false };
    }
    else {
        observeObjectForNaming(object, { state });
        const wasTwoWeapon = state.u.twoweap;
        const welds = willWeld(object);
        if (welds) {
            await announceWeaponWeld(object, state);
        }
        else {
            await plineWithContinuation(`You now wield ${inventoryItemDescription(object)}.`);
        }
        await setPrimaryWeapon(object, state);
        if (welds)
            await explainTwoWeaponEnd(wasTwoWeapon, state);
        await lightWieldedArtifact(object, state);
        if (state.flags?.pushweapon && current && current !== object)
            await setSecondaryWeapon(current, state);
    }
    await stopTwoWeaponCombat(state);
    if (!isWeapon(object))
        state._unweapon = true;
    return { ready: true, newlyWielded: true };
}
//# sourceMappingURL=wield_tool.js.map