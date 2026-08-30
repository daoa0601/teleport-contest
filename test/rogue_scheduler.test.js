import test from 'node:test';
import assert from 'node:assert/strict';

import {
    bridgeFreeRoleOutcome,
} from './support/role-outcome.js';

const rogueInput = input => ({
    role: 'Rogue', gender: 'female', align: 'chaotic',
    datetime: '20260830060000',
    ...input,
});

async function assertQuietRogueTurns(input) {
    const startup = await bridgeFreeRoleOutcome(rogueInput({
        ...input, moves: ' ',
    }));
    const afterTurns = await bridgeFreeRoleOutcome(rogueInput({
        ...input, moves: ' ....',
    }));

    assert.deepEqual(afterTurns.hero, startup.hero);
    assert.equal(afterTurns.moves, startup.moves + 4);
    assert.equal(afterTurns.heroMovement, 12);
    assert.equal(afterTurns.message, '');
    assert.ok(afterTurns.actors.some(actor => actor.tame > 0));
}

test('fresh human Rogue waits leave the hero still while actors take turns',
    async () => {
        await assertQuietRogueTurns({ seed: 10325, race: 'human' });
    });

test('fresh Orc Rogue waits do not become scripted movement or combat',
    async () => {
        await assertQuietRogueTurns({ seed: 12168, race: 'orc' });
    });
