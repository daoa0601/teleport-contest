import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { monsterAvoidsKickedLocation } from '../js/monmove.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

for (const [keys, avoids] of [
    ['\x06', true],
    ['F\x06', true],
    ['#wizmap\n', true],
    ['@', true],
    ['.', false],
    ['#sit\n', false],
    ['h', false],
] as const) {
    void test(`cooperative monsters ${avoids ? 'keep' : 'stop'} avoiding the kicked square after ${JSON.stringify(keys)}`, async () => {
        freshGameplayRoom({ left: 10 });
        requirePlayingGame(game);
        const pet = await createMonsterAt('kitten', 12, 10);
        initializePet(pet, { state: game });
        pushKeys('\x04l');
        await rhack(0);
        assert.equal(monsterAvoidsKickedLocation(pet, 11, 10, game), true);

        pushKeys(keys);
        await rhack(0);

        assert.equal(monsterAvoidsKickedLocation(pet, 11, 10, game), avoids);
    });
}
