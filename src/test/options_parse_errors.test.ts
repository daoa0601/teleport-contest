import assert from 'node:assert/strict';
import test from 'node:test';

import { PARANOID_PRAY, MENU_FULL, MENU_TRADITIONAL, AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_KICK, AUTOUNLOCK_UNTRAP } from '../js/const.js';
import { parseNethackOptions, parseNethackrc } from '../js/options.js';

const PLAY = 'OPTIONS=name:Traveler,!legacy,!tutorial,!autopickup';

function fileErrors(rc: string) {
    return parseNethackrc(rc).configErrors[0]?.errors ?? [];
}

function errorMessages(rc: string) {
    return fileErrors(rc).map(error => error.message);
}

void test('an unmatched option element is reported as unknown', () => {
    assert.deepEqual(
        fileErrors(`${PLAY},zzzz`).map(error => error.message),
        ["Unknown option 'zzzz'"],
    );
});

void test('the unknown-option diagnostic echoes the element after negation prefixes', () => {
    assert.deepEqual(
        fileErrors('OPTIONS=!nozzz:1').map(error => error.message),
        ["Unknown option 'zzz:1'"],
    );
});

void test('a name shorter than the option minimum length is unknown', () => {
    // "time" needs all four letters to win over timed_delay; the bare
    // "menu" is shorter than every menu_* minimum.
    assert.deepEqual(
        fileErrors('OPTIONS=tim:1').map(error => error.message),
        ["Unknown option 'tim:1'"],
    );
    assert.deepEqual(
        fileErrors('OPTIONS=menu').map(error => error.message),
        ["Unknown option 'menu'"],
    );
});

void test('known spellings an alias or abbreviation reaches stay silent', () => {
    assert.deepEqual(fileErrors('OPTIONS=prayconfirm,colour,sortl:none,pet:dog'), []);
    // Options the recorder knows but the port does not implement are
    // accepted without a diagnostic, exactly as parseoptions() does.
    assert.deepEqual(fileErrors('OPTIONS=msghistory:20,font_map:big'), []);
    assert.deepEqual(fileErrors('OPTIONS=S_door:^'), []);
});

void test('negating an option that forbids negation is refused before it applies', () => {
    const configuration = parseNethackrc('OPTIONS=!fruit,name:Traveler');
    assert.deepEqual(
        (configuration.configErrors[0]?.errors ?? []).map(error => error.message),
        ['The fruit option may not both have a value and be negated.'],
    );
    // optfn_fruit() never runs, so the fruit stays at its default name.
    assert.equal(configuration.fruit, undefined);
});

void test('negation of compound options without a value is refused too', () => {
    for (const option of ['number_pad', 'sortloot', 'scores', 'pickup_types',
        'warnings', 'symset', 'packorder', 'versinfo']) {
        assert.deepEqual(
            fileErrors(`OPTIONS=!${option}`).map(error => error.message),
            [`The ${option} option may not both have a value and be negated.`],
            option,
        );
    }
});

void test('a repeated file option draws the duplicate complaint and still applies', () => {
    const configuration = parseNethackrc('OPTIONS=runmode:run\nOPTIONS=runmode:walk');
    assert.deepEqual(
        (configuration.configErrors[0]?.errors ?? []).map(error => error.message),
        ['compound option specified multiple times: runmode'],
    );
    assert.equal(configuration.flags.runmode, 'walk');
});

void test('a repeated boolean option reports its own kind and the alias spelling', () => {
    assert.deepEqual(
        fileErrors('OPTIONS=color,time\nOPTIONS=!color').map(error => error.message),
        ['boolean option specified multiple times: color'],
    );
    // colour matched via the alias after the plain spelling, so the
    // complaint carries the alias suffix of the canonical option.
    assert.deepEqual(
        fileErrors('OPTIONS=color,colour').map(error => error.message),
        ['boolean option specified multiple times: color (via alias: colour)'],
    );
});

void test('environment options accept repeats without the duplicate complaint', () => {
    const configuration = parseNethackrc('OPTIONS=name:Traveler');
    const report = parseNethackOptions('runmode:run,runmode:walk', configuration);
    assert.deepEqual(report.errors, []);
    // Elements apply right to left, so the first spelling in the list wins.
    assert.equal(configuration.flags.runmode, 'run');
});

void test('a boolean value outside the true and false spellings is invalid', () => {
    const configuration = parseNethackrc('OPTIONS=time:2,name:Traveler');
    assert.deepEqual(
        (configuration.configErrors[0]?.errors ?? []).map(error => error.message),
        ["'time:2' is not valid for a boolean"],
    );
    assert.notEqual(configuration.flags.time, true);
});

void test('a negated boolean refuses its parameter', () => {
    const configuration = parseNethackrc('OPTIONS=!time:1,name:Traveler');
    assert.deepEqual(
        (configuration.configErrors[0]?.errors ?? []).map(error => error.message),
        ["Negated boolean 'time' should not have a parameter"],
    );
    assert.notEqual(configuration.flags.time, true);
});

void test('boolean values spell on and off', () => {
    for (const [value, expected] of [['true', true], ['yes', true], ['on', true],
        ['1', true], ['tru', true], ['false', false], ['no', false], ['off', false],
        ['0', false], ['01', true]] as const) {
        assert.equal(parseNethackrc(`OPTIONS=color:${value}`).flags.color, expected, value);
    }
    // A space after the delimiter keeps the value off C's digit check.
    const spaced = parseNethackrc('OPTIONS=color: 1');
    assert.deepEqual(
        (spaced.configErrors[0]?.errors ?? []).map(error => error.message),
        ["'color: 1' is not valid for a boolean"],
    );
});

void test('a valok boolean accepts any other value as on', () => {
    assert.equal(parseNethackrc('OPTIONS=menucolors:junk').flags.menucolors, true);
    assert.equal(parseNethackrc('OPTIONS=!menucolors:junk').flags.menucolors, undefined);
});

void test('gender booleans accept values like any boolean', () => {
    assert.equal(parseNethackrc('OPTIONS=male:true').flags.female, false);
    assert.equal(parseNethackrc('OPTIONS=female:false').flags.female, false);
    assert.equal(parseNethackrc('OPTIONS=male:false').flags.female, false);
    assert.equal(parseNethackrc('OPTIONS=female:yes').flags.female, true);
});


void test('runmode and msg_window report unknown and missing parameters', () => {
    assert.deepEqual(errorMessages('OPTIONS=runmode:x'), ["Unknown runmode parameter 'x'"]);
    assert.deepEqual(errorMessages('OPTIONS=runmode'), ['Value is mandatory for runmode']);
    assert.deepEqual(errorMessages('OPTIONS=runmode:'), ['Value is mandatory for runmode']);
    assert.deepEqual(errorMessages('OPTIONS=msg_window:x'), ["Unknown msg_window parameter 'x'"]);
    assert.deepEqual(errorMessages('OPTIONS=!msg_window:f'),
        ['The msg_window option may not both have a value and be negated.']);
    assert.equal(parseNethackrc('OPTIONS=runmode:tele').flags.runmode, 'teleport');
});

void test('menustyle demands a value from its full spelling and defaults an abbreviation', () => {
    assert.deepEqual(errorMessages('OPTIONS=menustyle:x'), ["Unknown menustyle parameter 'x'"]);
    assert.deepEqual(errorMessages('OPTIONS=menustyle'), ["Missing parameter for 'menustyle'"]);
    assert.deepEqual(errorMessages('OPTIONS=menustyle:'), ["Missing parameter for 'menustyle:'"]);
    // Five letters or fewer keep the backwards-compatible default: full
    // menus, or traditional when negated.
    assert.equal(parseNethackrc('OPTIONS=menus').flags.menu_style, MENU_FULL);
    assert.equal(parseNethackrc('OPTIONS=!menus').flags.menu_style, MENU_TRADITIONAL);
});

void test('number_pad validates its mode digits', () => {
    assert.deepEqual(errorMessages('OPTIONS=number_pad:x'), ["Illegal number_pad parameter 'x'"]);
    assert.deepEqual(errorMessages('OPTIONS=number_pad:5'), ["Illegal number_pad parameter '5'"]);
    assert.deepEqual(errorMessages('OPTIONS=number_pad:-2'), ["Illegal number_pad parameter '-2'"]);
    assert.deepEqual(errorMessages('OPTIONS=number_pad:'), ["Missing parameter for 'number_pad:'"]);
    // An abbreviated spelling fits the compat rule, so its empty value
    // means number_pad:1 without a diagnostic.
    const abbreviated = parseNethackrc('OPTIONS=numb:');
    assert.deepEqual(errorMessages('OPTIONS=numb:'), []);
    assert.equal(abbreviated.iflags.num_pad, true);
});

void test('sortloot, scores, and pickup_burden report their parameter errors', () => {
    assert.deepEqual(errorMessages('OPTIONS=sortloot:x'), ["Unknown sortloot parameter 'x'"]);
    assert.deepEqual(errorMessages('OPTIONS=sortloot:'), ["Missing parameter for 'sortloot:'"]);
    assert.deepEqual(errorMessages('OPTIONS=scores:x'), ["Unknown scores parameter 'x'"]);
    assert.deepEqual(errorMessages('OPTIONS=scores:-3t'),
        ['Values for scores:top and scores:around must not be negative']);
    assert.deepEqual(errorMessages('OPTIONS=scores:'), ["Missing parameter for 'scores:'"]);
    assert.deepEqual(errorMessages('OPTIONS=pickup_burden:x'),
        ["Unknown pickup_burden parameter 'x'"]);
    assert.deepEqual(errorMessages('OPTIONS=pickup_burden:'),
        ["Missing parameter for 'pickup_burden:'"]);
    assert.deepEqual(errorMessages('OPTIONS=warnings'), ["Missing parameter for 'warnings'"]);
    assert.deepEqual(errorMessages('OPTIONS=fruit:'), ["Missing parameter for 'fruit:'"]);
    assert.deepEqual(errorMessages('OPTIONS=name:'), ["Missing parameter for 'name:'"]);
});

void test('playmode accepts the documented prefixes and rejects others', () => {
    assert.deepEqual(errorMessages('OPTIONS=playmode:bogus'),
        ['Invalid value for "playmode":bogus']);
    assert.equal(parseNethackrc('OPTIONS=playmode:debug').flags.debug, true);
    assert.equal(parseNethackrc('OPTIONS=playmode:DEBUGGING').flags.debug, true);
    assert.equal(parseNethackrc('OPTIONS=playmode:wizard').flags.debug, true);
    assert.equal(parseNethackrc('OPTIONS=playmode:discovery').flags.explore, true);
    assert.equal(parseNethackrc('OPTIONS=playmode:play').flags.debug, false);
    assert.equal(parseNethackrc('OPTIONS=playmode:normal').flags.debug, false);
    // A duplicate playmode keeps the first value after the complaint.
    const duplicated = parseNethackrc('OPTIONS=playmode:debug\nOPTIONS=playmode:explore');
    assert.equal(duplicated.flags.debug, true);
    assert.equal(duplicated.flags.explore, false);
});

void test('versinfo and pile_limit report bad values', () => {
    // A missing value draws string_for_opt()'s complaint beneath the
    // handler's own line.
    assert.deepEqual(errorMessages('OPTIONS=versinfo:'),
        ["Missing parameter for 'versinfo:'",
            "'versinfo' requires a value; defaulting to 1"]);
    assert.deepEqual(errorMessages('OPTIONS=versinfo:9'),
        ["'versinfo' must be one of 1, 2, 4, or the sum of two or all three of those"]);
    assert.deepEqual(errorMessages('OPTIONS=versinfo:0'),
        ["'versinfo' must be one of 1, 2, 4, or the sum of two or all three of those"]);
    assert.equal(parseNethackrc('OPTIONS=versinfo:5').flags.versinfo, 5);
    assert.deepEqual(errorMessages('OPTIONS=!pile_limit:3'),
        ['The pile_limit option may not both have a value and be negated.']);
    // Without a value, string_for_opt() is called with val_optional TRUE
    // when negated, FALSE otherwise; the default limit still applies.
    assert.deepEqual(errorMessages('OPTIONS=pile_limit'),
        ["Missing parameter for 'pile_limit'"]);
    assert.equal(parseNethackrc('OPTIONS=pile_limit').flags.pile_limit, 5);
    assert.deepEqual(errorMessages('OPTIONS=!pile_limit:'), []);
    assert.equal(parseNethackrc('OPTIONS=!pile_limit:').flags.pile_limit, 0);
});

void test('paranoid_confirmation validates its argument list', () => {
    assert.deepEqual(errorMessages('OPTIONS=paranoid_confirmation'),
        ["paranoid_confirmation requires a value; use 'none' to cancel all"]);
    assert.deepEqual(errorMessages('OPTIONS=!paranoid_confirm:pray'),
        ['!paranoid_confirmation does not accept a value']);
    assert.deepEqual(errorMessages('OPTIONS=paranoid_confirm:pray wat'),
        ["Unknown paranoid_confirmation parameter 'wat'"]);
    // match_optname() folds case; the diagnostic keeps the original.
    assert.deepEqual(errorMessages('OPTIONS=paranoid_confirm:Wat'),
        ["Unknown paranoid_confirmation parameter 'Wat'"]);
    assert.equal((parseNethackrc('OPTIONS=paranoid_confirm:PRAY')
        .flags.paranoia_bits ?? 0) & PARANOID_PRAY, PARANOID_PRAY);
    assert.deepEqual(errorMessages('OPTIONS=prayconfirm:x'),
        ["deprecated prayconfirm option takes no parameters (found 'x')"]);
    assert.deepEqual(errorMessages('OPTIONS=!prayconfirm:x'),
        ["deprecated !prayconfirm option takes no parameters (found 'x')"]);
});

void test('disclose validates its category letters and defaults bare spellings', () => {
    assert.deepEqual(errorMessages('OPTIONS=disclose:x'), ["Unknown disclose parameter 'x'"]);
    assert.deepEqual(errorMessages('OPTIONS=!disclose:-i'),
        ['The disclose option may not both have a value and be negated.']);
    assert.equal(parseNethackrc('OPTIONS=disclose').flags.disclose, '');
    assert.equal(parseNethackrc('OPTIONS=!disclose').flags.disclose, 'none');
    // "all" and "none" name the whole set (strcmpi, case-insensitive),
    // and prefix letters fold case through lowc() while the diagnostic
    // keeps the original.
    assert.equal(parseNethackrc('OPTIONS=disclose:none').flags.disclose, 'none');
    assert.equal(parseNethackrc('OPTIONS=disclose:ALL').flags.disclose, 'all');
    assert.deepEqual(errorMessages('OPTIONS=disclose:none'), []);
    assert.deepEqual(errorMessages('OPTIONS=disclose:Yi'), []);
    assert.equal(parseNethackrc('OPTIONS=disclose:-i -a -v -g -c -o').flags.disclose,
        '-i -a -v -g -c -o');
});

void test('menu paging key options require a key and refuse negation', () => {
    assert.deepEqual(errorMessages('OPTIONS=menu_next_page:'),
        ["Missing parameter for 'menu_next_page:'"]);
    assert.deepEqual(errorMessages('OPTIONS=!menu_next_page:^F'),
        ['The menu_next_page option may not both have a value and be negated.']);
    assert.deepEqual(errorMessages('OPTIONS=menu_search:F'),
        ["Reserved menu command key 'F'"]);
    // check_misc_menu_command() needs the full name; an abbreviation is
    // a silent no-op instead of a binding.
    const abbreviated = parseNethackrc('OPTIONS=menu_next:>');
    assert.deepEqual(errorMessages('OPTIONS=menu_next:>'), []);
    assert.deepEqual(abbreviated.commandBindings.menuAliases, []);
    assert.deepEqual(parseNethackrc('OPTIONS=menu_next_page:>')
        .commandBindings.menuAliases, [{ key: '>'.charCodeAt(0), command: '>' }]);
});

void test('autounlock parses its action list into a bitmask', () => {
    assert.equal(parseNethackrc('OPTIONS=autounlock').flags.autounlock, AUTOUNLOCK_APPLY_KEY);
    assert.equal(parseNethackrc('OPTIONS=!autounlock').flags.autounlock, 0);
    assert.equal(parseNethackrc('OPTIONS=autounlock:none').flags.autounlock, 0);
    assert.equal(parseNethackrc('OPTIONS=autounlock:untrap+kick').flags.autounlock,
        AUTOUNLOCK_UNTRAP | AUTOUNLOCK_KICK);
    assert.equal(parseNethackrc('OPTIONS=autounlock:untrap kick').flags.autounlock,
        AUTOUNLOCK_UNTRAP | AUTOUNLOCK_KICK);
    // trimspaces() runs between pieces, so separator runs collapse and
    // leading or doubled spaces stay harmless.
    assert.equal(parseNethackrc('OPTIONS=autounlock: kick').flags.autounlock,
        AUTOUNLOCK_KICK);
    assert.equal(parseNethackrc('OPTIONS=autounlock:untrap  kick').flags.autounlock,
        AUTOUNLOCK_UNTRAP | AUTOUNLOCK_KICK);
    assert.equal(parseNethackrc('OPTIONS=autounlock:apply_key').flags.autounlock,
        AUTOUNLOCK_APPLY_KEY);
    // The type match is case-insensitive but the dispatch switch needs
    // the exact lowercase first letter.
    assert.deepEqual(errorMessages('OPTIONS=autounlock:Untrap'),
        ['Invalid value for "autounlock": "Untrap"']);
    assert.deepEqual(errorMessages('OPTIONS=autounlock:bogus'),
        ['Invalid value for "autounlock": "bogus"']);
    assert.deepEqual(errorMessages('OPTIONS=autounlock:none+kick'),
        ["Invalid value combination for \"autounlock\": 'none' with some"]);
    assert.deepEqual(errorMessages('OPTIONS=!autounlock:kick'),
        ["Invalid value combination for \"autounlock\": 'none' with some"]);
});

void test('BINDINGS lines report unparseable keys and unknown commands', () => {
    assert.deepEqual(errorMessages('BINDINGS=qq:search'),
        ["Unknown key binding key 'qq'"]);
    assert.deepEqual(errorMessages('BINDINGS=h:notacommand'),
        ["Unknown key binding command 'notacommand'"]);
    // A binding without a separator is silently not a binding.
    assert.deepEqual(errorMessages('BINDINGS=nothing'), []);
});

void test('a menu command key binding carries both illegal-key diagnostics', () => {
    // illegal_menu_cmd_key() reports the reserved key, then
    // parsebindings() adds its own "Bad menu key" line.
    assert.deepEqual(errorMessages('BINDINGS=F:menu_next_page'),
        ["Reserved menu command key 'F'", 'Bad menu key F:menu_next_page']);
    // '@' is the one letter a menu command may keep.
    assert.deepEqual(errorMessages('BINDINGS=@:menu_next_page'), []);
    assert.equal(parseNethackrc('BINDINGS=@:menu_next_page')
        .commandBindings.menuCommand('@'.charCodeAt(0)), '>'.charCodeAt(0));
});

void test('the menu-entry options carry their plain names', () => {
    // NHOPTO() spells these without quotes; "autopickup exceptions"
    // keeps autopickup ambiguous up to all ten letters.
    assert.deepEqual(errorMessages('OPTIONS=autop'), ["Unknown option 'autop'"]);
    assert.deepEqual(errorMessages('OPTIONS=autocompletions'), []);
    assert.deepEqual(errorMessages('OPTIONS=autocompletions,autocompletions'),
        ['boolean option specified multiple times: autocompletions']);
});

void test('playmode accepts six-letter explore and discovery prefixes', () => {
    assert.equal(parseNethackrc('OPTIONS=playmode:discov').flags.explore, true);
    assert.equal(parseNethackrc('OPTIONS=playmode:explor').flags.explore, true);
    assert.equal(parseNethackrc('OPTIONS=playmode:disc').flags.explore, undefined);
});

void test('name and pickup_burden demand a value with or without a delimiter', () => {
    assert.deepEqual(errorMessages('OPTIONS=name'), ["Missing parameter for 'name'"]);
    assert.deepEqual(errorMessages('OPTIONS=pickup_burden'),
        ["Missing parameter for 'pickup_burden'"]);
});

void test('a long male value falls through to the plain assignment', () => {
    // strncmpi() runs past "male" onto the delimiter, so only
    // flags.female is written; initgend keeps its prior setting.
    const configuration = parseNethackrc('OPTIONS=male:false');
    assert.equal(configuration.flags.female, false);
    assert.equal(configuration.flags.initgend, undefined);
    assert.equal(configuration.gender, null);
    // The short male spelling still inverts through the alias branch.
    const inverted = parseNethackrc('OPTIONS=male:off');
    assert.equal(inverted.flags.female, true);
    assert.equal(inverted.flags.initgend, 1);
});

void test('bind_key parameter complaints surface from BINDINGS lines', () => {
    assert.deepEqual(errorMessages('BINDINGS=h:toggle'),
        ["'toggle' requires a parameter"]);
});