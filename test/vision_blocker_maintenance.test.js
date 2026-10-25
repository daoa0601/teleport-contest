import test from 'node:test';
import assert from 'node:assert/strict';
import { MOAT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { placeObject } from '../js/floor_object.js';
import { mksobj } from '../js/mklev.js';
import { BOULDER } from '../js/object_data.js';
import { createGasCloudSelection, runLevelRegions } from '../js/regions.js';
import { clearPath, vision_reset } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a blocker change while the hero is submerged leaves distant moats transparent', async () => {
    const level = freshObjectRoom({ heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    // The moat at (12,10) was transparent when the sight table was built;
    // entering the water alone does not rebuild the table in C.
    level.requireAt(12, 10).typ = MOAT;
    vision_reset();
    game.u.uinwater = 1;
    assert.equal(clearPath(13, 10, 11, 10), true, 'submersion alone must not block the moat the table already sees through');
    // A boulder lands while the hero swims.  C recalc_block_point() rewrites
    // only the boulder's own cell; it must not re-block the distant moat.
    await placeObject(await mksobj(BOULDER, false, false), 15, 10);
    assert.equal(clearPath(13, 10, 11, 10), true, 'the moat keeps the transparency the table had when it was built');
    assert.equal(clearPath(16, 10, 14, 10), false, 'the boulder blocks sight through its own cell');
});
void test('an expiring cloud uncovers a moat while the hero stays submerged', async () => {
    const level = freshObjectRoom({ heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    level.requireAt(11, 10).typ = MOAT;
    game.u.uinwater = 1;
    vision_reset();
    assert.equal(clearPath(12, 10, 10, 10), false, 'the moat blocks while the sight table is built with the hero submerged');
    await createGasCloudSelection(game, [{ x: 11, y: 10 }], 0, 0, async () => { });
    await runLevelRegions(game, { publish: async () => { } });
    // C remove_region() clears u.uinwater for its unblocking pass, so the
    // cloud's moat cell is dug open even though the hero is still swimming.
    assert.equal(clearPath(12, 10, 10, 10), true, 'the dissipated cloud no longer blocks the moat');
    assert.equal(game.u.uinwater, 1, 'the hero stays submerged');
});
//# sourceMappingURL=vision_blocker_maintenance.test.js.map