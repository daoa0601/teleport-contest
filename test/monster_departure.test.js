import test from 'node:test';
import assert from 'node:assert/strict';

import {
    AMULET_OF_YENDOR, CORPSE, ORCISH_DAGGER,
} from '../js/object_data.js';
import { removeWishGrantingMonster } from '../js/monster_departure.js';

function departureState(monster) {
    return {
        u: { ustuck: monster, uswallow: true },
        level: { monsters: [monster, { mnum: 0 }] },
    };
}

test('wish departure probes ordinary and quest items but drops protected identities', () => {
    const invocation = { otyp: AMULET_OF_YENDOR, where: 'monster' };
    const quest = {
        otyp: ORCISH_DAGGER, questArtifact: true,
        where: 'monster', worn: true, owornmask: 4,
    };
    const ordinary = { otyp: ORCISH_DAGGER, where: 'monster' };
    const monster = {
        mnum: 315, mx: 11, my: 10, mhp: 12,
        minvent: [invocation, quest, ordinary], hasInventory: true,
    };
    monster.inventory = monster.minvent;
    const state = departureState(monster);
    const ranges = [];
    const dropped = [];
    const repaints = [];

    const result = removeWishGrantingMonster(monster, {
        state,
        random: range => { ranges.push(range); return 99; },
        dropObject: (object, x, y) => {
            object.where = 'floor';
            object.ox = x;
            object.oy = y;
            dropped.push(object);
            return object;
        },
        repaint: (...args) => repaints.push(args),
        preserveGlyph: true,
    });

    assert.deepEqual(ranges, [100, 100]);
    assert.deepEqual(dropped, [invocation, quest]);
    assert.deepEqual(result.discarded, [ordinary]);
    assert.equal(quest.worn, false);
    assert.equal(quest.owornmask, 0);
    assert.equal(ordinary.where, 'gone');
    assert.equal(monster.dead, true);
    assert.deepEqual(monster.minvent, []);
    assert.equal(state.level.monsters.includes(monster), false);
    assert.equal(state.u.ustuck, null);
    assert.equal(state.u.uswallow, false);
    assert.deepEqual(repaints, []);
});

test('Rider corpses resist without RNG and ordinary removal repaints', () => {
    const rider = { otyp: CORPSE, corpsenm: 311, where: 'monster' };
    const monster = {
        mnum: 289, mx: 12, my: 9, mhp: 20,
        minvent: [rider], hasInventory: true,
    };
    monster.inventory = monster.minvent;
    const state = departureState(monster);
    const calls = [];
    const dropped = [];
    const repaints = [];

    const result = removeWishGrantingMonster(monster, {
        state,
        random: range => calls.push(range),
        dropObject: object => { dropped.push(object); return object; },
        repaint: (x, y) => repaints.push([x, y]),
    });

    assert.deepEqual(calls, []);
    assert.deepEqual(dropped, [rider]);
    assert.deepEqual(repaints, [[12, 9]]);
});

test('null wish departure is a zero-work boundary', () => {
    assert.deepEqual(removeWishGrantingMonster(null), {
        removed: false, dropped: [], discarded: [],
    });
});
