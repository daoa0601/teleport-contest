// Inventory selection shared by commands which use NetHack's getobj flow.
// C ref: invent.c getobj().
import { clearMessageWindow, flushPendingTopline, flush_screen, pline } from './display.js';
import { game } from './gstate.js';
import { heroGoldAmount } from './hero_gold.js';
import { selectInventoryObject } from './invent.js';
import { clearCommandKeys, nhgetch, takeCommandKey } from './input.js';
import { promptKey } from './tty_prompts.js';
import { rn2 } from './rng.js';
import { GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_INACCESS, GETOBJ_SUGGEST } from './const.js';
import { AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, LOADSTONE } from './object_data.js';
import { splitObjectStack } from './object_stack.js';
import { isWeldedPrimary } from './weapon_slots.js';
import { rememberObjectChoice, takeRepeatCommand } from './command_repeat.js';
// C getobj(): suggestions control the prompt and '?' subset, not what a
// typed inventory letter or '*' may select. Downplayed items keep a command
// available even when nothing is suggested.
export async function chooseInventoryObject(verb, classify, { forcePrompt = false, emptyMessage, allowCount = false, } = {}) {
    const queuedKey = takeCommandKey();
    if (queuedKey !== undefined) {
        const object = game.inventory.find(candidate => candidate.invlet === String.fromCharCode(queuedKey)
            && [GETOBJ_SUGGEST, GETOBJ_DOWNPLAY].includes(classify(candidate)));
        if (!object)
            clearCommandKeys();
        return object ?? null;
    }
    if (game.flags?.fixinv === false)
        reassignInventoryLetters();
    const inventory = [...(game.inventory || [])]
        .sort((left, right) => inventoryLetterOrder(left.invlet) - inventoryLetterOrder(right.invlet));
    const suggested = inventory.filter(object => classify(object) === GETOBJ_SUGGEST);
    const downplayed = inventory.filter(object => classify(object) === GETOBJ_DOWNPLAY);
    if (!suggested.length && !downplayed.length && !forcePrompt) {
        const inaccessible = inventory.some(object => classify(object) === GETOBJ_EXCLUDE_INACCESS);
        await pline(emptyMessage ?? `You don't have anything ${inaccessible ? 'else ' : ''}to ${verb}.`);
        return null;
    }
    const letters = compactInventoryLetters(suggested.map(object => object.invlet).join(''));
    const choices = letters ? `${letters} or ?*` : '*';
    const menuItems = suggested.length ? suggested : downplayed.length ? downplayed : inventory;
    const selection = await promptInventoryObject(`What do you want to ${verb}? [${choices}] `, inventory, {
        verb, classify, allowCount,
        allowMenu: true,
        allowGold: inventory.some(object => object.oclass === 12), menuItems,
    });
    const object = selection.object;
    if (object && selection.count !== null && selection.count < object.quan) {
        if (object.otyp === LOADSTONE && object.cursed)
            object.corpsenm = selection.count;
        // C splittable() calls welded(), revealing the curse before refusing
        // the split. A cursed loadstone returns before that weapon check.
        else if (isWeldedPrimary(object))
            object.bknown = true;
        else
            return splitObjectStack(object, selection.count, game);
    }
    return object;
}
// C invent.c:mime_action(): '-' without a hands option is an action mime.
async function mimeInventoryAction(verb) {
    let action = verb, prefix = '', suffix = '';
    const onStone = action.indexOf(' on the ');
    if (onStone >= 0) {
        suffix = action.slice(onStone + 1);
        action = action.slice(0, onStone);
    }
    if (action.startsWith('rub the ') && action.includes(' on')
        || action.startsWith('dip ') && action.includes(' into')) {
        prefix = action.slice(4);
        action = action.slice(0, 3);
    }
    const alternatives = action.split(' or ');
    if (alternatives.length > 1) {
        const chosen = alternatives[rn2(2) ? 0 : 1];
        if (chosen === undefined)
            throw new Error('The action alternative is missing');
        action = chosen;
    }
    await pline(`You mime ${gerund(action)}${prefix ? ' ' + prefix : ''} something${suffix ? ' ' + suffix : ''}.`);
}
// C hacklib.c:ing_suffix(), including compound verbs such as "put on".
function gerund(verb) {
    const particle = verb.match(/ (?:on|off|with)$/i)?.[0] || '';
    let stem = particle ? verb.slice(0, -particle.length) : verb;
    if (!/er$/i.test(stem)) {
        if (/[^aeiouwy][aeiouwy][^aeiouwy]$/.test(stem))
            stem += stem.at(-1);
        else if (/ie$/i.test(stem))
            stem = stem.slice(0, -2) + 'y';
        else if (stem.endsWith('e'))
            stem = stem.slice(0, -1);
    }
    return stem + 'ing' + particle;
}
export function reassignInventoryLetters() {
    const goldIndex = game.inventory.findIndex(object => object.oclass === 12);
    if (goldIndex >= 0) {
        const gold = game.inventory[goldIndex];
        if (!gold)
            throw new Error('The gold inventory entry is missing');
        game.inventory.splice(goldIndex, 1);
        gold.invlet = '$';
        game.inventory.unshift(gold);
    }
    let index = 0;
    for (const object of game.inventory) {
        if (object.oclass === 12)
            continue;
        object.invlet = index < 26 ? String.fromCharCode(97 + index)
            : index < 52 ? String.fromCharCode(65 + index - 26) : '#';
        index++;
    }
    game._lastInvNr = Math.min(index, 51);
}
// C invent.c invletter_value(): '$' first, then a-z, then A-Z, then other.
export function inventoryLetterOrder(letter) {
    if (letter == null)
        return 53;
    if (letter === '$')
        return 0;
    if (letter >= 'a' && letter <= 'z')
        return letter.charCodeAt(0) - 96;
    if (letter >= 'A' && letter <= 'Z')
        return letter.charCodeAt(0) - 38;
    return 53;
}
export function compactInventoryLetters(letters) {
    if (letters.length <= 5)
        return letters;
    let compact = '';
    for (let start = 0; start < letters.length;) {
        let end = start;
        while (end + 1 < letters.length
            && letters.charCodeAt(end + 1) === letters.charCodeAt(end) + 1) {
            end++;
        }
        const length = end - start + 1;
        compact += length >= 3
            ? `${letters[start]}-${letters[end]}`
            : letters.slice(start, end + 1);
        start = end + 1;
    }
    return compact;
}
export async function promptInventoryObject(prompt, eligible, { verb, allowGold = false, classify = object => eligible.includes(object) || allowGold && object.oclass === 12
    ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE, allowNone = false, noneDescription, noneSuggested = allowNone, allowMenu = false, allowCount = false, menuItems = eligible, }) {
    let repeated = takeRepeatCommand();
    let repeatedCount = null;
    if (repeated?.kind === 'count') {
        if (!allowCount)
            return { cancelled: true, object: null, gold: false, none: false, count: null };
        repeatedCount = repeated.count;
        repeated = takeRepeatCommand();
        if (!repeated)
            return { cancelled: true, object: null, gold: false, none: false, count: null };
    }
    if (repeated) {
        if (repeated.kind !== 'key')
            return { cancelled: true, object: null, gold: false, none: false, count: null };
        const letter = String.fromCharCode(repeated.key);
        const object = game.inventory.find(candidate => candidate.invlet === letter
            && [GETOBJ_SUGGEST, GETOBJ_DOWNPLAY].includes(classify(candidate)));
        if (object)
            return {
                cancelled: false, object, gold: false, none: false,
                count: repeatedCount !== null && repeatedCount > 0 && repeatedCount < object.quan
                    ? repeatedCount : null,
            };
        if (allowNone && letter === '-')
            return { cancelled: false, object: null, gold: false, none: true, count: null };
        return { cancelled: true, object: null, gold: false, none: false, count: null };
    }
    // getobj() checks CQ_CANNED before invoking tty_yn_function(). A queued
    // choice neither acknowledges unread prose nor paints an item question.
    const queuedKey = takeCommandKey();
    if (queuedKey !== undefined) {
        const letter = String.fromCharCode(queuedKey);
        const object = game.inventory.find(candidate => candidate.invlet === letter
            && [GETOBJ_SUGGEST, GETOBJ_DOWNPLAY].includes(classify(candidate)));
        if (object)
            return { cancelled: false, object, gold: false, none: false, count: null };
        if (allowNone && letter === '-')
            return { cancelled: false, object: null, gold: false, none: true, count: null };
        if (allowGold && letter === '$' && heroGoldAmount(game) > 0)
            return { cancelled: false, object: null, gold: true, none: false, count: null };
        clearCommandKeys();
        return { cancelled: true, object: null, gold: false, none: false, count: null };
    }
    const forcedMenu = allowMenu && game.flags.force_invmenu;
    let key = forcedMenu ? menuItems.length ? 63 : 42 : await askInventoryPrompt(prompt);
    let count = null;
    for (;;) {
        if (!allowCount && key >= 48 && key <= 57) {
            await pline('No count allowed with this command.');
            key = await askInventoryPrompt(prompt);
            continue;
        }
        if (allowCount && key >= 48 && key <= 57) {
            const counted = await readInventoryCount(key);
            key = counted.key;
            count = counted.count || null;
        }
        const cancelled = [27, 32, 10, 13].includes(key);
        if (cancelled) {
            // C getobj(): a silent cancellation leaves the question painted.
            if (game.flags?.verbose !== false) {
                game._pending_message = '';
                game._retained_message = '';
                await pline('Never mind.');
            }
            return {
                cancelled: true,
                object: null,
                gold: false,
                none: false,
                count: null,
            };
        }
        if (allowMenu && (key === 63 || key === 42)) {
            const extraChoice = allowNone && (key === 42 || noneSuggested || menuItems.length === 0)
                ? noneDescription : undefined;
            const selection = await selectInventoryObject({
                ...(key === 63 ? { items: menuItems } : {}),
                ...(forcedMenu ? {
                    title: `What do you want to ${verb}?`,
                    menuOptions: key === 42
                        ? [{ key: '?', text: '(list likely candidates)' }]
                        : menuItems.length < eligible.length || (allowNone && !extraChoice)
                            ? [{ key: '*', text: '(list everything)' }] : [],
                } : {}),
                ...(extraChoice ? { extraChoice } : {}),
            });
            key = selection.key;
            if (key === 0) {
                if (forcedMenu)
                    return { cancelled: true, object: null, gold: false, none: false, count: null };
                count = null;
                key = await askInventoryPrompt(prompt);
                continue;
            }
            // The native singleton returns count -1 (all), which does not
            // replace a count already entered before '?'.
            if (allowCount && selection.count !== null)
                count = selection.count;
            continue;
        }
        // C tty_yn_function() marks an answered prompt as already read.
        // A one-line query stays painted through a silent action. Wrapped
        // queries have already been erased by promptKey()'s tty cleanup.
        game._pending_message = '';
        const letter = String.fromCharCode(key);
        if (letter === '-') {
            if (!allowNone)
                await mimeInventoryAction(verb);
            return allowNone ? { cancelled: false, object: null, gold: false, none: true, count }
                : { cancelled: true, object: null, gold: false, none: false, count: null };
        }
        const object = game.inventory.find(candidate => candidate.invlet === letter);
        if (!object && count !== null && verb === 'throw')
            return { cancelled: true, object: null, gold: false, none: false, count: null };
        if (object) {
            const classification = classify(object);
            // Interactive getobj() requests status even for non-gold items;
            // its gold rejection and canned/hands choices return earlier.
            if (object.oclass !== 12 || classification !== GETOBJ_EXCLUDE)
                game.context.botl = true;
            if (classification === GETOBJ_EXCLUDE) {
                await pline(object.oclass === 12 ? `You cannot ${verb} gold.`
                    : verb === 'call' && (object.otyp === AMULET_OF_YENDOR
                        || object.otyp === FAKE_AMULET_OF_YENDOR && !object.known)
                        ? "The Amulet doesn't like being called names."
                        : `That is a silly thing to ${verb}.`);
                return { cancelled: true, object: null, gold: false, none: false, count: null };
            }
            if (count === 0) {
                return {
                    cancelled: true, object: null, gold: false,
                    none: false, count: 0,
                };
            }
            const quantity = object.quantity ?? object.quan ?? 1;
            if (count !== null && verb === 'throw' && count > 1
                && (object.oclass !== 12 || count > quantity)) {
                await pline(count > quantity ? `You only have ${quantity}${object.oclass !== 12 && quantity > 1 ? ' and can only throw one at a time' : ''}.`
                    : 'You can only throw one at a time.');
                // C getobj() keeps the selected letter after the first forced
                // menu, so its retry uses that object without the rejected count.
                if (forcedMenu)
                    return { cancelled: false, object, gold: false, none: false, count: null };
                key = await askInventoryPrompt(prompt);
                count = null;
                continue;
            }
            rememberObjectChoice(key, count);
            if (count !== null && count > quantity) {
                await pline(`You don't have that many!  You have only ${quantity}.`);
                // C getobj() keeps the forced-menu letter and drops the count.
                if (forcedMenu)
                    return { cancelled: false, object, gold: false, none: false, count: null };
                key = await askInventoryPrompt(prompt);
                count = null;
                continue;
            }
            return {
                cancelled: false,
                object,
                gold: false,
                none: false,
                count,
            };
        }
        if (allowGold && letter === '$' && heroGoldAmount(game) > 0) {
            game.context.botl = true;
            return {
                cancelled: false,
                object: null,
                gold: true,
                none: false,
                count,
            };
        }
        game.context.botl = true;
        await pline("You don't have that object.");
        key = await askInventoryPrompt(prompt);
        count = null;
    }
}
// C cmd.c:get_count(): only a positive typed count is passed on by getobj.
// Backspace edits the count; a second digit makes the count visible.
async function readInventoryCount(firstKey) {
    let count = 0, key = firstKey, backspaced = false;
    for (;;) {
        let showZero = false;
        if (key >= 48 && key <= 57) {
            count = Math.min(0x7fffffff, count * 10 + key - 48);
            showZero = key === 48;
        }
        else if (key === 8 || key === 127) {
            if (!count)
                return { key, count: 0 };
            count = Math.trunc(count / 10);
            backspaced = true;
        }
        else
            return { key, count: key === 27 ? 0 : count };
        if (count > 9 || backspaced) {
            const text = backspaced && !count && !showZero ? 'Count: ' : `Count: ${count}`;
            if (count || showZero)
                backspaced = false;
            clearMessageWindow();
            await pline(text);
            await flush_screen(0);
            game.nhDisplay?.setCursor(text.length, 0);
        }
        key = await nhgetch();
    }
}
// C getobj() uses tty_yn_function(), which acknowledges unread prose before
// replacing the topline with its object question, including on a retry.
async function askInventoryPrompt(prompt) {
    await flushPendingTopline();
    return promptKey(prompt);
}
//# sourceMappingURL=inventory_prompt.js.map