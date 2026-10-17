import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { resolveMonsterSelfExplosion } from '../js/monster_self_explosion.js';
import { AD_BLND, AT_EXPL } from '../js/monster_attack_types.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a light exploding away from the hero announces a nearby visible sleeper waking', async () => {
    freshObjectRoom();
    const sleeper = await createMonsterAt('goblin', 13, 10, MM_NOGRP | NO_MINVENT);
    sleeper.msleeping = 1;
    const light = await createMonsterAt('yellow light', 11, 10, MM_NOGRP | NO_MINVENT);
    const messages = [];
    await resolveMonsterSelfExplosion(light, [AT_EXPL, AD_BLND, 1, 6], {
        foundHero: false, publish: async (message) => { messages.push(message); },
    });
    assert.equal(sleeper.msleeping, 0);
    assert.match(messages.join('\n'), /The goblin wakes up\./);
    assert.notEqual(monsterAtPosition(requireGameLevel(), light.mx, light.my), light);
});
//# sourceMappingURL=self_explosion_wake.test.js.map