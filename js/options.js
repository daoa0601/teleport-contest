// options.js — the option-table strays that are not options.c:
// hacklib.c visctrl() (the diagnostics spelling; hacklib.js holds the
// command-key twin) and symbols.c:do_symset() with its symbol-set list.
import { game } from './gstate.js';
import { reglyphSymbolSet } from './display.js';
import { showInventoryWindow } from './windows.js';
import { PICK_ONE, Is_rogue_level } from './const.js';
// Part of C options.c:illegal_menu_cmd_key(): the hacklib.c visctrl
// spelling of a reserved byte.
// C hacklib.c visctrl(): how diagnostics name a control or meta byte.
export function visctrl(code) {
    let text = '';
    if (code > 0x7f)
        text += 'M-';
    const c = code & 0x7f;
    if (c < 0x20)
        text += `^${String.fromCharCode(c | 0x40)}`;
    else if (c === 0x7f)
        text += '^?';
    else
        text += String.fromCharCode(c);
    return text;
}
// dat/symbols `start:` entries in file order with their `Description:` and
// `Restrictions:` lines, minus MACgraphics whose H_MAC handling both
// do_symset() menus exclude (it stays loadable through the option).
// fields: name, description, restricted to primary sets, restricted to
// rogue sets.
const SYMSET_LIST = [
    ['plain', "same as default symbols, except '+' for corner walls", false, false],
    ['Blank', 'completely blank symbols', false, false],
    ['IBMgraphics', 'special line-drawing characters used for walls', false, false],
    ['IBMGraphics_1', '', false, false],
    ['IBMGraphics_2', '', false, false],
    ['RogueIBM', '', false, true],
    ['RogueEpyx', 'rogue level color symbol set like Epyx Rogue', false, true],
    ['RogueWindows', '', false, true],
    ['curses', 'approximation of IBMgraphics using DECgraphics', true, false],
    ['DECgraphics', 'special line-drawing characters used for walls', true, false],
    ['Enhanced1', 'Enhanced with Unicode glyphs and 24-bit color', true, false],
    ['Enhanced2', 'Enhanced with more Unicode glyphs and 24-bit color', true, false],
    ['AmigaFont', 'Amiga hack.font line-drawing and effect characters', false, false],
];
// C symbols.c:do_symset(): the symbol-set picker.
// symbols.c:do_symset(): pick-list of every set the symbols file carries,
// filtered by restrictions, with "Default Symbols" first and the current
// choice preselected.  handler_symset() flags a redraw even when nothing
// changes; switch_symbols()/assign_graphics() only re-skin the glyphs.
export async function editSymset(rogueflag) {
    const current = (rogueflag ? game.rogueSymset : game.symset)?.toLowerCase() ?? null;
    // add_menu() assigns the letters in order, so spelling them out keeps
    // the native rows while letting showInventoryWindow preselect the
    // current choice for PICK_ONE's "preset and new pick" resolution.
    const items = [
        { key: 'a', value: 'default', text: 'Default Symbols' },
        ...SYMSET_LIST.filter(([, , primary, rogue]) => rogueflag ? !primary : !rogue)
            .map(([name, desc], index) => ({
            key: String.fromCharCode('b'.charCodeAt(0) + index),
            value: name,
            text: `${name.padEnd(17)} ${desc}`,
        })),
    ];
    const currentKey = current
        ? items.find(item => item.value?.toLowerCase() === current)?.key ?? null
        : 'a';
    const selection = await showInventoryWindow([{ items }], {
        title: rogueflag ? 'Select rogue level symbol set:' : 'Select symbol set:',
        pickMode: PICK_ONE,
        preselectedKey: currentKey,
    });
    if (selection.key !== 27) {
        // do_symset() leaves defindx at 0 when the current choice has no
        // row in the picker (a rogue-restricted primary set, the H_MAC
        // set); an empty pick is then nothing_to_do, and only a listed
        // preset is reapplied.
        const preset = rogueflag ? game.rogueSymset : game.symset;
        if (selection.value === undefined && currentKey === null)
            return true;
        const chosen = selection.value === undefined ? preset ?? null
            : selection.value === 'default' ? null : selection.value;
        if (rogueflag)
            game.rogueSymset = chosen;
        else
            game.symset = chosen;
        const rogueLevel = Is_rogue_level(game.u.uz);
        // do_symset() calls switch_symbols(TRUE) for every named set;
        // that copies primary symbols without changing currentgraphics.
        if (chosen !== null || !rogueflag && !rogueLevel)
            game.shownSymbols = { rogue: false, name: game.symset ?? null };
        if (rogueflag && rogueLevel)
            game.shownSymbols = { rogue: true, name: game.rogueSymset ?? null };
        reglyphSymbolSet();
    }
    return true;
}
//# sourceMappingURL=options.js.map