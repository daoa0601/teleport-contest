// options.c in one module: parseoptions(), the optfn_*() handlers, the
// doset()/doset_simple() menus, the handler_*() pickers, and the msgtype
// rule engine (msgtype_parse_add(), msgtype_type(),
// hide_unhide_msgtypes()). The rc-file statements that carry OPTIONS=
// elements live in cfgfiles.ts (C cfgfiles.c); the named-fruit registry
// helpers used by bones/level gen stay in objnam.js; the symbols-file
// loader read_sym_file() lives in novel_tribute.ts (C files.c).

import { PosixRegex } from './posix_regex.js';
import { ILLOBJ_CLASS, COIN_CLASS, FOOD_CLASS } from './objclass.js';
import { game } from './gstate.js';
import type { CharacterFacet, CharacterFilters } from './role.js';
import { clearrolefilter, createCharacterFilters, setrolefilter } from './role.js';
import { randomCharacterOption, str2align, str2gend, str2race, str2role } from './role.js';
import { NATIVE_COMMANDS } from './command_data.js';
import { changeCommandAutocompletions, countCommandAutocompletions, setCommandAutocomplete } from './cmd.js';
import type { AutopickupExceptionRule, GameFlags, InterfaceFlags, LootSortMode, MenuStyle } from './flags.js';
import type { MenuColoringRule } from './coloratt.js';
import type { ConfigurationErrorReport } from './cfgfiles.js';
import { displayHelpFile, displayPagerText } from './pager.js';
import { setConditionOption } from './botl.js';
import { classifyStatusTerrain } from './hack.js';
import { rn2, rnd } from './rng.js';
import { isTextOption, textOptionValue, cInteger, optionError } from './option_values.js';
import { readSymFile, isDefaultSymsetName } from './novel_tribute.js';
import { featureAlertVersion } from './extversion.js';
import type { InventoryMenuItem, MenuLabel, PageLocalMenuItem, PageLocalMultiSelectSection, SelectableMenuItem } from './windows.js';
import { compoundMenuValue, editCompoundMenu } from './option_editors.js';
import { clearStatusHilites, countStatusHilites, statusHiliteMenu, resetStatusHilites } from './botl.js';
import { parseStatusHl1, replayStatusHiliteOperations } from './botl.js';
import type { StatusHiliteOperation } from './botl.js';
import { countBindKeys, handlerRebindKeys } from './cmd.js';
import { CommandBindings } from './command_bindings.js';
import { reassignInventoryLetters } from './invent.js';
import { fruitRegistry, fruitFromName, makeSingular, preferredFruitName } from './objnam.js';
import { nameToMonster } from './mondata.js';
import { MONSTER_CLASS_SYMBOLS } from './monster_data.js';
import { OBJECT_NAMES, getObjectClassBounds } from './object_data.js';
import type { Fruit, GameState } from './game_state.js';
import { bot, checkGoldSymbol, reassessStatusFields } from './botl.js';
import {
    currentBoulderSymbol, docrt, flush_screen,
    reglyph_darkroom, reglyphBoulderSymbols,
} from './display.js';
import { clearMessageWindow, displayMessageWindow } from './topl.js';
import { plineWithContinuation } from './pline.js';
import { vision_recalc } from './vision.js';
import { getLine } from './windows.js';
import { inventoryClassOrder, inventoryOrderSymbols } from './invent.js';
import type { InventoryOrderState } from './invent.js';
import { chooseDiscoverySort, discoverySortDescription } from './o_init.js';
import { ATR_INVERSE, showInventoryWindow, showMultiSelectWindow } from './windows.js';
import { restoreMenuUnderlay, snapshotMenuUnderlay } from './wintty.js';
import { NO_COLOR } from './terminal.js';
import { AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_FORCE, AUTOUNLOCK_KICK, AUTOUNLOCK_UNTRAP, WARNCOUNT } from './const.js';
import { OBJECT_CLASS_SYMBOLS } from './display.js';
import { mungSpaces, fuzzyMatch, asciiLower, asciiNameEqual, ciPrefixOf, visibleCommandKey } from './hacklib.js';

import { DISCLOSURE_CATEGORIES } from './end.js';
import { setVanqOrder, vanquishedOptionValue } from './insight.js';
import { C_ATR_INVERSE, C_ATR_NONE } from './color_attr.js';
import { attributeName, colorAttrToString, colorName, matchAttributeName,
    matchColorName, parseColorAttr, parseMenuColoring, queryAttr, queryColorMenu } from './coloratt.js';
import { cutConfigBytes } from './cfgfiles.js';
import {
    BUFSZ, CLR_MAX, COLNO, Is_rogue_level, MENU_FULL, MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_SKIPINVERT,
    MENU_ITEMFLAGS_SKIPMENUCOLORS, MSGTYP_NORMAL, MSGTYP_NOREP, MSGTYP_NOSHOW, MSGTYP_STOP,
    PICK_NONE, PICK_ONE, PL_PSIZ,
    PARANOID_AUTOALL, PARANOID_BONES, PARANOID_BREAKWAND, PARANOID_CONFIRM,
    PARANOID_DIE, PARANOID_EATING, PARANOID_HIT, PARANOID_PRAY,
    PARANOID_QUIT, PARANOID_REMOVE, PARANOID_SWIM, PARANOID_TRAP, PARANOID_WERECHANGE, def_warnsyms,
    STONE,
} from './const.js';
import { editSymset } from './options.js';

// C options.c:ask_do_tutorial(). Empty acceptance rebuilds the menu with
// an explanation; a selected answer or Escape ends the question.
export async function askTutorial(): Promise<boolean> {
    let pass = 0;
    for (;;) {
        const items: InventoryMenuItem[] = [
            { key: 'y', text: 'Yes, do a tutorial' },
            { key: 'n', text: 'No, just start play' },
            { text: '' },
            { text: 'Put "OPTIONS=!tutorial" in .nethackrc to skip this query.' },
        ];
        if (pass++) items.push({ text: "(Please choose 'y' or 'n'.)" });
        const answer = await showInventoryWindow([{ items }], {
            title: 'Do you want a tutorial?', pickMode: PICK_ONE,
        });
        if (answer.key === 0) continue;
        return answer.key === 'y'.charCodeAt(0);
    }
}

type PetPreference = '' | 'c' | 'd' | 'h' | 'n';

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
] as const;

interface OptionTableEntry {
    name: string;
    alias: string | null;
    isBool: boolean;
    negateok: boolean;
    valok: boolean;
    dupeok: boolean;
    pfx: boolean;
    // OthrOpt entries ("bind keys" &c): complain_about_duplicate() calls
    // everything but CompOpt "boolean", and their do_set is empty.
    other: boolean;
    // Booleans optfn_boolean() skips during startup: the null-address
    // options of this build (BIOS, rawio, showscore, timed_delay,
    // vt_tiledata, vt_sounddata) return before looking at the value, and
    // the set_wiznofuz options (debug_*) fail silently while opt_initial.
    silent: boolean;
    minmatch: number;
    index: number;
}

interface OptionMatch extends OptionTableEntry {
    viaAlias: boolean;
}



// C options.c:determine_ambiguities(): minmatch is one past the longest
// common case-insensitive prefix with any other option name, clamped to
// [3, name length].
const OPTION_ENTRIES: readonly OptionTableEntry[] = (() => {
    const names = OPTION_TABLE.map(entry => entry[0]);
    const needed = names.map(() => 0);
    for (const [i, a] of names.entries()) {
        for (const [j, b] of names.entries()) {
            if (i === j) continue;
            let common = 1;
            while (common <= a.length && common <= b.length
                && asciiLower(a.charCodeAt(common - 1))
                    === asciiLower(b.charCodeAt(common - 1))) common++;
            if (common > (needed[i] ?? 0)) needed[i] = common;
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

// options.c:default_menu_cmd_info[] — the menu_* names that bind a key to
// a menu paging command rather than configuring a compound option.
export const MENU_KEY_OPTIONS: Record<string, true> = {
    menu_next_page: true, menu_previous_page: true, menu_first_page: true,
    menu_last_page: true, menu_select_all: true, menu_invert_all: true,
    menu_deselect_all: true, menu_select_page: true, menu_invert_page: true,
    menu_deselect_page: true, menu_search: true, menu_shift_right: true,
    menu_shift_left: true,
};





// options.c unlocktypes[][]: autounlock action names and their bits.
const AUTOUNLOCK_TYPES = [
    ['untrap', AUTOUNLOCK_UNTRAP],
    ['apply-key', AUTOUNLOCK_APPLY_KEY],
    ['kick', AUTOUNLOCK_KICK],
    ['force', AUTOUNLOCK_FORCE],
] as const;




export interface ConfigurationSettings {
    configErrors: ConfigurationErrorReport[];
    flags: GameFlags;
    iflags: InterfaceFlags;
    commandBindings: CommandBindings;
    name?: string;
    role?: string | null;
    race?: string | null;
    gender?: string | null;
    align?: string | null;
    characterFilters?: CharacterFilters;
    fruit?: string;
    symset?: string | undefined;
    // Set when a symset choice explicitly reverted to "default".
    symsetCleared?: boolean;
    rogueSymset?: string | undefined;
    rogueSymsetCleared?: boolean;
    // gs.showsyms[SYM_BOULDER + SYM_OFF_X] override from BOULDER=.
    boulderSym?: string;
    // optfn_boulder() also writes the rogue set's override.
    rogueBoulderSym?: string;
    preferred_pet?: PetPreference;
    monTelecontrol?: boolean;
    monPolycontrol?: boolean;
    tutorial_set?: boolean;
}

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
] as const;

// C options.c:optfn_paranoid_confirmation(): the paranoid-bit value
// parsing.
function optfnParanoidConfirmation(
    current: number, rawValue: string, addError: (message: string) => void,
): number {
    // optfn_paranoid_confirmation() condenses the value, treats a leading
    // + or - as augmenting, matches arguments case-insensitively through
    // match_optname(), and reports the first unmatched token verbatim
    // while keeping the changes before it.
    let fields = rawValue.trim().replace(/[ \t]+/g, ' ');
    const augmenting = fields.startsWith('+') || fields.startsWith('-');
    const removing = fields.startsWith('-');
    let bits = augmenting ? current : 0;
    if (augmenting) fields = fields.slice(1).replace(/^ /, '');
    fields = fields.replace(/! /g, '!');
    for (const original of fields.split(' ')) {
        // C folds "no" but checks the following 'n' case-sensitively.
        const negated = original.startsWith('!') || /^[nN][oO][^n]/.test(original);
        const token = negated
            ? original.slice(original.startsWith('!') ? 1 : 2) : original;
        const field = token.toLowerCase();
        const entry = PARANOIA_ARGUMENTS.find(([name, minimum]) =>
            field.length >= minimum && name.startsWith(field));
        if (!entry) {
            addError(`Unknown paranoid_confirmation parameter '${token}'`);
            break;
        }
        const bit = entry[2];
        if (!bit) {
            if (!augmenting) bits = 0;
        } else bits = removing || negated ? bits & ~bit : bits | bit;
    }
    return bits;
}

// C optfn_scores(): an explicit value replaces all three display choices.
type ScoreChoices = Required<Pick<GameFlags, 'end_top' | 'end_around' | 'end_own'>> & { error: string | null };

// C options.c:optfn_scores(): the top/around/own value parsing.
function optfnScores(value: string | null, negated: boolean): ScoreChoices | null {
    // string_for_opt() trims the value; an empty one is a missing parameter.
    const text = value?.trim();
    if (!text) return null;
    const choices: ScoreChoices = { end_top: 0, end_around: 0, end_own: false, error: null };
    let rest = negated ? '' : text;
    while (rest) {
        const disabled = rest.startsWith('!') || rest.slice(0, 2).toLowerCase() === 'no';
        if (disabled) rest = rest.startsWith('!') ? rest.slice(1)
            : rest.slice(rest[2] === '-' ? 3 : 2);
        const digits = rest.match(/^\d+/)?.[0];
        const count = digits ? Number(digits) : 1;
        if (digits) rest = rest.slice(digits.length);
        rest = rest.replace(/^ +/, '');
        // Native lowc() selects the field but reports the original text.
        const field = rest[0]?.toLowerCase();
        if (field === 't') choices.end_top = disabled ? 0 : count;
        else if (field === 'a') choices.end_around = disabled ? 0 : count;
        else if (field === 'o') choices.end_own = !disabled && count !== 0;
        else if (field === 'n') {
            choices.end_top = choices.end_around = 0;
            choices.end_own = false;
        } else {
            choices.error = /^-\d/.test(rest)
                ? 'Values for scores:top and scores:around must not be negative'
                : `Unknown scores parameter '${rest}'`;
            break;
        }
        rest = rest.replace(/^[a-zA-Z]+ */, '');
        if (rest.startsWith('/')) rest = rest.slice(1).replace(/^ +/, '');
    }
    return choices;
}

// options.c reset_duplicate_opt_detection(): one counter per option across
// the whole file; the environment parse does not track repeats. The
// paranoia reconciliation defers flags.paranoia_bits to the end of the
// parse; parse_conf_file()'s driver applies it once the source is done.
export interface OptionParseState {
    paranoiaBits: number;
    paranoiaSeen: boolean;
    optionsSeen: Map<number, number>;
    characterOptionsSeen: Map<CharacterFacet, 'positive' | 'negative'>;
}

// Part of C options.c:parseoptions(): split comma-separated OPTIONS into
// elements, rightmost first.
function configurationOptions(bytes: Uint8Array): Uint8Array[] {
    const options: Uint8Array[] = [];
    let start = 0;
    for (let index = 0; index <= bytes.length; index++) {
        if (index < bytes.length && bytes[index] !== 44) continue;
        options.push(bytes.subarray(start, index));
        start = index + 1;
    }
    return options.reverse();
}


// Part of C options.c:parseoptions(): strip surrounding whitespace from one
// element.
function trimConfigurationOption(bytes: Uint8Array): Uint8Array {
    // C parseoptions() uses isspace() on individual bytes before parsing.
    const whitespace = (byte: number | undefined) => byte === 32
        || (byte !== undefined && byte >= 9 && byte <= 13);
    let start = 0;
    let end = bytes.length;
    while (start < end && whitespace(bytes[start])) start++;
    while (end > start && whitespace(bytes[end - 1])) end--;
    return bytes.subarray(start, end);
}

// C options.c:parseoptions(): parse one OPTIONS= value list (or the whole
// NETHACKOPTIONS string, from rcfile()'s environment call) element by
// element, running the option table's generic checks — duplicate
// detection, negation rules, boolean value forms — before each handler.
// parse_config_line() always parses OPTIONS in initial/config-file mode,
// including Lua fragments. Only full startup performs the final
// reconciliation.
export function parseOptions(
    optionList: Uint8Array, result: ConfigurationSettings, state: OptionParseState,
    fromFile: boolean, addError: (message: string) => void, addRawError: (message: string, pause?: boolean) => void,
): void {
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
        // before any handler runs: option names in table order at their
        // minimum length (str_start_is() for the prefix entries, where a
        // hit wins immediately, and match_optname() at the entry's minimum
        // length, which also serves the prefix entries so "cond" reaches
        // pfxfn_cond_ like "cond_x"), then aliases at full length. An
        // element matching nothing is an unknown option, apart from the
        // S_name:c symbol forms that parsesymbols() accepts (the symbol
        // tables are not ported, so they are accepted without validation).
        const nameLength = lengthWithoutValue(stripped);
        let optionMatch: OptionMatch | null = null;
        for (const entry of OPTION_ENTRIES) {
            if (entry.pfx) {
                if (entry.name.length <= stripped.length
                    && asciiNameEqual(entry.name, stripped, entry.name.length)) {
                    optionMatch = { ...entry, viaAlias: false };
                    break;
                }
            }
            if (nameLength >= entry.minmatch
                && asciiNameEqual(entry.name, stripped, nameLength)) {
                optionMatch = { ...entry, viaAlias: false };
                break;
            }
        }
        if (!optionMatch) {
            for (const entry of OPTION_ENTRIES) {
                const { alias } = entry;
                if (alias !== null && nameLength === alias.length
                    && asciiNameEqual(alias, stripped, nameLength)) {
                    optionMatch = { ...entry, viaAlias: true };
                    break;
                }
            }
        }
        if (!optionMatch) {
            if (!stripped.startsWith('S_')) addError(`Unknown option '${stripped}'`);
            continue;
        }
        // parseoptions()'s right-to-left recursion retains using_alias
        // across the elements of one OPTIONS statement.
        usingAlias ||= optionMatch.viaAlias;
        const canonical = optionMatch.name;
        // duplicate_opt_detection() runs first and bumps its counter
        // even when the option is then refused, so a repeated option
        // draws complain_about_duplicate() before bad_negation().
        const duplicateOption = fromFile && (state.optionsSeen.get(optionMatch.index) ?? 0) > 0;
        if (fromFile) {
            state.optionsSeen.set(optionMatch.index, (state.optionsSeen.get(optionMatch.index) ?? 0) + 1);
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
        if (optionMatch.silent) continue;
        if (canonical === 'cond_') {
            // pfxfn_cond_() → parse_cond_option(): 2 when the element
            // is too short to hold more than the prefix, 1 when the
            // condition name matches nothing.
            const mask = setConditionOption(stripped, !negated, result.flags.statusConditionMask);
            if (mask !== null) result.flags.statusConditionMask = mask;
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

        // optfn_petattr(): the attribute also controls hilite_pet.
        // Even a missing parameter reapplies that boolean, but an
        // unknown attribute leaves both settings unchanged.
        if (canonical === 'petattr') {
            if (!optionValue) addError(`Missing parameter for '${stripped}'`);
            else {
                const attr = matchAttributeName(optionValue, null);
                if (attr === -1) {
                    addError(`Unknown petattr parameter '${stripped}'`);
                    continue;
                }
                result.iflags.wc2_petattr = attr;
            }
            result.flags.hilite_pet = (result.iflags.wc2_petattr ?? C_ATR_INVERSE) !== C_ATR_NONE;
            continue;
        }

        // optfn_boolean(): a boolean's value must spell on or off —
        // a prefix of true/false/yes/no, exactly "on"/"off", or a
        // leading digit whose atoi() is 1 or 0.  A negated boolean
        // takes no value at all, and the one valok boolean
        // (menucolors) accepts anything else as on.  The value is the
        // raw text after the delimiter, spaces included.
        let booleanSetting: boolean | null = null;
        if (optionMatch.isBool) {
            const rawValue = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
            const text = rawValue.toLowerCase();
            const number = /^\d/.test(text) ? Number.parseInt(text, 10) : null;
            if (!rawValue) {
                booleanSetting = !negated;
            } else if (negated) {
                addError(`Negated boolean '${canonical}' should not have a parameter`);
                continue;
            } else if ('true'.startsWith(text) || 'yes'.startsWith(text) || text === 'on'
                || number === 1) {
                booleanSetting = true;
            } else if ('false'.startsWith(text) || 'no'.startsWith(text) || text === 'off'
                || number === 0) {
                booleanSetting = false;
            } else if (!optionMatch.valok) {
                addError(`'${stripped}' is not valid for a boolean`);
                continue;
            } else {
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
                previous: state.characterOptionsSeen, fromFile, usingAlias,
            }, addError);
            continue;
        }
        // options.c:shared_menu_optfn() binds a key to one of the
        // menu paging commands: negation is refused outright, the key
        // is mandatory, and illegal_menu_cmd_key() rejects control and
        // printable reserved keys and default object-class symbols.
        if (MENU_KEY_OPTIONS[canonical] === true) {
            if (bindingOption !== canonical) continue;
            const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
            if (!raw) addError(`Missing parameter for '${stripped}'`);
            else {
                const key = bindingKeyCode(raw);
                const illegal = menuCommandKeyError(key);
                if (illegal) addError(illegal);
                else if (!result.commandBindings.bindMenuKey(key, canonical))
                    addRawError('out of menu map space.', false);
            }
            continue;
        }
        if (canonical === 'warnings') {
            // optfn_warnings() → warning_opts(): a value is mandatory
            // at startup (string_for_env_opt(FALSE)).
            if (!optionValue) addError(`Missing parameter for '${stripped}'`);
            else setWarningSymbols(optionValue, result.iflags);
            continue;
        }
        if (canonical === 'pickup_types') {
            if (!negated) {
                result.flags.pickup_types = optfnPickupTypes(optionValue ?? '').symbols;
                if (!optionValue) result.flags.pickup = true;
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
            const { limit, missing } = optfnPileLimit(raw, negated);
            if (missing) addError(`Missing parameter for '${stripped}'`);
            result.flags.pile_limit = limit;
            continue;
        }
        if (canonical === 'hilite_status') {
            if (!optionValue) addError('Value is mandatory for hilite_status');
            else if (negated) clearStatusHilites(result.iflags);
            else {
                const operations: StatusHiliteOperation[] = [];
                parseStatusHl1(optionValue, addError, true, operations);
                replayStatusHiliteOperations(operations, result.iflags);
            }
            continue;
        }
        if (canonical === 'statushilites') {
            optfnStatusHilites(optionValue ?? '', negated, result.iflags, true);
            continue;
        }
        if (canonical === 'runmode') {
            // optfn_runmode(): negation picks teleport; the value must
            // prefix one of the four modes; a value is mandatory.
            if (negated) result.flags.runmode = 'teleport';
            else {
                const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
                if (!raw) addError(`Value is mandatory for ${canonical}`);
                else {
                    const mode = (['teleport', 'run', 'walk', 'crawl'] as const)
                        .find(name => ciPrefixOf(name, raw));
                    if (mode) result.flags.runmode = mode;
                    else addError(`Unknown ${canonical} parameter '${raw}'`);
                }
            }
            continue;
        }
        if (canonical === 'msg_window') {
            const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
            const window = optfnMsgWindow(raw, negated, addError);
            if (window) result.iflags.prevmsg_window = window;
            continue;
        }
        if (canonical === 'msghistory') {
            // optfn_msghistory(): atoi() of the value, negation clears
            // the count; tty_create_nhwindow(NHW_MESSAGE) clamps the
            // recall ring to 20..MAX_MSG_HISTORY when it is used.
            const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
            if (negated && raw) {
                addError(`The ${canonical} option may not both have a value and be negated.`);
            } else if (negated) {
                result.iflags.msg_history = 0;
            } else if (raw) {
                result.iflags.msg_history = cInteger(raw);
            } else {
                addError(`Missing parameter for '${stripped}'`);
            }
            continue;
        }
        if (bindingOption === 'prayconfirm') {
            // optfn_paranoid_confirmation()'s deprecated alias: any
            // value is an error, otherwise it becomes ±pray.
            const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
            if (raw) {
                addError(`deprecated ${negated ? '!' : ''}prayconfirm option takes no parameters (found '${raw}')`);
            } else {
                state.paranoiaBits = negated ? state.paranoiaBits & ~PARANOID_PRAY : state.paranoiaBits | PARANOID_PRAY;
                state.paranoiaSeen = true;
                result.flags.paranoia_bits = state.paranoiaBits;
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
            } else if (!value || (value & ~7) !== 0) {
                addError(`'${canonical}' must be one of 1, 2, 4, or the sum of two or all three of those`);
            } else result.flags.versinfo = value;
            continue;
        }
        // optfn_pettype() and petname_optfn(); the alias "pet" and
        // abbreviations reach the same handler through the match above.
        if (canonical === 'pettype') {
            const value = colonIdx < 0 ? null : stripped.slice(colonIdx + 1);
            const preference = configuredPetType(value, negated);
            if (preference !== null) {
                result.preferred_pet = preference;
                if (value) result.flags.pettype = value;
            } else if (value) addError(`Unrecognized pet type '${value}'.`);
            else if (!negated) addError(`Missing parameter for '${stripped}'`);
            continue;
        }
        const petNameOption = (['dogname', 'catname', 'horsename'] as const)
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
                result.flags[petNameOption] = configuredPetName(
                    trimmedBytes.subarray(delimiter + 1), !!result.iflags.wc_eight_bit_input,
                );
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
                if (!compat) addError(`Missing parameter for '${stripped}'`);
                optfnNumberPad(1, result);
            } else {
                const mode = cInteger(raw);
                if (mode < -1 || mode > 4 || (mode === 0 && raw.charAt(0) !== '0')) {
                    addError(`Illegal ${canonical} parameter '${raw}'`);
                } else optfnNumberPad(mode, result);
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
            if (style !== undefined) result.flags.menu_style = style;
            else addError(`Unknown ${canonical} parameter '${raw}'`);
            continue;
        }
        if (canonical === 'packorder') {
            // optfn_packorder(): an empty value is a silent error.
            // change_inv_order() logs each bad entry through
            // config_error_add() while keeping the valid ones.
            if (optionValue) {
                const change = changeInventoryOrder(optionValue, result);
                for (const error of change.errors) addError(error);
                result.flags.inv_order = change.order;
            }
            continue;
        }
        if (canonical === 'sortvanquished') {
            optfnSortvanquished(stripped, optionValue ?? '', negated, result, addError);
            continue;
        }
        if (canonical === 'sortloot') {
            // optfn_sortloot(): a value is mandatory
            // (string_for_env_opt(FALSE)).
            const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
            if (!raw) addError(`Missing parameter for '${stripped}'`);
            else {
                const mode = raw.charAt(0).toLowerCase();
                if (isLootSortMode(mode)) result.flags.sortloot = mode;
                else addError(`Unknown ${canonical} parameter '${raw}'`);
            }
            continue;
        }
        if (canonical === 'sortdiscoveries') {
            const initial = optionValue?.charAt(0).toLowerCase();
            if (negated) result.flags.discosort = 'o';
            else if (initial === 'o' || initial === '0') result.flags.discosort = 'o';
            else if (initial === 's' || initial === '1') result.flags.discosort = 's';
            else if (initial === 'c' || initial === '2') result.flags.discosort = 'c';
            else if (initial === 'a' || initial === '3') result.flags.discosort = 'a';
            else if (optionValue) addError(`Unknown sortdiscoveries parameter '${optionValue}'`);
            else addError(`Missing parameter for '${stripped}'`);
            continue;
        }
        if (canonical === 'altmeta' || canonical === 'toptenwin' || canonical === 'menu_tab_sep') {
            if (booleanSetting !== null) result.iflags[canonical] = booleanSetting;
            continue;
        }
        if (canonical === 'scores') {
            // optfn_scores(): a value is mandatory; an explicit value
            // replaces all three display choices.
            const choices = optfnScores(optionValue, negated);
            if (!choices) addError(`Missing parameter for '${stripped}'`);
            else {
                result.flags.end_top = choices.end_top;
                result.flags.end_around = choices.end_around;
                result.flags.end_own = choices.end_own;
                if (choices.error) addError(choices.error);
            }
            continue;
        }
        if (canonical === 'fruit') {
            // optfn_fruit(): the value is mandatory at startup and is
            // condensed before the name is sanitized.
            const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
            if (!raw) addError(`Missing parameter for '${stripped}'`);
            else result.fruit = normalizePreferredFruitName(raw, result);
            continue;
        }
        if (canonical === 'rest_on_space') {
            if (booleanSetting !== null) {
                result.flags.rest_on_space = booleanSetting;
                result.commandBindings.setRestOnSpace(booleanSetting, { initial: true });
            }
            continue;
        }

        if (canonical === 'autounlock') {
            const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
            const unlock = optfnAutounlock(raw, negated, addError);
            if (unlock !== null) result.flags.autounlock = unlock;
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
                for (const category of DISCLOSURE_CATEGORIES) slots[category] = value;
            } else {
                let prefix: string | null = null;
                for (const character of raw) {
                    const letter = character.toLowerCase();
                    const resolved = letter === 'k' ? 'v' : letter === 'd' ? 'o' : letter;
                    const category = DISCLOSURE_CATEGORIES.find(entry => entry === resolved);
                    if (category) {
                        let value = prefix ?? '+';
                        if (prefix && category !== 'v' && category !== 'g') {
                            if (prefix === '?') value = 'y';
                            else if (prefix === '#') value = '+';
                        }
                        slots[category] = value;
                        prefix = null;
                    } else if ('yn?+-#'.includes(letter)) {
                        prefix = letter;
                    } else if (letter !== ' ') {
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
            if (val) result.name = val;
            else addError(`Missing parameter for '${stripped}'`);
            continue;
        }

        if (canonical === 'pickup_burden') {
            const raw = colonIdx < 0 ? '' : stripped.slice(colonIdx + 1);
            const burden = optfnPickupBurden(stripped, raw, addError);
            if (burden !== null) result.flags.pickup_burden = burden;
            continue;
        }

        if (colonIdx >= 0) {
            const val = stripped.slice(colonIdx + 1).trim();

            // optfn_playmode(): duplicates refuse outright; the value
            // prefixes normal/play, explore/discovery, debug/wizard.
            if (canonical === 'playmode') {
                const raw = stripped.slice(colonIdx + 1);
                const matches = (word: string, length: number): boolean =>
                    raw.length >= length
                    && raw.slice(0, length).toLowerCase() === word.slice(0, length);
                if (duplicateOption || !raw) {
                    // optn_err without a diagnostic.
                } else if (matches('normal', 6) || raw.toLowerCase() === 'play') {
                    result.flags.debug = false;
                    result.flags.explore = false;
                } else if (matches('explore', 6) || matches('discovery', 6)) {
                    result.flags.explore = true;
                    result.flags.debug = false;
                } else if (matches('debug', 5) || matches('wizard', 6)) {
                    result.flags.debug = true;
                    result.flags.explore = false;
                } else addError(`Invalid value for "playmode":${raw}`);
            }
            else if (canonical === 'symset') {
                optfnSymset(val, result, addError);
            }
            else if (canonical === 'roguesymset') {
                optfnRoguesymset(val, result, addError);
            }
            else if (canonical === 'boulder') {
                // optfn_boulder() decodes the raw text after the
                // delimiter (spaces included) and writes the first byte
                // into both symbol sets; the BOULDER= statement above
                // only touches the primary set.  The initial config
                // records the override without a redraw (go.opt_initial).
                const raw = stripped.slice(colonIdx + 1);
                if (!raw) addError(`Missing parameter for '${stripped}'`);
                else {
                    const parsed = optfnBoulder(raw, { initial: true });
                    if ('error' in parsed) addError(parsed.error);
                    else {
                        result.boulderSym = parsed.symbol;
                        result.rogueBoulderSym = parsed.symbol;
                    }
                }
            }
            else if (canonical === 'menu_headings') {
                const style = optfnMenuHeadings(val, negated, addError);
                if (style) result.iflags.menu_headings = style;
            }
            else if (canonical === 'suppress_alert') {
                const parsed = negated ? null : featureAlertVersion(val);
                if (parsed && !parsed.future) result.flags.suppress_alert = parsed.version;
            }
            else if (canonical === 'paranoid_confirmation') {
                if (negated) {
                    if (!val) {
                        state.paranoiaBits = 0;
                        state.paranoiaSeen = true;
                        result.flags.paranoia_bits = 0;
                    } else addError(`!${canonical} does not accept a value`);
                    continue;
                }
                if (!val) {
                    addError(`${canonical} requires a value; use 'none' to cancel all`);
                    continue;
                }
                state.paranoiaBits = optfnParanoidConfirmation(state.paranoiaBits, val, addError);
                state.paranoiaSeen = true;
                result.flags.paranoia_bits = state.paranoiaBits;
            }
            else {
                const option = requestBooleanByName.get(canonical.toLowerCase());
                const value = booleanSetting;
                if (option && value !== null) setConfigurationBoolean(result, option, value);
            }
        } else {
            const value = booleanSetting ?? !negated;

            if (canonical === 'autopickup') result.flags.pickup = value;
            else if (canonical === 'color') result.flags.color = value;
            else if (canonical === 'legacy') result.flags.legacy = value;
            else if (canonical === 'pauper') {
                result.flags.pauper = value;
                // options.c applies this implication immediately, so a
                // later explicit !nudist may still override it.
                if (value) result.flags.nudist = true;
            }
            else if (canonical === 'nudist') result.flags.nudist = value;
            else if (canonical === 'blind') result.flags.blind = value;
            else if (canonical === 'deaf') result.flags.deaf = value;
            else if (canonical === 'tutorial') { result.flags.tutorial = value; result.tutorial_set = true; }
            else if (canonical === 'splash_screen') result.iflags.wc_splash_screen = value;
            else if (canonical === 'montelecontrol') result.monTelecontrol = value;
            else if (canonical === 'monpolycontrol') result.monPolycontrol = value;
            else if (canonical === 'pushweapon') result.flags.pushweapon = value;
            else if (canonical === 'showexp') result.flags.showexp = value;
            else if (canonical === 'time') result.flags.time = value;
            else if (canonical === 'verbose') result.flags.verbose = value;
            else if (canonical === 'paranoid_confirmation') {
                // Without a delimiter: negation clears every bit; the
                // bare option demands a value.
                if (negated) {
                    state.paranoiaBits = 0;
                    state.paranoiaSeen = true;
                    result.flags.paranoia_bits = state.paranoiaBits;
                } else addError(`${canonical} requires a value; use 'none' to cancel all`);
            }
            else {
                const option = requestBooleanByName.get(canonical.toLowerCase());
                if (option) setConfigurationBoolean(result, option, value);
                else if (canonical === 'bones') result.flags.bones = value;
                // optfn_boulder()'s string_for_opt(FALSE) demands a
                // value and echoes the typed element verbatim.
                else if (canonical === 'boulder') addError(`Missing parameter for '${stripped}'`);
                else if (canonical === 'reroll') result.flags.reroll = value;
                // optfn_menu_headings() without a value: inverse, or
                // none when negated.
                else if (canonical === 'menu_headings') {
                    const style = optfnMenuHeadings('', negated, addError);
                    if (style) result.iflags.menu_headings = style;
                }
            }
        }
    }
}

// C options.c:optfn_pile_limit(): the do_set branch shared by the config
// parse and the doset text editor — atoi() of string_for_opt()'s value,
// negation meaning zero, the 3-turn... pile default when no value is
// given, and negative limits falling back to that default.
function optfnPileLimit(op: string, negated: boolean): { limit: number; missing: boolean } {
    const limit = negated ? 0 : op ? cInteger(op) : 5 /* PILE_LIMIT_DFLT */;
    return { limit: limit < 0 ? 5 : limit, missing: !op && !negated };
}

// C options.c:optfn_statushilites(): negation clears the duration; a
// missing value means the 3-turn default, atol() of junk is 0, and
// negative values clamp to 1.  The duration is assigned before the
// !go.opt_from_file reset_status_hilites(), whose update_all reads the
// new value.
function optfnStatusHilites(
    op: string, negated: boolean, iflags: InterfaceFlags, fromFile: boolean,
): void {
    const delta = negated ? 0 : op ? cInteger(op) : 3;
    iflags.hiliteDelta = delta < 0 ? 1 : delta;
    if (!fromFile) resetStatusHilites();
}

// C options.c:optfn_msg_window(): a value's first letter names the window
// mode (single, combination, full, reversed); the bare option is full and
// negation single, and negation with a value is bad_negation().
function optfnMsgWindow(
    op: string, negated: boolean, addError: (message: string) => void,
): 's' | 'c' | 'f' | 'r' | null {
    if (!op) return negated ? 's' : 'f';
    if (negated) {
        addError(`The msg_window option may not both have a value and be negated.`);
        return null;
    }
    const initial = op.charAt(0).toLowerCase();
    if (initial === 's' || initial === 'c' || initial === 'f' || initial === 'r') return initial;
    addError(`Unknown msg_window parameter '${op}'`);
    return null;
}

// C options.c:optfn_sortvanquished(): negation and a missing value mean
// 't'; a value is one of vanqmodes "tdaACcnz" (or a digit 0..7 for it),
// with the mode letter matched case-sensitively like strchr().
function optfnSortvanquished(
    opts: string, op: string, negated: boolean, result: ConfigurationSettings,
    addError: (message: string) => void,
): void {
    if (!op) addError(`Missing parameter for '${opts}'`);
    if (negated) {
        result.flags.vanqSortmode = 0; /* 0 => 't' */
        return;
    }
    const initial = op.charAt(0);
    const mode = 'tdaACcnz'.indexOf(initial);
    if (initial && mode >= 0) result.flags.vanqSortmode = mode;
    else if (/^[0-7]$/.test(initial)) result.flags.vanqSortmode = Number(initial);
    else if (op) addError(`Unknown sortvanquished parameter '${op}'`);
}

// C options.c:optfn_autounlock(): bare means apply-key and negation none;
// a value is a '+'- or space-separated list whose members prefix or
// fuzzymatch an unlock type — matched case-insensitively but dispatched
// on the exact lowercase first letter — while 'none' cannot mix with
// them.  Like C, each pass trims the remainder before splitting off one
// separator, so separator runs collapse.
function optfnAutounlock(
    op: string, negated: boolean, addError: (message: string) => void,
): number | null {
    if (!op) return negated ? 0 : AUTOUNLOCK_APPLY_KEY;
    const sep = op.includes('+') ? '+' : ' ';
    let bits = 0;
    let none = negated;
    let rest = op.trim();
    for (;;) {
        const cut = rest.indexOf(sep);
        const element = (cut < 0 ? rest : rest.slice(0, cut)).trim();
        if (ciPrefixOf('none', element)) {
            none = true;
        } else {
            const type = AUTOUNLOCK_TYPES.find(([name]) =>
                ciPrefixOf(name, element) || fuzzyMatch(element, name));
            if (!type || type[0].charAt(0) !== element.charAt(0)) {
                addError(`Invalid value for "autounlock": "${element}"`);
                return null;
            }
            bits |= type[1];
        }
        if (cut < 0) break;
        rest = rest.slice(cut + 1).trim();
    }
    if (none && bits !== 0) {
        addError("Invalid value combination for \"autounlock\": 'none' with some");
        return null;
    }
    return none ? 0 : bits;
}

// C options.c:optfn_pickup_burden(): the value is mandatory
// (string_for_env_opt(FALSE)); its first letter picks the burden, with
// 'o' and 't' both selecting overtaxed.
function optfnPickupBurden(
    opts: string, op: string, addError: (message: string) => void,
): number | null {
    if (!op) {
        addError(`Missing parameter for '${opts}'`);
        return null;
    }
    const initial = op.charAt(0).toLowerCase();
    const burden = 'ubsntl'.indexOf(initial === 'o' ? 't' : initial);
    if (burden < 0) {
        addError(`Unknown pickup_burden parameter '${op}'`);
        return null;
    }
    return burden;
}

// C options.c:optfn_menu_headings(): menu_headings without a value means
// no-color&inverse, negation no-color&none; a value parses through
// color_attr_parse_str() and negation with a value is bad_negation().
function optfnMenuHeadings(
    op: string, negated: boolean, addError: (message: string) => void,
): { attr: number; color: number } | null {
    if (!op) return { attr: negated ? C_ATR_NONE : C_ATR_INVERSE, color: NO_COLOR };
    if (negated) {
        addError('The menu_headings option may not both have a value and be negated.');
        return null;
    }
    return parseColorAttr(op, addError);
}

// Part of C options.c:optfn_disclose(): the per-category values back into
// the option string.
// Serialize the six disclosure slots into the "prefix category" grammar
// parseDisclosureSettings() reads, so option-time state survives like C's
// end_disclose[] array; a slot never set stays unmentioned, and a fully
// unset state returns to "no disclose option seen".
function serializeDisclosureSlots(slots: Record<string, string>): string | undefined {
    const parts: string[] = [];
    for (const category of DISCLOSURE_CATEGORIES) {
        const value = slots[category] ?? '';
        if (value) parts.push(`${value} ${category}`);
    }
    return parts.length ? parts.join(' ') : undefined;
}

// C options.c:optfn_disclose(): parse the "disclose" option string into
// per-category settings (the TS game stores it as flags.disclose).
export function parseDisclosureSettings(raw: unknown): Record<string, string> {
    const settings: Record<string, string> = {
        i: '', a: '', v: '', g: '', c: '', o: '',
    };
    // An unset option leaves the zero-initialized defaults: ask, answer no.
    if (raw === undefined || raw === null) return settings;
    const text = String(raw).trim();
    if (text === '' || text.toLowerCase() === 'all') {
        for (const category of DISCLOSURE_CATEGORIES) settings[category] = 'y';
        return settings;
    }
    if (text.toLowerCase() === 'none') {
        for (const category of DISCLOSURE_CATEGORIES) settings[category] = '-';
        return settings;
    }
    let prefix: string | null = null;
    for (const character of text) {
        const code = character.toLowerCase();
        if (code === ' ') continue;
        const resolved = code === 'k' ? 'v' : code === 'd' ? 'o' : code;
        const category = DISCLOSURE_CATEGORIES.find(entry => entry === resolved);
        if (category) {
            let value = prefix ?? '+';
            if (prefix && category !== 'v' && category !== 'g') {
                if (prefix === '?') value = 'y';
                else if (prefix === '#') value = '+';
            }
            settings[category] = value;
            prefix = null;
        } else if (['y', 'n', '?', '+', '-', '#'].includes(code)) {
            prefix = code;
        }
    }
    return settings;
}

// Part of C options.c:optfn_fruit(): the goodfruit normalization — mungspaces,
// the PL_FSIZ copy (nmcpy) and per-byte sanitize_name (sanitizeFruitCopy
// below), and the "slime mold" fallback — shared with the config-parse and
// initoptions paths; changePreferredFruit() below is the optfn_fruit() port.
export function normalizePreferredFruitName(name: string, state: FruitNameSettings = game): string {
    const firstLine = String(name).split('\n', 1)[0] ?? '';
    const spaced = firstLine.replace(/\t/g, ' ')
        .replace(/ +/g, ' ').replace(/^ | $/g, '');
    // nmcpy(svp.pl_fruit, op, PL_FSIZ) caps the copy at PL_FSIZ-1 bytes
    // before sanitize_name() runs.
    return sanitizeFruitCopy(spaced.split(',', 1)[0] ?? '', state.iflags) || 'slime mold';
}

// C options.c:optfn_fruit(): the do_set path outside opt_initial. Runtime
// option changes can rename an unused current entry. Once an object or mimic
// represents it, its existing identity remains part of the history.
export function changePreferredFruit(name: string, state: GameState = game) {
    const value = (String(name).split('\n', 1)[0] ?? '').replace(/\t/g, ' ')
        .replace(/ +/g, ' ').replace(/^ | $/g, '');
    const existing = fruitFromName(value, { state });
    const replacement = !existing && !state.flags.made_fruit
        ? fruitFromName(preferredFruitName(state), { state }) : null;
    if (!existing && !replacement && highestFruitId(state) >= 100)
        return { changed: false, message: "Doing that so many times isn't very fruitful." };
    state.fruitName = normalizePreferredFruitName(value, state);
    addFruit(state.fruitName, { preferred: true, replacement, state });
    return { changed: true, message: `Fruit is now "${state.fruitName}".` };
}

interface FruitNameSettings {
    iflags?: Pick<InterfaceFlags, 'wc_eight_bit_input'>;
}

// Part of C options.c:optfn_fruit(), fruitadd(): the per-byte sanitize_name
// of a fruit copy.
// C copynchars(altname, str, PL_FSIZ - 1) followed by sanitize_name():
// optfn_fruit() (above) and fruitadd() (below) both cap the bytes and then
// run bones.c:sanitize_name() over each byte of the native buffer — control
// bytes become '.', and a high byte is masked to '_' unless the tty accepts
// eight-bit input, which keeps the byte itself. The port's bones names are
// decoded strings (sanitizeName in bones_name.ts masks those per character);
// the fruit option still sees the raw UTF-8 bytes here.
function sanitizeFruitCopy(name: string, iflags?: Pick<InterfaceFlags, 'wc_eight_bit_input'>): string {
    const bytes = new TextEncoder().encode(name).subarray(0, FRUIT_NAME_BYTES);
    return [...bytes].map(byte => {
        const low = byte & 127;
        if (low < 32 || low === 127) return '.';
        return byte > 127 && !iflags?.wc_eight_bit_input ? '_' : String.fromCharCode(byte);
    }).join('');
}

// C options.c:optfn_hilite_status(): apply a typed compound-option value.
// Also C options.c:optfn_pile_limit(), optfn_packorder(),
// optfn_menuinvertmode(), optfn_statuslines(), optfn_statushilites(),
// optfn_suppress_alert(): their typed-value branches.
// Also C options.c:parseoptions(): the 128-character option length check.
export async function setTextOption(name: string, value: string): Promise<void> {
    if (name.length + 1 + value.length > 128) {
        await optionError('Option too long, max length is 128 characters');
        return;
    }
    value = value.trimEnd();
    switch (name) {
    case 'pile_limit': {
        const { limit, missing } = optfnPileLimit(value, false);
        if (missing) await optionError("Missing parameter for 'pile_limit:'");
        game.flags.pile_limit = limit;
        break;
    }
    case 'packorder': {
        if (!value) break;
        const change = changeInventoryOrder(value);
        for (const error of change.errors) await optionError(error);
        game.flags.inv_order = change.order;
        break;
    }
    case 'menuinvertmode': {
        if (!value) break;
        const mode = cInteger(value);
        if (mode === 0 || mode === 1 || mode === 2) game.iflags.menuinvertmode = mode;
        else await optionError(`Illegal menuinvertmode parameter '${value}'`);
        break;
    }
    case 'statuslines':
        if (!value) await optionError("Missing parameter for 'statuslines:'");
        if (cInteger(value) !== 2 && cInteger(value) !== 3)
            await optionError(`'statuslines:${value}' is invalid; must be 2 or 3`);
        break;
    case 'statushilites': {
        optfnStatusHilites(value, false, game.iflags, false);
        break;
    }
    case 'hilite_status': {
        if (!value) {
            await optionError('Value is mandatory for hilite_status');
            break;
        }
        const errors: string[] = [];
        const operations: StatusHiliteOperation[] = [];
        parseStatusHl1(value, message => errors.push(message), false, operations);
        replayStatusHiliteOperations(operations, game.iflags);
        for (const error of errors) await optionError(error);
        break;
    }
    case 'suppress_alert': {
        const parsed = featureAlertVersion(value);
        if (!parsed) break;
        if (parsed.future) {
            await plineWithContinuation("You can't disable new feature alerts for future versions.");
            break;
        }
        game.flags.suppress_alert = parsed.version;
        await plineWithContinuation(`Feature change alerts disabled for NetHack ${parsed.version} features and prior.`);
        break;
    }
    }
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
    ['monpolycontrol', '_monPolycontrol', false],
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
] as const;

// optlist.h: these booleans are selectable only in the full wizard menu.
// The debug_* entries also reject config-file settings and fuzzer input.
const WIZARD_MENU_BOOLEAN_OPTIONS = [
    ['debug_hunger', 'debug_hunger', false],
    ['debug_mongen', 'debug_mongen', false],
    ['debug_overwrite_stairs', 'debug_overwrite_stairs', false],
    ['sanity_check', 'sanity_check', false],
    ['travel_debug', 'trav_debug', false],
    ['wizmgender', 'wizmgender', false],
    ['wizweight', 'wizweight', false],
] as const;

type BooleanOption = typeof REQUEST_MENU_BOOLEAN_OPTIONS[number]
    | typeof WIZARD_MENU_BOOLEAN_OPTIONS[number];
type BooleanOptionName = BooleanOption[0];

const requestBooleanByName = new Map<string, BooleanOption>(
    [...REQUEST_MENU_BOOLEAN_OPTIONS, ...WIZARD_MENU_BOOLEAN_OPTIONS]
        .map(option => [option[0].toLowerCase(), option]),
);

// Port only: read one boolean option's current value across flags and
// iflags.
function requestBooleanValue(name: BooleanOptionName): boolean {
    const option = requestBooleanByName.get(name.toLowerCase());
    if (!option) return false;
    const [, property, fallback] = option;
    if (property === '_monTelecontrol') return game._monTelecontrol ?? fallback;
    if (property === '_monPolycontrol') return game._monPolycontrol ?? fallback;
    if (property === 'bgcolors' || property === 'sounds' || property === 'altmeta' || property === 'toptenwin' || property === 'menu_tab_sep'
        || property === 'wc_eight_bit_input' || property === 'autodescribe'
        || property === 'debug_hunger' || property === 'debug_mongen' || property === 'debug_overwrite_stairs'
        || property === 'sanity_check' || property === 'trav_debug' || property === 'wizmgender' || property === 'wizweight'
        || property === 'getloc_usemenu' || property === 'getloc_moveskip')
        return game.iflags[property] ?? fallback;
    return game.flags[property] ?? fallback;
}

// Port only: apply one boolean option to the parsed configuration.
function setConfigurationBoolean(settings: ConfigurationSettings, option: BooleanOption, value: boolean): void {
    const [, property] = option;
    if (property === '_monTelecontrol') settings.monTelecontrol = value;
    else if (property === '_monPolycontrol') settings.monPolycontrol = value;
    else if (property === 'bgcolors' || property === 'sounds' || property === 'altmeta' || property === 'toptenwin' || property === 'menu_tab_sep'
        || property === 'wc_eight_bit_input' || property === 'autodescribe'
        || property === 'debug_hunger' || property === 'debug_mongen' || property === 'debug_overwrite_stairs'
        || property === 'sanity_check' || property === 'trav_debug' || property === 'wizmgender' || property === 'wizweight'
        || property === 'getloc_usemenu' || property === 'getloc_moveskip')
        settings.iflags[property] = value;
    else settings.flags[property] = value;
    if (property === 'hilite_pet' && value && settings.iflags.wc2_petattr === C_ATR_NONE)
        settings.iflags.wc2_petattr = C_ATR_INVERSE;
}

// Port only: apply one boolean option to the live game.
function setRequestBoolean(option: BooleanOption, value: boolean): void {
    const [, property] = option;
    if (property === '_monTelecontrol') game._monTelecontrol = value;
    else if (property === '_monPolycontrol') game._monPolycontrol = value;
    else if (property === 'bgcolors' || property === 'sounds' || property === 'altmeta' || property === 'toptenwin' || property === 'menu_tab_sep'
        || property === 'wc_eight_bit_input' || property === 'autodescribe'
        || property === 'debug_hunger' || property === 'debug_mongen' || property === 'debug_overwrite_stairs'
        || property === 'sanity_check' || property === 'trav_debug' || property === 'wizmgender' || property === 'wizweight'
        || property === 'getloc_usemenu' || property === 'getloc_moveskip')
        game.iflags[property] = value;
    else game.flags[property] = value;
    if (property === 'hilite_pet' && value && game.iflags.wc2_petattr === C_ATR_NONE)
        game.iflags.wc2_petattr = C_ATR_INVERSE;
}

// Port only: the identity rows of the full options menu.
function requestMenuIdentity() {
    const role = game.urole?.name?.m || game.urole?.key || 'Rogue';
    const race = game.urace?.name || 'human';
    const gender = game.flags?.female ? 'female' : 'male';
    const alignment = game.initAlignment?.name || 'neutral';
    return { role, race, gender, alignment };
}

// Part of C options.c:optfn_scores(): the current top/around/own string.
function scoreDisplayDescription(): string {
    const top = game.flags.end_top ?? 3;
    const around = game.flags.end_around ?? 2;
    const parts = [];
    if (top > 0) parts.push(`${top} top`);
    if (around > 0) parts.push(`${around} around`);
    if (game.flags.end_own) parts.push('own');
    return parts.join('/') || 'none';
}

// Part of C options.c:optfn_pettype(): the current pet preference.
function preferredPetDescription(): string {
    const preference = game.preferred_pet ?? '';
    switch (preference) {
    case 'c': return 'cat';
    case 'd': return 'dog';
    case 'h': return 'horse';
    case 'n': return 'none';
    default: return 'random';
    }
}

// dat/symbols: the handling each symset's `start:` line declares with
// `Handling:`.  The port renders only DECgraphics symbols, but
// options.c:optfn_symset() get_val still reports any loadable set's
// declared handler.
const SYMSET_HANDLINGS: Record<string, string> = {
    ibmgraphics: 'IBM', ibmgraphics_1: 'IBM', ibmgraphics_2: 'IBM',
    rogueibm: 'IBM', rogueepyx: 'IBM', roguewindows: 'IBM',
    curses: 'DEC', decgraphics: 'DEC',
    macgraphics: 'MAC',
    enhanced1: 'UTF8', enhanced2: 'UTF8',
};

// C options.c:optfn_symset(): load the primary set from the symbols file
// (novel_tribute.ts readSymFile).  "default" itself clears the choice without
// loading (isDefaultSymsetName below); a name no `start:` line carries
// fails, clears the choice, and reports the error.
function optfnSymset(
    op: string, result: ConfigurationSettings, addError: (message: string) => void,
): boolean {
    if (isDefaultSymsetName(op)) {
        result.symset = undefined;
        result.symsetCleared = true;
    } else if (readSymFile(op)) {
        result.symset = op;
    } else {
        result.symset = undefined;
        result.symsetCleared = true;
        addError(`Unable to load symbol set "${op}" from "symbols"`);
        return false;
    }
    return true;
}

// C options.c:optfn_roguesymset(): load the rogue set the same way;
// restrictions only filter the interactive menu.
function optfnRoguesymset(
    op: string, result: ConfigurationSettings, addError: (message: string) => void,
): boolean {
    if (isDefaultSymsetName(op)) {
        result.rogueSymset = undefined;
        result.rogueSymsetCleared = true;
    } else if (readSymFile(op)) {
        result.rogueSymset = op;
    } else {
        result.rogueSymset = undefined;
        result.rogueSymsetCleared = true;
        addError(`Unable to load symbol set "${op}" from "symbols"`);
        return false;
    }
    return true;
}

// Part of C options.c:optfn_symset(): the loaded set's value string.
// options.c:optfn_symset() get_val: the loaded set's name, ", active" while
// the primary set is current, and the handling the set declared.
export function symsetMenuValue(): string {
    const name = game.symset;
    if (!name) return 'default';
    const active = !Is_rogue_level(game.u?.uz) ? ', active' : '';
    const handling = SYMSET_HANDLINGS[name.toLowerCase()] ?? null;
    return `${name}${active}${handling ? `, handler=${handling}` : ''}`;
}

// Part of C options.c:optfn_roguesymset(): the loaded set's value string.
// options.c:optfn_roguesymset() get_val: the loaded set's name and
// ", active" while the rogue set is current; no handler is reported.
function rogueSymsetMenuValue(): string {
    const name = game.rogueSymset;
    if (!name) return 'default';
    return `${name}${Is_rogue_level(game.u?.uz) ? ', active' : ''}`;
}


// Part of C options.c:optfn_menu_headings(): the current style's value
// string.
// options.c:optfn_menu_headings() get_val: color_attr_to_str() followed by
// strNsubst() turning each blank into '-'.
function menuHeadingsValue(): string {
    const style = game.iflags.menu_headings ?? { attr: C_ATR_INVERSE, color: NO_COLOR };
    return colorAttrToString(style).replace(/ /g, '-');
}

// Part of C options.c:optfn_statushilites(): the current delta's value
// string.
// options.c:optfn_statushilites() get_val.
function statusHilitesValue(): string {
    const delta = game.iflags.hiliteDelta ?? 0;
    return delta ? `${delta} (on: highlight status for ${delta} turns)`
        : "0 (off: don't highlight status fields)";
}

// C options.c:doset_add_menu(): one full-menu row — the option's current
// value (its get_val string; compoundMenuValue in option_editors.ts) or
// "unknown" in doset's "%-24s [%s]" format, selectable with an
// accelerator.  Options that cannot be changed take doset_add_menu's
// indexoffset==0 indent instead (readonly rows below).  The
// other-settings rows keep their spaced label spellings.
function dosetAddMenu(name: string, value: string, label = name): PageLocalMenuItem<string> {
    return {
        value: name,
        text: `${label.padEnd(24)}[${value}]`,
        itemFlags: requestBooleanByName.has(name.toLowerCase()) || name === 'idlecheckpoint'
            ? MENU_ITEMFLAGS_SKIPINVERT : 0,
    };
}

// Part of C options.c:doset(): the full options menu sections.
function requestMenuSections(): PageLocalMultiSelectSection<string>[] {
    const { role, race, gender, alignment } = requestMenuIdentity();
    // doset_add_menu() rows come from dosetAddMenu() above.
    const label = (text: string): MenuLabel => ({ selectable: false, text });
    const readonly = (name: string, value: string | boolean) => label(`    ${name.padEnd(24)}[${value}]`);
    const boolean = (name: BooleanOptionName) => dosetAddMenu(name,
        requestBooleanValue(name) ? 'true' : 'false');
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
            dosetAddMenu('bgcolors', requestBooleanValue('bgcolors') ? 'on' : 'off'),
            boolean('checkpoint'),
            boolean('cmdassist'),
            boolean('color'),
            boolean('confirm'),
            boolean('customcolors'),
            boolean('customsymbols'),
            boolean('dark_room'),
            ...(game.flags.debug && !game.iflags.debug_fuzzer ? [
                boolean('debug_hunger'), boolean('debug_mongen'), boolean('debug_overwrite_stairs'),
            ] : []),
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
            dosetAddMenu('idlecheckpoint', 'off'),
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
            ...(game.flags.debug ? [boolean('monpolycontrol'), boolean('montelecontrol')] : []),
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
            ...(game.flags.debug ? [boolean('sanity_check')] : []),
            boolean('showdamage'),
            boolean('showexp'),
            boolean('showrace'),
            boolean('showvers'),
            boolean('silent'),
            boolean('sortpack'),
            dosetAddMenu('sounds', requestBooleanValue('sounds') ? 'on' : 'off'),
            boolean('sparkle'),
            boolean('spot_monsters'),
            boolean('standout'),
            boolean('terrainstatus'),
            boolean('time'),
            boolean('tips'),
            boolean('tombstone'),
            boolean('toptenwin'),
            boolean('travel'),
            ...(game.flags.debug ? [boolean('travel_debug')] : []),
            boolean('use_inverse'),
            boolean('verbose'),
            boolean('weaponstatus'),
            boolean('whatis_menu'),
            boolean('whatis_moveskip'),
            ...(game.flags.debug ? [boolean('wizmgender'), boolean('wizweight')] : []),
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
            readonly('msghistory', String(game.iflags.msg_history ?? 20)),
            readonly('pettype', preferredPetDescription()),
            readonly('soundlib', 'nosound'),
            dosetAddMenu('autounlock', compoundMenuValue('autounlock') ?? 'unknown'),
            // optfn_boulder() get_val: the primary override, else the
            // active set's rock-class symbol (options.c:1238-1241).
            dosetAddMenu('boulder', game.boulderSym || currentBoulderSymbol()),
            dosetAddMenu('crash_email', 'unknown'),
            dosetAddMenu('crash_name', 'unknown'),
            dosetAddMenu('crash_urlmax', '-1'),
            dosetAddMenu('disclose', compoundMenuValue('disclose') ?? 'unknown'),
            dosetAddMenu('fruit', game.fruitName ?? 'undefined'),
            dosetAddMenu('glyph', '(to be done)'),
            dosetAddMenu('hilite_status', countStatusHilites() ? '(see "status highlight rules" below)' : '(none)'),
            dosetAddMenu('menu_headings', menuHeadingsValue()),
            dosetAddMenu('menu_objsyms', 'conditional'),
            dosetAddMenu('menuinvertmode', textOptionValue('menuinvertmode') ?? '1'),
            dosetAddMenu('menustyle', MENU_STYLES[game.flags.menu_style ?? MENU_FULL][0]),
            dosetAddMenu('msg_window', compoundMenuValue('msg_window') ?? 'unknown'),
            dosetAddMenu('number_pad', numberPadDescription()),
            dosetAddMenu('packorder', inventoryOrderSymbols()),
            dosetAddMenu('paranoid_confirmation', compoundMenuValue('paranoid_confirmation') ?? 'unknown'),
            dosetAddMenu('petattr', attributeName(game.iflags.wc2_petattr ?? C_ATR_INVERSE)),
            dosetAddMenu('pickup_burden', compoundMenuValue('pickup_burden') ?? 'unknown'),
            dosetAddMenu('pickup_types', game.flags?.pickup_types || 'all'),
            dosetAddMenu('pile_limit', textOptionValue('pile_limit') ?? '5'),
            dosetAddMenu('roguesymset', rogueSymsetMenuValue()),
            dosetAddMenu('runmode', compoundMenuValue('runmode') ?? 'unknown'),
            dosetAddMenu('scores', scoreDisplayDescription()),
            dosetAddMenu('sortdiscoveries', discoverySortDescription()),
            dosetAddMenu('sortloot', SORT_LOOT_NAMES[game.flags.sortloot ?? 'l']),
            dosetAddMenu('sortvanquished', vanquishedOptionValue()),
            dosetAddMenu('statushilites', statusHilitesValue()),
            dosetAddMenu('statuslines', '2'),
            dosetAddMenu('suppress_alert', textOptionValue('suppress_alert') ?? '(none)'),
            dosetAddMenu('symset', symsetMenuValue()),
            dosetAddMenu('versinfo', compoundMenuValue('versinfo') ?? 'unknown'),
            dosetAddMenu('whatis_coord', compoundMenuValue('whatis_coord') ?? 'unknown'),
            dosetAddMenu('whatis_filter', compoundMenuValue('whatis_filter') ?? 'unknown'),
            label(''),
        ] },
        { heading: 'Other settings:', items: [
            dosetAddMenu('autocompletions', `(${countCommandAutocompletions()} currently set)`),
            dosetAddMenu('autopickup_exceptions', `(${game.iflags.autopickupExceptions?.length ?? 0} currently set)`,
                'autopickup exceptions'),
            dosetAddMenu('bind_keys', `(${countBindKeys()} currently set)`, 'bind keys'),
            dosetAddMenu('menu_colors', `(${game.iflags.menuColorings?.length ?? 0} currently set)`, 'menu colors'),
            dosetAddMenu('message_types', `(${game.iflags.messageTypes?.length ?? 0} currently set)`, 'message types'),
            dosetAddMenu('status_conditions', compoundMenuValue('status_conditions') ?? 'unknown',
                'status condition fields'),
            dosetAddMenu('status_highlights', `(${countStatusHilites()} currently set)`, 'status highlight rules'),
        ] }
    ];
}

// options.c optfn_boolean()'s after-change flags, served by
// reset_needed_visuals() once the selected options finished: opt_need_redraw
// versus the customsymbols/customcolors resets.
interface PendingVisuals {
    redraw: boolean;
    customReset: boolean;
}

const NO_VISUAL_CHANGE: PendingVisuals = { redraw: false, customReset: false };

// C options.c:optfn_bool(), followed by reset_needed_visuals(). Status-only
// changes need bot(); map-affecting changes defer the full docrt until all
// selected options and their compound handlers have finished.
async function applyBooleanVisualChange(name: BooleanOptionName): Promise<PendingVisuals> {
    if (name === 'wizweight' && game.flags.fixinv === false) reassignInventoryLetters();
    if (name === 'terrainstatus') classifyStatusTerrain(game);
    if (['showexp', 'time', 'showvers', 'weaponstatus', 'armorstatus', 'terrainstatus', 'hitpointbar'].includes(name))
        reassessStatusFields();
    if (name === 'mention_decor') {
        // options.c:5422-5423: toggling forgets the remembered decoration.
        game._prevDecorType = STONE;
        return NO_VISUAL_CHANGE;
    }
    if (name === 'dark_room' || name === 'lit_corridor') {
        await vision_recalc(2);
        game.vision_full_recalc = 1;
        return { redraw: requestBooleanValue('color'), customReset: false };
    }
    // options.c:5411-5415: custom colors and symbols queue only their own
    // reset; reset_needed_visuals() serves those with docrt() alone and runs
    // check_gold_symbol()/reglyph_darkroom() only for opt_need_redraw.
    return {
        redraw: ['color', 'hilite_pet', 'hilite_pile', 'hitpointbar', 'showrace', 'use_inverse', 'wizmgender']
            .includes(name),
        customReset: name === 'customcolors' || name === 'customsymbols',
    };
}

// The window-capability booleans toggle_bool_option() accepts even though
// the doset() menus drop them for the tty port (options.c:9283 has no
// wc_supported() filter). Field names and tty defaults from optlist.h:
// ascii_map defaults On (no TILES_IN_GLYPHMAP), guicolor is opt_out On.
type WcBooleanField = 'wc_ascii_map' | 'wc2_guicolor' | 'perm_invent'
    | 'wc_popup_dialog' | 'wc_tiled_map' | 'wc2_wraptext';
const TOGGLE_WC_BOOLEANS: readonly (readonly [name: string, field: WcBooleanField, initial: boolean])[] = [
    ['ascii_map', 'wc_ascii_map', true],
    ['guicolor', 'wc2_guicolor', true],
    ['perm_invent', 'perm_invent', false],
    ['popup_dialog', 'wc_popup_dialog', false],
    ['tiled_map', 'wc_tiled_map', false],
    ['wraptext', 'wc2_wraptext', false],
];

// options.c:toggle_bool_option()'s allopt walk: every set_in_game boolean
// in allopt order (idlecheckpoint inserted behind ignintr; the six
// window-capability booleans merged in), minus the set_wizonly entries
// menu_tab_sep and montelecontrol.
const TOGGLE_BOOLEAN_NAMES: readonly string[] = (() => {
    const names: string[] = [...REQUEST_MENU_BOOLEAN_OPTIONS.map(entry => entry[0])];
    names.splice(names.indexOf('ignintr') + 1, 0, 'idlecheckpoint');
    names.push(...TOGGLE_WC_BOOLEANS.map(entry => entry[0]));
    names.sort((left, right) => left.toLowerCase() < right.toLowerCase() ? -1
        : left.toLowerCase() > right.toLowerCase() ? 1 : 0);
    return names;
})();


export type MessageType = typeof MSGTYP_NORMAL | typeof MSGTYP_NOREP
    | typeof MSGTYP_NOSHOW | typeof MSGTYP_STOP;

export interface MessageTypeRule {
    type: MessageType;
    patternText: string;
    pattern: PosixRegex;
    disabled: boolean;
}

const MESSAGE_TYPES: ReadonlyArray<readonly [string, MessageType]> = [
    ['show', MSGTYP_NORMAL], ['hide', MSGTYP_NOSHOW], ['noshow', MSGTYP_NOSHOW],
    ['stop', MSGTYP_STOP], ['more', MSGTYP_STOP], ['norep', MSGTYP_NOREP],
];

// C options.c:msgtype_parse_add():
export function addMessageTypeRule(value: string, rules: MessageTypeRule[]): string | null {
    // sscanf() accepts a ten-character type and up to 255 pattern characters;
    // the closing quote and trailing input do not affect its two conversions.
    const match = value.match(/^\s*(\S{1,10})\s+"([^"]{1,255})/);
    if (!match?.[1] || !match[2]) return 'Malformed MSGTYPE';
    const name = match[1];
    const entry = MESSAGE_TYPES.find(([type]) => type.startsWith(name.toLowerCase()));
    if (!entry) return `Unknown message type '${name}'`;
    try {
        rules.unshift({ type: entry[1], patternText: match[2], pattern: new PosixRegex(match[2]), disabled: false });
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        return `MSGTYPE regex error: ${error.message}`;
    }
    return null;
}

// C options.c:msgtype_type():
export function messageTypeFor(
    text: string, noRepeat: boolean, rules: readonly MessageTypeRule[] = [],
): MessageType {
    const rule = rules.find(entry => entry.pattern.test(text));
    if (!rule) return noRepeat ? MSGTYP_NOREP : MSGTYP_NORMAL;
    // A disabled matching rule still wins over older rules and Norep().
    return rule.disabled ? MSGTYP_NORMAL : rule.type;
}

// C options.c:hide_unhide_msgtypes():
export function hideUnhideMessageTypes(
    hide: boolean, mask: number, rules: readonly MessageTypeRule[] = [],
): void {
    for (const rule of rules) {
        if (rule.type !== MSGTYP_NORMAL && ((1 << rule.type) & mask)) rule.disabled = hide;
    }
}

// C options.c:optfn_pettype() ignores negation when a value is supplied.
// Horse is accepted, but dog.c:pet_type() still chooses a dog or cat unless
// the role supplies its own pet.
function configuredPetType(value: string | null, negated: boolean): PetPreference | null {
    if (!value) return negated ? 'n' : null;
    switch (value.charAt(0).toLowerCase()) {
    case 'd': return 'd';
    case 'c': case 'f': return 'c';
    case 'h': case 'q': return 'h';
    case 'n': return 'n';
    case 'r': case '*': return '';
    default: return null;
    }
}

const MENU_STYLES = [
    ['traditional', '[prompt for object class(es), then', ' ask y/n for each item in those classes]'],
    ['combination', '[prompt for object class(es), then', ' use menu for items in those classes]'],
    ['full', '[use menu to choose class(es), then', ' use another menu for items in those]'],
    ['partial', '[skip class filtering; always', ' use menu of all available items]'],
] as const;

// C options.c:handler_menustyle(): the menu-style picker.
// Native options.c:handler_menustyle(). PICK_ONE retains the old selection
// until a different entry is chosen or the user explicitly deselects it.
async function editMenuStyle(): Promise<void> {
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

// Part of C options.c:handler_menustyle(): the initial-letter to style
// mapping.
function menuStyleForInitial(initial: string | null): MenuStyle | undefined {
    if (initial === null) return undefined;
    switch (initial) {
    case 'n':
    case 't': return 0;
    case 'c': return 1;
    case 'f': return 2;
    case 'p': return 3;
    default: return undefined;
    }
}

// C options.c:handler_menu_headings(): the color and attribute menus.
// options.c:handler_menu_headings() via coloratt.c:query_color_attr(). The
// style only changes when both menus are answered; a cancellation leaves it
// untouched (the C handler assigns into iflags at the very end).
async function editMenuHeadings(): Promise<void> {
    const current = game.iflags.menu_headings ?? { attr: C_ATR_INVERSE, color: NO_COLOR };
    const prompt = 'How to highlight menu headings:';
    const color = await queryColorMenu(prompt, current.color);
    if (color === null) return;
    const attr = await queryAttr(prompt, current.attr);
    if (attr === -1) return;
    game.iflags.menu_headings = { attr, color };
}

const NUMBER_PAD_CHOICES = [
    ' 0 (off)', ' 1 (on)', ' 2 (on, MSDOS compatible)',
    ' 3 (on, phone-style digit layout)',
    ' 4 (on, phone-style layout, MSDOS compatible)',
    "-1 (off, 'z' to move upper-left, 'y' to zap wands)",
];

// Part of C options.c:optfn_number_pad(): the current mode's value string.
function numberPadDescription(): string {
    const bindings = game.commandBindings;
    if (!bindings.numberPad) return bindings.swapYZ ? '-1=off, y & z swapped' : '0=off';
    if (bindings.phoneLayout) return bindings.pcHack
        ? '4=on, phone layout, MSDOS compatible' : '3=on, phone-style layout';
    return bindings.pcHack ? '2=on, MSDOS compatible' : '1=on';
}


// C options.c:optfn_number_pad(): apply the chosen numberpad mode.
function optfnNumberPad(value: number, settings: Pick<ConfigurationSettings, 'commandBindings' | 'iflags'>): void {
    if (!settings.commandBindings.setNumberPad(value)) return;
    settings.iflags.num_pad = value > 0;
    settings.iflags.num_pad_mode = value === -1 ? 1 : value > 0 ? value - 1 : 0;
}

// C options.c:handler_number_pad(): the number_pad mode menu.
async function editNumberPad(): Promise<void> {
    const selected = await showMultiSelectWindow({
        title: 'Select number_pad mode:', omitHeadings: true, pickOne: true,
        sections: [{ items: NUMBER_PAD_CHOICES.map((text, index) => ({
            key: String.fromCharCode(97 + index), groupAccelerator: String(index), text, value: index,
        })) }],
    });
    const index = selected[0];
    if (index !== undefined) optfnNumberPad(index === 5 ? -1 : index, game);
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
] as const;

// C options.c:optfn_pickup_types(): the object-class letter validation
// loop.
export function optfnPickupTypes(value: string): { symbols: string; invalid: boolean } {
    value = value.replace(/^ +/, '');
    if (/^[aA]/.test(value)) return { symbols: '', invalid: false };
    let symbols = '';
    let invalid = false;
    for (const symbol of value) {
        if (!OBJECT_CLASS_SYMBOLS.includes(symbol) || symbols.includes(symbol)) invalid = true;
        else symbols += symbol;
    }
    return { symbols, invalid };
}

// C options.c:handler_pickup_types(): the autopickup class editor.
// options.c:optfn_pickup_types() prompts in traditional/combination mode;
// windows.c:choose_classes_menu() owns the full/partial class picker.
async function editPickupTypes(preserveStatus = false): Promise<void> {
    const previous = game.flags.pickup_types ?? '';
    game.flags.pickup_types = '';
    let value = previous;
    let useMenu = true;
    if ((game.flags.menu_style ?? MENU_FULL) <= 1) {
        const answer = await getLine(`New pickup_types: [${inventoryOrderSymbols()} am] (${previous || 'all'})`,
            (_character: string, key: number) => key >= 32 && key < 127);
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
    const parsed = optfnPickupTypes(value);
    game.flags.pickup_types = parsed.symbols;
    if (parsed.invalid) await optionError("Unknown pickup_types parameter ''");
}

// C options.c:handler_petattr(): the pet highlight attribute menu.
// options.c:handler_petattr() commits and requests a redraw even when
// the accepted attribute equals the current one. Escape changes nothing.
async function editPetAttribute(): Promise<boolean> {
    const attr = await queryAttr('Select pet highlight attribute',
        game.iflags.wc2_petattr ?? C_ATR_INVERSE);
    if (attr === -1) return false;
    game.iflags.wc2_petattr = attr;
    game.flags.hilite_pet = attr !== C_ATR_NONE;
    return true;
}

// Part of C options.c:handler_sortloot(): the sortloot mode letters.
function isLootSortMode(mode: string | undefined): mode is LootSortMode {
    return mode === 'n' || mode === 'l' || mode === 'f';
}

const SORT_LOOT_NAMES = { n: 'none', l: 'loot', f: 'full' };

// C options.c:handler_sortloot(): the loot sorting type picker.
async function editSortLoot(): Promise<void> {
    const previous = game.flags.sortloot ?? 'l';
    const selection = await showInventoryWindow([{ items:
        Object.entries(SORT_LOOT_NAMES).map(([key, name]) => ({ key, text: name })),
    }], { title: 'Select loot sorting type:', pickMode: PICK_ONE, preselectedKey: previous });
    const mode = String.fromCharCode(selection.key);
    if (isLootSortMode(mode)) game.flags.sortloot = mode;
}

// C options.c:handler_autopickup_exception(): the exception rules editor.
// options.c:handler_autopickup_exception().
async function editAutopickupExceptions(): Promise<void> {
    for (;;) {
        const exceptions = game.iflags.autopickupExceptions ?? [];
        const action = await chooseAddListRemove('autopickup exception', exceptions.length);
        if (action === 'done') return;
        if (action === 'add') {
            const answer = await getLine('What new autopickup exception pattern?',
                (_character: string, key: number) => key >= 32 && key < 127);
            if (answer === null) return;
            const pattern = new TextDecoder().decode(mungSpaces(new TextEncoder().encode(answer)));
            if (!pattern) continue;
            // The handler wraps the answer in quotes (apebuf's bounds cap the
            // whole mapping at 255 bytes) and reuses the config parser; its
            // diagnostics pline immediately in-game.
            const errors: string[] = [];
            const rule = parseAutopickupException(`"${cutConfigBytes(pattern, 255)}"`,
                message => errors.push(message));
            for (const message of errors) await optionError(message);
            if (rule) (game.iflags.autopickupExceptions ??= []).unshift(rule);
            continue;
        }
        const rows = exceptions.map(rule => ({
            value: rule, text: `"${rule.grab ? '<' : '>'}${rule.pattern}"`,
        }));
        if (action === 'remove') {
            const picked = await showMultiSelectWindow<AutopickupExceptionRule>({
                title: 'Remove which autopickup exceptions', pageLocalKeys: true,
                signalEscape: true,
                sections: [{ heading: "Always pickup '<'; never pickup '>'", items: rows }],
            });
            if (picked === null) return;
            for (const rule of picked) {
                const index = exceptions.indexOf(rule);
                if (index >= 0) exceptions.splice(index, 1);
            }
        } else {
            const answer = await showInventoryWindow(
                [{ heading: "Always pickup '<'; never pickup '>'", items: rows.map(row => ({ text: row.text })) }],
                { title: 'List of autopickup exceptions', pickMode: PICK_NONE });
            if (answer.key === 27) return;
        }
    }
}

// C options.c:handler_menu_colors(): the menu-color rules editor.
// options.c:handler_menu_colors().
async function editMenuColors(): Promise<void> {
    for (;;) {
        const colorings = game.iflags.menuColorings ?? [];
        const action = await chooseAddListRemove('menucolor', colorings.length);
        if (action === 'done') return;
        if (action === 'add') {
            const pattern = await getLine('What new menucolor pattern?',
                (_character: string, key: number) => key >= 32 && key < 127);
            if (pattern === null) return;
            if (pattern) {
                let regex: PosixRegex | null = null;
                try {
                    regex = new PosixRegex(pattern);
                } catch (error) {
                    if (!(error instanceof SyntaxError)) throw error;
                    await optionError(`MENUCOLORS regex: ${error.message}`);
                }
                if (regex) {
                    const color = await queryColorMenu('Pick a color', NO_COLOR);
                    if (color !== null) {
                        const attr = await queryAttr('Pick an attribute', 0);
                        if (attr !== -1) {
                            (game.iflags.menuColorings ??= []).unshift({ origstr: pattern, color, attr, regex });
                            game.flags.menucolors = true;
                        }
                    }
                }
            }
            continue;
        }
        if (action === 'remove') {
            const picked = await showMultiSelectWindow<MenuColoringRule>({
                title: 'Remove which menu colors', omitHeadings: true,
                pageLocalKeys: true, signalEscape: true,
                sections: [{ items: colorings.map(rule => ({ value: rule, text: menuColoringRow(rule) })) }],
            });
            if (picked === null) return;
            for (const rule of picked) {
                const index = colorings.indexOf(rule);
                if (index >= 0) colorings.splice(index, 1);
            }
        } else {
            // C assigns a non-zero identifier to every row of both the list
            // and remove menus, so the tty prefixes letters even for this
            // PICK_NONE listing (unlike the autopickup-exception listing,
            // whose rows carry a zero identifier).
            const answer = await showInventoryWindow<MenuColoringRule>(
                [{ items: colorings.map(rule => ({ value: rule, text: menuColoringRow(rule) })) }],
                { title: 'List of menu colors', pickMode: PICK_NONE });
            if (answer.key === 27) return;
        }
    }
}

// Part of C options.c:handler_menu_colors(): one coloring's listing row.
// handler_menu_colors(): `"pattern"="=color&attr` minus one leading quote of
// the C suffix buffer, i.e. the pattern's closing quote is kept; the color
// name's blank becomes '-', there is no attribute half for ATR_NONE, and an
// overflowing original string is elided with "..." at the byte level.
function menuColoringRow(rule: MenuColoringRule): string {
    const color = colorName(rule.color).replace(/ /g, '-');
    const suffix = `"=${color}${rule.attr !== 0 ? `&${attributeName(rule.attr)}` : ''}`;
    // C: ln = BUFSZ - strlen("\"\"=suffix") - 1, and strncat() counts bytes.
    const limit = 254 - suffix.length;
    const shown = new TextEncoder().encode(rule.origstr).length > limit
        ? `${cutConfigBytes(rule.origstr, limit - 3)}...` : rule.origstr;
    return `"${shown}${suffix}`;
}

const MESSAGE_TYPE_CHOICES = [
    ['show', MSGTYP_NORMAL, 'Show message normally'],
    ['hide', MSGTYP_NOSHOW, 'Hide message'],
    ['stop', MSGTYP_STOP, 'Prompt for more after the message'],
    ['norep', MSGTYP_NOREP, 'Do not repeat the message'],
] as const;

// C options.c:handler_msgtype(): the message-type rules editor.
// options.c:handler_msgtype(), query_msgtype(). Rules take effect immediately;
// every completed action returns to the add/list/remove chooser.
async function editMessageTypes(): Promise<void> {
    for (;;) {
        const rules = game.iflags.messageTypes ?? [];
        const action = await chooseAddListRemove('message type', rules.length);
        if (action === 'done') return;
        if (action === 'add') {
            const patternText = await getLine('What new message pattern?',
                (_character: string, key: number) => key >= 32 && key < 127);
            if (patternText === null) return;
            if (!patternText) continue;
            let pattern: PosixRegex;
            try {
                pattern = new PosixRegex(patternText);
            } catch (error) {
                if (!(error instanceof SyntaxError)) throw error;
                await optionError(`MSGTYPE regex: ${error.message}`);
                continue;
            }
            const selected = await showInventoryWindow<MessageType>([{ items:
                MESSAGE_TYPE_CHOICES.map(([, value, text]) => ({ value, text })),
            }], { title: 'How to show the message', pickMode: PICK_ONE });
            if (selected.value !== undefined)
                (game.iflags.messageTypes ??= []).unshift({ type: selected.value, patternText, pattern, disabled: false });
            continue;
        }
        const items = rules.map(rule => ({ value: rule, text: messageTypeRow(rule) }));
        if (action === 'list') {
            const answer = await showInventoryWindow([{ items }], { title: 'List of message types', pickMode: PICK_NONE });
            if (answer.key === 27) return;
        } else {
            const selected = await showMultiSelectWindow<MessageTypeRule>({
                title: 'Remove which message types', omitHeadings: true,
                pageLocalKeys: true, signalEscape: true, sections: [{ items }],
            });
            if (selected === null) return;
            for (const rule of selected) {
                const index = rules.indexOf(rule);
                if (index >= 0) rules.splice(index, 1);
            }
        }
    }
}

// Part of C options.c:handler_msgtype(): one rule's listing row.
function messageTypeRow(rule: MessageTypeRule): string {
    const choice = MESSAGE_TYPE_CHOICES.find(([, type]) => type === rule.type);
    if (!choice) throw new Error(`Unknown message type ${rule.type}`);
    const prefix = `${choice[0].padEnd(5)} "`;
    // handler_msgtype() reserves the closing quote and NUL in its BUFSZ buffer.
    const limit = BUFSZ - prefix.length - 2;
    const pattern = new TextEncoder().encode(rule.patternText).length > limit
        ? `${cutConfigBytes(rule.patternText, limit - 3)}...` : rule.patternText;
    return `${prefix}${pattern}"`;
}

// C options.c:length_without_val(): the element up to the first ':' or
// '=' whichever leads, with preceding whitespace excluded.
function lengthWithoutValue(element: string): number {
    let cut = element.length;
    for (let i = 0; i < element.length; i++) {
        if (element.charAt(i) === ':' || element.charAt(i) === '=') { cut = i; break; }
    }
    while (cut > 0 && ' \t\n\v\f\r'.includes(element.charAt(cut - 1))) cut--;
    return cut;
}

// C options.c:nmcpy() copies bytes; bones.c:sanitize_name() replaces control
// bytes and strips printable high bytes only when eight-bit input is disabled.
function configuredPetName(value: Uint8Array, eightBitInput: boolean): string {
    const bytes = value.subarray(0, PL_PSIZ - 1);
    const nameBytes: number[] = [];
    for (const byte of bytes) {
        if (byte === 0 || byte === 44) break;
        const character = byte & 0x7f;
        if (character < 32 || character === 127) nameBytes.push('.'.charCodeAt(0));
        else nameBytes.push(byte > 127 && !eightBitInput ? '_'.charCodeAt(0) : byte);
    }
    // The tty consumes individual characters, even when these bytes no
    // longer form UTF-8 after sanitizing or reaching the name limit.
    return String.fromCharCode(...nameBytes);
}

// C options.c:escapes()
// Byte-oriented control, numeric, and meta escapes.
export function decodeOptionEscapes(value: string): string {
    const bytes = String.fromCharCode(...new TextEncoder().encode(value));
    let decoded = '';
    let index = 0;
    while (index < bytes.length) {
        let meta = 0;
        if (/^\\[mM]./.test(bytes.slice(index))) {
            meta = 128;
            index += 2;
        }
        const character = bytes.charAt(index++);
        let code = character.charCodeAt(0);
        if (character === '^' && index < bytes.length) code = bytes.charCodeAt(index++) & 31;
        else if (character === '\\' && index < bytes.length) {
            const rest = bytes.slice(index);
            const numeric = rest.match(/^(\d{1,3})|^[oO]([0-7]{1,3})|^[xX]([0-9a-fA-F]{1,2})/);
            if (numeric) {
                const number = numeric[1] ?? numeric[2] ?? numeric[3] ?? '0';
                code = parseInt(number, numeric[1] ? 10 : numeric[2] ? 8 : 16);
                index += numeric[0].length;
            } else {
                const escaped = bytes.charAt(index++);
                code = escaped === 'n' ? 10 : escaped === 't' ? 9 : escaped === 'b' ? 8
                    : escaped === 'r' ? 13 : escaped.charCodeAt(0);
            }
        }
        decoded += String.fromCharCode((code | meta) & 255);
    }
    return decoded;
}

// C options.c:txt2key(): a binding's text to its key byte.
// txt2key() consumes bytes, not Unicode code points. Only the first decoded
// escape is needed: Native returns the first byte of escapes()' output.
export function bindingKeyCode(value: string): number {
    let key = String.fromCharCode(...new TextEncoder().encode(value.trim()));
    if (!key.length) return 0;
    if (key.length === 1) return key.charCodeAt(0);
    if (key === '<enter>') return 10;
    if (key === '<space>') return 32;
    if (key === '<esc>') return 27;
    if (key[0] === '\\') {
        let meta = 0;
        if (/^\\[mM]./.test(key)) {
            meta = 128;
            key = key.slice(2);
        }
        let code = key.charCodeAt(0);
        if (key.length > 1) {
            if (key[0] === '^') code = key.charCodeAt(1) & 31;
            else if (key[0] === '\\') {
                const numeric = key.match(/^\\(?:(\d{1,3})|[oO]([0-7]{1,3})|[xX]([0-9a-fA-F]{1,2}))/);
                if (numeric?.[1]) code = parseInt(numeric[1], 10);
                else if (numeric?.[2]) code = parseInt(numeric[2], 8);
                else if (numeric?.[3]) code = parseInt(numeric[3], 16);
                else code = escapeKeyCode(key.charAt(1));
            }
        }
        return (code | meta) & 255;
    }
    let meta = 0;
    if (key.charAt(0).toUpperCase() === 'M') {
        key = key.slice(1);
        if (key[0] === '-' && key.length > 1) key = key.slice(1);
        if (key.length === 1) return key.charCodeAt(0) | 128;
        meta = 128;
    }
    if (key[0] === '^' || key.charAt(0).toUpperCase() === 'C') {
        if (key.length === 1) return key.charCodeAt(0) | meta;
        key = key.slice(1);
        if (key[0] === '-' && key.length > 1) key = key.slice(1);
        return (key[0] === '?' ? 127 : key.charCodeAt(0) & 31) | meta;
    }
    if (meta) return key.charCodeAt(0) | meta;
    const decimal = key.match(/^\d{3}/);
    return decimal ? Number(decimal[0]) & 255 : 0;
}

// Part of C options.c:txt2key(): the backslash escape bytes.
function escapeKeyCode(character: string): number {
    switch (character) {
    case 'n': return 10;
    case 't': return 9;
    case 'b': return 8;
    case 'r': return 13;
    default: return character.charCodeAt(0);
    }
}

// C options.c:initoptions(): the default fruit before any fruit option.
export function initializeFruitRegistry(name = 'slime mold', state: GameState = game) {
    state.fruits = [];
    state.fruitName = normalizePreferredFruitName(name, state);
    addFruit(state.fruitName, { preferred: true, initial: true, state });
}

// ---------------------------------------------------------------------------
// C options.c:change_inv_order().
// ---------------------------------------------------------------------------

// C options.c:change_inv_order(). Keeps valid entries even when others are
// bad, then fills omitted classes using their previous order; omitted gold
// leads. Returns the completed order plus the errors config_error_add()
// would have logged; each caller owns when flags.inv_order takes the result.
export function changeInventoryOrder(
    symbols: string, state: InventoryOrderState = game,
): { order: number[]; errors: string[] } {
    const previous = inventoryClassOrder(state);
    const order = symbols.includes('$') ? [] : [COIN_CLASS];
    const errors: string[] = [];
    for (const [index, symbol] of [...symbols].entries()) {
        const oclass = OBJECT_CLASS_SYMBOLS.indexOf(symbol);
        if (oclass < ILLOBJ_CLASS) errors.push(`Not an object class '${symbol}'`);
        else if (!previous.includes(oclass)) errors.push(`Object class '${symbol}' not allowed`);
        else if (symbols.indexOf(symbol, index + 1) !== -1) errors.push(`Duplicate object class '${symbol}'`);
        else {
            order.push(oclass);
        }
    }
    return { order: [...order, ...previous.filter(oclass => !order.includes(oclass))], errors };
}

// ---------------------------------------------------------------------------
// C options.c:warning_opts()/assign_warnings().
// ---------------------------------------------------------------------------

// C options.c:warning_opts()/assign_warnings(): the string-valued warnings
// option; the numeric WARNINGS= statement lives in cfgfiles.ts.
// Also C drawing.c:def_warnsyms: the fallback symbol table.
export function setWarningSymbols(value: string, flags: InterfaceFlags): void {
    const decoded = decodeOptionEscapes(value).split('\0', 1)[0] ?? '';
    const previous = flags.warningSymbols;
    flags.warningSymbols = def_warnsyms.map((warning, index) => decoded.charAt(index)
        || previous?.charAt(index) || warning.ch).join('');
}

// Port only: the live warning-symbol table merged with its overrides (C
// options.c warning_opts stores them).
export function warningSymbols() {
    return def_warnsyms.map((warning, index) => ({ ...warning,
        ch: game.iflags.warningSymbols?.charAt(index) || warning.ch,
    }));
}

// C options.c:parsebindings() treats a leading comma as the key, and
// processes the remaining comma-separated bindings before the first one.
export function bindingFields(value: string): string[] {
    const fields = [];
    while (value) {
        let separator = value.indexOf(',');
        if (separator === 0) separator = value.indexOf(',', 1);
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

// C options.c:parse_role_opt(). Negative lists change filters without
// replacing an already specified choice; each option source has its own list.
function configureCharacterOption(result: ConfigurationSettings, {
    facet, value, spelling, negated, previous, fromFile, usingAlias,
}: {
    facet: CharacterFacet;
    value: string | null;
    spelling: string;
    negated: boolean;
    previous: Map<CharacterFacet, 'positive' | 'negative'>;
    fromFile: boolean;
    usingAlias: boolean;
}, addError: (message: string) => void): void {
    if (!value) { addError(`Missing parameter for '${spelling}'`); return; }
    const filters = result.characterFilters ??= createCharacterFilters();
    let priorNegation: boolean | null = null;
    let positiveValue: string | null = null;
    let filterOnly = false;
    const duplicate = fromFile && previous.has(facet);
    const words = value.trim();
    for (let token of words ? words.split(/\s+/) : []) {
        let tokenNegated = false;
        while (token.startsWith('!') || /^no/i.test(token)) {
            tokenNegated = !tokenNegated;
            token = token.slice(token.startsWith('!') ? 1 : token[2] === '-' ? 3 : 2);
        }
        if (!token) { addError(`Negated nothing for '${facet}'`); return; }
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
            if (previous.get(facet) !== 'negative') clearrolefilter(filters, facet);
            if (!setrolefilter(filters, token)) {
                addError(`Invalid ${facet} '${token}'`);
                return;
            }
            previous.set(facet, 'negative');
            filterOnly = true;
        } else {
            if (duplicate && previous.get(facet) === 'negative') {
                const alias = facet === 'role' ? 'character' : facet === 'alignment' ? 'align' : '(null)';
                addError(`compound option specified multiple times: ${facet}${usingAlias ? ` (via alias: ${alias})` : ''}`);
                return;
            }
            previous.set(facet, 'positive');
            positiveValue = token;
        }
    }
    if (filterOnly) return;
    positiveValue ??= '';
    const selected = facet === 'role' ? str2role(positiveValue)
        : facet === 'race' ? str2race(positiveValue)
        : facet === 'gender' ? str2gend(positiveValue) : str2align(positiveValue);
    const random = randomCharacterOption(positiveValue);
    if (!selected && !random) addError(`Unknown ${facet} '${positiveValue}'`);
    const choice = selected || random ? positiveValue : null;
    switch (facet) {
    case 'role': result.role = choice; break;
    case 'race': result.race = choice; break;
    case 'gender':
        result.gender = choice;
        result.flags.initgend = str2gend(choice)?.value ?? (random ? -2 : -1);
        if (choice) result.flags.female = random || str2gend(choice)?.value === 1;
        break;
    case 'alignment': result.align = choice; break;
    }
}

// C options.c:illegal_menu_cmd_key(): reserved keys for menu commands.
// options.c illegal_menu_cmd_key(): the reserved control, space, digit,
// and letter keys ('@' excepted), then the default object-class symbols.
export function menuCommandKeyError(key: number): string | null {
    const character = String.fromCharCode(key);
    const letter = (key >= 65 && key <= 90) || (key >= 97 && key <= 122);
    if (key === 0 || key === 13 || key === 10 || key === 27 || key === 32
        || (key >= 48 && key <= 57) || (letter && key !== 64)) {
        return `Reserved menu command key '${visibleCommandKey(key)}'`;
    }
    if (OBJECT_CLASS_SYMBOLS.slice(1).includes(character)) {
        return `Menu command key '${visibleCommandKey(key)}' is an object class`;
    }
    return null;
}

interface AddFruitOptions {
    preferred?: boolean;
    initial?: boolean;
    replacement?: Fruit | null;
    state?: GameState;
}

// C options.c:fruitadd(). Returns the fid of the fruit type; if that type
// already exists, it returns the fid of that one; if it does not exist, it
// adds a new fruit type to the chain and returns the new one. External names
// (bones and orc loot) already have their singular identity; adding one never
// changes the player's preferred fruit.
export function addFruit(name: string, { preferred = false, initial = false, replacement = null, state = game }: AddFruitOptions = {}) {
    let value: string;
    if (preferred) {
        // C fruitadd()'s user_specified branch: force singular, then reject
        // other foods (globs skip a size prefix), empty or numeric names, food
        // attributes, and monster tins/corpses/eggs by prefixing "candied ".
        value = (makeSingular(name).split(',', 1)[0] ?? '').slice(0, FRUIT_NAME_BYTES);
        const size = value.startsWith('small ') || value.startsWith('large ') ? 6
            : value.startsWith('medium ') ? 7 : value.startsWith('very large ') ? 11 : 0;
        const { first, last } = getObjectClassBounds(FOOD_CLASS);
        const foodNames = OBJECT_NAMES.slice(first, last + 1);
        // initoptions_finish precedes init_objects: C's food-class bases are
        // still zero, so the food-name conflict check starts at runtime.
        const food = !initial && foodNames.some(foodName => {
            const actual = foodName === 'slime mold' ? 'fruit' : foodName;
            return actual === value || size && actual === value.slice(size);
        });
        const numeric = /^\d*(?:$|\s)/.test(value);
        const monsterTin = value.startsWith('tin of ')
            && (value.slice(7) === 'spinach' || nameToMonster(value.slice(7)) >= 0);
        const monsterProduct = /(?: corpse| egg)$/.test(value) && nameToMonster(value) >= 0;
        if (food || numeric || /^(?:cursed |uncursed |blessed |partly eaten )/.test(value)
            || monsterTin || value === 'empty tin' || value === 'glob'
            || size && value.slice(size) === 'glob' || monsterProduct)
            value = `candied ${value}`.slice(0, FRUIT_NAME_BYTES);
        state.fruitName = value;
        state.flags.made_fruit = false;
        if (replacement) {
            replacement.fname = value;
            state.context.current_fruit = replacement.fid;
            return replacement.fid;
        }
    } else {
        // Not user-specified, so assumed to be from bones (or orc gang).
        value = sanitizeFruitCopy(name, state.iflags);
        state.flags.made_fruit = true;
    }
    const existing = fruitFromName(value, { state });
    if (existing) {
        if (preferred) state.context.current_fruit = existing.fid;
        return existing.fid;
    }
    const highest = highestFruitId(state);
    if (highest >= 127) return rnd(127);
    const fruit = { fid: highest + 1, fname: value };
    fruitRegistry(state).unshift(fruit);
    if (preferred) state.context.current_fruit = fruit.fid;
    return fruit.fid;
}

// Part of C options.c:fruitadd(): the highest_fruit_id scan.
// fruitadd()'s highest_fruit_id and fruit_from_name()'s out-parameter share
// this highest-fid scan over the registry.
function highestFruitId(state: GameState) {
    return fruitRegistry(state).reduce((highest, fruit) => Math.max(highest, fruit.fid), 0);
}

const FRUIT_NAME_BYTES = 31; // PL_FSIZ includes the trailing NUL.

// Part of C options.c:doset_simple_menu(): the simple options menu
// sections.
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
] as const;

// Part of C options.c:doset_simple_menu(): the simple options menu
// sections.
function simpleMenuSections(): PageLocalMultiSelectSection<string>[] {
    const options = requestMenuSections().flatMap(section => section.items);
    return [
        { items: [
            ...(game.iflags.simple_options_help
                ? [{ selectable: false, text: "Use command '#optionsfull' to get the complete options list." } as const]
                : []),
            { key: '?', value: 'help', text: game.iflags.simple_options_help ? 'hide help' : 'show help' },
        ] },
        ...SIMPLE_OPTION_SECTIONS.map(([heading, names]) => {
            const items: (PageLocalMenuItem<string> | MenuLabel)[] = [
                { selectable: false, text: '' },
                { selectable: false, text: ` ${heading.padEnd(30)} `, attr: ATR_INVERSE,
                    itemFlags: MENU_ITEMFLAGS_SKIPMENUCOLORS },
            ];
            for (const [listedName, description] of names) {
                // doset_simple() shows the rogue set's row in place of
                // symset while the hero is on the Rogue level.
                const name = listedName === 'symset' && Is_rogue_level(game.u?.uz)
                    ? 'roguesymset' : listedName;
                const option = options.find(item => item.selectable !== false && item.value === name);
                if (!option || option.selectable === false) throw new Error(`Missing simple option: ${name}`);
                const boolean = requestBooleanByName.get(name.toLowerCase());
                const text = boolean ? `${name.padEnd(24)}[${requestBooleanValue(boolean[0]) ? 'X' : ' '}]`
                    : option.text;
                const suffix = ['pickup_types', 'pickup_thrown', 'pickup_stolen', 'dropped_nopick'].includes(name)
                    ? '  (for autopickup)' : '';
                items.push({ value: name, text: text + suffix });
                if (game.iflags.simple_options_help) {
                    items.push({ selectable: false, text: `    ${description}` },
                        { selectable: false, text: '' });
                }
            }
            return { items };
        }),
    ];
}

// C options.c:doset_simple_menu(): build the simple options menu, take
// one pick, and apply it — the boolean toggle, the compound handler, or
// the help toggle; PICK_ONE accepts a choice immediately.  Returns the
// picked name, or null when the menu was dismissed.
async function dosetSimpleMenu(): Promise<string | null> {
    const selected = await showMultiSelectWindow({
        title: 'Options', pageLocalKeys: true, omitHeadings: true,
        sections: simpleMenuSections(), pickOne: true,
    });
    const name = selected[0];
    if (!name) return null;
    if (name === 'help') {
        game.iflags.simple_options_help = !game.iflags.simple_options_help;
        return name;
    }
    const option = requestBooleanByName.get(name.toLowerCase());
    let pending: PendingVisuals = NO_VISUAL_CHANGE;
    if (option) {
        setRequestBoolean(option, !requestBooleanValue(option[0]));
        pending = await applyBooleanVisualChange(option[0]);
    } else pending = { redraw: await editCompoundOption(name, false), customReset: false };
    // options.c:8723-8731: reset_needed_visuals() runs for every pick;
    // the extra flush_screen(1) happens only for opt_need_redraw.
    if (pending.redraw || pending.customReset) {
        if (pending.redraw) {
            checkGoldSymbol();
            reglyph_darkroom();
        }
        await docrt();
    }
    if (pending.redraw) await flush_screen(1);
    await bot();
    return name;
}

// C options.c:doset_simple(): the simple options menu loop — apply one
// choice, refresh its visuals, and offer a fresh menu until a round
// picks nothing.
export async function doOptions(menuRequested = false): Promise<void> {
    if (menuRequested) {
        await doRequestMenuOptions();
        return;
    }
    // doset_simple() loops doset_simple_menu() while it took a pick.
    while (await dosetSimpleMenu()) { /* offer a fresh menu */ }
    // doset_simple resets pending visuals after cancellation too. A full-screen
    // tty dismissal clears status while its input owner still suppresses bot().
    await bot();
    game.iflags.optionMessages = true;
    game.context.move = 0;
}

// C's HELP_IDX is distinct from the boolean 'help' option.
const OPTIONS_MENU_HELP = 'options_menu_help';

// C options.c:doset(): the full "Set what options?" menu loop — the
// cmdassist help block, the boolean/compound/other sections, the pick walk
// that toggles booleans and dispatches compound editors (doset_add_menu's
// rows come from requestMenuSections()), and the rerun-on-help-only pass
// with reset_needed_visuals() at the end. doset_simple()'s port (doOptions)
// routes here on a menu-requested '#options'.
async function doRequestMenuOptions(): Promise<void> {
    let skipHelp = game.flags.cmdassist === false;
    let pending = NO_VISUAL_CHANGE;
    let giveBooleanMessage = game.iflags.optionMessages !== false;
    for (;;) {
        const sections = requestMenuSections().map(section => ({ items: [
            { selectable: false, text: section.heading ?? '', attr: ATR_INVERSE,
                itemFlags: MENU_ITEMFLAGS_SKIPMENUCOLORS } as const,
            ...section.items,
        ] }));
        if (!skipHelp) sections.unshift({ items: [
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
                if (option[0] === 'rest_on_space') game.commandBindings.setRestOnSpace(value);
                const change = await applyBooleanVisualChange(option[0]);
                pending = { redraw: pending.redraw || change.redraw,
                    customReset: pending.customReset || change.customReset };
                if (giveBooleanMessage) await plineWithContinuation(`'${option[0]}' option toggled ${value ? 'on' : 'off'}.`);
            } else {
                const redraw = await editCompoundOption(name, true);
                pending = { redraw: pending.redraw || redraw, customReset: pending.customReset };
            }
        }
        if (selected.length !== 1 || selected[0] !== OPTIONS_MENU_HELP) break;
        skipHelp = true;
    }
    // options.c:8973-9002: reset_needed_visuals() after the whole menu; the
    // customsymbols/customcolors resets redraw without the gold probe.
    if (pending.redraw || pending.customReset) {
        if (pending.redraw) {
            checkGoldSymbol();
            reglyph_darkroom();
        }
        await docrt();
    }
    await bot();
    game.context.move = 0;
}

// Part of C options.c:doset(): dispatch a selected option to its editor or
// handler.
async function editCompoundOption(name: string, fullMenu: boolean): Promise<boolean> {
    const previousVersion = game.flags.versinfo ?? 1;
    if (name === 'number_pad') await editNumberPad();
    else if (name === 'menustyle') await editMenuStyle();
    else if (name === 'fruit') await editFruitOption(fullMenu && game.iflags.optionMessages !== false);
    else if (name === 'pickup_types') await editPickupTypes(fullMenu);
    else if (name === 'autopickup_exceptions') await editAutopickupExceptions();
    else if (name === 'menu_colors') await editMenuColors();
    else if (name === 'message_types') await editMessageTypes();
    else if (name === 'menu_headings') await editMenuHeadings();
    else if (name === 'petattr') return await editPetAttribute();
    // OthrOpt handlers: options.c o_status_hilites and o_bind_keys do_handler.
    else if (name === 'status_highlights') await statusHiliteMenu();
    else if (name === 'bind_keys') await handlerRebindKeys();
    else if (name === 'autocompletions') await changeCommandAutocompletions();
    else if (name === 'sortvanquished') {
        const previous = game.flags.vanqSortmode ?? 0;
        await setVanqOrder(true);
        await plineWithContinuation(`'sortvanquished' ${(game.flags.vanqSortmode ?? 0) === previous
            ? 'not changed, still' : 'changed to'} "${vanquishedOptionValue()}".`);
    }
    else if (name === 'sortloot') await editSortLoot();
    else if (name === 'sortdiscoveries') await chooseDiscoverySort(0);
    else if (name === 'symset') return await editSymset(false);
    else if (name === 'roguesymset') return await editSymset(true);
    else if (name === 'boulder') return await editBoulderSymbol();
    else if (await editCompoundMenu(name, fullMenu && game.iflags.optionMessages !== false))
        return name === 'versinfo' && (game.flags.versinfo ?? 1) !== previousVersion;
    else if (isTextOption(name)) {
        const value = await getLine(`Set ${name} to what?`,
            (_character: string, key: number) => key >= 32 && key < 127);
        if (value === null) return false;
        if (name === 'scores') {
            const parsed = optfnScores(value, false);
            if (parsed) {
                game.flags.end_top = parsed.end_top;
                game.flags.end_around = parsed.end_around;
                game.flags.end_own = parsed.end_own;
                if (parsed.error) await optionError(parsed.error);
            } else await optionError("Missing parameter for 'scores:'");
        } else await setTextOption(name, value);
    }

    return false;
}

// Part of C options.c:doset(), doset_simple(): the fruit prompt routed
// through optfn_fruit.
async function editFruitOption(giveMessage: boolean): Promise<void> {
    const name = await getLine('Set fruit to what?',
        (_ch: string, code: number) => code >= 32 && code < 127, { suppressStatus: true });
    if (!name) return;
    const result = changePreferredFruit(name);
    // doset_simple suppresses this notice; doset keeps it.
    if (!result.changed || giveMessage) await plineWithContinuation(result.message);
}

// C options.c:optfn_boulder(): the do_set branch. escapes() decodes the
// value, then the first byte replaces the boulder symbol in both symbol
// sets' overrides. A monster-class or warning symbol is refused ("boulder
// symbol would conflict"); the warning test covers '1'..'5' only, so '0'
// passes. char is signed in the native build, so a decoded byte of 128..255
// is negative there and is refused as a control character together with
// everything below space. Mid-game (go.opt_initial clear) the shown symbol
// refreshes through get_othersym() and go.opt_need_redraw; the initial
// config only records the override.
export function optfnBoulder(raw: string, { initial = false } = {}):
    { symbol: string } | { error: string } {
    const symbol = decodeOptionEscapes(raw).charAt(0);
    const code = symbol.charCodeAt(0);
    const monsterClash = MONSTER_CLASS_SYMBOLS.indexOf(symbol) > 0;
    const warningClash = code >= 49 && code < 48 + WARNCOUNT;
    if (!(code >= 32) || code > 127)
        return { error: 'boulder symbol cannot be a control character' };
    if (monsterClash)
        return { error: `Badoption - boulder symbol '${symbol}' would conflict with a monster symbol` };
    if (warningClash)
        return { error: `Badoption - boulder symbol '${symbol}' would conflict with a warning symbol` };
    // The override is written to both symbol sets before the mid-game
    // refresh reads it back through get_othersym() (options.c:1213-1225).
    if (!initial) {
        game.boulderSym = symbol;
        game.rogueBoulderSym = symbol;
        reglyphBoulderSymbols();
    }
    return { symbol };
}

// Part of C options.c:doset(): the boulder prompt routed back through
// optfn_boulder.
// doset() gives boulder no handler, so the menu prompts and re-runs
// optfn_boulder() through parseoptions(); mid-game the new symbol lands in
// both symbol sets' overrides and go.opt_need_redraw triggers doredraw().
async function editBoulderSymbol(): Promise<boolean> {
    const value = await getLine('Set boulder to what?',
        (_character: string, key: number) => key >= 32 && key < 127);
    if (value === null) return false;
    if (!value) {
        await optionError("Missing parameter for 'boulder:'");
        return false;
    }
    const parsed = optfnBoulder(value);
    if ('error' in parsed) {
        await optionError(parsed.error);
        return false;
    }
    return true;
}

// C options.c:reset_needed_visuals(): the after-toggle redraw and status
// flush.
// options.c:reset_needed_visuals(), after the toggle message. Both reset
// kinds redraw; only opt_need_redraw re-probes the gold symbol and re-glyphs
// dark rooms, and no toggle path flushes the screen. A pending status
// update must finish even when option messages have been silenced.
async function resetBooleanVisuals(pending: PendingVisuals): Promise<void> {
    if (pending.redraw || pending.customReset) {
        if (pending.redraw) {
            checkGoldSymbol();
            reglyph_darkroom();
        }
        await docrt();
    }
    if (game.context.botl) await bot();
}


// C options.c:handle_add_list_remove(): the shared add/list/remove chooser.
// options.c:handle_add_list_remove(): the shared add/list/remove chooser.
// With nothing to act on, only "add" and "exit" are offered.
async function chooseAddListRemove(kind: string, count: number): Promise<'add' | 'list' | 'remove' | 'done'> {
    type Action = 'add' | 'list' | 'remove' | 'done';
    const choices: SelectableMenuItem<Action>[] = [
        { key: 'a', value: 'add', text: `add new ${kind}` },
        { key: 'l', value: 'list', text: `list ${kind}s` },
        { key: 'r', value: 'remove', text: `remove existing ${kind}` },
        { key: 'x', value: 'done', text: 'exit this menu', itemFlags: MENU_ITEMFLAGS_SELECTED },
    ];
    const items = count ? choices : choices.filter(item => item.value !== 'list' && item.value !== 'remove');
    const picks = await showMultiSelectWindow<Action>({
        title: 'Do what?', omitHeadings: true, pickOne: true, signalEscape: true,
        sections: [{ items }],
    });
    // PICK_ONE may return the preselected exit together with the new choice.
    const [first = 'done', second] = picks ?? [];
    return second !== undefined && first === 'done' ? second : first;
}

// C options.c:toggle_bool_option(): toggle every set_in_game boolean
// matching a prefix.
// options.c:toggle_bool_option() behind #toggle(<prefix>): every set_in_game
// boolean whose name starts with the text is toggled through the ordinary
// option path, with the menu's visual refresh after each one. give_opt_msg
// is the file static options.c carries across commands: once
// idlecheckpoint (or the options menu) has silenced it, later toggles print
// nothing until doset_simple() resets it.
export async function toggleBooleanOptionPrefix(prefix: string): Promise<boolean> {
    let toggled = false;
    let giveMessages = game.iflags.optionMessages !== false;
    for (const name of TOGGLE_BOOLEAN_NAMES) {
        if (!ciPrefixOf(name, prefix)) continue;
        if (name === 'menu_tab_sep' || name === 'montelecontrol') continue;
        if (game.iflags.debug_fuzzer && (name === 'silent' || name === 'perm_invent')) {
            await resetBooleanVisuals(NO_VISUAL_CHANGE);
            toggled = true;
            continue;
        }
        if (name === 'idlecheckpoint') {
            await plineWithContinuation("There is no underlying support for 'idlecheckpoint' compiled in.");
            game.iflags.optionMessages = false;
            giveMessages = false;
            await resetBooleanVisuals(NO_VISUAL_CHANGE);
            toggled = true;
            continue;
        }
        const wcBoolean = TOGGLE_WC_BOOLEANS.find(entry => entry[0] === name);
        if (wcBoolean) {
            const value = !(game.iflags[wcBoolean[1]] ?? wcBoolean[2]);
            // can_set_perm_invent() refuses enabling it on the pinned tty
            // port, which is built without WC_PERM_INVENT.
            if (name === 'perm_invent' && value) {
                await resetBooleanVisuals(NO_VISUAL_CHANGE);
                continue;
            }
            game.iflags[wcBoolean[1]] = value;
            if (name === 'ascii_map') game.iflags.wc_tiled_map = !value;
            if (name === 'tiled_map') game.iflags.wc_ascii_map = !value;
            if (giveMessages)
                await plineWithContinuation(`'${name}' option toggled ${value ? 'on' : 'off'}.`);
            await resetBooleanVisuals({ redraw: name === 'ascii_map' || name === 'tiled_map'
                || name === 'perm_invent', customReset: false });
            toggled = true;
            continue;
        }
        const option = requestBooleanByName.get(name);
        if (!option) continue;
        const value = !requestBooleanValue(option[0]);
        setRequestBoolean(option, value);
        if (option[0] === 'rest_on_space') game.commandBindings.setRestOnSpace(value);
        const pending = await applyBooleanVisualChange(option[0]);
        if (giveMessages)
            await plineWithContinuation(`'${option[0]}' option toggled ${value ? 'on' : 'off'}.`);
        await resetBooleanVisuals(pending);
        toggled = true;
    }
    return toggled;
}

// C options.c:add_autopickup_exception(): sscanf() forms `"<%s`, `">%s`, or
// `"%s`, each with an optional whitespace + '#' comment after the closing
// quote. Valid patterns join the exception list (newest first, like
// ga.apelist); pickup.c:autopick_testobj() consults it during autopickup.
export function parseAutopickupException(
    value: string, addError: (message: string) => void,
): AutopickupExceptionRule | null {
    const bytes = new TextEncoder().encode(value);
    const scan = (prefix: string): { text: string; trailing: string | null } | null => {
        const start = 1 + prefix.length;
        if (!value.startsWith('"' + prefix)) return null;
        const close = bytes.indexOf(34, start);
        const end = Math.min(close < 0 ? bytes.length : close, start + 253);
        if (end === start) return null;
        const text = new TextDecoder().decode(bytes.subarray(start, end));
        // Once the scanset captures text, sscanf() returns one conversion
        // even if the closing quote is missing or beyond the 253-byte limit.
        if (bytes[end] !== 34) return { text, trailing: null };
        const rest = new TextDecoder().decode(bytes.subarray(end + 1)).replace(/^[ \t\n\r\f\v]+/, '');
        return { text, trailing: rest.charAt(0) || null };
    };
    const compile = (text: string, grab: boolean): AutopickupExceptionRule | null => {
        try {
            return { pattern: text, grab, regex: new PosixRegex(text) };
        } catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
            addError(`regex error in AUTOPICKUP_EXCEPTION: ${error.message}`);
            return null;
        }
    };
    const grab = scan('<');
    if (grab && (grab.trailing === null || grab.trailing === '#'))
        return compile(grab.text, true);
    const noGrab = scan('>');
    if (noGrab?.trailing === null) return compile(noGrab.text, false);
    // The final check reuses the plain-quoted scan's captures, exactly as C
    // reuses the last sscanf()'s results ('">x" #c' keeps the '>x' text).
    const plain = scan('');
    if (plain && (plain.trailing === null || plain.trailing === '#'))
        return compile(plain.text, false);
    addError('syntax error in AUTOPICKUP_EXCEPTION');
    return null;
}

// C options.c:option_help(), next_opt(); descriptions from include/optlist.h.
export async function option_help(): Promise<void> {
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
    lines.push('', 'Other settings:',
        ...['autocompletions', 'autopickup exceptions', 'bind keys', 'menu colors',
            'message types', 'status condition fields', 'status highlight rules'].map(name => ` ${name}`),
        '', '',
        'Some of the options can only be set before the game is started;',
        "those items will not be selectable in the 'O' command's menu.",
        "Some options are stored in a game's save file, and will keep saved",
        'values when restoring that game even if you have updated your config-',
        'uration file to change them.  Such changes will matter for new games.',
        'The "other settings" can be set with \'O\', but when set within the',
        'configuration file they use their own directives rather than OPTIONS.',
        'See NetHack\'s "Guidebook" for details.');
    await displayPagerText(lines);
}

const OPTION_HELP_COMPOUNDS: readonly (readonly [string, string])[] = [
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
