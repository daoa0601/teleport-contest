// invent.js — Inventory display and look-here commands.
// C ref: invent.c — ddoinv(), display_inventory(), dolook().

import { game } from './gstate.js';
import {
    bot, consumeHallucinatedMenuObjectGlyph, docrtRecalc, flush_screen, pline,
} from './display.js';
import { showChoiceWindow, showInventoryWindow } from './windows.js';
import { nhgetch } from './input.js';
import {
    DOOR, D_BROKEN, D_ISOPEN, D_NODOOR, SINK,
} from './const.js';
import { NO_COLOR } from './terminal.js';
import {
    AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, OBJECT_CHARGED,
    OBJECT_BIMANUAL, OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_NUTRITION,
} from './object_data.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { unseenObjectNoun } from './objnam.js';
import { armorPresentationName } from './object_grammar.js';

const CLASS_ORDER = [
    'Coins', 'Amulets', 'Weapons', 'Armor', 'Comestibles', 'Scrolls',
    'Spellbooks', 'Potions', 'Rings', 'Wands', 'Tools', 'Gems/Stones',
    'Boulders',
];

function indefiniteArticle(text) {
    return /^[aeiou]/i.test(text) ? 'an' : 'a';
}

function knownObjectName(item) {
    const name = OBJECT_NAMES[item.otyp];
    if (!name) return item.name;
    return item.oclass === 4 ? `ring of ${name}`
        : item.oclass === 5 ? name
        : item.oclass === 3 ? armorPresentationName(name)
        : item.oclass === 8 ? `potion of ${name}`
        : item.oclass === 9 ? `scroll of ${name}`
        // Fixed role spellbooks carry the contest build's authoritative
        // compound noun already; do not re-index them through a different
        // generated enum layout merely because their type is known.
        : item.oclass === 10 ? item._startingInventory
            ? item.name : `spellbook of ${name}`
        : item.oclass === 11 ? `wand of ${name}`
        : item.oclass === 13 ? name : item.name;
}

const TIN_PREPARATIONS = [
    'rotten', 'homemade', 'soup made from', 'french fried', 'pickled',
    'boiled', 'smoked', 'dried', 'deep fried', 'szechuan', 'broiled',
    'stir fried', 'sauteed', 'candied', 'pureed',
];

function vegetarianCorpseName(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    const name = MONSTER_NAME[mnum];
    return [2, 10, 22, 25, 32].includes(symbol)
        || (symbol === 31 && name !== 'stalker')
        || (symbol === 42 && name !== 'black pudding')
        || (symbol === 55
            && name !== 'flesh golem' && name !== 'leather golem');
}

// C eat.c:tin_details().  Generation retains both the corpse identity and
// the signed preparation index even while ordinary play is only allowed to
// call the object a "tin".
function identifiedTinName(item) {
    if (item.corpsenm == null || item.corpsenm < 0)
        return item.spe === 1 ? 'tin of spinach' : 'empty tin';
    const monster = MONSTER_NAME[item.corpsenm];
    if (!monster) return 'tin';
    const contents = vegetarianCorpseName(item.corpsenm)
        ? monster : `${monster} meat`;
    const revealPreparation = item.cknown || item.overrideIdentified;
    const variety = item.cursed ? 0
        : revealPreparation && item.spe < 0 ? -item.spe - 1 : null;
    if (variety === 0 || variety === 1)
        return `${TIN_PREPARATIONS[variety]} tin of ${contents}`;
    if (variety != null && TIN_PREPARATIONS[variety])
        return `tin of ${TIN_PREPARATIONS[variety]} ${contents}`;
    return `tin of ${contents}`;
}

function erosionPrefix(level, adjective) {
    if (!level) return '';
    const degree = level === 2 ? 'very '
        : level >= 3 ? 'thoroughly ' : '';
    return `${degree}${adjective}`;
}

function itemErosionWords(item) {
    const material = OBJECT_MATERIAL[item.otyp];
    const words = [];
    if (item.oeroded) {
        const adjective = material === 11 ? 'rusty'
            : material === 19 && item.oclass === 3 ? 'cracked' : 'burnt';
        words.push(erosionPrefix(item.oeroded, adjective));
    }
    if (item.oeroded2) {
        words.push(erosionPrefix(
            item.oeroded2, material === 13 ? 'corroded' : 'rotted',
        ));
    }
    return words;
}

export function observeBucForNaming(item) {
    // objnam.c:xname_flags() owns this observation for every naming context,
    // including floor piles and container contents, not just inventory menus.
    if (game.urole?.key !== 'priest') return;
    item.bknown = true;
    item.buc = item.blessed ? 'blessed'
        : item.cursed ? 'cursed' : undefined;
}

export function bucAdjectiveForName(item, holyWater = false) {
    if (holyWater) return null;
    const buc = item.bknown
        ? item.blessed ? 'blessed' : item.cursed ? 'cursed' : 'uncursed'
        : item.buc;
    if (buc !== 'uncursed') return buc;

    // objnam.c:xname_flags(): with implicit_uncursed, most unknown-charge
    // items retain "uncursed", as do armor and rings.  The entire exception
    // is disabled for Clerics because naming already guarantees their BUC
    // knowledge; the real and fake Amulets are also always implicit.
    const retainsUncursed = (!item.known || !OBJECT_CHARGED[item.otyp]
            || item.oclass === 3 || item.oclass === 4)
        && item.otyp !== FAKE_AMULET_OF_YENDOR
        && item.otyp !== AMULET_OF_YENDOR
        && game.urole?.key !== 'priest';
    const suppressImplicitUncursed = game.flags?.implicit_uncursed !== false
        && !retainsUncursed;
    return suppressImplicitUncursed ? null : buc;
}

export function inventoryItemDescription(item) {
    // objnam.c:xname_flags() observes beatitude whenever a Cleric names an
    // object.  Keep that knowledge transition at the shared inventory naming
    // boundary so prinv-style command feedback and inventory menus agree.
    // With the default implicit-uncursed policy, neutral Cleric items omit the
    // redundant adjective while blessed and cursed state remains visible.
    observeBucForNaming(item);
    const quantity = item.quantity ?? 1;
    const holyWater = item.otyp === 322 && item.blessed;
    const parts = [];
    if (item.empty) parts.push('empty');
    const buc = bucAdjectiveForName(item, holyWater);
    if (buc) parts.push(buc);
    const fullNutrition = OBJECT_NUTRITION[item.otyp] || 0;
    if (Number.isInteger(item.oeaten) && item.oeaten > 0
        && fullNutrition > 0 && item.oeaten < fullNutrition)
        parts.push('partly eaten');
    if (item.poisoned || item.opoisoned) parts.push('poisoned');
    parts.push(...itemErosionWords(item));
    if (item.rustproof) parts.push('rustproof');
    const visibleEnchantment = Number.isInteger(item.enchantment)
        ? item.enchantment
        : item.known && [2, 3].includes(item.oclass)
            && Number.isInteger(item.spe) ? item.spe : null;
    if (Number.isInteger(visibleEnchantment)) {
        parts.push(`${visibleEnchantment >= 0 ? '+' : ''}${visibleEnchantment}`);
    }

    const callName = game._objectCallNames?.[item.otyp];
    const typeKnown = item.typeKnown
        || game._knownObjectTypes?.has(item.otyp);
    const baseName = item.dknown === false ? unseenObjectNoun(item)
        : holyWater ? 'potion of holy water'
        : typeKnown && item.otyp === 296 ? identifiedTinName(item)
        : typeKnown ? knownObjectName(item)
        : callName ? `${item.name} called ${callName}`
        : item.name === 'object' && item.otyp === 314
            ? 'white potion' : item.name;
    let noun = quantity === 1 ? baseName
        : holyWater ? 'potions of holy water'
            : (item.plural || `${baseName}s`);
    let description = [...parts, noun].join(' ');
    if (quantity > 1) description = `${quantity} ${description}`;
    else if (item.otyp === AMULET_OF_YENDOR)
        description = `the ${description}`;
    else description = `${indefiniteArticle(description)} ${description}`;

    if (item.charges && item.known && item.chargesKnown !== false)
        description += ` (${item.charges.recharged || 0}:${item.charges.current})`;
    if (item.cknown && Array.isArray(item.contents) && item.contents.length) {
        const count = item.contents.length;
        description += ` containing ${count} item${count === 1 ? '' : 's'}`;
    }
    const individualName = item.oextra?.oname || item.oname;
    if (individualName) description += ` named ${individualName}`;
    if (game.u?.twoweap && item === game.uwep) description += ' (wielded in right hand)';
    else if (game.u?.twoweap && item === game.uswapwep) description += ' (wielded in left hand)';
    else if (item === game.uwep) {
        const weaponLike = item.class === 'Weapons' || item.oclass === 2;
        description += !weaponLike ? ' (wielded)'
            : OBJECT_BIMANUAL[item.otyp] ? ' (weapon in hands)'
            : ` (weapon in ${
                game.u?.rightHanded === false ? 'left' : 'right'
            } hand)`;
    }
    else if (item === game.uswapwep)
        description += quantity > 1
            ? ' (alternate weapons; not wielded)'
            : ' (alternate weapon; not wielded)';
    if (item.ready) description += game.urole?.key === 'rogue'
        ? ' (alternate weapons; not wielded)'
        : game.urole?.key === 'samurai'
        ? ' (in quiver)' : game.urole?.key === 'caveman'
            ? ' (in quiver pouch)' : ' (at the ready)';
    if (item === game.uright || item === game.u?.uright)
        description += ' (on right hand)';
    else if (item.worn) description += ' (being worn)';
    return description;
}

function inventorySections(items = game.inventory || [], includeGold = true) {
    const grouped = new Map();
    if (includeGold && (game._goldCount || 0) > 0) {
        grouped.set('Coins', [`$ - ${game._goldCount} gold pieces`]);
    }
    for (const item of items) {
        consumeHallucinatedMenuObjectGlyph(item);
        const fallbackClass = {
            2: 'Weapons', 3: 'Armor', 4: 'Rings', 6: 'Tools',
            7: 'Comestibles', 8: 'Potions', 9: 'Scrolls',
            10: 'Spellbooks', 11: 'Wands',
            13: 'Gems/Stones',
        }[item.oclass];
        const heading = item.class === 'Gems' ? 'Gems/Stones'
            : item.class || fallbackClass || 'Other';
        if (!grouped.has(heading)) grouped.set(heading, []);
        grouped.get(heading).push(
            `${item.invlet} - ${inventoryItemDescription(item)}`,
        );
    }
    const ordered = [];
    for (const heading of CLASS_ORDER) {
        if (grouped.has(heading)) ordered.push({ heading, items: grouped.get(heading) });
    }
    for (const [heading, items] of grouped) {
        if (!CLASS_ORDER.includes(heading)) ordered.push({ heading, items });
    }
    return ordered;
}

async function restoreInventoryMap() {
    game._pending_message = '';
    game.nhDisplay?.clearScreen();
    await docrtRecalc();
    await bot();
    await flush_screen(1);
}

async function showItemActionMenu(item) {
    const itemName = item.name || knownObjectName(item) || 'item';
    const entries = [
        `c - Name this specific ${itemName}`,
    ];
    if (!item.worn) entries.push('d - Drop this item');
    if ([2, 4, 11, 13].includes(item.oclass)
        || [239, 245].includes(item.otyp)) {
        entries.push('E - Write on the floor with this item');
    }
    entries.push('i - Adjust inventory by assigning new letter');
    if (item.oclass === 4) entries.push('P - Put this ring on');
    if (item.oclass === 10)
        entries.push('r - Study this spellbook');
    entries.push('t - Throw this item');
    entries.push(`w - Wield this item${item.oclass !== 2 ? ' in your hands' : ''}`);
    entries.push('/ - Look up information about this');
    const validKeys = [27, 32, 10, 13,
        ...entries.map(entry => entry.charCodeAt(0))];
    return showChoiceWindow({
        title: `Do what with the ${itemName}?`, entries, validKeys,
    });
}

export async function ddoinv() {
    game._pending_message = '';
    game.nhDisplay?.clearRow(0);
    const inventory = game.inventory || [];
    const selectableKeys = inventory.map(item => item.invlet).join('');
    const key = await showInventoryWindow(inventorySections(), {
        selectableKeys,
        // invent.c:display_inventory() uses a selecting menu for the modern
        // item-action path. Ordinary letters which are not inventory
        // selectors ring the tty bell and leave the window open; only a
        // valid item or a menu dismissal byte returns to command dispatch.
        loopUntilValid: true,
    });
    const selected = inventory.find(item =>
        item.invlet === String.fromCharCode(key));
    let action = null;
    if (selected) {
        await restoreInventoryMap();
        // C destroys the full-height inventory and redraws the map before
        // opening its nested item-action menu, but does not run bot() until
        // that nested window closes.  Keep both status rows blank for the
        // complete action-menu input loop.
        game.nhDisplay?.clearRow(22);
        game.nhDisplay?.clearRow(23);
        const actionKey = await showItemActionMenu(selected);
        action = {
            key: String.fromCharCode(actionKey), item: selected,
        };
    }
    await restoreInventoryMap();
    game.context.move = 0;
    return action;
}

// C end.c:really_done() discovers every carried type and marks all of the
// object's knowledge bits before disclose() calls display_inventory().
// Keep that state transition separate from the ordinary `i` command, whose
// descriptions are still constrained by what the hero learned in play.
export async function showIdentifiedInventory() {
    for (const item of game.inventory || []) {
        item.typeKnown = true;
        item.known = true;
        item.bknown = true;
        item.dknown = true;
        item.rknown = true;
        item.overrideIdentified = true;
        const redundantNeutral = item.oclass === 2 || item.oclass === 11
            || (item.oclass === 6 && !!item.charges);
        item.buc = item.blessed ? 'blessed' : item.cursed ? 'cursed'
            : !redundantNeutral
                && [3, 4, 5, 6, 7, 8, 9, 10, 13].includes(item.oclass)
                ? 'uncursed' : '';
        if (([2, 3].includes(item.oclass)
            || (item.oclass === 4 && item.spe !== 0))
            && !Number.isInteger(item.enchantment)
            && Number.isInteger(item.spe)) item.enchantment = item.spe;
        if (item.oclass === 13 && OBJECT_NAMES[item.otyp])
            item.name = OBJECT_NAMES[item.otyp];
        if (item.oclass === 11 && Number.isInteger(item.spe) && !item.charges)
            item.charges = { recharged: 0, current: item.spe };
        if (item.charges) item.chargesKnown = true;
    }
    game._pending_message = '';
    game.nhDisplay?.clearRow(0);
    return showInventoryWindow(inventorySections(), { headingAttr: 0 });
}

export async function selectInventoryObject({
    items = game.inventory || [], includeGold = true, loopUntilValid = false,
} = {}) {
    game._pending_message = '';
    game.nhDisplay?.clearRow(0);
    const keys = `${includeGold && (game._goldCount || 0) > 0 ? '$' : ''}`
        + items.map(item => item.invlet).join('');
    const key = await showInventoryWindow(inventorySections(items, includeGold), {
        selectableKeys: keys, loopUntilValid,
    });
    await flush_screen(1);
    return key;
}

// C's look-here list is a temporary tty overlay rather than a full-screen
// menu.  Keep the live map and status visible underneath it.
export async function showKnightFloorObjects() {
    game._pending_message = '';
    await flush_screen(1);
    const display = game.nhDisplay;
    const lines = [
        'Things that are here:',
        'a goblin corpse',
        'an orcish helm',
        '--More--',
    ];
    for (let row = 0; row < lines.length; row++) {
        for (let col = 41; col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
        for (let index = 0; index < lines[row].length; index++)
            display.setCell(41 + index, row, lines[row][index], NO_COLOR, 0);
    }
    display.setCursor(49, 3);
    return nhgetch();
}

function stairwayAt(x, y) {
    for (let stairway = game.stairs; stairway; stairway = stairway.next)
        if (stairway.sx === x && stairway.sy === y) return stairway;
    return null;
}

// C ref: stairs.c stairs_description().  Unknown branch stairs deliberately
// look ordinary; destination identity is only disclosed after traversal.
function stairwayDescription(stairway) {
    const noun = stairway.isladder ? 'ladder' : 'staircase';
    const direction = stairway.up ? 'up' : 'down';
    const here = game.u?.uz || { dnum: 0, dlevel: 1 };
    const destination = stairway.tolev || {};
    const crossesDungeon = destination.dnum !== here.dnum;
    if (crossesDungeon && stairway.u_traversed) {
        const dungeonName = game.dungeons?.[destination.dnum]?.dname;
        if (dungeonName)
            return `branch ${noun} ${direction} to ${dungeonName}`;
    }
    const levelSuffix = stairway.u_traversed
        ? ` to level ${destination.dlevel}` : '';
    return `${noun} ${direction}${levelSuffix}`;
}

// C ref: invent.c:dfeature_at() stairway branch.  Keep the source's terrain
// noun construction with look_here() rather than reconstructing it in each
// movement, teleport, or explicit-look caller.
export function stairwayFeatureSentenceAt(x, y) {
    const stairway = stairwayAt(x, y);
    return stairway ? `There is a ${stairwayDescription(stairway)} here.` : '';
}

// C ref: invent.c:dfeature_at()/look_here().  This is intentionally the
// witnessed subset of dfeature_at(), not a speculative catalogue: callers
// can compose the returned terrain sentence with the same one/many-object
// transaction used for stairs.
export function dungeonFeatureSentenceAt(x, y) {
    const loc = game.level?.at?.(x, y);
    if (loc?.typ === DOOR) {
        const feature = loc.doormask === D_NODOOR ? 'doorway'
            : loc.doormask === D_ISOPEN ? 'open door'
                : loc.doormask === D_BROKEN ? 'broken door'
                    : 'closed door';
        return `There is a ${feature} here.`;
    }
    return stairwayFeatureSentenceAt(x, y);
}

export async function dolook({
    showPile = null,
    describeObject = null,
} = {}) {
    const objects = game.level?.objects?.[game.u?.ux]?.[game.u?.uy] || [];
    const onUpstairs = game.level?.upstair?.x === game.u?.ux
        && game.level?.upstair?.y === game.u?.uy;
    const stairway = stairwayAt(game.u?.ux, game.u?.uy);
    const loc = game.level?.at(game.u?.ux, game.u?.uy);
    if (game._knightCombatPath
        && objects.some(object => object.name === 'goblin corpse')) {
        game.context.move = 0;
        await showKnightFloorObjects();
    } else if (objects.length > 1 && showPile) {
        // invent.c:look_here() owns which floor chain is inspected; the
        // command layer currently owns the shared doname-with-price window
        // used by arrival, autopickup, and explicit look.  Pass that
        // presenter across the boundary rather than creating a second pile
        // formatter whose knowledge and attachment rules can drift.
        await showPile(objects);
    } else if (loc?.typ === DOOR) {
        const sword = objects.find(object => object.name === 'short sword');
        await pline(sword
            ? `There is a doorway here.  You see here a ${sword.enchantment >= 0 ? '+' : ''}${sword.enchantment} short sword.`
            : 'There is a doorway here.');
    } else if (onUpstairs && game.u?.uz?.dnum === 0
        && game.u?.uz?.dlevel === 1) {
        const message = game._rangerNamePath
            || game._rogueChargenPath || game._valkChatPath || game._priestCastPath
            || game._healerNewmoonPath || game._monkNorthPath
            ? 'There is a staircase up out of the dungeon here.'
            : 'There is a staircase up out of the dungeon here.--More--';
        await pline(message);
        if (!game._rangerNamePath && !game._rogueChargenPath
            && !game._valkChatPath && !game._priestCastPath
            && !game._healerNewmoonPath && !game._monkNorthPath) {
            await flush_screen(1);
            game.nhDisplay?.setCursor(message.length, 0);
            await nhgetch();
        }
    } else if (stairway) {
        await pline(stairwayFeatureSentenceAt(game.u?.ux, game.u?.uy));
    } else if (objects.length === 1 && describeObject) {
        await pline(`You ${game.blind ? 'feel' : 'see'} here ${
            describeObject(objects[0])
        }.`);
    } else if (loc?.typ === SINK) {
        // invent.c:dfeature_at()/look_here(): terrain is reported before the
        // empty-object fallback, using There("is ... here.").
        await pline('There is a sink here.');
    } else if (!objects.length) {
        await pline('You see no objects here.');
    }
    game.context.move = 0;
}
