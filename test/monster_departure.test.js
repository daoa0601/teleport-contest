import test from 'node:test';
import assert from 'node:assert/strict';

import {
    AMULET_OF_YENDOR, CORPSE, ORCISH_DAGGER,
} from '../js/object_data.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { removeWishGrantingMonster } from '../js/monster_departure.js';
import { initRng } from '../js/rng.js';

function installDepartureState(monster) {
    resetGame();
    game.level = new GameMap();
    game.level.monsters = [monster, { mnum: 0 }];
    game.u = { ux: 10, uy: 10, ustuck: monster, uswallow: true };
    initRng(3n);
}

test('wish departure leaves protected identities and removes ordinary cargo', () => {
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
    const monster = {
        mnum: 289, mx: 12, my: 9, mhp: 20,
        minvent: [rider], hasInventory: true,
    };
    monster.inventory = monster.minvent;
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
