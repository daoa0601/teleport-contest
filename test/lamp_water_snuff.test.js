import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flush_screen, newsym, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { OIL_LAMP } from '../js/object_data.js';
import { waterDamageObject } from '../js/trap.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('a doused lamp announces going out before its light leaves the map', async () => {
    const level = freshObjectRoom({ right: 25 });
    requirePlayingGame(game);
    for (let x = 7; x <= 25; x++)
        for (let y = 6; y <= 14; y++)
            level.requireAt(x, y).lit = false;
    const lamp = await addInventoryObject(OIL_LAMP, { age: 200 });
    beginObjectBurn(lamp);
    vision_recalc(0);
    const gx = game.u.ux + 2;
    const gy = game.u.uy;
    await createMonsterAt('goblin', gx, gy, MM_NOGRP | NO_MINVENT);
    newsym(gx, gy);
    await flush_screen(1);
    assert.equal(cansee(gx, gy), true);
    assert.equal(requireScreenCell(gx - 1, gy + 1).ch, 'o');
    const input = resetInputState();
    await plineWithContinuation('A wave of cold water surges across the floor and swirls about your feet.');
    const dousing = waterDamageObject(lamp, [], game, { publish: plineWithContinuation });
    const outcome = await Promise.race([
        dousing.then(() => 'finished'),
        input.waitUntilBlocked().then(() => 'paused'),
    ]);
    assert.equal(outcome, 'paused');
    // The earlier message pages with the lamplit goblin still in view.
    assert.equal(requireScreenCell(gx - 1, gy + 1).ch, 'o');
    input.feed(' ');
    assert.equal(await dousing, 'damaged');
    vision_recalc(0);
    await flush_screen(1);
    assert.match(game._pending_message, /Your oil lamp goes out!/);
    assert.equal(lamp.lamplit, false);
    assert.equal(cansee(gx, gy), false);
    assert.notEqual(requireScreenCell(gx - 1, gy + 1).ch, 'o');
});
//# sourceMappingURL=lamp_water_snuff.test.js.map