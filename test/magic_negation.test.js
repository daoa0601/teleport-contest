import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { NO_MINVENT, W_ARMC } from '../js/const.js';
import { game } from '../js/gstate.js';
import { magicNegation } from '../js/magic_negation.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { AMULET_OF_GUARDING, CLOAK_OF_PROTECTION, RIN_PROTECTION } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

test('protection accessories help only while worn and do not stack', () => {
    freshObjectRoom();
    const ring = addInventoryObject(RIN_PROTECTION);
    const amulet = addInventoryObject(AMULET_OF_GUARDING);
    assert.equal(magicNegation(game.u), 0);

    wearHeroAccessory(ring, 'uleft');
    assert.equal(magicNegation(game.u), 1);

    wearHeroAccessory(amulet, 'uamul');
    assert.equal(magicNegation(game.u), 2);
});

test('a protection cloak cancels special attacks only while worn', async () => {
    const protection = [];
    for (const worn of [false, true]) {
        freshObjectRoom();
        const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
        const cloak = knownObject(CLOAK_OF_PROTECTION);
        if (worn) equipMonsterObject(soldier, cloak, W_ARMC);
        else addObjectToMonsterInventory(soldier, cloak);

        protection.push(magicNegation(soldier));
    }

    assert.equal(protection[0], 0);
    assert.equal(protection[1], 3);
});

test('a high cleric has protection without any equipment', async () => {
    freshObjectRoom();
    const cleric = await createMonsterAt('high cleric', 11, 10, NO_MINVENT);

    assert.equal(magicNegation(cleric, game), 1);
});
