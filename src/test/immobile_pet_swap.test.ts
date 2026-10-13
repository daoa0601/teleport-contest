import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a paralyzed pet cannot trade places with the hero', async () => {
    freshObjectRoom();
    const kitten = await createMonsterAt('kitten', 11, 10, NO_MINVENT);
    initializePet(kitten);
    kitten.mcanmove = 0;
    kitten.mfrozen = 5;
    initRng(1n);

    await rhack('l'.charCodeAt(0));

    assert.equal(game._pending_message, "The kitten doesn't seem to move!");
    assert.equal(game.u.ux, 10);
    assert.equal(kitten.mx, 11);
    assert.equal(game.context.move, 1);
});

