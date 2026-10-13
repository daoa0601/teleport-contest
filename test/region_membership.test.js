import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createHarmlessGasCloudSelection, runLevelRegions } from '../js/regions.js';
import { relocateMonsterTo } from '../js/teleport.js';
import { displaceMonster } from '../js/monster_displacement.js';
import { hurtleMonster } from '../js/monster_hurtle.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { saveGame, restoreGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { finishMonsterKilled } from '../js/monster_death.js';
import { AD_DRST } from '../js/monster_attack_types.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const startsInside of [false, true]) {
    void test(`a pet swapped ${startsInside ? 'out of' : 'into'} gas keeps its prior exposure until its own movement`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const pet = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
        initializePet(pet, { state: game });
        pet.mhp = pet.mhpmax = 100;
        const cloud = createHarmlessGasCloudSelection(game, [{ x: startsInside ? 11 : 10, y: 10 }], { ttl: 10 });
        assert.ok(cloud);
        cloud.damage = 8;
        resetInputState().feed(' ');
        await rhack('l'.charCodeAt(0));
        await runLevelRegions(game, { publish: async () => { } });
        assert.equal(pet.mx, 10);
        assert.equal(pet.mhp < 100, startsInside);
    });
}
void test('gas affects existing occupants in map scan order, independently of monster creation order', async () => {
    freshObjectRoom();
    const right = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
    const left = await createMonsterAt('jackal', 11, 10, NO_MINVENT);
    left.mhp = right.mhp = 100;
    const cloud = createHarmlessGasCloudSelection(game, [{ x: 13, y: 10 }, { x: 11, y: 10 }], { ttl: 10 });
    assert.ok(cloud);
    cloud.damage = 8;
    const messages = [];
    await runLevelRegions(game, { publish: async (message) => { messages.push(message); } });
    assert.deepEqual(messages, ['The jackal coughs!', 'The soldier coughs!']);
    assert.ok(left.mhp < 100);
    assert.ok(right.mhp < 100);
});
void test('gas deaths process the replacement occupant before the next member', async () => {
    freshObjectRoom();
    const jackal = await createMonsterAt('jackal', 11, 10, NO_MINVENT);
    const dog = await createMonsterAt('little dog', 12, 10, NO_MINVENT);
    const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
    jackal.mhp = 1;
    dog.mhp = soldier.mhp = 100;
    const cloud = createHarmlessGasCloudSelection(game, [{ x: 11, y: 10 }, { x: 12, y: 10 }, { x: 13, y: 10 }], { ttl: 10 });
    assert.ok(cloud);
    cloud.damage = 8;
    const messages = [];
    await runLevelRegions(game, {
        publish: async (message) => { messages.push(message); },
        onMonsterDeath: monster => finishMonsterKilled(monster, game, {
            cause: 'gas cloud', damageType: AD_DRST, publish: async () => { },
        }),
    });
    assert.equal(jackal.dead, true);
    assert.deepEqual(messages, ['The jackal coughs!', 'The soldier coughs!', 'The little dog coughs!']);
    assert.ok(dog.mhp < 100);
    assert.ok(soldier.mhp < 100);
});
void test('a monster teleporting into and out of gas changes its exposure', async () => {
    freshObjectRoom();
    const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
    soldier.mhp = 100;
    const cloud = createHarmlessGasCloudSelection(game, [{ x: 11, y: 10 }], { ttl: 10 });
    assert.ok(cloud);
    cloud.damage = 8;
    await relocateMonsterTo(soldier, 11, 10);
    await runLevelRegions(game, { publish: async () => { } });
    assert.ok(soldier.mhp < 100);
    const hp = soldier.mhp;
    await relocateMonsterTo(soldier, 13, 10);
    await runLevelRegions(game, { publish: async () => { } });
    assert.equal(soldier.mhp, hp);
});
for (const startsInside of [false, true]) {
    void test(`knockback ${startsInside ? 'out of' : 'into'} gas changes the monster's exposure`, async () => {
        freshObjectRoom();
        const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
        soldier.mhp = 100;
        const cloud = createHarmlessGasCloudSelection(game, [{ x: startsInside ? 11 : 13, y: 10 }], { ttl: 10 });
        assert.ok(cloud);
        cloud.damage = 8;
        await hurtleMonster(soldier, 1, 0, 2);
        await runLevelRegions(game, { publish: async () => { } });
        assert.equal(soldier.mx, 13, 'Knockback crosses two open squares');
        assert.equal(soldier.mhp < 100, !startsInside);
    });
}
void test('displacing another monster updates gas exposure for both actors', async () => {
    freshObjectRoom();
    const beast = await createMonsterAt('displacer beast', 12, 10, NO_MINVENT);
    const dog = await createMonsterAt('little dog', 13, 10, NO_MINVENT);
    beast.mhp = dog.mhp = 100;
    const cloud = createHarmlessGasCloudSelection(game, [{ x: 13, y: 10 }], { ttl: 10 });
    assert.ok(cloud);
    cloud.damage = 8;
    for (let attempt = 0; attempt < 20 && beast.mx === 12; attempt++)
        await displaceMonster(beast, dog, game, { quietly: true });
    assert.equal(beast.mx, 13, 'The beast must accept a displacement attempt');
    await runLevelRegions(game, { publish: async () => { } });
    assert.ok(beast.mhp < 100);
    assert.equal(dog.mhp, 100);
});
void test('a pet walking out of a harmless cloud loses exposure before the cloud becomes poisonous', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await createMonsterAt('little dog', 13, 10, NO_MINVENT);
    initializePet(pet, { state: game });
    pet.mhp = 100;
    const cloud = createHarmlessGasCloudSelection(game, [{ x: 13, y: 10 }], { ttl: 10 });
    assert.ok(cloud);
    for (let attempt = 0; attempt < 20 && pet.mx === 13 && pet.my === 10; attempt++)
        await takeMonsterTurn(pet, game);
    assert.ok(pet.mx !== 13 || pet.my !== 10, 'The pet must move toward the hero');
    cloud.damage = 8;
    await runLevelRegions(game, { publish: async () => { } });
    assert.equal(pet.mhp, 100);
});
void test('saving after a hero/pet swap retains prior gas exposure after restore', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(pet, { state: game });
    pet.mhp = 100;
    const cloud = createHarmlessGasCloudSelection(game, [{ x: 10, y: 10 }], { ttl: 10 });
    assert.ok(cloud);
    cloud.damage = 8;
    resetInputState().feed(' ');
    await rhack('l'.charCodeAt(0));
    const id = pet.m_id;
    game.plname = 'GasSaver';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('GasSaver', storage), true);
    const restored = game.level.monsters.find(monster => monster.m_id === id);
    assert.ok(restored);
    await runLevelRegions(game, { publish: async () => { } });
    assert.equal(restored.mx, 10);
    assert.equal(restored.mhp, 100);
});
//# sourceMappingURL=region_membership.test.js.map