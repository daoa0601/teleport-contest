import assert from 'node:assert/strict';
import test from 'node:test';

// The contest play page builds a NethackGame, starts it, then calls
// moveloop_core() once per keystroke until the game ends.

import { moveloop_core } from '../js/allmain.js';
import { GameDisplay } from '../js/game_display.js';
import { game } from '../js/gstate.js';
import { NethackGame } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';

const NETHACKRC = [
    'OPTIONS=name:Ada,role:Valkyrie,race:human,gender:female,align:lawful',
    'OPTIONS=!legacy,!tutorial,pettype:none',
].join('\n');

class QueueEmpty extends Error {}

async function startedPlayPage() {
    const display = new GameDisplay(null);
    display.onEmptyQueue = () => { throw new QueueEmpty(); };
    const nhGame = new NethackGame({ seed: 42, datetime: '20260830190000', nethackrc: NETHACKRC });
    nhGame._pendingDisplay = display;
    nhGame._pendingStorage = memoryStorage();
    game.nhDisplay = display;
    await nhGame.start();
    return display;
}

async function press(display: GameDisplay, key: string): Promise<void> {
    display.pushKey(key.charCodeAt(0));
    await moveloop_core();
}

void test('each keystroke on the play page advances the started game by one command', async () => {
    const display = await startedPlayPage();
    await press(display, ' ');
    const before = game.moves;

    for (let turn = 0; turn < 3; turn++) await press(display, 's');

    assert.equal(game.moves, before + 3);
    assert.equal(game.program_state.gameover, undefined);
});

void test('a play-page read with no key waiting throws out without losing the game', async () => {
    const display = await startedPlayPage();
    await press(display, ' ');
    const before = game.moves;

    await assert.rejects(moveloop_core(), QueueEmpty);
    await press(display, 's');

    assert.equal(game.moves, before + 1);
});

void test('quitting from the play page ends the game', async () => {
    const display = await startedPlayPage();
    await press(display, ' ');
    for (const key of '#quit\ny') await press(display, key);
    for (let page = 0; page < 20 && !game.program_state.gameover; page++) await press(display, '\x1b');

    assert.equal(game.program_state.gameover, true);
});
