import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';

// C wintty.c:tty_askname(): an empty or escaped answer re-asks, the hint
// replaces the previous prompt row, and ten failures abandon the game.
// The rc fully fixes the character facets, so the name is the only query.
const START_OPTIONS = 'OPTIONS=role:Wizard,race:human,gender:female,align:neutral,'
    + '!legacy,!tutorial,pettype:none';

void test('an empty then escaped name answer re-asks with the tty hint', async () => {
    const engine = await runSegment({
        seed: 31,
        datetime: '20260831120000',
        nethackrc: START_OPTIONS,
        moves: '\n\x1bMira\n',
        storage: memoryStorage(),
    });

    const screens = engine.getScreens();
    assert.ok(screens.some(screen => screen.includes('Enter a name for your character...')),
        'a rejected name answer prints the retry hint');
    assert.ok(screens.some(screen => screen.includes('Who are you? M')),
        'the typed retry answer echoes on the new prompt row');
    requirePlayingGame(game);
    assert.equal(game.plname, 'Mira');
    assert.equal(game.moves, 1, 'the named character still starts the game');
});

void test('ten empty name answers give up on the player', async () => {
    const engine = await runSegment({
        seed: 31,
        datetime: '20260831120000',
        nethackrc: START_OPTIONS,
        moves: '\n'.repeat(10),
        storage: memoryStorage(),
    });

    const rows = requireGameDisplay().grid
        .map(cells => cells.map(cell => cell.ch).join('').trimEnd());
    assert.ok(rows.some(row => row.includes('Giving up after 10 tries.')),
        'the tenth failure abandons startup through a raw line');
    assert.equal(engine.lastRunResult?.kind, 'stopped');
    assert.equal(game.urole, null, 'no character is created after the bail');
});
