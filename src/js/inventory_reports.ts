// C invent.c:dispinv_with_action(), dopr*(), dotypeinv(), dounpaid();
// shk.c:doinvbill(). These commands inspect inventory without taking time.
import { game, requireGameLevel } from './gstate.js';
import type { GameObject } from './object_types.js';
import type { InventoryAction } from './invent.js';
import type { InventorySection, MenuLabel, PageLocalMultiSelectSection } from './windows.js';
import {
    inventoryActionForObject, inventoryItemDescription, inventoryPrimaryHandDetail,
    selectInventoryObject,
} from './invent.js';
import { reassignInventoryLetters } from './inventory_prompt.js';
import { inventoryClassOrder, lootSortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { clearMessageWindow, consumeHallucinatedMenuObjectGlyph, plineWithContinuation as pline } from './display.js';
import { showInventoryWindow, showMultiSelectWindow, showTextMenuOverlay } from './windows.js';
import { promptKey } from './tty_prompts.js';
import { heroHandName } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { possessiveName } from './monster_name.js';
import { objectName, observeDistantObjectForNaming, observeObjectForNaming, simpleObjectName } from './objnam.js';
import { OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { currency } from './currency.js';
import { heroGoldAmount, heroGoldObject } from './hero_gold.js';
import { hiddenGold } from './gold.js';
import { reportShopFinances } from './shop_finance.js';
import { currentShopResident, shopkeeperInOwnShop, unpaidObjectCost } from './shk.js';
import { objectsInTimerGraph } from './object_timers.js';
import {
    MENU_FULL, MENU_PARTIAL, PICK_ONE, SORTLOOT_INUSE,
    W_ACCESSORY, W_AMUL, W_ARMOR, W_RING, W_SADDLE, W_TOOL, W_WEAPONS,
} from './const.js';
import { LEASH } from './object_data.js';
import { heroSpecies } from './hero_species.js';
import { monsterIsHumanoid } from './monster_data.js';

type InventoryReport = 'gold' | 'weapon' | 'armor' | 'rings' | 'amulet' | 'tools' | 'inuse' | 'type';
type Buc = 'B' | 'U' | 'C' | 'X';
const BUC_CHOICES: readonly Buc[] = ['B', 'C', 'U', 'X'];

export async function inventoryReport(report: InventoryReport): Promise<InventoryAction | null> {
    game.context.move = 0;
    if (report === 'type') return typeInventory();
    if (report === 'gold') {
        await reportWallet();
        const purse = heroGoldObject(game);
        return purse && game.iflags.menu_requested ? reportSubset([purse], false) : null;
    }
    if (report === 'weapon') {
        if (!game.uwep) {
            await pline(`You are ${game.uarmg ? 'empty handed' : monsterIsHumanoid(heroSpecies(game))
                ? 'bare handed' : 'not wielding anything'}.`);
        } else if (!game.iflags.menu_requested) {
            await describeCarriedObject(game.uwep);
            if (game.u.twoweap && game.uswapwep) await describeCarriedObject(game.uswapwep);
        } else {
            return reportSubset([game.uwep, game.uswapwep, game.uquiver]
                .filter((object): object is GameObject => !!object));
        }
        return null;
    }
    if (report === 'armor') {
        const armor = [game.uarm, game.uarmc, game.uarms, game.uarmh, game.uarmg, game.uarmf, game.uarmu]
            .filter((object): object is GameObject => !!object);
        if (armor.length) return reportSubset(armor);
        await pline(game.uskin ? `You are not wearing armor but have ${simpleObjectName(game.uskin)
            .replace(/^set of /i, '').replace(/ dragon /i, ' ')} embedded in your skin.`
            : 'You are not wearing any armor.');
        return null;
    }
    if (report === 'rings') {
        const rings = [game.uright, game.uleft].filter((object): object is GameObject => !!object);
        if (rings.length) return reportSubset(rings, rings.length > 1 || !!game.iflags.menu_requested
            || rings.some(object => object.oclass !== 4), rings.length === 1 ? 'Ring' : 'Rings');
        await pline('You are not wearing any rings.');
        return null;
    }
    if (report === 'amulet') {
        if (game.uamul) return reportSubset([game.uamul], true, 'Amulet');
        await pline('You are not wearing an amulet.');
        return null;
    }
    const items = game.inventory.filter(report === 'tools' ? toolBeingUsed : isInUse);
    if (items.length) return reportSubset(report === 'tools' ? items.slice(0, 52) : null);
    await pline(report === 'tools' ? 'You are not using any tools.' : 'You are not wearing or wielding anything.');
    return null;
}

async function reportWallet(): Promise<void> {
    const purse = heroGoldAmount(game), stashed = hiddenGold(game, false);
    if (game.flags.verbose !== false) {
        let message = purse ? `Your wallet contains ${purse} ${currency(purse)}` : 'Your wallet is empty';
        if (stashed) message += `, ${purse ? 'and' : 'but'} you have ${stashed} ${
            purse ? 'more' : currency(stashed)} stashed away in your pack`;
        await pline(`${message}.`);
    } else {
        const total = purse + stashed;
        await pline(total ? `You are carrying a total of ${total} ${currency(total)}.` : 'You have no money.');
    }
    await reportShopFinances();
}

async function describeCarriedObject(object: GameObject): Promise<void> {
    if (game.flags.fixinv === false) reassignInventoryLetters();
    observeObjectForNaming(object);
    await pline(`${object.invlet} - ${inventoryItemDescription(object, {
        primaryHandDetail: inventoryPrimaryHandDetail(object),
    })}.`);
}

function toolBeingUsed(object: GameObject): boolean {
    return !!((object.owornmask ?? 0) & (W_TOOL | W_SADDLE))
        || object.oclass === 6 && (object === game.uwep || !!object.lamplit
            || object.otyp === LEASH && !!object.leashmon);
}

function isInUse(object: GameObject): boolean {
    return !!((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY | W_SADDLE | W_WEAPONS))
        || toolBeingUsed(object);
}

async function reportSubset(items: readonly GameObject[] | null, inuse = true, accessoryLabel = 'Accessories')
: Promise<InventoryAction | null> {
    if (game.flags.fixinv === false) reassignInventoryLetters();
    const candidates = items ?? game.inventory.filter(isInUse);
    let key: number;
    if (items?.length === 1 && !game.iflags.menu_requested) {
        const first = items[0];
        if (first) await describeCarriedObject(first);
        return null;
    }
    if (!inuse) {
        const forceMenu = game.flags.force_invmenu;
        game.flags.force_invmenu = false;
        try { key = (await selectInventoryObject({ items: candidates })).key; }
        finally {
            if (forceMenu === undefined) delete game.flags.force_invmenu;
            else game.flags.force_invmenu = forceMenu;
        }
    } else {
        const ordered = sortObjects(candidates, { mode: SORTLOOT_INUSE });
        const sections: InventorySection[] = [{ heading: null, items: [{ text: 'Inventory in use', attr: 1 }] }];
        const rows: { object: GameObject | null; heading: string }[] = ordered.map(object => ({
            object, heading: inUseHeading(object, accessoryLabel),
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
            const text = object ? inventoryItemDescription(object, {
                primaryHandDetail: inventoryPrimaryHandDetail(object),
            }) : `${game.uarmg ? 'gloved' : 'bare'} ${makePlural(heroHandName(game))} (no weapon)`;
            const item = { key: object?.invlet ?? '-', text };
            const last = sections.at(-1);
            if (last?.heading === row.heading) sections[sections.length - 1] = { ...last, items: [...last.items, item] };
            else sections.push({ heading: row.heading, items: [item] });
        }
        key = (await showInventoryWindow(sections, { pickMode: PICK_ONE })).key;
    }
    const selected = candidates.find(object => object.invlet === String.fromCharCode(key));
    return selected ? inventoryActionForObject(selected) : null;
}

function inUseHeading(object: GameObject, accessoryLabel: string): string {
    const mask = object.owornmask ?? 0;
    if (mask & W_ACCESSORY) return accessoryLabel;
    if (mask & W_WEAPONS) return 'Wielded/Readied Weapons';
    if (mask & W_ARMOR) return 'Worn Armor';
    return 'Miscellaneous';
}

function beatitude(object: GameObject): Buc {
    if (object.oclass === 12) return game.flags.goldX ? 'X' : 'U';
    return !object.bknown ? 'X' : object.blessed ? 'B' : object.cursed ? 'C' : 'U';
}

function unpaidObjects(objects: readonly GameObject[]): GameObject[] {
    return objects.flatMap(object => [...(object.unpaid ? [object] : []), ...unpaidObjects(object.contents ?? [])]);
}

async function typeInventory(): Promise<InventoryAction | null> {
    const bill = usedUpBill();
    if (!game.inventory.length && !bill.length) {
        await pline("You aren't carrying anything.");
        return null;
    }
    if (game.urole?.key === 'priest')
        for (const object of game.inventory) object.bknown = object.oclass !== 12;
    const level = requireGameLevel();
    const carried = unpaidObjects(game.inventory);
    const floor = unpaidObjects(level.objects.flatMap(column =>
        (column ?? []).flatMap(pile => pile ?? [])));
    const buried = unpaidObjects(level.buriedObjects ?? []);
    const statuses = new Set(game.inventory.map(beatitude));
    const picked = game.inventory.filter(object => object.pickup_prev);
    const classes = [...new Set(game.inventory.map(object => object.oclass))];
    const extra = `${carried.length + floor.length + buried.length ? 'u' : ''}${bill.length ? 'x' : ''}${
        [...'BUCX'].filter(status => statuses.has(bucChoice(status))).join('')}${picked.length ? 'P' : ''}`;
    const prompt = 'What type of object do you want an inventory of?';
    let choice: string | number | null;
    const style = game.flags.menu_style ?? MENU_FULL;
    if (style === MENU_FULL || style === MENU_PARTIAL) {
        const menuClasses = [...inventoryClassOrder(), 17].filter(oclass => classes.includes(oclass));
        choice = await inventoryCategoryMenu(menuClasses, carried.length > 0, bill.length > 0, statuses, picked, prompt);
    } else {
        const types = classes.map(oclass => OBJECT_CLASS_SYMBOLS[oclass]).join('') + (extra ? ` ${extra}` : '');
        choice = types;
        if (types.length > 1) {
            for (;;) {
                const key = await promptKey(`${prompt} [${types}] `);
                if ([27, 32, 10, 13].includes(key)) {
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
    if (choice === null) return null;
    if (choice === 'x' || choice === 'X' && bill.length && !statuses.has('X')) {
        if (bill.length) await showBill(bill);
        else await pline(`No used-up objects${carried.length + floor.length + buried.length ? ' on your shopping bill' : ''}.`);
        return null;
    }
    if (choice === 'u' || choice === 'U' && carried.length + floor.length + buried.length > 0 && !statuses.has('U')) {
        if (carried.length + floor.length + buried.length) await showUnpaid(carried, floor.length, buried.length);
        else await pline('You are not carrying any unpaid objects.');
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
    const sections: PageLocalMultiSelectSection<GameObject>[] = order.flatMap(oclass => {
        const objects = sorted.filter(object => object.oclass === oclass);
        if (!objects.length) return [];
        return [{ heading: objectClassHeading(oclass), items: objects.map(object => {
            observeObjectForNaming(object);
            consumeHallucinatedMenuObjectGlyph(object);
            return { ...(game.flags.fixinv !== false ? { key: object.invlet ?? '#' }
                : object === sorted[0] && object.oclass === 12 ? { key: '$' } : {}),
                groupAccelerator: OBJECT_CLASS_SYMBOLS[oclass] ?? '', value: object,
                text: inventoryItemDescription(object, { primaryHandDetail: inventoryPrimaryHandDetail(object) }) };
        }) }];
    });
    const selected = await showMultiSelectWindow({ title: status ? `Items ${(before || after).trim()}:` : '',
        titleAttr: 0, blankAfterTitle: false, sections, pageLocalKeys: true, pickOne: true });
    const object = selected[0];
    return object ? inventoryActionForObject(object) : null;
}

function bucChoice(choice: string): Buc {
    switch (choice) { case 'B': case 'U': case 'C': case 'X': return choice;
    default: throw new Error(`Unknown inventory status ${choice}`); }
}

async function inventoryCategoryMenu(classes: readonly number[], unpaid: boolean, billed: boolean,
    statuses: ReadonlySet<Buc>, picked: readonly GameObject[], prompt: string): Promise<string | number | null> {
    if (!game.inventory.length) return null;
    if (classes.length === 1 && !unpaid && !billed && statuses.size <= 1) return classes[0] ?? null;
    const entries = classes.map((oclass, index) => ({ key: String.fromCharCode(97 + index),
        groupAccelerator: OBJECT_CLASS_SYMBOLS[oclass] ?? '', value: oclass, text: objectClassHeading(oclass) }));
    const extras = [
        ...(unpaid ? [{ key: 'u', text: 'Unpaid items' }] : []),
        ...(billed ? [{ key: 'x', text: 'Unpaid items already used up' }] : []),
        ...BUC_CHOICES.filter(status => statuses.has(status)).map(key => ({ key,
            text: key === 'X' ? 'Items of unknown Bless/Curse status' : `Items known to be ${
                key === 'B' ? 'Blessed' : key === 'C' ? 'Cursed' : 'Uncursed'}` })),
        ...(picked.length ? [{ key: 'P', text: picked.length === 1 && picked[0]
            ? `Just picked up: ${inventoryItemDescription(picked[0])}` : 'Items you just picked up' }] : []),
    ];
    const separator: MenuLabel = { selectable: false, text: '' };
    const selected = await showMultiSelectWindow<string | number>({ title: prompt, pickOne: true,
        omitHeadings: true, sections: [{ items: [...entries,
            ...(extras.length ? [separator] : []),
            ...extras.map(entry => ({ ...entry, value: entry.key })),
        ] }],
    });
    return selected[0] ?? null;
}

interface BillLine { object: GameObject | null; quantity: number; price: number }

function usedUpBill(): BillLine[] {
    const keeper = currentShopResident();
    if (!keeper || !shopkeeperInOwnShop(keeper)) return [];
    const objects = [...objectsInTimerGraph(), ...game.billObjects ?? []];
    const lines: BillLine[] = [];
    for (const entry of keeper.eshk.bill ?? []) {
        const object = objects.find(object => object.o_id === entry.bo_id);
        if (object && (entry.useup || object.quan < entry.bquan)) {
            const quantity = entry.useup ? entry.bquan : entry.bquan - object.quan;
            lines.push({ object, quantity, price: quantity * entry.price });
        }
    }
    if (keeper.eshk.debit) lines.push({ object: null, quantity: 0, price: keeper.eshk.debit });
    return lines;
}

async function showBill(bill: readonly BillLine[]): Promise<void> {
    const lines = ['Unpaid articles already used up:', ''];
    let total = 0;
    for (const line of bill) {
        if (!line.object && total) lines.push('');
        lines.push(pricedInventoryLine(line.object, line.object ? 'x' : '$', line.price,
            line.object ? null : 'usage charges and/or other fees', line.quantity, false));
        total += line.price;
    }
    lines.push('', pricedInventoryLine(null, '*', total, 'Total:'));
    await showTextMenuOverlay(lines);
}

async function showUnpaid(carried: readonly GameObject[], floor: number, buried: number): Promise<void> {
    const extra = floor + buried;
    const first = carried[0];
    if (first && carried.length === 1 && !extra && !unknownContainer(first)) {
        await pline(pricedInventoryLine(first, first.where === 'inventory' ? first.invlet ?? '#' : '>', unpaidObjectCost(first)));
        return;
    }
    if (game.flags.fixinv === false) reassignInventoryLetters();
    const lines: string[] = [];
    let total = 0;
    const top = game.inventory.filter(object => object.unpaid);
    for (const oclass of game.flags.sortpack === false ? [null] : inventoryClassOrder()) {
        const objects = top.filter(object => oclass === null || object.oclass === oclass);
        if (objects.length && oclass !== null) lines.push(`Unpaid ${objectClassHeading(oclass)}`);
        for (const object of objects) {
            const price = unpaidObjectCost(object);
            total += price;
            lines.push(pricedInventoryLine(object, object.invlet ?? '#', price));
        }
    }
    if (carried.length > top.length) {
        if (game.flags.sortpack !== false) lines.push('Unpaid Bagged/Boxed items');
        for (const container of game.inventory) {
            const contents = unpaidObjects(container.contents ?? []);
            if (!container.contents?.length) continue;
            const price = contents.reduce((sum, object) => sum + unpaidObjectCost(object), 0);
            total += price;
            if (container.cknown) for (const object of contents)
                lines.push(pricedInventoryLine(object, '>', unpaidObjectCost(object)));
            else lines.push(pricedInventoryLine(null, '>', price, `${possessiveName(objectName(container))} contents`));
        }
    }
    if (carried.length) lines.push('', pricedInventoryLine(null, '*', total, 'Total:'));
    if (extra) {
        const verb = extra > 1 ? 'are' : 'is';
        const where = !buried ? 'on the floor' : !floor ? 'under the floor' : 'on or under the floor';
        if (!carried.length) await pline(`You aren't carrying any unpaid items but there ${verb} ${extra} ${where}.`);
        else lines.push('', `(There ${verb} ${extra} more unpaid object${extra === 1 ? '' : 's'} ${where}.)`);
    }
    if (carried.length) await showTextMenuOverlay(lines);
}

function unknownContainer(object: GameObject): boolean {
    let container = object.container;
    while (container) {
        if (!container.cknown) return true;
        container = container.container;
    }
    return false;
}

function pricedInventoryLine(object: GameObject | null, letter: string, price: number,
    text: string | null = null, quantity = 0, useInvlet = true): string {
    const suppress = game.iflags.suppress_price;
    game.iflags.suppress_price = true;
    const saved = object?.quan;
    try {
        if (object) {
            if (quantity) object.quan = quantity;
            observeDistantObjectForNaming(object);
            text ??= inventoryItemDescription(object);
            if (useInvlet && game.flags.fixinv !== false && letter !== '>') letter = object.invlet ?? letter;
        }
        const tab = game.iflags.menu_tab_sep;
        if (!price && letter !== '*') return `${letter} - ${text}${useInvlet ? '.' : ''}`;
        return `${letter} - ${tab ? text : (text ?? '').padEnd(45)}${tab ? '\t' : ' '}${String(price).padStart(6)} ${currency(price)}`;
    } finally {
        if (object && saved !== undefined) object.quan = saved;
        if (suppress === undefined) delete game.iflags.suppress_price;
        else game.iflags.suppress_price = suppress;
    }
}
