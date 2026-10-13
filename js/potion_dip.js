import { FOUNTAIN, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_INACCESS, GETOBJ_SUGGEST } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { heroCanReachFloor } from './floor_reach.js';
import { game, requirePlayingGame } from './gstate.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { inventoryItemDescription } from './invent.js';
import { objectQuantity } from './object_stack.js';
import { objectName, observeObjectForNaming, ownedObjectName, simpleObjectName } from './objnam.js';
import { promptYesNo } from './query.js';
import { treatDippedObject } from './potion_item_dip.js';
export async function dip({ fountain, }) {
    requirePlayingGame(game);
    const object = await chooseInventoryObject('dip', dipClassification, { forcePrompt: true });
    if (!object) {
        game.context.move = 0;
        return;
    }
    if (await reportCoveredEquipment(object)) {
        game.context.move = 0;
        return;
    }
    const location = game.level.requireAt(game.u.ux, game.u.uy);
    let declinedSource = false;
    const description = dipTargetDescription(object);
    const target = game.flags.verbose ? description : objectQuantity(object) > 1 ? 'them' : 'it';
    if (!game.iflags.menu_requested && heroCanReachFloor(game) && location.typ === FOUNTAIN) {
        if (await promptYesNo(`Dip ${target} into the fountain?`, 'n') === 'y') {
            object.pickup_prev = false;
            await fountain(object, location);
            game.context.move = 1;
            return;
        }
        declinedSource = true;
    }
    const potion = await chooseInventoryObject(`dip ${target} into`, potionClassification, {
        emptyMessage: `You don't have anything${declinedSource ? ' else' : ''} to dip into.`,
    });
    if (!potion) {
        game.context.move = 0;
        return;
    }
    game.context.move = Number(await treatDippedObject(object, potion));
}
export async function dipInto() {
    const potion = await chooseInventoryObject('dip', potionClassification);
    if (!potion) {
        game.context.move = 0;
        return;
    }
    const name = simpleObjectName(potion);
    const object = await chooseInventoryObject(`dip into ${objectQuantity(potion) > 1 ? 'one of ' : ''}the ${name}`, dipClassification, { forcePrompt: true });
    if (!object || await reportCoveredEquipment(object)) {
        game.context.move = 0;
        return;
    }
    game.context.move = Number(await treatDippedObject(object, potion));
}
function dipClassification(object) {
    if (object.oclass === 12)
        return GETOBJ_EXCLUDE;
    return coveringEquipment(object).length ? GETOBJ_EXCLUDE_INACCESS : GETOBJ_SUGGEST;
}
function potionClassification(object) {
    return object.oclass === 8 ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE;
}
// C do_wear.c:inaccessible_equipment(..., FALSE).
function coveringEquipment(object) {
    if (!object.owornmask)
        return [];
    const { uarm, uarmc, uarmu, uarmg, uleft, uright } = game;
    if (object === uarm)
        return uarmc ? [uarmc] : [];
    if (object === uarmu)
        return [uarmc, uarm].filter(item => item != null);
    if (object === uleft || object === uright)
        return uarmg ? [uarmg] : [];
    return [];
}
async function reportCoveredEquipment(object) {
    const covering = coveringEquipment(object);
    if (!covering.length)
        return false;
    const name = covering.map((item, index) => {
        const owned = ownedObjectName(item, game, { capitalized: false });
        return index && owned.startsWith('your ') ? objectName(item) : owned;
    }).join(' and ');
    await pline(`You need to take off ${name} to dip ${ownedObjectName(object, game, { capitalized: false })}.`);
    return true;
}
function dipTargetDescription(object) {
    observeObjectForNaming(object);
    const full = inventoryItemDescription(object);
    if (full.length <= 49)
        return full;
    const shortened = { ...object, bknown: false, rknown: false,
        greased: false, oeroded: 0, oeroded2: 0 };
    delete shortened.buc;
    const name = inventoryItemDescription(shortened);
    return name.length <= 49 ? name : `the ${simpleObjectName(object)}`;
}
//# sourceMappingURL=potion_dip.js.map