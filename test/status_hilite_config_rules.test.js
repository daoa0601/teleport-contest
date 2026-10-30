import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { applyNethackrc } from '../js/options.js';
import { setTextOption } from '../js/option_values.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { capturedScreen, requireScreenRow, screenText } from './support/screen.js';
import { ATR_BOLD, ATR_INVERSE, CLR_ORANGE, CLR_RED, NO_COLOR } from '../js/terminal.js';
async function configure(...lines) {
    await freshObjectRoom({ hero: { uhp: 3, blindTurns: 10 } });
    applyNethackrc(lines.join('\n'));
}
function statusCell(text) {
    const cells = requireScreenRow(23);
    const row = cells.map(cell => cell.ch).join('');
    const column = row.indexOf(text);
    assert.ok(column >= 0, `Expected '${text}' on status line: ${row}`);
    const cell = cells[column];
    assert.ok(cell);
    return cell;
}
void test('configured thresholds and condition attributes appear on the status line', async () => {
    await configure('OPTIONS=hilite_status:hp/<10%/red+bold', 'HILITE_STATUS=condition/blind/orange&inverse');
    await bot();
    assert.equal(statusCell('HP:3').color, CLR_RED);
    assert.equal(statusCell('HP:3').attr, ATR_BOLD);
    assert.equal(statusCell('Blind').color, CLR_ORANGE);
    assert.equal(statusCell('Blind').attr, ATR_INVERSE);
});
for (const statement of ['OPTIONS=hilite_status:', 'HILITE_STATUS=']) {
    void test(`${statement} keeps a threshold preceding an invalid field`, async () => {
        await configure('OPTIONS=statushilites:3', `${statement}hp/<10%/red bogus/red`);
        await bot();
        assert.equal(statusCell('HP:3').color, CLR_RED);
    });
}
void test('a condition attribute preceding an invalid color remains visible', async () => {
    await configure('OPTIONS=statushilites:3', 'HILITE_STATUS=condition/blind/inverse+bogus');
    await bot();
    assert.equal(statusCell('Blind').attr, ATR_INVERSE);
});
void test('an in-game hilite_status entry creates the first threshold', async () => {
    await configure();
    await setTextOption('hilite_status', 'hp/<10%/red');
    await bot();
    assert.equal(statusCell('HP:3').color, CLR_RED);
});
for (const inGame of [false, true]) {
    void test(`a ${inGame ? 'live' : 'configured'} rule turns disabled highlighting back on`, async () => {
        await configure('OPTIONS=!statushilites');
        if (inGame)
            await setTextOption('hilite_status', 'hp/red');
        else
            applyNethackrc('OPTIONS=hilite_status:hp/red');
        await bot();
        assert.equal(statusCell('HP:3').color, CLR_RED);
    });
}
void test('a later statushilites negation leaves highlighting disabled', async () => {
    await configure('OPTIONS=hilite_status:hp/red', 'OPTIONS=!statushilites');
    await bot();
    assert.equal(statusCell('HP:3').color, NO_COLOR);
});
void test('an ambiguous condition alias highlights every matching group', async () => {
    await configure('OPTIONS=hilite_status:condition/m/red');
    game.u.strangledTurns = 5;
    await bot();
    assert.equal(statusCell('Blind').color, CLR_RED);
    assert.equal(statusCell('Strngl').color, CLR_RED);
});
for (const trailing of ['+', '&']) {
    void test(`a trailing '${trailing}' after a color is accepted`, async () => {
        await configure(`OPTIONS=hilite_status:hp/red${trailing}`);
        await bot();
        assert.equal(statusCell('HP:3').color, CLR_RED);
    });
}
void test('too many action subfields leave the threshold unset', async () => {
    await configure(`HILITE_STATUS=hp/${['red', ...Array(15).fill('bold')].join('+')}`);
    await bot();
    assert.equal(statusCell('HP:3').color, NO_COLOR);
});
void test('reaching the native field length ends parsing before the next rule', async () => {
    await configure(`HILITE_STATUS=title/${'a'.repeat(126)}/red hp/red`);
    await bot();
    assert.equal(statusCell('HP:3').color, NO_COLOR);
});
void test('negated hilite_status clears thresholds and retains condition colors', async () => {
    await configure('OPTIONS=hilite_status:hp/red condition/blind/orange', 'OPTIONS=!hilite_status:x');
    await bot();
    assert.equal(statusCell('HP:3').color, NO_COLOR);
    assert.equal(statusCell('Blind').color, CLR_ORANGE);
});
for (const [value, messages] of [
    ['hp/bogus', ["Unknown color 'bogus'", "bad color '16 -1'"]],
    ['condition/blind/bogus', ["Unknown color 'bogus'", 'bad color 16']],
    ['hp/>-1%/red', ["hilite_status: invalid percentage value '>-1%'"]],
    ['hp/<101%/red', ["hilite_status: invalid percentage value '<101%'"]],
    ['', ['Value is mandatory for hilite_status']],
    ['bogusfield/red', ["Unknown status field 'bogusfield'"]],
]) {
    void test(`invalid hilite_status '${value}' displays the native diagnostics`, async () => {
        const engine = new Engine({ seed: 13, datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:Nomad,role:wizard,race:human,gender:male,align:neutral\n'
                + 'OPTIONS=!legacy,!tutorial,!news,playmode:debug\n'
                + `OPTIONS=hilite_status:${value}\n`,
            display: new GameDisplay(null), storage: memoryStorage() });
        await engine.runUntilInputNeeded();
        const screen = screenText(capturedScreen(engine));
        let previous = -1;
        for (const message of messages) {
            const position = screen.indexOf(message);
            assert.ok(position > previous, `Expected '${message}' after earlier diagnostics:\n${screen}`);
            previous = position;
        }
    });
}
void test('a retained status repaint keeps its highlight while updates are deferred', async () => {
    await configure('OPTIONS=hilite_status:hp/red+bold');
    await bot();
    // Menus defer status evaluation while retaining the visible status fields.
    game._statusUpdatesDisabled = true;
    await flush_screen(1);
    assert.equal(statusCell('HP:3').color, CLR_RED);
    assert.equal(statusCell('HP:3').attr, ATR_BOLD);
});
//# sourceMappingURL=status_hilite_config_rules.test.js.map