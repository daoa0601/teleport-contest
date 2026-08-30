import test from 'node:test';
import assert from 'node:assert/strict';

import {
    bridgeFreeRoleOutcome,
} from './support/role-outcome.js';

function samuraiInput(moves) {
    return {
        seed: 8123,
        datetime: '20260830044000',
        role: 'Samurai', race: 'human', gender: 'female', align: 'lawful',
        moves,
    };
}

test('fresh Samurai prayer completes through live occupation turns',
    async () => {
        const startup = await bridgeFreeRoleOutcome(samuraiInput(' '));
        const prayed = await bridgeFreeRoleOutcome(
            samuraiInput(' #pray\ny'),
        );

        assert.equal(prayed.gnosticConduct, startup.gnosticConduct + 1);
        assert.equal(prayed.moves, startup.moves + 3);
        assert.equal(
            prayed.message,
            'You begin praying to Amaterasu Omikami.  You finish your prayer.',
        );
    });
