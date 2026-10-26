// C invent.c:dispinv_with_action(), dopr*(), dotypeinv(), dounpaid();
// shk.c:doinvbill(). These commands inspect inventory without taking time.
import { game, requireGameLevel } from './gstate.js';
import { inventoryActionForObject, inventoryItemDescription, inventoryPrimaryHandDetail, selectInventoryObject, } from './invent.js';
import { reassignInventoryLetters } from './inventory_prompt.js';
import { inventoryClassOrder, lootSortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { clearMessageWindow, consumeHallucinatedMenuObjectGlyph, plineWithContinuation as pline } from './display.js';
import { showInventoryWindow, showMultiSelectWindow, showTextMenuOverlay } from './windows.js';
import { promptKey } from './tty_prompts.js';
import { heroHandName } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { possessiveName } from './monster_name.js';
import { distantObjectName, objectName, observeObjectForNaming, simpleObjectName } from './objnam.js';
import { OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { currency } from './currency.js';
import { heroGoldAmount, heroGoldObject } from './hero_gold.js';
import { hiddenGold } from './gold.js';
import { reportShopFinances } from './shop_finance.js';
import { currentShopResident, shopkeeperInOwnShop, unpaidObjectCost } from './shk.js';
import { objectsInTimerGraph } from './object_timers.js';
import { MENU_FULL, MENU_PARTIAL, PICK_ONE, SORTLOOT_INUSE, W_ACCESSORY, W_AMUL, W_ARMOR, W_RING, W_SADDLE, W_TOOL, W_WEAPONS, } from './const.js';
import { LEASH } from './object_data.js';
import { heroSpecies } from './hero_species.js';
import { monsterIsHumanoid } from './monster_data.js';
const BUC_CHOICES = ['B', 'C', 'U', 'X'];
export async function inventoryReport(report) {
    game.context.move = 0;
    if (report === 'type')
        return typeInventory();
    if (report === 'gold') {
        await reportWallet();
        const purse = heroGoldObject(game);
        return purse && game.iflags.menu_requested ? reportSubset([purse], false) : null;
    }
    if (report === 'weapon') {
        if (!game.uwep) {
            await pline(`You are ${game.uarmg ? 'empty handed' : monsterIsHumanoid(heroSpecies(game))
                ? 'bare handed' : 'not wielding anything'}.`);
        }
        else if (!game.iflags.menu_requested) {
            await describeCarriedObject(game.uwep);
            if (game.u.twoweap && game.uswapwep)
                await describeCarriedObject(game.uswapwep);
        }
        else {
            return reportSubset([game.uwep, game.uswapwep, game.uquiver]
                .filter((object) => !!object));
        }
        return null;
    }
    if (report === 'armor') {
        const armor = [game.uarm, game.uarmc, game.uarms, game.uarmh, game.uarmg, game.uarmf, game.uarmu]
            .filter((object) => !!object);
        if (armor.length)
            return reportSubset(armor);
        await pline(game.uskin ? `You are not wearing armor but have ${simpleObjectName(game.uskin)
            .replace(/^set of /i, '').replace(/ dragon /i, ' ')} embedded in your skin.`
            : 'You are not wearing any armor.');
        return null;
    }
    if (report === 'rings') {
        const rings = [game.uright, game.uleft].filter((object) => !!object);
        if (rings.length)
            return reportSubset(rings, rings.length > 1 || !!game.iflags.menu_requested
                || rings.some(object => object.oclass !== 4), rings.length === 1 ? 'Ring' : 'Rings');
        await pline('You are not wearing any rings.');
        return null;
    }
    if (report === 'amulet') {
        if (game.uamul)
            return reportSubset([game.uamul], true, 'Amulet');
        await pline('You are not wearing an amulet.');
        return null;
    }
    const items = game.inventory.filter(report === 'tools' ? toolBeingUsed : isInUse);
    if (items.length)
        return reportSubset(report === 'tools' ? items.slice(0, 52) : null);
    await pline(report === 'tools' ? 'You are not using any tools.' : 'You are not wearing or wielding anything.');
    return null;
}
async function reportWallet() {
    const purse = heroGoldAmount(game), stashed = hiddenGold(game, false);
    if (game.flags.verbose !== false) {
        let message = purse ? `Your wallet contains ${purse} ${currency(purse)}` : 'Your wallet is empty';
        if (stashed)
            message += `, ${purse ? 'and' : 'but'} you have ${stashed} ${purse ? 'more' : currency(stashed)} stashed away in your pack`;
        await pline(`${message}.`);
    }
    else {
        const total = purse + stashed;
        await pline(total ? `You are carrying a total of ${total} ${currency(total)}.` : 'You have no money.');
    }
    await reportShopFinances();
}
async function describeCarriedObject(object) {
    if (game.flags.fixinv === false)
        reassignInventoryLetters();
    observeObjectForNaming(object);
    await pline(`${object.invlet} - ${await inventoryItemDescription(object, {
        primaryHandDetail: inventoryPrimaryHandDetail(object),
    })}.`);
}
function toolBeingUsed(object) {
    return !!((object.owornmask ?? 0) & (W_TOOL | W_SADDLE))
        || object.oclass === 6 && (object === game.uwep || !!object.lamplit
            || object.otyp === LEASH && !!object.leashmon);
}
function isInUse(object) {
    return !!((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY | W_SADDLE | W_WEAPONS))
        || toolBeingUsed(object);
}
async function reportSubset(items, inuse = true, accessoryLabel = 'Accessories') {
    if (game.flags.fixinv === false)
        reassignInventoryLetters();
    const candidates = items ?? game.inventory.filter(isInUse);
    let key;
    if (items?.length === 1 && !game.iflags.menu_requested) {
        const first = items[0];
        if (first)
            await describeCarriedObject(first);
        return null;
    }
    if (!inuse) {
        const forceMenu = game.flags.force_invmenu;
        game.flags.force_invmenu = false;
        try {
            key = (await selectInventoryObject({ letters: candidates.map(object => object.invlet).join('') })).key;
        }
        finally {
            if (forceMenu === undefined)
                delete game.flags.force_invmenu;
            else
                game.flags.force_invmenu = forceMenu;
        }
    }
    else {
        const ordered = sortObjects(candidates, { mode: SORTLOOT_INUSE });
        // invent.c:display_pickinv() classifies entries only when sortloot()
        // actually runs its comparison, so a lone in-use entry keeps
        // orderclass 0 and is listed without any class heading.  The bare
        // hands entry makes the sorted list big enough to classify.
        const headed = ordered.length >= 2 || (!items && !game.uwep);
        const sections = [{ heading: null, items: [{ text: 'Inventory in use', attr: 1 }] }];
        const rows = ordered.map(object => ({
            object, heading: headed ? inUseHeading(object, accessoryLabel) : null,
        }));
        if (!items && !game.uwep) {
            const position = rows.findIndex(row => row.heading === 'Wielded/Readied Weapons'
                || row.heading === 'Worn Armor' || row.heading === 'Miscellaneous');
            rows.splice(position < 0 ? rows.length : position, 0, { object: null, heading: 'Wielded/Readied Weapons' });
        }
        for (const row of rows) {
            const object = row.object;
            if (object) {
                observeObjectForNaming(object);
                consumeHallucinatedMenuObjectGlyph(object);
            }
            const text = object ? await inventoryItemDescription(object, {
                primaryHandDetail: inventoryPrimaryHandDetail(object),
            }) : `${game.uarmg ? 'gloved' : 'bare'} ${makePlural(heroHandName(game))} (no weapon)`;
            const item = { key: object?.invlet ?? '-', text };
            const last = sections.at(-1);
            if (last?.heading === row.heading)
                sections[sections.length - 1] = { ...last, items: [...last.items, item] };
            else
                sections.push({ heading: row.heading, items: [item] });
        }
        key = (await showInventoryWindow(sections, { pickMode: PICK_ONE })).key;
    }
    const selected = candidates.find(object => object.invlet === String.fromCharCode(key));
    return selected ? inventoryActionForObject(selected) : null;
}
function inUseHeading(object, accessoryLabel) {
    const mask = object.owornmask ?? 0;
    if (mask & W_ACCESSORY)
        return accessoryLabel;
    if (mask & W_WEAPONS)
        return 'Wielded/Readied Weapons';
    if (mask & W_ARMOR)
        return 'Worn Armor';
    return 'Miscellaneous';
}
function beatitude(object) {
    if (object.oclass === 12)
        return game.flags.goldX ? 'X' : 'U';
    return !object.bknown ? 'X' : object.blessed ? 'B' : object.cursed ? 'C' : 'U';
}
function unpaidObjects(objects) {
    return objects.flatMap(object => [...(object.unpaid ? [object] : []), ...unpaidObjects(object.contents ?? [])]);
}
async function typeInventory() {
    const bill = usedUpBill();
    if (!game.inventory.length && !bill.length) {
        await pline("You aren't carrying anything.");
        return null;
    }
    if (game.urole?.key === 'priest')
        for (const object of game.inventory)
            object.bknown = object.oclass !== 12;
    const level = requireGameLevel();
    const carried = unpaidObjects(game.inventory);
    const floor = unpaidObjects(level.objects.flatMap(column => (column ?? []).flatMap(pile => pile ?? [])));
    const buried = unpaidObjects(level.buriedObjects ?? []);
    const statuses = new Set(game.inventory.map(beatitude));
    const picked = game.inventory.filter(object => object.pickup_prev);
    const classes = [...new Set(game.inventory.map(object => object.oclass))];
    const extra = `${carried.length + floor.length + buried.length ? 'u' : ''}${bill.length ? 'x' : ''}${[...'BUCX'].filter(status => statuses.has(bucChoice(status))).join('')}${picked.length ? 'P' : ''}`;
    const prompt = 'What type of object do you want an inventory of?';
    let choice;
    const style = game.flags.menu_style ?? MENU_FULL;
    if (style === MENU_FULL || style === MENU_PARTIAL) {
        const menuClasses = [...inventoryClassOrder(), 17].filter(oclass => classes.includes(oclass));
        choice = await inventoryCategoryMenu(menuClasses, carried.length > 0, bill.length > 0, statuses, picked, prompt);
    }
    else {
        const types = classes.map(oclass => OBJECT_CLASS_SYMBOLS[oclass]).join('') + (extra ? ` ${extra}` : '');
        choice = types;
        if (types.length > 1) {
            for (;;) {
                const key = await promptKey(`${prompt} [${types}] `);
                // tty_yn_function() maps these keys to the NUL default.
                if ([0, 27, 32, 10, 13].includes(key)) {
                    clearMessageWindow();
                    return null;
                }
                const symbol = String.fromCharCode(key);
                if (OBJECT_CLASS_SYMBOLS.includes(symbol) || 'uxBUCXP'.includes(symbol)) {
                    choice = symbol;
                    break;
                }
            }
        }
    }
    if (choice === null)
        return null;
    if (choice === 'x' || choice === 'X' && bill.length && !statuses.has('X')) {
        if (bill.length)
            await showBill(bill);
        else
            await pline(`No used-up objects${carried.length + floor.length + buried.length ? ' on your shopping bill' : ''}.`);
        return null;
    }
    if (choice === 'u' || choice === 'U' && carried.length + floor.length + buried.length > 0 && !statuses.has('U')) {
        if (carried.length + floor.length + buried.length)
            await showUnpaid(carried, floor.length, buried.length);
        else
            await pline('You are not carrying any unpaid objects.');
        return null;
    }
    const status = typeof choice === 'string' && 'BUCXP'.includes(choice) ? choice : null;
    const oclass = typeof choice === 'number' ? choice : OBJECT_CLASS_SYMBOLS.indexOf(choice);
    const candidates = game.inventory.filter(object => status === 'P' ? object.pickup_prev
        : status ? beatitude(object) === status : object.oclass === oclass);
    const before = status === 'B' ? 'known to be blessed ' : status === 'U' ? 'known to be uncursed '
        : status === 'C' ? 'known to be cursed ' : status ? '' : 'such ';
    const after = status === 'X' ? ' whose blessed/uncursed/cursed status is unknown'
        : status === 'P' ? ' that were just picked up' : '';
    if (!candidates.length) {
        await pline(`You have no ${before}objects${after}.`);
        return null;
    }
    const sorted = sortObjects(candidates, { mode: lootSortMode({ inventoryLetters: game.flags.fixinv !== false }) });
    const order = [...inventoryClassOrder(), 17];
    const sections = [];
    for (const oclass of order) {
        const objects = sorted.filter(object => object.oclass === oclass);
        if (!objects.length)
            continue;
        const items = [];
        for (const object of objects) {
            observeObjectForNaming(object);
            consumeHallucinatedMenuObjectGlyph(object);
            items.push({ ...(game.flags.fixinv !== false ? { key: object.invlet ?? '#' }
                    : object === sorted[0] && object.oclass === 12 ? { key: '$' } : {}),
                groupAccelerator: OBJECT_CLASS_SYMBOLS[oclass] ?? '', value: object,
                text: await inventoryItemDescription(object, { primaryHandDetail: inventoryPrimaryHandDetail(object) }) });
        }
        sections.push({ heading: objectClassHeading(oclass), items });
    }
    const selected = await showMultiSelectWindow({ title: '',
        introLines: status ? [`Items ${(before || after).trim()}:`] : [],
        sections, pageLocalKeys: true, pickOne: true });
    const object = selected[0];
    return object ? inventoryActionForObject(object) : null;
}
function bucChoice(choice) {
    switch (choice) {
        case 'B':
        case 'U':
        case 'C':
        case 'X': return choice;
        default: throw new Error(`Unknown inventory status ${choice}`);
    }
}
async function inventoryCategoryMenu(classes, unpaid, billed, statuses, picked, prompt) {
    if (!game.inventory.length)
        return null;
    if (classes.length === 1 && !unpaid && !billed && statuses.size <= 1)
        return classes[0] ?? null;
    const entries = classes.map((oclass, index) => ({ key: String.fromCharCode(97 + index),
        groupAccelerator: OBJECT_CLASS_SYMBOLS[oclass] ?? '', value: oclass, text: objectClassHeading(oclass) }));
    const extras = [
        ...(unpaid ? [{ key: 'u', text: 'Unpaid items' }] : []),
        ...(billed ? [{ key: 'x', text: 'Unpaid items already used up' }] : []),
        ...BUC_CHOICES.filter(status => statuses.has(status)).map(key => ({ key,
            text: key === 'X' ? 'Items of unknown Bless/Curse status' : `Items known to be ${key === 'B' ? 'Blessed' : key === 'C' ? 'Cursed' : 'Uncursed'}` })),
        ...(picked.length ? [{ key: 'P', text: picked.length === 1 && picked[0]
                    ? `Just picked up: ${await inventoryItemDescription(picked[0])}` : 'Items you just picked up' }] : []),
    ];
    const separator = { selectable: false, text: '' };
    const selected = await showMultiSelectWindow({ title: prompt, pickOne: true,
        omitHeadings: true, sections: [{ items: [...entries,
                    ...(extras.length ? [separator] : []),
                    ...extras.map(entry => ({ ...entry, value: entry.key })),
                ] }],
    });
    return selected[0] ?? null;
}
function usedUpBill() {
    const keeper = currentShopResident();
    if (!keeper || !shopkeeperInOwnShop(keeper))
        return [];
    const objects = [...objectsInTimerGraph(), ...game.billObjects ?? []];
    const lines = [];
    for (const entry of keeper.eshk.bill ?? []) {
        const object = objects.find(object => object.o_id === entry.bo_id);
        if (object && (entry.useup || object.quan < entry.bquan)) {
            const quantity = entry.useup ? entry.bquan : entry.bquan - object.quan;
            lines.push({ object, quantity, price: quantity * entry.price });
        }
    }
    if (keeper.eshk.debit)
        lines.push({ object: null, quantity: 0, price: keeper.eshk.debit });
    return lines;
}
async function showBill(bill) {
    const lines = ['Unpaid articles already used up:', ''];
    let total = 0;
    for (const line of bill) {
        if (!line.object && total)
            lines.push('');
        lines.push(await pricedInventoryLine(line.object, line.object ? 'x' : '$', line.price, line.object ? null : 'usage charges and/or other fees', { quantity: line.quantity, useInvlet: false, distant: false }));
        total += line.price;
    }
    lines.push('', await pricedInventoryLine(null, '*', total, 'Total:'));
    // C shk.c:4229 fills the bill window with putstr(), which never reaches
    // add_menu()'s menucoloring.
    await showTextMenuOverlay(lines, { viaPutstr: true });
}
async function showUnpaid(carried, floor, buried) {
    const extra = floor + buried;
    const first = carried[0];
    if (first && carried.length === 1 && !extra && !unknownContainer(first)) {
        await pline(await pricedInventoryLine(first, first.where === 'inventory' ? first.invlet ?? '#' : '>', await unpaidObjectCost(first)));
        return;
    }
    if (game.flags.fixinv === false)
        reassignInventoryLetters();
    const lines = [];
    let total = 0;
    const top = game.inventory.filter(object => object.unpaid);
    for (const oclass of game.flags.sortpack === false ? [null] : inventoryClassOrder()) {
        const objects = top.filter(object => oclass === null || object.oclass === oclass);
        if (objects.length && oclass !== null)
            lines.push(`Unpaid ${objectClassHeading(oclass)}`);
        for (const object of objects) {
            const price = await unpaidObjectCost(object);
            total += price;
            lines.push(await pricedInventoryLine(object, object.invlet ?? '#', price));
        }
    }
    if (carried.length > top.length) {
        if (game.flags.sortpack !== false)
            lines.push('Unpaid Bagged/Boxed items');
        for (const container of game.inventory) {
            const contents = unpaidObjects(container.contents ?? []);
            if (!container.contents?.length)
                continue;
            let price = 0;
            for (const object of contents) {
                const cost = await unpaidObjectCost(object);
                price += cost;
                total += cost;
                if (container.cknown)
                    lines.push(await pricedInventoryLine(object, '>', cost));
            }
            if (!container.cknown)
                lines.push(await pricedInventoryLine(null, '>', price, `${possessiveName(objectName(container))} contents`));
        }
    }
    if (carried.length)
        lines.push('', await pricedInventoryLine(null, '*', total, 'Total:'));
    if (extra) {
        const verb = extra > 1 ? 'are' : 'is';
        const where = !buried ? 'on the floor' : !floor ? 'under the floor' : 'on or under the floor';
        if (!carried.length)
            await pline(`You aren't carrying any unpaid items but there ${verb} ${extra} ${where}.`);
        else
            lines.push('', `(There ${verb} ${extra} more unpaid object${extra === 1 ? '' : 's'} ${where}.)`);
    }
    // C invent.c:3703 fills the unpaid-items window with putstr().
    if (carried.length)
        await showTextMenuOverlay(lines, { viaPutstr: true });
}
function unknownContainer(object) {
    let container = object.container;
    while (container) {
        if (!container.cknown)
            return true;
        container = container.container;
    }
    return false;
}
async function pricedInventoryLine(object, letter, price, text = null, { quantity = 0, useInvlet = true, distant = true } = {}) {
    const suppress = game.iflags.suppress_price;
    game.iflags.suppress_price = true;
    const saved = object?.quan;
    try {
        if (object) {
            if (quantity)
                object.quan = quantity;
            if (distant)
                text ??= await distantObjectName(object, inventoryItemDescription);
            else {
                observeObjectForNaming(object);
                text ??= await inventoryItemDescription(object);
            }
            if (useInvlet && game.flags.fixinv !== false && letter !== '>')
                letter = object.invlet ?? letter;
        }
        const tab = game.iflags.menu_tab_sep;
        if (!price && letter !== '*')
            return `${letter} - ${text}${useInvlet ? '.' : ''}`;
        return `${letter} - ${tab ? text : (text ?? '').padEnd(45)}${tab ? '\t' : ' '}${String(price).padStart(6)} ${currency(price)}`;
    }
    finally {
        if (object && saved !== undefined)
            object.quan = saved;
        if (suppress === undefined)
            delete game.iflags.suppress_price;
        else
            game.iflags.suppress_price = suppress;
    }
}
//# sourceMappingURL=inventory_reports.js.map