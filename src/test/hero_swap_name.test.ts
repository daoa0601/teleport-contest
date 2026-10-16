import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { species, tame, name, description } of [
    { species: 'kitten', tame: false, name: 'Mittens', description: 'peaceful Mittens' },
    { species: 'kitten', tame: false, name: '', description: 'the peaceful kitten' },
    { species: 'kitten', tame: true, name: 'Mittens', description: 'Mittens' },
    { species: 'kitten', tame: true, name: '', description: 'your kitten' },
    { species: 'Famine', tame: false, name: '', description: 'peaceful Famine' },
]) {
    void test(`swapping places names the monster as ${description}`, async () => {
        freshObjectRoom({ flags: { pickup: false } });
        const monster = await createMonsterAt(species, 11, 10, MM_NOGRP | NO_MINVENT);
        if (tame) initializePet(monster);
        else monster.mpeaceful = 1;
        setMonsterGivenName(monster, name);
        initRng(1n);
        pushKeys(' '.repeat(10));

        await rhack('l'.charCodeAt(0));

        assert.equal(game.u.ux, 11);
        assert.equal(monster.mx, 10);
        assert.equal(game._pending_message, `You swap places with ${description}.`);
    });
}
