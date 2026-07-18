// invent.js — Inventory display and look-here commands.
// C ref: invent.c — ddoinv(), display_inventory(), dolook().

import { game } from './gstate.js';
import { flush_screen, pline } from './display.js';
import { showInventoryWindow } from './windows.js';
import { nhgetch } from './input.js';
import { DOOR } from './const.js';

const CLASS_ORDER = [
    'Coins', 'Amulets', 'Weapons', 'Armor', 'Comestibles', 'Scrolls',
    'Spellbooks', 'Potions', 'Rings', 'Wands', 'Tools', 'Gems', 'Boulders',
];

function indefiniteArticle(text) {
    return /^[aeiou]/i.test(text) ? 'an' : 'a';
}

function itemDescription(item) {
    const quantity = item.quantity ?? 1;
    const parts = [];
    if (item.buc) parts.push(item.buc);
    if (item.rustproof) parts.push('rustproof');
    if (Number.isInteger(item.enchantment)) {
        parts.push(`${item.enchantment >= 0 ? '+' : ''}${item.enchantment}`);
    }

    let noun = quantity === 1 ? item.name : (item.plural || `${item.name}s`);
    let description = [...parts, noun].join(' ');
    if (quantity > 1) description = `${quantity} ${description}`;
    else description = `${indefiniteArticle(description)} ${description}`;

    if (item.charges) description += ` (${item.charges.recharged || 0}:${item.charges.current})`;
    if (game.u?.twoweap && item === game.uwep) description += ' (wielded in right hand)';
    else if (game.u?.twoweap && item === game.uswapwep) description += ' (wielded in left hand)';
    else if (item === game.uwep) description += ['samurai', 'caveman'].includes(game.urole?.key)
        ? ' (weapon in right hand)' : ' (weapon in hand)';
    else if (item === game.uswapwep)
        description += ' (alternate weapon; not wielded)';
    if (item.ready) description += game.urole?.key === 'samurai'
        ? ' (in quiver)' : game.urole?.key === 'caveman'
            ? ' (in quiver pouch)' : ' (at the ready)';
    if (item.worn) description += ' (being worn)';
    return description;
}

function inventorySections() {
    const grouped = new Map();
    if ((game._goldCount || 0) > 0) {
        grouped.set('Coins', [`$ - ${game._goldCount} gold pieces`]);
    }
    for (const item of game.inventory || []) {
        const heading = item.class || 'Other';
        if (!grouped.has(heading)) grouped.set(heading, []);
        grouped.get(heading).push(`${item.invlet} - ${itemDescription(item)}`);
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

export async function ddoinv() {
    game._pending_message = '';
    game.nhDisplay?.clearRow(0);
    await showInventoryWindow(inventorySections());
    await flush_screen(1);
    game.context.move = 0;
}

export async function dolook() {
    const objects = game.level?.objects?.[game.u?.ux]?.[game.u?.uy] || [];
    const onUpstairs = game.level?.upstair?.x === game.u?.ux
        && game.level?.upstair?.y === game.u?.uy;
    const loc = game.level?.at(game.u?.ux, game.u?.uy);
    if (loc?.typ === DOOR) {
        await pline('There is a doorway here.');
    } else if (onUpstairs) {
        const message = 'There is a staircase up out of the dungeon here.--More--';
        await pline(message);
        await flush_screen(1);
        game.nhDisplay?.setCursor(message.length, 0);
        await nhgetch();
    } else if (objects.some(object => object.name === 'lichen corpse')) {
        await pline('You see here a lichen corpse.');
    } else if (!objects.length) {
        await pline('You see no objects here.');
    }
    game.context.move = 0;
}
