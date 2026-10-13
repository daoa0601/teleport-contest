import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { hurtleMonster } from '../js/monster_hurtle.js';
import { returnMonsterWeapon } from '../js/monster_returning_weapon.js';
import { AKLYS } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a hurtling monster bumps into an unseen monster described as it', async () => {
    freshObjectRoom();
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    const orc = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    orc.minvis = true;
    const messages: string[] = [];

    await hurtleMonster(goblin, 1, 0, 1, { announce: text => { messages.push(text); } });

    assert.equal(messages[0], 'The goblin bumps into it.');
    assert.equal(goblin.mx, 11);
});

void test('a returning unidentified club names an unseen thrower with its', async () => {
    freshObjectRoom();
    const orc = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    const club = await knownObject(AKLYS, { known: false, typeKnown: false, dknown: true });
    orc.minvis = true;
    const messages: string[] = [];

    await returnMonsterWeapon(orc, club, 10, 10, {
        state: game, random: () => 1, publish: text => { messages.push(text); },
    });

    assert.equal(messages[0], 'The thonged club returns to its hand!');
    assert.equal(orc.mw, club);
});
