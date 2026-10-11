// Inventory selection shared by commands which use NetHack's getobj flow.
// C ref: invent.c getobj().

import { flushPendingTopline, pline } from './display.js';
import { game } from './gstate.js';
import { heroGoldAmount } from './hero_gold.js';
import { selectInventoryObject } from './invent.js';
import { nhgetch } from './input.js';
import { promptKey } from './tty_prompts.js';
import { rn2 } from './rng.js';
import { GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST } from './const.js';
import type { GameObject } from './object_types.js';

export type InventoryClassification = 0 | 1 | 2 | 3 | 4 | 5;

export interface InventoryPromptOptions {
    allowGold?: boolean;
    allowNone?: boolean;
    noneDescription?: string;
    noneSuggested?: boolean;
    allowMenu?: boolean;
    allowCount?: boolean;
    retainPromptOnCancel?: boolean;
    menuItems?: readonly GameObject[];
}

export type InventoryObjectSelection = {
    cancelled: true;
    object: null;
    gold: false;
    none: false;
    count: 0 | null;
} | {
    cancelled: false;
    object: GameObject;
    gold: false;
    none: false;
    count: number | null;
} | {
    cancelled: false;
    object: null;
    gold: false;
    none: true;
    count: number | null;
} | {
    cancelled: false;
    object: null;
    gold: true;
    none: false;
    count: number | null;
};

// C getobj(): suggestions control the prompt and '?' subset, not what a
// typed inventory letter or '*' may select. Downplayed items keep a command
// available even when nothing is suggested.
export async function chooseInventoryObject(verb: string, classify: (object: GameObject) => InventoryClassification, {
    forcePrompt = false, emptyMessage = `You don't have anything to ${verb}.`,
}: { forcePrompt?: boolean; emptyMessage?: string } = {}): Promise<GameObject | null> {
    if (game.flags?.fixinv === false) reassignInventoryLetters();
    const inventory = [...(game.inventory || [])]
        .sort((left, right) => inventoryLetterOrder(left.invlet) - inventoryLetterOrder(right.invlet));
    const suggested = inventory.filter(object => classify(object) === GETOBJ_SUGGEST);
    const downplayed = inventory.filter(object => classify(object) === GETOBJ_DOWNPLAY);
    if (!suggested.length && !downplayed.length && !forcePrompt) {
        await pline(emptyMessage);
        return null;
    }
    const letters = compactInventoryLetters(suggested.map(object => object.invlet).join(''));
    const choices = letters ? `${letters} or ?*` : '*';
    const menuItems = suggested.length ? suggested : downplayed.length ? downplayed : inventory;
    let object;
    if (game.flags?.force_invmenu) {
        object = await chooseFromInventoryMenu(verb, inventory, menuItems);
    } else {
        const selection = await promptInventoryObject(
            `What do you want to ${verb}? [${choices}] `, inventory, {
                allowMenu: true, allowNone: true,
                allowGold: inventory.some(object => object.oclass === 12), menuItems,
            });
        if (selection.none) {
            await mimeInventoryAction(verb);
            return null;
        }
        object = selection.object;
    }
    if (object && classify(object) === GETOBJ_EXCLUDE) {
        await pline(object.oclass === 12 ? `You cannot ${verb} gold.`
            : `That is a silly thing to ${verb}.`);
        return null;
    }
    return object;
}

// C invent.c:mime_action(): '-' without a hands option is an action mime.
async function mimeInventoryAction(verb: string): Promise<void> {
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
        if (chosen === undefined) throw new Error('The action alternative is missing');
        action = chosen;
    }
    await pline(`You mime ${gerund(action)}${prefix ? ' ' + prefix : ''} something${suffix ? ' ' + suffix : ''}.`);
}

// C hacklib.c:ing_suffix(), including compound verbs such as "put on".
function gerund(verb: string): string {
    const particle = verb.match(/ (?:on|off|with)$/i)?.[0] || '';
    let stem = particle ? verb.slice(0, -particle.length) : verb;
    if (!/er$/i.test(stem)) {
        if (/[^aeiouwy][aeiouwy][^aeiouwy]$/.test(stem)) stem += stem.at(-1);
        else if (/ie$/i.test(stem)) stem = stem.slice(0, -2) + 'y';
        else if (stem.endsWith('e')) stem = stem.slice(0, -1);
    }
    return stem + 'ing' + particle;
}

export function reassignInventoryLetters() {
    const goldIndex = game.inventory.findIndex(object => object.oclass === 12);
    if (goldIndex >= 0) {
        const gold = game.inventory[goldIndex];
        if (!gold) throw new Error('The gold inventory entry is missing');
        game.inventory.splice(goldIndex, 1);
        gold.invlet = '$';
        game.inventory.unshift(gold);
    }
    let index = 0;
    for (const object of game.inventory) {
        if (object.oclass === 12) continue;
        object.invlet = index < 26 ? String.fromCharCode(97 + index)
            : index < 52 ? String.fromCharCode(65 + index - 26) : '#';
        index++;
    }
    game._lastInvNr = Math.min(index, 51);
}

async function chooseFromInventoryMenu(verb: string, inventory: readonly GameObject[], suggestions: readonly GameObject[]): Promise<GameObject | null> {
    let showAll = false;
    for (;;) {
        const items = showAll ? inventory : suggestions;
        const menuOptions = showAll
            ? [{ key: '?', text: '(list likely candidates)' }]
            : items.length < inventory.length ? [{ key: '*', text: '(list everything)' }] : [];
        const { key } = await selectInventoryObject({
            items, includeGold: items.some(object => object.oclass === 12),
            title: `What do you want to ${verb}?`, menuOptions,
        });
        if (key === 42 || key === 63) {
            showAll = key === 42;
            continue;
        }
        if (key === 27 && game.flags?.verbose !== false) await pline('Never mind.');
        return items.find(object => object.invlet === String.fromCharCode(key)) || null;
    }
}

// C invent.c invletter_value(): '$' first, then a-z, then A-Z, then other.
export function inventoryLetterOrder(letter: string | null | undefined): number {
    if (letter == null) return 53;
    if (letter === '$') return 0;
    if (letter >= 'a' && letter <= 'z') return letter.charCodeAt(0) - 96;
    if (letter >= 'A' && letter <= 'Z') return letter.charCodeAt(0) - 38;
    return 53;
}

export function compactInventoryLetters(letters: string): string {
    if (letters.length <= 5) return letters;
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

export async function promptInventoryObject(prompt: string, eligible: readonly GameObject[], {
    allowGold = false,
    allowNone = false,
    noneDescription,
    noneSuggested = allowNone,
    allowMenu = false,
    allowCount = false,
    retainPromptOnCancel = false,
    menuItems = eligible,
}: InventoryPromptOptions = {}): Promise<InventoryObjectSelection> {
    let key = await askInventoryPrompt(prompt);
    let count: number | null = null;
    for (;;) {
        if (!allowCount && key >= 48 && key <= 57) {
            await pline('No count allowed with this command.');
            key = await askInventoryPrompt(prompt);
            continue;
        }
        if (allowCount && key >= 48 && key <= 57) {
            let digits = '';
            do {
                digits += String.fromCharCode(key);
                key = await nhgetch();
            } while (key >= 48 && key <= 57);
            count = Number.parseInt(digits, 10);
        }
        const cancelled = [27, 32, 10, 13].includes(key);
        if (cancelled) {
            if (!retainPromptOnCancel) {
                game._pending_message = '';
                game._retained_message = '';
            }
            if (!retainPromptOnCancel && game.flags?.verbose !== false) await pline('Never mind.');
            return {
                cancelled: true,
                object: null,
                gold: false,
                none: false,
                count: null,
            };
        }
        if (allowMenu && (key === 63 || key === 42)) {
            const selection = await selectInventoryObject({
                ...(key === 63 ? { items: menuItems } : {}),
                ...(allowNone && noneDescription
                    && (key === 42 || noneSuggested || menuItems.length === 0)
                    ? { extraChoice: noneDescription } : {}),
            });
            key = selection.key;
            if (key === 0) {
                key = await askInventoryPrompt(prompt);
                continue;
            }
            // The native singleton returns count -1 (all), which does not
            // replace a count already entered before '?'.
            if (allowCount && selection.count !== null) count = selection.count;
            continue;
        }
        // C tty_yn_function() marks an answered prompt as already read.
        // The command's result must not pause to acknowledge it again.
        game._pending_message = '';
        game._retained_message = '';
        const letter = String.fromCharCode(key);
        const object = eligible.find(candidate => candidate.invlet === letter);
        if (object) {
            if (count === 0) {
                return {
                    cancelled: true, object: null, gold: false,
                    none: false, count: 0,
                };
            }
            const quantity = object.quantity ?? object.quan ?? 1;
            if (count !== null && count > quantity) {
                await pline(
                    `You don't have that many!  You have only ${quantity}.`,
                );
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
        if (allowNone && letter === '-') {
            return {
                cancelled: false,
                object: null,
                gold: false,
                none: true,
                count,
            };
        }
        if (allowGold && letter === '$' && heroGoldAmount(game) > 0) {
            return {
                cancelled: false,
                object: null,
                gold: true,
                none: false,
                count,
            };
        }

        await pline("You don't have that object.");
        key = await askInventoryPrompt(prompt);
        count = null;
    }
}

// C getobj() uses tty_yn_function(), which acknowledges unread prose before
// replacing the topline with its object question, including on a retry.
async function askInventoryPrompt(prompt: string): Promise<number> {
    await flushPendingTopline();
    return promptKey(prompt);
}
