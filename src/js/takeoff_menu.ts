// C do_wear.c:menu_remarm(); pickup.c:query_category()/allow_category();
// invent.c:ggetobj()/askchain(). The window API owns rendering and input.
import { MENU_COMBINATION, MENU_FULL, MENU_TRADITIONAL, SORTLOOT_INVLET } from './const.js';
import {
    consumeHallucinatedMenuObjectGlyph,
    plineWithContinuation as pline,
} from './display.js';
import { game } from './gstate.js';
import { inventoryItemDescription, selectInventoryObject } from './invent.js';
import { objectDescription } from './object_description.js';
import { OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { observeObjectForNaming } from './objnam.js';
import { inventoryClassOrder, inventorySortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { getLine, promptYesNoAllQuit } from './query.js';
import { restoreMenuUnderlay, showMultiSelectWindow, snapshotMenuUnderlay } from './windows.js';
import type { MenuUnderlay } from './windows.js';
import type { MultiSelectItem, MultiSelectSection } from './windows.js';
import type { GameObject } from './object_types.js';
import { TAKEOFF_ORDER, takeoffSlotObject } from './takeoff_state.js';

type Category = number | 'all' | 'u' | 'B' | 'C' | 'U' | 'X' | 'P';
type BucCategory = 'B' | 'C' | 'U' | 'X';
type SelectOff = (object: GameObject) => Promise<void>;

export async function selectBulkTakeoff(selectOff: SelectOff): Promise<void> {
    const style = game.flags.menu_style ?? MENU_FULL;
    let categories: Category[] = ['all'];
    if (style === MENU_TRADITIONAL || style === MENU_COMBINATION) {
        const choice = await traditionalCategories(style === MENU_COMBINATION, selectOff);
        if (choice === null) return;
        categories = choice;
        if (style === MENU_COMBINATION && !categories.length) return;
    } else if (style === MENU_FULL) {
        categories = await categoryMenu();
        if (!categories.length) return;
    }
    const worn = wornInventory().filter(object => matchesCategories(object, categories));
    if (!worn.length) {
        if (style !== MENU_COMBINATION)
            await pline('There is nothing else you can remove or unwield.');
        return;
    }
    const sorted = sortObjects(worn, { mode: inventorySortMode() });
    const sections: MultiSelectSection<GameObject>[] = inventoryClassOrder().flatMap(oclass => {
        const objects = sorted.filter(object => object.oclass === oclass);
        if (!objects.length) return [];
        const items = objects.map(object => {
            observeObjectForNaming(object);
            consumeHallucinatedMenuObjectGlyph(object);
            return {
                key: object.invlet ?? '#',
                text: objectDescription(object, { withPrice: true }),
                value: object,
            };
        });
        return [{ heading: objectClassHeading(oclass), items }];
    });
    const underlay = snapshotMenuUnderlay();
    const selected = await showMultiSelectWindow({
        title: 'What do you want to take off?', sections, returnCounts: true,
    });
    restoreMap(underlay);
    for (const selection of selected) await selectOff(selection.value);
}

function wornInventory(): GameObject[] {
    return game.inventory.filter(object => TAKEOFF_ORDER.some(slot => takeoffSlotObject(slot) === object));
}

function bucCategory(object: GameObject): BucCategory {
    if (object.oclass === 12) return game.flags.goldX ? 'X' : 'U';
    return !object.bknown ? 'X' : object.blessed ? 'B' : object.cursed ? 'C' : 'U';
}

function wornBucCategories(worn: readonly GameObject[]): Set<BucCategory> {
    // Native count_buc() grants priest knowledge before applying is_worn().
    if (game.urole?.key === 'priest')
        for (const object of game.inventory) object.bknown = object.oclass !== 12;
    return new Set(worn.map(bucCategory));
}

function hasUnpaid(object: GameObject): boolean {
    return !!object.unpaid || (object.contents || []).some(hasUnpaid);
}

function matchesCategories(object: GameObject, categories: readonly Category[]): boolean {
    const classes = categories.filter(category => typeof category === 'number');
    const statuses = categories.filter(category => category === 'B' || category === 'C' || category === 'U' || category === 'X');
    const filters = categories.includes('u') || statuses.length > 0 || categories.includes('P');
    if (categories.includes('all') && !filters) return true;
    if (object.oclass === 12 && classes.length > 0) return classes.includes(12);
    return (!classes.length || classes.includes(object.oclass))
        && (!categories.includes('u') || hasUnpaid(object))
        && (!statuses.length || statuses.includes(bucCategory(object)))
        && (!categories.includes('P') || !!object.pickup_prev);
}

async function categoryMenu(): Promise<Category[]> {
    const worn = wornInventory();
    const classes = inventoryClassOrder().filter(oclass => worn.some(object => object.oclass === oclass));
    const statuses = wornBucCategories(worn);
    const unpaid = game.inventory.some(hasUnpaid);
    if (classes.length === 1 && !unpaid && statuses.size <= 1) {
        const only = classes[0];
        return only === undefined ? [] : [only];
    }
    const items: MultiSelectItem<Category>[] = [];
    let letter = 97;
    if (classes.length > 1) {
        items.push({ key: 'a', text: 'All worn and wielded types', value: 'all' });
        letter++;
    }
    for (const oclass of classes) items.push({
        key: String.fromCharCode(letter++), groupAccelerator: OBJECT_CLASS_SYMBOLS[oclass] ?? '',
        text: objectClassHeading(oclass), value: oclass,
    });
    if (unpaid || statuses.size) items.push({ text: '', selectable: false });
    if (unpaid) items.push({ key: 'u', text: 'Unpaid items', value: 'u' });
    for (const status of ['B', 'C', 'U', 'X'] as const) {
        if (statuses.has(status)) items.push({
            key: status, value: status, text: status === 'X'
                ? 'Items of unknown Bless/Curse status'
                : `Items known to be ${status === 'B' ? 'Blessed' : status === 'C' ? 'Cursed' : 'Uncursed'}`,
        });
    }
    const underlay = snapshotMenuUnderlay();
    const selected = await showMultiSelectWindow({
        title: 'What type of things do you want to take off?',
        sections: [{ items }], omitHeadings: true,
    });
    restoreMap(underlay);
    return selected;
}

async function traditionalCategories(combo: boolean, selectOff: SelectOff): Promise<Category[] | null> {
    const worn = wornInventory();
    const classes = [...new Set(worn.map(object => object.oclass))];
    const statuses = wornBucCategories(worn);
    const promptClasses = classes.map(oclass => OBJECT_CLASS_SYMBOLS[oclass]).join('');
    const unpaid = game.inventory.some(hasUnpaid);
    const picked = game.inventory.some(object => object.pickup_prev);
    const extras = `${unpaid ? 'u' : ''}${statuses.has('B') ? 'B' : ''}${statuses.has('U') ? 'U' : ''}`
        + `${statuses.has('C') ? 'C' : ''}${statuses.has('X') ? 'X' : ''}${picked ? 'P' : ''}ai${combo ? '' : 'm'}`;
    let response: string | null;
    for (;;) {
        response = await getLine(`What kinds of thing do you want to take off? [${promptClasses} ${extras}]`,
            (_character, key) => key >= 32 && key < 127);
        if (response === null) return null;
        if (!response.includes('i')) break;
        const underlay = snapshotMenuUnderlay();
        const inventory = await selectInventoryObject({ items: worn });
        restoreMap(underlay);
        if (inventory.key === 27) return null;
    }
    const categories: Category[] = [];
    const classChoices: number[] = [];
    const all = response.includes('a');
    const menu = response.includes('m');
    for (const character of response) {
        if (' aiAm'.includes(character)) continue;
        if (character === 'u' || character === 'B' || character === 'C'
            || character === 'U' || character === 'X' || character === 'P') {
            categories.push(character);
            continue;
        }
        const oclass = OBJECT_CLASS_SYMBOLS.indexOf(character);
        if (oclass < 1) {
            await pline(`You don't have any ${character}'s.`);
            continue;
        }
        const slottedClass = (['uwep', 'uswapwep', 'uquiver'] as const).some(slot =>
            takeoffSlotObject(slot)?.oclass === oclass);
        if (!slottedClass && ![2, 3, 4, 5, 6].includes(oclass)) {
            await pline('Not applicable.');
            return null;
        }
        if (!classes.includes(oclass)) {
            await pline(oclass === 2 ? 'You are not wielding anything.'
                : oclass === 3 ? 'You are not wearing any armor.'
                    : oclass === 4 ? 'You are not wearing rings.'
                        : oclass === 5 ? 'You are not wearing an amulet.'
                            : 'You are not wearing a blindfold.');
            return null;
        }
        if (!classChoices.includes(oclass)) {
            classChoices.push(oclass);
            categories.push(oclass);
        }
    }
    if (menu) return all ? ['all', ...categories] : categories.length ? categories : ['all'];
    if (combo && !all) return categories;
    let acceptAll = all;
    let questioned = false;
    const sorted = sortObjects(game.inventory, { mode: SORTLOOT_INVLET });
    const passes = classChoices.length ? classChoices : [null];
    for (const oclass of passes) for (const [index, object] of sorted.entries()) {
        if (!worn.includes(object) || (oclass !== null && object.oclass !== oclass)
            || !matchesCategories(object, categories)) continue;
        questioned = true;
        observeObjectForNaming(object);
        const position = index - (sorted[0]?.oclass === 12 ? 1 : 0);
        const letter = game.flags.fixinv !== false ? object.invlet
            : object.oclass === 12 ? '$' : 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(position) || '#';
        const answer = acceptAll ? 'y' : await promptYesNoAllQuit(
            `${letter} - ${inventoryItemDescription(object)}? [ynaq] (n) `, 'n');
        if (answer === 'q') return null;
        if (answer === 'n') continue;
        if (answer === 'a') acceptAll = true;
        await selectOff(object);
    }
    if (!questioned) await pline('No applicable objects.');
    return null;
}

function restoreMap(underlay: MenuUnderlay | null): void {
    game._pending_message = '';
    game._retained_message = '';
    restoreMenuUnderlay(underlay);
}
