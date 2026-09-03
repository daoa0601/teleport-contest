import test from 'node:test';
import assert from 'node:assert/strict';

import {
    AMULET_OF_YENDOR, CORPSE, ORCISH_DAGGER,
} from '../js/object_data.js';
import { game } from '../js/gstate.js';
import { mksobj, set_corpsenm } from '../js/mklev.js';
import { removeWishGrantingMonster } from '../js/monster_departure.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { createMonsterAt } from './support/monsters.js';

test('wish departure leaves protected identities and removes ordinary cargo',
    async () => {
        freshGame();
        initRng(3n);
        const monster = await createMonsterAt(315, 11, 10);
        game.u.ustuck = monster;
        game.u.uswallow = true;
        const invocation = mksobj(AMULET_OF_YENDOR, true, false);
        const quest = mksobj(ORCISH_DAGGER, true, false);
        quest.questArtifact = true;
        quest.worn = true;
        quest.owornmask = 4;
        const ordinary = mksobj(ORCISH_DAGGER, true, false);
        addObjectToMonsterInventory(monster, invocation, game);
        addObjectToMonsterInventory(monster, quest, game);
        addObjectToMonsterInventory(monster, ordinary, game);
        const result = removeWishGrantingMonster(monster, {
            preserveGlyph: true,
        });

        assert.deepEqual(new Set(result.dropped), new Set([invocation, quest]));
        assert.ok(result.discarded.includes(ordinary));
        assert.equal(result.discarded.includes(invocation), false);
        assert.equal(result.discarded.includes(quest), false);
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

test('Rider corpses survive departure as floor identities', async () => {
    freshGame();
    initRng(3n);
    const monster = await createMonsterAt(289, 12, 9);
    game.u.ustuck = monster;
    game.u.uswallow = true;
    const rider = mksobj(CORPSE, true, false);
    set_corpsenm(rider, 311);
    addObjectToMonsterInventory(monster, rider, game);
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
