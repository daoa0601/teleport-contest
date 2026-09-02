import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { runMonsterAbilityCommand } from './support/commands.js';
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
    await runMonsterAbilityCommand();

    assert.equal(jackal.msleeping, 0);
    assert.equal(game.context.move, 0);
});
