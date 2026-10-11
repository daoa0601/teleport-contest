import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { triggerChestTrap } from '../js/chest_trap.js';
import { ICE, ICED_POOL, M_SEEN_COLD, M_SEEN_FIRE, POOL } from '../js/const.js';
import { triggerHeroFireTrap } from '../js/fire_trap.js';
import { adjustLevelAbilities } from '../js/exper.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, CHEST, OBJECT_NAMES, SCR_IDENTIFY } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const source of ['floor', 'carried box', 'floor box']) {
    void test(`${source} fire ${source === 'floor' ? 'burns exposed floor paper' : 'leaves floor paper untouched'}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requireFixtureGame(game);
        const paper = await floorObject(SCR_IDENTIFY, 10, 10, { quan: 40, quantity: 40 });
        const box = source === 'carried box' ? await addInventoryObject(CHEST)
            : source === 'floor box' ? await floorObject(CHEST, 10, 10) : null;
        const messages = [];
        initRng(1n);
        await triggerHeroFireTrap(box, { publish: async (message) => messages.push(message) });
        assert.ok(game.u.uhp < 100);
        assert.equal(messages[0], source === 'floor'
            ? 'A tower of flame erupts from the floor!'
            : 'A tower of flame bursts from the chest!');
        if (source === 'floor')
            assert.ok(paper.quan < 40);
        else
            assert.equal(paper.quan, 40);
    });
}
for (const source of ['submerged floor box', 'submerged carried box', 'dry floor box beside submerged hero']) {
    void test(`fire from a ${source} uses the correct water location`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requireFixtureGame(game);
        const carried = source === 'submerged carried box';
        const box = carried ? await addInventoryObject(CHEST) : await floorObject(CHEST, 11, 10);
        if (source === 'submerged floor box')
            game.level.requireAt(11, 10).typ = POOL;
        else {
            game.level.requireAt(10, 10).typ = POOL;
            game.u.uinwater = 1;
            game.u.magicalBreathing = true;
        }
        const messages = [];
        const steam = source !== 'dry floor box beside submerged hero';
        initRng(1n);
        await triggerHeroFireTrap(box, { publish: async (message) => messages.push(message) });
        assert.equal(messages[0], steam
            ? 'A cascade of steamy bubbles erupts from the chest!'
            : 'A tower of flame bursts from the chest!');
        if (steam) {
            assert.ok(game.u.uhp >= 97 && game.u.uhp < 100);
            assert.equal(game.u.uhpmax, 100);
        }
        else
            assert.ok(game.u.uhpmax < 100);
    });
}
void test('a carried fire trap melts ice even though it does not burn floor objects', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requireFixtureGame(game);
    await wearHeroAccessory(await addInventoryObject(OBJECT_NAMES.indexOf('levitation')), 'uleft');
    const ice = game.level.requireAt(10, 10);
    ice.typ = ICE;
    ice.icedpool = ICED_POOL;
    const box = await addInventoryObject(CHEST);
    const paper = await floorObject(SCR_IDENTIFY, 10, 10, { quan: 40, quantity: 40 });
    pushKeys(' '.repeat(100));
    initRng(1n);
    await triggerHeroFireTrap(box);
    assert.equal(game.level.requireAt(10, 10).typ, POOL);
    assert.equal(paper.quan, 40);
    assert.ok(game.u.levitation);
});
void test('seeing fire resistance granted by Fire Brand updates monster knowledge', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requireFixtureGame(game);
    const watcher = await createMonsterAt('jackal', 12, 10);
    const blindWatcher = await createMonsterAt('jackal', 13, 10);
    blindWatcher.mcansee = 0;
    watcher.seen_resistance = M_SEEN_COLD;
    const artifact = artifactByName('Fire Brand');
    assert.ok(artifact !== null && artifact !== undefined);
    const sword = await addInventoryObject(artifact.baseType);
    nameArtifact(sword, artifact);
    await setPrimaryWeapon(sword);
    pushKeys(' '.repeat(100));
    initRng(1n);
    await triggerHeroFireTrap();
    assert.ok(game.u.uhp >= 99);
    assert.equal(game.u.uhpmax, 100);
    assert.equal(watcher.seen_resistance, M_SEEN_COLD | M_SEEN_FIRE);
    assert.equal((blindWatcher.seen_resistance || 0) & M_SEEN_FIRE, 0);
    await setPrimaryWeapon(null);
    await triggerHeroFireTrap();
    assert.equal(watcher.seen_resistance, M_SEEN_COLD);
    assert.ok(game.u.uhpmax < 100);
});
for (const lifesaving of [false, true]) {
    void test(`a trapped chest fire ${lifesaving ? 'finishes trap discovery after life saving' : 'does not finish discovery after permanent death'}`, async () => {
        freshObjectRoom({ hero: { uhp: 1, uhpmax: 100 } });
        requireFixtureGame(game);
        const box = await addInventoryObject(CHEST, { otrapped: true });
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        pushKeys(' '.repeat(100));
        initRng(7n);
        const result = await triggerChestTrap(box);
        assert.ok(result !== null && result !== undefined);
        assert.equal(result.outcome, 'fire');
        assert.equal(result.died, !lifesaving);
        assert.equal(box.tknown, lifesaving);
        if (lifesaving)
            assert.ok(game.u.uhp > 0);
    });
}
void test('fire damage that drains a level removes the level-granted ability', async () => {
    freshObjectRoom({ role: 'caveman', hero: {
            ulevel: 7, uhp: 8, uhpmax: 8, uhpinc: [0, 0, 0, 0, 0, 0, 1],
        } });
    requireFixtureGame(game);
    pushKeys(' '.repeat(100));
    await adjustLevelAbilities(6, 7);
    assert.equal(game.u.fast, true);
    initRng(1n);
    const result = await triggerHeroFireTrap();
    assert.equal(result.died, false);
    assert.equal(game.u.ulevel, 6);
    assert.equal(game.u.fast, false);
    assert.ok(game.u.uhp > 0 && game.u.uhp < 8);
});
//# sourceMappingURL=hero_fire_trap.test.js.map