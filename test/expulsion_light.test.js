import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flush_screen, plineWithContinuation } from '../js/display.js';
import { expelHero } from '../js/hero_expulsion.js';
import { createPoisonGasCloud, runLevelRegions, updateMonsterRegions } from '../js/regions.js';
import { game } from '../js/gstate.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('an expelled luminous monster illuminates its destination on the next vision refresh', async () => {
    const level = freshObjectRoom({ recalculateVision: false });
    for (let x = 7; x <= 16; x++)
        for (let y = 6; y <= 14; y++)
            level.requireAt(x, y).lit = false;
    const vortex = await createMonsterAt('fire vortex', 11, 10, MM_NOGRP | NO_MINVENT);
    await installSwallowedHero(vortex);
    await expelHero(vortex, { message: false, random: () => 0 });
    await plineWithContinuation('You catch your breath.');
    await flush_screen(1);
    const beyond = { x: vortex.mx, y: vortex.my + Math.sign(vortex.my - game.u.uy) };
    assert.equal(cansee(beyond.x, beyond.y), false);
    assert.equal(requireScreenCell(beyond.x - 1, beyond.y + 1).ch, ' ');
    vision_recalc(0);
    await flush_screen(1);
    assert.equal(cansee(beyond.x, beyond.y), true);
    assert.equal(requireScreenCell(beyond.x - 1, beyond.y + 1).ch, '.');
});
void test('an expelled fog cloud stops sustaining the vapor it left around the hero', async () => {
    freshObjectRoom();
    const fog = await createMonsterAt('fog cloud', 11, 10, MM_NOGRP | NO_MINVENT);
    await installSwallowedHero(fog);
    const vapor = await createPoisonGasCloud(game, fog.mx, fog.my, 1, 0, () => 0, async () => { });
    assert.ok(vapor);
    updateMonsterRegions(fog, game);
    vapor.ttl = 10;
    await expelHero(fog, { message: false, random: () => 0 });
    assert.notDeepEqual([fog.mx, fog.my], [vapor.cells[0]?.x, vapor.cells[0]?.y]);
    await runLevelRegions(game, { publish: async () => { } });
    assert.equal(vapor.ttl, 9);
});
//# sourceMappingURL=expulsion_light.test.js.map