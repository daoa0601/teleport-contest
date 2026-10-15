import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from '../js/monster_speed.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('creation and slime speed changes remain silent', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    for (const amount of [2, -2, -4]) {
        monster.mspeed = monster.permspeed = amount === 2 ? 0 : 2;

        const change = adjustMonsterSpeed(monster, amount);

        assert.equal(monsterSpeedMessage(change, 'The soldier'), null, `adjust ${amount} must be silent`);
    }
});

void test('petrification slowing obeys verbose while ordinary speed changes do not', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    monster.mspeed = monster.permspeed = 2;

    assert.equal(monsterSpeedMessage(adjustMonsterSpeed(monster, -3), 'The soldier'), null);
    assert.equal(monsterSpeedMessage(adjustMonsterSpeed(monster, 1), 'The soldier'),
        'The soldier is suddenly moving faster.');
    game.in_mklev = true;
    assert.equal(monsterSpeedMessage(adjustMonsterSpeed(monster, -1), 'The soldier'), null);
});
