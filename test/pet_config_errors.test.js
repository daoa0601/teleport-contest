import assert from 'node:assert/strict';
import test from 'node:test';
import { PL_PSIZ } from '../js/const.js';
import { GameDisplay } from '../js/game_display.js';
import { Engine, runSegment } from '../js/jsmain.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { parseNethackrc } from '../js/options.js';
import { ATR_INVERSE } from '../js/terminal.js';
import { memoryStorage } from './support/memory-storage.js';
const CHARACTER = 'OPTIONS=name:Traveler,role:ranger,race:human,gender:male,align:neutral';
const PLAY = 'OPTIONS=!legacy,!tutorial,!autopickup';
async function start(options) {
    return runSegment({
        seed: 73, datetime: '20260830120000', moves: '', storage: memoryStorage(),
        nethackrc: [CHARACTER, PLAY, options].join('\n'),
    });
}
function screen(engine) {
    assert.ok(engine.display);
    return engine.display.grid.map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n');
}
function acknowledgmentIsHighlighted(engine) {
    assert.ok(engine.display);
    const row = engine.display.grid[engine.display.cursorRow];
    assert.ok(row);
    assert.match(row.map(cell => cell.ch).join(''), /^Hit space to continue: /);
    return row.slice(0, 'Hit space to continue: '.length).every(cell => (cell.attr & ATR_INVERSE) !== 0);
}
void test('an unknown pet type is reported before game creation and waits for acknowledgment', async () => {
    const engine = await start('OPTIONS=pettype:lizard');
    assert.match(screen(engine), / \* Line 3: Unrecognized pet type 'lizard'\./);
    assert.match(screen(engine), /1 error in \.nethackrc\./);
    assert.match(screen(engine), /Hit space to continue:/);
    assert.doesNotMatch(screen(engine), /--More--/);
    assert.equal(engine.state.moves, 0);
    assert.equal(engine.state.level, null);
    engine.inputGate.feed('x');
    await engine.runUntilInputNeeded();
    assert.equal(engine.state.level, null);
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    assert.equal(engine.state.moves, 1);
    assert.equal(MONSTER_NAME[engine.state.context.startingpet_typ ?? -1], 'little dog');
    assert.doesNotMatch(screen(engine), /Unrecognized pet type|Hit space to continue/);
});
for (const [tabs, column] of [['\t', 16], ['\t\t', 24]]) {
    void test(`an echoed pet option advances tabs to column ${column}`, async () => {
        const engine = await start(`OPTIONS=${tabs}pettype:lizard`);
        const sourceLine = screen(engine).split('\n').find(line => line.startsWith('OPTIONS='));
        assert.ok(sourceLine, 'the rejected option line should be visible');
        assert.equal(sourceLine.indexOf('pettype'), column, sourceLine);
        assert.match(screen(engine), /Line 3: Unrecognized pet type 'lizard'\./);
    });
}
for (const option of ['pettype', 'pet:']) {
    void test(`a missing value for ${option} reports the supplied option spelling`, async () => {
        const engine = await start(`OPTIONS=${option}`);
        assert.ok(screen(engine).includes(` * Line 3: Missing parameter for '${option}'.`));
        assert.match(screen(engine), /1 error in \.nethackrc\./);
    });
}
for (const option of ['dogname', 'catname', 'horsename']) {
    for (const suffix of ['', ':Replacement']) {
        void test(`negated ${option}${suffix} reports the native negation error`, async () => {
            const engine = await start(`OPTIONS=!${option}${suffix}`);
            assert.ok(screen(engine).includes(` * Line 3: The ${option} option may not both have a value and be negated.`));
            assert.match(screen(engine), /1 error in \.nethackrc\./);
        });
    }
    void test(`${option} longer than the option limit is rejected before copying the name`, async () => {
        const engine = await start(`OPTIONS=${option}:${'a'.repeat(129)}`);
        assert.match(screen(engine), / \* Line 3: Option too long, max length is 128 characters\./);
        assert.match(screen(engine), /1 error in \.nethackrc\./);
        engine.inputGate.feed(' ');
        await engine.runUntilInputNeeded();
        assert.equal(engine.state.flags[option], undefined);
    });
    void test(`${option} truncates a long name and sanitizes controls without a configuration error`, async () => {
        const engine = await start(`OPTIONS=${option}:A\x01${'b'.repeat(PL_PSIZ)}`);
        assert.equal(engine.state.flags[option], `A.${'b'.repeat(PL_PSIZ - 3)}`);
        assert.equal(engine.state.moves, 1);
        assert.doesNotMatch(screen(engine), /error in|Hit space to continue/);
    });
    void test(`${option} without a value is silently ignored`, async () => {
        const engine = await start(`OPTIONS=${option}:`);
        assert.equal(engine.state.moves, 1);
        assert.equal(engine.state.flags[option], undefined);
        assert.doesNotMatch(screen(engine), /error in|Hit space to continue/);
    });
    void test(`a repeated ${option} warns but still replaces the name`, async () => {
        const engine = await start(`OPTIONS=${option}:Sirius\nOPTIONS=${option}:Orion`);
        assert.ok(screen(engine).includes(`Line 4: compound option specified multiple times: ${option}.`));
        assert.match(screen(engine), /1 error in \.nethackrc\./);
        engine.inputGate.feed(' ');
        await engine.runUntilInputNeeded();
        assert.equal(engine.state.flags[option], 'Orion');
    });
}
void test('pet errors accumulate right to left and echo each source line only once', async () => {
    const engine = await start('# comment\n\nOPTIONS=pettype:lizard,!catname:Mews,!dogname:Wags');
    const text = screen(engine);
    assert.equal(text.split('OPTIONS=pettype:lizard,!catname:Mews,!dogname:Wags').length - 1, 1);
    const dog = text.indexOf('Line 5: The dogname option');
    const cat = text.indexOf('Line 5: The catname option');
    const pet = text.indexOf("Line 5: Unrecognized pet type 'lizard'.");
    assert.ok(dog >= 0 && dog < cat && cat < pet, text);
    assert.match(text, /3 errors in \.nethackrc\./);
});
void test('a duplicate pet option warns and still applies the later physical line', async () => {
    const engine = await start('OPTIONS=pettype:cat\nOPTIONS=pet:dog');
    assert.match(screen(engine), /Line 4: compound option specified multiple times: pettype \(via alias: pet\)\./);
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    assert.equal(engine.state.preferred_pet, 'd');
});
for (const options of ['pettype:cat,pet:dog', 'pet:cat,pettype:dog']) {
    void test(`a duplicate in ${options} retains the pet alias in its warning`, async () => {
        const engine = await start(`OPTIONS=${options}`);
        assert.match(screen(engine), /Line 3: compound option specified multiple times: pettype \(via alias: pet\)\./);
        assert.match(screen(engine), /1 error in \.nethackrc\./);
        engine.inputGate.feed(' ');
        await engine.runUntilInputNeeded();
        assert.equal(engine.state.preferred_pet, 'c');
    });
}
void test('a pet alias applies to remaining duplicate warnings on its line and resets on the next line', async () => {
    const engine = await start('OPTIONS=pettype:none,pettype:cat,pet:dog\nOPTIONS=pettype:random');
    const text = screen(engine);
    assert.equal(text.split('Line 3: compound option specified multiple times: pettype (via alias: pet).').length - 1, 2);
    assert.match(text, /Line 4: compound option specified multiple times: pettype\.\n/);
    assert.match(text, /3 errors in \.nethackrc\./);
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    assert.equal(engine.state.preferred_pet, '');
});
for (const alias of ['permablind', '!permadeaf', 'prayconfirm', 'male', 'character:ranger', 'align:neutral', 'colour']) {
    void test(`a later ${alias} alias adds the pet alias to a duplicate warning`, async () => {
        const engine = await start(`OPTIONS=pettype:cat,pettype:dog,${alias}`);
        assert.match(screen(engine), /Line 3: compound option specified multiple times: pettype \(via alias: pet\)\./);
        assert.match(screen(engine), /1 error in \.nethackrc\./);
    });
}
void test('an alias to the left of duplicate pet options does not affect their warning', async () => {
    const engine = await start('OPTIONS=permablind,pettype:cat,pettype:dog');
    assert.match(screen(engine), /Line 3: compound option specified multiple times: pettype\.\n/);
});
for (const option of ['dogname', 'catname', 'horsename']) {
    void test(`a duplicate ${option} after another alias reports its absent native alias`, async () => {
        const engine = await start(`OPTIONS=${option}:Sirius,${option}:Orion,permablind`);
        const text = screen(engine).replaceAll('\n', '');
        assert.ok(text.includes(`compound option specified multiple times: ${option} (via alias: (null)).`), text);
    });
}
void test('parsed file settings are live while a pet error awaits acknowledgment', async () => {
    const engine = await start('OPTIONS=pettype:none,catname:Mews,!dogname');
    assert.match(screen(engine), /The dogname option/);
    assert.equal(engine.state.preferred_pet, 'n');
    assert.equal(engine.state.flags.catname, 'Mews');
    assert.equal(engine.state.plname, 'Traveler');
    assert.equal(engine.state.level, null);
});
async function startEnvironment(nethackOptions, options = '') {
    const engine = new Engine({
        seed: 73, datetime: '20260830120000', display: new GameDisplay(null),
        storage: memoryStorage(), nethackOptions,
        nethackrc: [CHARACTER, PLAY, options].join('\n'),
    });
    await engine.runUntilInputNeeded();
    return engine;
}
void test('each configuration source applies settings before its own acknowledgment', async () => {
    const engine = await startEnvironment('pettype:cat,dogname:Wags,!catname', 'OPTIONS=pettype:none,catname:Mews,!dogname');
    assert.match(screen(engine), /1 error in \.nethackrc\./);
    assert.equal(engine.state.preferred_pet, 'n');
    assert.equal(engine.state.flags.catname, 'Mews');
    assert.equal(engine.state.flags.dogname, undefined);
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    assert.match(screen(engine), /1 error in NETHACKOPTIONS\./);
    assert.match(screen(engine), /1 error in \.nethackrc\./);
    assert.equal(engine.state.preferred_pet, 'c');
    assert.equal(engine.state.flags.catname, 'Mews');
    assert.equal(engine.state.flags.dogname, 'Wags');
    assert.equal(engine.state.level, null);
});
void test('environment errors omit file lines and retain the last valid pet preference', async () => {
    const engine = await startEnvironment('pettype:lizard', 'OPTIONS=pettype:cat');
    assert.match(screen(engine), / \* Unrecognized pet type 'lizard'\./);
    assert.match(screen(engine), /1 error in NETHACKOPTIONS\./);
    assert.doesNotMatch(screen(engine), /Line \d|OPTIONS=/);
    assert.equal(engine.state.moves, 0);
    engine.inputGate.feed('\r');
    await engine.runUntilInputNeeded();
    assert.equal(engine.state.preferred_pet, 'c');
    assert.equal(engine.state.moves, 1);
});
void test('environment options override the file and permit repeated pet options', async () => {
    const engine = await startEnvironment('pettype:dog,pettype:cat', 'OPTIONS=pettype:none');
    assert.equal(engine.state.preferred_pet, 'd');
    assert.equal(engine.state.moves, 1);
    assert.doesNotMatch(screen(engine), /error in|Hit space to continue/);
});
void test('an empty environment option list reports an empty statement', async () => {
    const engine = await startEnvironment('');
    assert.match(screen(engine), / \* Empty statement\./);
    assert.match(screen(engine), /1 error in NETHACKOPTIONS\./);
});
void test('environment option length includes leading whitespace before trimming', async () => {
    const engine = await startEnvironment(` dogname:${'a'.repeat(120)}`);
    assert.match(screen(engine), /Option too long, max length is 128 characters\./);
    assert.match(screen(engine), /1 error in NETHACKOPTIONS\./);
});
void test('a 128-byte name option is accepted and truncated to the pet-name limit', async () => {
    const engine = await startEnvironment(`dogname:${'a'.repeat(120)}`);
    assert.equal(engine.state.flags.dogname, 'a'.repeat(PL_PSIZ - 1));
    assert.equal(engine.state.moves, 1);
    assert.doesNotMatch(screen(engine), /error in|Hit space to continue/);
});
void test('file and environment errors require separate acknowledgments before the name prompt', async () => {
    const engine = new Engine({
        seed: 73, display: new GameDisplay(null), storage: memoryStorage(),
        nethackrc: 'OPTIONS=!dogname', nethackOptions: 'pettype:lizard',
        nethackrcFileName: '/config/pets.rc',
    });
    await engine.runUntilInputNeeded();
    assert.match(screen(engine), /1 error in \/config\/pets\.rc\./);
    assert.doesNotMatch(screen(engine), /NETHACKOPTIONS|Who are you/);
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    assert.match(screen(engine), /1 error in NETHACKOPTIONS\./);
    assert.doesNotMatch(screen(engine), /Who are you/);
    assert.equal(engine.state.level, null);
    engine.inputGate.feed('\x1b');
    await engine.runUntilInputNeeded();
    assert.match(screen(engine), /Who are you\?/);
    assert.doesNotMatch(screen(engine), /error in|Hit space to continue/);
});
void test('a continued option line reports its final physical line and echoes it without condensing spaces', async () => {
    const engine = await start('OPTIONS=!dogname:Wags,\\\n   pettype:lizard');
    const text = screen(engine);
    assert.match(text, /\n   pettype:lizard\n/);
    assert.match(text, /Line 4: Unrecognized pet type 'lizard'\./);
    assert.match(text, /Line 4: The dogname option/);
    assert.match(text, /2 errors in \.nethackrc\./);
    assert.doesNotMatch(text, /OPTIONS=!dogname/);
});
void test('spaces before a continuation remain part of a pet name', async () => {
    const engine = await start('OPTIONS=dogname:Sir  \\\nWags');
    assert.equal(engine.state.flags.dogname, 'Sir   Wags');
});
for (const ending of ['# finish', ' \t']) {
    void test(`a continuation ending with ${JSON.stringify(ending)} trims trailing spaces before the option limit`, async () => {
        const engine = await start(`OPTIONS=dogname:${'a'.repeat(120)} \t\\\n${ending}`);
        assert.equal(engine.state.flags.dogname, 'a'.repeat(PL_PSIZ - 1));
        assert.equal(engine.state.moves, 1);
        assert.doesNotMatch(screen(engine), /Option too long|Hit space to continue/);
    });
    void test(`a continuation ending with ${JSON.stringify(ending)} still rejects a 129-byte option`, async () => {
        const engine = await start(`OPTIONS=dogname:${'a'.repeat(121)} \t\\\n${ending}`);
        assert.match(screen(engine), /Option too long, max length is 128 characters\./);
        assert.equal(engine.state.flags.dogname, undefined);
    });
}
void test('a pet type value keeps the space after its delimiter for native rejection', async () => {
    const engine = await start('OPTIONS=pettype:   dog');
    assert.match(screen(engine), /Unrecognized pet type '   dog'\./);
});
for (const option of ['dogname', 'catname', 'horsename']) {
    void test(`${option} keeps repeated spaces and sanitizes tabs in file values`, async () => {
        const engine = await start(`OPTIONS=${option}:Sir  \tWags`);
        assert.equal(engine.state.flags[option], 'Sir  .Wags');
        assert.equal(engine.state.moves, 1);
    });
}
for (const [description, value] of [
    ['leading whitespace', ` ${'a'.repeat(120)}`],
    ['repeated internal whitespace', `A${' '.repeat(120)}B`],
]) {
    void test(`file option length includes ${description} in the value`, async () => {
        const engine = await start(`OPTIONS=dogname:${value}`);
        assert.match(screen(engine), /Option too long, max length is 128 characters\./);
        engine.inputGate.feed(' ');
        await engine.runUntilInputNeeded();
        assert.equal(engine.state.flags.dogname, undefined);
    });
}
void test('file option length includes the space immediately after OPTIONS=', async () => {
    const engine = await start(`OPTIONS= dogname:${'a'.repeat(120)}`);
    assert.match(screen(engine), /Option too long, max length is 128 characters\./);
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    assert.equal(engine.state.flags.dogname, undefined);
});
for (const [description, padding] of [['ASCII', 'a'.repeat(1000)], ['UTF-8', 'é'.repeat(500)]]) {
    void test(`a continued ${description} statement discards options past the file buffer limit`, () => {
        const settings = parseNethackrc(`OPTIONS=dogname:${padding}\\\n,pettype:none`);
        assert.equal(settings.preferred_pet, undefined);
        assert.equal(settings.flags.dogname, undefined);
        assert.ok(settings.configErrors.some(report => report.errors.some(error => /Option too long/.test(error.message))));
    });
}
void test('a name cut off inside a UTF-8 character sanitizes only the retained byte', () => {
    const settings = parseNethackrc(`OPTIONS=${'x'.repeat(1004)},\\\ndogname:é`);
    assert.equal(settings.flags.dogname, '_');
});
for (const [description, ending] of [['without a final newline', '\\'], ['with a final newline', '\\\n']]) {
    void test(`an unfinished continuation ${description} is discarded at EOF`, async () => {
        const engine = await start(`OPTIONS=pettype:cat,${ending}`);
        assert.equal(engine.state.moves, 1);
        assert.equal(MONSTER_NAME[engine.state.context.startingpet_typ ?? -1], 'little dog');
        assert.doesNotMatch(screen(engine), /Empty statement|error in|Hit space to continue/);
    });
}
void test('a long source echo is shortened with an ellipsis and keeps its final three characters', async () => {
    const engine = await start(`OPTIONS=dogname:${'a'.repeat(400)}END`);
    assert.match(screen(engine), /aaa\.\.\.END\n/);
    assert.match(screen(engine), /Option too long, max length is 128 characters\./);
    assert.ok(engine.display);
    assert.equal(engine.display.cursorRow, 10);
    assert.equal(engine.display.cursorCol, 'Hit space to continue: '.length);
});
for (const standout of [false, true]) {
    void test(`the error acknowledgment uses standout=${standout} at the end of each source`, async () => {
        const engine = await startEnvironment(`${standout ? '!' : ''}standout,pettype:lizard`, `OPTIONS=${standout ? '' : '!'}standout,pettype:lizard`);
        assert.match(screen(engine), /1 error in \.nethackrc\./);
        assert.equal(acknowledgmentIsHighlighted(engine), standout);
        engine.inputGate.feed(' ');
        await engine.runUntilInputNeeded();
        assert.match(screen(engine), /1 error in NETHACKOPTIONS\./);
        assert.equal(acknowledgmentIsHighlighted(engine), !standout);
    });
}
void test('the option length limit counts UTF-8 bytes before name sanitization', async () => {
    const engine = await start(`OPTIONS=dogname:${'é'.repeat(61)}`);
    assert.match(screen(engine), /Option too long, max length is 128 characters\./);
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    assert.equal(engine.state.flags.dogname, undefined);
});
void test('a pet name exceeding the file buffer is skipped before option parsing', async () => {
    const engine = await start(`OPTIONS=dogname:${'a'.repeat(1100)}`);
    // Native rejects an overfull fgets buffer before config_error_nextline().
    assert.match(screen(engine), /Line 2: Line too long, skipping\./);
    assert.match(screen(engine), /1 error in \.nethackrc\./);
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    assert.equal(engine.state.flags.dogname, undefined);
});
for (const value of ['', ':']) {
    void test(`negated pettype${value} with no value suppresses the pet without an error`, async () => {
        const engine = await start(`OPTIONS=!pettype${value}`);
        assert.equal(engine.state.preferred_pet, 'n');
        assert.equal(engine.state.context.startingpet_typ, -1);
        assert.doesNotMatch(screen(engine), /error in|Hit space to continue/);
    });
}
//# sourceMappingURL=pet_config_errors.test.js.map