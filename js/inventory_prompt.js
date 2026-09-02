// Inventory selection shared by commands which use NetHack's getobj flow.
// C ref: invent.c getobj().

import { flush_screen, pline } from './display.js';
import { game } from './gstate.js';
import { heroGoldAmount } from './hero_gold.js';
import { selectInventoryObject } from './invent.js';
import { nhgetch } from './input.js';
import { promptKey } from './tty_prompts.js';

export function compactInventoryLetters(letters) {
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

export async function promptInventoryObject(prompt, eligible, {
    allowGold = false,
    allowNone = false,
    allowMenu = false,
    allowCount = false,
    retainPromptOnCancel = false,
} = {}) {
    let key = await promptKey(prompt);
    let count = null;
    for (;;) {
        if (allowCount && key >= 48 && key <= 57) {
            let digits = '';
            do {
                digits += String.fromCharCode(key);
                key = await nhgetch();
            } while (key >= 48 && key <= 57);
            const parsed = Number.parseInt(digits, 10);
            count = parsed > 0 ? parsed : null;
        }
        const cancelled = key === 27 || key === 32
            || (retainPromptOnCancel && (key === 10 || key === 13));
        if (cancelled) {
            if (!retainPromptOnCancel) await pline('Never mind.');
            return {
                cancelled: true,
                object: null,
                gold: false,
                none: false,
                count: null,
            };
        }
        if (allowMenu && (key === 63 || key === 42)) {
            key = await selectInventoryObject({
                items: eligible,
                includeGold: allowGold,
                loopUntilValid: true,
            });
            continue;
        }
        const letter = String.fromCharCode(key);
        const object = eligible.find(candidate => candidate.invlet === letter);
        if (object) {
            const quantity = object.quantity ?? object.quan ?? 1;
            if (count !== null && count > quantity) {
                await pline(
                    `You don't have that many!  You have only ${quantity}.`,
                );
                key = await promptKey(prompt);
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

        const invalid = "You don't have that object.--More--";
        await pline(invalid);
        await flush_screen(1);
        game.nhDisplay?.setCursor(invalid.length, 0);
        do key = await nhgetch();
        while (key !== 27 && key !== 32 && key !== 10 && key !== 13);

        await pline(prompt);
        await flush_screen(1);
        game.nhDisplay?.setCursor(prompt.length, 0);
        key = await nhgetch();
        count = null;
    }
}
