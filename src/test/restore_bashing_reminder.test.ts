import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { restoreGame, saveGame } from '../js/save.js';
import { vision_recalc } from '../js/vision.js';
import { pushKeys } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';

void test('restoring a bare-handed hero repeats the first-fight reminder', async () => {
    freshObjectRoom({ role: 'monk', flags: { verbose: true } });
    await createMonsterAt('newt', 11, 10);
    game._unweapon = false;
    game.u.uhitinc = -100;
    game.plname = 'Returning fighter';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    vision_recalc(0);
    pushKeys(' '.repeat(20));

    await rhack('l'.charCodeAt(0));

    assert.match(game._pending_message, /You begin striking monsters with your bare hands\./);
});
