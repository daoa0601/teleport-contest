import { ingSuffix } from './hacklib.js';
// Inventory selection shared by commands which use NetHack's getobj flow.
// C ref: invent.c getobj().

import { clearMessageWindow, flushPendingTopline, flush_screen, pline, setTopline } from './display.js';
import { game } from './gstate.js';
import { NATIVE_COMMAND_CONSTANTS } from './command_data.js';
import { selectInventoryObject } from './invent.js';
import { clearCommandKeys, readchar, takeCommandKey } from './input.js';
import { yn_function } from './query.js';
import { rn2 } from './rng.js';
import {
    GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_INACCESS, GETOBJ_EXCLUDE_NONINVENT,
    GETOBJ_EXCLUDE_SELECTABLE, GETOBJ_SUGGEST,
} from './const.js';
import { AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, LOADSTONE } from './object_data.js';
import { splitObjectStack } from './object_stack.js';
import { isWeldedPrimary } from './weapon_slots.js';
import type { GameObject } from './object_types.js';
import { rememberObjectChoice, takeRepeatCommand } from './command_repeat.js';
import { keyText } from './prevmsg.js';
import { putMessageHistory } from './display.js';

export type InventoryClassification = 0 | 1 | 2 | 3 | 4 | 5;

export interface GetobjOptions {
    // GETOBJ_PROMPT: ask even when nothing is a likely candidate.
    forcePrompt?: boolean;
    // GETOBJ_ALLOWCNT: accept a typed or menu count.
    allowCount?: boolean;
    // The callback's answer for HANDS_SYM, obj_ok((struct obj *) 0).
    hands?: InventoryClassification;
    // getobj_hands_txt(): the '-' menu entry, when hands are allowed.
    handsText?: string;
}

export type InventoryObjectSelection = {
    cancelled: true;
    object: null;
    none: false;
    count: 0 | null;
} | {
    cancelled: false;
    object: GameObject;
    none: false;
    count: number | null;
} | {
    cancelled: false;
    object: null;
    none: true;
    count: number | null;
};

const CANCELLED: InventoryObjectSelection = { cancelled: true, object: null, none: false, count: null };
const HANDS: InventoryObjectSelection = { cancelled: false, object: null, none: true, count: null };
const COIN_CLASS = 12;
const HANDS_SYM = 45, QUESTION = 63, ASTERISK = 42, ESCAPE = 27;
// strchr(quitchars, '\0') also succeeds, for a literal NUL from the fuzzer.
const QUITCHARS = [0, 32, 13, 10, ESCAPE];

function admitsChoice(classification: InventoryClassification): boolean {
    return classification === GETOBJ_SUGGEST || classification === GETOBJ_DOWNPLAY;
}

// C invent.c:getobj().  The callback classifies HANDS_SYM and each carried
// object; suggestions shape the prompt and its '?' subset, downplayed
// choices force the prompt, and any carried letter may still be typed.
// The returned count has not been split off; callers which need native
// split_otmp behavior use chooseInventoryObject().
export async function getobj(
    word: string,
    classify: (object: GameObject) => InventoryClassification,
    { forcePrompt = false, allowCount = false, hands = GETOBJ_EXCLUDE, handsText = 'your hands' }: GetobjOptions = {},
): Promise<InventoryObjectSelection> {
    const queued = takeQueuedInventorySelection(classify, allowCount, hands);
    if (queued) return queued;

    let allowNone = false, handsSuggested = false, handsDownplayed = false, inaccessible = 0;
    switch (hands) {
    case GETOBJ_SUGGEST:
        allowNone = handsSuggested = true;
        break;
    case GETOBJ_DOWNPLAY:
    case GETOBJ_EXCLUDE_INACCESS:
    case GETOBJ_EXCLUDE_SELECTABLE:
        allowNone = handsDownplayed = true;
        break;
    case GETOBJ_EXCLUDE_NONINVENT:
        forcePrompt = false;
        inaccessible++;
        break;
    case GETOBJ_EXCLUDE:
        break;
    }
    if (game.flags?.fixinv === false) reassignInventoryLetters();
    const sorted = [...game.inventory]
        .sort((left, right) => inventoryLetterOrder(left.invlet) - inventoryLetterOrder(right.invlet));
    const suggested: GameObject[] = [], downplayed: GameObject[] = [];
    for (const object of sorted) {
        const classification = classify(object);
        if (classification === GETOBJ_EXCLUDE_INACCESS) inaccessible++;
        else if (classification === GETOBJ_DOWNPLAY) {
            forcePrompt = true;
            downplayed.push(object);
        } else if (classification === GETOBJ_SUGGEST) suggested.push(object);
    }
    if (!suggested.length && !forcePrompt && !allowNone) {
        await pline(`You don't have anything ${inaccessible ? 'else ' : ''}to ${word}.`);
        return CANCELLED;
    }
    const letters = compactInventoryLetters(suggested.map(object => object.invlet).join(''));
    const buf = handsSuggested ? letters ? `- ${letters}` : '-' : letters;
    const prompt = `What do you want to ${word}? [${buf ? `${buf} or ?*` : '*'}]`;
    const selection = await chooseGetobjLetter(word, prompt, classify, {
        allowCount, allowNone, handsSuggested, handsDownplayed, handsText, suggested, downplayed,
    });
    if (selection.object && classify(selection.object) === GETOBJ_EXCLUDE) {
        await sillyThing(word, selection.object);
        return CANCELLED;
    }
    // split_otmp: an explicit zero count selects nothing.
    if (selection.object && selection.count === 0) return { ...CANCELLED, count: 0 };
    return selection;
}

// getobj() followed by its split_otmp tail, for callers which take the
// object getobj() returns; hands are not a choice for these callbacks.
export async function chooseInventoryObject(
    word: string,
    classify: (object: GameObject) => InventoryClassification,
    options: Omit<GetobjOptions, 'handsText'> = {},
): Promise<GameObject | null> {
    return selectedInventoryObject(await getobj(word, classify, options));
}

function selectedInventoryObject(selection: InventoryObjectSelection): GameObject | null {
    const object = selection.object;
    if (object && selection.count !== null && selection.count < object.quan) {
        if (object.otyp === LOADSTONE && object.cursed) object.corpsenm = selection.count;
        // C splittable() calls welded(), revealing the curse before refusing
        // the split. A cursed loadstone returns before that weapon check.
        else if (isWeldedPrimary(object)) object.bknown = true;
        else return splitObjectStack(object, selection.count, game);
    }
    return object;
}

// C getobj() pops CQ_REPEAT (during #repeat) or CQ_CANNED entries before
// reassign(): a queued letter must not become a different possession merely
// because fixinv is disabled.  Unmatched canned keys discard the queue.
function takeQueuedInventorySelection(
    classify: (object: GameObject) => InventoryClassification,
    allowCount: boolean,
    hands: InventoryClassification,
): InventoryObjectSelection | undefined {
    let repeated = takeRepeatCommand();
    let key: number | undefined;
    let count: number | null = null;
    if (repeated) {
        if (repeated.kind === 'count') {
            if (!allowCount) return CANCELLED;
            count = repeated.count;
            repeated = takeRepeatCommand();
        }
        if (repeated?.kind !== 'key') return CANCELLED;
        key = repeated.key;
    } else {
        key = takeCommandKey();
        if (key === undefined) return undefined;
    }
    if (key === HANDS_SYM) {
        if (admitsChoice(hands)) return HANDS;
    } else {
        const letter = String.fromCharCode(key);
        const object = game.inventory.find(candidate => candidate.invlet === letter
            && admitsChoice(classify(candidate)));
        if (object) return {
            cancelled: false, object, none: false,
            count: count !== null && count > 0 && count < object.quan ? count : null,
        };
    }
    if (!repeated) clearCommandKeys();
    return CANCELLED;
}

interface GetobjChoices {
    allowCount: boolean;
    allowNone: boolean;
    handsSuggested: boolean;
    handsDownplayed: boolean;
    handsText: string;
    suggested: readonly GameObject[];
    downplayed: readonly GameObject[];
}

// The interactive loop of C getobj(), up to its final silly_thing() check.
async function chooseGetobjLetter(
    word: string,
    prompt: string,
    classify: (object: GameObject) => InventoryClassification,
    { allowCount, allowNone, handsSuggested, handsDownplayed, handsText, suggested, downplayed }: GetobjChoices,
): Promise<InventoryObjectSelection> {
    const forcedMenu = !!game.flags.force_invmenu;
    let oneloop = false;
    let key = 0;
    for (;;) {
        let count: number | null = null;
        // A forced-menu retry reuses its letter without answering a query.
        let answered = !forcedMenu || !oneloop;
        if (forcedMenu) {
            // The first forced menu lists likely candidates; a rejected
            // count retries the letter already chosen from it.
            if (!oneloop) key = suggested.length || downplayed.length || handsDownplayed ? QUESTION : ASTERISK;
            oneloop = true;
        } else key = await askInventoryPrompt(prompt);
        if (key >= 48 && key <= 57) {
            if (!allowCount) {
                await pline('No count allowed with this command.');
                continue;
            }
            const counted = await readInventoryCount(key);
            key = counted.key;
            if (counted.count) count = counted.count;
        }
        if (QUITCHARS.includes(key)) {
            // C getobj(): a silent cancellation leaves the question painted.
            if (game.flags?.verbose !== false) await neverMind();
            return CANCELLED;
        }
        if (key === HANDS_SYM) {
            game._pending_message = '';
            if (!allowNone) await mimeInventoryAction(word);
            return allowNone ? { cancelled: false, object: null, none: true, count } : CANCELLED;
        }
        while (key === QUESTION || key === ASTERISK) {
            // '?' lists the suggested letters, or the downplayed ones
            // (headed by '-') when nothing is suggested; '*' lists all.
            const useAlternates = key === QUESTION && !suggested.length
                && (downplayed.length > 0 || handsDownplayed);
            const items = useAlternates ? downplayed : suggested;
            const letters = key === QUESTION
                ? `${useAlternates && handsDownplayed ? '-' : ''}${items.map(object => object.invlet).join('')}`
                : undefined;
            const extraChoice = allowNone && (key === ASTERISK
                || useAlternates && handsDownplayed || handsSuggested) ? handsText : null;
            const letterCount = letters?.length ?? 0;
            const listed = letterCount > 0;
            answered = true;
            const selection = await selectInventoryObject({
                ...(letters === undefined ? {} : { letters }),
                ...(extraChoice ? { extraChoice } : {}),
                ...(forcedMenu ? {
                    title: `What do you want to ${word}?`,
                    menuOptions: allowNone && !extraChoice || listed && letterCount < game.inventory.length
                        ? [{ key: '*', text: '(list everything)' }]
                        : !listed ? [{ key: '?', text: '(list likely candidates)' }] : [],
                } : {}),
            });
            key = selection.key;
            if (key === 0) break;
            if (key === HANDS_SYM) {
                game._pending_message = '';
                return HANDS;
            }
            if (key === ESCAPE) {
                if (game.flags?.verbose !== false) await neverMind();
                return CANCELLED;
            }
            // The native singleton returns count -1 (all), which does not
            // replace a count already entered before '?'.
            if (key !== QUESTION && key !== ASTERISK && allowCount && selection.count !== null)
                count = selection.count;
        }
        if (key === 0) {
            if (oneloop) return CANCELLED;
            continue;
        }
        // C tty_yn_function() marks an answered prompt as already read.
        // A one-line query stays painted through a silent action. Wrapped
        // queries have already been erased by tty_yn_function()'s cleanup.
        if (answered) game._pending_message = '';
        const letter = String.fromCharCode(key);
        const object = game.inventory.find(candidate => candidate.invlet === letter) ?? null;
        if (letter === '$' || object?.oclass === COIN_CLASS) {
            if (object && classify(object) === GETOBJ_EXCLUDE) {
                await pline(`You cannot ${word} gold.`);
                return CANCELLED;
            }
            if (count !== null && count <= 0) return CANCELLED;
        }
        if (count !== null && word === 'throw') {
            if (!object) return CANCELLED;
            const coins = object.oclass === COIN_CLASS;
            if (count > 1 && (!coins || count > object.quan)) {
                await pline(count > object.quan ? `You only have ${object.quan}${
                    !coins && object.quan > 1 ? ' and can only throw one at a time' : ''}.`
                    : 'You can only throw one at a time.');
                continue;
            }
        }
        game.context.botl = true;
        if (object) rememberObjectChoice(key, count);
        if (!object) {
            await pline("You don't have that object.");
            if (game._inDoAgain) return CANCELLED;
            continue;
        }
        if (count !== null && object.quan < count) {
            await pline(`You don't have that many!  You have only ${object.quan}.`);
            if (game._inDoAgain) return CANCELLED;
            continue;
        }
        return { cancelled: false, object, none: false, count };
    }
}

async function neverMind(): Promise<void> {
    game._pending_message = '';
    game._retained_message = '';
    await pline('Never mind.');
}

// C invent.c:silly_thing().
async function sillyThing(word: string, object: GameObject): Promise<void> {
    await pline(word === 'call' && (object.otyp === AMULET_OF_YENDOR
        || object.otyp === FAKE_AMULET_OF_YENDOR && !object.known)
        ? "The Amulet doesn't like being called names."
        : `That is a silly thing to ${word}.`);
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
    await pline(`You mime ${ingSuffix(action)}${prefix ? ' ' + prefix : ''} something${suffix ? ' ' + suffix : ''}.`);
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

// C cmd.c:get_count(): only a positive typed count is passed on by getobj.
// Backspace edits the count; counts above nine are echoed.
async function readInventoryCount(firstKey: number): Promise<{ key: number; count: number }> {
    let count = 0, key = firstKey, backspaced = false;
    for (;;) {
        let showZero = false;
        if (key >= 48 && key <= 57) {
            count = Math.min(NATIVE_COMMAND_CONSTANTS.LARGEST_INT, count * 10 + key - 48);
            showZero = key === 48;
        } else if (key === 8 || key === 127) {
            if (!count) {
                putMessageHistory(`Count: ${count} ${keyText(key)}`);
                return { key, count: 0 };
            }
            count = Math.trunc(count / 10);
            backspaced = true;
        } else {
            const finalCount = key === 27 ? 0 : count;
            // C get_count(GC_SAVEHIST): the final count and the accepting
            // key join the recall history; Escape breaks with a zero count.
            putMessageHistory(`Count: ${finalCount} ${keyText(key)}`);
            return { key, count: finalCount };
        }
        if (count > 9 || backspaced) {
            const text = backspaced && !count && !showZero ? 'Count: ' : `Count: ${count}`;
            if (count || showZero) backspaced = false;
            clearMessageWindow();
            // The echo itself is custompline(SUPPRESS_HISTORY).
            await setTopline(text);
            await flush_screen(0);
            game.nhDisplay?.setCursor(text.length, 0);
        }
        key = await readchar();
    }
}

// C getobj() has already consumed its queued selection or user-input marker.
// Its interactive query must leave later canned answers for the caller.
async function askInventoryPrompt(prompt: string): Promise<number> {
    await flushPendingTopline();
    const { answer } = await yn_function(prompt, null, '', false);
    return answer.charCodeAt(0);
}
