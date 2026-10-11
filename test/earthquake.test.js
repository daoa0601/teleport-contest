import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLNO, DOOR, D_CLOSED, D_NODOOR, MOAT, PIT, ROOM, ROWNO, STONE, TT_PIT, W_AMUL, } from '../js/const.js';
import { createEarthquake } from '../js/earthquake.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { heroIsPolymorphed } from '../js/polyself.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { addTrap } from './support/level-state.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { playInstrument } from '../js/music.js';
import { AMULET_OF_LIFE_SAVING, BOULDER, DRUM_OF_EARTHQUAKE, } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject, } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';
async function targetMonster(x, y, { hitPoints = 100, maxHitPoints = hitPoints, } = {}) {
    const monster = await createMonsterAt('giant ant', x, y);
    monster.mhp = hitPoints;
    monster.mhpmax = maxHitPoints;
    monster.mfrozen = 0;
    monster.msleeping = 1;
    monster.mstrategy = 0;
    return monster;
}
async function earthquakeDrum(charges) {
    return knownObject(DRUM_OF_EARTHQUAKE, { spe: charges });
}
void test('an earthquake opens chasms under the hero and nearby monsters', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    game.u.uhp = game.u.uhpmax = 1000;
    const monster = await targetMonster(11, 10);
    pushKeys(' '.repeat(100));
    await createEarthquake(13);
    assert.ok(level.traps.some(trap => trap.tx === 10 && trap.ty === 10 && trap.ttyp === PIT));
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok(game.u.uhp < 1000);
    assert.equal(monster.mtrapped, 1);
    assert.ok(monster.mhp < 100);
});
void test("a monster's life-saving amulet works after an earthquake fall", async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    game.u.uhp = game.u.uhpmax = 1000;
    const monster = await targetMonster(11, 10, {
        hitPoints: 1,
        maxHitPoints: 1,
    });
    const amulet = await equipMonsterObject(monster, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    pushKeys(' '.repeat(100));
    await createEarthquake(13);
    assert.equal(level.monsters.includes(monster), true);
    assert.ok(monster.mhp > 0);
    assert.equal(amulet.where, 'gone');
});
void test('an earthquake collapses doors and drops boulders into chasms', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    game.u.uhp = game.u.uhpmax = 1000;
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    const boulder = await floorObject(BOULDER, 12, 10);
    pushKeys(' '.repeat(100));
    await createEarthquake(13);
    assert.equal(door.typ, DOOR);
    assert.equal(door.doormask, D_NODOOR);
    assert.equal(boulder.where, 'gone');
    assert.equal(level.traps.some(trap => trap.tx === 12 && trap.ty === 10), false);
});
void test('a nearby moat flows into a new chasm', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++)
            level.requireAt(x, y).typ = STONE;
    }
    const center = { x: 12, y: 10 };
    level.requireAt(center.x, center.y).typ = ROOM;
    for (let x = center.x - 1; x <= center.x + 1; x++) {
        for (let y = center.y - 1; y <= center.y + 1; y++) {
            if (x !== center.x || y !== center.y)
                level.requireAt(x, y).typ = MOAT;
        }
    }
    game.u.ux = 16;
    game.u.uy = 10;
    initRng(1n);
    await createEarthquake(13);
    assert.equal(level.requireAt(center.x, center.y).typ, MOAT);
    assert.equal(level.traps.some(trap => trap.tx === center.x && trap.ty === center.y), false);
});
void test('a charged earthquake drum shakes the level and spends one charge', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    game.u.ulevel = 30;
    game.u.uhp = game.u.uhpmax = 1000;
    const drum = await earthquakeDrum(2);
    pushKeys(' '.repeat(200));
    await playInstrument(drum);
    assert.equal(drum.spe, 1);
    assert.equal(drum.typeKnown, true);
    assert.ok(level.traps.length > 0);
});
void test('an empty earthquake drum acts like an ordinary drum', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    const monster = await targetMonster(11, 10);
    const drum = await earthquakeDrum(0);
    pushKeys(' '.repeat(20));
    await playInstrument(drum);
    assert.equal(level.traps.length, 0);
    assert.equal(monster.msleeping, 0);
    assert.equal(game.u.deafTurns ?? 0, 0);
});
for (const formHitPoints of [100, 1]) {
    void test(`a chasm ${formHitPoints === 1 ? 'breaks the monster form and continues' : 'damages the monster body, not hidden human HP'}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requireFixtureGame(game);
        installPolymorphedHero('giant ant', { hitPoints: formHitPoints, maxHitPoints: 100 });
        const sleeper = await createMonsterAt('jackal', 12, 10);
        sleeper.msleeping = 1;
        pushKeys(' '.repeat(300));
        initRng(1n);
        const result = await createEarthquake(10);
        assert.equal(result.heroDied, false);
        assert.equal(game.u.uhp, 100);
        assert.equal(sleeper.msleeping, 0);
        if (formHitPoints === 1)
            assert.equal(heroIsPolymorphed(game), false);
        else
            assert.ok(game.u.mh < formHitPoints);
    });
}
for (const lifesaving of [false, true]) {
    void test(`chasm ${lifesaving ? 'life saving resumes the earthquake scan' : 'permanent death stops the earthquake scan'}`, async () => {
        freshObjectRoom({ hero: { uhp: 1, uhpmax: 100 } });
        requireFixtureGame(game);
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        const sleeper = await createMonsterAt('jackal', 12, 10);
        sleeper.msleeping = 1;
        pushKeys(' '.repeat(300));
        initRng(1n);
        const result = await createEarthquake(10);
        assert.equal(result.heroDied, !lifesaving);
        assert.equal(sleeper.msleeping, lifesaving ? 0 : 1);
        if (lifesaving)
            assert.ok(game.u.uhp > 0);
        else
            assert.equal(game._deathKiller, 'fell into a chasm');
    });
}
void test('earthquake jostling in an existing pit damages the current monster body', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requireFixtureGame(game);
    installPolymorphedHero('giant ant', { hitPoints: 100 });
    const pit = addTrap(game.level, PIT, 10, 10);
    pushKeys(' '.repeat(300));
    await triggerHeroTrap(pit);
    const hitPoints = game.u.mh;
    assert.equal(game.u.utraptype, TT_PIT);
    initRng(1n);
    await createEarthquake(10);
    assert.equal(game.u.uhp, 100);
    assert.ok(game.u.mh < hitPoints);
});
//# sourceMappingURL=earthquake.test.js.map