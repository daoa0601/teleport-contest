import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
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
