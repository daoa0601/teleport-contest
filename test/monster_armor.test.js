import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT } from '../js/const.js';
import { canSeeMonster } from '../js/display.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory, removeObjectFromMonsterInventory } from '../js/monster_inventory.js';
import { initializeMonsterArmor } from '../js/monworn.js';
import { monsterHasAcidResistance, monsterHasPoisonResistance } from '../js/monster_resistance.js';
import { adjustMonsterSpeed } from '../js/monster_speed.js';
import { setMonsterPermanentInvisibility } from '../js/monster_invisibility.js';
import { ALCHEMY_SMOCK, MUMMY_WRAPPING, OBJECT_NAMES, SPEED_BOOTS } from '../js/object_data.js';
import { coldRayDamageMonster, sleepMonsterFromRay } from '../js/zap.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

test('worn dragon scales protect a monster from cold or sleep', async () => {
    for (const element of ['white', 'orange']) {
        freshObjectRoom();
        const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
        addObjectToMonsterInventory(soldier, knownObject(OBJECT_NAMES.indexOf(`${element} dragon scales`)));
        await initializeMonsterArmor(soldier);
        const health = soldier.mhp;

        if (element === 'white')
            await coldRayDamageMonster(soldier, { publish: async () => {} });
        else
            sleepMonsterFromRay(soldier);

        assert.equal(soldier.mhp, health);
        assert.equal(soldier.mcanmove, 1);
    }
});

test('removing one poison-resistant garment keeps protection from the other', async () => {
    freshObjectRoom();
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const scales = addObjectToMonsterInventory(soldier,
        knownObject(OBJECT_NAMES.indexOf('green dragon scales')));
    const smock = addObjectToMonsterInventory(soldier, knownObject(ALCHEMY_SMOCK));
    await initializeMonsterArmor(soldier);

    assert.equal(monsterHasAcidResistance(soldier), true);
    assert.equal(monsterHasPoisonResistance(soldier), true);
    await removeObjectFromMonsterInventory(soldier, smock);

    assert.equal(monsterHasAcidResistance(soldier), false);
    assert.equal(monsterHasPoisonResistance(soldier), true);
    await removeObjectFromMonsterInventory(soldier, scales);
    assert.equal(monsterHasPoisonResistance(soldier), false);
});

test('removing an invisibility cloak makes its wearer visible again', async () => {
    freshObjectRoom();
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const cloak = addObjectToMonsterInventory(soldier,
        knownObject(OBJECT_NAMES.indexOf('cloak of invisibility')));
    await initializeMonsterArmor(soldier);

    assert.equal(canSeeMonster(soldier, 11, 10), false);
    await removeObjectFromMonsterInventory(soldier, cloak);
    assert.equal(canSeeMonster(soldier, 11, 10), true);
});

test('speed boots preserve speed after slowing but not after removal', async () => {
    freshObjectRoom();
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const boots = addObjectToMonsterInventory(soldier, knownObject(SPEED_BOOTS));
    await initializeMonsterArmor(soldier);

    assert.equal(soldier.mspeed, 2);
    adjustMonsterSpeed(soldier, -1);
    assert.equal(soldier.mspeed, 2);
    await removeObjectFromMonsterInventory(soldier, boots, game, { publish: async () => {} });
    assert.equal(soldier.mspeed, 1);
});

test('mummy wrapping blocks permanent invisibility only while worn', async () => {
    freshObjectRoom();
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    setMonsterPermanentInvisibility(soldier);
    const wrapping = addObjectToMonsterInventory(soldier, knownObject(MUMMY_WRAPPING));
    await initializeMonsterArmor(soldier);

    assert.equal(canSeeMonster(soldier, 11, 10), true);
    await removeObjectFromMonsterInventory(soldier, wrapping);
    assert.equal(canSeeMonster(soldier, 11, 10), false);
});
