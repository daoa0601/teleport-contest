// C pager.c:dispfile_*, docontact(), dowhatdoes[_core](), domenucontrols().
import { COMMAND_DESCRIPTIONS } from './command_descriptions.js';
import { visibleCommandKey } from './command_keys.js';
import { clearMessageWindow, displayMessageWindow, flushPendingTopline, pline, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { HELP_FILES } from './help_files.js';
import { promptKey, restoreCommandMap } from './tty_prompts.js';
import { showTextWindow } from './windows.js';
let whatdoesTipShown = false;
export async function displayHelpFile(name, keyHelp = false) {
    clearMessageWindow();
    const lines = HELP_FILES.get(name);
    if (!lines) {
        await pline(`Cannot open "${name}".`);
        return;
    }
    // tty_display_file expands tabs before putstr; whatdoes_help instead
    // discards comments and the leading indentation in KEYHELP.
    const content = keyHelp ? lines.filter(line => !line.startsWith('#')).map(line => line.replace(/^[ \t]+/, ''))
        : lines.map(expandTabs);
    if (content.length)
        await displayPagerText(content);
    game.context.move = 0;
}
// tty_display_nhwindow(NHW_TEXT) forces full width. Its final More prompt
// stays on the bottom row even when the text fits on a short last page.
export async function displayPagerText(lines) {
    await displayMessageWindow();
    await showTextWindow(lines);
    await restoreCommandMap();
}
function expandTabs(line) {
    let text = '';
    for (const ch of line)
        text += ch === '\t' ? ' '.repeat(8 - text.length % 8) : ch;
    return text;
}
export async function contactHelp() {
    await displayPagerText([
        'To contact the NetHack development team directly,',
        "see the 'Contact' form on our website or email <devteam@nethack.org>.",
        '',
        'For more information on NetHack, or to report a bug,',
        'visit our website "https://www.nethack.org/".',
    ]);
}
export async function whatdoes() {
    if (!whatdoesTipShown) {
        await pline(`Ask about '&' or '?' to get more info.${game.iflags.altmeta ? '  (For ESC, type it twice.)' : ''}`);
        whatdoesTipShown = true;
    }
    await flushPendingTopline();
    let key = (await promptKey('What command?')) & 255;
    if (!key)
        key = 27;
    if (key === 27 && game.iflags.altmeta) {
        key = (await promptKey(']')) & 255;
        if (key !== 27)
            key |= 128;
    }
    clearMessageWindow();
    const description = commandDescription(key);
    if (description !== null) {
        if (key === 38 || key === 63)
            await displayHelpFile('keyhelp', true);
        const prefix = keyText(key).padEnd(8);
        const newline = description.indexOf('\n');
        if (newline < 0)
            await plineWithContinuation(`${prefix}${description}.`);
        else {
            await plineWithContinuation(`${prefix}${description.slice(0, newline)},`);
            await plineWithContinuation(`${prefix}${description.slice(newline + 1)}.`);
        }
    }
    else
        await pline(`No such command '${visibleCommandKey(key)}', char code ${key} (0${key.toString(8).padStart(3, '0')} or 0x${key.toString(16).padStart(2, '0')}).`);
    game.context.move = 0;
}
// C cmd.c:key2extcmddesc() checks numeric prefixes and special keys before
// the current command binding. Movement descriptions come from extcmdlist.
export function commandDescription(key) {
    const bindings = game.commandBindings;
    // key2extcmddesc() calls movecmd() before describing any key. Movement
    // replaces dx/dy; failed checks clear dz, including after a stair key.
    const movement = bindings.movementForKey(key);
    if (movement) {
        game.u.dx = movement.dx;
        game.u.dy = movement.dy;
    }
    game.u.dz = 0;
    if (key >= 48 && key <= 57 || bindings.numberPad && (key & 127) >= 48 && (key & 127) <= 57) {
        if (!bindings.numberPad)
            return 'start of, or continuation of, a count';
        if ((key & 127) === 53)
            return `${bindings.pcHack !== (key === (53 | 128)) ? 'run' : 'rush'} prefix`;
        if (key === 48 || bindings.pcHack && key === (48 | 128))
            return "synonym for 'i'";
    }
    if (key === 27)
        return 'cancel current prompt or pending prefix';
    if (bindings.numberPad && key === bindings.specialKey('count'))
        return 'Prefix: for digits when preceding a command with a count';
    const command = bindings.lookup(key)?.command;
    if (!command?.name)
        return null;
    const text = COMMAND_DESCRIPTIONS.get(command.name);
    if (!text)
        return null;
    if (command.name === '#')
        return text;
    const description = command.name === 'reqmenu'
        ? text.replace(/^prefix:/, 'movement prefix: move without autopickup and without attacking\nnon-movement prefix:') : text;
    return `${description} (#${command.name})`;
}
export function keyText(key) {
    return key === 32 ? '<space>' : key === 27 ? '<esc>'
        : key === 10 ? '<enter>' : key === 127 ? '<del>' : visibleCommandKey(key);
}
export function setOptionsCommand() {
    const bindings = game.commandBindings;
    const full = bindings.keyForCommand('optionsfull');
    if (full)
        return `'${visibleCommandKey(full)}'`;
    const prefix = bindings.keyForCommand('reqmenu');
    const options = bindings.keyForCommand('options');
    return `'#optionsfull' or '${prefix ? visibleCommandKey(prefix) : '#reqmenu'} ${options ? visibleCommandKey(options) : '#options'}'`;
}
export async function menuControlsHelp() {
    const wholeAndPage = (label, whole, page) => `${label.padStart(8)}     ${whole.padEnd(6)} ${page}`;
    const goTo = (key, name) => wholeAndPage('', key, name);
    await displayPagerText([
        'Menu control keys:', '',
        '           Whole  Current', '            Menu   Page',
        wholeAndPage('Select', '.', ','), wholeAndPage('Invert', '@', '~'),
        wholeAndPage('Deselect', '-', '\\'), '',
        wholeAndPage('Go to', '>', 'Next page'), goTo('<', 'Previous page'),
        goTo('^', 'First page'), goTo('|', 'Last page'), '',
        wholeAndPage('Search', ':', 'Exter a target string and invert all matching entries'), '',
        '   Other   Return   Accept current choice(s) and dismiss menu',
        '           Enter    Same as Return',
        '           Space    If not on last page, advance one page;',
        '                    when on last page, treat like Return',
        '           Escape   Cancel menu without making any choice(s)',
    ]);
}
//# sourceMappingURL=pager_help.js.map