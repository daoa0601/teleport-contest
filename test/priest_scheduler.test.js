import test from 'node:test';
import assert from 'node:assert/strict';

import {
    roleOutcome,
} from './support/role-outcome.js';

const priestInput = input => ({
    role: 'Priest', race: 'human', gender: 'female', align: 'lawful',
    seed: 23501, datetime: '20260830090000',
    ...input,
});

test('fresh Priest prayer completes through live occupation turns',
    async () => {
        const startup = await roleOutcome(priestInput({
            moves: ' ',
        }));
        const prayed = await roleOutcome(priestInput({
            moves: ' #pray\ny',
        }));

        assert.equal(prayed.gnosticConduct, startup.gnosticConduct + 1);
        assert.equal(prayed.moves, startup.moves + 3);
        assert.equal(prayed.heroMovement, 12);
        assert.match(
            prayed.message,
            /^You begin praying to .+\.  You finish your prayer\.$/,
        );
    });
