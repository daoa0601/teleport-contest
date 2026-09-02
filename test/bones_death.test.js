import test from 'node:test';
import assert from 'node:assert/strict';

import { dropHeroInventoryForBones } from '../js/bones_death.js';
import { game } from '../js/gstate.js';
import { DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { knownInventoryObject } from './support/game-objects.js';
import { addMonster } from './support/monsters.js';
import { freshCommandRoom } from './support/playable-room.js';

test('a nearby object-loving monster can inherit a dead hero item', () => {
    freshCommandRoom({ seed: 1n });
    const dwarf = addMonster({
        mnum: 44,
        x: 11,
        y: 10,
        hitPoints: 20,
    });
    const dagger = knownInventoryObject(DAGGER, {
        worn: true,
        wielded: true,
        owornmask: 1,
    });
    initRng(7n);

    dropHeroInventoryForBones(10, 10);

    assert.deepEqual(game.inventory, []);
    assert.equal(dwarf.minvent.includes(dagger), true);
    assert.equal(dagger.where, 'minvent');
    assert.equal(dagger.carrierMid, dwarf.m_id);
    assert.equal(dagger.worn, false);
    assert.equal(dagger.wielded, false);
    assert.equal(dagger.owornmask, 0);
    assert.equal(game.level.objects[10]?.[10]?.includes(dagger) ?? false,
        false);
});
