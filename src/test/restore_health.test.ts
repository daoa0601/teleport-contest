import test from 'node:test';
import assert from 'node:assert/strict';

import { GameDisplay } from '../js/game_display.js';
import { requireGameDisplay } from '../js/gstate.js';
import { game, resetGame } from '../js/gstate.js';
import { decodeSavedGame } from '../js/persistent_state_validation.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { encodeSavedGraph } from '../js/saved_graph.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';

// C restore.c:restgamestate() refuses a save whose hero was not healthy
// enough to survive restoration. dorecover() shows the message, discards the
// save file, and the game starts over instead of resurrecting the character.
void test('a dead hero is refused at restore and the save file is discarded', async () => {
    initRng(6103);
    freshObjectRoom({ role: 'wizard' });
    game.plname = game.displayName = 'Ill';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);

    const key = 'teleport-save:ill';
    const snapshot = decodeSavedGame(storage.getItem(key) ?? '');
    snapshot.state.u.uhp = 0;
    storage.setItem(key, encodeSavedGraph(snapshot));

    resetGame();
    game.nhDisplay = new GameDisplay(null);
    assert.equal(restoreGame('Ill', storage), false);
    assert.equal(storage.getItem(key), null, 'The refused save file is discarded.');
    const screen = requireGameDisplay().grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.match(screen, /You were not healthy enough to survive restoration\./);
});

// A polymorphed hero survives on its monster-form hit points, so only a body
// whose current form is also dead is refused.
void test('a polymorphed hero with a living current body still restores', async () => {
    initRng(6104);
    freshObjectRoom({ role: 'wizard' });
    game.plname = game.displayName = 'Poly';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);

    const key = 'teleport-save:poly';
    const snapshot = decodeSavedGame(storage.getItem(key) ?? '');
    snapshot.state.u.uhp = 0;
    snapshot.state.u.umonnum = 16; // little dog; hero hit points are its mh now
    snapshot.state.u.mh = 5;
    storage.setItem(key, encodeSavedGraph(snapshot));

    resetGame();
    game.nhDisplay = new GameDisplay(null);
    assert.equal(restoreGame('Poly', storage), true);
});
