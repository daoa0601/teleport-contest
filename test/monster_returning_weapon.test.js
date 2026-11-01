import test from 'node:test';
import assert from 'node:assert/strict';
import { findArmorClass } from '../js/armor.js';
import { DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DRAWBRIDGE_UP, NEED_WEAPON, NO_MINVENT, W_AMUL, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { monsterWieldedWeapon } from '../js/monster_weapon.js';
import { readyRangedMonsterWeapon, returnMonsterWeapon, throwMonsterWeaponAtHero } from '../js/mthrowu.js';
import { resetInputState } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { findMonsterArmorClass } from '../js/monworn.js';
import { addObjectToMonsterInventory } from '../js/steal.js';
import { AKLYS, AMULET_OF_LIFE_SAVING, CLUB, DAGGER, OIL_LAMP, TALLOW_CANDLE, WAR_HAMMER } from '../js/object_data.js';
import { rn2 } from '../js/rng.js';
import { artifactObject, knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { setMonsterApparentHeroPosition } from '../js/monmove.js';
void test('an uncaught returning candle is extinguished before landing', async () => {
    const level = await freshObjectRoom();
    const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
    const candle = await knownObject(TALLOW_CANDLE, { age: 100 });
    beginObjectBurn(candle, game);
    const messages = [];
    await returnMonsterWeapon(soldier, candle, 12, 10, {
        random: () => 0, publish: async (message) => { messages.push(message); },
    });
    assert.equal(candle.lamplit, false);
    assert.equal(candle.timed, 0);
    assert.ok(floorObjectsAt(level, 12, 10).includes(candle));
    assert.ok(messages.includes("The candle's flame is extinguished."));
});
void test('an uncaught returning lamp requests new lighting at its landing position', async () => {
    const level = await freshObjectRoom();
    const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
    const lamp = await knownObject(OIL_LAMP, { age: 100 });
    beginObjectBurn(lamp, game);
    game.vision_full_recalc = 0;
    await returnMonsterWeapon(soldier, lamp, 12, 10, {
        random: () => 0, publish: async () => { },
    });
    assert.equal(lamp.lamplit, true);
    assert.ok(floorObjectsAt(level, 12, 10).includes(lamp));
    assert.equal(game.vision_full_recalc, 1);
});
for (const { underlay, surface, splash } of [
    { underlay: DB_FLOOR, surface: 'floor', splash: false },
    { underlay: DB_ICE, surface: 'ice', splash: false },
    { underlay: DB_MOAT, surface: 'water', splash: true },
]) {
    void test(`a returning club landing on ${surface} below a raised bridge ${splash ? 'splashes' : 'does not splash'}`, async () => {
        const level = await freshObjectRoom();
        const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
        const club = await knownObject(AKLYS);
        const landing = level.requireAt(12, 10);
        landing.typ = DRAWBRIDGE_UP;
        landing.drawbridgemask = underlay;
        const messages = [];
        await returnMonsterWeapon(soldier, club, 12, 10, {
            random: () => 0,
            publish: async (message) => { messages.push(message); },
        });
        assert.ok(floorObjectsAt(level, 12, 10).includes(club), 'the snapped tether leaves the club on its landing square');
        assert.equal(messages.includes('Splash!'), splash);
    });
}
for (const { type, name, splash } of [
    { type: CLUB, name: 'a fireproof wooden club', splash: false },
    { type: WAR_HAMMER, name: 'a metal hammer', splash: true },
]) {
    void test(`${name} landing in lava below a raised bridge ${splash ? 'splashes' : 'does not splash'}`, async () => {
        const level = await freshObjectRoom();
        const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
        const weapon = await knownObject(type, { oerodeproof: true });
        const landing = level.requireAt(12, 10);
        landing.typ = DRAWBRIDGE_UP;
        landing.drawbridgemask = DB_LAVA;
        const messages = [];
        await returnMonsterWeapon(soldier, weapon, 12, 10, {
            random: () => 0,
            publish: async (message) => { messages.push(message); },
        });
        assert.ok(floorObjectsAt(level, 12, 10).includes(weapon));
        assert.equal(messages.includes('Splash!'), splash);
    });
}
async function armedSoldier() {
    await freshObjectRoom();
    requirePlayingGame(game);
    findArmorClass();
    const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
    await equipMonsterObject(soldier, await knownObject(AKLYS, { spe: 3 }), W_WEP);
    setMonsterApparentHeroPosition(soldier, game, rn2);
    return soldier;
}
void test('an unseen thrower missing its returning club reports Something landing nearby', async () => {
    const soldier = await armedSoldier();
    requirePlayingGame(game);
    soldier.mconf = true;
    soldier.minvis = true;
    const aklys = soldier.mw;
    assert.ok(aklys);
    const messages = [];
    await throwMonsterWeaponAtHero(soldier, game, aklys, {
        random: limit => limit === 2 ? 0 : 1,
        rollOne: () => 1,
        publish: async (message) => { messages.push(message); },
    });
    assert.ok(messages.includes('You hear Something land near it.'), messages.join(' | '));
    assert.ok(floorObjectsAt(game.level, soldier.mx, soldier.my).includes(aklys));
    assert.equal(soldier.mw, null);
});
void test('a monster chooses its tethered club before an expendable dagger', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
    setMonsterApparentHeroPosition(soldier, game, rn2);
    const aklys = await addObjectToMonsterInventory(soldier, await knownObject(AKLYS));
    assert.ok(aklys);
    await addObjectToMonsterInventory(soldier, await knownObject(DAGGER));
    soldier.weaponCheck = NEED_WEAPON;
    const input = resetInputState();
    const wielding = readyRangedMonsterWeapon(soldier);
    await input.waitUntilBlocked();
    input.feed(' ');
    await wielding;
    assert.equal(monsterWieldedWeapon(soldier)?.o_id, aklys.o_id);
});
void test('a monster catches its returning aklys and can use it again', async () => {
    const soldier = await armedSoldier();
    requirePlayingGame(game);
    const aklys = soldier.mw;
    assert.ok(aklys);
    await throwMonsterWeaponAtHero(soldier, game, aklys, {
        random: () => 1,
        publish: async () => { },
    });
    assert.equal(monsterWieldedWeapon(soldier)?.o_id, aklys.o_id);
    assert.ok(soldier.minvent.includes(aklys));
    assert.equal((aklys.owornmask ?? 0) & W_WEP, W_WEP);
    assert.equal(floorObjectsAt(game.level, game.u.ux, game.u.uy).includes(aklys), false);
});
void test('a caught aklys stays wielded without counting as worn armor', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
    setMonsterApparentHeroPosition(soldier, game, rn2);
    const aklys = await addObjectToMonsterInventory(soldier, await knownObject(AKLYS, { spe: -3 }));
    assert.ok(aklys);
    soldier.weaponCheck = NEED_WEAPON;
    const input = resetInputState();
    const wielding = readyRangedMonsterWeapon(soldier);
    await input.waitUntilBlocked();
    input.feed(' ');
    await wielding;
    const armorClass = findMonsterArmorClass(soldier);
    await throwMonsterWeaponAtHero(soldier, game, aklys, {
        random: () => 1,
        publish: async () => { },
    });
    assert.equal(monsterWieldedWeapon(soldier)?.o_id, aklys.o_id);
    assert.equal(findMonsterArmorClass(soldier), armorClass);
});
void test('a snapped tether leaves the aklys where its outward flight ended', async () => {
    const soldier = await armedSoldier();
    requirePlayingGame(game);
    const aklys = soldier.mw;
    assert.ok(aklys);
    const messages = [];
    await throwMonsterWeaponAtHero(soldier, game, aklys, {
        random: () => 0,
        publish: async (message) => messages.push(message),
    });
    assert.equal(soldier.mw, null);
    assert.equal(aklys.owornmask, 0);
    assert.ok(floorObjectsAt(game.level, game.u.ux, game.u.uy).includes(aklys));
    assert.ok(messages.includes('You hear a loud snap!'));
});
void test('a confused monster can be hit by its own returning club', async () => {
    const soldier = await armedSoldier();
    requirePlayingGame(game);
    soldier.mconf = true;
    const aklys = soldier.mw;
    assert.ok(aklys);
    const health = soldier.mhp;
    await throwMonsterWeaponAtHero(soldier, game, aklys, {
        random: () => 1,
        publish: async () => { },
    });
    const damage = health - soldier.mhp;
    assert.ok(damage >= 2 && damage <= 4, `expected 2 to 4 damage, got ${damage}`);
    assert.equal(soldier.mw, null);
    assert.ok(floorObjectsAt(game.level, soldier.mx, soldier.my).includes(aklys));
});
// C return_from_mtoss() accepts an artifact object even though its current
// callers return only aklyses, which have no stock artifact. Exercise that
// public return boundary with a real artifact and no attacking creature.
void test('an uncaught returning artifact adds its elemental damage against its thrower', async () => {
    const level = await freshObjectRoom();
    const ogre = await createMonsterAt('ogre', 13, 10, NO_MINVENT);
    ogre.mconf = true;
    ogre.mhp = ogre.mhpmax = 40;
    const blade = await artifactObject('Fire Brand');
    const messages = [];
    await returnMonsterWeapon(ogre, blade, 12, 10, {
        random: () => 1,
        rollOne: sides => sides,
        publish: async (message) => { messages.push(message); },
    });
    assert.ok(messages.includes('The fiery blade burns the ogre!'), messages.join(' | '));
    assert.equal(ogre.mhp, 32, 'Fire Brand doubles the four-point impact');
    assert.ok(floorObjectsAt(level, ogre.mx, ogre.my).includes(blade));
});
void test('life saving revives a monster killed by its returning club without catching it', async () => {
    const soldier = await armedSoldier();
    requirePlayingGame(game);
    soldier.mconf = true;
    soldier.mhp = 1;
    const aklys = soldier.mw;
    assert.ok(aklys);
    await equipMonsterObject(soldier, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const input = resetInputState();
    const returning = throwMonsterWeaponAtHero(soldier, game, aklys, {
        random: () => 1,
        publish: async () => { },
    });
    await input.waitUntilBlocked();
    assert.ok(soldier.mhp <= 0);
    input.feed('   ');
    await returning;
    assert.ok(game.level.monsters.includes(soldier));
    assert.ok(soldier.mhp > 1);
    assert.equal(soldier.minvent.some(object => object.otyp === AMULET_OF_LIFE_SAVING), false);
    assert.equal(soldier.mw, null);
    assert.ok(floorObjectsAt(game.level, soldier.mx, soldier.my).includes(aklys));
});
//# sourceMappingURL=monster_returning_weapon.test.js.map