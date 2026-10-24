// C pickup.c:query_classes(), simple_look(), allow_category().
import { PARANOID_AUTOALL } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { game } from './gstate.js';
import { selectInventoryObject } from './invent.js';
import { objectDescription } from './object_description.js';
import { OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { observeObjectForNaming } from './objnam.js';
import { getLine } from './query.js';
import { showDisclosureOverlay } from './windows.js';
export async function queryObjectClasses(action, objects) {
    const classes = [...new Set(objects.map(object => object.oclass))];
    if (!classes.length)
        return null;
    const inventory = objects === game.inventory;
    let letters = classes.map(oclass => OBJECT_CLASS_SYMBOLS[oclass]).join('');
    if (classes.length > 1)
        letters += ` aA${inventory ? 'i' : ':'}`;
    letters += 'm';
    if (objects.some(hasUnpaidContents))
        letters += 'u';
    const statuses = new Set(objects.map(object => {
        if (game.urole?.key === 'priest')
            object.bknown = object.oclass !== 12;
        return bucCategory(object);
    }));
    letters += ['B', 'U', 'C', 'X'].filter(status => statuses.has(status)).join('');
    if (objects.some(object => object.pickup_prev))
        letters += 'P';
    // Native filters survive ':' and 'i' while the answer itself is reset.
    const categories = [];
    let menuSeen = false;
    for (;;) {
        const response = await getLine(`What kinds of thing do you want to ${action}? [${letters}]`, (_character, key) => key >= 32 && key < 127);
        if (response === null)
            return null;
        const selected = [];
        let oneAtATime = false, everything = false, missing = false, filtered = false;
        let looked = false;
        for (const character of response) {
            if (character === ' ')
                continue;
            if (character === 'A')
                oneAtATime = true;
            else if (character === 'a')
                everything = true;
            else if (character === ':' || character === 'i') {
                if (character === 'i')
                    await selectInventoryObject();
                else {
                    await lookAtObjects(objects);
                    const container = objects[0]?.container;
                    if (container)
                        container.cknown = true;
                }
                looked = true;
                break;
            }
            else if (character === 'm')
                menuSeen = true;
            else if (isSpecialCategory(character)) {
                if (!categories.includes(character))
                    categories.push(character);
                filtered = true;
            }
            else {
                const oclass = OBJECT_CLASS_SYMBOLS.indexOf(character);
                if (letters.includes(character) && oclass > 0) {
                    selected.push(oclass);
                    if (!categories.includes(oclass))
                        categories.push(oclass);
                }
                else {
                    const where = action === 'pick up' ? 'here' : action === 'take out' ? 'inside' : '';
                    await pline(where ? `There are no ${character}'s ${where}.` : `You have no ${character}'s.`);
                    missing = true;
                }
            }
        }
        if (looked)
            continue;
        if (menuSeen)
            return { classes: selected, categories, oneAtATime, everything,
                menu: (everything || !selected.length) && !filtered ? 'all' : 'filtered' };
        if (!selected.length && (!everything || missing)) {
            oneAtATime = true;
            everything = false;
        }
        return { classes: selected, categories, oneAtATime, everything, menu: 'none' };
    }
}
export function matchesObjectCategories(object, selection) {
    const classes = selection.categories.filter((category) => typeof category === 'number');
    const statuses = selection.categories.filter((category) => category === 'B' || category === 'U' || category === 'C' || category === 'X');
    if (!selection.categories.length)
        return !!((game.flags.paranoia_bits ?? 0) & PARANOID_AUTOALL);
    // Explicit coin selection overrides the other filter groups.
    if (object.oclass === 12 && classes.length)
        return classes.includes(12);
    if (game.urole?.key === 'priest' && !object.bknown)
        object.bknown = true;
    return (!classes.length || classes.includes(object.oclass))
        && (!statuses.length || statuses.includes(bucCategory(object)))
        && (!selection.categories.includes('u') || hasUnpaidContents(object))
        && (!selection.categories.includes('P') || !!object.pickup_prev);
}
export function hasBucCategory(selection) {
    return selection.categories.some(category => typeof category === 'string' && 'BUCX'.includes(category));
}
function isSpecialCategory(character) {
    return character === 'u' || character === 'P' || character === 'B'
        || character === 'U' || character === 'C' || character === 'X';
}
function bucCategory(object) {
    if (object.oclass === 12)
        return game.flags.goldX ? 'X' : 'U';
    return !object.bknown ? 'X' : object.blessed ? 'B' : object.cursed ? 'C' : 'U';
}
async function lookAtObjects(objects) {
    const first = objects[0];
    if (!first)
        return;
    if (objects.length === 1) {
        observeObjectForNaming(first);
        await pline(await objectDescription(first));
        return;
    }
    const lines = [''];
    for (const object of objects) {
        observeObjectForNaming(object);
        lines.push(await objectDescription(object));
    }
    await showDisclosureOverlay(lines, { restoreUnderlay: true });
}
function hasUnpaidContents(object) {
    return !!object.unpaid || !!object.contents?.some(hasUnpaidContents);
}
//# sourceMappingURL=object_class_query.js.map