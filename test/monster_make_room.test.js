import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { mnearto } from '../js/shop_damage.js';
import { requireShopGame } from '../js/shop_types.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a monster displaced to make room leaves its square as it would leave the level', async () => {
    const level = freshObjectRoom({ right: 22 });
    const hidden = await createMonsterAt('iron piercer', 15, 10, NO_MINVENT);
    hidden.mundetected = 1;
    hidden.mtrapped = 1;
    const arrival = await createMonsterAt('jackal', 17, 10, NO_MINVENT);
    requireShopGame(game);
    assert.equal(await mnearto(arrival, 15, 10, game, { moveOther: true }), 2);
    assert.equal(monsterAtPosition(level, 15, 10), arrival);
    assert.ok(hidden.mx !== 15 || hidden.my !== 10);
    assert.equal(monsterAtPosition(level, hidden.mx, hidden.my), hidden);
    assert.equal(hidden.mundetected, 0);
    assert.equal(hidden.mtrapped, 0);
});
//# sourceMappingURL=monster_make_room.test.js.map