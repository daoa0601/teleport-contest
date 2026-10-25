// Interactive compound options. C refs: options.c:handler_*().
import { game } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { visibleCommandKey } from './command_keys.js';
import { autoUnlockFlags } from './lock_pick.js';
import { statusVersion } from './status_version.js';
import { statusConditionOptions } from './status_conditions.js';
import { showInventoryWindow, showMultiSelectWindow } from './windows.js';
import {
    MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_SKIPINVERT, MENU_ITEMFLAGS_SKIPMENUCOLORS, PICK_ONE,
    PARANOID_AUTOALL, PARANOID_BONES, PARANOID_BREAKWAND, PARANOID_CONFIRM,
    PARANOID_DIE, PARANOID_EATING, PARANOID_HIT, PARANOID_PRAY,
    PARANOID_QUIT, PARANOID_REMOVE, PARANOID_SWIM, PARANOID_TRAP, PARANOID_WERECHANGE,
} from './const.js';

const RUN_MODES = ['teleport', 'run', 'walk', 'crawl'];
const BURDEN_NAMES = ['unencumbered', 'burdened', 'stressed', 'strained', 'overtaxed', 'overloaded'];
const UNLOCK_ACTIONS = [
    ['untrap', '(might fail)'], ['apply-key', ''],
    ['kick', '(doors only)'], ['force', '(chests/boxes only)'],
] as const;
const MESSAGE_WINDOWS = [
    ['single', '[show one old message at a time,', ' most recent first]'],
    ['combination', '[for consecutive ^P requests, use', " 'single' for first two, then 'full']"],
    ['full', '[show all available messages,', ' oldest first and most recent last]'],
    ['reversed', '[show all available messages,', ' most recent first]'],
] as const;

export const PARANOIA_CHOICES = [
    [PARANOID_CONFIRM, 'Confirm', 'for "yes" confirmations, require "no" to reject'],
    [PARANOID_QUIT, 'quit', 'yes vs y to quit or to enter explore mode'],
    [PARANOID_DIE, 'die', 'yes vs y to die (explore mode or debug mode)'],
    [PARANOID_BONES, 'bones', 'yes vs y to save bones data when dying in debug mode'],
    [PARANOID_HIT, 'attack', 'yes vs y to attack a peaceful monster'],
    [PARANOID_BREAKWAND, 'wand-break', 'yes vs y to break a wand via (a)pply'],
    [PARANOID_EATING, 'eat', 'yes vs y to continue eating after first bite when satiated'],
    [PARANOID_WERECHANGE, 'Were-change', 'yes vs y to change form when lycanthropy is controllable'],
    [PARANOID_PRAY, 'pray', 'y required to pray (supersedes old "prayconfirm" option)'],
    [PARANOID_TRAP, 'trap', 'y required to enter known trap unless considered harmless'],
    [PARANOID_AUTOALL, 'Autoall', "y required to pick filter choice 'A' for menustyle:Full"],
    [PARANOID_SWIM, 'swim', "'m' prefix necessary to deliberately walk into lava or water"],
    [PARANOID_REMOVE, 'Remove', 'always pick from inventory for Remove and Takeoff'],
] as const;
const DEFAULT_PARANOIA = PARANOID_PRAY | PARANOID_TRAP | PARANOID_SWIM;
const DISCLOSURE_CATEGORIES = [
    ['i', 'inventory'], ['a', 'attributes'], ['v', 'vanquished'],
    ['g', 'genocides'], ['c', 'conduct'], ['o', 'overview'],
] as const;

export function compoundMenuValue(name: string): string | null {
    switch (name) {
    case 'runmode': return game.flags.runmode ?? 'run';
    case 'msg_window': return messageWindowName();
    case 'autounlock': return unlockDescription();
    case 'paranoid_confirmation': return PARANOIA_CHOICES
        .filter(([bit]) => (paranoiaBits() & bit) !== 0 && (bit !== PARANOID_BONES || game.flags.debug))
        .map(([, option]) => option).join(' ') || 'none';
    case 'disclose': return disclosureDescription(disclosureValues());
    case 'pickup_burden': {
        const value = game.flags.pickup_burden;
        return typeof value === 'number' ? BURDEN_NAMES[value] ?? 'stressed' : value ?? 'stressed';
    }
    case 'whatis_coord': return COORDINATE_CHOICES.find(([key]) => key === (game.iflags.getpos_coords ?? 'n'))?.[1] ?? 'none';
    case 'whatis_filter': return ['none', 'view', 'area'][game.iflags.getloc_filter ?? 0] ?? 'none';
    case 'versinfo': {
        const bits = game.flags.versinfo ?? 1;
        const parts = [bits & 2 ? 'name' : '', bits & 4 ? 'branch' : '', bits & 1 ? 'number' : ''].filter(Boolean);
        return `${bits}: ${parts.join('+')} (${statusVersion(bits)})`;
    }
    case 'status_conditions': return `(${statusConditionOptions(game).filter(option => option.enabled).length} currently set)`;
    default: return null;
    }
}

// Returns false when this option has no special menu handler.
export async function editCompoundMenu(name: string, giveMessage: boolean): Promise<boolean> {
    switch (name) {
    case 'runmode': {
        const selection = await showInventoryWindow([{ items: RUN_MODES.map(mode => ({ key: mode.charAt(0), text: mode })) }],
            { title: 'Select run/travel display mode:', pickMode: PICK_ONE });
        const mode = RUN_MODES.find(mode => mode.charCodeAt(0) === selection.key);
        if (mode) game.flags.runmode = mode;
        break;
    }
    case 'msg_window': await editMessageWindow(); break;
    case 'paranoid_confirmation': await editParanoidConfirmation(); break;
    case 'disclose': await editDisclosure(); break;
    case 'autounlock': await editAutounlock(giveMessage); break;
    case 'pickup_burden': {
        const selection = await showInventoryWindow([{ items: BURDEN_NAMES.map((text, index) => ({ key: 'ubsntl'.charAt(index), text })) }],
            { title: 'Select encumbrance level:', pickMode: PICK_ONE });
        const burden = 'ubsntl'.indexOf(String.fromCharCode(selection.key));
        if (burden >= 0) game.flags.pickup_burden = burden;
        break;
    }
    case 'whatis_coord': await editCoordinates(); break;
    case 'whatis_filter': await editLocationFilter(); break;
    case 'versinfo': await editVersionInfo(); break;
    case 'status_conditions': await editStatusConditions(); break;
    default: return false;
    }
    return true;
}

async function editStatusConditions(): Promise<void> {
    for (;;) {
        const byRank = game.iflags.conditionMenuByRank ?? false;
        const current = byRank ? 'by ranking' : 'alphabetically';
        const next = byRank ? 'alphabetically' : 'by ranking';
        const choices = statusConditionOptions(game).sort((left, right) =>
            (byRank ? left.rank - right.rank : 0)
            || (left.name.toLowerCase() < right.name.toLowerCase() ? -1 : 1));
        const selected = await showMultiSelectWindow<number | 'sort'>({
            title: 'Choose status conditions to toggle', omitHeadings: true,
            pageLocalKeys: true, signalEscape: true,
            sections: [{ items: [
                { key: 'S', value: 'sort', text: `change sort order from "${current}" to "${next}"`,
                    itemFlags: MENU_ITEMFLAGS_SKIPINVERT },
                { selectable: false, text: `sorted ${current}`, attr: 1,
                    itemFlags: MENU_ITEMFLAGS_SKIPMENUCOLORS },
                ...choices.map(option => ({ value: option.bit, text: `cond_${option.name.padEnd(14)}`,
                    itemFlags: option.enabled ? MENU_ITEMFLAGS_SELECTED : 0 })),
            ] }],
        });
        if (selected === null) return;
        if (selected.includes('sort')) {
            game.iflags.conditionMenuByRank = !byRank;
            continue;
        }
        game.flags.statusConditionMask = selected.reduce<number>((mask, bit) => typeof bit === 'number' ? mask | bit : mask, 0);
        return;
    }
}

const COORDINATE_CHOICES = [
    ['c', 'compass', "compass ('east' or '3s' or '2n,4w')"],
    ['f', 'full compass', "full compass ('east' or '3south' or '2north,4west')"],
    ['m', 'map', 'map <x,y>'], ['s', 'screen', 'screen [row,column]'],
    ['n', 'none', 'none (no coordinates displayed)'],
] as const;

async function editCoordinates(): Promise<void> {
    const selection = await showInventoryWindow([{ items: [
        ...COORDINATE_CHOICES.map(([key, , text]) => ({ key, text })),
        { text: '' },
        { text: 'map: upper-left: <1,0>, lower-right: <79,20>'
            + (game.flags.verbose ? '; column 0 unused, off left edge' : '') },
        { text: 'screen: upper-left: [02,01], lower-right: [22,79]'
            + (game.flags.verbose ? '; column 80 is not used' : '') },
        { text: '' },
    ] }], { title: 'Select coordinate display when auto-describing a map position:',
        pickMode: PICK_ONE, preselectedKey: game.iflags.getpos_coords ?? 'n' });
    const chosen = COORDINATE_CHOICES.find(([key]) => key.charCodeAt(0) === selection.key);
    if (chosen) game.iflags.getpos_coords = chosen[0];
}

async function editLocationFilter(): Promise<void> {
    const choices = [ ['n', 'no filtering', 0], ['v', 'in view only', 1], ['a', 'in same area', 2] ] as const;
    const selection = await showInventoryWindow([{ items: choices.map(([key, text]) => ({ key, text })) }], {
        title: 'Select location filtering when going for next/previous map position:', pickMode: PICK_ONE,
        preselectedKey: choices.find(([, , value]) => value === (game.iflags.getloc_filter ?? 0))?.[0] ?? 'n',
    });
    const chosen = choices.find(([key]) => key.charCodeAt(0) === selection.key);
    if (chosen) game.iflags.getloc_filter = chosen[2];
}

async function editVersionInfo(): Promise<void> {
    const previous = game.flags.versinfo ?? 1;
    const choices = [ ['n', 1, 'version number'], ['g', 2, 'game name'], ['b', 4, '(not available)'] ] as const;
    const selected = await showMultiSelectWindow({
        title: 'Select version information flags:', omitHeadings: true,
        sections: [{ items: choices.map(([key, bit, text]) => ({ key, value: bit,
            groupAccelerator: String(bit), text, itemFlags: previous & bit ? MENU_ITEMFLAGS_SELECTED : 0 })) }],
    });
    const bits = selected.reduce((mask, bit) => mask | bit, 0) & 7;
    if (bits) game.flags.versinfo = bits;
    const current = game.flags.versinfo ?? 1;
    await plineWithContinuation(`'versinfo' ${current === previous ? 'not changed, still' : 'changed to'} ${current}.`);
}

function messageWindowName(): string {
    const mode = (game.iflags.prevmsg_window ?? 's').charAt(0);
    return MESSAGE_WINDOWS.find(([name]) => name.charAt(0) === mode)?.[0] ?? 'reversed';
}

async function editMessageWindow(): Promise<void> {
    const previous = messageWindowName();
    const separator = game.iflags.menu_tab_sep ? '\t' : ' ';
    const selection = await showInventoryWindow([{ items: MESSAGE_WINDOWS.flatMap(([name, first, second]) => [
        { key: name.charAt(0), text: `${name.padEnd(12)}${separator}${first}` },
        { text: `${' '.repeat(16)}${separator}${second}` },
    ]) }], { title: 'Select message history display type:', pickMode: PICK_ONE, preselectedKey: previous.charAt(0) });
    const chosen = MESSAGE_WINDOWS.find(([name]) => name.charCodeAt(0) === selection.key);
    if (chosen) game.iflags.prevmsg_window = chosen[0].charAt(0);
    const current = messageWindowName();
    if (current !== previous || game.flags.verbose)
        await plineWithContinuation(`'msg_window' ${current !== previous ? 'changed to' : 'is still'} "${current}".`);
}

function paranoiaBits(): number {
    return game.flags.paranoia_bits ?? DEFAULT_PARANOIA;
}

async function editParanoidConfirmation(): Promise<void> {
    const previous = paranoiaBits();
    const prefix = game.commandBindings.keyForCommand('reqmenu');
    const movementPrefix = prefix ? visibleCommandKey(prefix) : '#reqmenu';
    const selected = await showMultiSelectWindow({
        title: 'Actions requiring extra confirmation:', omitHeadings: true, signalEscape: true,
        sections: [{ items: PARANOIA_CHOICES.filter(([bit]) => bit !== PARANOID_BONES || game.flags.debug)
            .map(([bit, name, text]) => ({ key: name.charAt(0), value: bit,
                text: text.replace("'m'", `'${movementPrefix}'`),
                itemFlags: previous & bit ? MENU_ITEMFLAGS_SELECTED : 0 })) }],
    });
    if (selected !== null) game.flags.paranoia_bits = selected.reduce((mask, bit) => mask | bit, 0);
}

function unlockDescription(): string {
    const bits = autoUnlockFlags(game);
    return UNLOCK_ACTIONS.filter((_, index) => (bits & (1 << index)) !== 0)
        .map(([name]) => name).join(' + ') || 'none';
}

async function editAutounlock(giveMessage: boolean): Promise<void> {
    const previous = autoUnlockFlags(game);
    const separator = game.iflags.menu_tab_sep ? '\t' : ' ';
    const selected = await showMultiSelectWindow({
        title: "Select 'autounlock' actions:", omitHeadings: true, signalEscape: true,
        sections: [{ items: UNLOCK_ACTIONS.map(([name, detail], index) => ({
            key: name.charAt(0), value: 1 << index, text: `${name.padEnd(10)}${separator}${detail}`,
            itemFlags: previous & (1 << index) ? MENU_ITEMFLAGS_SELECTED : 0,
        })) }],
    });
    if (selected !== null) game.flags.autounlock = selected.reduce((bits, bit) => bits | bit, 0);
    const changed = autoUnlockFlags(game) !== previous;
    if (giveMessage && (changed || game.flags.verbose))
        await plineWithContinuation(`'autounlock' ${changed ? 'changed to' : 'is still'} '${unlockDescription()}'.`);
}

function disclosureValues(): string[] {
    const values = DISCLOSURE_CATEGORIES.map(() => 'n');
    const raw = game.flags.disclose;
    if (raw === undefined) return values;
    if (!raw || raw.toLowerCase() === 'all') return values.map(() => 'y');
    if (raw.toLowerCase() === 'none') return values.map(() => '-');
    let prefix: string | null = null;
    for (const character of raw.toLowerCase()) {
        const category = character === 'k' ? 'v' : character === 'd' ? 'o' : character;
        const index = DISCLOSURE_CATEGORIES.findIndex(([key]) => key === category);
        if (index >= 0) {
            let value = prefix ?? '+';
            if (category !== 'v' && category !== 'g') value = value === '?' ? 'y' : value === '#' ? '+' : value;
            values[index] = value;
            prefix = null;
        } else if ('yn?+-#'.includes(character)) prefix = character;
    }
    return values;
}

async function editDisclosure(): Promise<void> {
    const values = disclosureValues();
    const categories = await showMultiSelectWindow({
        title: 'Change which disclosure options categories:', omitHeadings: true,
        sections: [{ items: DISCLOSURE_CATEGORIES.map(([key, name], index) => ({
            key, value: index, text: `${name.padEnd(12)}[${values[index] ?? 'n'}${key}]`,
        })) }],
    });
    for (const index of categories) {
        const category = DISCLOSURE_CATEGORIES[index];
        if (!category) continue;
        const [key, name] = category;
        const special = key === 'v' || key === 'g';
        const choices = [
            ['-', 'Never disclose, without prompting'],
            ['+', 'Always disclose, without prompting'],
            ...(special ? [['#', 'Always disclose, pick sort order from menu']] : []),
            ['n', 'Prompt, with default answer of "No"'],
            ['y', 'Prompt, with default answer of "Yes"'],
            ...(special ? [['?', 'Prompt, with default answer of "Ask" to request sort menu']] : []),
        ];
        const selected = await showMultiSelectWindow({
            title: `Disclosure options for ${name}:`, omitHeadings: true, pageLocalKeys: true, pickOne: true,
            sections: [{ items: choices.map(([value, text]) => ({ value: value ?? 'n', text: text ?? '',
                ...(value && value !== '-' ? { groupAccelerator: value } : {}),
                itemFlags: value === values[index] ? MENU_ITEMFLAGS_SELECTED : 0 })) }],
        });
        // PICK_ONE may return both the preselected item and a new choice.
        const chosen = selected.find(value => value !== values[index]) ?? selected[0];
        if (chosen) {
            values[index] = chosen;
            game.flags.disclose = disclosureDescription(values);
        }
    }
}

function disclosureDescription(values: readonly string[]): string {
    return DISCLOSURE_CATEGORIES.map(([key], index) => `${values[index] ?? 'n'}${key}`).join(' ');
}
