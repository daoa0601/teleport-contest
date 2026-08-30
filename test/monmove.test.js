import test from 'node:test';
import assert from 'node:assert/strict';

import {
    allocateMonsterMovement, mcalcmove, naturalMonsterSpeed,
} from '../js/monmove.js';
import { roles } from '../js/roles.js';

function rolls(values) {
    let index = 0;
    return () => values[index++];
}

test('natural monster speed and randomized movement use species data', () => {
    assert.equal(naturalMonsterSpeed({ mnum: 100 }), 16); // pony
    assert.equal(naturalMonsterSpeed({ mnum: 32 }), 18); // kitten
    assert.equal(mcalcmove({ mnum: 100 }, true, rolls([2])), 24);
    assert.equal(mcalcmove({ mnum: 100 }, true, rolls([4])), 12);
    assert.equal(mcalcmove({ mnum: 32 }, true, rolls([5])), 24);
    assert.equal(mcalcmove({ mnum: 32 }, true, rolls([6])), 12);
});

test('monster allocation applies newest-first movement to current actors',
    () => {
        const kobold = { mnum: 59, mx: 66, my: 16, mhp: 1 };
        const pony = { mnum: 100, mx: 67, my: 9, mhp: 8, pet: true };
        const monsters = [kobold, pony];

        allocateMonsterMovement(monsters, rolls([2, 3]));

        assert.equal(pony.movement, 24);
        assert.equal(kobold.movement, 12);
    });

test('Knight starts with the source pony species', () => {
    assert.equal(roles.find(role => role.key === 'knight').petnum, 100);
});
