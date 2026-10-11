import test from 'node:test';
import assert from 'node:assert/strict';
import { monsterGrowlSound } from '../js/monster_sound.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a zombie uses a groan for its growl', async () => {
    freshObjectRoom();
    const zombie = await createMonsterAt('human zombie', 11, 10);

    const sound = monsterGrowlSound(zombie);

    assert.equal(sound, 'groan');
});

void test('a shrieker uses the default scream for its growl', async () => {
    freshObjectRoom();
    const shrieker = await createMonsterAt('shrieker', 11, 10);

    const sound = monsterGrowlSound(shrieker);

    assert.equal(sound, 'scream');
});
