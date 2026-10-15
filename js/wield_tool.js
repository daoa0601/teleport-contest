// Wielding a tool so another command can use it.
// C ref: wield.c wield_tool().
import { W_ACCESSORY, W_ARMOR } from './const.js';
import { heroHandName } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { objectCombatName, ownedObjectName } from './objnam.js';
import { pline, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { inventoryItemDescription } from './invent.js';
import { OBJECT_BIMANUAL } from './object_data.js';
import { willWeld } from './weapon_type.js';
import { readyHeroWeapon } from './weapon_readiness.js';
import { stopTwoWeaponCombat } from './two_weapon.js';
import { heroHasNoHands, heroIsVerySmall, } from './polyself.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon, } from './weapon_slots.js';
function quantityOf(object) {
    return object.quan ?? object.quantity ?? 1;
}
function isWeapon(object) {
    return object.oclass === 2;
}
function isTwoHanded(object) {
    return !!OBJECT_BIMANUAL[object.otyp];
}
function weldedPrimary(state) {
    const primary = state.uwep || state.u?.uwep || null;
    return willWeld(primary) ? primary : null;
}
async function explainWeldedPrimary(primary, verb, name, plural, state) {
    primary.bknown = true;
    if (state.flags?.verbose === false) {
        await pline("You can't do that.");
        return;
    }
    const noun = heroHandName(state);
    const hand = isTwoHanded(primary) ? makePlural(noun) : noun;
    const demonstrative = plural && !name.includes('pair of ') ? 'those' : 'that';
    await pline(`Since your weapon is welded to your ${hand}, `
        + `you cannot ${verb} ${demonstrative} ${name}.`);
}
export async function wieldTool(object, verb = 'wield', { swapWeapons } = {}, state = game) {
    const current = state.uwep || state.u?.uwep || null;
    if (object === current)
        return { ready: true, newlyWielded: false };
    const name = objectCombatName(object, { state, includeCorpseSpecies: false });
    const plural = quantityOf(object) > 1 || name.includes('pair of ') || name.includes('s of ');
    if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY)) {
        await pline(`You can't ${verb} ${ownedObjectName(object, state, { capitalized: false })} while wearing ${plural ? 'them' : 'it'}.`);
        return { ready: false, newlyWielded: false };
    }
    const welded = weldedPrimary(state);
    if (welded) {
        await explainWeldedPrimary(welded, verb, name, plural, state);
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
        if (willWeld(object)) {
            await readyHeroWeapon(object, state);
        }
        else {
            await plineWithContinuation(`You now wield ${inventoryItemDescription(object)}.`);
            await setPrimaryWeapon(object, state);
        }
        if (state.flags?.pushweapon && current && state.uwep !== current)
            await setSecondaryWeapon(current, state);
    }
    const weapon = state.uwep || state.u.uwep;
    if (weapon && weapon !== object)
        return { ready: false, newlyWielded: false };
    await stopTwoWeaponCombat(state);
    if (!isWeapon(object))
        state._unweapon = true;
    return { ready: true, newlyWielded: true };
}
//# sourceMappingURL=wield_tool.js.map