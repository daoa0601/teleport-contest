import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { castNativeRay } from '../js/ray_attack.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C zap.c dobuzz() kills with xkilled(mon, XKILL_GIVEMSG): only a burned-up
// golem passes XKILL_NOCORPSE.  A corpseless gas spore therefore still
// reaches corpse_chance(), which sets off its explosion.
void test('a gas spore killed by a cold ray explodes over its neighbors', async () => {
    freshObjectRoom({ right: 20 });
    const spore = await createMonsterAt('gas spore', 13, 10, NO_MINVENT);
    const goblin = await createMonsterAt('goblin', 13, 11, NO_MINVENT);
    goblin.mhp = goblin.mhpmax = 100;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    initRng(1n);

    await castNativeRay(2, 6, 'l', { originX: game.u.ux, originY: game.u.uy });

    assert.equal(spore.dead, true);
    assert.ok(goblin.mhp < 100, 'the explosion must reach the adjacent goblin');
});
