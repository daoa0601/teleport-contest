import test from 'node:test';
import assert from 'node:assert/strict';

import {
    bridgeFreeRoleOutcome, freshRoleOutcome,
} from './support/role-outcome.js';

const touristInput = input => ({
    role: 'Tourist', race: 'human', gender: 'male', align: 'neutral',
    datetime: '20260830130000',
    ...input,
});

test('the former explore coordinate schedules current actors', async () => {
    const input = moves => touristInput({
        seed: 48567,
        moves,
        bridgeFree: false,
        extraOptions: ['playmode:explore'],
    });
    const startup = (await freshRoleOutcome(input('  '))).world;
    const waited = (await freshRoleOutcome(input('  ....'))).world;

    assert.deepEqual(startup.hero, [71, 5]);
    assert.deepEqual(waited.hero, startup.hero);
    assert.equal(waited.moves, startup.moves + 4);
    assert.notDeepEqual(waited.actors, startup.actors);
});

test('counted Tourist search spends one live scheduler turn per repetition',
    async () => {
        const input = moves => touristInput({
            seed: 47230,
            moves,
        });
        const startup = await bridgeFreeRoleOutcome(input(' '));
        const searched = await bridgeFreeRoleOutcome(input(' 10s'));

        assert.deepEqual(searched.hero, startup.hero);
        assert.equal(searched.moves, startup.moves + 10);
        assert.notDeepEqual(searched.actors, startup.actors);
    });
