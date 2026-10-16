import assert from 'node:assert/strict';
import test from 'node:test';
import { LANDMINE, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { canSeeMonster, newsym, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('a land mine reveals its infrared-visible victim before paging the explosion message', async () => {
    const level = freshObjectRoom({ hero: { infravision: true } });
    requirePlayingGame(game);
    for (let x = 7; x <= 16; x++)
        for (let y = 6; y <= 14; y++)
            level.requireAt(x, y).lit = false;
    vision_recalc(0);
    const giant = await createMonsterAt('giant', 12, 10, MM_NOGRP | NO_MINVENT);
    giant.mhp = giant.mhpmax = 100;
    placeMonsterAt(giant, 14, 10);
    newsym(12, 10);
    addTrap(level, LANDMINE, 14, 10);
    assert.equal(cansee(14, 10), false);
    assert.equal(canSeeMonster(giant), true);
    await plineWithContinuation('You wait quietly and watch the distant monster cross the room.');
    const input = resetInputState();
    let sawPager = false;
    input.beforeRead = () => {
        if (sawPager)
            return;
        sawPager = true;
        assert.equal(requireScreenCell(13, 11).ch, 'H');
    };
    pushKeys(' '.repeat(10));
    initRng(1n);
    const action = await triggerImmediateMonsterTrap(giant, game);
    await resumeDeferredMonsterTrap(action, game);
    assert.equal(sawPager, true);
});
//# sourceMappingURL=monster_landmine_display.test.js.map