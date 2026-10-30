import assert from 'node:assert/strict';
import test from 'node:test';

import { Engine, runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';

async function start(wizard = true, configuration = ''): Promise<Engine> {
    return runSegment({
        seed: 71, datetime: '20000110090000', moves: '', storage: memoryStorage(),
        nethackrc: [
            'OPTIONS=name:Traveler,role:wizard,race:human,gender:male,align:neutral',
            'OPTIONS=!legacy,!tutorial,!news,!autopickup,!tips,pettype:none,!menu_overlay',
            wizard ? 'OPTIONS=playmode:debug' : '', configuration,
        ].join('\n'),
    });
}

function screen(engine: Engine): string {
    assert.ok(engine.display);
    return engine.display.grid.map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n');
}

async function press(engine: Engine, keys: string): Promise<void> {
    engine.inputGate.feed(keys);
    assert.equal((await engine.runUntilInputNeeded()).kind, 'input-needed');
}

async function findRow(engine: Engine, name: string): Promise<string> {
    for (;;) {
        const view = screen(engine);
        const row = view.split('\n').find(line =>
            line.replace(/^\s*[a-zA-Z] [-+*] /, '').trimStart()
                .replace(/^\* /, '').startsWith(`${name} `));
        if (row) return row;
        const page = view.match(/\((\d+) of (\d+)\)/);
        assert.ok(page && page[1] !== page[2], `Menu does not offer ${name}:\n${view}`);
        await press(engine, ' ');
    }
}

function selector(row: string): string {
    const key = row.match(/^\s*([a-zA-Z]) [-+*] /)?.[1];
    assert.ok(key, `Expected a selectable menu row: ${row}`);
    return key;
}

void test('the full wizard options menu offers its debugging booleans in native order', async () => {
    const engine = await start(true, 'OPTIONS=debug_hunger,debug_mongen,debug_overwrite_stairs');
    const moves = engine.state.moves;
    await press(engine, '#optionsfull\r');

    for (const name of ['debug_hunger', 'debug_mongen', 'debug_overwrite_stairs',
        'sanity_check', 'travel_debug', 'wizmgender', 'wizweight']) {
        const row = await findRow(engine, name);
        assert.match(row, /\[false\]$/);
        selector(row);
    }
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
        if (page[1] === page[2]) break;
        await press(engine, ' ');
    }
    await press(engine, '\x1b');
});

void test('the autocomplete setting aligns its value with the other full-menu settings', async () => {
    const engine = await start(false, 'AUTOCOMPLETE=wizwish,!wait');
    await press(engine, '#optionsfull\r');
    const completion = await findRow(engine, 'autocompletions');
    const exceptions = await findRow(engine, 'autopickup exceptions');

    assert.match(completion, /\[\(1 currently set\)\]$/);
    assert.equal(completion.indexOf('['), exceptions.indexOf('['),
        `Option values should share a column:\n${completion}\n${exceptions}`);
    await press(engine, '\x1b');
});

void test('the autocomplete editor changes completion and returns directly to command input', async () => {
    const engine = await start(true, 'AUTOCOMPLETE=wizwish,!wait');
    const moves = engine.state.moves;
    await press(engine, '#optionsfull\r');
    const option = await findRow(engine, 'autocompletions');
    await press(engine, `${selector(option)}\r`);
    assert.match(screen(engine), /Which commands autocomplete\?/);

    const command = await findRow(engine, 'wizwish:');
    assert.match(command, /\* \* wizwish:/);
    await press(engine, `${selector(command)}\r`);
    assert.equal(engine.state.moves, moves);
    assert.doesNotMatch(screen(engine), /Which commands autocomplete\?|--More--/);

    await press(engine, '#wizwi');
    assert.match(screen(engine), /^# wizwi\s/m);
    await press(engine, '\x1b\x1b#optionsfull\r');
    assert.match(await findRow(engine, 'autocompletions'), /\[\(0 currently set\)\]$/);
    await press(engine, '\x1b');
    assert.equal(engine.state.moves, moves);
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
