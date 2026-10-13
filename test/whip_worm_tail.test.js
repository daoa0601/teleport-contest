import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOTAIL, NO_MINVENT, TT_PIT, W_WEP } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { BULLWHIP } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a whip can pull the hero from a pit by catching an adjacent worm tail', async () => {
    freshObjectRoom({ role: 'archeologist', hero: { acurr: { a: [18, 10, 10, 18, 10, 10] } } });
    const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
    game.uwep = game.u.uwep = whip;
    const worm = await createMonsterAt('long worm', 13, 10, NO_MINVENT | MM_NOTAIL);
    initializeMonsterWormBody(worm, { segmentCount: 0 });
    worm.wormSegments = [{ x: 12, y: 10 }, { x: 11, y: 10 }];
    game.u.utrap = 3;
    game.u.utraptype = TT_PIT;
    newsym(11, 10);
    initRng(4n);
    await applyInventoryObject(whip, 'l     ');
    assert.equal(game.u.utrap, 0);
    assert.ok(game.u.ux !== 10 || game.u.uy !== 10);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=whip_worm_tail.test.js.map