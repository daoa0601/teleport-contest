import test from 'node:test';
import assert from 'node:assert/strict';
import { continueCountedCommand } from '../js/cmd.js';
import { DOOR, VWALL, W_WEP } from '../js/const.js';
import { newsym, setTopline } from '../js/display.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE } from '../js/object_data.js';
import { saveGame, restoreGame } from '../js/save.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('saving midway through a wall preserves the work already done', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.plname = 'Digger';
    const pick = await addInventoryObject(PICK_AXE, { invlet: 'a', spe: 20, owornmask: W_WEP });
    game.uwep = game.u.uwep = pick;
    requireGameLevel().requireAt(11, 10).typ = VWALL;
    newsym(11, 10);
    installPagerInput(resetInputState(), {
        expected: /You (?:start|continue) digging|You hit the rock with all your might/,
        limit: 2,
    });
    await applyInventoryObject(pick, 'l');
    for (let turn = 0; turn < 2; turn++) {
        await continueCountedCommand();
        game.moves++;
    }
    assert.equal(requireGameLevel().requireAt(11, 10).typ, VWALL);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Digger', storage), true);
    // Resuming through rhack() needs the message clear from fresh command input.
    await setTopline('');
    await applyInventoryObject(game.uwep, 'l');
    for (let turn = 0; turn < 2; turn++) {
        await continueCountedCommand();
        game.moves++;
    }
    assert.equal(requireGameLevel().requireAt(11, 10).typ, DOOR);
});
