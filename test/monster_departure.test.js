import test from 'node:test';
import assert from 'node:assert/strict';

import {
    AMULET_OF_YENDOR, CORPSE, ORCISH_DAGGER,
} from '../js/object_data.js';
import { game } from '../js/gstate.js';
import { removeWishGrantingMonster } from '../js/monster_departure.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { liveMonster } from './support/monsters.js';

function installDepartureState(monster) {
    freshGame({
        hero: { ustuck: monster, uswallow: true },
    });
    game.level.monsters = [monster, { mnum: 0 }];
    initRng(3n);
}

test('wish departure leaves protected identities and removes ordinary cargo', () => {
    const invocation = { otyp: AMULET_OF_YENDOR, where: 'monster' };
    const quest = {
        otyp: ORCISH_DAGGER, questArtifact: true,
        where: 'monster', worn: true, owornmask: 4,
    };
    const ordinary = { otyp: ORCISH_DAGGER, where: 'monster' };
    const monster = liveMonster({
        mnum: 315, x: 11, y: 10, hitPoints: 12,
        inventory: [invocation, quest, ordinary], hasInventory: true,
    });
    installDepartureState(monster);

    const result = removeWishGrantingMonster(monster, {
        preserveGlyph: true,
    });

    assert.deepEqual(new Set(result.dropped), new Set([invocation, quest]));
    assert.deepEqual(result.discarded, [ordinary]);
    assert.ok(game.level.objects[11][10].includes(invocation));
    assert.ok(game.level.objects[11][10].includes(quest));
    assert.equal(invocation.where, 'floor');
    assert.equal(quest.where, 'floor');
    assert.equal(quest.worn, false);
    assert.equal(quest.owornmask, 0);
    assert.equal(ordinary.where, 'gone');
    assert.equal(monster.dead, true);
    assert.deepEqual(monster.minvent, []);
    assert.equal(game.level.monsters.includes(monster), false);
    assert.equal(game.u.ustuck, null);
    assert.equal(game.u.uswallow, false);
});

test('Rider corpses survive departure as floor identities', () => {
    const rider = { otyp: CORPSE, corpsenm: 311, where: 'monster' };
    const monster = liveMonster({
        mnum: 289, x: 12, y: 9, hitPoints: 20,
        inventory: [rider], hasInventory: true,
    });
    installDepartureState(monster);

    const result = removeWishGrantingMonster(monster, {
        preserveGlyph: true,
    });

    assert.deepEqual(result.dropped, [rider]);
    assert.equal(game.level.objects[12][9][0], rider);
    assert.equal(rider.where, 'floor');
    assert.equal(game.level.monsters.includes(monster), false);
});

test('null wish departure is a zero-work boundary', () => {
    assert.deepEqual(removeWishGrantingMonster(null), {
        removed: false, dropped: [], discarded: [],
    });
});
