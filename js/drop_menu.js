// C do.c:doddrop(), menu_drop(), menudrop_split(); invent.c:ggetobj()/askchain().
import { ECMD_FAIL, ECMD_OK, ECMD_TIME, MENU_COMBINATION, MENU_FULL, MENU_TRADITIONAL, PARANOID_AUTOALL, SORTLOOT_INVLET } from './const.js';
import { chooseObjectCategories } from './container.js';
import { consumeHallucinatedMenuObjectGlyph, plineWithContinuation as pline } from './display.js';
import { game } from './gstate.js';
import { dropHeroObject } from './hero_drop.js';
import { inventoryItemDescription, selectInventoryObject } from './invent.js';
import { bypassObjectList, clearBypasses, nextUnbypassedObject } from './object_bypass.js';
import { LOADSTONE } from './object_data.js';
import { objectDescription } from './object_description.js';
import { OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { inventoryClassOrder, lootSortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { observeObjectForNaming } from './objnam.js';
import { objectQuantity, rejoinObjectStack, splitObjectStack } from './object_stack.js';
import { getLine, tty_yn_function } from './query.js';
import { SELL_DELIBERATE, SELL_NORMAL, setSellDisposition } from './shop_sell.js';
import { isWeldedPrimary } from './weapon_slots.js';
import { restoreMenuUnderlay, showMultiSelectWindow, snapshotMenuUnderlay } from './windows.js';
export async function dropMultipleObjects() {
    if (!game.inventory.length) {
        await pline('You have nothing to drop.');
        return ECMD_OK;
    }
    const inShop = !!game.u.ushops?.[0];
    if (inShop)
        setSellDisposition(SELL_DELIBERATE);
    try {
        const style = game.flags.menu_style ?? MENU_FULL;
        let matches = (_object) => true;
        if (style === MENU_TRADITIONAL || style === MENU_COMBINATION) {
            const selected = await traditionalDropCategories(style === MENU_COMBINATION);
            if (!selected)
                return ECMD_OK;
            matches = object => matchesCategories(object, selected.categories);
            if (selected.menu) {
                if (selected.all || !selected.categories.length)
                    matches = () => true;
            }
            else if (style === MENU_TRADITIONAL || selected.all) {
                const result = await dropTraditionally(selected);
                // doddrop() returns askchain()'s sum directly in traditional
                // mode; menu_drop() converts that sum into a command flag.
                if (style === MENU_TRADITIONAL)
                    return result;
                return result ? ECMD_TIME : ECMD_OK;
            }
            else if (!selected.categories.length
                && !((game.flags.paranoia_bits ?? 0) & PARANOID_AUTOALL)) {
                // C allow_category() rejects an empty combination-menu filter.
                return ECMD_OK;
            }
        }
        else if (style === MENU_FULL) {
            const categories = await dropCategories();
            matches = object => categories.matchers.some(match => match(object));
            if (categories.autoSelect)
                return await dropAllMatching(matches) ? ECMD_TIME : ECMD_OK;
            const picked = game.inventory.filter(object => object.pickup_prev);
            const single = picked.length === 1 ? picked[0] : null;
            if (categories.justPickedCount !== undefined && single)
                return await dropCount(single, categories.justPickedCount) ? ECMD_TIME : ECMD_OK;
        }
        const selected = await chooseDroppedObjects(game.inventory.filter(matches));
        if (!selected.length)
            return ECMD_OK;
        let dropped = false;
        bypassObjectList(game.inventory, true);
        try {
            for (const selection of selected) {
                const object = selection.value;
                if (!game.inventory.includes(object) || !object.bypass)
                    continue;
                dropped = await dropCount(object, selection.count) || dropped;
                if (game.program_state.gameover)
                    break;
            }
        }
        finally {
            bypassObjectList(game.inventory, false);
        }
        return dropped ? ECMD_TIME : ECMD_OK;
    }
    finally {
        if (inShop)
            setSellDisposition(SELL_NORMAL);
    }
}
async function dropCategories() {
    const underlay = snapshotMenuUnderlay();
    try {
        return await chooseObjectCategories('Drop what type of items?', game.inventory);
    }
    finally {
        restoreMenuUnderlay(underlay);
    }
}
async function chooseDroppedObjects(objects) {
    if (!objects.length)
        return [];
    const sorted = sortObjects(objects, { mode: lootSortMode({ inventoryLetters: true }) });
    // menu_drop() passes INVORDER_SORT even when sortpack is disabled.
    const sections = [...inventoryClassOrder(), 17].flatMap(oclass => {
        const members = sorted.filter(object => object.oclass === oclass);
        if (!members.length)
            return [];
        return [{ heading: objectClassHeading(oclass), items: members.map(object => {
                    observeObjectForNaming(object);
                    consumeHallucinatedMenuObjectGlyph(object);
                    return { key: object.invlet ?? '#', value: object,
                        groupAccelerator: OBJECT_CLASS_SYMBOLS[oclass] ?? '',
                        text: objectDescription(object, { withPrice: true }) };
                }) }];
    });
    const underlay = snapshotMenuUnderlay();
    try {
        return await showMultiSelectWindow({
            title: 'What would you like to drop?', sections, returnCounts: true,
        });
    }
    finally {
        restoreMenuUnderlay(underlay);
    }
}
async function dropAllMatching(matches) {
    let dropped = false;
    bypassObjectList(game.inventory, false);
    try {
        let object;
        while ((object = nextUnbypassedObject(game.inventory))) {
            if (matches(object))
                dropped = await dropHeroObject(object) || dropped;
            if (game.program_state.gameover)
                break;
        }
    }
    finally {
        bypassObjectList(game.inventory, false);
    }
    return dropped;
}
async function dropCount(object, count) {
    if (count > 0 && count < objectQuantity(object) && !isWeldedPrimary(object)) {
        if (object.otyp === LOADSTONE && object.cursed)
            object.corpsenm = count;
        else {
            const split = splitObjectStack(object, count);
            if (!split)
                throw new Error('Cannot split the selected drop quantity');
            object = split;
        }
    }
    return await dropHeroObject(object);
}
function bucCategory(object) {
    if (object.oclass === 12)
        return game.flags.goldX ? 'X' : 'U';
    if (game.urole?.key === 'priest')
        object.bknown = true;
    return !object.bknown ? 'X' : object.blessed ? 'B' : object.cursed ? 'C' : 'U';
}
function hasUnpaid(object) {
    return !!object.unpaid || !!object.contents?.some(hasUnpaid);
}
function matchesCategories(object, categories) {
    const classes = categories.filter((category) => typeof category === 'number');
    if (object.oclass === 12 && classes.length)
        return classes.includes(12);
    const statuses = categories.filter((category) => category === 'B' || category === 'U' || category === 'C' || category === 'X');
    return (!classes.length || classes.includes(object.oclass))
        && (!statuses.length || statuses.includes(bucCategory(object)))
        && (!categories.includes('u') || hasUnpaid(object))
        && (!categories.includes('P') || !!object.pickup_prev);
}
async function traditionalDropCategories(combo) {
    const classes = [...new Set(game.inventory.map(object => object.oclass))];
    const statuses = new Set(game.inventory.map(bucCategory));
    const extras = `${game.inventory.some(hasUnpaid) ? 'u' : ''}`
        + ['B', 'U', 'C', 'X'].filter(status => statuses.has(status)).join('')
        + `${game.inventory.some(object => object.pickup_prev) ? 'P' : ''}ai${combo ? '' : 'm'}`;
    let response;
    for (;;) {
        response = await getLine(`What kinds of thing do you want to drop? [${classes.map(oclass => OBJECT_CLASS_SYMBOLS[oclass]).join('')} ${extras}]`, (_character, key) => key >= 32 && key < 127);
        if (response === null)
            return null;
        if (!response.includes('i'))
            break;
        if ((await selectInventoryObject()).key === 27)
            return null;
    }
    const categories = [];
    let requireUnpaid = false;
    for (const character of response) {
        if (' aiAm'.includes(character))
            continue;
        if (character === 'u' || character === 'B' || character === 'U'
            || character === 'C' || character === 'X' || character === 'P') {
            categories.push(character);
            requireUnpaid = character === 'u';
            continue;
        }
        const oclass = OBJECT_CLASS_SYMBOLS.indexOf(character);
        if (oclass < 1)
            await pline(`You don't have any ${character}'s.`);
        else if (!categories.includes(oclass))
            categories.push(oclass);
    }
    return { categories, all: response.includes('a'), menu: response.includes('m'), requireUnpaid };
}
async function dropTraditionally(selection) {
    const sorted = sortObjects(game.inventory, { mode: SORTLOOT_INVLET });
    const classes = selection.categories.filter((category) => typeof category === 'number');
    const passes = classes.length ? classes : [null];
    let acceptAll = selection.all, result = ECMD_OK, questioned = false;
    try {
        for (const oclass of passes) {
            bypassObjectList(game.inventory, false);
            let object;
            let index = -1;
            while ((object = nextUnbypassedObject(game.inventory, game, sorted))) {
                index++;
                if ((oclass !== null && object.oclass !== oclass)
                    || (selection.requireUnpaid && !hasUnpaid(object))
                    || !matchesCategories(object, selection.categories))
                    continue;
                questioned = true;
                let answer = 'y', count = 0;
                if (!acceptAll) {
                    observeObjectForNaming(object);
                    const position = index - (sorted[0]?.oclass === 12 ? 1 : 0);
                    const letter = game.flags.fixinv !== false ? object.invlet
                        : object.oclass === 12 ? '$' : 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(position) || '#';
                    const response = await tty_yn_function(`${letter} - ${inventoryItemDescription(object)}?`, objectQuantity(object) < 2 ? 'ynaq' : 'yn#aq', 'n');
                    answer = response.answer;
                    count = Number(response.count);
                }
                if (answer === 'q')
                    return result;
                if (answer === 'n' || answer === '#' && !count)
                    continue;
                if (answer === 'a')
                    acceptAll = true;
                const original = object;
                if (answer === '#' && count < objectQuantity(object)
                    && !(object.otyp === LOADSTONE && object.cursed) && !isWeldedPrimary(object)) {
                    const split = splitObjectStack(object, count);
                    if (!split)
                        throw new Error('Cannot split the traditional drop quantity');
                    object = split;
                }
                const success = await dropHeroObject(object);
                if (!success && object !== original)
                    await rejoinObjectStack(original, object);
                result += success ? ECMD_TIME : ECMD_FAIL;
                if (game.program_state.gameover)
                    return result;
            }
        }
        await pline(questioned ? 'That was all.' : 'No applicable objects.');
        return result;
    }
    finally {
        clearBypasses();
    }
}
//# sourceMappingURL=drop_menu.js.map