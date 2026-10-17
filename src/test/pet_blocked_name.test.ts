import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const species of ['kitten', 'little dog', 'housecat']) {
    void test(`a blocked ${species} is named by its current species`, async () => {
        freshObjectRoom();
        const pet = await createMonsterAt(species, 11, 10, MM_NOGRP | NO_MINVENT);
        initializePet(pet);
        // This seed makes the ordinary one-in-seven displacement refusal.
        initRng(7n);
        pushKeys(' '.repeat(10));

        await rhack('l'.charCodeAt(0));

        assert.equal(game._pending_message, `You stop.  Your ${species} is in the way!`);
        assert.equal(game.u.ux, 10);
        assert.equal(pet.mx, 11);
    });
}
