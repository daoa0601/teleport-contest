import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT, W_WEP } from '../js/const.js';
import { AT_BITE } from '../js/monster_attack_types.js';
import { poisonMonsterFromAttack } from '../js/monster_poison.js';
import { game } from '../js/gstate.js';
import { artifactObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('Grimtooth prevents poison damage while the bite still hurts', async () => {
    freshObjectRoom();
    const attacker = await createMonsterAt('giant spider', 11, 10, NO_MINVENT);
    const defender = await createMonsterAt('soldier', 12, 10, NO_MINVENT);
    await equipMonsterObject(defender, await artifactObject('Grimtooth'), W_WEP);
    defender.mhp = defender.mhpmax = 40;

    const damage = await poisonMonsterFromAttack(attacker, defender, AT_BITE, 4,
        { state: game, visible: false, random: () => 0 });

    assert.equal(damage, 4);
});
