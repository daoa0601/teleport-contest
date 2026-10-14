// C cmd.c:key2extcmddesc()/dokeylist(), pager.c:dowhatdoes().
import { NATIVE_COMMAND_FLAGS as flags, NATIVE_COMMANDS } from './command_data.js';
import type { NativeCommand } from './command_types.js';
import { commandDescription } from './extended_commands.js';
import { visibleCommandKey } from './command_keys.js';
import { flushPendingTopline, pline, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { rememberCommandKey, takeRepeatCommand } from './command_repeat.js';
import { promptKey, restoreCommandMap } from './tty_prompts.js';
import { showTextWindow } from './windows.js';
import { KEY_HELP } from './keyhelp_data.js';

// C misc_keys[] supplies descriptions to both key help and the bindings list.
const miscellaneousKeys = [
    { name: 'escape', description: 'cancel current prompt or pending prefix', numberPadOnly: false },
    { name: 'count', description: 'Prefix: for digits when preceding a command with a count', numberPadOnly: true },
] as const;

function keyText(key: number): string {
    return key === 32 ? '<space>' : key === 27 ? '<esc>'
        : key === 10 ? '<enter>' : key === 127 ? '<del>' : visibleCommandKey(key);
}

export function describeCommandKey(key: number): string | null {
    const bindings = game.commandBindings;
    // key2extcmddesc() probes movecmd() in walk, rush, then run mode.
    // Each probe updates u.dz, even when the key is not a movement command.
    for (const mode of [0, 2, 1]) {
        const movement = bindings.movementForKey(key, mode);
        game.u.dz = movement?.dz ?? 0;
        if (!movement) continue;
        game.u.dx = movement.dx;
        game.u.dy = movement.dy;
        if (!movement.dz) break;
    }
    if (key >= 48 && key <= 57 && !bindings.numberPad)
        return 'start of, or continuation of, a count';
    if (bindings.numberPad) {
        if (key === 53 || key === 181)
            return `${bindings.pcHack !== (key === 181) ? 'run' : 'rush'} prefix`;
        if (key === 48 || bindings.pcHack && key === 176) return "synonym for 'i'";
    }
    for (const special of miscellaneousKeys) {
        if (special.numberPadOnly && !bindings.numberPad) continue;
        const code = special.name === 'escape' ? 27 : bindings.specialKey(special.name);
        if (key === code) return special.description;
    }
    const command = bindings.lookup(key)?.command;
    if (!command) return null;
    if (command.handler === 'do_reqmenu')
        return 'movement prefix: move without autopickup and without attacking\nnon-movement prefix: request menu or modify command (#reqmenu)';
    return commandDescription(command) + (command.name === '#' ? '' : ` (#${command.name})`);
}

export async function whatDoesCommand(): Promise<void> {
    if (!game._whatdoesShown) {
        await pline(`Ask about '&' or '?' to get more info.${game.iflags.altmeta ? '  (For ESC, type it twice.)' : ''}`);
        game._whatdoesShown = true;
    }
    const readKey = async (prompt: string) => {
        const queued = takeRepeatCommand();
        if (queued) return queued.kind === 'key' ? queued.key : 27;
        await flushPendingTopline();
        const key = await promptKey(prompt);
        rememberCommandKey(key);
        return key;
    };
    let key = await readKey('What command? ');
    if (key === 27 && game.iflags.altmeta) {
        key = await readKey('] ');
        if (key !== 27) key |= 128;
    }
    const description = describeCommandKey(key);
    if (description === null)
        await pline(`No such command '${visibleCommandKey(key)}', char code ${key} (0${key.toString(8).padStart(3, '0')} or 0x${key.toString(16).padStart(2, '0')}).`);
    else {
        if (key === 38 || key === 63) {
            await showTextWindow(KEY_HELP);
            await restoreCommandMap();
        }
        const [first = '', second] = description.split('\n');
        await pline(`${keyText(key).padEnd(8)}${first}${second ? ',' : '.'}`);
        if (second) await plineWithContinuation(`${keyText(key).padEnd(8)}${second}.`);
    }
    game.context.move = 0;
}

export async function showKeyBindings(): Promise<void> {
    const bindings = game.commandBindings;
    const used = new Set([3]); // SIGINT is reserved even if a key is rebound.
    const lines = ['', '            Full Current Key Bindings List',
        '        (also commands with no key assignment)', '', 'Directional keys:'];
    const key = (direction: number) => visibleCommandKey(bindings.keyForDirection(direction));
    lines.push(`          ${key(1)}  ${key(2)}  ${key(3)}`, '           \\ | / ',
        `          ${key(0)}- . -${key(4)}`, '           / | \\ ',
        `          ${key(7)}  ${key(6)}  ${key(5)}`, '');
    if (!bindings.numberPad) lines.push(
        'Ctrl+<direction> will run in specified direction until something very',
        '        interesting is seen.');
    lines.push(`${bindings.numberPad ? 'Meta' : 'Shift'}+<direction> will run in specified direction until you encounter`,
        '        an obstacle.', '', 'Miscellaneous keys:');
    for (const special of miscellaneousKeys) {
        if (special.numberPadOnly && !bindings.numberPad) continue;
        const code = special.name === 'escape' ? 27 : bindings.specialKey(special.name);
        if (!code || used.has(code)) continue;
        used.add(code);
        lines.push(`${keyText(code).padEnd(7)} ${special.description}`);
    }
    lines.push('^C      interrupt: break out of NetHack (SIGINT)', '', 'Menu control keys:');
    for (const [control, description] of [
        ['>', 'Go to next page'], ['<', 'Go to previous page'], ['^', 'Go to first page'],
        ['|', 'Go to last page'], ['.', 'Select all items in entire menu'],
        ['@', 'Invert selection for all items'], ['-', 'Unselect all items in entire menu'],
        [',', 'Select all items on current page'], ['~', "Invert current page's selections"],
        ['\\', 'Unselect all items on current page'], [':', 'Search and invert matching items'],
        ['Return', 'Accept current choice(s) and dismiss menu'], ['Enter', 'Same as Return'],
        ['Space', 'If not on last page, advance one page;'], ['     ', 'when on last page, treat like Return'],
        ['Escape', 'Cancel menu without making any choice(s)'],
    ]) lines.push(`${(control ?? '').padEnd(7)} ${description ?? ''}`);
    const ignored = flags.INTERNALCMD | flags.MOVEMENTCMD | flags.WIZMODECMD;
    const categories: readonly [string, (command: NativeCommand) => boolean][] = [
        ['General commands:', command => !!(command.flags & flags.GENERALCMD) && !(command.flags & ignored)],
        ['Game commands:', command => !(command.flags & (flags.GENERALCMD | ignored))],
        ['Debug mode commands:', command => !!game.flags.debug
            && !!(command.flags & flags.WIZMODECMD) && !(command.flags & flags.INTERNALCMD)],
    ];
    for (const [heading, include] of categories) {
        const commands = NATIVE_COMMANDS.filter(command => command.name !== null && include(command));
        if (!commands.length) continue;
        lines.push('', heading);
        const previouslyUsed = new Set(used);
        for (let code = 0; code < 256; code++) {
            if (used.has(code) || code === 32 && !game.flags.rest_on_space) continue;
            const binding = bindings.lookup(code);
            if (!binding?.command || !include(binding.command)) continue;
            lines.push(`${keyText(code).padEnd(7)} ${(binding.command.name ?? '').padEnd(13)} ${commandDescription(binding.command)}${binding.parameter === null ? '' : ` "${binding.parameter}"`}`);
            used.add(code);
        }
        for (const command of commands) {
            if (bindings.bindings.some(binding => !previouslyUsed.has(binding.key) && binding.command === command)) continue;
            lines.push(`#${(command.name ?? '').padEnd(20)} ${commandDescription(command)}`);
        }
    }
    await showTextWindow(lines);
    await restoreCommandMap();
    game.context.move = 0;
}
