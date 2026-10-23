import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { BOULDER } from '../js/object_data.js';
import { createGasCloudSelection, runLevelRegions } from '../js/regions.js';
import { cansee, vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('cloud dissipation is announced after surviving clouds affect their occupants', async () => {
    freshObjectRoom();
    await createMonsterAt('soldier', 11, 10);
    await createGasCloudSelection(game, [{ x: 10, y: 10 }], 0, 0, async () => { });
    const active = await createGasCloudSelection(game, [{ x: 11, y: 10 }], 5, 8, async () => { });
    assert.ok(active);
    active.heroFault = false;
    const messages = [];
    await runLevelRegions(game, { publish: async (message) => { messages.push(message); } });
    assert.deepEqual(messages, ['The soldier coughs!', 'The gas cloud around you dissipates.']);
});
void test('a cloud fading over a boulder leaves the hero view unrefreshed', async () => {
    const level = freshObjectRoom({ right: 25 });
    for (let x = 7; x <= 25; x++)
        for (let y = 6; y <= 14; y++)
            level.requireAt(x, y).lit = false;
    const bx = game.u.ux + 1;
    const by = game.u.uy;
    await floorObject(BOULDER, bx, by);
    vision_note_blocker_change(bx, by);
    await createGasCloudSelection(game, [{ x: bx, y: by }], 0, 0, async () => { });
    const gx = game.u.ux - 3;
    const gy = game.u.uy;
    await createMonsterAt('goblin', gx, gy, MM_NOGRP | NO_MINVENT);
    vision_recalc(0);
    assert.equal(cansee(gx, gy), false);
    // The goblin's spot lights up without anything asking for new sight.
    level.requireAt(gx, gy).lit = true;
    await runLevelRegions(game);
    await flush_screen(1);
    // The boulder still blocks the cloud's spot, so its expiry requests no
    // new view and the dissipation message shows the old one.
    assert.match(game._pending_message, /You see a gas cloud dissipate\./);
    assert.notEqual(requireScreenCell(gx - 1, gy + 1).ch, 'o');
});
//# sourceMappingURL=region_expiry.test.js.map