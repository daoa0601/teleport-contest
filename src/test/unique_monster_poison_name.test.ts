import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { AT_STNG } from '../js/monster_attack_types.js';
import { poisonHeroFromMonster } from '../js/monster_poison.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a demon with a personal name poisons the hero without a definite article', async () => {
    freshObjectRoom({ hero: { poisonResistance: true } });
    const demon = await createMonsterAt('Geryon', 11, 10, NO_MINVENT);
    demon.minvis = demon.perminvis = false;
    const messages: string[] = [];

    await poisonHeroFromMonster(demon, AT_STNG, { state: game, chance: 1,
        publish: message => { messages.push(message); },
    });

    assert.equal(messages[0], "Geryon's sting was poisoned!");
});
