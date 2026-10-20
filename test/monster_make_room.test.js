import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_F_DKNOWN, M_AP_OBJECT, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { BOULDER } from '../js/object_data.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
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
void test('displacing a boulder-disguised mimic reopens the view past its square', async () => {
    freshObjectRoom({ right: 20 });
    const mimic = await createMonsterAt('small mimic', 12, 10, NO_MINVENT);
    mimic.m_ap_type = M_AP_OBJECT | M_AP_F_DKNOWN;
    mimic.mappearance = BOULDER;
    vision_reset();
    vision_recalc(0);
    assert.equal(cansee(14, 10), false);
    const arrival = await createMonsterAt('jackal', 12, 8, NO_MINVENT);
    requireShopGame(game);
    game.vision_full_recalc = 0;
    await mnearto(arrival, 12, 10, game, { moveOther: true });
    // The move loop refreshes sight only when a change requested it.
    if (game.vision_full_recalc)
        vision_recalc(0);
    assert.equal(mimic.m_ap_type, 0);
    assert.equal(cansee(14, 10), true);
});
//# sourceMappingURL=monster_make_room.test.js.map