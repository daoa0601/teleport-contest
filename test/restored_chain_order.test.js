import assert from 'node:assert/strict';
import test from 'node:test';
import { STAIRS } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { u_on_upstairs } from '../js/mklev.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshConnectedLevels } from './support/connected-levels.js';
for (const cached of [false, true]) {
    void test(`${cached ? 'revisiting' : 'restoring'} a level rebuilds stair selection from the saved chain`, async () => {
        if (cached)
            freshConnectedLevels();
        else
            freshObjectRoom();
        requirePlayingGame(game);
        game.flags.verbose = false;
        for (const x of [11, 14])
            requireGameLevel().requireAt(x, 10).typ = STAIRS;
        game.stairs = {
            sx: 14, sy: 10, up: true, isladder: false, u_traversed: false,
            tolev: { dnum: 0, dlevel: 1 }, next: {
                sx: 11, sy: 10, up: true, isladder: false, u_traversed: false,
                tolev: { dnum: 0, dlevel: 1 }, next: null,
            },
        };
        if (cached) {
            await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
            await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });
        }
        else {
            const storage = memoryStorage();
            assert.equal(await saveGame(storage), true);
            assert.equal(restoreGame(game.plname, storage), true);
        }
        await u_on_upstairs();
        assert.equal(game.u.ux, 11, 'Restoring prepends each saved stair, selecting the older upstairs first');
        assert.equal(game.u.uy, 10);
    });
}
//# sourceMappingURL=restored_chain_order.test.js.map