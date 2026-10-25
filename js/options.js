// options.js — Parse .nethackrc options.
// C ref: options.c — handles OPTIONS=, BIND=, etc.
import { game } from './gstate.js';
import { clearCharacterFilter, createCharacterFilters, setCharacterFilter } from './character_filters.js';
import { findAlignment, findGender, findRace, findRole, randomCharacterOption } from './roles.js';
import { NATIVE_COMMANDS } from './command_data.js';
import { resetCommandAutocomplete, setCommandAutocomplete } from './extended_commands.js';
import { addMessageTypeRule } from './message_types.js';
import { displayHelpFile, displayPagerText } from './pager_help.js';
import { setConditionOption } from './status_conditions.js';
import { classifyStatusTerrain } from './status_terrain.js';
import { assignWarningSymbols, setWarningSymbols } from './warning_symbols.js';
import { PosixRegex } from './posix_regex.js';
import { rn2 } from './rng.js';
import { isTextOption, setTextOption, textOptionValue, cInteger, parsePickupTypes, optionError, featureAlertVersion } from './option_values.js';
import { compoundMenuValue, editCompoundMenu } from './option_editors.js';
import { CommandBindings } from './command_bindings.js';
import { changePreferredFruit, normalizePreferredFruitName } from './fruit.js';
import { bot, clearMessageWindow, displayMessageWindow, docrt, flush_screen, plineWithContinuation, reassessStatusFields, reglyph_darkroom } from './display.js';
import { vision_recalc } from './vision.js';
import { getLine } from './query.js';
import { changeInventoryOrder, inventoryOrderSymbols } from './object_sort.js';
import { chooseDiscoverySort, discoverySortDescription } from './o_init.js';
import { ATR_INVERSE, restoreMenuUnderlay, showInventoryWindow, showMultiSelectWindow, snapshotMenuUnderlay } from './windows.js';
import { CLR_BLACK, CLR_WHITE, NO_COLOR } from './terminal.js';
import { AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_FORCE, AUTOUNLOCK_KICK, AUTOUNLOCK_UNTRAP } from './const.js';
import { OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { DISCLOSURE_CATEGORIES, parseDisclosureSettings } from './end.js';
import { C_ATR_INVERSE, C_ATR_NONE, terminalAttrFromCAttr } from './color_attr.js';
import { BUFSZ, CLR_MAX, COLNO, Is_rogue_level, MENU_FULL, MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_SKIPINVERT, MENU_ITEMFLAGS_SKIPMENUCOLORS, PICK_NONE, PICK_ONE, PL_NSIZ, PL_PSIZ, WARNCOUNT, PARANOID_AUTOALL, PARANOID_BONES, PARANOID_BREAKWAND, PARANOID_CONFIRM, PARANOID_DIE, PARANOID_EATING, PARANOID_HIT, PARANOID_PRAY, PARANOID_QUIT, PARANOID_REMOVE, PARANOID_SWIM, PARANOID_TRAP, PARANOID_WERECHANGE, } from './const.js';
// C include/optlist.h, recorder build: every option table entry in file
// order — [name, alias, isBool, negateok, valok, dupeok, prefix].  The
// flags drive parseoptions()'s generic checks; options the port does not
// implement still match silently, and only unmatched elements draw
// "Unknown option".  Prefix entries (cond_, font) match the whole element
// text like str_start_is() instead of the value-less name part.
const OPTION_TABLE = [
    ['windowtype', null, false, false, true, false, false, false, false],
    ['playmode', null, false, false, true, false, false, false, false],
    ['name', null, false, false, true, false, false, false, false],
    ['role', "character", false, true, true, true, false, false, false],
    ['race', null, false, true, true, true, false, false, false],
    ['gender', null, false, true, true, true, false, false, false],
    ['alignment', "align", false, true, true, true, false, false, false],
    ['accessiblemsg', null, true, true, false, false, false, false, false],
    ['acoustics', null, true, true, false, false, false, false, false],
    ['align_message', null, false, true, true, false, false, false, false],
    ['align_status', null, false, false, true, false, false, false, false],
    ['altkeyhandling', "altkeyhandler", false, false, true, false, false, false, false],
    ['altmeta', null, true, true, false, false, false, false, false],
    ['armorstatus', null, true, true, false, false, false, false, false],
    ['ascii_map', null, true, true, false, false, false, false, false],
    ['autocompletions', null, false, false, true, false, false, true, false],
    ['autodescribe', null, true, true, false, false, false, false, false],
    ['autodig', null, true, true, false, false, false, false, false],
    ['autoopen', null, true, true, false, false, false, false, false],
    ['autopickup', null, true, true, false, false, false, false, false],
    ['autopickup exceptions', null, false, false, true, false, false, true, false],
    ['autoquiver', null, true, true, false, false, false, false, false],
    ['autounlock', null, false, true, true, false, false, false, false],
    ['bgcolors', null, true, true, false, false, false, false, false],
    ['bind keys', null, false, false, true, false, false, true, false],
    ['BIOS', null, true, false, false, false, false, false, true],
    ['blind', "permablind", true, true, false, false, false, false, false],
    ['bones', null, true, true, false, false, false, false, false],
    ['boulder', null, false, false, true, false, false, false, false],
    ['catname', null, false, false, true, false, false, false, false],
    ['checkpoint', null, true, true, false, false, false, false, false],
    ['cmdassist', null, true, true, false, false, false, false, false],
    ['color', "colour", true, true, false, false, false, false, false],
    ['confirm', null, true, true, false, false, false, false, false],
    ['crash_email', null, false, false, true, false, false, false, false],
    ['crash_name', null, false, false, true, false, false, false, false],
    ['crash_urlmax', null, false, false, true, false, false, false, false],
    ['customcolors', "customcolours", true, true, false, false, false, false, false],
    ['customsymbols', "customsymbols", true, true, false, false, false, false, false],
    ['dark_room', null, true, true, false, false, false, false, false],
    ['deaf', "permadeaf", true, true, false, false, false, false, false],
    ['DECgraphics', null, false, true, true, false, false, false, false],
    ['debug_hunger', null, true, true, false, false, false, false, true],
    ['debug_mongen', null, true, true, false, false, false, false, true],
    ['debug_overwrite_stairs', null, true, true, false, false, false, false, true],
    ['disclose', null, false, true, true, false, false, false, false],
    ['dogname', null, false, false, true, false, false, false, false],
    ['dropped_nopick', null, true, true, false, false, false, false, false],
    ['dungeon', null, false, false, true, false, false, false, false],
    ['effects', null, false, false, true, false, false, false, false],
    ['eight_bit_tty', null, true, true, false, false, false, false, false],
    ['extmenu', null, true, true, false, false, false, false, false],
    ['female', "male", true, true, false, false, false, false, false],
    ['fireassist', null, true, true, false, false, false, false, false],
    ['fixinv', null, true, true, false, false, false, false, false],
    ['font_map', null, false, true, true, true, false, false, false],
    ['font_menu', null, false, true, true, true, false, false, false],
    ['font_message', null, false, true, true, true, false, false, false],
    ['font_size_map', null, false, true, true, true, false, false, false],
    ['font_size_menu', null, false, true, true, true, false, false, false],
    ['font_size_message', null, false, true, true, true, false, false, false],
    ['font_size_status', null, false, true, true, true, false, false, false],
    ['font_size_text', null, false, true, true, true, false, false, false],
    ['font_status', null, false, true, true, true, false, false, false],
    ['font_text', null, false, true, true, true, false, false, false],
    ['force_invmenu', null, true, true, false, false, false, false, false],
    ['fruit', null, false, false, true, false, false, false, false],
    ['fullscreen', null, true, true, false, false, false, false, false],
    ['glyph', null, false, false, true, true, false, false, false],
    ['goldX', null, true, true, false, false, false, false, false],
    ['guicolor', null, true, true, false, false, false, false, false],
    ['help', null, true, true, false, false, false, false, false],
    ['herecmd_menu', null, true, true, false, false, false, false, false],
    ['hilite_pet', null, true, true, false, false, false, false, false],
    ['hilite_pile', null, true, true, false, false, false, false, false],
    ['hilite_status', null, false, true, true, true, false, false, false],
    ['hitpointbar', null, true, true, false, false, false, false, false],
    ['horsename', null, false, false, true, false, false, false, false],
    ['IBMgraphics', null, false, true, true, false, false, false, false],
    ['idlecheckpoint', null, true, true, false, false, false, false, false],
    ['ignintr', null, true, true, false, false, false, false, false],
    ['implicit_uncursed', null, true, true, false, false, false, false, false],
    ['legacy', null, true, true, false, false, false, false, false],
    ['lit_corridor', null, true, true, false, false, false, false, false],
    ['lootabc', null, true, true, false, false, false, false, false],
    ['mail', null, true, true, false, false, false, false, false],
    ['map_mode', null, false, true, true, false, false, false, false],
    ['mention_decor', null, true, true, false, false, false, false, false],
    ['mention_map', null, true, true, false, false, false, false, false],
    ['mention_walls', null, true, true, false, false, false, false, false],
    ['menu_deselect_all', null, false, false, true, false, false, false, false],
    ['menu_deselect_page', null, false, false, true, false, false, false, false],
    ['menu_first_page', null, false, false, true, false, false, false, false],
    ['menu_headings', null, false, true, true, false, false, false, false],
    ['menu_invert_all', null, false, false, true, false, false, false, false],
    ['menu_invert_page', null, false, false, true, false, false, false, false],
    ['menu_last_page', null, false, false, true, false, false, false, false],
    ['menu_next_page', null, false, false, true, false, false, false, false],
    ['menu_objsyms', "use_menu_glyphs", false, true, true, false, false, false, false],
    ['menu_overlay', null, true, true, false, false, false, false, false],
    ['menu_previous_page', null, false, false, true, false, false, false, false],
    ['menu_search', null, false, false, true, false, false, false, false],
    ['menu_select_all', null, false, false, true, false, false, false, false],
    ['menu_select_page', null, false, false, true, false, false, false, false],
    ['menu_shift_left', null, false, false, true, false, false, false, false],
    ['menu_shift_right', null, false, false, true, false, false, false, false],
    ['menu_tab_sep', null, true, true, false, false, false, false, false],
    ['menucolors', null, true, true, true, false, false, false, false],
    ['menu colors', null, false, false, true, false, false, true, false],
    ['menuinvertmode', null, false, false, true, false, false, false, false],
    ['menustyle', null, false, true, true, false, false, false, false],
    ['message types', null, false, false, true, false, false, true, false],
    ['mon_movement', null, true, true, false, false, false, false, false],
    ['monpolycontrol', null, true, true, false, false, false, false, false],
    ['montelecontrol', null, true, true, false, false, false, false, false],
    ['monsters', null, false, false, true, false, false, false, false],
    ['mouse_support', null, false, false, true, false, false, false, false],
    ['msg_window', null, false, true, true, false, false, false, false],
    ['msghistory', null, false, true, true, false, false, false, false],
    ['news', null, true, true, false, false, false, false, false],
    ['nudist', null, true, true, false, false, false, false, false],
    ['null', null, true, true, false, false, false, false, false],
    ['number_pad', null, false, false, true, false, false, false, false],
    ['objects', null, false, false, true, false, false, false, false],
    ['packorder', null, false, false, true, false, false, false, false],
    ['paranoid_confirmation', "prayconfirm", false, true, true, true, false, false, false],
    ['pauper', null, true, true, false, false, false, false, false],
    ['perm_invent', null, true, true, false, false, false, false, false],
    ['perminv_mode', null, false, true, true, false, false, false, false],
    ['petattr', null, false, false, true, false, false, false, false],
    ['pettype', "pet", false, true, true, false, false, false, false],
    ['pickup_burden', null, false, false, true, false, false, false, false],
    ['pickup_stolen', null, true, true, false, false, false, false, false],
    ['pickup_thrown', null, true, true, false, false, false, false, false],
    ['pickup_types', null, false, false, true, false, false, false, false],
    ['pile_limit', null, false, true, true, false, false, false, false],
    ['player_selection', null, false, false, true, false, false, false, false],
    ['popup_dialog', null, true, true, false, false, false, false, false],
    ['preload_tiles', null, true, true, false, false, false, false, false],
    ['price_quotes', null, true, true, false, false, false, false, false],
    ['pushweapon', null, true, true, false, false, false, false, false],
    ['query_menu', null, true, true, false, false, false, false, false],
    ['quick_farsight', null, true, true, false, false, false, false, false],
    ['rawio', null, true, false, false, false, false, false, true],
    ['reroll', null, true, true, false, false, false, false, false],
    ['rest_on_space', null, true, true, false, false, false, false, false],
    ['roguesymset', null, false, false, true, false, false, false, false],
    ['runmode', null, false, true, true, false, false, false, false],
    ['safe_pet', null, true, true, false, false, false, false, false],
    ['safe_wait', null, true, true, false, false, false, false, false],
    ['sanity_check', null, true, true, false, false, false, false, false],
    ['scores', null, false, false, true, false, false, false, false],
    ['scroll_amount', null, false, true, true, false, false, false, false],
    ['scroll_margin', null, false, true, true, false, false, false, false],
    ['selectsaved', null, true, true, false, false, false, false, false],
    ['showdamage', null, true, true, false, false, false, false, false],
    ['showexp', null, true, true, false, false, false, false, false],
    ['showrace', null, true, true, false, false, false, false, false],
    ['showscore', null, true, true, false, false, false, false, true],
    ['showvers', null, true, true, false, false, false, false, false],
    ['silent', null, true, true, false, false, false, false, false],
    ['softkeyboard', null, true, true, false, false, false, false, false],
    ['sortdiscoveries', null, false, true, true, false, false, false, false],
    ['sortloot', null, false, false, true, false, false, false, false],
    ['sortpack', null, true, true, false, false, false, false, false],
    ['sortvanquished', null, false, true, true, false, false, false, false],
    ['soundlib', null, false, false, true, false, false, false, false],
    ['sounds', null, true, true, false, false, false, false, false],
    ['sparkle', null, true, true, false, false, false, false, false],
    ['spot_monsters', null, true, true, false, false, false, false, false],
    ['splash_screen', null, true, true, false, false, false, false, false],
    ['standout', null, true, true, false, false, false, false, false],
    ['status_updates', null, true, true, false, false, false, false, false],
    ['status condition fields', null, false, false, true, false, false, true, false],
    ['statushilites', null, false, true, true, true, false, false, false],
    ['status highlight rules', null, false, false, true, false, false, true, false],
    ['statuslines', null, false, false, true, false, false, false, false],
    ['suppress_alert', null, false, false, true, true, false, false, false],
    ['symset', null, false, false, true, false, false, false, false],
    ['term_cols', "termcolumns", false, false, true, false, false, false, false],
    ['term_rows', null, false, false, true, false, false, false, false],
    ['terrainstatus', null, true, true, false, false, false, false, false],
    ['tile_file', null, false, false, true, false, false, false, false],
    ['tile_height', null, false, true, true, false, false, false, false],
    ['tile_width', null, false, true, true, false, false, false, false],
    ['tiled_map', null, true, true, false, false, false, false, false],
    ['time', null, true, true, false, false, false, false, false],
    ['timed_delay', null, true, false, false, false, false, false, true],
    ['tips', null, true, true, false, false, false, false, false],
    ['tombstone', null, true, true, false, false, false, false, false],
    ['toptenwin', null, true, true, false, false, false, false, false],
    ['traps', null, false, false, true, false, false, false, false],
    ['travel', null, true, true, false, false, false, false, false],
    ['travel_debug', null, true, true, false, false, false, false, false],
    ['tutorial', null, true, true, false, false, false, false, false],
    ['use_darkgray', null, true, true, false, false, false, false, false],
    ['use_inverse', null, true, true, false, false, false, false, false],
    ['use_truecolor', "use_truecolour", true, true, false, false, false, false, false],
    ['vary_msgcount', null, false, false, true, false, false, false, false],
    ['verbose', null, true, true, false, false, false, false, false],
    ['versinfo', null, false, false, true, false, false, false, false],
    ['voices', null, true, true, false, false, false, false, false],
    ['vt_tiledata', null, true, true, false, false, false, false, true],
    ['vt_sounddata', null, true, true, false, false, false, false, true],
    ['warnings', null, false, false, true, false, false, false, false],
    ['weaponstatus', null, true, true, false, false, false, false, false],
    ['whatis_coord', null, false, true, true, false, false, false, false],
    ['whatis_filter', null, false, true, true, false, false, false, false],
    ['whatis_menu', null, true, true, false, false, false, false, false],
    ['whatis_moveskip', null, true, true, false, false, false, false, false],
    ['windowborders', null, false, true, true, false, false, false, false],
    ['windowcolors', null, false, false, true, true, false, false, false],
    ['wizmgender', null, true, true, false, false, false, false, false],
    ['wizweight', null, true, true, false, false, false, false, false],
    ['wraptext', null, true, true, false, false, false, false, false],
    ['cond_', null, false, true, false, true, true, false, false],
    ['font', null, false, true, true, true, true, false, false],
];
const asciiLower = (code) => code >= 65 && code <= 90 ? code + 32 : code;
// C options.c:determine_ambiguities(): minmatch is one past the longest
// common case-insensitive prefix with any other option name, clamped to
// [3, name length].
const OPTION_ENTRIES = (() => {
    const names = OPTION_TABLE.map(entry => entry[0]);
    const needed = names.map(() => 0);
    for (const [i, a] of names.entries()) {
        for (const [j, b] of names.entries()) {
            if (i === j)
                continue;
            let common = 1;
            while (common <= a.length && common <= b.length
                && asciiLower(a.charCodeAt(common - 1))
                    === asciiLower(b.charCodeAt(common - 1)))
                common++;
            if (common > (needed[i] ?? 0))
                needed[i] = common;
        }
    }
    return OPTION_TABLE.map((entry, index) => ({
        name: entry[0],
        alias: entry[1],
        isBool: entry[2],
        negateok: entry[3],
        valok: entry[4],
        dupeok: entry[5],
        pfx: entry[6],
        other: entry[7],
        silent: entry[8],
        minmatch: Math.min(Math.max(needed[index] ?? 0, 3), entry[0].length),
        index,
    }));
})();
// C hacklib.c lowc()/strncmpi() over a leading run of the element.
function asciiNameEqual(name, element, length) {
    if (length > name.length)
        return false;
    for (let i = 0; i < length; i++) {
        if (asciiLower(name.charCodeAt(i)) !== asciiLower(element.charCodeAt(i)))
            return false;
    }
    return true;
}
// C options.c:length_without_val(): the element up to the first ':' or
// '=' whichever leads, with preceding whitespace excluded.
function lengthWithoutValue(element) {
    let cut = element.length;
    for (let i = 0; i < element.length; i++) {
        if (element.charAt(i) === ':' || element.charAt(i) === '=') {
            cut = i;
            break;
        }
    }
    while (cut > 0 && ' \t\n\v\f\r'.includes(element.charAt(cut - 1)))
        cut--;
    return cut;
}
// Serialize the six disclosure slots into the "prefix category" grammar
// parseDisclosureSettings() reads, so option-time state survives like C's
// end_disclose[] array; a slot never set stays unmentioned, and a fully
// unset state returns to "no disclose option seen".
function serializeDisclosureSlots(slots) {
    const parts = [];
    for (const category of DISCLOSURE_CATEGORIES) {
        const value = slots[category] ?? '';
        if (value)
            parts.push(`${value} ${category}`);
    }
    return parts.length ? parts.join(' ') : undefined;
}
// C options.c:parseoptions()'s match loop: option names in table order at
// their minimum length, then aliases at full length.  Returns null when no
// entry matches, which parseoptions() reports as "Unknown option".
function matchOptionElement(element) {
    const nameLength = lengthWithoutValue(element);
    for (const entry of OPTION_ENTRIES) {
        if (entry.pfx) {
            // str_start_is() on the whole element; a hit wins immediately.
            if (entry.name.length <= element.length
                && asciiNameEqual(entry.name, element, entry.name.length)) {
                return { ...entry, viaAlias: false };
            }
        }
        // match_optname() at the entry's minimum length also serves the
        // prefix entries, so "cond" reaches pfxfn_cond_ like "cond_x".
        if (nameLength >= entry.minmatch
            && asciiNameEqual(entry.name, element, nameLength)) {
            return { ...entry, viaAlias: false };
        }
    }
    for (const entry of OPTION_ENTRIES) {
        const { alias } = entry;
        if (alias !== null && nameLength === alias.length
            && asciiNameEqual(alias, element, nameLength)) {
            return { ...entry, viaAlias: true };
        }
    }
    return null;
}
// options.c:default_menu_cmd_info[] — the menu_* names that bind a key to
// a menu paging command rather than configuring a compound option.
const MENU_KEY_OPTIONS = {
    menu_next_page: true, menu_previous_page: true, menu_first_page: true,
    menu_last_page: true, menu_select_all: true, menu_invert_all: true,
    menu_deselect_all: true, menu_select_page: true, menu_invert_page: true,
    menu_deselect_page: true, menu_search: true, menu_shift_right: true,
    menu_shift_left: true,
};
// C hacklib.c str_start_is(name, value, TRUE): the value is a leading
// substring of the name, case-insensitively; an empty value matches.
function ciPrefixOf(name, value) {
    return value.length <= name.length
        && name.slice(0, value.length).toLowerCase() === value.toLowerCase();
}
// C hacklib.c visctrl(): how diagnostics name a control or meta byte.
function visctrl(code) {
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
// options.c unlocktypes[][]: autounlock action names and their bits.
const AUTOUNLOCK_TYPES = [
    ['untrap', AUTOUNLOCK_UNTRAP],
    ['apply-key', AUTOUNLOCK_APPLY_KEY],
    ['kick', AUTOUNLOCK_KICK],
    ['force', AUTOUNLOCK_FORCE],
];
// options.c illegal_menu_cmd_key(): the reserved control, space, digit,
// and letter keys ('@' excepted), then the default object-class symbols.
function menuCommandKeyError(key) {
    const character = String.fromCharCode(key);
    const letter = (key >= 65 && key <= 90) || (key >= 97 && key <= 122);
    if (key === 0 || key === 13 || key === 10 || key === 27 || key === 32
        || (key >= 48 && key <= 57) || (letter && key !== 64)) {
        return `Reserved menu command key '${visctrl(key)}'`;
    }
    if (OBJECT_CLASS_SYMBOLS.slice(1).includes(character)) {
        return `Menu command key '${visctrl(key)}' is an object class`;
    }
    return null;
}
const DEFAULT_PARANOIA_BITS = PARANOID_PRAY | PARANOID_SWIM | PARANOID_TRAP;
const MENU_STYLES = [
    ['traditional', '[prompt for object class(es), then', ' ask y/n for each item in those classes]'],
    ['combination', '[prompt for object class(es), then', ' use menu for items in those classes]'],
    ['full', '[use menu to choose class(es), then', ' use another menu for items in those]'],
    ['partial', '[skip class filtering; always', ' use menu of all available items]'],
];
const PARANOIA_ARGUMENTS = [
    ['confirm', 1, PARANOID_CONFIRM], ['paranoia', 2, PARANOID_CONFIRM],
    ['quit', 1, PARANOID_QUIT], ['explore', 2, PARANOID_QUIT],
    ['die', 1, PARANOID_DIE], ['death', 2, PARANOID_DIE],
    ['bones', 1, PARANOID_BONES], ['attack', 1, PARANOID_HIT], ['hit', 1, PARANOID_HIT],
    ['wand-break', 2, PARANOID_BREAKWAND], ['break-wand', 2, PARANOID_BREAKWAND],
    ['eat', 1, PARANOID_EATING], ['continue', 4, PARANOID_EATING],
    ['were-change', 2, PARANOID_WERECHANGE], ['pray', 1, PARANOID_PRAY],
    ['trap', 1, PARANOID_TRAP], ['move-trap', 1, PARANOID_TRAP],
    ['autoall', 2, PARANOID_AUTOALL], ['autoselect-all', 2, PARANOID_AUTOALL],
    ['swim', 1, PARANOID_SWIM], ['remove', 1, PARANOID_REMOVE], ['takeoff', 1, PARANOID_REMOVE],
    ['none', 4, 0], ['all', 3, ~0],
];
function updateParanoiaBits(current, rawValue, addError) {
    // optfn_paranoid_confirmation() condenses the value, treats a leading
    // + or - as augmenting, matches arguments case-insensitively through
    // match_optname(), and reports the first unmatched token verbatim
    // while keeping the changes before it.
    let fields = rawValue.trim().replace(/[ \t]+/g, ' ');
    const augmenting = fields.startsWith('+') || fields.startsWith('-');
    const removing = fields.startsWith('-');
    let bits = augmenting ? current : 0;
    if (augmenting)
        fields = fields.slice(1).replace(/^ /, '');
    fields = fields.replace(/! /g, '!');
    for (const original of fields.split(' ')) {
        const negated = original.startsWith('!') || /^no[^n]/i.test(original);
        const token = negated
            ? original.slice(original.startsWith('!') ? 1 : 2) : original;
        const field = token.toLowerCase();
        const entry = PARANOIA_ARGUMENTS.find(([name, minimum]) => field.length >= minimum && name.startsWith(field));
        if (!entry) {
            addError(`Unknown paranoid_confirmation parameter '${token}'`);
            break;
        }
        const bit = entry[2];
        if (!bit) {
            if (!augmenting)
                bits = 0;
        }
        else
            bits = removing || negated ? bits & ~bit : bits | bit;
    }
    return bits;
}
// C options.c:parsebindings() treats a leading comma as the key, and
// processes the remaining comma-separated bindings before the first one.
function bindingFields(value) {
    const fields = [];
    while (value) {
        let separator = value.indexOf(',');
        if (separator === 0)
            separator = value.indexOf(',', 1);
        else if (separator > 0 && (value[separator - 1] === '\\'
            || (value[separator - 1] === "'" && value[separator + 1] === "'")))
            separator = value.indexOf(',', separator + 2);
        if (separator < 0) {
            fields.push(value);
            break;
        }
        fields.push(value.slice(0, separator));
        value = value.slice(separator + 1);
    }
    return fields.reverse();
}
// txt2key() consumes bytes, not Unicode code points. Only the first decoded
// escape is needed: Native returns the first byte of escapes()' output.
function bindingKeyCode(value) {
    let key = String.fromCharCode(...new TextEncoder().encode(value.trim()));
    if (!key.length)
        return 0;
    if (key.length === 1)
        return key.charCodeAt(0);
    if (key === '<enter>')
        return 10;
    if (key === '<space>')
        return 32;
    if (key === '<esc>')
        return 27;
    if (key[0] === '\\') {
        let meta = 0;
        if (/^\\[mM]./.test(key)) {
            meta = 128;
            key = key.slice(2);
        }
        let code = key.charCodeAt(0);
        if (key.length > 1) {
            if (key[0] === '^')
                code = key.charCodeAt(1) & 31;
            else if (key[0] === '\\') {
                const numeric = key.match(/^\\(?:(\d{1,3})|[oO]([0-7]{1,3})|[xX]([0-9a-fA-F]{1,2}))/);
                if (numeric?.[1])
                    code = parseInt(numeric[1], 10);
                else if (numeric?.[2])
                    code = parseInt(numeric[2], 8);
                else if (numeric?.[3])
                    code = parseInt(numeric[3], 16);
                else
                    code = escapeKeyCode(key.charAt(1));
            }
        }
        return (code | meta) & 255;
    }
    let meta = 0;
    if (key.charAt(0).toUpperCase() === 'M') {
        key = key.slice(1);
        if (key[0] === '-' && key.length > 1)
            key = key.slice(1);
        if (key.length === 1)
            return key.charCodeAt(0) | 128;
        meta = 128;
    }
    if (key[0] === '^' || key.charAt(0).toUpperCase() === 'C') {
        if (key.length === 1)
            return key.charCodeAt(0) | meta;
        key = key.slice(1);
        if (key[0] === '-' && key.length > 1)
            key = key.slice(1);
        return (key[0] === '?' ? 127 : key.charCodeAt(0) & 31) | meta;
    }
    if (meta)
        return key.charCodeAt(0) | meta;
    const decimal = key.match(/^\d{3}/);
    return decimal ? Number(decimal[0]) & 255 : 0;
}
function escapeKeyCode(character) {
    switch (character) {
        case 'n': return 10;
        case 't': return 9;
        case 'b': return 8;
        case 'r': return 13;
        default: return character.charCodeAt(0);
    }
}
function setNumberPadOption(value, settings) {
    if (!settings.commandBindings.setNumberPad(value))
        return;
    settings.iflags.num_pad = value > 0;
    settings.iflags.num_pad_mode = value === -1 ? 1 : value > 0 ? value - 1 : 0;
}
function parseScoreOption(value, negated) {
    // string_for_opt() trims the value; an empty one is a missing parameter.
    const text = value?.trim();
    if (!text)
        return null;
    const choices = { end_top: 0, end_around: 0, end_own: false, error: null };
    let rest = negated ? '' : text;
    while (rest) {
        const disabled = rest.startsWith('!') || rest.slice(0, 2).toLowerCase() === 'no';
        if (disabled)
            rest = rest.startsWith('!') ? rest.slice(1)
                : rest.slice(rest[2] === '-' ? 3 : 2);
        const digits = rest.match(/^\d+/)?.[0];
        const count = digits ? Number(digits) : 1;
        if (digits)
            rest = rest.slice(digits.length);
        rest = rest.replace(/^ +/, '');
        // Native lowc() selects the field but reports the original text.
        const field = rest[0]?.toLowerCase();
        if (field === 't')
            choices.end_top = disabled ? 0 : count;
        else if (field === 'a')
            choices.end_around = disabled ? 0 : count;
        else if (field === 'o')
            choices.end_own = !disabled && count !== 0;
        else if (field === 'n') {
            choices.end_top = choices.end_around = 0;
            choices.end_own = false;
        }
        else {
            choices.error = /^-\d/.test(rest)
                ? 'Values for scores:top and scores:around must not be negative'
                : `Unknown scores parameter '${rest}'`;
            break;
        }
        rest = rest.replace(/^[a-zA-Z]+ */, '');
        if (rest.startsWith('/'))
            rest = rest.slice(1).replace(/^ +/, '');
    }
    return choices;
}
export function parseNethackrc(rc, sources = {}) {
    // Each engine start is one native process: AUTOCOMPLETE= adjustments
    // from a previous game must not carry over.
    resetCommandAutocomplete();
    const result = {
        name: '', role: null, race: null, gender: null, align: null,
        configErrors: [],
        flags: { paranoia_bits: DEFAULT_PARANOIA_BITS }, iflags: {}, commandBindings: new CommandBindings(),
    };
    const fileReport = { source: sources.fileName || '.nethackrc', errors: [] };
    parseConfiguration(rc, result, fileReport, true);
    result.configErrors.push(fileReport);
    result.commandBindings.finishConfiguration();
    if (sources.nethackOptions != null)
        parseNethackOptions(sources.nethackOptions, result);
    return result;
}
export function parseNethackOptions(options, result) {
    const report = { source: 'NETHACKOPTIONS', errors: [] };
    parseConfiguration(options, result, report, false);
    result.configErrors.push(report);
    result.commandBindings.finishConfiguration();
    return report;
}
export function applyNethackrc(rc, state = game) {
    const result = {
        configErrors: [],
        flags: state.flags, iflags: state.iflags,
        commandBindings: state.commandBindings,
    };
    const report = { source: 'parse_conf_str', errors: [] };
    parseConfiguration(rc, result, report, true);
    result.configErrors.push(report);
    if (result.monTelecontrol !== undefined)
        state._monTelecontrol = result.monTelecontrol;
    if (result.fruit !== undefined)
        state.fruitName = result.fruit;
    if (result.preferred_pet !== undefined)
        state.preferred_pet = result.preferred_pet;
    // cnf_line_BOULDER() writes straight into the live symbol override.
    if (result.boulderSym !== undefined)
        state.boulderSym = result.boulderSym;
    return result;
}
// C cfgfiles.c:parse_config_line()'s config_line_stmt[] table. SYSCF-only
// rows are never reached while reading an rc file. The numeric length is the
// minimum abbreviation, matched case-insensitively against the statement
// name (match_varname() → match_optname(..., val_allowed=TRUE)).
const CONFIG_STATEMENTS = [
    ['OPTIONS', 4], ['AUTOPICKUP_EXCEPTION', 5], ['BINDINGS', 4],
    ['AUTOCOMPLETE', 5], ['MSGTYPE', 7], ['HACKDIR', 4], ['LEVELDIR', 4],
    ['LEVELS', 4], ['SAVEDIR', 4], ['BONESDIR', 5], ['DATADIR', 4],
    ['SCOREDIR', 4], ['LOCKDIR', 4], ['CONFIGDIR', 4], ['TROUBLEDIR', 4],
    ['NAME', 4], ['ROLE', 4], ['CHARACTER', 4], ['dogname', 3], ['catname', 3],
    ['BOULDER', 3], ['MENUCOLOR', 9], ['HILITE_STATUS', 6], ['WARNINGS', 5],
    ['ROGUESYMBOLS', 4], ['SYMBOLS', 4], ['WIZKIT', 6], ['QT_TILEWIDTH', 12],
    ['QT_TILEHEIGHT', 13], ['QT_FONTSIZE', 11], ['QT_COMPACT', 10],
];
// C hacklib.c:mungspaces(): tabs become spaces, runs of spaces collapse to
// one, and leading/trailing spaces vanish. Line framing already trimmed the
// statement, so an all-space result cannot reach this point.
function mungSpaces(bytes) {
    const out = [];
    let pendingSpace = false;
    for (const byte of bytes) {
        if (byte === 32 || byte === 9) {
            pendingSpace = out.length > 0;
            continue;
        }
        if (pendingSpace && out.length)
            out.push(32);
        pendingSpace = false;
        out.push(byte);
    }
    return new Uint8Array(out);
}
function parseConfigStatement(bytes) {
    const munged = mungSpaces(bytes);
    const delimiter = munged.findIndex(byte => byte === 58 || byte === 61);
    if (delimiter < 0)
        return null;
    let nameEnd = delimiter;
    while (nameEnd > 0 && munged[nameEnd - 1] === 32)
        nameEnd--;
    let valueStart = delimiter + 1;
    if (munged[valueStart] === 32)
        valueStart++;
    let rawDelimiter = -1;
    for (let index = 0; index < bytes.length; index++) {
        if (bytes[index] === 58 || bytes[index] === 61) {
            rawDelimiter = index;
            break;
        }
    }
    const valueBytes = munged.subarray(valueStart);
    return {
        name: new TextDecoder().decode(munged.subarray(0, nameEnd)).toLowerCase(),
        valueBytes,
        valueText: new TextDecoder().decode(valueBytes),
        optionBytes: bytes.subarray(rawDelimiter + 1),
    };
}
function matchConfigStatement(name) {
    for (const [statement, minimum] of CONFIG_STATEMENTS) {
        if (name.length >= minimum && statement.toLowerCase().startsWith(name))
            return statement;
    }
    return null;
}
// vconfig_error_add()'s BUFSZ-1 cut and printf's %.Ns precision count
// bytes; a UTF-8 sequence split by the cut survives as one character.
function cutConfigBytes(text, limit) {
    return new TextDecoder().decode(new TextEncoder().encode(text).subarray(0, limit));
}
// C's uchar list parser (cfgfiles.c:get_uchars()). Zeros are stored unless
// the list is being modified in place, but every parsed number still counts
// toward the `size` limit; parsing stops at the first character that is
// neither a digit nor whitespace, or once `size` numbers were read.
function parseUcharList(bytes, size, modifyInPlace) {
    const values = [];
    let count = 0;
    let number = 0;
    let haveNumber = false;
    let index = 0;
    for (;;) {
        const byte = bytes[index];
        if (byte === 32 || byte === 9 || byte === 10 || byte === undefined) {
            if (haveNumber) {
                if (number !== 0 || !modifyInPlace)
                    values.push(number & 0xFF);
                count++;
                number = 0;
                haveNumber = false;
            }
            if (count === size || byte === undefined)
                return { values, syntaxError: false };
            index++;
        }
        else if (byte >= 48 && byte <= 57) {
            haveNumber = true;
            // C accumulates into an unsigned int and wraps at 2^32.
            number = (number * 10 + (byte - 48)) >>> 0;
            index++;
        }
        else {
            return { values, syntaxError: true };
        }
    }
}
// C cmd.c:parseautocomplete(): splits on the first comma, else the first
// colon, processes the remainder first, then requires an exact (case
// sensitive) extended-command name.
function parseAutocompleteStatement(value, addRawError) {
    let separator = value.indexOf(',');
    if (separator < 0)
        separator = value.indexOf(':');
    if (separator >= 0) {
        parseAutocompleteStatement(value.slice(separator + 1), addRawError);
        value = value.slice(0, separator);
    }
    value = value.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
    if (!value)
        return;
    let condition = true;
    if (value.startsWith('!')) {
        value = value.slice(1).replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
        condition = false;
    }
    if (!NATIVE_COMMANDS.some(command => command.name === value)) {
        addRawError(`Bad autocomplete: invalid extended command '${value}'.`);
        return;
    }
    setCommandAutocomplete(value, condition);
}
// C hacklib.c:fuzzymatch(): compare while skipping ' ', '-', '_' and
// folding case.
function fuzzyMatch(input, name) {
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
const COLOR_NAMES = [
    ['black', 0], ['red', 1], ['green', 2], ['brown', 3], ['blue', 4],
    ['magenta', 5], ['cyan', 6], ['gray', 7], ['orange', 9],
    ['light green', 10], ['yellow', 11], ['light blue', 12],
    ['light magenta', 13], ['light cyan', 14], ['white', 15], ['no color', 8],
    ['transparent', 8], ['purple', 5], ['light purple', 13],
    ['bright purple', 13], ['grey', 7], ['bright red', 9], ['bright green', 10],
    ['bright blue', 12], ['bright magenta', 13], ['bright cyan', 14],
];
// C coloratt.c:attrnames[]; values are the wintype.h ATR_* constants.
const ATTRIBUTE_NAMES = [
    ['none', 0], ['bold', 1], ['dim', 2], ['italic', 3], ['underline', 4],
    ['blink', 5], ['inverse', 7],
    ['normal', 0], ['uline', 4], ['reverse', 7],
];
// coloratt.c:match_str2clr(); returns CLR_MAX when nothing matched.  A
// non-null addError mirrors the unsuppressed config_error_add() calls.
function matchColorName(text, addError) {
    const named = COLOR_NAMES.find(([name]) => fuzzyMatch(text, name));
    if (named)
        return named[1];
    const digits = text.match(/^\d+/)?.[0];
    const color = digits === undefined ? CLR_MAX : Number(digits);
    if (color < 0 || color >= CLR_MAX) {
        addError?.(`Unknown color '${cutConfigBytes(text, 60)}'`);
        return CLR_MAX;
    }
    return color;
}
// coloratt.c:match_str2attr(); returns -1 when nothing matched.
function matchAttributeName(text, addError) {
    const named = ATTRIBUTE_NAMES.find(([name]) => fuzzyMatch(text, name));
    if (named)
        return named[1];
    addError?.(`Unknown text attribute '${cutConfigBytes(text, 50)}'`);
    return -1;
}
// C coloratt.c:add_menu_coloring(). The compiled pattern is kept on the
// rule like C's ->match regex_t; the first matching rule (newest first)
// colors the menu entry at the add_menu() seam.
function parseMenuColoring(valueText, addError) {
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
    if (ampersand >= 0)
        tail = tail.slice(0, ampersand);
    const color = matchColorName(tail, addError);
    if (color >= CLR_MAX)
        return null;
    let attr = 0;
    if (ampersand >= 0) {
        const attribute = value.slice(equals + 1)
            .replace(/[ \t]+/g, ' ').trim().slice(ampersand + 1);
        attr = matchAttributeName(attribute, addError);
        if (attr === -1)
            return null;
    }
    // The regexp portion is not condensed by mungspaces(); a matching pair
    // of quotes around it is stripped.
    let pattern = value.slice(0, equals);
    const quote = pattern.charAt(0);
    if (quote === '"' || quote === '\'') {
        let end = pattern.length - 1;
        while (end >= 0 && /[ \t]/.test(pattern.charAt(end)))
            end--;
        if (pattern.charAt(end) === quote)
            pattern = pattern.slice(1, end);
    }
    let regex;
    try {
        regex = new PosixRegex(pattern);
    }
    catch (error) {
        if (!(error instanceof SyntaxError))
            throw error;
        addError(`Menucolor regex error: ${error.message}`);
        return null;
    }
    return { origstr: pattern, color, attr, regex };
}
// C coloratt.c:color_attr_parse_str(): "color&attr", "color", or "attr"
// (a lone name is tried as an attribute first). Returns null on failure;
// matchColorName()/matchAttributeName() emit C's diagnostics.
function parseColorAttr(text, addError) {
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
        if (color >= CLR_MAX || attr === -1)
            return null;
        return { attr, color };
    }
    const attr = matchAttributeName(text, null);
    if (attr !== -1)
        return { attr, color: NO_COLOR };
    const color = matchColorName(text, addError);
    return color >= CLR_MAX ? null : { attr: C_ATR_NONE, color };
}
// C options.c:add_autopickup_exception(): sscanf() forms `"<%s`, `">%s`, or
// `"%s`, each with an optional whitespace + '#' comment after the closing
// quote. Valid patterns join the exception list (newest first, like
// ga.apelist); pickup.c:autopick_testobj() consults it during autopickup.
function parseAutopickupException(value, addError) {
    const bytes = new TextEncoder().encode(value);
    const scan = (prefix) => {
        const start = 1 + prefix.length;
        if (!value.startsWith('"' + prefix))
            return null;
        const close = bytes.indexOf(34, start);
        const end = Math.min(close < 0 ? bytes.length : close, start + 253);
        if (end === start)
            return null;
        const text = new TextDecoder().decode(bytes.subarray(start, end));
        // Once the scanset captures text, sscanf() returns one conversion
        // even if the closing quote is missing or beyond the 253-byte limit.
        if (bytes[end] !== 34)
            return { text, trailing: null };
        const rest = new TextDecoder().decode(bytes.subarray(end + 1)).replace(/^[ \t\n\r\f\v]+/, '');
        return { text, trailing: rest.charAt(0) || null };
    };
    const compile = (text, grab) => {
        try {
            return { pattern: text, grab, regex: new PosixRegex(text) };
        }
        catch (error) {
            if (!(error instanceof SyntaxError))
                throw error;
            addError(`regex error in AUTOPICKUP_EXCEPTION: ${error.message}`);
            return null;
        }
    };
    const grab = scan('<');
    if (grab && (grab.trailing === null || grab.trailing === '#'))
        return compile(grab.text, true);
    const noGrab = scan('>');
    if (noGrab?.trailing === null)
        return compile(noGrab.text, false);
    // The final check reuses the plain-quoted scan's captures, exactly as C
    // reuses the last sscanf()'s results ('">x" #c' keeps the '>x' text).
    const plain = scan('');
    if (plain && (plain.trailing === null || plain.trailing === '#'))
        return compile(plain.text, false);
    addError('syntax error in AUTOPICKUP_EXCEPTION');
    return null;
}
function handleConfigStatement(statement, parsed, result, addError, addRawError) {
    switch (statement) {
        // Accepted by the C table without effect in this port: path prefixes
        // are ignored on this platform, WIZKIT names a file this runtime cannot
        // supply, and HILITE_STATUS and SYMBOLS/ROGUESYMBOLS validation need the
        // status-hilite grammar and the symbol-name tables, which are missing —
        // their bad-value diagnostics remain unported.
        case 'HACKDIR':
        case 'LEVELDIR':
        case 'LEVELS':
        case 'SAVEDIR':
        case 'BONESDIR':
        case 'DATADIR':
        case 'SCOREDIR':
        case 'LOCKDIR':
        case 'CONFIGDIR':
        case 'TROUBLEDIR':
        case 'HILITE_STATUS':
        case 'ROGUESYMBOLS':
        case 'SYMBOLS':
        case 'WIZKIT':
        case 'QT_TILEWIDTH':
        case 'QT_TILEHEIGHT':
        case 'QT_FONTSIZE':
        case 'QT_COMPACT':
            break;
        case 'MENUCOLOR': {
            const rule = parseMenuColoring(parsed.valueText, addError);
            if (rule) {
                result.flags.menucolors = true;
                (result.iflags.menuColorings ??= []).unshift(rule);
            }
            break;
        }
        case 'BINDINGS':
            // options.c:parsebindings(): each field is "key:command"; an
            // unparseable key or unknown command is reported, a menu-command
            // key must pass illegal_menu_cmd_key() (whose own diagnostic
            // precedes parsebindings()'s "Bad menu key"), and bind_key()
            // reports its parameter complaints while accepting the binding.
            for (const field of bindingFields(parsed.valueText)) {
                const separator = field.indexOf(':');
                if (separator < 0)
                    continue;
                const keyText = field.slice(0, separator);
                const command = field.slice(separator + 1).trim();
                const code = bindingKeyCode(keyText);
                if (!code) {
                    addError(`Unknown key binding key '${keyText}'`);
                    continue;
                }
                if (result.commandBindings.bindSpecialKey(code, command))
                    continue;
                if (MENU_KEY_OPTIONS[command] === true) {
                    const illegal = menuCommandKeyError(code);
                    if (illegal) {
                        addError(illegal);
                        addError(`Bad menu key ${visctrl(code)}:${command}`);
                    }
                    else
                        result.commandBindings.bindMenuKey(code, command);
                    continue;
                }
                const bound = result.commandBindings.bindKey(code, command);
                if (!bound.accepted)
                    addError(`Unknown key binding command '${command}'`);
                else if (bound.error)
                    addError(bound.error);
            }
            break;
        case 'AUTOCOMPLETE':
            parseAutocompleteStatement(parsed.valueText, addRawError);
            break;
        case 'AUTOPICKUP_EXCEPTION': {
            // ga.apelist is prepended, so the newest rule matches first.
            const rule = parseAutopickupException(parsed.valueText, addError);
            if (rule)
                (result.iflags.autopickupExceptions ??= []).unshift(rule);
            break;
        }
        case 'MSGTYPE': {
            const error = addMessageTypeRule(parsed.valueText, result.iflags.messageTypes ??= []);
            if (error)
                addError(error);
            break;
        }
        case 'NAME':
            // cnf_line_NAME() strncpy's PL_NSIZ-1 bytes; a UTF-8 name cut at
            // that limit keeps its partial final sequence as one character.
            result.name = new TextDecoder().decode(parsed.valueBytes.subarray(0, PL_NSIZ - 1));
            break;
        case 'ROLE':
        case 'CHARACTER':
            // cnf_line_ROLE() assigns only when str2role() >= 0; ROLE_RANDOM
            // (-2) for 'random'/'*'/'@' and ROLE_NONE (-1) for anything
            // unrecognized both leave the previous role in place. findRole()
            // returns null for an empty value, which likewise leaves it unset.
            if (findRole(parsed.valueText))
                result.role = parsed.valueText;
            break;
        case 'dogname':
        case 'catname':
            // Unlike the dogname/catname options, the statements copy the munged
            // bytes without sanitize_name(); keep the same byte-string form the
            // options produce.
            result.flags[statement] = String.fromCharCode(...parsed.valueBytes.subarray(0, PL_PSIZ - 1));
            break;
        case 'WARNINGS': {
            // cnf_line_WARNINGS() calls assign_warnings() unconditionally:
            // values parsed before a syntax error are still applied.
            const { values, syntaxError } = parseUcharList(parsed.valueBytes, WARNCOUNT, false);
            assignWarningSymbols(values, result.iflags);
            if (syntaxError)
                addRawError('Syntax error in WARNINGS');
            break;
        }
        case 'BOULDER': {
            // cnf_line_BOULDER() stores the override in the primary symbol set;
            // initoptions_finish() publishes it as the boulder's map glyph.
            // get_uchars() leaves the slot alone for an explicit zero, but a
            // nonzero value truncated to a zero uchar (e.g. 256) clears the
            // override: get_othersym() reads zero as "no override".
            const { values, syntaxError } = parseUcharList(parsed.valueBytes, 1, true);
            if (syntaxError)
                addRawError('Syntax error in BOULDER');
            else if (values[0] !== undefined)
                result.boulderSym = values[0] ? String.fromCharCode(values[0]) : '';
            break;
        }
        case 'OPTIONS':
            break;
    }
}
// C cfgfiles.c:is_config_section(): "[name]" optionally followed by spaces
// and a '#comment'. Returns undefined when the line is not a section header.
function configSectionName(statement) {
    const trimmed = statement.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
    if (!trimmed.startsWith('['))
        return undefined;
    const close = trimmed.indexOf(']');
    if (close < 0)
        return undefined;
    let tail = close + 1;
    while (trimmed[tail] === ' ')
        tail++;
    if (tail < trimmed.length && trimmed[tail] !== '#')
        return undefined;
    return trimmed.slice(1, close).replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
}
// C cfgfiles.c:choose_random_part(): consumes one core rn2() for the choice,
// then extracts the chosen part verbatim; an empty part selects nothing.
function chooseRandomPart(value) {
    let parts = 1;
    for (const character of value)
        if (character === ',')
            parts++;
    let remaining = rn2(parts);
    let index = 0;
    while (remaining > 0 && index < value.length) {
        index++;
        if (value[index] === ',')
            remaining--;
    }
    if (index >= value.length)
        return null;
    if (value[index] === ',')
        index++;
    let end = index;
    while (end < value.length && value[end] !== ',')
        end++;
    return end > index ? value.slice(index, end) : null;
}
// parse_config_line() always parses OPTIONS in initial/config-file mode,
// including Lua fragments. Only full startup performs final reconciliation.
function parseConfiguration(rc, result, report, fromFile) {
    let paranoiaBits = result.flags.paranoia_bits ?? DEFAULT_PARANOIA_BITS;
    let paranoiaSeen = false;
    if (!rc && fromFile)
        return result;
    // options.c reset_duplicate_opt_detection(): one counter per option
    // across the whole file; the environment parse does not track repeats.
    const optionsSeen = new Map();
    const characterOptionsSeen = new Map();
    const lines = fromFile ? configurationLines(rc, report)
        : [{ bytes: new TextEncoder().encode(rc.split('\0')[0] ?? ''), sourceLine: '', lineNumber: 0 }];
    for (const { bytes, sourceLine, lineNumber } of lines) {
        const addError = (message) => {
            report.errors.push({ sourceLine, lineNumber, message: message.slice(0, BUFSZ - 1) });
        };
        const addRawError = (message) => {
            report.errors.push({ sourceLine, lineNumber, message, raw: true });
        };
        // parse_config_line() condenses whitespace for every statement name
        // and value, but passes the original OPTIONS statement to
        // cnf_line_OPTIONS().
        let optionList;
        if (fromFile) {
            const statement = parseConfigStatement(bytes);
            if (!statement) {
                addError("Not a config statement, missing '='");
                continue;
            }
            const match = matchConfigStatement(statement.name);
            if (!match) {
                addError('Unknown config statement');
                continue;
            }
            if (match !== 'OPTIONS') {
                handleConfigStatement(match, statement, result, addError, addRawError);
                continue;
            }
            optionList = statement.optionBytes;
        }
        else {
            optionList = bytes;
        }
        let usingAlias = false;
        for (const optionBytes of configurationOptions(optionList)) {
            if (optionBytes.length > BUFSZ / 2) {
                addError(`Option too long, max length is ${BUFSZ / 2} characters`);
                continue;
            }
            const trimmedBytes = trimConfigurationOption(optionBytes);
            const trimmed = new TextDecoder().decode(trimmedBytes);
            if (!trimmed) {
                addError('Empty statement');
                continue;
            }
            let negated = false;
            let stripped = trimmed;
            while (stripped.startsWith('!') || /^no/i.test(stripped)) {
                const prefix = stripped.startsWith('!') ? 1 : stripped[2] === '-' ? 3 : 2;
                stripped = stripped.slice(prefix);
                negated = !negated;
            }
            // parseoptions() matches each element against the option table
            // before any handler runs; an element matching nothing is an
            // unknown option, apart from the S_name:c symbol forms that
            // parsesymbols() accepts (the symbol tables are not ported, so
            // they are accepted without validation).
            const optionMatch = matchOptionElement(stripped);
            if (!optionMatch) {
                if (!stripped.startsWith('S_'))
                    addError(`Unknown option '${stripped}'`);
                continue;
            }
            // parseoptions()'s right-to-left recursion retains using_alias
            // across the elements of one OPTIONS statement.
            usingAlias ||= optionMatch.viaAlias;
            const canonical = optionMatch.name;
            // duplicate_opt_detection() runs first and bumps its counter
            // even when the option is then refused, so a repeated option
            // draws complain_about_duplicate() before bad_negation().
            const duplicateOption = fromFile && (optionsSeen.get(optionMatch.index) ?? 0) > 0;
            if (fromFile) {
                optionsSeen.set(optionMatch.index, (optionsSeen.get(optionMatch.index) ?? 0) + 1);
            }
            if (duplicateOption && !optionMatch.dupeok) {
                const aliasSuffix = usingAlias
                    ? ` (via alias: ${optionMatch.alias ?? '(null)'})` : '';
                addError(`${optionMatch.isBool || optionMatch.other ? 'boolean' : 'compound'} option specified multiple times: ${canonical}${aliasSuffix}`);
            }
            // parseoptions() rejects negation of a !negateok option before
            // any handler runs (bad_negation() with its parameter form).
            if (negated && !optionMatch.negateok) {
                addError(`The ${canonical} option may not both have a value and be negated.`);
                continue;
            }
            // optfn_boolean() returns before touching the value for the
            // null-address booleans, and the set_wiznofuz booleans fail
            // silently while opt_initial — neither sets anything.
            if (optionMatch.silent)
                continue;
            if (canonical === 'cond_') {
                // pfxfn_cond_() → parse_cond_option(): 2 when the element
                // is too short to hold more than the prefix, 1 when the
                // condition name matches nothing.
                const mask = setConditionOption(stripped, !negated, result.flags.statusConditionMask);
                if (mask !== null)
                    result.flags.statusConditionMask = mask;
                else {
                    addError(`Unknown condition option ${stripped} (${stripped.length <= canonical.length ? 2 : 1})`);
                    // parseoptions() adds this only for a full prefix
                    // match; the abbreviation "cond" gets one error.
                    if (asciiNameEqual(canonical, stripped, canonical.length)) {
                        const colon = stripped.indexOf(':');
                        const suffix = colon < 0 ? stripped : stripped.slice(0, colon);
                        addError(`bad option suffix variation '${suffix}'`);
                    }
                }
                continue;
            }
            const colonIdx = stripped.search(/[:=]/);
            const bindingOption = (colonIdx < 0 ? stripped : stripped.slice(0, colonIdx))
                .trimEnd().toLowerCase().trimStart();
            const optionValue = colonIdx < 0 ? null : stripped.slice(colonIdx + 1).trim();
            // optfn_boolean(): a boolean's value must spell on or off —
            // a prefix of true/false/yes/no, exactly "on"/"off", or a
            // leading digit whose atoi() is 1 or 0.  A negated boolean
            // takes no value at all, and the one valok boolean
            // (menucolors) accepts anything else as on.  The value is the
            // raw text after the delimiter, spaces included.
            let booleanSetting = null;
            if (optionMatch.isBool) {
                const rawValue = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                const text = rawValue.toLowerCase();
                const number = /^\d/.test(text) ? Number.parseInt(text, 10) : null;
                if (!rawValue) {
                    booleanSetting = !negated;
                }
                else if (negated) {
                    addError(`Negated boolean '${canonical}' should not have a parameter`);
                    continue;
                }
                else if ('true'.startsWith(text) || 'yes'.startsWith(text) || text === 'on'
                    || number === 1) {
                    booleanSetting = true;
                }
                else if ('false'.startsWith(text) || 'no'.startsWith(text) || text === 'off'
                    || number === 0) {
                    booleanSetting = false;
                }
                else if (!optionMatch.valok) {
                    addError(`'${stripped}' is not valid for a boolean`);
                    continue;
                }
                else {
                    booleanSetting = true;
                }
            }
            // optfn_boolean()'s female/male special case: each spelling is
            // compared with strncmpi(opts, name, max(value length, 3)), so
            // a value longer than the name compares the delimiter, misses
            // both branches, and falls through to the plain assignment,
            // which writes only flags.female — not initgend.
            if (canonical === 'female' && booleanSetting !== null) {
                const valueLength = colonIdx < 0 ? 0 : stripped.length - colonIdx - 1;
                const run = Math.max(valueLength, 3);
                const femaleBranch = run <= 6 && asciiNameEqual('female', bindingOption, run);
                const maleBranch = run <= 4 && asciiNameEqual('male', bindingOption, run);
                const female = femaleBranch || !maleBranch
                    ? booleanSetting : !booleanSetting;
                result.flags.female = female;
                if (femaleBranch || maleBranch) {
                    result.flags.initgend = Number(female);
                    result.gender = female ? 'female' : 'male';
                }
                continue;
            }
            const characterFacet = canonical === 'role' || canonical === 'race'
                || canonical === 'gender' || canonical === 'alignment' ? canonical : null;
            if (characterFacet) {
                configureCharacterOption(result, {
                    facet: characterFacet, value: colonIdx < 0 ? null : stripped.slice(colonIdx + 1),
                    spelling: stripped, negated,
                    previous: characterOptionsSeen, fromFile, usingAlias,
                }, addError);
                continue;
            }
            // options.c:shared_menu_optfn() binds a key to one of the
            // menu paging commands: negation is refused outright, the key
            // is mandatory, and illegal_menu_cmd_key() rejects control and
            // printable reserved keys and default object-class symbols.
            if (MENU_KEY_OPTIONS[canonical] === true) {
                if (bindingOption !== canonical)
                    continue;
                const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                if (!raw)
                    addError(`Missing parameter for '${stripped}'`);
                else {
                    const key = bindingKeyCode(raw);
                    const illegal = menuCommandKeyError(key);
                    if (illegal)
                        addError(illegal);
                    else
                        result.commandBindings.bindMenuKey(key, canonical);
                }
                continue;
            }
            if (canonical === 'warnings') {
                // optfn_warnings() → warning_opts(): a value is mandatory
                // at startup (string_for_env_opt(FALSE)).
                if (!optionValue)
                    addError(`Missing parameter for '${stripped}'`);
                else
                    setWarningSymbols(optionValue, result.iflags);
                continue;
            }
            if (canonical === 'pickup_types') {
                if (!negated) {
                    result.flags.pickup_types = parsePickupTypes(optionValue ?? '').symbols;
                    if (!optionValue)
                        result.flags.pickup = true;
                }
                continue;
            }
            if (canonical === 'pile_limit') {
                // optfn_pile_limit(): string_for_opt() takes a value
                // unless negated, so a missing value draws the complaint
                // and still lands on the default; negation may not carry
                // a non-empty value.
                const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                if (negated && raw) {
                    addError(`The ${canonical} option may not both have a value and be negated.`);
                    continue;
                }
                if (!raw && !negated)
                    addError(`Missing parameter for '${stripped}'`);
                const limit = negated ? 0 : raw ? cInteger(raw) : 5;
                result.flags.pile_limit = limit < 0 ? 5 : limit;
                continue;
            }
            if (canonical === 'statushilites') {
                // options.c:optfn_statushilites(): negation clears the
                // duration; a missing value means the 3-turn default, atol()
                // junk is 0, and negative values clamp to 1.
                if (negated)
                    result.iflags.hiliteDelta = 0;
                else {
                    const delta = optionValue ? cInteger(optionValue) : 3;
                    result.iflags.hiliteDelta = delta < 0 ? 1 : delta;
                }
                continue;
            }
            if (canonical === 'runmode') {
                // optfn_runmode(): negation picks teleport; the value must
                // prefix one of the four modes; a value is mandatory.
                if (negated)
                    result.flags.runmode = 'teleport';
                else {
                    const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                    if (!raw)
                        addError(`Value is mandatory for ${canonical}`);
                    else {
                        const mode = ['teleport', 'run', 'walk', 'crawl']
                            .find(name => ciPrefixOf(name, raw));
                        if (mode)
                            result.flags.runmode = mode;
                        else
                            addError(`Unknown ${canonical} parameter '${raw}'`);
                    }
                }
                continue;
            }
            if (canonical === 'msg_window') {
                // optfn_msg_window(): a value's first letter names the
                // window mode; negation with a value is refused.
                const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                if (!raw)
                    result.iflags.prevmsg_window = negated ? 's' : 'f';
                else if (negated) {
                    addError(`The ${canonical} option may not both have a value and be negated.`);
                }
                else {
                    const initial = raw.charAt(0).toLowerCase();
                    if ('scfr'.includes(initial))
                        result.iflags.prevmsg_window = initial;
                    else
                        addError(`Unknown ${canonical} parameter '${raw}'`);
                }
                continue;
            }
            if (bindingOption === 'prayconfirm') {
                // optfn_paranoid_confirmation()'s deprecated alias: any
                // value is an error, otherwise it becomes ±pray.
                if (optionValue !== null && optionValue !== '') {
                    addError(`deprecated ${negated ? '!' : ''}prayconfirm option takes no parameters (found '${optionValue}')`);
                }
                else {
                    paranoiaBits = negated ? paranoiaBits & ~PARANOID_PRAY : paranoiaBits | PARANOID_PRAY;
                    paranoiaSeen = true;
                    result.flags.paranoia_bits = paranoiaBits;
                }
                continue;
            }
            if (canonical === 'versinfo') {
                // optfn_versinfo(): 1, 2, 4, or their sums; this build
                // carries no git branch, so the default is the number.
                // A missing value draws string_for_opt()'s complaint and
                // the handler's own line beneath it.
                const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                const value = cInteger(raw);
                if (!raw) {
                    addError(`Missing parameter for '${stripped}'`);
                    addError(`'${canonical}' requires a value; defaulting to 1`);
                }
                else if (!value || (value & ~7) !== 0) {
                    addError(`'${canonical}' must be one of 1, 2, 4, or the sum of two or all three of those`);
                }
                else
                    result.flags.versinfo = value;
                continue;
            }
            // optfn_pettype() and petname_optfn(); the alias "pet" and
            // abbreviations reach the same handler through the match above.
            if (canonical === 'pettype') {
                const value = colonIdx < 0 ? null : stripped.slice(colonIdx + 1);
                const preference = configuredPetType(value, negated);
                if (preference !== null) {
                    result.preferred_pet = preference;
                    if (value)
                        result.flags.pettype = value;
                }
                else if (value)
                    addError(`Unrecognized pet type '${value}'.`);
                else if (!negated)
                    addError(`Missing parameter for '${stripped}'`);
                continue;
            }
            const petNameOption = ['dogname', 'catname', 'horsename']
                .find(name => name === canonical);
            if (petNameOption) {
                if (negated) {
                    addError(`The ${petNameOption} option may not both have a value and be negated.`);
                    continue;
                }
                const value = colonIdx < 0 ? null : stripped.slice(colonIdx + 1);
                if (value === 'none' || value === '(none)')
                    result.flags[petNameOption] = '';
                else if (value) {
                    const delimiter = trimmedBytes.findIndex(byte => byte === 58 || byte === 61);
                    result.flags[petNameOption] = configuredPetName(trimmedBytes.subarray(delimiter + 1), !!result.iflags.wc_eight_bit_input);
                }
                continue;
            }
            if (canonical === 'number_pad') {
                // optfn_number_pad(): the bare spelling (or any form at
                // most ten characters long) means number_pad:1; a value
                // must be -1..4, and a zero must be written with a
                // leading '0'.
                const compat = stripped.length <= 10;
                const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                if (!raw) {
                    if (!compat)
                        addError(`Missing parameter for '${stripped}'`);
                    setNumberPadOption(1, result);
                }
                else {
                    const mode = cInteger(raw);
                    if (mode < -1 || mode > 4 || (mode === 0 && raw.charAt(0) !== '0')) {
                        addError(`Illegal ${canonical} parameter '${raw}'`);
                    }
                    else
                        setNumberPadOption(mode, result);
                }
                continue;
            }
            if (canonical === 'menustyle') {
                // optfn_menustyle(): a value is required once the spelling
                // exceeds five characters; shorter abbreviations take the
                // default full menus, or traditional when negated.
                const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                if (!raw && stripped.length > 5 && !negated) {
                    addError(`Missing parameter for '${stripped}'`);
                    continue;
                }
                const initial = raw ? raw.charAt(0).toLowerCase() : negated ? 'n' : 'f';
                const style = menuStyleForInitial(initial);
                if (style !== undefined)
                    result.flags.menu_style = style;
                else
                    addError(`Unknown ${canonical} parameter '${raw}'`);
                continue;
            }
            if (canonical === 'packorder') {
                // optfn_packorder(): an empty value is a silent error.
                if (optionValue)
                    changeInventoryOrder(optionValue, result);
                continue;
            }
            if (canonical === 'sortloot') {
                // optfn_sortloot(): a value is mandatory
                // (string_for_env_opt(FALSE)).
                const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                if (!raw)
                    addError(`Missing parameter for '${stripped}'`);
                else {
                    const mode = raw.charAt(0).toLowerCase();
                    if (isLootSortMode(mode))
                        result.flags.sortloot = mode;
                    else
                        addError(`Unknown ${canonical} parameter '${raw}'`);
                }
                continue;
            }
            if (canonical === 'sortdiscoveries') {
                const initial = optionValue?.charAt(0).toLowerCase();
                if (negated)
                    result.flags.discosort = 'o';
                else if (initial === 'o' || initial === '0')
                    result.flags.discosort = 'o';
                else if (initial === 's' || initial === '1')
                    result.flags.discosort = 's';
                else if (initial === 'c' || initial === '2')
                    result.flags.discosort = 'c';
                else if (initial === 'a' || initial === '3')
                    result.flags.discosort = 'a';
                else if (optionValue)
                    addError(`Unknown sortdiscoveries parameter '${optionValue}'`);
                else
                    addError(`Missing parameter for '${stripped}'`);
                continue;
            }
            if (canonical === 'altmeta' || canonical === 'toptenwin' || canonical === 'menu_tab_sep') {
                if (booleanSetting !== null)
                    result.iflags[canonical] = booleanSetting;
                continue;
            }
            if (canonical === 'scores') {
                // optfn_scores(): a value is mandatory; an explicit value
                // replaces all three display choices.
                const choices = parseScoreOption(optionValue, negated);
                if (!choices)
                    addError(`Missing parameter for '${stripped}'`);
                else {
                    result.flags.end_top = choices.end_top;
                    result.flags.end_around = choices.end_around;
                    result.flags.end_own = choices.end_own;
                    if (choices.error)
                        addError(choices.error);
                }
                continue;
            }
            if (canonical === 'fruit') {
                // optfn_fruit(): the value is mandatory at startup and is
                // condensed before the name is sanitized.
                const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                if (!raw)
                    addError(`Missing parameter for '${stripped}'`);
                else
                    result.fruit = normalizePreferredFruitName(raw, result);
                continue;
            }
            if (canonical === 'rest_on_space') {
                if (booleanSetting !== null) {
                    result.flags.rest_on_space = booleanSetting;
                    result.commandBindings.setRestOnSpace(booleanSetting, { initial: true });
                }
                continue;
            }
            // optfn_autounlock(): bare means apply-key, negation none, and
            // a value is a '+'- or space-separated list whose members
            // prefix or fuzzymatch an unlock type — matched
            // case-insensitively but dispatched on the exact lowercase
            // first letter — while 'none' cannot mix with them.  Like C,
            // each pass trims the remainder before splitting off one
            // separator, so separator runs collapse.
            if (canonical === 'autounlock') {
                const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                if (!raw) {
                    result.flags.autounlock = negated ? 0 : AUTOUNLOCK_APPLY_KEY;
                }
                else {
                    const sep = raw.includes('+') ? '+' : ' ';
                    let bits = 0;
                    let none = negated;
                    let invalid = null;
                    let rest = raw.trim();
                    for (;;) {
                        const cut = rest.indexOf(sep);
                        const op = (cut < 0 ? rest : rest.slice(0, cut)).trim();
                        if (ciPrefixOf('none', op)) {
                            none = true;
                        }
                        else {
                            const type = AUTOUNLOCK_TYPES.find(([name]) => ciPrefixOf(name, op) || fuzzyMatch(op, name));
                            if (!type || type[0].charAt(0) !== op.charAt(0)) {
                                invalid = op;
                                break;
                            }
                            bits |= type[1];
                        }
                        if (cut < 0)
                            break;
                        rest = rest.slice(cut + 1).trim();
                    }
                    if (invalid !== null) {
                        addError(`Invalid value for "autounlock": "${invalid}"`);
                    }
                    else if (none && bits !== 0) {
                        addError("Invalid value combination for \"autounlock\": 'none' with some");
                    }
                    else
                        result.flags.autounlock = none ? 0 : bits;
                }
                continue;
            }
            // optfn_disclose(): no value means prompt-yes everywhere,
            // negation discloses nothing, "all" and "none" name the whole
            // set, and a value lists categories with optional y/n/?/+/-/#
            // prefixes (k and d are legacy aliases; every check runs
            // through lowc() but the diagnostic keeps the original case).
            // Like end_disclose[], the six slots persist across disclose
            // statements: the walk stops at the first bad character and
            // keeps both what it set and what earlier lines left.
            if (canonical === 'disclose') {
                const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                if (raw && negated) {
                    addError(`The ${canonical} option may not both have a value and be negated.`);
                    continue;
                }
                const slots = parseDisclosureSettings(result.flags.disclose);
                const lowered = raw.toLowerCase();
                if (!raw || lowered === 'all' || lowered === 'none') {
                    const value = !raw || lowered === 'all'
                        ? (negated ? '-' : 'y') : '-';
                    for (const category of DISCLOSURE_CATEGORIES)
                        slots[category] = value;
                }
                else {
                    let prefix = null;
                    for (const character of raw) {
                        const letter = character.toLowerCase();
                        const resolved = letter === 'k' ? 'v' : letter === 'd' ? 'o' : letter;
                        const category = DISCLOSURE_CATEGORIES.find(entry => entry === resolved);
                        if (category) {
                            let value = prefix ?? '+';
                            if (prefix && category !== 'v' && category !== 'g') {
                                if (prefix === '?')
                                    value = 'y';
                                else if (prefix === '#')
                                    value = '+';
                            }
                            slots[category] = value;
                            prefix = null;
                        }
                        else if ('yn?+-#'.includes(letter)) {
                            prefix = letter;
                        }
                        else if (letter !== ' ') {
                            addError(`Unknown ${canonical} parameter '${character}'`);
                            break;
                        }
                    }
                }
                result.flags.disclose = serializeDisclosureSlots(slots);
                continue;
            }
            // optfn_name(): the value is mandatory at startup
            // (string_for_env_opt(FALSE)), with or without a delimiter.
            if (canonical === 'name') {
                const val = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1).trim();
                if (val)
                    result.name = val;
                else
                    addError(`Missing parameter for '${stripped}'`);
                continue;
            }
            // optfn_pickup_burden(): a value is mandatory
            // (string_for_env_opt(FALSE)), with or without a delimiter;
            // its first letter picks the burden, with 'o' and 't' both
            // selecting overtaxed.
            if (canonical === 'pickup_burden') {
                const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                if (!raw) {
                    addError(`Missing parameter for '${stripped}'`);
                    continue;
                }
                const initial = raw.charAt(0).toLowerCase();
                const burden = 'ubsntl'.indexOf(initial === 'o' ? 't' : initial);
                if (burden >= 0)
                    result.flags.pickup_burden = burden;
                else
                    addError(`Unknown ${canonical} parameter '${raw}'`);
                continue;
            }
            if (colonIdx >= 0) {
                const val = stripped.slice(colonIdx + 1).trim();
                // optfn_playmode(): duplicates refuse outright; the value
                // prefixes normal/play, explore/discovery, debug/wizard.
                if (canonical === 'playmode') {
                    const raw = stripped.slice(colonIdx + 1);
                    const matches = (word, length) => raw.length >= length
                        && raw.slice(0, length).toLowerCase() === word.slice(0, length);
                    if (duplicateOption || !raw) {
                        // optn_err without a diagnostic.
                    }
                    else if (matches('normal', 6) || raw.toLowerCase() === 'play') {
                        result.flags.debug = false;
                        result.flags.explore = false;
                    }
                    else if (matches('explore', 6) || matches('discovery', 6)) {
                        result.flags.explore = true;
                        result.flags.debug = false;
                    }
                    else if (matches('debug', 5) || matches('wizard', 6)) {
                        result.flags.debug = true;
                        result.flags.explore = false;
                    }
                    else
                        addError(`Invalid value for "playmode":${raw}`);
                }
                else if (canonical === 'symset') {
                    // options.c:optfn_symset() loads the set from the
                    // symbols file.  A name no `start:` line carries fails,
                    // clears the choice, and reports the error; "default"
                    // itself clears the choice without loading (files.c
                    // read_sym_file()).
                    if (isDefaultSymsetName(val))
                        result.symset = undefined;
                    else if (SYMSET_NAMES[val.toLowerCase()] === true)
                        result.symset = val;
                    else {
                        result.symset = undefined;
                        addError(`Unable to load symbol set "${val}" from "symbols"`);
                    }
                }
                else if (canonical === 'menu_headings') {
                    if (negated)
                        addError('The menu_headings option may not both have a value and be negated.');
                    else {
                        const style = parseColorAttr(val, addError);
                        if (style)
                            result.iflags.menu_headings = style;
                    }
                }
                else if (canonical === 'suppress_alert') {
                    const parsed = negated ? null : featureAlertVersion(val);
                    if (parsed && !parsed.future)
                        result.flags.suppress_alert = parsed.version;
                }
                else if (canonical === 'paranoid_confirmation') {
                    if (negated) {
                        if (!val) {
                            paranoiaBits = 0;
                            paranoiaSeen = true;
                            result.flags.paranoia_bits = 0;
                        }
                        else
                            addError(`!${canonical} does not accept a value`);
                        continue;
                    }
                    if (!val) {
                        addError(`${canonical} requires a value; use 'none' to cancel all`);
                        continue;
                    }
                    paranoiaBits = updateParanoiaBits(paranoiaBits, val, addError);
                    paranoiaSeen = true;
                    result.flags.paranoia_bits = paranoiaBits;
                }
                else {
                    const option = requestBooleanByName.get(canonical);
                    const value = booleanSetting;
                    if (option && value !== null)
                        setConfigurationBoolean(result, option, value);
                }
            }
            else {
                const value = booleanSetting ?? !negated;
                if (canonical === 'autopickup')
                    result.flags.pickup = value;
                else if (canonical === 'color')
                    result.flags.color = value;
                else if (canonical === 'legacy')
                    result.flags.legacy = value;
                else if (canonical === 'pauper') {
                    result.flags.pauper = value;
                    // options.c applies this implication immediately, so a
                    // later explicit !nudist may still override it.
                    if (value)
                        result.flags.nudist = true;
                }
                else if (canonical === 'nudist')
                    result.flags.nudist = value;
                else if (canonical === 'blind')
                    result.flags.blind = value;
                else if (canonical === 'deaf')
                    result.flags.deaf = value;
                else if (canonical === 'tutorial') {
                    result.flags.tutorial = value;
                    result.tutorial_set = true;
                }
                else if (canonical === 'splash_screen')
                    result.iflags.wc_splash_screen = value;
                else if (canonical === 'wizmgender' || canonical === 'wizweight')
                    result.iflags[canonical] = value;
                else if (canonical === 'montelecontrol')
                    result.monTelecontrol = value;
                else if (canonical === 'pushweapon')
                    result.flags.pushweapon = value;
                else if (canonical === 'showexp')
                    result.flags.showexp = value;
                else if (canonical === 'time')
                    result.flags.time = value;
                else if (canonical === 'verbose')
                    result.flags.verbose = value;
                else if (canonical === 'paranoid_confirmation') {
                    // Without a delimiter: negation clears every bit; the
                    // bare option demands a value.
                    if (negated) {
                        paranoiaBits = 0;
                        paranoiaSeen = true;
                        result.flags.paranoia_bits = paranoiaBits;
                    }
                    else
                        addError(`${canonical} requires a value; use 'none' to cancel all`);
                }
                else {
                    const option = requestBooleanByName.get(canonical);
                    if (option)
                        setConfigurationBoolean(result, option, value);
                    else if (canonical === 'bones')
                        result.flags.bones = value;
                    else if (canonical === 'reroll')
                        result.flags.reroll = value;
                    // optfn_menu_headings() without a value: inverse, or
                    // none when negated.
                    else if (canonical === 'menu_headings')
                        result.iflags.menu_headings = { attr: negated ? C_ATR_NONE : C_ATR_INVERSE, color: NO_COLOR };
                }
            }
        }
    }
    if (paranoiaSeen)
        result.flags.paranoia_bits = paranoiaBits;
    return result;
}
// C options.c:parse_role_opt(). Negative lists change filters without
// replacing an already specified choice; each option source has its own list.
function configureCharacterOption(result, { facet, value, spelling, negated, previous, fromFile, usingAlias, }, addError) {
    if (!value) {
        addError(`Missing parameter for '${spelling}'`);
        return;
    }
    const filters = result.characterFilters ??= createCharacterFilters();
    let priorNegation = null;
    let positiveValue = null;
    let filterOnly = false;
    const duplicate = fromFile && previous.has(facet);
    const words = value.trim();
    for (let token of words ? words.split(/\s+/) : []) {
        let tokenNegated = false;
        while (token.startsWith('!') || /^no/i.test(token)) {
            tokenNegated = !tokenNegated;
            token = token.slice(token.startsWith('!') ? 1 : token[2] === '-' ? 3 : 2);
        }
        if (!token) {
            addError(`Negated nothing for '${facet}'`);
            return;
        }
        if (priorNegation !== null) {
            if (tokenNegated !== priorNegation || negated && tokenNegated) {
                addError(`Invalid mixed negation for '${negated ? '!' : ''}${facet}'`);
                return;
            }
            if (!negated && !tokenNegated) {
                addError('Multiple role values only allowed when list is negated');
                return;
            }
        }
        priorNegation = tokenNegated;
        if (negated || tokenNegated) {
            if (previous.get(facet) !== 'negative')
                clearCharacterFilter(filters, facet);
            if (!setCharacterFilter(filters, token)) {
                addError(`Invalid ${facet} '${token}'`);
                return;
            }
            previous.set(facet, 'negative');
            filterOnly = true;
        }
        else {
            if (duplicate && previous.get(facet) === 'negative') {
                const alias = facet === 'role' ? 'character' : facet === 'alignment' ? 'align' : '(null)';
                addError(`compound option specified multiple times: ${facet}${usingAlias ? ` (via alias: ${alias})` : ''}`);
                return;
            }
            previous.set(facet, 'positive');
            positiveValue = token;
        }
    }
    if (filterOnly)
        return;
    positiveValue ??= '';
    const selected = facet === 'role' ? findRole(positiveValue)
        : facet === 'race' ? findRace(positiveValue)
            : facet === 'gender' ? findGender(positiveValue) : findAlignment(positiveValue);
    const random = randomCharacterOption(positiveValue);
    if (!selected && !random)
        addError(`Unknown ${facet} '${positiveValue}'`);
    const choice = selected || random ? positiveValue : null;
    switch (facet) {
        case 'role':
            result.role = choice;
            break;
        case 'race':
            result.race = choice;
            break;
        case 'gender':
            result.gender = choice;
            result.flags.initgend = findGender(choice)?.value ?? (random ? -2 : -1);
            if (choice)
                result.flags.female = random || findGender(choice)?.value === 1;
            break;
        case 'alignment':
            result.align = choice;
            break;
    }
}
// C cfgfiles.c:parse_conf_buf() counts physical lines, including comments,
// and attributes a continued statement to its final physical line. The
// diagnostic echoes that line; OPTIONS values retain internal whitespace.
function* configurationLines(rc, report) {
    let pending = new Uint8Array(0);
    let lineNumber = 0;
    let sourceLine = '';
    // cfgfiles.c:gc.config_section_chosen / config_section_current.
    let sectionChosen = null;
    let sectionCurrent = null;
    const physicalLines = rc.split('\n');
    for (const [index, raw] of physicalLines.entries()) {
        const length = new TextEncoder().encode(raw).length;
        const hasNewline = index < physicalLines.length - 1;
        // split() leaves an empty element after the final newline. fgets()
        // never reads that element, so an unfinished continuation stays unused.
        if (!hasNewline && !raw)
            break;
        if (length > 4 * BUFSZ - 2 || (!hasNewline && length === 4 * BUFSZ - 2)) {
            // parse_conf_buf() rejects a full fgets buffer before advancing
            // the error frame, so this diagnostic still names the prior line.
            report.errors.push({ sourceLine, lineNumber, message: 'Line too long, skipping' });
            continue;
        }
        lineNumber++;
        const original = raw.split('\0')[0] ?? '';
        const continued = original.endsWith('\\');
        // C leaves ep at the removed backslash's NUL, so its whitespace
        // trimming loop does not visit the spaces before a continuation.
        sourceLine = continued ? original.slice(0, -1) : original.replace(/[ \t\r]+$/, '');
        const content = sourceLine.replace(/^[ \t]+/, '');
        if (content && !content.startsWith('#')) {
            // Keep native bytes through option parsing: truncation can split
            // a UTF-8 character, and sanitize_name() must see the retained byte.
            const bytes = new TextEncoder().encode(content);
            const separator = pending.length ? 1 : 0;
            const joined = new Uint8Array(pending.length + separator + bytes.length);
            joined.set(pending);
            if (separator)
                joined[pending.length] = 32;
            joined.set(bytes, pending.length + separator);
            pending = joined.subarray(0, 4 * BUFSZ - 1);
        }
        if (continued || !pending.length)
            continue;
        // handle_config_section() calls trimspaces() on every completed
        // statement, including one ended by a comment or blank line.
        let end = pending.length;
        while (end > 0 && (pending[end - 1] === 32 || pending[end - 1] === 9))
            end--;
        const statement = new TextDecoder().decode(pending.subarray(0, end));
        // C cfgfiles.c:handle_config_section() consumes section headers and
        // drops statements that belong to another section.
        const section = configSectionName(statement);
        if (section !== undefined) {
            // C frees config_section_current before checking whether a
            // choice exists, so every header leaves the current section
            // unset until a named one is entered.
            sectionCurrent = null;
            if (sectionChosen === null) {
                report.errors.push({ sourceLine, lineNumber,
                    message: cutConfigBytes(`Section "[${section}]" without CHOOSE`, BUFSZ - 1) });
            }
            else if (section) {
                sectionCurrent = section;
            }
            else {
                sectionChosen = null;
            }
            pending = new Uint8Array(0);
            continue;
        }
        if (sectionCurrent !== null && sectionCurrent !== sectionChosen) {
            pending = new Uint8Array(0);
            continue;
        }
        // CHOOSE= is handled before any statement; its value keeps the raw
        // spacing after the delimiter, and the section choice consumes one
        // core rn2() (cfgfiles.c:choose_random_part()).
        const delimiter = statement.search(/[:=]/);
        let nameEnd = delimiter < 0 ? statement.length : delimiter;
        while (nameEnd > 0 && (statement[nameEnd - 1] === ' '
            || statement[nameEnd - 1] === '\t'))
            nameEnd--;
        const name = statement.slice(0, nameEnd).toLowerCase();
        if (name.length >= 6 && 'choose'.startsWith(name)) {
            if (delimiter < 0) {
                report.errors.push({ sourceLine, lineNumber,
                    message: cutConfigBytes('Format is CHOOSE=section1,section2,...', BUFSZ - 1) });
            }
            else {
                // C frees the previous choice before drawing, so a failed
                // CHOOSE leaves no section chosen.
                sectionChosen = chooseRandomPart(statement.slice(delimiter + 1));
                if (sectionChosen === null)
                    report.errors.push({ sourceLine, lineNumber,
                        message: cutConfigBytes('No config section to choose', BUFSZ - 1) });
            }
            pending = new Uint8Array(0);
            continue;
        }
        yield { bytes: pending.subarray(0, end), sourceLine, lineNumber };
        pending = new Uint8Array(0);
    }
}
function configurationOptions(bytes) {
    const options = [];
    let start = 0;
    for (let index = 0; index <= bytes.length; index++) {
        if (index < bytes.length && bytes[index] !== 44)
            continue;
        options.push(bytes.subarray(start, index));
        start = index + 1;
    }
    return options.reverse();
}
function trimConfigurationOption(bytes) {
    // C parseoptions() uses isspace() on individual bytes before parsing.
    const whitespace = (byte) => byte === 32
        || (byte !== undefined && byte >= 9 && byte <= 13);
    let start = 0;
    let end = bytes.length;
    while (start < end && whitespace(bytes[start]))
        start++;
    while (end > start && whitespace(bytes[end - 1]))
        end--;
    return bytes.subarray(start, end);
}
// C options.c:optfn_pettype() ignores negation when a value is supplied.
// Horse is accepted, but dog.c:pet_type() still chooses a dog or cat unless
// the role supplies its own pet.
function configuredPetType(value, negated) {
    if (!value)
        return negated ? 'n' : null;
    switch (value.charAt(0).toLowerCase()) {
        case 'd': return 'd';
        case 'c':
        case 'f': return 'c';
        case 'h':
        case 'q': return 'h';
        case 'n': return 'n';
        case 'r':
        case '*': return '';
        default: return null;
    }
}
// C options.c:nmcpy() copies bytes; bones.c:sanitize_name() replaces control
// bytes and strips printable high bytes only when eight-bit input is disabled.
function configuredPetName(value, eightBitInput) {
    const bytes = value.subarray(0, PL_PSIZ - 1);
    const nameBytes = [];
    for (const byte of bytes) {
        if (byte === 0 || byte === 44)
            break;
        const character = byte & 0x7f;
        if (character < 32 || character === 127)
            nameBytes.push('.'.charCodeAt(0));
        else
            nameBytes.push(byte > 127 && !eightBitInput ? '_'.charCodeAt(0) : byte);
    }
    // The tty consumes individual characters, even when these bytes no
    // longer form UTF-8 after sanitizing or reaching the name limit.
    return String.fromCharCode(...nameBytes);
}
const NUMBER_PAD_CHOICES = [
    ' 0 (off)', ' 1 (on)', ' 2 (on, MSDOS compatible)',
    ' 3 (on, phone-style digit layout)',
    ' 4 (on, phone-style layout, MSDOS compatible)',
    "-1 (off, 'z' to move upper-left, 'y' to zap wands)",
];
function numberPadDescription() {
    const bindings = game.commandBindings;
    if (!bindings.numberPad)
        return bindings.swapYZ ? '-1=off, y & z swapped' : '0=off';
    if (bindings.phoneLayout)
        return bindings.pcHack
            ? '4=on, phone layout, MSDOS compatible' : '3=on, phone-style layout';
    return bindings.pcHack ? '2=on, MSDOS compatible' : '1=on';
}
async function editNumberPad() {
    const selected = await showMultiSelectWindow({
        title: 'Select number_pad mode:', omitHeadings: true, pickOne: true,
        sections: [{ items: NUMBER_PAD_CHOICES.map((text, index) => ({
                    key: String.fromCharCode(97 + index), groupAccelerator: String(index), text, value: index,
                })) }],
    });
    const index = selected[0];
    if (index !== undefined)
        setNumberPadOption(index === 5 ? -1 : index, game);
}
const REQUEST_MENU_BOOLEAN_OPTIONS = [
    ['accessiblemsg', 'accessiblemsg', false],
    ['acoustics', 'acoustics', true],
    ['altmeta', 'altmeta', false],
    ['armorstatus', 'armorstatus', false],
    ['autodescribe', 'autodescribe', true],
    ['autodig', 'autodig', false],
    ['autoopen', 'autoopen', true],
    ['autopickup', 'pickup', false],
    ['bgcolors', 'bgcolors', true],
    ['autoquiver', 'autoquiver', false],
    ['checkpoint', 'checkpoint', true],
    ['cmdassist', 'cmdassist', true],
    ['color', 'color', true],
    ['confirm', 'confirm', true],
    ['customcolors', 'customcolors', true],
    ['customsymbols', 'customsymbols', true],
    ['dark_room', 'dark_room', true],
    ['dropped_nopick', 'dropped_nopick', true],
    ['eight_bit_tty', 'wc_eight_bit_input', false],
    ['extmenu', 'extmenu', false],
    ['fireassist', 'fireassist', true],
    ['fixinv', 'fixinv', true],
    ['force_invmenu', 'force_invmenu', false],
    ['goldX', 'goldX', false],
    ['help', 'help', true],
    ['herecmd_menu', 'herecmd_menu', false],
    ['hilite_pet', 'hilite_pet', false],
    ['hilite_pile', 'hilite_pile', false],
    ['hitpointbar', 'hitpointbar', false],
    ['ignintr', 'ignintr', false],
    ['implicit_uncursed', 'implicit_uncursed', true],
    ['lit_corridor', 'lit_corridor', false],
    ['lootabc', 'lootabc', false],
    ['mail', 'mail', true],
    ['mention_decor', 'mention_decor', false],
    ['mention_map', 'mention_map', false],
    ['mention_walls', 'mention_walls', false],
    ['menu_overlay', 'menu_overlay', true],
    ['menu_tab_sep', 'menu_tab_sep', false],
    ['menucolors', 'menucolors', false],
    ['mon_movement', 'mon_movement', false],
    ['montelecontrol', '_monTelecontrol', false],
    ['null', 'null', true],
    ['pickup_stolen', 'pickup_stolen', true],
    ['pickup_thrown', 'pickup_thrown', true],
    ['price_quotes', 'price_quotes', false],
    ['pushweapon', 'pushweapon', false],
    ['query_menu', 'query_menu', false],
    ['quick_farsight', 'quick_farsight', false],
    ['rest_on_space', 'rest_on_space', false],
    // optlist.h: the safe_pet option stores flags.safe_dog.
    ['safe_pet', 'safe_dog', true],
    ['safe_wait', 'safe_wait', true],
    ['showdamage', 'showdamage', false],
    ['showexp', 'showexp', false],
    ['showrace', 'showrace', false],
    ['showvers', 'showvers', false],
    ['silent', 'silent', true],
    ['sortpack', 'sortpack', true],
    ['sounds', 'sounds', false],
    ['sparkle', 'sparkle', true],
    ['spot_monsters', 'spot_monsters', false],
    ['standout', 'standout', false],
    ['terrainstatus', 'terrainstatus', false],
    ['time', 'time', false],
    ['tips', 'tips', true],
    ['tombstone', 'tombstone', true],
    ['toptenwin', 'toptenwin', false],
    ['travel', 'travel', true],
    ['use_inverse', 'use_inverse', true],
    ['verbose', 'verbose', true],
    ['weaponstatus', 'weaponstatus', false],
    ['whatis_menu', 'getloc_usemenu', false],
    ['whatis_moveskip', 'getloc_moveskip', false],
];
// C options.c:option_help(), next_opt(); descriptions from include/optlist.h.
export async function option_help() {
    const lines = [
        '', '                 NetHack Options Help:', '',
        // Replay configuration supplies contents without a host file path.
        'Set options as OPTIONS=<options> in .nethackrc',
        'or use `NETHACKOPTIONS="<options>"\' in your environment',
        '(<options> is a list of options separated by commas)',
        'or press "O" while playing and use the menu.', '',
        'Boolean options (which can be negated by prefixing them with \'!\' or "no"):',
    ];
    const wizardNames = new Set(['menu_tab_sep', 'monpolycontrol', 'montelecontrol',
        'sanity_check', 'travel_debug', 'wizmgender', 'wizweight']);
    const debugNames = ['debug_hunger', 'debug_mongen', 'debug_overwrite_stairs'];
    const booleanNames = [
        ...REQUEST_MENU_BOOLEAN_OPTIONS.map(([name]) => name),
        'blind', 'bones', 'deaf', 'female', 'idlecheckpoint', 'legacy',
        'monpolycontrol', 'news', 'nudist', 'pauper', 'reroll', 'sanity_check',
        'selectsaved', 'status_updates', 'travel_debug', 'tutorial',
        'use_darkgray', 'use_truecolor', 'voices', 'wizmgender', 'wizweight',
        ...(game.flags.debug && !game.iflags.debug_fuzzer ? debugNames : []),
    ].filter(name => game.flags.debug || !wizardNames.has(name))
        .sort((left, right) => left.toLowerCase() < right.toLowerCase() ? -1
        : left.toLowerCase() > right.toLowerCase() ? 1 : 0);
    let row = '';
    for (const name of booleanNames) {
        if (row.length + name.length + 2 > COLNO - 2) {
            lines.push(row);
            row = '';
        }
        row += `${name}, `;
    }
    lines.push(row.replace(/, $/, '.'), '', 'Compound options:');
    for (const [index, [name, description]] of OPTION_HELP_COMPOUNDS.entries()) {
        // The final native table entry is the font prefix, even on tty.
        lines.push(`${("`" + name + "'").padEnd(20)} - ${description}${index === OPTION_HELP_COMPOUNDS.length - 1 ? '.' : ','}`);
    }
    lines.push('', 'Other settings:', ...['autocompletions', 'autopickup exceptions', 'bind keys', 'menu colors',
        'message types', 'status condition fields', 'status highlight rules'].map(name => ` ${name}`), '', '', 'Some of the options can only be set before the game is started;', "those items will not be selectable in the 'O' command's menu.", "Some options are stored in a game's save file, and will keep saved", 'values when restoring that game even if you have updated your config-', 'uration file to change them.  Such changes will matter for new games.', 'The "other settings" can be set with \'O\', but when set within the', 'configuration file they use their own directives rather than OPTIONS.', 'See NetHack\'s "Guidebook" for details.');
    await displayPagerText(lines);
}
const OPTION_HELP_COMPOUNDS = [
    ["windowtype", "windowing system to use (should be specified first)"],
    ["playmode", "normal play, non-scoring explore mode, or debug mode"],
    ["name", "your character's name (e.g., name:Merlin-W)"],
    ["role", "your starting role (e.g., Barbarian, Valkyrie)"],
    ["race", "your starting race (e.g., Human, Elf)"],
    ["gender", "your starting gender (male or female)"],
    ["alignment", "your starting alignment (lawful, neutral, or chaotic)"],
    ["altkeyhandling", "(not applicable)"],
    ["autounlock", "action to take when encountering locked door or chest"],
    ["boulder", "deprecated (use S_boulder in sym file instead)"],
    ["catname", "name of your starting pet if it is a kitten"],
    ["crash_email", "email address for reporting"],
    ["crash_name", "your name for reporting"],
    ["crash_urlmax", "length of longest url we can generate"],
    ["DECgraphics", "load DECGraphics display symbols into symset"],
    ["disclose", "the kinds of information to disclose at end of game"],
    ["dogname", "name of your starting pet if it is a little dog"],
    ["dungeon", "list of symbols to use in drawing the dungeon map"],
    ["effects", "list of symbols to use in drawing special effects"],
    ["fruit", "name of a fruit you enjoy eating"],
    ["glyph", "set representation of a glyph to a unicode value and color"],
    ["hilite_status", "a status highlighting rule (can occur multiple times)"],
    ["horsename", "name of your starting pet if it is a pony"],
    ["IBMgraphics", "load IBMGraphics display symbols into symset"],
    ["menu_deselect_all", "deselect all items in a menu"],
    ["menu_deselect_page", "deselect all items on this page of a menu"],
    ["menu_first_page", "jump to the first page in a menu"],
    ["menu_headings", "display style for menu headings"],
    ["menu_invert_all", "invert all items in a menu"],
    ["menu_invert_page", "invert all items on this page of a menu"],
    ["menu_last_page", "jump to the last page in a menu"],
    ["menu_next_page", "go to the next menu page"],
    ["menu_objsyms", "show object symbols in menus"],
    ["menu_previous_page", "go to the previous menu page"],
    ["menu_search", "search for a menu item"],
    ["menu_select_all", "select all items in a menu"],
    ["menu_select_page", "select all items on this page of a menu"],
    ["menu_shift_left", "pan current menu page left"],
    ["menu_shift_right", "pan current menu page right"],
    ["menuinvertmode", "experimental behavior of menu inverts"],
    ["menustyle", "user interface for object selection"],
    ["monsters", "list of symbols to use for monsters"],
    ["msg_window", "control of \"view previous message(s)\" (^P) behavior"],
    ["msghistory", "number of top line messages to save"],
    ["number_pad", "use the number pad for movement"],
    ["objects", "list of symbols to use for objects"],
    ["packorder", "the inventory order of the items in your pack"],
    ["paranoid_confirmation", "extra prompting in certain situations"],
    ["petattr", "attributes for highlighting pets"],
    ["pettype", "your preferred initial pet type"],
    ["pickup_burden", "maximum burden picked up before prompt"],
    ["pickup_types", "types of objects to pick up automatically"],
    ["pile_limit", "threshold for \"there are many objects here\""],
    ["roguesymset", "load a set of rogue display symbols from symbols file"],
    ["runmode", "display frequency when `running' or `travelling'"],
    ["scores", "the parts of the score list you wish to see"],
    ["sortdiscoveries", "preferred order when displaying discovered objects"],
    ["sortloot", "sort object selection lists by description"],
    ["sortvanquished", "preferred order when displaying vanquished monsters"],
    ["soundlib", "soundlib interface to use (if any)"],
    ["statushilites", "0=no status highlighting, N=show highlights for N turns"],
    ["statuslines", "2 or 3 lines for status display"],
    ["suppress_alert", "suppress alerts about version-specific features"],
    ["symset", "load a set of display symbols from symbols file"],
    ["traps", "list of symbols to use in drawing traps"],
    ["versinfo", "extra information for 'showvers'"],
    ["warnings", "display characters for warnings"],
    ["whatis_coord", "show coordinates when auto-describing cursor position"],
    ["whatis_filter", "filter coordinate locations when targeting next or previous"],
    ["cond_", "prefix for cond_ options"],
    ["font", "prefix for font options"],
];
const requestBooleanByName = new Map(REQUEST_MENU_BOOLEAN_OPTIONS.map(option => [option[0].toLowerCase(), option]));
function requestBooleanValue(name) {
    const option = requestBooleanByName.get(name.toLowerCase());
    if (!option)
        return false;
    const [, property, fallback] = option;
    if (property === '_monTelecontrol')
        return game._monTelecontrol ?? fallback;
    if (property === 'bgcolors' || property === 'sounds' || property === 'altmeta' || property === 'toptenwin' || property === 'menu_tab_sep'
        || property === 'wc_eight_bit_input' || property === 'autodescribe'
        || property === 'getloc_usemenu' || property === 'getloc_moveskip')
        return game.iflags[property] ?? fallback;
    return game.flags[property] ?? fallback;
}
function setConfigurationBoolean(settings, option, value) {
    const [, property] = option;
    if (property === '_monTelecontrol')
        settings.monTelecontrol = value;
    else if (property === 'bgcolors' || property === 'sounds' || property === 'altmeta' || property === 'toptenwin' || property === 'menu_tab_sep'
        || property === 'wc_eight_bit_input' || property === 'autodescribe'
        || property === 'getloc_usemenu' || property === 'getloc_moveskip')
        settings.iflags[property] = value;
    else
        settings.flags[property] = value;
}
function setRequestBoolean(option, value) {
    const [, property] = option;
    if (property === '_monTelecontrol')
        game._monTelecontrol = value;
    else if (property === 'bgcolors' || property === 'sounds' || property === 'altmeta' || property === 'toptenwin' || property === 'menu_tab_sep'
        || property === 'wc_eight_bit_input' || property === 'autodescribe'
        || property === 'getloc_usemenu' || property === 'getloc_moveskip')
        game.iflags[property] = value;
    else
        game.flags[property] = value;
}
function requestMenuIdentity() {
    const role = game.urole?.name?.m || game.urole?.key || 'Rogue';
    const race = game.urace?.name || 'human';
    const gender = game.flags?.female ? 'female' : 'male';
    const alignment = game.initAlignment?.name || 'neutral';
    return { role, race, gender, alignment };
}
function scoreDisplayDescription() {
    const top = game.flags.end_top ?? 3;
    const around = game.flags.end_around ?? 2;
    const parts = [];
    if (top > 0)
        parts.push(`${top} top`);
    if (around > 0)
        parts.push(`${around} around`);
    if (game.flags.end_own)
        parts.push('own');
    return parts.join('/') || 'none';
}
function preferredPetDescription() {
    const preference = game.preferred_pet ?? '';
    switch (preference) {
        case 'c': return 'cat';
        case 'd': return 'dog';
        case 'h': return 'horse';
        case 'n': return 'none';
        default: return 'random';
    }
}
// dat/symbols: the symsets a `start:` line defines, and the handling each
// declares with `Handling:`.  The port renders only DECgraphics symbols,
// but options.c:optfn_symset() get_val still reports any loadable set's
// declared handler.
const SYMSET_NAMES = {
    plain: true, blank: true, ibmgraphics: true, ibmgraphics_1: true,
    ibmgraphics_2: true, rogueibm: true, rogueepyx: true, roguewindows: true,
    curses: true, decgraphics: true, macgraphics: true, enhanced1: true,
    enhanced2: true, amigafont: true,
};
const SYMSET_HANDLINGS = {
    ibmgraphics: 'IBM', ibmgraphics_1: 'IBM', ibmgraphics_2: 'IBM',
    rogueibm: 'IBM', rogueepyx: 'IBM', roguewindows: 'IBM',
    curses: 'DEC', decgraphics: 'DEC',
    macgraphics: 'MAC',
    enhanced1: 'UTF8', enhanced2: 'UTF8',
};
// files.c:read_sym_file() accepts a name that matches no `start:` line only
// when it fuzzymatches "Default symbols" (ignoring spaces, '-' and '_') or
// is exactly "default"; that choice clears the set instead of loading one.
function isDefaultSymsetName(name) {
    return name.toLowerCase() === 'default'
        || name.toLowerCase().replace(/[ \-_]/g, '') === 'defaultsymbols';
}
// options.c:optfn_symset() get_val: the loaded set's name, ", active" while
// the primary set is current, and the handling the set declared.
function symsetMenuValue() {
    const name = game.symset;
    if (!name)
        return 'default';
    const active = !Is_rogue_level(game.u?.uz) ? ', active' : '';
    const handling = SYMSET_HANDLINGS[name.toLowerCase()] ?? null;
    return `${name}${active}${handling ? `, handler=${handling}` : ''}`;
}
// coloratt.c:clr2colorname()/attr2attrname(): the first canonical table
// entry naming the value.
function colorName(color) {
    return COLOR_NAMES.find(([, value]) => value === color)?.[0] ?? 'no color';
}
function attributeName(attr) {
    return ATTRIBUTE_NAMES.find(([, value]) => value === attr)?.[0] ?? 'none';
}
// options.c:optfn_menu_headings() get_val: color_attr_to_str() followed by
// strNsubst() turning each blank into '-'.
function menuHeadingsValue() {
    const style = game.iflags.menu_headings ?? { attr: C_ATR_INVERSE, color: NO_COLOR };
    return `${colorName(style.color)}&${attributeName(style.attr)}`.replace(/ /g, '-');
}
// options.c:optfn_statushilites() get_val.
function statusHilitesValue() {
    const delta = game.iflags.hiliteDelta ?? 0;
    return delta ? `${delta} (on: highlight status for ${delta} turns)`
        : "0 (off: don't highlight status fields)";
}
function requestMenuSections() {
    const { role, race, gender, alignment } = requestMenuIdentity();
    const choice = (name, text) => ({
        value: name, text: textOptionValue(name) === null ? text : `${name.padEnd(24)}[${textOptionValue(name)}]`,
        itemFlags: requestBooleanByName.has(name.toLowerCase()) || name === 'idlecheckpoint' ? MENU_ITEMFLAGS_SKIPINVERT : 0,
    });
    const label = (text) => ({ selectable: false, text });
    const readonly = (name, value) => label(`    ${name.padEnd(24)}[${value}]`);
    const boolean = (name) => choice(name, `${name.padEnd(24)}[${requestBooleanValue(name) ? 'true' : 'false'}]`);
    return [
        { heading: 'Booleans (selecting will toggle value):', items: [
                readonly('blind', !!game.u?.uroleplay?.blind),
                readonly('bones', game.flags.bones !== false),
                readonly('deaf', !!game.u?.uroleplay?.deaf),
                readonly('legacy', game.flags?.legacy !== false),
                readonly('news', false),
                readonly('nudist', !!game.u?.uroleplay?.nudist),
                readonly('pauper', !!game.u?.uroleplay?.pauper),
                readonly('reroll', !!game.u?.uroleplay?.reroll),
                readonly('selectsaved', true),
                readonly('status_updates', true),
                readonly('tutorial', game.flags?.tutorial !== false),
                readonly('use_darkgray', true),
                readonly('use_truecolor', false),
                readonly('voices', 'excluded from build'),
                boolean('accessiblemsg'),
                boolean('acoustics'),
                boolean('altmeta'),
                boolean('armorstatus'),
                boolean('autodescribe'),
                boolean('autodig'),
                boolean('autoopen'),
                boolean('autopickup'),
                boolean('autoquiver'),
                choice('bgcolors', `bgcolors                [${requestBooleanValue('bgcolors') ? 'on' : 'off'}]`),
                boolean('checkpoint'),
                boolean('cmdassist'),
                boolean('color'),
                boolean('confirm'),
                boolean('customcolors'),
                boolean('customsymbols'),
                boolean('dark_room'),
                boolean('dropped_nopick'),
                boolean('eight_bit_tty'),
                boolean('extmenu'),
                boolean('fireassist'),
                boolean('fixinv'),
                boolean('force_invmenu'),
                boolean('goldX'),
                boolean('help'),
                boolean('herecmd_menu'),
                boolean('hilite_pet'),
                boolean('hilite_pile'),
                boolean('hitpointbar'),
                choice('idlecheckpoint', 'idlecheckpoint          [off]'),
                boolean('ignintr'),
                boolean('implicit_uncursed'),
                boolean('lit_corridor'),
                boolean('lootabc'),
                boolean('mail'),
                boolean('mention_decor'),
                boolean('mention_map'),
                boolean('mention_walls'),
                boolean('menu_overlay'),
                ...(game.flags.debug ? [boolean('menu_tab_sep')] : []),
                boolean('menucolors'),
                boolean('mon_movement'),
                ...(game.flags.debug ? [boolean('montelecontrol')] : []),
                boolean('null'),
                boolean('pickup_stolen'),
                boolean('pickup_thrown'),
                boolean('price_quotes'),
                boolean('pushweapon'),
                boolean('query_menu'),
                boolean('quick_farsight'),
                boolean('rest_on_space'),
                boolean('safe_pet'),
                boolean('safe_wait'),
                boolean('showdamage'),
                boolean('showexp'),
                boolean('showrace'),
                boolean('showvers'),
                boolean('silent'),
                boolean('sortpack'),
                choice('sounds', `sounds                  [${requestBooleanValue('sounds') ? 'on' : 'off'}]`),
                boolean('sparkle'),
                boolean('spot_monsters'),
                boolean('standout'),
                boolean('terrainstatus'),
                boolean('time'),
                boolean('tips'),
                boolean('tombstone'),
                boolean('toptenwin'),
                boolean('travel'),
                boolean('use_inverse'),
                boolean('verbose'),
                boolean('weaponstatus'),
                boolean('whatis_menu'),
                boolean('whatis_moveskip'),
                label(''),
            ] },
        { heading: 'Compounds (selecting will prompt for new value):', items: [
                readonly('windowtype', 'tty'),
                readonly('playmode', game.flags.debug ? 'debug' : game.flags.explore ? 'explore' : 'normal'),
                readonly('name', game.plname),
                readonly('role', role),
                readonly('race', race),
                readonly('gender', gender),
                readonly('alignment', alignment),
                readonly('catname', game.flags.catname || '(none)'),
                readonly('dogname', game.flags.dogname || '(none)'),
                readonly('horsename', game.flags.horsename || '(none)'),
                readonly('msghistory', '20'),
                readonly('pettype', preferredPetDescription()),
                readonly('soundlib', 'nosound'),
                choice('autounlock', `autounlock              [${compoundMenuValue('autounlock')}]`),
                choice('boulder', 'boulder                 [`]'),
                choice('crash_email', 'crash_email             [unknown]'),
                choice('crash_name', 'crash_name              [unknown]'),
                choice('crash_urlmax', 'crash_urlmax            [-1]'),
                choice('disclose', `disclose                [${compoundMenuValue('disclose')}]`),
                choice('fruit', `fruit                   [${game.fruitName}]`),
                choice('glyph', 'glyph                   [(to be done)]'),
                choice('hilite_status', 'hilite_status           [(none)]'),
                choice('menu_headings', `${'menu_headings'.padEnd(24)}[${menuHeadingsValue()}]`),
                choice('menu_objsyms', 'menu_objsyms            [conditional]'),
                choice('menuinvertmode', 'menuinvertmode          [1]'),
                choice('menustyle', `menustyle               [${MENU_STYLES[game.flags.menu_style ?? MENU_FULL][0]}]`),
                choice('msg_window', `msg_window              [${compoundMenuValue('msg_window')}]`),
                choice('number_pad', `number_pad              [${numberPadDescription()}]`),
                choice('packorder', `packorder               [${inventoryOrderSymbols()}]`),
                choice('paranoid_confirmation', `paranoid_confirmation   [${compoundMenuValue('paranoid_confirmation')}]`),
                choice('petattr', 'petattr                 [inverse]'),
                choice('pickup_burden', `pickup_burden           [${compoundMenuValue('pickup_burden')}]`),
                choice('pickup_types', `pickup_types            [${game.flags?.pickup_types || 'all'}]`),
                choice('pile_limit', 'pile_limit              [5]'),
                choice('roguesymset', 'roguesymset             [default]'),
                choice('runmode', `runmode                 [${compoundMenuValue('runmode')}]`),
                choice('scores', `scores                  [${scoreDisplayDescription()}]`),
                choice('sortdiscoveries', `sortdiscoveries         [${discoverySortDescription()}]`),
                choice('sortloot', `sortloot                [${SORT_LOOT_NAMES[game.flags.sortloot ?? 'l']}]`),
                choice('sortvanquished', 'sortvanquished          [t: traditional: by monster level]'),
                choice('statushilites', `${'statushilites'.padEnd(24)}[${statusHilitesValue()}]`),
                choice('statuslines', 'statuslines             [2]'),
                choice('suppress_alert', 'suppress_alert          [(none)]'),
                choice('symset', `symset                  [${symsetMenuValue()}]`),
                choice('versinfo', `versinfo                [${compoundMenuValue('versinfo')}]`),
                choice('whatis_coord', `whatis_coord            [${compoundMenuValue('whatis_coord')}]`),
                choice('whatis_filter', `whatis_filter           [${compoundMenuValue('whatis_filter')}]`),
                label(''),
            ] },
        { heading: 'Other settings:', items: [
                choice('autocompletions', 'autocompletions         [(0 currently set)]'),
                choice('autopickup_exceptions', `${'autopickup exceptions'.padEnd(24)}[(${game.iflags.autopickupExceptions?.length ?? 0} currently set)]`),
                choice('bind_keys', 'bind keys               [(0 currently set)]'),
                choice('menu_colors', `${'menu colors'.padEnd(24)}[(${game.iflags.menuColorings?.length ?? 0} currently set)]`),
                choice('message_types', 'message types           [(0 currently set)]'),
                choice('status_conditions', `status condition fields [${compoundMenuValue('status_conditions')}]`),
                choice('status_highlights', 'status highlight rules  [(0 currently set)]'),
            ] }
    ];
}
const PICKUP_TYPE_ROWS = [
    ['a', '$', 'pile of coins'],
    ['b', '"', 'amulet'],
    ['c', ')', 'weapon'],
    ['d', '[', 'suit or piece of armor'],
    ['e', '%', 'piece of food'],
    ['f', '?', 'scroll'],
    ['g', '+', 'spellbook'],
    ['h', '!', 'potion'],
    ['i', '=', 'ring'],
    ['j', '/', 'wand'],
    ['k', '(', 'useful item (pick-axe, key, lamp...)'],
    ['l', '*', 'gem or rock'],
    ['m', '`', 'boulder or statue'],
    ['n', '0', 'iron ball'],
    ['o', '_', 'iron chain'],
];
// options.c:optfn_pickup_types() prompts in traditional/combination mode;
// windows.c:choose_classes_menu() owns the full/partial class picker.
async function editPickupTypes(preserveStatus = false) {
    const previous = game.flags.pickup_types ?? '';
    game.flags.pickup_types = '';
    let value = previous;
    let useMenu = true;
    if ((game.flags.menu_style ?? MENU_FULL) <= 1) {
        const answer = await getLine(`New pickup_types: [${inventoryOrderSymbols()} am] (${previous || 'all'})`, (_character, key) => key >= 32 && key < 127);
        value = answer === null || !answer ? previous : answer.trim().replace(/ +/g, ' ');
        useMenu = value.startsWith('m');
    }
    if (useMenu) {
        const symbols = inventoryOrderSymbols() + (game.flags.debug ? '.' : '');
        const classes = [...symbols].map((symbol, index) => {
            const description = PICKUP_TYPE_ROWS.find(([, candidate]) => candidate === symbol)?.[2] ?? 'splash of venom';
            return { key: String.fromCharCode(97 + index), groupAccelerator: symbol, value: symbol,
                text: `${symbol}  ${description}`,
                itemFlags: previous.includes(symbol) ? MENU_ITEMFLAGS_SELECTED : 0 };
        });
        // tty menu display honors WIN_STOP before clearing the message row.
        await displayMessageWindow();
        clearMessageWindow();
        await flush_screen(1);
        const underlay = snapshotMenuUnderlay();
        if (!preserveStatus) {
            game.nhDisplay?.clearRow(22);
            game.nhDisplay?.clearRow(23);
        }
        const selected = await showMultiSelectWindow({
            title: 'Autopickup what?', omitHeadings: true, signalEscape: true,
            sections: [{ items: [
                        ...classes,
                        { selectable: false, text: '' },
                        { key: 'A', value: ' ', text: '   All classes of objects', itemFlags: MENU_ITEMFLAGS_SKIPINVERT },
                        { selectable: false, text: 'Note: when no choices are selected, "all" is implied.' },
                        { selectable: false, text: game.flags.pickup
                                ? "Toggle off 'autopickup' to not pick up anything."
                                : "Toggle on 'autopickup' to automatically pick these things up." },
                    ] }],
        });
        restoreMenuUnderlay(underlay);
        value = selected === null ? previous : selected.includes(' ') ? '' : selected.join('');
    }
    const parsed = parsePickupTypes(value);
    game.flags.pickup_types = parsed.symbols;
    if (parsed.invalid)
        await optionError("Unknown pickup_types parameter ''");
}
// options.c:handle_add_list_remove(): the shared add/list/remove chooser.
// With nothing to act on, only "add" and "exit" are offered.
async function chooseAddListRemove(kind, count) {
    const choices = [
        { key: 'a', value: 'add', text: `add new ${kind}` },
        { key: 'l', value: 'list', text: `list ${kind}s` },
        { key: 'r', value: 'remove', text: `remove existing ${kind}` },
        { key: 'x', value: 'done', text: 'exit this menu', itemFlags: MENU_ITEMFLAGS_SELECTED },
    ];
    const items = count ? choices : choices.filter(item => item.value !== 'list' && item.value !== 'remove');
    const picks = await showMultiSelectWindow({
        title: 'Do what?', omitHeadings: true, pickOne: true, signalEscape: true,
        sections: [{ items }],
    });
    // PICK_ONE may return the preselected exit together with the new choice.
    const [first = 'done', second] = picks ?? [];
    return second !== undefined && first === 'done' ? second : first;
}
// options.c:handler_autopickup_exception().
async function editAutopickupExceptions() {
    for (;;) {
        const exceptions = game.iflags.autopickupExceptions ?? [];
        const action = await chooseAddListRemove('autopickup exception', exceptions.length);
        if (action === 'done')
            return;
        if (action === 'add') {
            const answer = await getLine('What new autopickup exception pattern?', (_character, key) => key >= 32 && key < 127);
            if (answer === null)
                return;
            const pattern = new TextDecoder().decode(mungSpaces(new TextEncoder().encode(answer)));
            if (!pattern)
                continue;
            // The handler wraps the answer in quotes (apebuf's bounds cap the
            // whole mapping at 255 bytes) and reuses the config parser; its
            // diagnostics pline immediately in-game.
            const errors = [];
            const rule = parseAutopickupException(`"${cutConfigBytes(pattern, 255)}"`, message => errors.push(message));
            for (const message of errors)
                await optionError(message);
            if (rule)
                (game.iflags.autopickupExceptions ??= []).unshift(rule);
            continue;
        }
        const rows = exceptions.map(rule => ({
            value: rule, text: `"${rule.grab ? '<' : '>'}${rule.pattern}"`,
        }));
        if (action === 'remove') {
            const picked = await showMultiSelectWindow({
                title: 'Remove which autopickup exceptions', pageLocalKeys: true,
                signalEscape: true,
                sections: [{ heading: "Always pickup '<'; never pickup '>'", items: rows }],
            });
            if (picked === null)
                return;
            for (const rule of picked) {
                const index = exceptions.indexOf(rule);
                if (index >= 0)
                    exceptions.splice(index, 1);
            }
        }
        else {
            const answer = await showInventoryWindow([{ heading: "Always pickup '<'; never pickup '>'", items: rows.map(row => ({ text: row.text })) }], { title: 'List of autopickup exceptions', pickMode: PICK_NONE });
            if (answer.key === 27)
                return;
        }
    }
}
// options.c:handler_menu_colors() and coloratt.c:query_color()/query_attr().
async function editMenuColors() {
    for (;;) {
        const colorings = game.iflags.menuColorings ?? [];
        const action = await chooseAddListRemove('menucolor', colorings.length);
        if (action === 'done')
            return;
        if (action === 'add') {
            const pattern = await getLine('What new menucolor pattern?', (_character, key) => key >= 32 && key < 127);
            if (pattern === null)
                return;
            if (pattern) {
                let regex = null;
                try {
                    regex = new PosixRegex(pattern);
                }
                catch (error) {
                    if (!(error instanceof SyntaxError))
                        throw error;
                    await optionError(`MENUCOLORS regex: ${error.message}`);
                }
                if (regex) {
                    const color = await queryColorMenu('Pick a color', NO_COLOR);
                    if (color !== null) {
                        const attr = await queryAttributeMenu('Pick an attribute', 0);
                        if (attr !== null) {
                            (game.iflags.menuColorings ??= []).unshift({ origstr: pattern, color, attr, regex });
                            game.flags.menucolors = true;
                        }
                    }
                }
            }
            continue;
        }
        if (action === 'remove') {
            const picked = await showMultiSelectWindow({
                title: 'Remove which menu colors', omitHeadings: true,
                pageLocalKeys: true, signalEscape: true,
                sections: [{ items: colorings.map(rule => ({ value: rule, text: menuColoringRow(rule) })) }],
            });
            if (picked === null)
                return;
            for (const rule of picked) {
                const index = colorings.indexOf(rule);
                if (index >= 0)
                    colorings.splice(index, 1);
            }
        }
        else {
            // C assigns a non-zero identifier to every row of both the list
            // and remove menus, so the tty prefixes letters even for this
            // PICK_NONE listing (unlike the autopickup-exception listing,
            // whose rows carry a zero identifier).
            const answer = await showInventoryWindow([{ items: colorings.map(rule => ({ value: rule, text: menuColoringRow(rule) })) }], { title: 'List of menu colors', pickMode: PICK_NONE });
            if (answer.key === 27)
                return;
        }
    }
}
// handler_menu_colors(): `"pattern"="=color&attr` minus one leading quote of
// the C suffix buffer, i.e. the pattern's closing quote is kept; the color
// name's blank becomes '-', there is no attribute half for ATR_NONE, and an
// overflowing original string is elided with "..." at the byte level.
function menuColoringRow(rule) {
    const color = colorName(rule.color).replace(/ /g, '-');
    const suffix = `"=${color}${rule.attr !== 0 ? `&${attributeName(rule.attr)}` : ''}`;
    // C: ln = BUFSZ - strlen("\"\"=suffix") - 1, and strncat() counts bytes.
    const limit = 254 - suffix.length;
    const shown = new TextEncoder().encode(rule.origstr).length > limit
        ? `${cutConfigBytes(rule.origstr, limit - 3)}...` : rule.origstr;
    return `"${shown}${suffix}`;
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
            if (color === CLR_BLACK || color === CLR_WHITE || color === NO_COLOR)
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
async function queryColorMenu(title, current) {
    basicMenuColors(true);
    let picks;
    try {
        picks = await showMultiSelectWindow({
            title, omitHeadings: true, pickOne: true, signalEscape: true, pageLocalKeys: true,
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
async function queryAttributeMenu(title, current) {
    const picks = await showMultiSelectWindow({
        title, omitHeadings: true, pickOne: true, signalEscape: true, pageLocalKeys: true,
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
// options.c:handler_menu_headings() via coloratt.c:query_color_attr(). The
// style only changes when both menus are answered; a cancellation leaves it
// untouched (the C handler assigns into iflags at the very end).
async function editMenuHeadings() {
    const current = game.iflags.menu_headings ?? { attr: C_ATR_INVERSE, color: NO_COLOR };
    const prompt = 'How to highlight menu headings:';
    const color = await queryColorMenu(prompt, current.color);
    if (color === null)
        return;
    const attr = await queryAttributeMenu(prompt, current.attr);
    if (attr === null)
        return;
    game.iflags.menu_headings = { attr, color };
}
// C options.c:optfn_bool(), followed by reset_needed_visuals(). Status-only
// changes need bot(); map-affecting changes defer the full docrt until all
// selected options and their compound handlers have finished.
function applyBooleanVisualChange(name) {
    if (name === 'terrainstatus')
        classifyStatusTerrain(game);
    if (['showexp', 'time', 'showvers', 'weaponstatus', 'armorstatus', 'terrainstatus', 'hitpointbar'].includes(name))
        reassessStatusFields();
    if (name === 'dark_room' || name === 'lit_corridor') {
        vision_recalc(2);
        game.vision_full_recalc = 1;
        return requestBooleanValue('color');
    }
    return ['color', 'customcolors', 'hilite_pet', 'hilite_pile',
        'customsymbols', 'hitpointbar', 'showrace', 'use_inverse'].includes(name);
}
// C's HELP_IDX is distinct from the boolean 'help' option.
const OPTIONS_MENU_HELP = 'options_menu_help';
async function doRequestMenuOptions() {
    let skipHelp = game.flags.cmdassist === false;
    let needsRedraw = false;
    let giveBooleanMessage = game.iflags.optionMessages !== false;
    for (;;) {
        const sections = requestMenuSections().map(section => ({ items: [
                { selectable: false, text: section.heading ?? '', attr: ATR_INVERSE,
                    itemFlags: MENU_ITEMFLAGS_SKIPMENUCOLORS },
                ...section.items,
            ] }));
        if (!skipHelp)
            sections.unshift({ items: [
                    { selectable: false, text: "    For a brief explanation of how this works, type '?' to select" },
                    { selectable: false, text: '    the next menu choice, then press <enter> or <return>.' },
                    { key: '?', groupAccelerator: '?', value: OPTIONS_MENU_HELP, text: 'view help for options menu',
                        itemFlags: MENU_ITEMFLAGS_SKIPINVERT },
                    { selectable: false, text: "    [To suppress this menu help, toggle off the 'cmdassist' option.]" },
                    { selectable: false, text: '' },
                ] });
        const selected = await showMultiSelectWindow({
            title: 'Set what options?', pageLocalKeys: true, omitHeadings: true, sections,
        });
        for (const name of selected) {
            if (name === OPTIONS_MENU_HELP) {
                await displayHelpFile('optmenu');
                continue;
            }
            if (name === 'idlecheckpoint') {
                await plineWithContinuation("There is no underlying support for 'idlecheckpoint' compiled in.");
                giveBooleanMessage = false;
                game.iflags.optionMessages = false;
                continue;
            }
            const option = requestBooleanByName.get(name.toLowerCase());
            if (option) {
                const value = !requestBooleanValue(option[0]);
                setRequestBoolean(option, value);
                if (option[0] === 'rest_on_space')
                    game.commandBindings.setRestOnSpace(value);
                needsRedraw = applyBooleanVisualChange(option[0]) || needsRedraw;
                if (giveBooleanMessage)
                    await plineWithContinuation(`'${option[0]}' option toggled ${value ? 'on' : 'off'}.`);
            }
            else
                needsRedraw = await editCompoundOption(name, true) || needsRedraw;
        }
        if (selected.length !== 1 || selected[0] !== OPTIONS_MENU_HELP)
            break;
        skipHelp = true;
    }
    if (needsRedraw) {
        reglyph_darkroom();
        await docrt();
    }
    await bot();
    game.context.move = 0;
}
async function editCompoundOption(name, fullMenu) {
    const previousVersion = game.flags.versinfo ?? 1;
    if (name === 'number_pad')
        await editNumberPad();
    else if (name === 'menustyle')
        await editMenuStyle();
    else if (name === 'fruit')
        await editFruitOption(fullMenu && game.iflags.optionMessages !== false);
    else if (name === 'pickup_types')
        await editPickupTypes(fullMenu);
    else if (name === 'autopickup_exceptions')
        await editAutopickupExceptions();
    else if (name === 'menu_colors')
        await editMenuColors();
    else if (name === 'menu_headings')
        await editMenuHeadings();
    else if (name === 'sortloot')
        await editSortLoot();
    else if (name === 'sortdiscoveries')
        await chooseDiscoverySort(0);
    else if (await editCompoundMenu(name, fullMenu && game.iflags.optionMessages !== false))
        return name === 'versinfo' && (game.flags.versinfo ?? 1) !== previousVersion;
    else if (isTextOption(name)) {
        const value = await getLine(`Set ${name} to what?`, (_character, key) => key >= 32 && key < 127);
        if (value === null)
            return false;
        if (name === 'scores') {
            const parsed = parseScoreOption(value, false);
            if (parsed) {
                game.flags.end_top = parsed.end_top;
                game.flags.end_around = parsed.end_around;
                game.flags.end_own = parsed.end_own;
                if (parsed.error)
                    await optionError(parsed.error);
            }
            else
                await optionError("Missing parameter for 'scores:'");
        }
        else
            await setTextOption(name, value);
    }
    return false;
}
// Native options.c:handler_menustyle(). PICK_ONE retains the old selection
// until a different entry is chosen or the user explicitly deselects it.
async function editMenuStyle() {
    const previous = game.flags.menu_style ?? MENU_FULL;
    const separator = game.iflags.menu_tab_sep ? '\t' : ' ';
    const items = MENU_STYLES.flatMap(([name, first, second]) => [
        { key: name.charAt(0), text: `${name.padEnd(12)}${separator}${first}` },
        { text: `${' '.repeat(16)}${separator}${second}` },
    ]);
    const selection = await showInventoryWindow([{ items }], {
        title: 'Select menustyle:', pickMode: PICK_ONE,
        preselectedKey: MENU_STYLES[previous][0].charAt(0),
    });
    const chosen = menuStyleForInitial(String.fromCharCode(selection.key));
    game.flags.menu_style = chosen ?? previous;
    const changed = game.flags.menu_style !== previous;
    if (changed || game.flags.verbose) {
        const name = MENU_STYLES[game.flags.menu_style][0];
        await plineWithContinuation(`'menustyle' ${changed ? 'changed to' : 'is still'} "${name}".`);
    }
}
function menuStyleForInitial(initial) {
    if (initial === null)
        return undefined;
    switch (initial) {
        case 'n':
        case 't': return 0;
        case 'c': return 1;
        case 'f': return 2;
        case 'p': return 3;
        default: return undefined;
    }
}
function isLootSortMode(mode) {
    return mode === 'n' || mode === 'l' || mode === 'f';
}
const SORT_LOOT_NAMES = { n: 'none', l: 'loot', f: 'full' };
async function editSortLoot() {
    const previous = game.flags.sortloot ?? 'l';
    const selection = await showInventoryWindow([{ items: Object.entries(SORT_LOOT_NAMES).map(([key, name]) => ({ key, text: name })),
        }], { title: 'Select loot sorting type:', pickMode: PICK_ONE, preselectedKey: previous });
    const mode = String.fromCharCode(selection.key);
    if (isLootSortMode(mode))
        game.flags.sortloot = mode;
}
async function editFruitOption(giveMessage) {
    const name = await getLine('Set fruit to what?', (_ch, code) => code >= 32 && code < 127, { suppressStatus: true });
    if (!name)
        return;
    const result = changePreferredFruit(name);
    // doset_simple suppresses this notice; doset keeps it.
    if (!result.changed || giveMessage)
        await plineWithContinuation(result.message);
}
// optlist.h assigns these options to the four simple-menu sections.
const SIMPLE_OPTION_SECTIONS = [
    ['General', [
            ['fruit', 'name of a fruit you enjoy eating'],
            ['number_pad', 'use the number pad for movement'],
            ['price_quotes', 'display prices you have seen for unidentified objects'],
        ]],
    ['Behavior', [
            ['autodig', 'dig if moving and wielding a digging tool'],
            ['autoopen', 'walking into a door attempts to open it'],
            ['autopickup', 'automatically pick up objects'],
            ['autopickup_exceptions', 'edit autopickup exceptions'],
            ['autoquiver', 'fill empty quiver automatically when firing'],
            ['autounlock', 'action to take when encountering locked door or chest'],
            ['cmdassist', 'give help for errors on direction input'],
            ['dropped_nopick', "don't autopickup dropped items"],
            ['fireassist', 'fire-command tries to be helpful'],
            ['pickup_stolen', 'autopickup stolen items'],
            ['pickup_thrown', 'autopickup thrown items'],
            ['pickup_types', 'types of objects to pick up automatically'],
            ['pushweapon', 'previous weapon goes to secondary slot'],
        ]],
    ['Map', [
            ['bgcolors', 'use background color for some map hilighting'],
            ['color', 'use color in map'],
            ['customcolors', 'use custom colors in map'],
            ['customsymbols', 'use custom utf8 symbols in map'],
            ['hilite_pet', 'use highlight for pets'],
            ['hilite_pile', 'highlight piles of items'],
            ['showrace', 'show your character by race rather than role'],
            ['sparkle', 'display sparkly effect when resisting magic'],
            ['symset', 'load a set of display symbols from symbols file'],
        ]],
    ['Status', [
            ['hitpointbar', 'show colored bar for hit points'],
            ['menu_colors', 'edit menu colors'],
            ['showexp', 'show experience points in status line'],
            ['status_conditions', 'change status condition highlighting'],
            ['status_highlights', 'change status line highlighting'],
            ['statuslines', '2 or 3 lines for status display'],
            ['time', 'display game turns in status line'],
        ]],
];
function simpleMenuSections() {
    const options = requestMenuSections().flatMap(section => section.items);
    return [
        { items: [
                ...(game.iflags.simple_options_help
                    ? [{ selectable: false, text: "Use command '#optionsfull' to get the complete options list." }]
                    : []),
                { key: '?', value: 'help', text: game.iflags.simple_options_help ? 'hide help' : 'show help' },
            ] },
        ...SIMPLE_OPTION_SECTIONS.map(([heading, names]) => {
            const items = [
                { selectable: false, text: '' },
                { selectable: false, text: ` ${heading.padEnd(30)} `, attr: ATR_INVERSE,
                    itemFlags: MENU_ITEMFLAGS_SKIPMENUCOLORS },
            ];
            for (const [name, description] of names) {
                const option = options.find(item => item.selectable !== false && item.value === name);
                if (!option || option.selectable === false)
                    throw new Error(`Missing simple option: ${name}`);
                const boolean = requestBooleanByName.get(name.toLowerCase());
                const text = boolean ? `${name.padEnd(24)}[${requestBooleanValue(boolean[0]) ? 'X' : ' '}]`
                    : option.text;
                const suffix = ['pickup_types', 'pickup_thrown', 'pickup_stolen', 'dropped_nopick'].includes(name)
                    ? '  (for autopickup)' : '';
                items.push({ value: name, text: text + suffix });
                if (game.iflags.simple_options_help) {
                    items.push({ selectable: false, text: `    ${description}` }, { selectable: false, text: '' });
                }
            }
            return { items };
        }),
    ];
}
// options.c:doset_simple() applies one choice, refreshes its visuals, and
// offers a fresh menu. PICK_ONE accepts a choice immediately.
export async function doOptions(menuRequested = false) {
    if (menuRequested) {
        await doRequestMenuOptions();
        return;
    }
    for (;;) {
        const selected = await showMultiSelectWindow({
            title: 'Options', pageLocalKeys: true, omitHeadings: true,
            sections: simpleMenuSections(), pickOne: true,
        });
        const name = selected[0];
        if (!name)
            break;
        if (name === 'help') {
            game.iflags.simple_options_help = !game.iflags.simple_options_help;
            continue;
        }
        const option = requestBooleanByName.get(name.toLowerCase());
        let needsRedraw = false;
        if (option) {
            setRequestBoolean(option, !requestBooleanValue(option[0]));
            needsRedraw = applyBooleanVisualChange(option[0]);
        }
        else
            needsRedraw = await editCompoundOption(name, false);
        if (needsRedraw) {
            reglyph_darkroom();
            await docrt();
            await flush_screen(1);
        }
        await bot();
    }
    // doset_simple resets pending visuals after cancellation too. A full-screen
    // tty dismissal clears status while its input owner still suppresses bot().
    await bot();
    game.iflags.optionMessages = true;
    game.context.move = 0;
}
//# sourceMappingURL=options.js.map