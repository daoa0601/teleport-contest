// coloratt.c: color/attribute name tables, name matching, and the
// interactive query_color()/query_attr() pickers shared by the options
// menus, menu-color editing, and status-hilite rule editing.
import { game } from './gstate.js';
import { fuzzyMatch } from './hacklib.js';
import { PosixRegex } from './posix_regex.js';
import { showMultiSelectWindow } from './windows.js';
import { BUFSZ, CLR_MAX, HL_BLINK, HL_BOLD, HL_DIM, HL_INVERSE, HL_ITALIC, HL_NONE, HL_ULINE,
    MENU_ITEMFLAGS_SELECTED } from './const.js';
import { NO_COLOR } from './terminal.js';
import { C_ATR_NONE, terminalAttrFromCAttr } from './color_attr.js';

// C hack.h:struct menucoloring (gm.menu_colorings, coloratt.c's menu-color
// rule), kept newest first. attr holds the C ATR_* value (wintype.h), color a
// CLR_* constant; regex is the compiled pattern (the C rule keeps its
// regex_t in ->match).
export interface MenuColoringRule {
    origstr: string;
    color: number;
    attr: number;
    regex: PosixRegex;
}


// Part of C cfgfiles.c:vconfig_error_add(): the BUFSZ-1 byte cut, kept
// UTF-8 safe.
// vconfig_error_add()'s BUFSZ-1 cut and printf's %.Ns precision count
// bytes; a UTF-8 sequence split by the cut survives as one character.
export function cutConfigBytes(text: string, limit: number): string {
    return new TextDecoder().decode(new TextEncoder().encode(text).subarray(0, limit));
}


// C coloratt.c:colornames[]: the sixteen canonical names first (the picker
// and clr2colorname() stop at the null entry), aliases after them.  Values
// are CLR_* constants.
export const COLOR_NAMES: readonly (readonly [string, number])[] = [
    ['black', 0], ['red', 1], ['green', 2], ['brown', 3], ['blue', 4],
    ['magenta', 5], ['cyan', 6], ['gray', 7], ['orange', 9],
    ['light green', 10], ['yellow', 11], ['light blue', 12],
    ['light magenta', 13], ['light cyan', 14], ['white', 15], ['no color', 8],
    ['transparent', 8], ['purple', 5], ['light purple', 13],
    ['bright purple', 13], ['grey', 7], ['bright red', 9], ['bright green', 10],
    ['bright blue', 12], ['bright magenta', 13], ['bright cyan', 14],
];
// C coloratt.c:attrnames[]; values are the wintype.h ATR_* constants.
export const ATTRIBUTE_NAMES: readonly (readonly [string, number])[] = [
    ['none', 0], ['bold', 1], ['dim', 2], ['italic', 3], ['underline', 4],
    ['blink', 5], ['inverse', 7],
    ['normal', 0], ['uline', 4], ['reverse', 7],
];

// C coloratt.c:color_attr_to_str()
export function colorAttrToString(style: { attr: number; color: number }): string {
    return `${colorName(style.color)}&${attributeName(style.attr)}`;
}

// C coloratt.c:color_attr_parse_str(): "color&attr", "color", or "attr"
// (a lone name is tried as an attribute first). Returns null on failure;
// matchColorName()/matchAttributeName() emit C's diagnostics.
export function parseColorAttr(
    text: string, addError: (message: string) => void,
): { attr: number; color: number } | null {
    const ampersand = text.indexOf('&');
    if (ampersand >= 0) {
        const left = text.slice(0, ampersand);
        const right = text.slice(ampersand + 1);
        let color = matchColorName(left, addError);
        let attr = matchAttributeName(right, addError);
        if (color >= CLR_MAX && attr === -1) {
            color = matchColorName(right, addError);
            attr = matchAttributeName(left, addError);
        }
        if (color >= CLR_MAX || attr === -1) return null;
        return { attr, color };
    }
    const attr = matchAttributeName(text, null);
    if (attr !== -1) return { attr, color: NO_COLOR };
    const color = matchColorName(text, addError);
    return color >= CLR_MAX ? null : { attr: C_ATR_NONE, color };
}

// C coloratt.c:attr2attrname(); uses the first canonical table
// entry naming the value.
export function attributeName(attr: number): string {
    return ATTRIBUTE_NAMES.find(([, value]) => value === attr)?.[0] ?? 'none';
}

// C coloratt.c:clr2colorname(): the first canonical table
// entry naming the value.
export function colorName(color: number): string {
    return COLOR_NAMES.find(([, value]) => value === color)?.[0] ?? 'no color';
}

// C coloratt.c:match_str2clr()
// Returns CLR_MAX (16) when nothing matched. A
// non-null addError mirrors the unsuppressed config_error_add() calls.
export function matchColorName(text: string, addError: ((message: string) => void) | null): number {
    const named = COLOR_NAMES.find(([name]) => fuzzyMatch(text, name));
    if (named) return named[1];
    const digits = text.match(/^\d+/)?.[0];
    const color = digits === undefined ? 16 : Number(digits);
    if (color < 0 || color >= 16) {
        addError?.(`Unknown color '${cutConfigBytes(text, 60)}'`);
        return 16;
    }
    return color;
}

// C coloratt.c:match_str2attr()
// Returns -1 when nothing matched.
export function matchAttributeName(text: string, addError: ((message: string) => void) | null): number {
    const named = ATTRIBUTE_NAMES.find(([name]) => fuzzyMatch(text, name));
    if (named) return named[1];
    addError?.(`Unknown text attribute '${cutConfigBytes(text, 50)}'`);
    return -1;
}

// C coloratt.c:query_attr(): the attribute menu.  A prompt whose first six
// characters are "Choose" (case-insensitive) takes PICK_ANY so several
// attributes can combine into HL_* bits (HL_NONE alone for "none"), with
// the dflt_attr row preselected and the ATR_NONE row dropping out of the
// result unless it is the only choice; any other prompt takes PICK_ONE
// over the canonical attribute names, each drawn in its own attribute,
// where an accepted empty pick keeps dflt_attr and a second entry behind
// the default wins over it.  Escape (or an accepted empty PICK_ANY)
// returns -1.
const ATR_TO_HL: ReadonlyMap<number, number> = new Map([
    [0, HL_NONE], [1, HL_BOLD], [2, HL_DIM], [3, HL_ITALIC],
    [4, HL_ULINE], [5, HL_BLINK], [7, HL_INVERSE],
]);

export async function queryAttr(prompt: string | null, dfltAttr: number): Promise<number> {
    const allowMany = prompt !== null && prompt.slice(0, 6).toLowerCase() === 'choose';
    const picks = await showMultiSelectWindow<number>({
        title: prompt || 'Pick an attribute', omitHeadings: true,
        pickOne: !allowMany, signalEscape: true, pageLocalKeys: true,
        sections: [{ items: ATTRIBUTE_NAMES.slice(0, 7).map(([name, attr]) => ({
            value: attr, text: name, attr: terminalAttrFromCAttr(attr),
            itemFlags: attr === dfltAttr ? MENU_ITEMFLAGS_SELECTED : 0,
        })) }],
    });
    if (picks === null) return -1;
    if (!allowMany) {
        if (!picks.length) return dfltAttr;
        const [chosen = dfltAttr, alternate] = picks;
        return alternate !== undefined && chosen === dfltAttr ? alternate : chosen;
    }
    if (!picks.length) return -1;
    let bits = 0;
    for (const attr of picks) {
        if (attr !== 0 || picks.length === 1) bits |= ATR_TO_HL.get(attr) ?? 0;
    }
    return bits;
}

// C coloratt.c:query_color()
// PICK_ONE over the canonical color names; Escape
// is -1, an accepted-but-empty pick keeps the current value, and a second
// entry behind "no color" wins over it. Each name is colored by the
// temporary basic_menu_colors() rule that matches it.
export async function queryColorMenu(title: string, current: number): Promise<number | null> {
    basicMenuColors(true);
    let picks: number[] | null;
    try {
        picks = await showMultiSelectWindow<number>({
            title: title || 'Pick a color', omitHeadings: true, pickOne: true,
            signalEscape: true, pageLocalKeys: true,
            sections: [{ items: COLOR_NAMES.slice(0, 16).map(([name, color]) => ({
                value: color, text: name,
                itemFlags: color === current ? MENU_ITEMFLAGS_SELECTED : 0,
            })) }],
        });
    } finally {
        basicMenuColors(false);
    }
    if (picks === null) return null;
    if (!picks.length) return current;
    const [chosen = current, alternate] = picks;
    return alternate !== undefined && chosen === NO_COLOR ? alternate : chosen;
}

// coloratt.c:basic_menu_colors(): query_color() temporarily replaces the
// player's rules with one coloring per canonical color name (black, white,
// and "no color" stay plain) and forces menucolors on; the alternate list
// is built once and reused (gc.color_colorings). Rules are prepended in
// colornames order, so the "light <foo>" names end up ahead of the basic
// ones and win as substrings.
let alternateMenuColors: MenuColoringRule[] | null = null;
let savedMenuColors: { menucolors: boolean; colorings: MenuColoringRule[] | null } | null = null;

// C coloratt.c:basic_menu_colors()
function basicMenuColors(loadColors: boolean): void {
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
            if (color === 0 || color === 15 || color === NO_COLOR) continue;
            game.iflags.menuColorings.unshift(
                { origstr: name, color, attr: C_ATR_NONE, regex: new PosixRegex(name) });
        }
        alternateMenuColors = game.iflags.menuColorings;
    } else if (savedMenuColors) {
        game.flags.menucolors = savedMenuColors.menucolors;
        if (savedMenuColors.colorings) game.iflags.menuColorings = savedMenuColors.colorings;
        else delete game.iflags.menuColorings;
        savedMenuColors = null;
    }
}

// C coloratt.c:add_menu_coloring(). The compiled pattern is kept on the
// rule like C's ->match regex_t; the first matching rule (newest first)
// colors the menu entry at the add_menu() seam.
export function parseMenuColoring(valueText: string, addError: (message: string) => void): MenuColoringRule | null {
    // coloratt.c copies the statement into str[BUFSZ] before parsing, so a
    // '=' past byte 255 is invisible and the line looks malformed.
    const value = cutConfigBytes(valueText, BUFSZ - 1);
    const equals = value.indexOf('=');
    if (equals < 0) {
        addError('Malformed MENUCOLOR');
        return null;
    }
    let tail = value.slice(equals + 1).replace(/[ \t]+/g, ' ').trim();
    const ampersand = tail.indexOf('&');
    if (ampersand >= 0) tail = tail.slice(0, ampersand);
    const color = matchColorName(tail, addError);
    if (color >= CLR_MAX) return null;
    let attr = 0;
    if (ampersand >= 0) {
        const attribute = value.slice(equals + 1)
            .replace(/[ \t]+/g, ' ').trim().slice(ampersand + 1);
        attr = matchAttributeName(attribute, addError);
        if (attr === -1) return null;
    }
    // The regexp portion is not condensed by mungspaces(); a matching pair
    // of quotes around it is stripped.
    let pattern = value.slice(0, equals);
    const quote = pattern.charAt(0);
    if (quote === '"' || quote === '\'') {
        let end = pattern.length - 1;
        while (end >= 0 && /[ \t]/.test(pattern.charAt(end))) end--;
        if (pattern.charAt(end) === quote) pattern = pattern.slice(1, end);
    }
    let regex: PosixRegex;
    try {
        regex = new PosixRegex(pattern);
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        addError(`Menucolor regex error: ${error.message}`);
        return null;
    }
    return { origstr: pattern, color, attr, regex };
}
