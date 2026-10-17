// C apply.c:use_grease(), grease_ok(); do_wear.c:inaccessible_equipment().
import { armorSimpleName } from './armor.js';
import { heroFingerName } from './body_parts.js';
import { GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_INACCESS, GETOBJ_SUGGEST } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { game } from './gstate.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { compactInventoryLetters, inventoryLetterOrder, promptInventoryObject } from './inventory_prompt.js';
import { consumeObjectCharge } from './object_charge.js';
import { CORPSE } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { definiteObjectAction, objectName, observeObjectForNaming, ownedObjectName } from './objnam.js';
import { propertyIsActive } from './properties.js';
import { rn1, rn2 } from './rng.js';
import { carriedObjectOwner } from './shk.js';
import { setSlipperyHands } from './towel.js';
export async function useGrease(can) {
    if (game.u.glib || (game.u.glibTurns ?? 0) > 0) {
        await dropGrease(can);
        return true;
    }
    if (can.spe <= 0) {
        await pline(`${definiteObjectAction(can, can.known ? 'are' : 'seem')} ${can.known ? '' : 'to be '}empty.`);
        return true;
    }
    if ((can.cursed || propertyIsActive('fumbling', game)) && !rn2(2)) {
        await consumeObjectCharge(can);
        await dropGrease(can);
        return true;
    }
    const inventory = [...game.inventory].sort((a, b) => inventoryLetterOrder(a.invlet) - inventoryLetterOrder(b.invlet));
    const suggested = inventory.filter(object => greaseSuggestion(object) === GETOBJ_SUGGEST);
    const letters = compactInventoryLetters(suggested.map(object => object.invlet).join(''));
    const selection = await promptInventoryObject(`What do you want to grease? [- ${letters} or ?*] `, inventory, {
        verb: 'grease', classify: greaseSuggestion, allowNone: true,
        noneDescription: `your ${fingers(false)}`, allowMenu: true, allowGold: true, menuItems: suggested,
    });
    if (selection.cancelled)
        return false;
    if (selection.gold || selection.object?.oclass === 12) {
        await pline('You cannot grease gold.');
        return false;
    }
    const target = selection.object;
    if (target) {
        const covering = coveringEquipment(target);
        const outermost = covering[0];
        if (outermost) {
            for (const object of covering)
                observeObjectForNaming(object);
            observeObjectForNaming(target);
            const names = covering.map((object, index) => index && carriedObjectOwner(object, game) === carriedObjectOwner(outermost, game)
                ? objectName(object, game) : ownedObjectName(object, game, { capitalized: false }));
            await pline(`You need to take off ${names.join(' and ')} to grease ${ownedObjectName(target, game, { capitalized: false })}.`);
            return false;
        }
    }
    await consumeObjectCharge(can);
    const old = game.u.glibTurns ?? 0;
    if (target) {
        if (target.otyp !== CORPSE)
            observeObjectForNaming(target);
        await pline(`You cover ${ownedObjectName(target, game, { capitalized: false })} with a thick layer of grease.`);
        target.greased = true;
        if (can.cursed) {
            setSlipperyHands(old + rn1(6, 10));
            await pline(`Some of the grease gets all over your ${fingers(true)}.`);
        }
    }
    else {
        setSlipperyHands(old + rn1(11, 5));
        await pline(`You coat your ${fingers(true)} with grease.`);
    }
    return true;
}
function greaseSuggestion(object) {
    if (object.oclass === 12)
        return GETOBJ_EXCLUDE;
    return coveringEquipment(object).length ? GETOBJ_EXCLUDE_INACCESS : GETOBJ_SUGGEST;
}
function coveringEquipment(object) {
    if (!object.owornmask)
        return [];
    const cloak = game.uarmc, suit = game.uarm, gloves = game.uarmg;
    if (object === suit && cloak)
        return [cloak];
    if (object === game.uarmu)
        return [cloak, suit].filter(item => item !== null && item !== undefined);
    if ((object === game.uleft || object === game.uright) && gloves)
        return [gloves];
    return [];
}
function fingers(simple) {
    const gloves = game.uarmg;
    return simple && gloves ? armorSimpleName(gloves, game) : makePlural(heroFingerName(game));
}
async function dropGrease(can) {
    await pline(`${definiteObjectAction(can, 'slip')} from your ${fingers(false)}.`);
    await dropInventoryObjectAtHero(can);
}
//# sourceMappingURL=grease_apply.js.map