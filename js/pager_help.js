// C pager.c:dispfile_*, docontact(), domenucontrols().
import { visibleCommandKey } from './command_keys.js';
import { clearMessageWindow, displayMessageWindow, pline } from './display.js';
import { game } from './gstate.js';
import { HELP_FILES } from './help_files.js';
import { restoreCommandMap } from './tty_prompts.js';
import { showTextWindow } from './windows.js';
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