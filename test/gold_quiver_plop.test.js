import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameLevel } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { POOL } from '../js/const.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { freshTurnRoom } from './support/playable-room.js';
// C dothrow.c throwit() gives every landing projectile a liquid sound, so
// quivered coins fired into a pool announce themselves before flooreffects.
void test('fired gold plops when it lands in a pool', async () => {
    const input = freshTurnRoom({ role: 'barbarian', flags: { tips: false } });
    for (let x = 11; x <= 15; x++)
        requireGameLevel().requireAt(x, 10).typ = POOL;
    setHeroGoldAmount(game, 2);
    input.feed('Q$');
    await rhack(0);
    input.feed('fl');
    await rhack(0);
    assert.match(game._pending_message ?? '', /Plop!/);
});
//# sourceMappingURL=gold_quiver_plop.test.js.map