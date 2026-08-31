// options.js — Parse .nethackrc options.
// C ref: options.c — handles OPTIONS=, BIND=, etc.

import { game } from './gstate.js';
import { bot, cls, docrt, flush_screen } from './display.js';
import { nhgetch } from './input.js';
import { getLine } from './query.js';
import { NO_COLOR } from './terminal.js';
import { promptKey } from './tty_prompts.js';
import { ATR_INVERSE } from './windows.js';
import {
    PARANOID_AUTOALL, PARANOID_BONES, PARANOID_BREAKWAND, PARANOID_CONFIRM,
    PARANOID_DIE, PARANOID_EATING, PARANOID_HIT, PARANOID_PRAY,
    PARANOID_QUIT, PARANOID_REMOVE, PARANOID_SWIM, PARANOID_TRAP,
    PARANOID_WERECHANGE,
} from './const.js';

const DEFAULT_PARANOIA_BITS = PARANOID_PRAY | PARANOID_SWIM | PARANOID_TRAP;
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
    } else {
        bits = 0;
    }
    for (let field of fields.split(/\s+/)) {
        if (!field) continue;
        let remove = mode === 'remove';
        if (field.startsWith('!')) {
            field = field.slice(1);
            if (mode !== 'remove') remove = true;
        }
        const name = field.toLowerCase();
        if (name === 'none') {
            if (mode === 'replace') bits = 0;
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

function splitBindingList(value) {
    const fields = [];
    let current = '';
    let quote = null;
    let escaped = false;
    for (const ch of value) {
        if (escaped) {
            current += ch;
            escaped = false;
        } else if (ch === '\\') {
            current += ch;
            escaped = true;
        } else if (quote) {
            current += ch;
            if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
            current += ch;
            quote = ch;
        } else if (ch === ',') {
            fields.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    fields.push(current);
    return fields;
}

function bindingKeyCode(value) {
    let key = value.trim();
    if ((key.startsWith("'") && key.endsWith("'"))
        || (key.startsWith('"') && key.endsWith('"'))) {
        key = key.slice(1, -1);
    }
    if (/^\\.$/.test(key)) key = key.slice(1);
    if (key.length === 1) return key.charCodeAt(0);
    if (/^\^.$/.test(key))
        return key[1].toUpperCase().charCodeAt(0) & 0x1f;
    const control = key.match(/^(?:C|CTRL)-(.)$/i);
    if (control)
        return control[1].toUpperCase().charCodeAt(0) & 0x1f;
    const meta = key.match(/^(?:M|META)-(.)$/i);
    if (meta) return meta[1].charCodeAt(0) | 0x80;
    const named = {
        space: 32, esc: 27, escape: 27, enter: 13, return: 13,
        tab: 9, backspace: 8, delete: 127,
    }[key.toLowerCase()];
    return named ?? null;
}

export function parseNethackrc(rc) {
    const result = {
        name: '', role: null, race: null, gender: null, align: null,
        flags: {}, iflags: {}, bindings: {},
    };
    let paranoiaBits = DEFAULT_PARANOIA_BITS;
    let paranoiaSeen = false;
    if (!rc) return result;

    for (const rawLine of rc.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const bindMatch = line.match(/^(?:BIND|BINDINGS)=(.+)$/i);
        if (bindMatch) {
            for (const field of splitBindingList(bindMatch[1])) {
                const separator = field.indexOf(':');
                if (separator < 0) continue;
                const code = bindingKeyCode(field.slice(0, separator));
                const command = field.slice(separator + 1).trim().toLowerCase();
                if (code !== null && command)
                    result.bindings[code] = command;
            }
            continue;
        }

        const optMatch = line.match(/^OPTIONS=(.+)/i);
        if (!optMatch) continue;

        for (const opt of optMatch[1].split(',')) {
            const trimmed = opt.trim();
            if (!trimmed) continue;

            const negated = trimmed.startsWith('!');
            const stripped = negated ? trimmed.slice(1) : trimmed;

            const colonIdx = stripped.indexOf(':');
            if (colonIdx >= 0) {
                const key = stripped.slice(0, colonIdx).trim().toLowerCase();
                const val = stripped.slice(colonIdx + 1).trim();

                if (key === 'name') result.name = val;
                else if (key === 'role') result.role = val;
                else if (key === 'race') result.race = val;
                else if (key === 'gender') result.gender = val;
                else if (key === 'align') result.align = val;
                else if (key === 'playmode' && val === 'debug') result.flags.debug = true;
                else if (key === 'playmode' && val === 'explore') result.flags.explore = true;
                else if (key === 'pettype' || key === 'pet') {
                    result.flags.pettype = val;
                    if (val === 'none' || val === 'n') result.preferred_pet = 'n';
                    else if (val === 'dog' || val === 'd') result.preferred_pet = 'd';
                    else if (val === 'cat' || val === 'c') result.preferred_pet = 'c';
                }
                else if (key === 'symset') result.symset = val;
                else if (key === 'suppress_alert') result.flags.suppress_alert = val;
                else if (key === 'msg_window') result.iflags.prevmsg_window = val;
                else if (key === 'paranoid_confirmation'
                    || key === 'paranoid_confirm') {
                    paranoiaBits = updateParanoiaBits(paranoiaBits, val);
                    paranoiaSeen = true;
                    result.flags.paranoia_bits = paranoiaBits;
                }
                else result.flags[key] = val;
            } else {
                const lname = stripped.toLowerCase();
                const value = !negated;

                if (lname === 'autopickup') result.flags.pickup = value;
                else if (lname === 'color') result.flags.color = value;
                else if (lname === 'legacy') result.flags.legacy = value;
                else if (lname === 'pauper') {
                    result.flags.pauper = value;
                    // options.c applies this implication immediately, so a
                    // later explicit !nudist may still override it.
                    if (value) result.flags.nudist = true;
                }
                else if (lname === 'nudist') result.flags.nudist = value;
                else if (lname === 'blind' || lname === 'permablind')
                    result.flags.blind = value;
                else if (lname === 'deaf' || lname === 'permadeaf')
                    result.flags.deaf = value;
                else if (lname === 'tutorial') { result.flags.tutorial = value; result.tutorial_set = true; }
                else if (lname === 'splash_screen') result.iflags.wc_splash_screen = value;
                else if (lname === 'pushweapon') result.flags.pushweapon = value;
                else if (lname === 'showexp') result.flags.showexp = value;
                else if (lname === 'time') result.flags.time = value;
                else if (lname === 'verbose') result.flags.verbose = value;
                else if ((lname === 'paranoid_confirmation'
                    || lname === 'paranoid_confirm') && negated) {
                    paranoiaBits = 0;
                    paranoiaSeen = true;
                    result.flags.paranoia_bits = paranoiaBits;
                }
                else result.flags[lname] = value;
            }
        }
    }
    if (paranoiaSeen) result.flags.paranoia_bits = paranoiaBits;
    return result;
}

function putOptionsLine(col, row, text, attr = 0) {
    const display = game.nhDisplay;
    if (!display) return;
    for (let index = 0; index < text.length && col + index < display.cols;
        index++) {
        display.setCell(col + index, row, text[index], NO_COLOR, attr);
    }
}

function renderOptionsPage(page) {
    const display = game.nhDisplay;
    if (!display) return;
    display.clearScreen();
    const flags = game.flags || (game.flags = {});
    const mark = value => value ? 'X' : ' ';
    if (page === 1) {
        putOptionsLine(1, 0, 'Options', ATR_INVERSE);
        putOptionsLine(1, 2, '? - show help');
        putOptionsLine(1, 4, ' General', ATR_INVERSE);
        putOptionsLine(1, 5,
            `a - fruit                   [${game.fruitName || 'slime mold'}]`);
        putOptionsLine(1, 6, 'b - number_pad              [0=off]');
        putOptionsLine(1, 7, 'c - price_quotes            [ ]');
        putOptionsLine(1, 9, ' Behavior', ATR_INVERSE);
        putOptionsLine(1, 10,
            `d - autodig                 [${mark(flags.autodig)}]`);
        putOptionsLine(1, 11,
            `e - autoopen                [${mark(flags.autoopen)}]`);
        putOptionsLine(1, 12,
            `f - autopickup              [${mark(flags.pickup)}]`);
        putOptionsLine(1, 13,
            'g - autopickup exceptions   [(0 currently set)]');
        putOptionsLine(1, 14, 'h - autoquiver              [ ]');
        putOptionsLine(1, 15, 'i - autounlock              [apply-key]');
        putOptionsLine(1, 16,
            `j - cmdassist               [${mark(flags.cmdassist ?? true)}]`);
        putOptionsLine(1, 17,
            'k - dropped_nopick          [X]  (for autopickup)');
        putOptionsLine(1, 18, 'l - fireassist              [X]');
        putOptionsLine(1, 19,
            'm - pickup_stolen           [X]  (for autopickup)');
        putOptionsLine(1, 20,
            'n - pickup_thrown           [X]  (for autopickup)');
        putOptionsLine(1, 21,
            `o - pickup_types            [${flags.pickup_types || 'all'}]  (for autopickup)`);
        putOptionsLine(1, 22,
            `p - pushweapon              [${mark(flags.pushweapon)}]`);
        putOptionsLine(1, 23, '(1 of 2)');
        display.setCursor(9, 23);
        return;
    }

    putOptionsLine(1, 1, ' Map', ATR_INVERSE);
    putOptionsLine(1, 2, 'a - bgcolors                [X]');
    putOptionsLine(1, 3, 'b - color                   [X]');
    putOptionsLine(1, 4, 'c - customcolors            [X]');
    putOptionsLine(1, 5, 'd - customsymbols           [X]');
    putOptionsLine(1, 6,
        `e - hilite_pet              [${mark(flags.hilite_pet)}]`);
    putOptionsLine(1, 7,
        `f - hilite_pile             [${mark(flags.hilite_pile)}]`);
    putOptionsLine(1, 8, 'g - showrace                [ ]');
    putOptionsLine(1, 9, 'h - sparkle                 [X]');
    putOptionsLine(1, 10,
        'i - symset                  [DECgraphics, active, handler=DEC]');
    putOptionsLine(1, 12, ' Status', ATR_INVERSE);
    putOptionsLine(1, 13, 'j - hitpointbar             [ ]');
    putOptionsLine(1, 14,
        'k - menu colors             [(0 currently set)]');
    putOptionsLine(1, 15,
        `l - showexp                 [${mark(flags.showexp)}]`);
    putOptionsLine(1, 16,
        'm - status condition fields [(16 currently set)]');
    putOptionsLine(1, 17,
        'n - status highlight rules  [(0 currently set)]');
    putOptionsLine(1, 18, 'o - statuslines             [2]');
    putOptionsLine(1, 19,
        `p - time                    [${mark(flags.time)}]`);
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
    ['menucolors', 'menucolors', false],
    ['mon_movement', 'mon_movement', false],
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

const requestBooleanByName = new Map(
    REQUEST_MENU_BOOLEAN_OPTIONS.map(option => [option[0], option]),
);

function requestBooleanValue(name) {
    const [, property, fallback] = requestBooleanByName.get(name) || [];
    if (!property) return false;
    return game.flags?.[property] ?? fallback;
}

function requestMenuChoice(selected, key, name, value) {
    return ` ${key} ${selected.has(name) ? '+' : '-'} ${name.padEnd(24)}[${value}]`;
}

function requestBooleanLine(selected, key, name, displayName = name) {
    return requestMenuChoice(
        selected, key, name,
        requestBooleanValue(name) ? 'true' : 'false',
    ).replace(name.padEnd(24), displayName.padEnd(24));
}

function requestMenuIdentity() {
    const role = game.urole?.name?.m || game.urole?.key || 'Rogue';
    const race = game.urace?.name || 'human';
    const gender = game.flags?.female ? 'female' : 'male';
    const alignment = game.initAlignment?.name || 'neutral';
    return { role, race, gender, alignment };
}

function renderRequestMenuOptionsPage(page, selected) {
    const display = game.nhDisplay;
    if (!display) return;
    display.clearScreen();
    const lines = Array(24).fill('');
    const choice = (key, name, text) =>
        ` ${key} ${selected.has(name) ? '+' : '-'} ${text}`;
    const boolean = (key, name, displayName = name) =>
        requestBooleanLine(selected, key, name, displayName);

    if (page === 1) {
        lines[0] = ' Set what options?';
        lines[2] = "     For a brief explanation of how this works, type '?' to select";
        lines[3] = '     the next menu choice, then press <enter> or <return>.';
        lines[4] = ' ? - view help for options menu';
        lines[5] = "     [To suppress this menu help, toggle off the 'cmdassist' option.]";
        lines[7] = ' Booleans (selecting will toggle value):';
        lines[8] = '     blind                   ['
            + String(!!game.u?.uroleplay?.blind) + ']';
        lines[9] = '     bones                   [true]';
        lines[10] = '     deaf                    ['
            + String(!!game.u?.uroleplay?.deaf) + ']';
        lines[11] = `     legacy                  [${game.flags?.legacy !== false}]`;
        lines[12] = '     news                    [false]';
        lines[13] = `     nudist                  [${
            !!game.u?.uroleplay?.nudist}]`;
        lines[14] = `     pauper                  [${
            !!game.u?.uroleplay?.pauper}]`;
        lines[15] = `     reroll                  [${
            !!game.u?.uroleplay?.reroll}]`;
        lines[16] = '     selectsaved             [true]';
        lines[17] = '     status_updates          [true]';
        lines[18] = `     tutorial                [${game.flags?.tutorial !== false}]`;
        lines[19] = '     use_darkgray            [true]';
        lines[20] = '     use_truecolor           [false]';
        lines[21] = '     voices                  [excluded from build]';
        lines[22] = boolean('a', 'accessiblemsg');
    } else if (page === 2) {
        lines.splice(0, 23,
            boolean('a', 'acoustics'),
            boolean('b', 'altmeta'),
            boolean('c', 'armorstatus'),
            boolean('d', 'autodescribe'),
            boolean('e', 'autodig'),
            boolean('f', 'autoopen'),
            boolean('g', 'autopickup'),
            boolean('h', 'autoquiver'),
            choice('i', 'bgcolors', 'bgcolors                [on]'),
            boolean('j', 'checkpoint'),
            boolean('k', 'cmdassist'),
            boolean('l', 'color'),
            boolean('m', 'confirm'),
            boolean('n', 'customcolors'),
            boolean('o', 'customsymbols'),
            boolean('p', 'dark_room'),
            boolean('q', 'dropped_nopick'),
            boolean('r', 'eight_bit_tty'),
            boolean('s', 'extmenu'),
            boolean('t', 'fireassist'),
            boolean('u', 'fixinv'),
            boolean('v', 'force_invmenu'),
            boolean('w', 'goldX'));
    } else if (page === 3) {
        lines.splice(0, 23,
            boolean('a', 'help'),
            boolean('b', 'herecmd_menu'),
            boolean('c', 'hilite_pet'),
            boolean('d', 'hilite_pile'),
            boolean('e', 'hitpointbar'),
            choice('f', 'idlecheckpoint', 'idlecheckpoint          [off]'),
            boolean('g', 'ignintr'),
            boolean('h', 'implicit_uncursed'),
            boolean('i', 'lit_corridor'),
            boolean('j', 'lootabc'),
            boolean('k', 'mail'),
            boolean('l', 'mention_decor'),
            boolean('m', 'mention_map'),
            boolean('n', 'mention_walls'),
            boolean('o', 'menu_overlay'),
            boolean('p', 'menucolors'),
            boolean('q', 'mon_movement'),
            boolean('r', 'null'),
            boolean('s', 'pickup_stolen'),
            boolean('t', 'pickup_thrown'),
            boolean('u', 'price_quotes'),
            boolean('v', 'pushweapon'),
            boolean('w', 'query_menu'));
    } else if (page === 4) {
        lines.splice(0, 23,
            boolean('a', 'quick_farsight'),
            boolean('b', 'rest_on_space'),
            boolean('c', 'safe_pet'),
            boolean('d', 'safe_wait'),
            boolean('e', 'showdamage'),
            boolean('f', 'showexp'),
            boolean('g', 'showrace'),
            boolean('h', 'showvers'),
            boolean('i', 'silent'),
            boolean('j', 'sortpack'),
            choice('k', 'sounds', 'sounds                  [off]'),
            boolean('l', 'sparkle'),
            boolean('m', 'spot_monsters'),
            boolean('n', 'standout'),
            boolean('o', 'terrainstatus'),
            boolean('p', 'time'),
            boolean('q', 'tips'),
            boolean('r', 'tombstone'),
            boolean('s', 'toptenwin'),
            boolean('t', 'travel'),
            boolean('u', 'use_inverse'),
            boolean('v', 'verbose'),
            boolean('w', 'weaponstatus'));
    } else if (page === 5) {
        const { role, race, gender, alignment } = requestMenuIdentity();
        lines[0] = boolean('a', 'whatis_menu');
        lines[1] = boolean('b', 'whatis_moveskip');
        lines[3] = ' Compounds (selecting will prompt for new value):';
        lines[4] = '     windowtype              [tty]';
        lines[5] = '     playmode                [normal]';
        lines[6] = `     name                    [${game.plname}]`;
        lines[7] = `     role                    [${role}]`;
        lines[8] = `     race                    [${race}]`;
        lines[9] = `     gender                  [${gender}]`;
        lines[10] = `     alignment               [${alignment}]`;
        lines[11] = '     catname                 [(none)]';
        lines[12] = '     dogname                 [(none)]';
        lines[13] = '     horsename               [(none)]';
        lines[14] = '     msghistory              [20]';
        lines[15] = '     pettype                 [random]';
        lines[16] = '     soundlib                [nosound]';
        lines[17] = choice('c', 'autounlock', 'autounlock              [apply-key]');
        lines[18] = choice('d', 'boulder', 'boulder                 [`]');
        lines[19] = choice('e', 'crash_email', 'crash_email             [unknown]');
        lines[20] = choice('f', 'crash_name', 'crash_name              [unknown]');
        lines[21] = choice('g', 'crash_urlmax', 'crash_urlmax            [-1]');
        lines[22] = choice('h', 'disclose', 'disclose                [ni na nv ng nc no]');
    } else if (page === 6) {
        lines.splice(0, 23,
            choice('a', 'fruit', 'fruit                   [slime mold]'),
            choice('b', 'glyph', 'glyph                   [(to be done)]'),
            choice('c', 'hilite_status', 'hilite_status           [(none)]'),
            choice('d', 'menu_headings', 'menu_headings           [no-color&inverse]'),
            choice('e', 'menu_objsyms', 'menu_objsyms            [conditional]'),
            choice('f', 'menuinvertmode', 'menuinvertmode          [1]'),
            choice('g', 'menustyle', 'menustyle               [full]'),
            choice('h', 'msg_window', 'msg_window              [single]'),
            choice('i', 'number_pad', 'number_pad              [0=off]'),
            choice('j', 'packorder', 'packorder               [$")[%?+!=/(*`0_]'),
            choice('k', 'paranoid_confirmation', 'paranoid_confirmation   [pray trap swim]'),
            choice('l', 'petattr', 'petattr                 [inverse]'),
            choice('m', 'pickup_burden', 'pickup_burden           [stressed]'),
            choice('n', 'pickup_types', `pickup_types            [${game.flags?.pickup_types || 'all'}]`),
            choice('o', 'pile_limit', 'pile_limit              [5]'),
            choice('p', 'roguesymset', 'roguesymset             [default]'),
            choice('q', 'runmode', 'runmode                 [run]'),
            choice('r', 'scores', 'scores                  [3 top/2 around]'),
            choice('s', 'sortdiscoveries', 'sortdiscoveries         [by order of discovery within each class]'),
            choice('t', 'sortloot', 'sortloot                [loot]'),
            choice('u', 'sortvanquished', 'sortvanquished          [t: traditional: by monster level]'),
            choice('v', 'statushilites', "statushilites           [0 (off: don't highlight status fields)]"),
            choice('w', 'statuslines', 'statuslines             [2]'));
    } else {
        lines[0] = choice('a', 'suppress_alert', 'suppress_alert          [(none)]');
        lines[1] = choice('b', 'symset', `symset                  [${game.symset || 'default'}, active, handler=DEC]`);
        lines[2] = choice('c', 'versinfo', 'versinfo                [1: number (5.0.0)]');
        lines[3] = choice('d', 'whatis_coord', 'whatis_coord            [none]');
        lines[4] = choice('e', 'whatis_filter', 'whatis_filter           [none]');
        lines[6] = ' Other settings:';
        lines[7] = choice('f', 'autocompletions', 'autocompletions         [(0 currently set)]');
        lines[8] = choice('g', 'autopickup_exceptions', 'autopickup exceptions   [(0 currently set)]');
        lines[9] = choice('h', 'bind_keys', 'bind keys               [(0 currently set)]');
        lines[10] = choice('i', 'menu_colors', 'menu colors             [(0 currently set)]');
        lines[11] = choice('j', 'message_types', 'message types           [(0 currently set)]');
        lines[12] = choice('k', 'status_conditions', 'status condition fields [(16 currently set)]');
        lines[13] = choice('l', 'status_highlights', 'status highlight rules  [(0 currently set)]');
    }

    lines[page === 7 ? 14 : 23] = ` (${page} of 7)`;
    for (let row = 0; row < lines.length; row++) {
        if (!lines[row]) continue;
        if ((page === 1 && (row === 0 || row === 7))
            || (page === 5 && row === 3)
            || (page === 7 && row === 6)) {
            putOptionsLine(0, row, ' ');
            putOptionsLine(1, row, lines[row].slice(1), ATR_INVERSE);
        } else {
            putOptionsLine(0, row, lines[row]);
        }
    }
    display.setCursor(9, page === 7 ? 14 : 23);
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
    if (!display) return;
    const help = game.flags?.pickup
        ? "Toggle off 'autopickup' to not pick up anything."
        : "Toggle on 'autopickup' to automatically pick these things up.";
    const content = [
        'Autopickup what?',
        ...PICKUP_TYPE_ROWS.map(([letter, symbol, description]) =>
            `${letter} ${selected.has(symbol) ? '+' : '-'} ${symbol}  ${description}`),
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
    for (let index = 0; index < PICKUP_TYPE_ROWS.length; index++) {
        const [letter, symbol, description] = PICKUP_TYPE_ROWS[index];
        putOptionsLine(left, index + 2,
            `${letter} ${selected.has(symbol) ? '+' : '-'} ${symbol}  ${description}`);
    }
    putOptionsLine(left, 18, 'A -    All classes of objects');
    putOptionsLine(left, 19,
        'Note: when no choices are selected, "all" is implied.');
    putOptionsLine(left, 20, help);
    putOptionsLine(left, 21, '(end)');
    display.setCursor(left + 6, 21);
}

async function editPickupTypes(preserveStatus = false) {
    const selected = new Set(game.flags?.pickup_types || '');
    await cls();
    await docrt();
    await flush_screen(1);
    if (!preserveStatus) {
        game.nhDisplay?.clearRow(22);
        game.nhDisplay?.clearRow(23);
    }
    for (;;) {
        renderPickupTypes(selected);
        const key = await nhgetch();
        if (key === 27 || key === 10 || key === 13) break;
        const input = String.fromCharCode(key);
        if (input === 'A') {
            if (selected.size === PICKUP_TYPE_ROWS.length) selected.clear();
            else for (const [, symbol] of PICKUP_TYPE_ROWS) selected.add(symbol);
            continue;
        }
        const row = PICKUP_TYPE_ROWS.find(([letter, symbol]) =>
            input === letter || input === symbol);
        if (!row) continue;
        if (selected.has(row[1])) selected.delete(row[1]);
        else selected.add(row[1]);
    }
    game.flags.pickup_types = PICKUP_TYPE_ROWS
        .map(([, symbol]) => symbol)
        .filter(symbol => selected.has(symbol))
        .join('');
}

const REQUEST_MENU_PAGE_KEYS = [
    null,
    { a: 'accessiblemsg' },
    {
        a: 'acoustics', b: 'altmeta', c: 'armorstatus', d: 'autodescribe',
        e: 'autodig', f: 'autoopen', g: 'autopickup', h: 'autoquiver',
        i: 'bgcolors', j: 'checkpoint', k: 'cmdassist', l: 'color',
        m: 'confirm', n: 'customcolors', o: 'customsymbols', p: 'dark_room',
        q: 'dropped_nopick', r: 'eight_bit_tty', s: 'extmenu',
        t: 'fireassist', u: 'fixinv', v: 'force_invmenu', w: 'goldX',
    },
    {
        a: 'help', b: 'herecmd_menu', c: 'hilite_pet', d: 'hilite_pile',
        e: 'hitpointbar', f: 'idlecheckpoint', g: 'ignintr',
        h: 'implicit_uncursed', i: 'lit_corridor', j: 'lootabc', k: 'mail',
        l: 'mention_decor', m: 'mention_map', n: 'mention_walls',
        o: 'menu_overlay', p: 'menucolors', q: 'mon_movement', r: 'null',
        s: 'pickup_stolen', t: 'pickup_thrown', u: 'price_quotes',
        v: 'pushweapon', w: 'query_menu',
    },
    {
        a: 'quick_farsight', b: 'rest_on_space', c: 'safe_pet', d: 'safe_wait',
        e: 'showdamage', f: 'showexp', g: 'showrace', h: 'showvers',
        i: 'silent', j: 'sortpack', k: 'sounds', l: 'sparkle',
        m: 'spot_monsters', n: 'standout', o: 'terrainstatus', p: 'time',
        q: 'tips', r: 'tombstone', s: 'toptenwin', t: 'travel',
        u: 'use_inverse', v: 'verbose', w: 'weaponstatus',
    },
    {
        a: 'whatis_menu', b: 'whatis_moveskip', c: 'autounlock', d: 'boulder',
        e: 'crash_email', f: 'crash_name', g: 'crash_urlmax', h: 'disclose',
    },
    {
        a: 'fruit', b: 'glyph', c: 'hilite_status', d: 'menu_headings',
        e: 'menu_objsyms', f: 'menuinvertmode', g: 'menustyle', h: 'msg_window',
        i: 'number_pad', j: 'packorder', k: 'paranoid_confirmation',
        l: 'petattr', m: 'pickup_burden', n: 'pickup_types', o: 'pile_limit',
        p: 'roguesymset', q: 'runmode', r: 'scores', s: 'sortdiscoveries',
        t: 'sortloot', u: 'sortvanquished', v: 'statushilites', w: 'statuslines',
    },
    {
        a: 'suppress_alert', b: 'symset', c: 'versinfo', d: 'whatis_coord',
        e: 'whatis_filter', f: 'autocompletions', g: 'autopickup_exceptions',
        h: 'bind_keys', i: 'menu_colors', j: 'message_types',
        k: 'status_conditions', l: 'status_highlights',
    },
];

async function doRequestMenuOptions() {
    const selected = new Set();
    let page = 1;
    for (;;) {
        renderRequestMenuOptionsPage(page, selected);
        const code = await nhgetch();
        if (code === 27) break;
        const input = String.fromCharCode(code);
        if (input === ' ') {
            if (page < 7) {
                page++;
                continue;
            }
            break;
        }
        const option = REQUEST_MENU_PAGE_KEYS[page]?.[input];
        if (!option) continue;
        if (selected.has(option)) selected.delete(option);
        else selected.add(option);
    }

    await docrt();
    await bot();
    let pendingToggleMessage = '';
    for (const [name, property, fallback] of REQUEST_MENU_BOOLEAN_OPTIONS) {
        if (!selected.has(name)) continue;
        const value = !(game.flags?.[property] ?? fallback);
        game.flags[property] = value;
        const message = `'${name}' option toggled ${value ? 'on' : 'off'}.`;
        // Apply the change before a long message pauses, so the status line
        // already shows the new value during that pause.
        if (pendingToggleMessage
            && pendingToggleMessage.length + 2 + message.length + 8 > 80) {
            await promptKey(`${pendingToggleMessage}--More--`);
            pendingToggleMessage = message;
        } else {
            pendingToggleMessage += `${pendingToggleMessage ? '  ' : ''}${message}`;
        }
    }
    if (pendingToggleMessage)
        await promptKey(`${pendingToggleMessage}--More--`);
    if (selected.has('pickup_types')) await editPickupTypes(true);
    game._pending_message = '';
    await docrt();
    await bot();
    game.context.move = 0;
}

// C refs: options.c doset()/special_handling() and tty's PICK_ANY menu.
// Option keys redraw page one. Space advances to page two, then closes it.
// The pickup-types editor reads its own keys before returning here.
export async function doOptions(menuRequested = false) {
    if (menuRequested) {
        await doRequestMenuOptions();
        return;
    }
    const flags = game.flags || (game.flags = {});
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
        if (key === 27 || key === 10 || key === 13) break;
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
            // The fruit prompt replaces the options screen and has no status
            // rows below it.
            await cls();
            const fruit = await getLine(
                'Set fruit to what?',
                (_ch, code) => code >= 32 && code < 127,
                { suppressStatus: true },
            );
            if (fruit?.trim()) game.fruitName = fruit.trim();
        } else if (page === 1 && input === 'd') {
            flags.autodig = !flags.autodig;
        } else if (page === 1 && input === 'o') {
            await editPickupTypes();
        } else if (page === 1 && input === 'e') {
            flags.autoopen = !flags.autoopen;
        } else if (page === 1 && input === 'f') {
            flags.pickup = !flags.pickup;
        } else if (page === 1 && input === 'j') {
            flags.cmdassist = !(flags.cmdassist ?? true);
        } else if (page === 1 && input === 'p') {
            flags.pushweapon = !flags.pushweapon;
        } else if (page === 2 && input === 'e') {
            flags.hilite_pet = !flags.hilite_pet;
        } else if (page === 2 && input === 'f') {
            flags.hilite_pile = !flags.hilite_pile;
        } else if (page === 2 && input === 'l') {
            flags.showexp = !flags.showexp;
        } else if (page === 2 && input === 'p') {
            flags.time = !flags.time;
        } else {
            continue;
        }
        page = 1;
    }
    game._pending_message = '';
    await docrt();
    await bot();
    game.context.move = 0;
}
