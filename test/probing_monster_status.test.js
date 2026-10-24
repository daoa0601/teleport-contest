import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { createHarmlessGasCloudSelection } from '../js/regions.js';
import { monsterStatusLine } from '../js/monster_status.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createMonsterAt } from './support/monsters.js';
void test('probing reports permanent monster blindness without a countdown', async () => {
    freshPlayableRoom();
    const monster = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    monster.mcansee = false;
    monster.mblinded = 0;
    const status = await monsterStatusLine(monster);
    assert.match(status, /, blind(?:,|\.)/);
});
void test('probing reports a monster that cannot move without a countdown', async () => {
    freshPlayableRoom();
    const monster = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    monster.mcanmove = false;
    monster.mfrozen = 0;
    monster.msleeping = 0;
    const status = await monsterStatusLine(monster);
    assert.match(status, /, can't move(?:,|\.)/);
});
void test('probing a clear worm tail does not describe the cloud around its head', async () => {
    freshPlayableRoom({ right: 25 });
    const worm = await createMonsterAt('long worm', 16, 10, MM_NOTAIL | NO_MINVENT);
    initializeMonsterWormBody(worm, { segmentCount: 2, random: () => 0 });
    assert.ok(worm.wormSegments);
    const tail = worm.wormSegments[0];
    assert.ok(tail, 'The probed worm must have a tail outside its head square.');
    await createHarmlessGasCloudSelection(game, [{ x: worm.mx, y: worm.my }]);
    const tailStatus = await monsterStatusLine(worm, { x: tail.x, y: tail.y });
    const headStatus = await monsterStatusLine(worm);
    assert.doesNotMatch(tailStatus, /in a cloud/);
    assert.match(headStatus, /in a cloud of vapor/);
});
//# sourceMappingURL=probing_monster_status.test.js.map