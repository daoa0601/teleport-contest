import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOTAIL, NO_MINVENT, TT_PIT, W_WEP } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { BULLWHIP } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
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
void test('applied bullwhip blows can sever an adjacent worm tail without striking its distant head', async () => {
    freshObjectRoom({ role: 'archeologist', hero: { acurr: { a: [18, 10, 10, 18, 10, 10] } } });
    const whip = await addInventoryObject(BULLWHIP, { spe: 10 });
    await setPrimaryWeapon(whip);
    const worm = await createMonsterAt('long worm', 13, 10, NO_MINVENT | MM_NOTAIL);
    initializeMonsterWormBody(worm, { segmentCount: 0 });
    worm.wormSegments = [{ x: 12, y: 10 }, { x: 11, y: 10 }];
    worm.mhp = worm.mhpmax = 1000;
    worm.mpeaceful = 0;
    newsym(11, 10);
    initRng(4n);
    for (let blows = 0; blows < 30 && worm.wormSegments.length === 2; blows++)
        await applyInventoryObject(whip, 'l     ');
    assert.ok(worm.mhp < 1000, 'the worm must take damage from the applied whip');
    assert.equal(worm.wormSegments.length, 1, 'a successful tail blow must remove the selected tip');
    assert.equal(worm.mx, 13);
    assert.equal(worm.my, 10);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=whip_worm_tail.test.js.map