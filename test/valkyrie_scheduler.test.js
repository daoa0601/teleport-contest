import test from 'node:test';
import assert from 'node:assert/strict';

import {
    bridgeFreeRoleOutcome,
} from './support/role-outcome.js';

const valkyrieInput = input => ({
    role: 'Valkyrie', race: 'human', gender: 'female', align: 'lawful',
    datetime: '20260830110000',
    ...input,
});

test('save-blocked chat text cannot replace elapsed Valkyrie waits',
    async () => {
        // The save request blocks before the trailing bytes are commands.
        // Four preceding dots therefore keep the hero still while live actors
        // receive four ordinary turn allocations.
        const startup = await bridgeFreeRoleOutcome(valkyrieInput({
            seed: 27001,
            moves: ' ',
        }));
        const afterTurns = await bridgeFreeRoleOutcome(valkyrieInput({
            seed: 27001,
            moves: ' ....Syny#chat',
        }));

        assert.deepEqual(afterTurns.hero, startup.hero);
        assert.equal(afterTurns.moves, startup.moves + 4);
        assert.equal(afterTurns.heroMovement, 12);
        assert.ok(afterTurns.actors.some(actor => actor.tame > 0));
    });
