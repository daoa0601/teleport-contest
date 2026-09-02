import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { addMonster } from './support/monsters.js';

test('a shrieker wakes the other monsters on the level', async () => {
    freshRoomWithPolymorphedHero('shrieker');
    const jackal = addMonster({
        species: 'jackal',
        x: 11,
        y: 10,
        msleeping: 1,
    });
    pushKeys('monster\n');

    await rhack('#'.charCodeAt(0));

    assert.equal(jackal.msleeping, 0);
    assert.equal(game.context.move, 0);
});
