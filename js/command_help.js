// C cmd.c:dokeylist(), keylist_putcmds(), doextlist(). Lists use the live
// bindings and native command flags, including commands without a key.
import { COMMAND_DESCRIPTIONS } from './command_descriptions.js';
import { NATIVE_COMMANDS, NATIVE_COMMAND_FLAGS as F } from './command_data.js';
import { visibleCommandKey } from './command_keys.js';
import { game } from './gstate.js';
import { patternMatches } from './encyclopedia.js';
import { keyText } from './pager_help.js';
import { getLine } from './query.js';
import { restoreCommandMap } from './tty_prompts.js';
import { showDisclosureOverlay, showMultiSelectWindow } from './windows.js';
export async function keyBindingsHelp() {
    const bindings = game.commandBindings;
    const direction = (index) => visibleCommandKey(bindings.keyForDirection(index));
    const lines = ['', '            Full Current Key Bindings List',
        '        (also commands with no key assignment)', '', 'Directional keys:',
        `          ${direction(1)}  ${direction(2)}  ${direction(3)}`, '           \\ | / ',
        `          ${direction(0)}- . -${direction(4)}`, '           / | \\ ',
        `          ${direction(7)}  ${direction(6)}  ${direction(5)}`, ''];
    if (!bindings.numberPad)
        lines.push('Ctrl+<direction> will run in specified direction until something very', '        interesting is seen.');
    lines.push(`${bindings.numberPad ? 'Meta' : 'Shift'}+<direction> will run in specified direction until you encounter`, '        an obstacle.', '', 'Miscellaneous keys:', '<esc>   cancel current prompt or pending prefix');
    if (bindings.numberPad)
        lines.push(`${keyText(bindings.specialKey('count') ?? 110).padEnd(7)} Prefix: for digits when preceding a command with a count`);
    lines.push('^C      interrupt: break out of NetHack (SIGINT)', '', 'Menu control keys:', '>       Go to next page', '<       Go to previous page', '^       Go to first page', '|       Go to last page', '.       Select all items in entire menu', '@       Invert selection for all items', '-       Unselect all items in entire menu', ',       Select all items on current page', '~       Invert current page\'s selections', '\\       Unselect all items on current page', ':       Search and invert matching items', 'Return  Accept current choice(s) and dismiss menu', 'Enter   Same as Return', 'Space   If not on last page, advance one page;', '        when on last page, treat like Return', 'Escape  Cancel menu without making any choice(s)');
    const used = new Set([3, 27, ...(bindings.numberPad ? [bindings.specialKey('count') ?? 110] : [])]);
    const ignore = F.WIZMODECMD | F.INTERNALCMD | F.MOVEMENTCMD;
    const categories = [
        { title: 'General commands:', include: F.GENERALCMD, exclude: ignore },
        { title: 'Game commands:', include: 0, exclude: F.GENERALCMD | ignore },
        ...(game.flags.debug ? [{ title: 'Debug mode commands:', include: F.WIZMODECMD, exclude: F.INTERNALCMD }] : []),
    ];
    for (const category of categories) {
        const eligible = NATIVE_COMMANDS.filter(command => command.name
            && (!category.include || command.flags & category.include) && !(command.flags & category.exclude));
        const rows = [];
        const usedBeforeCategory = new Set(used);
        for (let key = 1; key < 256; key++) {
            const binding = bindings.lookup(key);
            if (used.has(key) || key === 32 && !bindings.restOnSpace || !binding?.command
                || !eligible.some(command => command.name === binding.command?.name))
                continue;
            const name = binding.command.name;
            if (!name)
                continue;
            rows.push(`${keyText(key).padEnd(7)} ${name.padEnd(13)} ${COMMAND_DESCRIPTIONS.get(name) ?? ''}${binding.parameter === null ? '' : ` "${binding.parameter}"`}`);
            used.add(key);
        }
        for (const command of eligible) {
            const name = command.name;
            if (!name || bindings.bindings.some(binding => binding.command === command && !usedBeforeCategory.has(binding.key)))
                continue;
            rows.push(`#${name.padEnd(20)} ${COMMAND_DESCRIPTIONS.get(name) ?? ''}`);
        }
        if (rows.length)
            lines.push('', category.title, ...rows);
    }
    await showDisclosureOverlay(lines, { restoreUnderlay: true });
    game.context.move = 0;
}
export async function extendedCommandsHelp() {
    let autocompleteOnly = false, mergedDebug = false, search = '';
    for (;;) {
        const controls = [
            { key: 'a', value: 'toggle', text: `Switch to ${autocompleteOnly ? 'including' : 'excluding'} commands that don't autocomplete` },
            search ? { key: 's', groupAccelerator: ':', value: 'clear', text: `Switch back from search ("${search}")` }
                : { key: ':', groupAccelerator: 's', value: 'search', text: 'Search extended commands' },
            ...(game.flags.debug ? [{ key: 'z', value: 'debug', text: mergedDebug
                        ? 'Switch to showing debugging commands in separate section'
                        : 'Switch to showing all alphabetically, including debugging commands' }] : []),
            { selectable: false, text: '' },
        ];
        const sections = [{ items: controls }];
        for (let pass = 0; pass <= 1; pass++) {
            if (pass && (mergedDebug || !game.flags.debug))
                break;
            const items = [];
            for (const command of NATIVE_COMMANDS) {
                const name = command.name;
                if (!name || command.flags & (F.CMD_NOT_AVAILABLE | F.INTERNALCMD)
                    || autocompleteOnly && !(command.flags & F.AUTOCOMPLETE))
                    continue;
                const debug = !!(command.flags & F.WIZMODECMD);
                if (debug && !game.flags.debug || !mergedDebug && Number(debug) !== pass)
                    continue;
                let description = COMMAND_DESCRIPTIONS.get(name) ?? '';
                if (!game.flags.debug && !game.flags.explore)
                    description = description.replace(' been genocided or become extinct', ' been genocided');
                const phrase = search.toLowerCase();
                if (search && !name.toLowerCase().includes(phrase) && !description.toLowerCase().includes(phrase)
                    && !patternMatches(phrase, name.toLowerCase()) && !patternMatches(phrase, description.toLowerCase()))
                    continue;
                const flags = `${command.flags & F.CMD_M_PREFIX ? 'm' : ''}${command.flags & F.AUTOCOMPLETE ? 'A' : ''}`;
                items.push({ selectable: false, text: ` ${name.padEnd(14)} ${(flags ? `[${flags}]` : '').padStart(4)} ${description}` });
            }
            if (items.length)
                sections.push({ items: [{ selectable: false, text: pass ? 'Debugging Extended Commands' : 'Extended commands' }, ...items, { selectable: false, text: '' }] });
        }
        sections.push({ items: search && sections.length === 1 ? [{ selectable: false, text: 'no matches' }]
                : [{ selectable: false, text: '[A] Command autocompletes' },
                    { selectable: false, text: `[m] Command accepts '${visibleCommandKey(game.commandBindings.keyForCommand('reqmenu'))}' prefix` }] });
        const selection = await showMultiSelectWindow({ title: 'Extended Commands List', titleAttr: 0,
            omitHeadings: true, sections, pageLocalKeys: true, pickOne: true });
        const choice = selection[0];
        await restoreCommandMap();
        if (choice === 'toggle')
            autocompleteOnly = !autocompleteOnly;
        else if (choice === 'debug') {
            mergedDebug = !mergedDebug;
            search = '';
        }
        else if (choice === 'clear')
            search = '';
        else if (choice === 'search') {
            search = (await getLine('Extended command list search phrase?', ch => ch >= ' '))?.trim().replace(/\s+/g, ' ') ?? '';
            if (!search)
                break;
        }
        else
            break;
    }
    game.context.move = 0;
}
//# sourceMappingURL=command_help.js.map