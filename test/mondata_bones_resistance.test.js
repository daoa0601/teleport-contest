import assert from 'node:assert/strict';
import test from 'node:test';
import { giveHeroResistancesToMonster } from '../js/bones_monster.js';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { monsterHasFireResistance, monsterHasShockResistance } from '../js/monster_resistance.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('bones monsters inherit learned resistances but not the hero form resistances', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('fireResistance', 'form', game);
    grantIntrinsicProperty('shockResistance', 'outside', game);
    const monster = await createMonsterAt('human mummy', 12, 10, NO_MINVENT);
    giveHeroResistancesToMonster(monster);
    assert.equal(monsterHasShockResistance(monster), true);
    assert.equal(monsterHasFireResistance(monster), false);
});
//# sourceMappingURL=mondata_bones_resistance.test.js.map