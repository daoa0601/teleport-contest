import type { InputGate } from '../js/input.js';
import { requireScreenCell } from './support/screen.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { flush_screen } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { ATR_INVERSE } from '../js/terminal.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { RLOC_NOMSG } from '../js/const.js';
import { initRng } from '../js/rng.js';
import { randomMonsterRelocation } from '../js/teleport.js';
import { createMonsterAt } from './support/monsters.js';
import { resetInputState } from '../js/input.js';
import { rhack } from '../js/cmd.js';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { showMultiSelectWindow } from '../js/windows.js';
import { freshObjectRoom } from './support/object-room.js';
import { DAGGER, LONG_SWORD } from '../js/object_data.js';
import { inventoryOrderSymbols, inventorySortMode, sortObjects } from '../js/object_sort.js';
import { knownObject } from './support/game-objects.js';

function visibleOptions() {
    assert.ok(game.nhDisplay);
    return game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

async function chooseOption(name: string, accept: boolean, followupKeys: string | null = null): Promise<string> {
    const input = resetInputState();
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('O');
    let selectedLine: string | null = null;
    let confirmed = false;
    const completed = command.then(() => 'completed' as const);
    for (let page = 0; page < 20; page++) {
        const boundary = await Promise.race([
            completed, input.waitUntilBlocked().then(() => 'input' as const),
        ]);
        if (boundary === 'completed') {
            assert.ok(selectedLine, `The ${name} option was not selected`);
            return selectedLine;
        }
        const screen = visibleOptions();
        if (screen.includes('--More--')) {
            input.feed(' ');
            continue;
        }
        if (confirmed) {
            assert.ok(followupKeys !== null, 'The option editor asked for additional input');
            input.feed(followupKeys);
            followupKeys = null;
            continue;
        }
        const row = screen.split('\n').find(line => line.includes(` ${name} `));
        const key = row?.match(/^\s*([a-zA-Z]) [-+] /)?.[1];
        if (key && !selectedLine) {
            assert.ok(row);
            selectedLine = row;
            input.feed(key);
        } else if (selectedLine) {
            confirmed = true;
            input.feed(accept ? '\n' : '\x1b');
        } else {
            assert.match(screen, /\(\d+ of \d+\)/, 'Expected another options page');
            input.feed(' ');
        }
    }
    assert.fail(`Option ${name} did not finish within 20 input boundaries`);
}

void test('Enter applies a selected advanced boolean without spending a turn', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.time = false;
    game.context.move = 0;
    await chooseOption('time', true);
    assert.equal(game.flags.time, true);
    assert.equal(game.context.move, 0);
});

void test('Escape cancels changes selected in the advanced options menu', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.time = false;
    await chooseOption('time', false);
    assert.equal(game.flags.time, false);
});

void test('advanced sortloot selection changes the ordering of carried items', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const sword = await knownObject(LONG_SWORD, { invlet: 'a' });
    const dagger = await knownObject(DAGGER, { invlet: 'b' });

    await chooseOption('sortloot', true, 'f');

    assert.deepEqual(sortObjects([sword, dagger], { mode: inventorySortMode() }), [dagger, sword]);
    assert.equal(game.context.move, 0);
});

void test('advanced packorder accepts class symbols and changes live inventory ordering', async () => {
    freshObjectRoom();
    requirePlayingGame(game);

    await chooseOption('packorder', true, '%)$\n');

    assert.match(inventoryOrderSymbols(), /^%\)\$/);
    assert.equal(game.context.move, 0);
});

void test('Escape in the loot-sort picker retains the previous setting', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.sortloot = 'f';

    await chooseOption('sortloot', true, '\x1b');

    assert.equal(game.flags.sortloot, 'f');
});

for (const keys of ['a\n', '@\n']) {
    void test(`read-only menu rows cannot be selected (${JSON.stringify(keys)})`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const input = resetInputState();
        input.feed(keys);
        const selected = await showMultiSelectWindow({
            title: 'Options',
            pageLocalKeys: true,
            sections: [{ heading: 'Booleans', items: [
                { selectable: false, text: 'Initial character choice' },
                { text: 'Show the turn count', value: 'time' },
            ] }],
        });
        assert.deepEqual(selected, ['time']);
    });
}

for (const enabled of [false, true]) {
    void test(`rc monster control ${enabled ? 'enabled' : 'disabled'} is visible in the Wizard options menu`, async () => {
        const engine = new Engine({
            seed: 1,
            display: new GameDisplay(null),
            nethackrc: `OPTIONS=name:wizard,role:valkyrie,race:human,gender:female,align:lawful,playmode:debug,!legacy,!tutorial,!tips,${enabled ? '' : '!'}montelecontrol`,
        });
        engine.inputGate.beforeRead = () => {
            const screen = visibleOptions();
            if (!screen.includes('--More--')) throw new Error(`Unexpected startup input: ${screen.split('\n')[0]}`);
            engine.inputGate.feed(' ');
        };
        await engine.start();
        try {
            const before = await chooseOption('montelecontrol', true);
            assert.ok(before.includes(`[${enabled}]`));
            const after = await chooseOption('montelecontrol', false);
            assert.ok(after.includes(`[${!enabled}]`));
        } finally {
            await engine.lua.destroy();
        }
    });
}

for (const savedValue of [false, true]) {
    void test(`restoring a game does not restore its monster-control setting (${savedValue})`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.plname = 'Control';
        game.flags.debug = true;
        if (savedValue) await chooseOption('montelecontrol', true);
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        await chooseOption('montelecontrol', true);

        assert.equal(restoreGame('Control', storage), true);

        const current = await chooseOption('montelecontrol', false);
        assert.ok(current.includes(`[${!savedValue}]`), 'the menu shows the current runtime setting, not the saved value');
    });
}

void test('ordinary play does not show the Wizard-only monster-control option', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.debug = false;
    const input = resetInputState();
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.beforeRead = () => {
        const screen = visibleOptions();
        assert.doesNotMatch(screen, /montelecontrol/);
        const page = screen.match(/\((\d+) of (\d+)\)/);
        input.feed(page && page[1] !== page[2] ? ' ' : '\x1b');
    };
    input.feed('O');
    await command;
});

void test('the in-game option enables real controlled monster relocation', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    game.flags.debug = true;
    game.flags.tips = game.flags.verbose = false;
    await chooseOption('montelecontrol', true);
    const orc = await createMonsterAt('orc', 14, 10);
    const input = resetInputState();
    input.feed('ll.');
    initRng(1n);

    await randomMonsterRelocation(orc, { flags: RLOC_NOMSG });

    assert.deepEqual([orc.mx, orc.my], [16, 10]);
});

void test('Wizard restore uses the fixed player name and retains the current rc control option', async () => {
    const storage = memoryStorage();
    const nethackrc = 'OPTIONS=name:AnotherName,role:valkyrie,race:human,gender:female,align:lawful,playmode:debug,!legacy,!tutorial,!tips';
    const first = new Engine({ seed: 1, storage, display: new GameDisplay(null), nethackrc });
    first.inputGate.beforeRead = () => first.inputGate.feed(' ');
    await first.start();
    game.u.uhp = 7;
    assert.equal(await saveGame(storage), true);
    await first.lua.destroy();
    const resumed = new Engine({
        seed: 2, storage, display: new GameDisplay(null),
        nethackrc: `${nethackrc},montelecontrol`,
    });
    resumed.inputGate.beforeRead = () => resumed.inputGate.feed(' ');
    try {
        await resumed.start();

        assert.equal(game.u.uhp, 7);
        const current = await chooseOption('montelecontrol', false);
        assert.ok(current.includes('[true]'));
    } finally {
        await resumed.lua.destroy();
    }
});

async function beginSelectedOptions(names: readonly string[]) {
    const input = resetInputState();
    const remaining = new Set(names);
    let confirmed = false;
    let pages = 0;
    const answerMenu = () => {
        if (confirmed) return;
        const rows = visibleOptions().split('\n');
        const row = rows.find(line => [...remaining].some(name => line.includes(` ${name} `)));
        if (row) {
            const name = [...remaining].find(candidate => row.includes(` ${candidate} `));
            const key = row.match(/^\s*([a-zA-Z]) [-+] /)?.[1];
            if (!key) throw new Error(`Option ${name} has no selectable key: ${row}`);
            assert.ok(name);
            remaining.delete(name);
            input.feed(key);
        } else if (!remaining.size) {
            confirmed = true;
            input.feed('\n');
        } else {
            if (++pages > 12) throw new Error(`Options not found: ${[...remaining].join(', ')}`);
            input.feed(' ');
        }
    };
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.beforeRead = answerMenu;
    input.feed('O');
    const completed = await Promise.race([
        command.then(() => true),
        input.waitUntilBlocked().then(() => false),
    ]);
    return { input, command, completed };
}

async function finishOptions({ input, command }: { input: InputGate; command: Promise<unknown> }) {
    input.beforeRead = null;
    if (input.isBlocked) {
        assert.match(visibleOptions(), /--More--/, 'Only a pending redraw pager should remain');
        input.feed(' ');
    }
    await command;
}

void test('status-only option changes return to play without forcing a pager', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.time = false;
    const transaction = await beginSelectedOptions(['time']);
    try {
        assert.equal(transaction.completed, true, 'a status-only toggle should complete without another key');
        assert.equal(game.flags.time, true);
        assert.equal(game.context.move, 0);
        await flush_screen(1);
        assert.match(visibleOptions(), /'time' option toggled on\./);
        assert.match(visibleOptions(), /T:40/);
        assert.doesNotMatch(visibleOptions(), /--More--/);
    } finally {
        await finishOptions(transaction);
    }
});

void test('one toggle-message acknowledgment opens the selected autopickup editor', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.showexp = game.flags.time = false;
    const transaction = await beginSelectedOptions(['showexp', 'time', 'pickup_types']);
    try {
        assert.equal(transaction.completed, false);
        assert.match(visibleOptions(), /'showexp' option toggled on\..*'time' option toggled on\.--More--/);
        assert.doesNotMatch(visibleOptions(), /--More--.*--More--/);
        transaction.input.feed(' ');
        await transaction.input.waitUntilBlocked();

        assert.match(visibleOptions(), /Autopickup what\?/);
        assert.doesNotMatch(visibleOptions(), /--More--/);
        transaction.input.feed('c\n');
        await transaction.command;
        assert.equal(game.flags.pickup_types, ')');
        assert.equal(game.moves, 40);
    } finally {
        await finishOptions(transaction);
    }
});

void test('an overflowing toggle message resumes the remaining changes before opening its editor', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.showexp = game.flags.showrace = game.flags.time = false;
    const transaction = await beginSelectedOptions(['showexp', 'showrace', 'time', 'pickup_types']);
    try {
        assert.equal(transaction.completed, false);
        assert.equal(game.flags.time, true, 'the option changes before its message pages earlier notices');
        transaction.input.feed(' ');
        await transaction.input.waitUntilBlocked();
        assert.match(visibleOptions(), /'time' option toggled on\.--More--/);
        transaction.input.feed(' ');
        await transaction.input.waitUntilBlocked();
        assert.match(visibleOptions(), /Autopickup what\?/);
        transaction.input.feed('c\n');
        await transaction.command;
        assert.equal(game.flags.pickup_types, ')');
        assert.equal(game.flags.showrace, true);
    } finally {
        await finishOptions(transaction);
    }
});

void test('a pet-highlight option still waits for its native redraw and repaints the pet', async () => {
    freshObjectRoom({ flags: { hilite_pet: false } });
    requirePlayingGame(game);
    const pet = await createMonsterAt('little dog', 12, 10);
    initializePet(pet);
    await flush_screen(1);
    const transaction = await beginSelectedOptions(['hilite_pet']);
    try {
        assert.equal(transaction.completed, false, 'the map redraw should dismiss its toggle notice');
        assert.match(visibleOptions(), /'hilite_pet' option toggled on\.--More--/);
        transaction.input.feed(' ');
        await transaction.command;
        await flush_screen(1);
        assert.equal(requireScreenCell(pet.mx - 1, pet.my + 1).attr, ATR_INVERSE);
    } finally {
        await finishOptions(transaction);
    }
});
