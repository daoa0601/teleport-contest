// Looking at floor objects and displaying their prices and pile windows.
// C invent.c:look_here(), pickup.c:check_here(), and objnam.c.

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { flush_screen, pline, plineWithContinuation } from './display.js';
import { bucAdjectiveForName, observeBucForNaming } from './invent.js';
import {
    GOLD_PIECE, CORPSE, BOULDER, DART, LARGE_BOX, CHEST, ICE_BOX, SACK, OIL_LAMP,
    STATUE, OBJECT_DESCRIPTIONS, OBJECT_NAMES, OBJECT_WEIGHT,
} from './object_data.js';
import { NO_COLOR } from './terminal.js';
import { MONSTER_NAME } from './monster_data.js';
import { recordObjectEncounter } from './object_knowledge.js';
import { getCostOfShopItem, objectTypeKnown } from './shk.js';
import { W_BALL, W_CHAIN } from './const.js';
import { indefiniteArticle, makePlural } from './object_grammar.js';
import { objectQuantity } from './object_stack.js';

const BALL_CLASS = 15;
const CHAIN_CLASS = 16;

export async function showFloorPile(
    objects, pickedSome = false, featureDescription = '',
) {
    if (objects.length < 2) return;
    // invent.c:look_here() receives the already-counted pile from
    // pickup.c:check_here(). At the configurable threshold (default five)
    // it leaves the command non-modal and emits only a topline count so
    // destination traps and engravings can continue in the same action.
    const configuredLimit = Number(game.flags?.pile_limit ?? 5);
    const pileLimit = Number.isFinite(configuredLimit) && configuredLimit >= 0
        ? Math.trunc(configuredLimit) : 5;
    if (pileLimit > 0 && objects.length >= pileLimit) {
        if (featureDescription)
            await plineWithContinuation(featureDescription);
        const quantity = objects.length === 2 ? 'two'
            : objects.length < 5 ? 'a few'
                : objects.length < 10 ? 'several' : 'many';
        await plineWithContinuation(
            `There are ${quantity}${pickedSome ? ' more' : ''} objects here.`,
        );
        return;
    }
    if (game._pending_message) {
        const more = `${game._pending_message}--More--`;
        await pline(more);
        await flush_screen(1);
        game.nhDisplay?.setCursor(Math.min(79, more.length), 0);
        let key;
        do key = await nhgetch();
        while (key !== 27 && key !== 32 && key !== 10 && key !== 13);
    }
    game._pending_message = '';
    await flush_screen(1);
    const display = game.nhDisplay;
    const pileLocation = game.blind ? 'you feel here' : 'are here';
    const lines = [
        ...(featureDescription ? [featureDescription, ''] : []),
        `${pickedSome ? 'Other things' : 'Things'} that ${pileLocation}:`,
        ...objects.map(pricedFloorObjectDescription),
        '--More--',
    ];
    // Tty menus leave one blank column after the widest line and align the
    // window to the right.
    const left = Math.max(0, Math.min(41,
        display.cols - Math.max(...lines.map(line => line.length)) - 1));
    for (let row = 0; row < lines.length; row++) {
        for (let col = Math.max(0, left - 1); col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
        for (let col = 0; col < lines[row].length; col++)
            display.setCell(left + col, row, lines[row][col], NO_COLOR, 0);
    }
    display.setCursor(left + 8, lines.length - 1);
    // tty's temporary PICK_NONE pile window ignores ordinary command bytes;
    // only a menu-dismissal key destroys it and returns that input boundary
    // to the command loop.
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
}

export function pricedFloorObjectDescription(object) {
    const description = floorObjectDescription(object);
    const { price, noCharge } = getCostOfShopItem(object);
    if (price > 0) {
        return `${description} (for sale, ${price} zorkmid${price === 1 ? '' : 's'})`;
    }
    return noCharge > 0 ? `${description} (no charge)` : description;
}

export function floorObjectDescription(object) {
    // C objnam.c:doname()/xname() use the startup-shuffled description until
    // the object's type has been identified. Looking at an object underfoot
    // makes its description known but does not identify its type.
    const appearance = game.objectDescriptions?.[object.otyp]
        ?? OBJECT_DESCRIPTIONS[object.otyp];
    // oc_name_known is global per object type.  A newly generated object
    // inherits knowledge from an identified starting copy or a pre-known
    // discovery; it is not an instance-local `known` bit.
    const typeKnown = objectTypeKnown(object);
    object.dknown = true;
    recordObjectEncounter(object.otyp);
    observeBucForNaming(object);
    if (object === game.uball || object === game.u?.uball
        || object.oclass === BALL_CLASS) {
        const baseWeight = OBJECT_WEIGHT[object.otyp] ?? 480;
        const noun = `${(object.owt ?? baseWeight) > baseWeight ? 'very ' : ''}`
            + 'heavy iron ball';
        const attachment = (object.owornmask & W_BALL)
            ? ' (chained to you)' : '';
        return `${indefiniteArticle(noun)} ${noun}${attachment}`;
    }
    if (object === game.uchain || object === game.u?.uchain
        || object.oclass === CHAIN_CLASS) {
        const attachment = (object.owornmask & W_CHAIN)
            ? ' (attached to you)' : '';
        return `an iron chain${attachment}`;
    }
    if (object.otyp === CORPSE) {
        const species = MONSTER_NAME[object.corpsenm];
        const corpseName = object.name || (species ? `${species} corpse` : 'corpse');
        const name = `${object.oeaten ? 'partly eaten ' : ''}${corpseName}`;
        const quantity = objectQuantity(object);
        return quantity > 1 ? `${quantity} ${makePlural(name)}` : `${indefiniteArticle(name)} ${name}`;
    }
    if (object.otyp === LARGE_BOX || object.otyp === CHEST) {
        const noun = object.otyp === LARGE_BOX ? 'large box' : 'chest';
        const lockState = object.lknown
            ? (object.obroken ? 'broken ' : object.olocked ? 'locked ' : 'unlocked ')
            : '';
        const description = `${lockState}${noun}`;
        return `${indefiniteArticle(description)} ${description}`;
    }
    if (object.otyp === ICE_BOX) return 'an ice box';
    if (object.otyp === SACK) return 'a bag';
    if (object.otyp === OIL_LAMP) return 'a lamp';
    if (object.otyp === STATUE) {
        const monsterName = MONSTER_NAME[object.corpsenm] || 'monster';
        return `a statue of ${indefiniteArticle(monsterName)} ${monsterName}`;
    }
    if (object.otyp === BOULDER) return 'a boulder';
    if (object.oclass === 4 || object.class === 'Rings') {
        const noun = typeKnown && object.name
            ? object.name : `${appearance || 'unknown'} ring`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.oclass === 5 || object.class === 'Amulets') {
        const noun = typeKnown && object.name
            ? object.name : `${appearance || 'unknown'} amulet`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.oclass === 11) {
        const noun = typeKnown
            ? `wand of ${OBJECT_NAMES[object.otyp] || 'unknown'}`
            : `${appearance || 'unknown'} wand`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.otyp === DART) {
        const quantity = objectQuantity(object);
        if (quantity > 1) return `${quantity} darts`;
        return object.opoisoned ? 'a poisoned dart' : 'a dart';
    }
    if (object.oclass === 2) {
        // objnam.c:xname_flags(), WEAPON_CLASS.  Observing this particular
        // copy sets dknown, but the canonical noun is still gated by the
        // type-wide oc_name_known bit.  Appearance-sharing weapons such as
        // an orcish dagger therefore remain "crude dagger" until identified.
        const noun = typeKnown
            ? (OBJECT_NAMES[object.otyp] || 'weapon')
            : (appearance || OBJECT_NAMES[object.otyp] || 'weapon');
        const quantity = objectQuantity(object);
        const enchantment = object.known && Number.isInteger(object.spe)
            ? `${object.spe >= 0 ? '+' : ''}${object.spe} ` : '';
        const described = `${enchantment}${noun}`;
        if (quantity > 1)
            return `${quantity} ${enchantment}${object.plural || `${noun}s`}`;
        return `${indefiniteArticle(described)} ${described}`;
    }
    if (object.oclass === 3) {
        // Armor without a shuffled description is known by its ordinary
        // object noun even when this individual instance has no presentation
        // fields yet.  Shuffled armor retains the appearance until its type
        // is globally discovered.
        const noun = typeKnown || !appearance
            ? (OBJECT_NAMES[object.otyp] || object.name || 'armor')
            : appearance;
        if (/gloves|boots|shoes/.test(noun)) return `a pair of ${noun}`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.otyp === GOLD_PIECE) {
        const quantity = objectQuantity(object);
        return `${quantity} gold piece${quantity === 1 ? '' : 's'}`;
    }
    if (object.oclass === 8) {
        const noun = typeKnown
            ? `potion of ${OBJECT_NAMES[object.otyp] || 'unknown'}`
            : `${appearance || 'unknown'} potion`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.oclass === 9) {
        const noun = typeKnown
            ? `scroll of ${OBJECT_NAMES[object.otyp] || 'unknown'}`
            : appearance === 'unlabeled' ? 'unlabeled scroll'
                : `scroll labeled ${appearance || 'unknown'}`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.oclass === 10) {
        const noun = typeKnown
            ? `spellbook of ${OBJECT_NAMES[object.otyp] || 'unknown'}`
            : `${appearance || 'unknown'} spellbook`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.oclass === 6 || object.class === 'Tools') {
        const noun = typeKnown
            ? (OBJECT_NAMES[object.otyp] || object.name || 'tool')
            : (appearance || object.name || 'tool');
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.oclass === 7) {
        // Instance data on a generated tin may record its hidden contents
        // (for example "tin of lichen") before doname() may disclose them.
        const noun = OBJECT_NAMES[object.otyp] || object.name || 'food';
        const quantity = objectQuantity(object);
        const buc = bucAdjectiveForName(object);
        const described = [buc, noun].filter(Boolean).join(' ');
        return quantity > 1
            ? `${quantity} ${buc ? `${buc} ` : ''}${
                object.plural || `${noun}s`
            }`
            : `${indefiniteArticle(described)} ${described}`;
    }
    if (object.oclass === 13 || (object.otyp >= 438 && object.otyp <= 474)) {
        const noun = typeKnown && object.name
            ? object.name : `${appearance || 'unknown'} gem`;
        const quantity = objectQuantity(object);
        return quantity > 1 ? `${quantity} ${noun}s`
            : `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.name) return `${indefiniteArticle(object.name)} ${object.name}`;
    return 'an object';
}
