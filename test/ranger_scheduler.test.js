import test from 'node:test';
import assert from 'node:assert/strict';

import { ARROW, BOW, DAGGER } from '../js/object_data.js';
import {
    bridgeFreeRoleOutcome, freshRoleOutcome,
} from './support/role-outcome.js';

const rangerInput = input => ({
    role: 'Ranger', race: 'human', align: 'neutral',
    datetime: '20260830140000',
    ...input,
});

test('fresh Ranger fireassist swaps, resumes, and shoots live arrows',
    async () => {
        // Pinned dothrow.c queues doswapweapon then dofire when the quivered
        // ammo matches the alternate launcher.  The physical fire command
        // must therefore spend the swap turn, resume, and detach at least one
        // arrow; a canned message/RNG replay which stops at direction input
        // cannot satisfy the inventory and actor-state oracle.
        const seed = 43333;
        const startup = await freshRoleOutcome(rangerInput({
            seed, moves: ' ', bridgeFree: true,
        }));
        const world = await bridgeFreeRoleOutcome(rangerInput({
            seed, moves: ' f l ',
        }));

        const initialArrows = startup.world.inventory
            .filter(object => object.type === ARROW)
            .reduce((total, object) => total + object.quantity, 0);
        const remainingArrows = world.inventory
            .filter(object => object.type === ARROW)
            .reduce((total, object) => total + object.quantity, 0);

        assert.equal(startup.error, null);
        assert.equal(world.primary, BOW);
        assert.equal(world.alternate, DAGGER);
        assert.equal(world.quiver, ARROW);
        assert.ok(initialArrows > remainingArrows);
        assert.equal(world.moves, 3);
    });
