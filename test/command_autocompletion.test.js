import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { clearMessageWindow, docrt, flush_screen } from '../js/display.js';
import { Engine, runSegment } from '../js/jsmain.js';
import { makemonAt, makemonNear } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { enableRngLog, getRngLog } from '../js/rng.js';
import { vision_recalc, vision_reset } from '../js/vision.js';
import { memoryStorage } from './support/memory-storage.js';
import { createRoomLevel } from './support/playable-room.js';
import { screenText } from './support/screen.js';
async function start(wizard = true, configuration = '') {
    return runSegment({
        seed: 71, datetime: '20000110090000', moves: '', storage: memoryStorage(),
        nethackrc: [
            'OPTIONS=name:Traveler,role:wizard,race:human,gender:male,align:neutral',
            'OPTIONS=!legacy,!tutorial,!news,!autopickup,!tips,pettype:none,!menu_overlay',
            wizard ? 'OPTIONS=playmode:debug' : '', configuration,
        ].join('\n'),
    });
}
function screen(engine) {
    assert.ok(engine.display);
    return engine.display.grid.map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n');
}
async function press(engine, keys) {
    engine.inputGate.feed(keys);
    assert.equal((await engine.runUntilInputNeeded()).kind, 'input-needed');
}
async function findRow(engine, name) {
    for (;;) {
        const view = screen(engine);
        const row = view.split('\n').find(line => line.replace(/^\s*[a-zA-Z] [-+*] /, '').trimStart().startsWith(`${name} `));
        if (row)
            return row;
        const page = view.match(/\((\d+) of (\d+)\)/);
        assert.ok(page && page[1] !== page[2], `Menu does not offer ${name}:\n${view}`);
        await press(engine, ' ');
    }
}
function selector(row) {
    const key = row.match(/^\s*([a-zA-Z]) [-+*] /)?.[1];
    assert.ok(key, `Expected a selectable menu row: ${row}`);
    return key;
}
void test('the full wizard options menu offers its debugging booleans in native order', async () => {
    const engine = await start(true, 'OPTIONS=debug_hunger,debug_mongen,debug_overwrite_stairs');
    const moves = engine.state.moves;
    await press(engine, '#optionsfull\r');
    const wizardNames = ['debug_hunger', 'debug_mongen', 'debug_overwrite_stairs',
        'sanity_check', 'travel_debug', 'wizmgender', 'wizweight'];
    const displayedNames = [];
    for (;;) {
        const view = screen(engine);
        for (const row of view.split('\n')) {
            const name = row.match(/^\s*[a-zA-Z] [-+] (\S+)\s+\[/)?.[1];
            if (!name || !wizardNames.includes(name))
                continue;
            displayedNames.push(name);
            assert.match(row, /\[false\]$/);
            selector(row);
        }
        const page = view.match(/\((\d+) of (\d+)\)/);
        assert.ok(page, `Expected the full options menu:\n${view}`);
        if (page[1] === page[2])
            break;
        await press(engine, ' ');
    }
    assert.deepEqual(displayedNames, wizardNames, 'Wizard rows should follow optlist.h order');
    await press(engine, '\x1b');
    assert.equal(engine.state.moves, moves);
});
void test('selecting a wizard boolean changes the value offered on the next options visit', async () => {
    const engine = await start(true, 'OPTIONS=!fixinv');
    const item = engine.state.inventory[0];
    assert.ok(item, 'The wizard starts with an inventory item');
    item.invlet = 'z';
    const moves = engine.state.moves;
    await press(engine, '#optionsfull\r');
    const row = await findRow(engine, 'wizweight');
    await press(engine, `${selector(row)}\r`);
    assert.equal(engine.state.iflags.wizweight, true);
    assert.equal(item.invlet, 'a', 'Changing wizweight should reassign nonconstant inventory letters');
    assert.match(screen(engine), /'wizweight' option toggled on\./);
    await press(engine, '#optionsfull\r');
    assert.match(await findRow(engine, 'wizweight'), /\[true\]$/);
    await press(engine, '\x1b');
    await press(engine, 'i');
    assert.match(screen(engine), /\(\d+ aum\)/, 'Inventory items should display their weights');
    await press(engine, '\x1b');
    assert.equal(engine.state.moves, moves);
});
void test('enabling debug_hunger in the full menu stops nutrition loss on later turns', async () => {
    const engine = await start();
    await press(engine, '#optionsfull\r');
    const row = await findRow(engine, 'debug_hunger');
    await press(engine, `${selector(row)}\r`);
    const nutrition = engine.state.u.uhunger;
    const moves = engine.state.moves;
    await press(engine, '.');
    assert.equal(engine.state.moves, moves + 1);
    assert.equal(engine.state.u.uhunger, nutrition);
});
void test('ordinary play hides wizard options from the full options menu', async () => {
    const engine = await start(false);
    await press(engine, '#optionsfull\r');
    for (;;) {
        const view = screen(engine);
        assert.doesNotMatch(view, /debug_hunger|debug_mongen|debug_overwrite_stairs|sanity_check|travel_debug|wizmgender|wizweight/);
        const page = view.match(/\((\d+) of (\d+)\)/);
        assert.ok(page, `Expected a paged options menu:\n${view}`);
        if (page[1] === page[2])
            break;
        await press(engine, ' ');
    }
    await press(engine, '\x1b');
});
void test('closing the command list restores status before reading another extended command', async () => {
    const engine = await start();
    const moves = engine.state.moves;
    await press(engine, '#?\r');
    assert.match(screen(engine), /Extended Commands List/);
    await press(engine, '\x1b');
    const rows = screen(engine).split('\n');
    assert.equal(rows[0], '#');
    assert.match(rows[22] ?? '', /St:/, 'The hero attributes should be visible at the next # prompt');
    assert.match(rows[23] ?? '', /HP:\d+\(\d+\)/, 'The hero health should be visible at the next # prompt');
    assert.equal(engine.state.moves, moves);
    await press(engine, '\x1b');
});
for (const species of [null, MONSTER_NAME.indexOf('newt')]) {
    for (const nearby of [false, true]) {
        const placement = nearby ? 'nearby' : 'randomly placed';
        const kind = species === null ? 'random' : 'explicit';
        void test(`debug_mongen blocks ${placement} ${kind} births before random draws`, async () => {
            const engine = await start();
            await press(engine, '#optionsfull\r');
            const row = await findRow(engine, 'debug_mongen');
            await press(engine, `${selector(row)}\r`);
            const population = engine.state.level?.monsters.length;
            enableRngLog();
            const create = () => nearby
                ? makemonNear(species, engine.state.u.ux, engine.state.u.uy, MM_NOGRP | MM_NOMSG | NO_MINVENT)
                : makemonAt(species, 0, 0, MM_NOGRP | MM_NOMSG | NO_MINVENT);
            const monster = await create();
            assert.equal(monster, null);
            assert.equal(engine.state.level?.monsters.length, population);
            assert.equal(getRngLog().length, 0, 'Rejected births should not consume random draws');
            await press(engine, '#optionsfull\r');
            const enabled = await findRow(engine, 'debug_mongen');
            assert.match(enabled, /\[true\]$/);
            await press(engine, `${selector(enabled)}\r`);
            assert.ok(await create(), 'Turning debug_mongen off should allow births again');
        });
    }
}
function showsWarning(frame, x, y, symbol) {
    return screenText(frame.screen).split('\n')[y + 1]?.charAt(x - 1) === symbol;
}
function warningPause(frames, x, y, symbol) {
    const start = frames.findIndex(frame => showsWarning(frame, x, y, symbol));
    assert.ok(start >= 0, `Travel should display warning ${symbol} at <${x},${y}>`);
    let end = start;
    while (end < frames.length) {
        const frame = frames[end];
        if (!frame || !showsWarning(frame, x, y, symbol))
            break;
        end++;
    }
    return end - start;
}
async function travelAcrossRoom(engine, targetX) {
    engine.state.level = createRoomLevel({ left: 10, right: 14, top: 10, bottom: 10 });
    engine.state.stairs = null;
    engine.state.u.ux = 10;
    engine.state.u.uy = 10;
    engine.state._travelTarget = { x: targetX, y: 10 };
    vision_reset();
    vision_recalc(0);
    clearMessageWindow();
    await docrt();
    await flush_screen(1);
    const captured = engine.getAnimationFramesByStep().length;
    await press(engine, '\x1f');
    return engine.getAnimationFramesByStep().slice(captured).flat();
}
for (const runmode of ['run', 'crawl']) {
    void test(`travel_debug displays the search frontier in ${runmode} mode`, async () => {
        const engine = await start(true, `OPTIONS=runmode:${runmode}`);
        await press(engine, '#optionsfull\r');
        const row = await findRow(engine, 'travel_debug');
        await press(engine, `${selector(row)}\r`);
        const frames = await travelAcrossRoom(engine, 14);
        assert.equal(warningPause(frames, 13, 10, '1'), runmode === 'crawl' ? 3 : 1);
        assert.equal(engine.state.u.ux, 14);
        assert.doesNotMatch(screen(engine).split('\n')[11] ?? '', /[12]/, 'Temporary search glyphs should be restored after travel');
    });
    void test(`travel_debug marks the guessed destination in ${runmode} mode`, async () => {
        const engine = await start(true, `OPTIONS=travel_debug,runmode:${runmode}`);
        const frames = await travelAcrossRoom(engine, 20);
        assert.equal(warningPause(frames, 14, 10, '2'), runmode === 'crawl' ? 5 : 1);
        assert.equal(engine.state.u.ux, 14, 'Travel should approach the unreachable destination');
        assert.doesNotMatch(screen(engine).split('\n')[11] ?? '', /[12]/, 'The guessed-destination glyph should be restored after travel');
    });
}
void test('travel without travel_debug does not display search warnings', async () => {
    const engine = await start(true, 'OPTIONS=runmode:crawl');
    const frames = await travelAcrossRoom(engine, 20);
    assert.ok(frames.length > 0, 'Crawl mode should still display movement frames');
    assert.ok(frames.every(frame => !/[12]/.test(screenText(frame.screen).split('\n')[11] ?? '')), 'Ordinary travel should leave the room free of search markers');
    assert.equal(engine.state.u.ux, 14);
});
//# sourceMappingURL=command_autocompletion.test.js.map