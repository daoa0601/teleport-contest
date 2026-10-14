import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { freshSpecialLevel } from './support/special-level.js';
import { createSpecialLevel } from './support/topology.js';

void test('the Castle remains a graveyard for undead deaths after generation', async () => {
    freshSpecialLevel({ prototype: 'castle', seed: 1, depth: 25 });
    game._specialLevelPrototype = 'castle';
    game.stronghold_level = createSpecialLevel({ dnum: 0, dlevel: 25 });

    await mklev();

    assert.equal(game.level?.flags.graveyard, true);
});
