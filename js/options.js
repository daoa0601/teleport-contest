// options.js — Parse .nethackrc options.
// C ref: options.c — handles OPTIONS=, BIND=, etc.
import { game } from './gstate.js';
import { CommandBindings } from './command_bindings.js';
import { changePreferredFruit, normalizePreferredFruitName } from './fruit.js';
import { bot, clearMessageWindow, cls, docrt, flushPendingTopline, flush_screen, plineWithContinuation } from './display.js';
import { vision_recalc } from './vision.js';
import { nhgetch } from './input.js';
import { getLine } from './query.js';
import { changeInventoryOrder, inventoryOrderSymbols } from './object_sort.js';
import { NO_COLOR } from './terminal.js';
import { ATR_INVERSE, restoreMenuUnderlay, showChoiceWindow, showInventoryWindow, showMultiSelectWindow, snapshotMenuUnderlay } from './windows.js';
import { MENU_FULL, PICK_ONE, PARANOID_AUTOALL, PARANOID_BONES, PARANOID_BREAKWAND, PARANOID_CONFIRM, PARANOID_DIE, PARANOID_EATING, PARANOID_HIT, PARANOID_PRAY, PARANOID_QUIT, PARANOID_REMOVE, PARANOID_SWIM, PARANOID_TRAP, PARANOID_WERECHANGE, } from './const.js';
const DEFAULT_PARANOIA_BITS = PARANOID_PRAY | PARANOID_SWIM | PARANOID_TRAP;
const MENU_STYLES = [
    ['traditional', '[prompt for object class(es), then', ' ask y/n for each item in those classes]'],
    ['combination', '[prompt for object class(es), then', ' use menu for items in those classes]'],
    ['full', '[use menu to choose class(es), then', ' use another menu for items in those]'],
    ['partial', '[skip class filtering; always', ' use menu of all available items]'],
];
const PARANOIA_OPTION_BITS = new Map([
    ['confirm', PARANOID_CONFIRM], ['paranoia', PARANOID_CONFIRM],
    ['quit', PARANOID_QUIT], ['explore', PARANOID_QUIT],
    ['die', PARANOID_DIE], ['death', PARANOID_DIE],
    ['bones', PARANOID_BONES],
    ['attack', PARANOID_HIT], ['hit', PARANOID_HIT],
    ['pray', PARANOID_PRAY],
    ['remove', PARANOID_REMOVE], ['takeoff', PARANOID_REMOVE],
    ['wand-break', PARANOID_BREAKWAND],
    ['break-wand', PARANOID_BREAKWAND],
    ['were-change', PARANOID_WERECHANGE],
    ['werechange', PARANOID_WERECHANGE],
    ['eat', PARANOID_EATING], ['continue', PARANOID_EATING],
    ['swim', PARANOID_SWIM], ['trap', PARANOID_TRAP],
    ['autoall', PARANOID_AUTOALL],
]);
function updateParanoiaBits(current, rawValue) {
    const value = rawValue.trim();
    let bits = current;
    let mode = 'replace';
    let fields = value;
    if (fields.startsWith('+') || fields.startsWith('-')) {
        mode = fields[0] === '+' ? 'add' : 'remove';
        fields = fields.slice(1).trim();
    }
    else {
        bits = 0;
    }
    for (let field of fields.split(/\s+/)) {
        if (!field)
            continue;
        let remove = mode === 'remove';
        if (field.startsWith('!')) {
            field = field.slice(1);
            if (mode !== 'remove')
                remove = true;
        }
        const name = field.toLowerCase();
        if (name === 'none') {
            if (mode === 'replace')
                bits = 0;
            continue;
        }
        if (name === 'all') {
            const all = [...new Set(PARANOIA_OPTION_BITS.values())]
                .reduce((mask, bit) => mask | bit, 0);
            bits = remove ? bits & ~all : bits | all;
            continue;
        }
        const bit = PARANOIA_OPTION_BITS.get(name);
        if (bit !== undefined)
            bits = remove ? bits & ~bit : bits | bit;
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
function booleanOption(value, negated) {
    if (!value)
        return !negated;
    if (negated)
        return null;
    const text = value.toLowerCase();
    if ('true'.startsWith(text) || 'yes'.startsWith(text) || text === 'on'
        || (/^\d/.test(text) && parseInt(text, 10) === 1))
        return true;
    if ('false'.startsWith(text) || 'no'.startsWith(text) || text === 'off'
        || (/^\d/.test(text) && parseInt(text, 10) === 0))
        return false;
    return null;
}
function setNumberPadOption(value, settings) {
    if (!settings.commandBindings.setNumberPad(value))
        return;
    settings.iflags.num_pad = value > 0;
    settings.iflags.num_pad_mode = value === -1 ? 1 : value > 0 ? value - 1 : 0;
}
// C optfn_scores(): an explicit value replaces all three display choices.
function parseScoreOption(value, negated) {
    if (!value)
        return null;
    const choices = { end_top: 0, end_around: 0, end_own: false };
    let rest = negated ? '' : value.toLowerCase();
    while (rest) {
        const disabled = rest.startsWith('!') || rest.startsWith('no');
        if (disabled)
            rest = rest.startsWith('!') ? rest.slice(1)
                : rest.slice(rest[2] === '-' ? 3 : 2);
        const digits = rest.match(/^\d+/)?.[0];
        const count = digits ? Number(digits) : 1;
        if (digits)
            rest = rest.slice(digits.length);
        rest = rest.replace(/^ +/, '');
        if (rest[0] === 't')
            choices.end_top = disabled ? 0 : count;
        else if (rest[0] === 'a')
            choices.end_around = disabled ? 0 : count;
        else if (rest[0] === 'o')
            choices.end_own = !disabled && count !== 0;
        else if (rest[0] === 'n') {
            choices.end_top = choices.end_around = 0;
            choices.end_own = false;
        }
        else
            break;
        rest = rest.replace(/^[a-z]+ */, '');
        if (rest.startsWith('/'))
            rest = rest.slice(1).replace(/^ +/, '');
    }
    return choices;
}
export function parseNethackrc(rc) {
    const result = {
        name: '', role: null, race: null, gender: null, align: null,
        flags: { paranoia_bits: DEFAULT_PARANOIA_BITS }, iflags: {}, commandBindings: new CommandBindings(),
    };
    parseConfiguration(rc, result);
    result.commandBindings.finishConfiguration();
    return result;
}
export function applyNethackrc(rc, state = game) {
    const result = {
        flags: state.flags, iflags: state.iflags,
        commandBindings: state.commandBindings,
    };
    parseConfiguration(rc, result);
    if (result.monTelecontrol !== undefined)
        state._monTelecontrol = result.monTelecontrol;
    if (result.fruit !== undefined)
        state.fruitName = result.fruit;
    return result;
}
// parse_config_line() always parses OPTIONS in initial/config-file mode,
// including Lua fragments. Only full startup performs final reconciliation.
function parseConfiguration(rc, result) {
    let paranoiaBits = result.flags.paranoia_bits ?? DEFAULT_PARANOIA_BITS;
    let paranoiaSeen = false;
    if (!rc)
        return result;
    for (const rawLine of rc.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#'))
            continue;
        const bindMatch = line.match(/^(?:BIND|BINDINGS)=(.+)$/i);
        if (bindMatch?.[1]) {
            for (const field of bindingFields(bindMatch[1])) {
                const separator = field.indexOf(':');
                if (separator < 0)
                    continue;
                const code = bindingKeyCode(field.slice(0, separator));
                const command = field.slice(separator + 1).trim();
                if (code && command && !result.commandBindings.bindSpecialKey(code, command))
                    result.commandBindings.bindKey(code, command);
            }
            continue;
        }
        const optMatch = line.match(/^OPTIONS=(.+)/i);
        if (!optMatch?.[1])
            continue;
        for (const opt of optMatch[1].split(',').reverse()) {
            const trimmed = opt.trim();
            if (!trimmed)
                continue;
            const negated = trimmed.startsWith('!');
            const stripped = negated ? trimmed.slice(1) : trimmed;
            const colonIdx = stripped.indexOf(':');
            const bindingOption = (colonIdx < 0 ? stripped : stripped.slice(0, colonIdx)).trim().toLowerCase();
            const optionValue = colonIdx < 0 ? null : stripped.slice(colonIdx + 1).trim();
            if (bindingOption === 'number_pad') {
                if (optionValue && negated)
                    continue;
                const value = optionValue ? parseInt(optionValue, 10) || 0 : negated ? 0 : 1;
                if (optionValue && value === 0 && optionValue[0] !== '0')
                    continue;
                setNumberPadOption(value, result);
                continue;
            }
            if (bindingOption === 'menustyle') {
                const initial = optionValue?.[0]?.toLowerCase() ?? (negated ? 'n' : null);
                const style = menuStyleForInitial(initial);
                if (style !== undefined)
                    result.flags.menu_style = style;
                continue;
            }
            if (bindingOption === 'packorder') {
                if (optionValue !== null)
                    changeInventoryOrder(optionValue, result);
                continue;
            }
            if (bindingOption === 'sortloot') {
                const mode = optionValue?.[0]?.toLowerCase();
                if (isLootSortMode(mode))
                    result.flags.sortloot = mode;
                continue;
            }
            if (bindingOption === 'altmeta' || bindingOption === 'toptenwin' || bindingOption === 'menu_tab_sep') {
                const value = booleanOption(optionValue, negated);
                if (value !== null)
                    result.iflags[bindingOption] = value;
                continue;
            }
            if (bindingOption === 'scores') {
                const choices = parseScoreOption(optionValue, negated);
                if (choices) {
                    result.flags.end_top = choices.end_top;
                    result.flags.end_around = choices.end_around;
                    result.flags.end_own = choices.end_own;
                }
                continue;
            }
            if (bindingOption === 'fruit') {
                if (negated && optionValue !== null)
                    continue;
                if (negated || optionValue)
                    result.fruit = normalizePreferredFruitName(negated ? '' : optionValue ?? '', result);
                continue;
            }
            if (bindingOption === 'rest_on_space') {
                const value = booleanOption(optionValue, negated);
                if (value !== null) {
                    result.flags.rest_on_space = value;
                    result.commandBindings.setRestOnSpace(value, { initial: true });
                }
                continue;
            }
            if (colonIdx >= 0) {
                const key = stripped.slice(0, colonIdx).trim().toLowerCase();
                const val = stripped.slice(colonIdx + 1).trim();
                if (key === 'name')
                    result.name = val;
                else if (key === 'role')
                    result.role = val;
                else if (key === 'race')
                    result.race = val;
                else if (key === 'gender')
                    result.gender = val;
                else if (key === 'align')
                    result.align = val;
                else if (key === 'playmode' && val === 'debug')
                    result.flags.debug = true;
                else if (key === 'playmode' && val === 'explore')
                    result.flags.explore = true;
                else if (key === 'pettype' || key === 'pet') {
                    result.flags.pettype = val;
                    if (val === 'none' || val === 'n')
                        result.preferred_pet = 'n';
                    else if (val === 'dog' || val === 'd')
                        result.preferred_pet = 'd';
                    else if (val === 'cat' || val === 'c')
                        result.preferred_pet = 'c';
                }
                else if (key === 'symset')
                    result.symset = val;
                else if (key === 'suppress_alert')
                    result.flags.suppress_alert = val;
                else if (key === 'msg_window')
                    result.iflags.prevmsg_window = val;
                else if (key === 'paranoid_confirmation'
                    || key === 'paranoid_confirm') {
                    paranoiaBits = updateParanoiaBits(paranoiaBits, val);
                    paranoiaSeen = true;
                    result.flags.paranoia_bits = paranoiaBits;
                }
                else if (key === 'autounlock')
                    result.flags.autounlock = val;
                else if (key === 'disclose')
                    result.flags.disclose = val;
                else if (key === 'pickup_burden')
                    result.flags.pickup_burden = val;
                else if (key === 'pickup_types')
                    result.flags.pickup_types = val;
                else if (key === 'pile_limit')
                    result.flags.pile_limit = val;
                else if (key === 'runmode')
                    result.flags.runmode = val;
                else {
                    const option = requestBooleanByName.get(key);
                    const value = booleanOption(val, negated);
                    if (option && value !== null)
                        setConfigurationBoolean(result, option, value);
                }
            }
            else {
                const lname = stripped.toLowerCase();
                const value = !negated;
                if (lname === 'autopickup' || lname === 'pickup')
                    result.flags.pickup = value;
                else if (lname === 'color')
                    result.flags.color = value;
                else if (lname === 'legacy')
                    result.flags.legacy = value;
                else if (lname === 'pauper') {
                    result.flags.pauper = value;
                    // options.c applies this implication immediately, so a
                    // later explicit !nudist may still override it.
                    if (value)
                        result.flags.nudist = true;
                }
                else if (lname === 'nudist')
                    result.flags.nudist = value;
                else if (lname === 'blind' || lname === 'permablind')
                    result.flags.blind = value;
                else if (lname === 'deaf' || lname === 'permadeaf')
                    result.flags.deaf = value;
                else if (lname === 'tutorial') {
                    result.flags.tutorial = value;
                    result.tutorial_set = true;
                }
                else if (lname === 'splash_screen')
                    result.iflags.wc_splash_screen = value;
                else if (lname === 'wizmgender' || lname === 'wizweight')
                    result.iflags[lname] = value;
                else if (lname === 'montelecontrol')
                    result.monTelecontrol = value;
                else if (lname === 'pushweapon')
                    result.flags.pushweapon = value;
                else if (lname === 'showexp')
                    result.flags.showexp = value;
                else if (lname === 'time')
                    result.flags.time = value;
                else if (lname === 'verbose')
                    result.flags.verbose = value;
                else if ((lname === 'paranoid_confirmation'
                    || lname === 'paranoid_confirm') && negated) {
                    paranoiaBits = 0;
                    paranoiaSeen = true;
                    result.flags.paranoia_bits = paranoiaBits;
                }
                else {
                    const option = requestBooleanByName.get(lname);
                    if (option)
                        setConfigurationBoolean(result, option, value);
                    else if (lname === 'bones')
                        result.flags.bones = value;
                    else if (lname === 'reroll')
                        result.flags.reroll = value;
                    else if (lname === 'female')
                        result.flags.female = value;
                    else if (lname === 'safe_dog')
                        result.flags.safe_dog = value;
                    else if (lname === 'male')
                        result.flags.female = !value;
                    else if (lname === 'autounlock')
                        result.flags.autounlock = value;
                }
            }
        }
    }
    if (paranoiaSeen)
        result.flags.paranoia_bits = paranoiaBits;
    return result;
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
    await flushPendingTopline();
    const key = await showChoiceWindow({
        title: 'Select number_pad mode:',
        entries: NUMBER_PAD_CHOICES.map((text, index) => ({
            key: String.fromCharCode(97 + index), text,
        })),
        validKeys: [...'abcdef012345'].map(key => key.charCodeAt(0)).concat([27, 32, 10, 13]),
        restoreUnderlay: true,
    });
    const index = key >= 97 && key <= 102 ? key - 97 : key >= 48 && key <= 53 ? key - 48 : -1;
    if (index >= 0)
        setNumberPadOption(index === 5 ? -1 : index, game);
}
function putOptionsLine(col, row, text, attr = 0) {
    const display = game.nhDisplay;
    if (!display)
        return;
    for (let index = 0; index < text.length && col + index < display.cols; index++) {
        display.setCell(col + index, row, text.charAt(index), NO_COLOR, attr);
    }
}
function renderOptionsPage(page) {
    const display = game.nhDisplay;
    if (!display)
        return;
    display.clearScreen();
    const flags = game.flags;
    const mark = (value) => value ? 'X' : ' ';
    if (page === 1) {
        putOptionsLine(1, 0, 'Options', ATR_INVERSE);
        putOptionsLine(1, 2, '? - show help');
        putOptionsLine(1, 4, ' General', ATR_INVERSE);
        putOptionsLine(1, 5, `a - fruit                   [${game.fruitName}]`);
        putOptionsLine(1, 6, `b - number_pad              [${numberPadDescription()}]`);
        putOptionsLine(1, 7, 'c - price_quotes            [ ]');
        putOptionsLine(1, 9, ' Behavior', ATR_INVERSE);
        putOptionsLine(1, 10, `d - autodig                 [${mark(flags.autodig)}]`);
        putOptionsLine(1, 11, `e - autoopen                [${mark(flags.autoopen)}]`);
        putOptionsLine(1, 12, `f - autopickup              [${mark(flags.pickup)}]`);
        putOptionsLine(1, 13, 'g - autopickup exceptions   [(0 currently set)]');
        putOptionsLine(1, 14, 'h - autoquiver              [ ]');
        putOptionsLine(1, 15, 'i - autounlock              [apply-key]');
        putOptionsLine(1, 16, `j - cmdassist               [${mark(flags.cmdassist ?? true)}]`);
        putOptionsLine(1, 17, 'k - dropped_nopick          [X]  (for autopickup)');
        putOptionsLine(1, 18, 'l - fireassist              [X]');
        putOptionsLine(1, 19, 'm - pickup_stolen           [X]  (for autopickup)');
        putOptionsLine(1, 20, 'n - pickup_thrown           [X]  (for autopickup)');
        putOptionsLine(1, 21, `o - pickup_types            [${flags.pickup_types || 'all'}]  (for autopickup)`);
        putOptionsLine(1, 22, `p - pushweapon              [${mark(flags.pushweapon)}]`);
        putOptionsLine(1, 23, '(1 of 2)');
        display.setCursor(9, 23);
        return;
    }
    putOptionsLine(1, 1, ' Map', ATR_INVERSE);
    putOptionsLine(1, 2, 'a - bgcolors                [X]');
    putOptionsLine(1, 3, 'b - color                   [X]');
    putOptionsLine(1, 4, 'c - customcolors            [X]');
    putOptionsLine(1, 5, 'd - customsymbols           [X]');
    putOptionsLine(1, 6, `e - hilite_pet              [${mark(flags.hilite_pet)}]`);
    putOptionsLine(1, 7, `f - hilite_pile             [${mark(flags.hilite_pile)}]`);
    putOptionsLine(1, 8, 'g - showrace                [ ]');
    putOptionsLine(1, 9, 'h - sparkle                 [X]');
    putOptionsLine(1, 10, 'i - symset                  [DECgraphics, active, handler=DEC]');
    putOptionsLine(1, 12, ' Status', ATR_INVERSE);
    putOptionsLine(1, 13, 'j - hitpointbar             [ ]');
    putOptionsLine(1, 14, 'k - menu colors             [(0 currently set)]');
    putOptionsLine(1, 15, `l - showexp                 [${mark(flags.showexp)}]`);
    putOptionsLine(1, 16, 'm - status condition fields [(16 currently set)]');
    putOptionsLine(1, 17, 'n - status highlight rules  [(0 currently set)]');
    putOptionsLine(1, 18, 'o - statuslines             [2]');
    putOptionsLine(1, 19, `p - time                    [${mark(flags.time)}]`);
    putOptionsLine(1, 20, '(2 of 2)');
    display.setCursor(9, 20);
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
    ['autoquiver', 'autoquiver', false],
    ['checkpoint', 'checkpoint', true],
    ['cmdassist', 'cmdassist', true],
    ['color', 'color', true],
    ['confirm', 'confirm', true],
    ['customcolors', 'customcolors', true],
    ['customsymbols', 'customsymbols', true],
    ['dark_room', 'dark_room', true],
    ['dropped_nopick', 'dropped_nopick', true],
    ['eight_bit_tty', 'eight_bit_tty', false],
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
    ['safe_pet', 'safe_pet', true],
    ['safe_wait', 'safe_wait', true],
    ['showdamage', 'showdamage', false],
    ['showexp', 'showexp', false],
    ['showrace', 'showrace', false],
    ['showvers', 'showvers', false],
    ['silent', 'silent', true],
    ['sortpack', 'sortpack', true],
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
    ['whatis_menu', 'whatis_menu', false],
    ['whatis_moveskip', 'whatis_moveskip', false],
];
const requestBooleanByName = new Map(REQUEST_MENU_BOOLEAN_OPTIONS.map(option => [option[0].toLowerCase(), option]));
function requestBooleanValue(name) {
    const option = requestBooleanByName.get(name.toLowerCase());
    if (!option)
        return false;
    const [, property, fallback] = option;
    if (property === '_monTelecontrol')
        return game._monTelecontrol ?? fallback;
    if (property === 'altmeta' || property === 'toptenwin' || property === 'menu_tab_sep')
        return game.iflags[property] ?? fallback;
    return game.flags[property] ?? fallback;
}
function setConfigurationBoolean(settings, option, value) {
    const [, property] = option;
    if (property === '_monTelecontrol')
        settings.monTelecontrol = value;
    else if (property === 'altmeta' || property === 'toptenwin' || property === 'menu_tab_sep')
        settings.iflags[property] = value;
    else
        settings.flags[property] = value;
}
function setRequestBoolean(option, value) {
    const [, property] = option;
    if (property === '_monTelecontrol')
        game._monTelecontrol = value;
    else if (property === 'altmeta' || property === 'toptenwin' || property === 'menu_tab_sep')
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
function requestMenuSections() {
    const { role, race, gender, alignment } = requestMenuIdentity();
    const choice = (name, text) => ({ value: name, text });
    const label = (text) => ({ selectable: false, text });
    const readonly = (name, value) => label(`    ${name.padEnd(24)}[${value}]`);
    const boolean = (name) => choice(name, `${name.padEnd(24)}[${requestBooleanValue(name) ? 'true' : 'false'}]`);
    return [
        { heading: 'Booleans (selecting will toggle value):', items: [
                readonly('blind', !!game.u?.uroleplay?.blind),
                readonly('bones', true),
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
                choice('bgcolors', 'bgcolors                [on]'),
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
                choice('sounds', 'sounds                  [off]'),
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
                readonly('playmode', 'normal'),
                readonly('name', game.plname),
                readonly('role', role),
                readonly('race', race),
                readonly('gender', gender),
                readonly('alignment', alignment),
                readonly('catname', '(none)'),
                readonly('dogname', '(none)'),
                readonly('horsename', '(none)'),
                readonly('msghistory', '20'),
                readonly('pettype', 'random'),
                readonly('soundlib', 'nosound'),
                choice('autounlock', 'autounlock              [apply-key]'),
                choice('boulder', 'boulder                 [`]'),
                choice('crash_email', 'crash_email             [unknown]'),
                choice('crash_name', 'crash_name              [unknown]'),
                choice('crash_urlmax', 'crash_urlmax            [-1]'),
                choice('disclose', 'disclose                [ni na nv ng nc no]'),
                choice('fruit', `fruit                   [${game.fruitName}]`),
                choice('glyph', 'glyph                   [(to be done)]'),
                choice('hilite_status', 'hilite_status           [(none)]'),
                choice('menu_headings', 'menu_headings           [no-color&inverse]'),
                choice('menu_objsyms', 'menu_objsyms            [conditional]'),
                choice('menuinvertmode', 'menuinvertmode          [1]'),
                choice('menustyle', `menustyle               [${MENU_STYLES[game.flags.menu_style ?? MENU_FULL][0]}]`),
                choice('msg_window', 'msg_window              [single]'),
                choice('number_pad', `number_pad              [${numberPadDescription()}]`),
                choice('packorder', `packorder               [${inventoryOrderSymbols()}]`),
                choice('paranoid_confirmation', 'paranoid_confirmation   [pray trap swim]'),
                choice('petattr', 'petattr                 [inverse]'),
                choice('pickup_burden', 'pickup_burden           [stressed]'),
                choice('pickup_types', `pickup_types            [${game.flags?.pickup_types || 'all'}]`),
                choice('pile_limit', 'pile_limit              [5]'),
                choice('roguesymset', 'roguesymset             [default]'),
                choice('runmode', 'runmode                 [run]'),
                choice('scores', `scores                  [${scoreDisplayDescription()}]`),
                choice('sortdiscoveries', 'sortdiscoveries         [by order of discovery within each class]'),
                choice('sortloot', `sortloot                [${SORT_LOOT_NAMES[game.flags.sortloot ?? 'l']}]`),
                choice('sortvanquished', 'sortvanquished          [t: traditional: by monster level]'),
                choice('statushilites', "statushilites           [0 (off: don't highlight status fields)]"),
                choice('statuslines', 'statuslines             [2]'),
                choice('suppress_alert', 'suppress_alert          [(none)]'),
                choice('symset', `symset                  [${game.symset || 'default'}, active, handler=DEC]`),
                choice('versinfo', 'versinfo                [1: number (5.0.0)]'),
                choice('whatis_coord', 'whatis_coord            [none]'),
                choice('whatis_filter', 'whatis_filter           [none]'),
                label(''),
            ] },
        { heading: 'Other settings:', items: [
                choice('autocompletions', 'autocompletions         [(0 currently set)]'),
                choice('autopickup_exceptions', 'autopickup exceptions   [(0 currently set)]'),
                choice('bind_keys', 'bind keys               [(0 currently set)]'),
                choice('menu_colors', 'menu colors             [(0 currently set)]'),
                choice('message_types', 'message types           [(0 currently set)]'),
                choice('status_conditions', 'status condition fields [(16 currently set)]'),
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
function renderPickupTypes(selected) {
    const display = game.nhDisplay;
    if (!display)
        return;
    const help = game.flags?.pickup
        ? "Toggle off 'autopickup' to not pick up anything."
        : "Toggle on 'autopickup' to automatically pick these things up.";
    const content = [
        'Autopickup what?',
        ...PICKUP_TYPE_ROWS.map(([letter, symbol, description]) => `${letter} ${selected.has(symbol) ? '+' : '-'} ${symbol}  ${description}`),
        'A -    All classes of objects',
        'Note: when no choices are selected, "all" is implied.',
        help,
        '(end)',
    ];
    const widest = Math.max(...content.map(line => line.length));
    const left = Math.max(11, display.cols - widest - 2);
    for (let row = 0; row <= 21; row++) {
        for (let col = left - 1; col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
    }
    putOptionsLine(left, 0, 'Autopickup what?', ATR_INVERSE);
    for (const [index, [letter, symbol, description]] of PICKUP_TYPE_ROWS.entries()) {
        putOptionsLine(left, index + 2, `${letter} ${selected.has(symbol) ? '+' : '-'} ${symbol}  ${description}`);
    }
    putOptionsLine(left, 18, 'A -    All classes of objects');
    putOptionsLine(left, 19, 'Note: when no choices are selected, "all" is implied.');
    putOptionsLine(left, 20, help);
    putOptionsLine(left, 21, '(end)');
    display.setCursor(left + 6, 21);
}
async function editPickupTypes(preserveStatus = false) {
    const selected = new Set(game.flags?.pickup_types || '');
    // tty_display_nhwindow(NHW_MENU) pages unread prose, then clears the
    // entire message window before painting the menu's corner rectangle.
    if (!game._suppressMessagesUntilInput)
        await flushPendingTopline();
    clearMessageWindow();
    await flush_screen(1);
    const underlay = snapshotMenuUnderlay();
    if (!preserveStatus) {
        game.nhDisplay?.clearRow(22);
        game.nhDisplay?.clearRow(23);
    }
    for (;;) {
        renderPickupTypes(selected);
        const key = await nhgetch();
        if (key === 27 || key === 10 || key === 13)
            break;
        const input = String.fromCharCode(key);
        if (input === 'A') {
            if (selected.size === PICKUP_TYPE_ROWS.length)
                selected.clear();
            else
                for (const [, symbol] of PICKUP_TYPE_ROWS)
                    selected.add(symbol);
            continue;
        }
        const row = PICKUP_TYPE_ROWS.find(([letter, symbol]) => input === letter || input === symbol);
        if (!row)
            continue;
        if (selected.has(row[1]))
            selected.delete(row[1]);
        else
            selected.add(row[1]);
    }
    game.flags.pickup_types = PICKUP_TYPE_ROWS
        .map(([, symbol]) => symbol)
        .filter(symbol => selected.has(symbol))
        .join('');
    restoreMenuUnderlay(underlay);
}
// C options.c:optfn_bool(), followed by reset_needed_visuals(). Status-only
// changes need bot(); map-affecting changes defer the full docrt until all
// selected options and their compound handlers have finished.
function applyBooleanVisualChange(name) {
    if (name === 'dark_room' || name === 'lit_corridor') {
        vision_recalc(2);
        game.vision_full_recalc = 1;
        return requestBooleanValue('color');
    }
    return ['color', 'customcolors', 'hilite_pet', 'hilite_pile',
        'hitpointbar', 'showrace', 'use_inverse'].includes(name);
}
async function doRequestMenuOptions() {
    await flushPendingTopline();
    const underlay = snapshotMenuUnderlay();
    const selected = new Set(await showMultiSelectWindow({
        title: 'Set what options?',
        pageLocalKeys: true,
        introLines: [
            "    For a brief explanation of how this works, type '?' to select",
            '    the next menu choice, then press <enter> or <return>.',
            '? - view help for options menu',
            "    [To suppress this menu help, toggle off the 'cmdassist' option.]",
            '',
        ],
        sections: requestMenuSections(),
    }));
    restoreMenuUnderlay(underlay);
    let needsRedraw = false;
    for (const option of REQUEST_MENU_BOOLEAN_OPTIONS) {
        const [name] = option;
        if (!selected.has(name))
            continue;
        const value = !requestBooleanValue(name);
        setRequestBoolean(option, value);
        if (name === 'rest_on_space')
            game.commandBindings.setRestOnSpace(value);
        needsRedraw = applyBooleanVisualChange(name) || needsRedraw;
        // optfn_bool() commits the value before its ordinary pline. The
        // shared tty owner handles overflow and any later menu acknowledgment.
        await plineWithContinuation(`'${name}' option toggled ${value ? 'on' : 'off'}.`);
    }
    if (selected.has('number_pad'))
        await editNumberPad();
    if (selected.has('menustyle'))
        await editMenuStyle();
    if (selected.has('fruit'))
        await editFruitOption();
    if (selected.has('packorder')) {
        const order = await getLine('Set packorder to what?', (_character, key) => key >= 32 && key < 127);
        if (order !== null && order.length)
            changeInventoryOrder(order);
    }
    if (selected.has('pickup_types'))
        await editPickupTypes(true);
    if (selected.has('sortloot'))
        await editSortLoot();
    if (needsRedraw)
        await docrt();
    await bot();
    game.context.move = 0;
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
async function editFruitOption() {
    await cls();
    const name = await getLine('Set fruit to what?', (_ch, code) => code >= 32 && code < 127, { suppressStatus: true });
    if (!name)
        return;
    const result = changePreferredFruit(name);
    // Native suppresses ordinary option-confirmation prose inside doset.
    if (!result.changed) {
        await plineWithContinuation(result.message);
        await flushPendingTopline();
    }
}
// C refs: options.c doset()/special_handling() and tty's PICK_ANY menu.
// Option keys redraw page one. Space advances to page two, then closes it.
// The pickup-types editor reads its own keys before returning here.
export async function doOptions(menuRequested = false) {
    if (menuRequested) {
        await doRequestMenuOptions();
        return;
    }
    const flags = game.flags;
    if (!game._optionsInitialized) {
        // Set missing defaults once. Opening the menu must not reset a value
        // the player already changed.
        flags.autoopen = flags.autoopen ?? true;
        flags.pickup = flags.pickup ?? false;
        flags.hilite_pet = flags.hilite_pet ?? false;
        flags.hilite_pile = flags.hilite_pile ?? false;
        game._optionsInitialized = true;
    }
    let page = 1;
    for (;;) {
        renderOptionsPage(page);
        const key = await nhgetch();
        if (key === 27 || key === 10 || key === 13)
            break;
        const input = String.fromCharCode(key);
        if (input === ' ') {
            if (page === 1) {
                page = 2;
                continue;
            }
            break;
        }
        if (input === '>' && page === 1) {
            page = 2;
            continue;
        }
        if (input === '<' && page === 2) {
            page = 1;
            continue;
        }
        if (page === 1 && input === 'a') {
            await editFruitOption();
        }
        else if (page === 1 && input === 'b') {
            await editNumberPad();
        }
        else if (page === 1 && input === 'd') {
            flags.autodig = !flags.autodig;
        }
        else if (page === 1 && input === 'o') {
            await editPickupTypes();
        }
        else if (page === 1 && input === 'e') {
            flags.autoopen = !flags.autoopen;
        }
        else if (page === 1 && input === 'f') {
            flags.pickup = !flags.pickup;
        }
        else if (page === 1 && input === 'j') {
            flags.cmdassist = !(flags.cmdassist ?? true);
        }
        else if (page === 1 && input === 'p') {
            flags.pushweapon = !flags.pushweapon;
        }
        else if (page === 2 && input === 'e') {
            flags.hilite_pet = !flags.hilite_pet;
        }
        else if (page === 2 && input === 'f') {
            flags.hilite_pile = !flags.hilite_pile;
        }
        else if (page === 2 && input === 'l') {
            flags.showexp = !flags.showexp;
        }
        else if (page === 2 && input === 'p') {
            flags.time = !flags.time;
        }
        else {
            continue;
        }
        page = 1;
    }
    game._pending_message = '';
    await docrt();
    await bot();
    game.context.move = 0;
}
//# sourceMappingURL=options.js.map