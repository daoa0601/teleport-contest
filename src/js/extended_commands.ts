// C cmd.c:extcmds_match(), extcmd_via_menu(), doextlist().
import { COLNO, NHW_MENU, PICK_ONE, ROWNO } from './const.js';
import { COMMAND_DESCRIPTIONS } from './command_descriptions.js';
import { NATIVE_COMMAND_FLAGS as flags, NATIVE_COMMANDS } from './command_data.js';
import type { NativeCommand } from './command_types.js';
import { visibleCommandKey } from './command_keys.js';
import { game } from './gstate.js';
import { getLine } from './query.js';
import { NO_COLOR } from './terminal.js';
import {
    tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow,
    tty_end_menu, tty_select_menu, tty_start_menu,
} from './tty_menu.js';

export function availableExtendedCommands(): NativeCommand[] {
    return NATIVE_COMMANDS.filter(command => command.name !== null
        && !(command.flags & (flags.CMD_NOT_AVAILABLE | flags.INTERNALCMD))
        && (game.flags.debug || !(command.flags & flags.WIZMODECMD)));
}

export function completeExtendedCommand(prefix: string): string | null {
    const matches = availableExtendedCommands().filter(command =>
        !!(command.flags & flags.AUTOCOMPLETE)
        && command.name?.toLowerCase().startsWith(prefix.toLowerCase()));
    return matches.length === 1 ? matches[0]?.name ?? null : null;
}

export function commandDescription(command: NativeCommand): string {
    // update_rest_on_space() binds its own wait entry with a distinct description.
    if (command.name === 'wait' && command.key === 32)
        return "rest one move via 'rest_on_space' option";
    return COMMAND_DESCRIPTIONS.get(command.name ?? '') ?? '';
}

export async function extendedCommandMenu(): Promise<NativeCommand | null> {
    let prefix = '';
    let biggest = 0;
    for (;;) {
        const choices = availableExtendedCommands().filter(command =>
            !!(command.flags & flags.AUTOCOMPLETE) && command.name?.startsWith(prefix));
        if (choices.length <= 1) return choices[0] ?? null;
        biggest = Math.max(biggest, ...choices.map(command => commandDescription(command).length));
        const window = tty_create_nhwindow<string>(NHW_MENU);
        await tty_start_menu(window);
        const onePerLine = choices.length < ROWNO - 3;
        let previous = '', text = '', count = 0, wrapped = false;
        const flush = () => {
            tty_add_menu(window, { identifier: previous, selector: previous,
                text: text.padEnd(biggest + 15) });
        };
        for (const [index, command] of choices.entries()) {
            const name = command.name ?? '';
            const initial = name.charAt(prefix.length);
            if (initial !== previous || onePerLine) wrapped = false;
            if (initial !== previous || onePerLine
                || (count >= 2 && text.length + 4 + name.length >= COLNO - 6)) {
                if (count) {
                    flush();
                    count = 0;
                    if (initial === previous && !onePerLine) wrapped = true;
                }
            }
            previous = initial;
            if (!count || onePerLine)
                text = `${wrapped ? 'or ' : ''}${name} [${commandDescription(command)}]`;
            else if (count === 1)
                text = `${wrapped ? 'or ' : ''}${choices[index - 1]?.name ?? ''} or ${name}`;
            else text += ` or ${name}`;
            count++;
        }
        if (count) flush();
        tty_end_menu(window, `Extended Command: ${prefix}`);
        const result = await tty_select_menu(window, PICK_ONE);
        await tty_destroy_nhwindow(window);
        const selected = result.selections[0]?.identifier;
        if (selected) prefix += selected;
        else if (prefix) prefix = '';
        else return null;
    }
}

// A list entry is informational. Only the list controls are selectable.
export async function showExtendedCommandList(): Promise<void> {
    let autocompleteOnly = false, oneList = false, search = '';
    for (;;) {
        const window = tty_create_nhwindow<string>(NHW_MENU);
        await tty_start_menu(window);
        const label = (text: string, attr = 0, color = NO_COLOR) => tty_add_menu(window,
            { identifier: null, text, attr, color });
        const option = (key: string, text: string, group = '') => tty_add_menu(window,
            { identifier: key, selector: key, group, text });
        label('Extended Commands List');
        label('');
        option('a', `Switch to ${autocompleteOnly ? 'including' : 'excluding'} commands that don't autocomplete`);
        if (!search) option(':', 'Search extended commands', 's');
        else option('s', `Switch back from search ("${search}")`, ':');
        if (game.flags.debug) option('z', oneList
            ? 'Switch to showing debugging commands in separate section'
            : 'Switch to showing all alphabetically, including debugging commands');
        label('');
        let found = 0;
        for (const wizardSection of oneList || !game.flags.debug ? [false] : [false, true]) {
            const entries = availableExtendedCommands().map(command => ({
                command, description: listedCommandDescription(command),
            })).filter(({ command, description }) =>
                (oneList || !!(command.flags & flags.WIZMODECMD) === wizardSection)
                && (!autocompleteOnly || !!(command.flags & flags.AUTOCOMPLETE))
                && (!search || matchesSearch(command.name ?? '', search)
                    || matchesSearch(description, search)));
            if (!entries.length) continue;
            label(wizardSection ? 'Debugging Extended Commands' : 'Extended commands',
                game.program_state.gameover ? 0 : game.iflags.menu_headings?.attr ?? 1,
                game.program_state.gameover ? NO_COLOR : game.iflags.menu_headings?.color ?? NO_COLOR);
            for (const { command, description } of entries) {
                const markers = `${command.flags & flags.CMD_M_PREFIX ? 'm' : ''}${command.flags & flags.AUTOCOMPLETE ? 'A' : ''}`;
                label(` ${(command.name ?? '').padEnd(14)} ${(markers ? `[${markers}]` : '').padStart(4)} ${description}`);
                found++;
            }
            label('');
        }
        if (search && !found) label('no matches');
        else {
            label('[A] Command autocompletes');
            label(`[m] Command accepts '${visibleCommandKey(game.commandBindings.keyForCommand('reqmenu'))}' prefix`);
        }
        tty_end_menu(window);
        const result = await tty_select_menu(window, PICK_ONE);
        await tty_destroy_nhwindow(window);
        const action = result.selections[0]?.identifier;
        if (action === 'a') autocompleteOnly = !autocompleteOnly;
        else if (action === 'z') { oneList = !oneList; search = ''; }
        else if (action === 's') search = '';
        else if (action === ':') {
            const phrase = await getLine('Extended command list search phrase?', (_ch, key) => key >= 32);
            search = phrase?.trim().replace(/\s+/g, ' ') ?? '';
            if (!search) {
                game.context.move = 0;
                return;
            }
        } else {
            game.context.move = 0;
            return;
        }
    }
}

// C doextlist() changes the description before both searching and display.
function listedCommandDescription(command: NativeCommand): string {
    const description = commandDescription(command);
    if (game.flags.debug || game.flags.explore || !(command.flags & flags.GENERALCMD))
        return description;
    return description.replace(' been genocided or become extinct', ' been genocided');
}

function matchesSearch(text: string, pattern: string): boolean {
    if (text.toLowerCase().includes(pattern.toLowerCase())) return true;
    const expression = [...pattern].map(character => character === '*' ? '.*'
        : character === '?' ? '.' : character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    return new RegExp(`^${expression}$`, 'i').test(text);
}
