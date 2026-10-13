// C potion.c:dodip(), dip_into(), potion_dip().
import type { GameObject } from './object_types.js';
import type { MapLocation } from './map_types.js';
import type { DipTarget } from './dip_water.js';
import { washHands } from './dip_water.js';
import type { InventoryClassification } from './inventory_prompt.js';
import { FOUNTAIN, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_INACCESS, GETOBJ_SUGGEST, SINK } from './const.js';
import { heroHandName } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { plineWithContinuation as pline } from './display.js';
import { heroCanReachFloor } from './floor_reach.js';
import { game, requirePlayingGame } from './gstate.js';
import { chooseInventoryObject, compactInventoryLetters, inventoryLetterOrder, promptInventoryObject } from './inventory_prompt.js';
import { inventoryItemDescription } from './invent.js';
import { objectQuantity } from './object_stack.js';
import { objectName, observeObjectForNaming, ownedObjectName, simpleObjectName } from './objnam.js';
import { promptYesNo } from './query.js';
import { dipSink } from './sink_dipping.js';
import { isPoolAt } from './terrain_properties.js';
import { waterbodyName } from './terrain_name.js';
import { waterDamageObject } from './trap.js';
import { consumeInventoryItem } from './invent.js';
import { POT_ACID } from './object_data.js';
import { treatDippedObject } from './potion_item_dip.js';

export async function dip({
    fountain,
}: { fountain: (object: DipTarget, location: MapLocation) => Promise<void> }): Promise<void> {
    requirePlayingGame(game);
    const object = await chooseDipTarget('dip');
    if (!object) { game.context.move = 0; return; }
    if (object !== 'hands' && await reportCoveredEquipment(object)) { game.context.move = 0; return; }
    const location = game.level.requireAt(game.u.ux, game.u.uy);
    let declinedSource = false;
    const description = object === 'hands' ? `your ${makePlural(heroHandName())}` : dipTargetDescription(object);
    const target = game.flags.verbose ? description : object === 'hands' || objectQuantity(object) > 1 ? 'them' : 'it';
    if (!game.iflags.menu_requested && heroCanReachFloor(game) && location.typ === FOUNTAIN) {
        if (await promptYesNo(`Dip ${target} into the fountain?`, 'n') === 'y') {
            if (object !== 'hands') object.pickup_prev = false;
            await fountain(object, location);
            game.context.move = 1;
            return;
        }
        declinedSource = true;
    }
    if (!game.iflags.menu_requested && heroCanReachFloor(game)
        && (location.typ === SINK || isPoolAt(game.u.ux, game.u.uy))) {
        const source = location.typ === SINK ? 'sink' : waterbodyName(game.u.ux, game.u.uy);
        if (await promptYesNo(`Dip ${target} into the ${source}?`, 'n') === 'y') {
            if (object !== 'hands') object.pickup_prev = false;
            if (location.typ === SINK) await dipSink(object);
            else if (object === 'hands' || object === game.uarmg) await washHands();
            else {
                if (object.otyp === POT_ACID) object.in_use = true;
                const result = await waterDamageObject(object, [], game, { force: true, publish: pline });
                if (result !== 'destroyed' && object.in_use) await consumeInventoryItem(object);
            }
            game.context.move = 1;
            return;
        }
        declinedSource = true;
    }
    const potion = await chooseInventoryObject(`dip ${target} into`, potionClassification, {
        emptyMessage: `You don't have anything${declinedSource ? ' else' : ''} to dip into.`,
    });
    if (!potion) { game.context.move = 0; return; }
    game.context.move = Number(await finishDip(object, potion));
}

export async function dipInto(): Promise<void> {
    const potion = await chooseInventoryObject('dip', potionClassification);
    if (!potion) { game.context.move = 0; return; }
    const name = simpleObjectName(potion);
    const object = await chooseDipTarget(`dip into ${objectQuantity(potion) > 1 ? 'one of ' : ''}the ${name}`, false);
    if (!object || object !== 'hands' && await reportCoveredEquipment(object)) { game.context.move = 0; return; }
    game.context.move = Number(await finishDip(object, potion));
}

async function finishDip(object: DipTarget, potion: GameObject): Promise<boolean> {
    if (object !== 'hands') return treatDippedObject(object, potion);
    await pline(`You can't fit your ${heroHandName()} into the mouth of the bottle!`);
    return false;
}

async function chooseDipTarget(verb: string, floorWater = true): Promise<DipTarget | null> {
    requirePlayingGame(game);
    const location = game.level.requireAt(game.u.ux, game.u.uy);
    const handsSuggested = floorWater && !game.iflags.menu_requested && !!game.u.glibTurns
        && heroCanReachFloor(game) && (location.typ === FOUNTAIN || location.typ === SINK
            || isPoolAt(game.u.ux, game.u.uy));
    const inventory = [...game.inventory].sort((a, b) => inventoryLetterOrder(a.invlet) - inventoryLetterOrder(b.invlet));
    const suggested = inventory.filter(item => dipClassification(item) === GETOBJ_SUGGEST);
    const letters = compactInventoryLetters(suggested.map(item => item.invlet).join(''));
    const choices = `${handsSuggested ? '-' : ''}${letters}`;
    const selection = await promptInventoryObject(`What do you want to ${verb}? [${choices ? `${choices} or ?*` : '*'}] `,
        inventory, { verb, classify: dipClassification, allowNone: true, noneSuggested: handsSuggested,
            noneDescription: 'your hands', allowMenu: true, menuItems: suggested });
    if (selection.none) return 'hands';
    if (selection.object?.oclass === 12) { await pline('You cannot dip gold.'); return null; }
    return selection.object;
}

function dipClassification(object: GameObject): InventoryClassification {
    if (object.oclass === 12) return GETOBJ_EXCLUDE;
    return coveringEquipment(object).length ? GETOBJ_EXCLUDE_INACCESS : GETOBJ_SUGGEST;
}

function potionClassification(object: GameObject): InventoryClassification {
    return object.oclass === 8 ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE;
}

// C do_wear.c:inaccessible_equipment(..., FALSE).
function coveringEquipment(object: GameObject): GameObject[] {
    if (!object.owornmask) return [];
    const { uarm, uarmc, uarmu, uarmg, uleft, uright } = game;
    if (object === uarm) return uarmc ? [uarmc] : [];
    if (object === uarmu) return [uarmc, uarm].filter(item => item != null);
    if (object === uleft || object === uright) return uarmg ? [uarmg] : [];
    return [];
}

async function reportCoveredEquipment(object: GameObject): Promise<boolean> {
    const covering = coveringEquipment(object);
    if (!covering.length) return false;
    const name = covering.map((item, index) => {
        const owned = ownedObjectName(item, game, { capitalized: false });
        return index && owned.startsWith('your ') ? objectName(item) : owned;
    }).join(' and ');
    await pline(`You need to take off ${name} to dip ${ownedObjectName(object, game, { capitalized: false })}.`);
    return true;
}

function dipTargetDescription(object: GameObject): string {
    observeObjectForNaming(object);
    const full = inventoryItemDescription(object);
    if (full.length <= 49) return full;
    const shortened = { ...object, bknown: false, rknown: false,
        greased: false, oeroded: 0, oeroded2: 0 };
    delete shortened.buc;
    const name = inventoryItemDescription(shortened);
    return name.length <= 49 ? name : `the ${simpleObjectName(object)}`;
}
