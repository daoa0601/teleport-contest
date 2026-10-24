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
    assert.deepEqual(empty.configErrors[0]?.errors.map(error => error.message), ['No config section to choose']);
    // Even an empty choice list consumes one draw.
    assert.equal(getRngLog()[0], 'rn2(1)=0');
});
void test('NAME, ROLE, CHARACTER, and pet-name statements configure the identity', () => {
    const identity = parseNethackrc('NAME=Traveler\nROLE=Val\nDOG=Rex\nCAT=Whiskers');
    assert.equal(identity.name, 'Traveler');
    assert.equal(identity.role, 'Val');
    assert.equal(identity.flags.dogname, 'Rex');
    assert.equal(identity.flags.catname, 'Whiskers');
    assert.equal(parseNethackrc('CHARACTER=tour').role, 'tour');
    // cnf_line_ROLE() ignores values str2role() cannot resolve, including
    // an empty one.
    assert.equal(parseNethackrc('ROLE=paladin').role, null);
    assert.equal(parseNethackrc('ROLE=').role, null);
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
});
void test('WARNINGS syntax errors print without the counted error treatment', async () => {
    const raw = fileErrors([PLAY, 'WARNINGS=x'].join('\n'));
    assert.equal(raw.length, 1);
    assert.equal(raw[0]?.message, 'Syntax error in WARNINGS');
    assert.equal(raw[0]?.raw, true);
    assert.equal(raw[0]?.lineNumber, 2);
    // With no counted errors there is no summary and no acknowledgment, so
    // startup proceeds into character selection.
    const engine = await start([PLAY, 'WARNINGS=x'].join('\n'));
    assert.doesNotMatch(screen(engine), /error in \.nethackrc\./);
    assert.doesNotMatch(screen(engine), /Hit return to continue:/);
    assert.equal(engine.state.moves, 0);
});
void test('raw diagnostics keep their position among counted errors', async () => {
    const engine = await start(['WARNINGS=x', 'FOO=bar', PLAY].join('\n'));
    const text = screen(engine);
    assert.match(text, /^Syntax error in WARNINGS$/m);
    assert.match(text, / \* Line 2: Unknown config statement\./);
    assert.match(text, /1 error in \.nethackrc\./);
    assert.ok(text.indexOf('Syntax error in WARNINGS')
        < text.indexOf('Unknown config statement'));
    assert.match(text, /Hit return to continue:/);
});
void test('a numeric BOULDER statement is accepted silently', () => {
    assert.equal(fileErrors('BOULDER=125').length, 0);
});
void test('BOULDER syntax errors print without the counted error treatment', () => {
    const raw = fileErrors('BOULDER=}');
    assert.equal(raw.length, 1);
    assert.equal(raw[0]?.message, 'Syntax error in BOULDER');
    assert.equal(raw[0]?.raw, true);
});
void test('AUTOCOMPLETE statements flip extended-command autocompletion', () => {
    assert.equal(completeExtendedCommand('adj'), 'adjust');
    parseNethackrc('AUTOCOMPLETE=!adjust');
    assert.equal(completeExtendedCommand('adj'), null);
    parseNethackrc('AUTOCOMPLETE=adjust');
    assert.equal(completeExtendedCommand('adj'), 'adjust');
});
void test('an invalid AUTOCOMPLETE command prints a raw diagnostic', () => {
    const raw = fileErrors('AUTOCOMPLETE=nosuchcommand');
    assert.equal(raw.length, 1);
    assert.equal(raw[0]?.message, "Bad autocomplete: invalid extended command 'nosuchcommand'.");
    assert.equal(raw[0]?.raw, true);
});
//# sourceMappingURL=config_statements.test.js.map