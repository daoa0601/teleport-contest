import test from 'node:test';
import assert from 'node:assert/strict';
import { gotoLevel } from '../js/level_change.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { createGasCloudSelection } from '../js/regions.js';
import { restoreGame, saveGame } from '../js/save.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { memoryStorage } from './support/memory-storage.js';
void test('returning to a level ages gas clouds and removes expired clouds without thinning them', async () => {
    const { source } = freshConnectedLevels();
    const cells = [{ x: 16, y: 10 }];
    const expired = await createGasCloudSelection(game, cells, 4, 8);
    const surviving = await createGasCloudSelection(game, cells, 12, 8);
    const permanent = await createGasCloudSelection(game, cells, -1, 0);
    assert.ok(expired && surviving && permanent);
    pushKeys(' '.repeat(30));
    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
    game.moves += 6;
    await gotoLevel({ dnum: 0, dlevel: 1 }, { arrival: 'stairs' });
    assert.equal(game.level, source);
    assert.equal(source.regions.includes(expired), false);
    assert.equal(surviving.ttl, 6);
    assert.equal(surviving.damage, 8);
    assert.equal(permanent.ttl, -1);
});
void test('restoring a save removes an expired thick cloud without prolonging it', async () => {
    freshConnectedLevels();
    game.plname = 'CloudSaver';
    await createGasCloudSelection(game, [{ x: 16, y: 10 }], 0, 8);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('CloudSaver', storage), true);
    assert.equal(game.level?.regions.length, 0);
});
//# sourceMappingURL=region_restore.test.js.map