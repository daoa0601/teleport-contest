import assert from 'node:assert/strict';
import test from 'node:test';
import { def_warnsyms } from '../js/const.js';
import { completeExtendedCommand } from '../js/extended_commands.js';
import { Engine, runSegment } from '../js/jsmain.js';
import { parseNethackrc } from '../js/options.js';
import { enableRngLog, getRngLog, initRng } from '../js/rng.js';
import { memoryStorage } from './support/memory-storage.js';
const PLAY = 'OPTIONS=!legacy,!tutorial,!autopickup,name:Traveler';
async function start(nethackrc) {
    return runSegment({
        seed: 73, datetime: '20260830120000', moves: '', storage: memoryStorage(),
        nethackrc,
    });
}
function screen(engine) {
    assert.ok(engine.display);
    return engine.display.grid.map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n');
}
function fileErrors(rc) {
    return parseNethackrc(rc).configErrors[0]?.errors ?? [];
}
void test('an unrecognized statement reports the line and waits for acknowledgment', async () => {
    const engine = await start([PLAY, 'FOO=bar'].join('\n'));
    assert.match(screen(engine), /FOO=bar/);
    assert.match(screen(engine), / \* Line 2: Unknown config statement\./);
    assert.match(screen(engine), /1 error in \.nethackrc\./);
    assert.match(screen(engine), /Hit return to continue:/);
    assert.equal(engine.state.moves, 0);
    engine.inputGate.feed('\n');
    await engine.runUntilInputNeeded();
    assert.doesNotMatch(screen(engine), /Unknown config statement|Hit return to continue/);
});
void test('a statement without a delimiter is not a config statement', async () => {
    const engine = await start([PLAY, 'OPTIONS'].join('\n'));
    assert.match(screen(engine), / \* Line 2: Not a config statement, missing '='\./);
    assert.match(screen(engine), /1 error in \.nethackrc\./);
});
void test('a section header before any CHOOSE is an error but not fatal', async () => {
    const engine = await start([PLAY, '[alpha]', 'NAME=Nobody'].join('\n'));
    assert.match(screen(engine), / \* Line 2: Section "\[alpha\]" without CHOOSE\./);
    // parse continues past the error: the following statement still applies
    // and overrides the earlier name.
    assert.equal(engine.state.plname, 'Nobody');
});
void test('CHOOSE consumes one core draw and activates only the chosen section', () => {
    initRng(42);
    enableRngLog();
    const config = parseNethackrc('CHOOSE=alpha,beta\n[alpha]\nNAME=AlphaOne\n[beta]\nNAME=BetaTwo\n');
    const first = getRngLog()[0] ?? '';
    assert.match(first, /^rn2\(2\)=\d+$/);
    const chosen = Number(first.slice(first.indexOf('=') + 1));
    assert.equal(config.name, chosen === 0 ? 'AlphaOne' : 'BetaTwo');
    assert.equal(config.configErrors[0]?.errors.length, 0);
});
void test('statements in unchosen sections are skipped without diagnostics', () => {
    initRng(9);
    const config = parseNethackrc('CHOOSE=a\n[other]\nFOO=bar\n[a]\nNAME=InA\n[]\nFOO=baz');
    assert.equal(config.name, 'InA');
    // 'FOO=bar' inside [other] is silent; after '[]' sections end and the
    // statement is unknown again.
    assert.deepEqual(config.configErrors[0]?.errors.map(error => error.message), ['Unknown config statement']);
});
void test('CHOOSE without a value or delimiter reports its own errors', () => {
    assert.deepEqual(fileErrors('CHOOSE').map(error => error.message), ['Format is CHOOSE=section1,section2,...']);
    initRng(11);
    enableRngLog();
    const empty = parseNethackrc('CHOOSE=');
    // A failed choice clears any previous section: nothing is chosen.
    assert.deepEqual(empty.configErrors[0]?.errors.map(error => error.message), ['No config section to choose']);
    // Even an empty choice list consumes one draw.
    assert.equal(getRngLog()[0], 'rn2(1)=0');
});
void test('a failed CHOOSE leaves no section chosen', () => {
    initRng(9);
    const config = parseNethackrc('CHOOSE=a\n[a]\nNAME=InA\nCHOOSE=\nNAME=After\n[b]\nNAME=Nope');
    // 'NAME=After' is skipped (a section is current but none is chosen),
    // '[b]' reports "without CHOOSE" and ends the section, so 'NAME=Nope'
    // is processed as an ordinary statement.
    assert.equal(config.name, 'Nope');
    assert.deepEqual(config.configErrors[0]?.errors.map(error => error.message), ['No config section to choose', 'Section "[b]" without CHOOSE']);
});
void test('NAME, ROLE, CHARACTER, and pet-name statements configure the identity', () => {
    const identity = parseNethackrc('NAME=Traveler\nROLE=Val\nDOG=Rex\nCAT=Whiskers');
    assert.equal(identity.name, 'Traveler');
    assert.equal(identity.role, 'Val');
    assert.equal(identity.flags.dogname, 'Rex');
    assert.equal(identity.flags.catname, 'Whiskers');
    assert.equal(parseNethackrc('CHARACTER=tour').role, 'tour');
    // cnf_line_ROLE() ignores values str2role() cannot resolve: unknown
    // names, an empty value, and ROLE_RANDOM ('random', '*', '@') all leave
    // the role unset because the assignment requires str2role() >= 0.
    assert.equal(parseNethackrc('ROLE=paladin').role, null);
    assert.equal(parseNethackrc('ROLE=').role, null);
    for (const random of ['random', '*', '@']) {
        const kept = parseNethackrc(`OPTIONS=role:Val\nROLE=${random}`);
        assert.equal(kept.role, 'Val', `ROLE=${random} must not override`);
    }
});
void test('OPTIONS accepts its four-character abbreviation', () => {
    assert.equal(parseNethackrc('OPTIO=name:Abbr').name, 'Abbr');
});
void test('a numeric WARNINGS statement assigns the warning glyphs', () => {
    const defaults = def_warnsyms.map(warning => warning.ch).join('');
    const applied = parseNethackrc('WARNINGS=8 5 2');
    assert.equal(applied.iflags.warningSymbols, '\x08\x05\x02' + defaults.slice(3));
    // An explicit zero leaves that level's symbol unchanged.
    const zeroed = parseNethackrc('WARNINGS=8 0 2');
    assert.equal(zeroed.iflags.warningSymbols, '\x08' + defaults.charAt(1) + '\x02' + defaults.slice(3));
    // get_uchars() returns the values parsed before a syntax error, and
    // cnf_line_WARNINGS() applies them despite the diagnostic.
    const partial = parseNethackrc('WARNINGS=8 5 x');
    assert.equal(partial.iflags.warningSymbols, '\x08\x05' + defaults.slice(2));
    assert.deepEqual(partial.configErrors[0]?.errors.map(error => error.message), ['Syntax error in WARNINGS']);
});
void test('WARNINGS syntax errors wait for a return without a counted summary', async () => {
    const raw = fileErrors([PLAY, 'WARNINGS=x'].join('\n'));
    assert.equal(raw.length, 1);
    assert.equal(raw[0]?.message, 'Syntax error in WARNINGS');
    assert.equal(raw[0]?.raw, true);
    assert.equal(raw[0]?.lineNumber, 2);
    // raw_printf() + wait_synch() pauses at getret() before
    // init_nhwindows(); with no counted errors there is no summary line.
    const engine = await start([PLAY, 'WARNINGS=x'].join('\n'));
    assert.match(screen(engine), /^Syntax error in WARNINGS$/m);
    assert.match(screen(engine), /Hit return to continue:/);
    assert.doesNotMatch(screen(engine), /error in \.nethackrc\./);
    assert.equal(engine.state.moves, 0);
    engine.inputGate.feed('\n');
    await engine.runUntilInputNeeded();
    assert.doesNotMatch(screen(engine), /Hit return to continue:/);
    assert.equal(engine.state.moves, 0);
});
void test('raw diagnostics keep their position among counted errors', async () => {
    const engine = await start(['WARNINGS=x', 'FOO=bar', PLAY].join('\n'));
    // Parsing stops at the raw diagnostic's getret() before the later
    // counted error is reported.
    let text = screen(engine);
    assert.match(text, /^Syntax error in WARNINGS$/m);
    assert.match(text, /Hit return to continue:/);
    assert.doesNotMatch(text, /Unknown config statement/);
    engine.inputGate.feed('\n');
    await engine.runUntilInputNeeded();
    text = screen(engine);
    assert.match(text, /^Syntax error in WARNINGS$/m);
    assert.match(text, / \* Line 2: Unknown config statement\./);
    assert.match(text, /1 error in \.nethackrc\./);
    assert.ok(text.indexOf('Syntax error in WARNINGS')
        < text.indexOf('Unknown config statement'));
    assert.match(text, /Hit return to continue:/);
    engine.inputGate.feed('\n');
    await engine.runUntilInputNeeded();
    assert.doesNotMatch(screen(engine), /Hit return to continue:/);
});
void test('BOULDER counts a zero value even though it stores nothing', () => {
    // get_uchars() finishes after one parsed number, so the text after an
    // accepted zero is never examined.
    for (const statement of ['BOULDER=0 x', 'BOULDER=0 5', 'BOULDER=0']) {
        assert.equal(fileErrors(statement).length, 0, statement);
    }
});
void test('BOULDER syntax errors print without the counted error treatment', () => {
    const raw = fileErrors('BOULDER=}');
    assert.equal(raw.length, 1);
    assert.equal(raw[0]?.message, 'Syntax error in BOULDER');
    assert.equal(raw[0]?.raw, true);
});
void test('a NAME statement truncates on bytes, not characters', () => {
    // 20 two-byte characters: the 31-byte limit keeps fifteen whole
    // characters plus one byte of the sixteenth.
    const longName = parseNethackrc('NAME=' + 'é'.repeat(20));
    assert.equal(longName.name, 'é'.repeat(15) + '\uFFFD');
    assert.equal(parseNethackrc('NAME=' + 'é'.repeat(10)).name, 'é'.repeat(10));
});
void test('MENUCOLOR statements report malformed patterns, colors, and attributes', () => {
    assert.deepEqual(fileErrors('MENUCOLOR=nocolorhere').map(error => error.message), ['Malformed MENUCOLOR']);
    assert.deepEqual(fileErrors('MENUCOLOR="blessed" = nosuchcolor').map(error => error.message), ["Unknown color 'nosuchcolor'"]);
    assert.deepEqual(fileErrors('MENUCOLOR="blessed" = green&nosuchattr').map(error => error.message), ["Unknown text attribute 'nosuchattr'"]);
    // Fuzzy names and digits within the palette are accepted.
    assert.equal(fileErrors('MENUCOLOR="blessed" = LIGHT-green&reverse').length, 0);
    assert.equal(fileErrors('MENUCOLOR="blessed" = 3&bold').length, 0);
    assert.equal(fileErrors('MENUCOLOR="blessed" = 99').length, 1);
    const regexError = fileErrors('MENUCOLOR="bless(ed" = green');
    assert.equal(regexError.length, 1);
    assert.match(regexError[0]?.message ?? '', /^Menucolor regex error: /);
    assert.notEqual(regexError[0]?.raw, true);
});
void test('AUTOPICKUP_EXCEPTION statements report syntax and regex errors', () => {
    // An unclosed quote fails the sscanf() scan and is a syntax error.
    assert.equal(fileErrors('AUTOPICKUP_EXCEPTION="<arrow"').length, 0);
    assert.deepEqual(fileErrors('AUTOPICKUP_EXCEPTION="<*arrow').map(error => error.message), ['syntax error in AUTOPICKUP_EXCEPTION']);
    assert.equal(fileErrors('AUTOPICKUP_EXCEPTION=">food" # avoid food').length, 0);
    assert.equal(fileErrors('AUTOPICKUP_EXCEPTION=unquoted').length, 1);
    assert.deepEqual(fileErrors('AUTOPICKUP_EXCEPTION=unquoted').map(error => error.message), ['syntax error in AUTOPICKUP_EXCEPTION']);
    const regexError = fileErrors('AUTOPICKUP_EXCEPTION="<*arr(ow"');
    assert.equal(regexError.length, 1);
    assert.match(regexError[0]?.message ?? '', /^regex error in AUTOPICKUP_EXCEPTION: /);
});
void test('AUTOCOMPLETE statements flip extended-command autocompletion', () => {
    assert.equal(completeExtendedCommand('adj'), 'adjust');
    parseNethackrc('AUTOCOMPLETE=!adjust');
    assert.equal(completeExtendedCommand('adj'), null);
    parseNethackrc('AUTOCOMPLETE=adjust');
    assert.equal(completeExtendedCommand('adj'), 'adjust');
});
void test('AUTOCOMPLETE adjustments do not leak into the next game', () => {
    parseNethackrc('AUTOCOMPLETE=!adjust');
    assert.equal(completeExtendedCommand('adj'), null);
    // A new engine start is a new native process: its rc file resets the
    // extended-command flags to the compiled defaults.
    parseNethackrc('OPTIONS=!legacy');
    assert.equal(completeExtendedCommand('adj'), 'adjust');
});
void test('an invalid AUTOCOMPLETE command prints a raw diagnostic', () => {
    const raw = fileErrors('AUTOCOMPLETE=nosuchcommand');
    assert.equal(raw.length, 1);
    assert.equal(raw[0]?.message, "Bad autocomplete: invalid extended command 'nosuchcommand'.");
    assert.equal(raw[0]?.raw, true);
});
//# sourceMappingURL=config_statements.test.js.map