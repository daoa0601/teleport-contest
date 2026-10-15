import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { rndmonstAdj } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
void test('the Healer quest generates the giant rats threatening its home', () => {
    freshObjectRoom({ role: 'healer', gameplaySeed: 324n });
    game.dungeons = [createDungeon({ dname: 'The Quest' })];
    game.u.uz = { dnum: 0, dlevel: 1 };
    const monsters = Array.from({ length: 40 }, () => rndmonstAdj());
    assert.ok(monsters.includes(MONSTER_NAME.indexOf('giant rat')));
});
//# sourceMappingURL=quest_monsters.test.js.map