import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { canSeeMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addObjectToMonsterInventory, removeObjectFromMonsterInventory } from '../js/monster_inventory.js';
import { initializeMonsterArmor } from '../js/monworn.js';
import { monsterHasAcidResistance, monsterHasPoisonResistance } from '../js/monster_resistance.js';
import { adjustMonsterSpeed } from '../js/monster_speed.js';
import { setMonsterPermanentInvisibility } from '../js/monster_invisibility.js';
import { ALCHEMY_SMOCK, MUMMY_WRAPPING, OBJECT_NAMES, SPEED_BOOTS } from '../js/object_data.js';
import { hitMonsterWithRay } from '../js/zap.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('worn dragon scales protect a monster from cold or sleep', async () => {
    for (const element of ['white', 'orange']) {
        freshObjectRoom();
        requirePlayingGame(game);
        const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
        await addObjectToMonsterInventory(soldier, await knownObject(OBJECT_NAMES.indexOf(`${element} dragon scales`)));
        await initializeMonsterArmor(soldier);
        const health = soldier.mhp;
        if (element === 'white')
            await hitMonsterWithRay(soldier, 2, 6);
        else
            await hitMonsterWithRay(soldier, 3, 6);
        assert.equal(soldier.mhp, health);
        assert.equal(soldier.mcanmove, 1);
    }
});
void test('removing one poison-resistant garment keeps protection from the other', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const scales = await addObjectToMonsterInventory(soldier, await knownObject(OBJECT_NAMES.indexOf('green dragon scales')));
    assert.ok(scales);
    const smock = await addObjectToMonsterInventory(soldier, await knownObject(ALCHEMY_SMOCK));
    assert.ok(smock);
    await initializeMonsterArmor(soldier);
    assert.equal(monsterHasAcidResistance(soldier), true);
    assert.equal(monsterHasPoisonResistance(soldier), true);
    await removeObjectFromMonsterInventory(soldier, smock);
    assert.equal(monsterHasAcidResistance(soldier), false);
    assert.equal(monsterHasPoisonResistance(soldier), true);
    await removeObjectFromMonsterInventory(soldier, scales);
    assert.equal(monsterHasPoisonResistance(soldier), false);
});
void test('removing an invisibility cloak makes its wearer visible again', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const cloak = await addObjectToMonsterInventory(soldier, await knownObject(OBJECT_NAMES.indexOf('cloak of invisibility')));
    assert.ok(cloak);
    await initializeMonsterArmor(soldier);
    assert.equal(canSeeMonster(soldier), false);
    await removeObjectFromMonsterInventory(soldier, cloak);
    assert.equal(canSeeMonster(soldier), true);
});
void test('speed boots preserve speed after slowing but not after removal', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const boots = await addObjectToMonsterInventory(soldier, await knownObject(SPEED_BOOTS));
    assert.ok(boots);
    await initializeMonsterArmor(soldier);
    assert.equal(soldier.mspeed, 2);
    adjustMonsterSpeed(soldier, -1);
    assert.equal(soldier.mspeed, 2);
    await removeObjectFromMonsterInventory(soldier, boots, game, { publish: async () => { } });
    assert.equal(soldier.mspeed, 1);
});
void test('mummy wrapping blocks permanent invisibility only while worn', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    setMonsterPermanentInvisibility(soldier);
    const wrapping = await addObjectToMonsterInventory(soldier, await knownObject(MUMMY_WRAPPING));
    assert.ok(wrapping);
    await initializeMonsterArmor(soldier);
    assert.equal(canSeeMonster(soldier), true);
    await removeObjectFromMonsterInventory(soldier, wrapping);
    assert.equal(canSeeMonster(soldier), false);
});
//# sourceMappingURL=monster_armor.test.js.map