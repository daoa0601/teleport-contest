// coloratt.c: color/attribute name tables, name matching, and the
// interactive query_color()/query_attr() pickers shared by the options
// menus, menu-color editing, and status-hilite rule editing.
import { game } from './gstate.js';
import { PosixRegex } from './posix_regex.js';
import { showMultiSelectWindow } from './windows.js';
import { HL_BLINK, HL_BOLD, HL_DIM, HL_INVERSE, HL_ITALIC, HL_NONE, HL_ULINE, MENU_ITEMFLAGS_SELECTED } from './const.js';
import { NO_COLOR } from './terminal.js';
import { C_ATR_NONE, terminalAttrFromCAttr } from './color_attr.js';
// vconfig_error_add()'s BUFSZ-1 cut and printf's %.Ns precision count
// bytes; a UTF-8 sequence split by the cut survives as one character.
export function cutConfigBytes(text, limit) {
    return new TextDecoder().decode(new TextEncoder().encode(text).subarray(0, limit));
}
// C hacklib.c:fuzzymatch(): compare while skipping ' ', '-', '_' and
// folding case.
export function fuzzyMatch(input, name) {
    const skip = (character) => character === ' ' || character === '-' || character === '_';
    let i = 0, j = 0;
    for (;;) {
        while (skip(input[i]))
            i++;
        while (skip(name[j]))
            j++;
        const a = input[i], b = name[j];
        if (a === undefined || b === undefined)
            break;
        if (a.toLowerCase() !== b.toLowerCase())
            return false;
        i++;
        j++;
    }
    return input[i] === undefined && name[j] === undefined;
}
// C coloratt.c:colornames[]: the sixteen canonical names first (the picker
// and clr2colorname() stop at the null entry), aliases after them.  Values
// are CLR_* constants.
export const COLOR_NAMES = [
    ['black', 0], ['red', 1], ['green', 2], ['brown', 3], ['blue', 4],
    ['magenta', 5], ['cyan', 6], ['gray', 7], ['orange', 9],
    ['light green', 10], ['yellow', 11], ['light blue', 12],
    ['light magenta', 13], ['light cyan', 14], ['white', 15], ['no color', 8],
    ['transparent', 8], ['purple', 5], ['light purple', 13],
    ['bright purple', 13], ['grey', 7], ['bright red', 9], ['bright green', 10],
    ['bright blue', 12], ['bright magenta', 13], ['bright cyan', 14],
];
// C coloratt.c:attrnames[]; values are the wintype.h ATR_* constants.
export const ATTRIBUTE_NAMES = [
    ['none', 0], ['bold', 1], ['dim', 2], ['italic', 3], ['underline', 4],
    ['blink', 5], ['inverse', 7],
    ['normal', 0], ['uline', 4], ['reverse', 7],
];
// coloratt.c:clr2colorname()/attr2attrname(): the first canonical table
// entry naming the value.
export function colorName(color) {
    return COLOR_NAMES.find(([, value]) => value === color)?.[0] ?? 'no color';
}
export function attributeName(attr) {
    return ATTRIBUTE_NAMES.find(([, value]) => value === attr)?.[0] ?? 'none';
}
// coloratt.c:match_str2clr(); returns CLR_MAX (16) when nothing matched.  A
// non-null addError mirrors the unsuppressed config_error_add() calls.
export function matchColorName(text, addError) {
    const named = COLOR_NAMES.find(([name]) => fuzzyMatch(text, name));
    if (named)
        return named[1];
    const digits = text.match(/^\d+/)?.[0];
    const color = digits === undefined ? 16 : Number(digits);
    if (color < 0 || color >= 16) {
        addError?.(`Unknown color '${cutConfigBytes(text, 60)}'`);
        return 16;
    }
    return color;
}
// coloratt.c:match_str2attr(); returns -1 when nothing matched.
export function matchAttributeName(text, addError) {
    const named = ATTRIBUTE_NAMES.find(([name]) => fuzzyMatch(text, name));
    if (named)
        return named[1];
    addError?.(`Unknown text attribute '${cutConfigBytes(text, 50)}'`);
    return -1;
}
// coloratt.c:basic_menu_colors(): query_color() temporarily replaces the
// player's rules with one coloring per canonical color name (black, white,
// and "no color" stay plain) and forces menucolors on; the alternate list
// is built once and reused (gc.color_colorings). Rules are prepended in
// colornames order, so the "light <foo>" names end up ahead of the basic
// ones and win as substrings.
let alternateMenuColors = null;
let savedMenuColors = null;
function basicMenuColors(loadColors) {
    if (loadColors) {
        savedMenuColors = { menucolors: game.flags.menucolors === true,
            colorings: game.iflags.menuColorings ?? null };
        game.flags.menucolors = true;
        if (alternateMenuColors) {
            game.iflags.menuColorings = alternateMenuColors;
            return;
        }
        game.iflags.menuColorings = [];
        for (const [name, color] of COLOR_NAMES.slice(0, 16)) {
            if (color === 0 || color === 15 || color === NO_COLOR)
                continue;
            game.iflags.menuColorings.unshift({ origstr: name, color, attr: C_ATR_NONE, regex: new PosixRegex(name) });
        }
        alternateMenuColors = game.iflags.menuColorings;
    }
    else if (savedMenuColors) {
        game.flags.menucolors = savedMenuColors.menucolors;
        if (savedMenuColors.colorings)
            game.iflags.menuColorings = savedMenuColors.colorings;
        else
            delete game.iflags.menuColorings;
        savedMenuColors = null;
    }
}
// coloratt.c:query_color(): PICK_ONE over the canonical color names; Escape
// is -1, an accepted-but-empty pick keeps the current value, and a second
// entry behind "no color" wins over it. Each name is colored by the
// temporary basic_menu_colors() rule that matches it.
export async function queryColorMenu(title, current) {
    basicMenuColors(true);
    let picks;
    try {
        picks = await showMultiSelectWindow({
            title: title || 'Pick a color', omitHeadings: true, pickOne: true,
            signalEscape: true, pageLocalKeys: true,
            sections: [{ items: COLOR_NAMES.slice(0, 16).map(([name, color]) => ({
                        value: color, text: name,
                        itemFlags: color === current ? MENU_ITEMFLAGS_SELECTED : 0,
                    })) }],
        });
    }
    finally {
        basicMenuColors(false);
    }
    if (picks === null)
        return null;
    if (!picks.length)
        return current;
    const [chosen = current, alternate] = picks;
    return alternate !== undefined && chosen === NO_COLOR ? alternate : chosen;
}
// coloratt.c:query_attr(): PICK_ONE over the canonical attribute names, each
// drawn in its own attribute; a second entry behind the current default wins
// over it.
export async function queryAttributeMenu(title, current) {
    const picks = await showMultiSelectWindow({
        title: title || 'Pick an attribute', omitHeadings: true, pickOne: true,
        signalEscape: true, pageLocalKeys: true,
        sections: [{ items: ATTRIBUTE_NAMES.slice(0, 7).map(([name, attr]) => ({
                    value: attr, text: name, attr: terminalAttrFromCAttr(attr),
                    itemFlags: attr === current ? MENU_ITEMFLAGS_SELECTED : 0,
                })) }],
    });
    if (picks === null)
        return null;
    if (!picks.length)
        return current;
    const [chosen = current, alternate] = picks;
    return alternate !== undefined && chosen === current ? alternate : chosen;
}
// coloratt.c:query_attr() with a "Choose..." prompt: PICK_ANY so several
// attributes can combine, returning HL_* bits (HL_NONE alone for "none"),
// or -1 on Escape / an accepted empty pick. The ATR_NONE row is preselected
// and drops out of the result unless it is the only choice.
const ATR_TO_HL = new Map([
    [0, HL_NONE], [1, HL_BOLD], [2, HL_DIM], [3, HL_ITALIC],
    [4, HL_ULINE], [5, HL_BLINK], [7, HL_INVERSE],
]);
export async function queryAttributeSet(title) {
    const picks = await showMultiSelectWindow({
        title: title || 'Pick an attribute', omitHeadings: true, signalEscape: true,
        pageLocalKeys: true,
        sections: [{ items: ATTRIBUTE_NAMES.slice(0, 7).map(([name, attr]) => ({
                    value: attr, text: name, attr: terminalAttrFromCAttr(attr),
                    itemFlags: attr === 0 ? MENU_ITEMFLAGS_SELECTED : 0,
                })) }],
    });
    if (picks === null || !picks.length)
        return -1;
    let bits = 0;
    for (const attr of picks) {
        if (attr !== 0 || picks.length === 1)
            bits |= ATR_TO_HL.get(attr) ?? 0;
    }
    return bits;
}
//# sourceMappingURL=color_query.js.map