import test from 'node:test';
import assert from 'node:assert/strict';

import {
    allocateMonsterMovement, mcalcmove, naturalMonsterSpeed,
    runQuietMonsterActions, scanMonsterMovement,
} from '../js/monmove.js';
import { MONSTER_MOVE } from '../js/monster_data.js';
import { roles } from '../js/roles.js';

function rolls(values) {
    let index = 0;
    return range => {
        assert.equal(range, 12);
        return values[index++];
    };
}

test('natural speeds and randomized rounding match mon.c mcalcmove', () => {
    assert.equal(MONSTER_MOVE.length, 383);
    assert.equal(naturalMonsterSpeed({ mnum: 100 }), 16); // pony
    assert.equal(naturalMonsterSpeed({ mnum: 32 }), 18); // kitten
    assert.equal(mcalcmove({ mnum: 100 }, true, rolls([2])), 24);
    assert.equal(mcalcmove({ mnum: 100 }, true, rolls([4])), 12);
    assert.equal(mcalcmove({ mnum: 32 }, true, rolls([5])), 24);
    assert.equal(mcalcmove({ mnum: 32 }, true, rolls([6])), 12);
});

test('seed0004 allocation and quiet scan use newest-first fmon order', () => {
    const kobold = { mnum: 59, mx: 66, my: 16, mhp: 1 };
    const pony = { mnum: 100, mx: 67, my: 9, mhp: 8, pet: true };
    const monsters = [kobold, pony];

    const allocations = allocateMonsterMovement(monsters, rolls([2, 3]));
    assert.deepEqual(allocations.map(entry => entry.monster), [pony, kobold]);
    assert.deepEqual(allocations.map(entry => entry.amount), [24, 12]);

    const scan = scanMonsterMovement(monsters);
    assert.deepEqual(scan.rounds, [[pony, kobold], [pony]]);
    assert.deepEqual(scan.actors, [pony, kobold, pony]);
    assert.equal(pony.movement, 0);
    assert.equal(kobold.movement, 0);
});

test('seed0006 assigns the four observed rolls to kitten, zombie, rat, zombie', () => {
    const firstZombie = { mnum: 239, mx: 1, my: 1, mhp: 1 };
    const rat = { mnum: 88, mx: 2, my: 2, mhp: 1 };
    const lastZombie = { mnum: 239, mx: 3, my: 3, mhp: 1 };
    const kitten = { mnum: 32, mx: 4, my: 4, mhp: 1, pet: true };
    const monsters = [firstZombie, rat, lastZombie, kitten];

    const allocations = allocateMonsterMovement(monsters, rolls([7, 0, 7, 8]));
    assert.deepEqual(allocations.map(entry => entry.monster),
        [kitten, lastZombie, rat, firstZombie]);
    assert.deepEqual(allocations.map(entry => entry.amount), [12, 12, 12, 0]);
    assert.deepEqual(scanMonsterMovement(monsters).actors,
        [kitten, lastZombie, rat]);
});

test('Knight starts with the pinned source PM_PONY identity', () => {
    assert.equal(roles.find(role => role.key === 'knight').petnum, 100);
});

test('quiet actor schedules reproduce the source phase call shapes', () => {
    const state = {
        u: { ux: 10, uy: 10 },
        level: { at: () => ({ typ: 25 }) }, // ROOM
    };
    const pony = { mnum: 100, mx: 12, my: 10, pet: true };
    const kobold = { mnum: 59, mx: 20, my: 10 };
    const seen = [];
    const actions = runQuietMonsterActions(
        [pony, kobold, pony], state, range => {
            seen.push(range);
            return 1;
        },
    );
    assert.deepEqual(seen, [5, 4, 5, 5, 5, 5, 4, 5]);
    assert.deepEqual(actions.map(action => action.calls),
        [[5, 4, 5], [5, 5], [5, 4, 5]]);
});
