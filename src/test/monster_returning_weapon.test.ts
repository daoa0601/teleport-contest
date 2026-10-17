import test from 'node:test';
import assert from 'node:assert/strict';

import { findArmorClass } from '../js/armor.js';
import { DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DRAWBRIDGE_UP, NEED_WEAPON, NO_MINVENT, W_AMUL, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { monsterWieldedWeapon } from '../js/monster_weapon.js';
import { returnMonsterWeapon } from '../js/monster_returning_weapon.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { setMonsterApparentHeroPosition } from '../js/monster_perception.js';
import { readyRangedMonsterWeapon, throwMonsterWeaponAtHero } from '../js/monster_throw.js';
import { AKLYS, AMULET_OF_LIFE_SAVING, CLUB, DAGGER, WAR_HAMMER } from '../js/object_data.js';
import { rn2 } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { underlay, surface, splash } of [
    { underlay: DB_FLOOR, surface: 'floor', splash: false },
    { underlay: DB_ICE, surface: 'ice', splash: false },
    { underlay: DB_MOAT, surface: 'water', splash: true },
]) {
    void test(`a returning club landing on ${surface} below a raised bridge ${splash ? 'splashes' : 'does not splash'}`, async () => {
        const level = freshObjectRoom();
        const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
        const club = await knownObject(AKLYS);
        const landing = level.requireAt(12, 10);
        landing.typ = DRAWBRIDGE_UP;
        landing.drawbridgemask = underlay;
        const messages: string[] = [];

        await returnMonsterWeapon(soldier, club, 12, 10, {
            random: () => 0,
            publish: async message => { messages.push(message); },
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
        const level = freshObjectRoom();
        const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
        const weapon = await knownObject(type, { oerodeproof: true });
        const landing = level.requireAt(12, 10);
        landing.typ = DRAWBRIDGE_UP;
        landing.drawbridgemask = DB_LAVA;
        const messages: string[] = [];

        await returnMonsterWeapon(soldier, weapon, 12, 10, {
            random: () => 0,
            publish: async message => { messages.push(message); },
        });

        assert.ok(floorObjectsAt(level, 12, 10).includes(weapon));
        assert.equal(messages.includes('Splash!'), splash);
    });
}

async function armedSoldier() {
    freshObjectRoom();
    requirePlayingGame(game);
    findArmorClass();
    const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
    await equipMonsterObject(soldier, await knownObject(AKLYS, { spe: 3 }), W_WEP);
    setMonsterApparentHeroPosition(soldier, game, rn2);
    return soldier;
}

void test('a monster chooses its tethered club before an expendable dagger', async () => {
    freshObjectRoom();
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
        publish: async () => {},
    });

    assert.equal(monsterWieldedWeapon(soldier)?.o_id, aklys.o_id);
    assert.ok(soldier.minvent.includes(aklys));
    assert.equal((aklys.owornmask ?? 0) & W_WEP, W_WEP);
    assert.equal(floorObjectsAt(game.level, game.u.ux, game.u.uy).includes(aklys), false);
});

void test('a snapped tether leaves the aklys where its outward flight ended', async () => {
    const soldier = await armedSoldier();
    requirePlayingGame(game);
    const aklys = soldier.mw;
    assert.ok(aklys);
    const messages: string[] = [];
    await throwMonsterWeaponAtHero(soldier, game, aklys, {
        random: () => 0,
        publish: async (message: string) => messages.push(message),
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
        publish: async () => {},
    });

    const damage = health - soldier.mhp;
    assert.ok(damage >= 2 && damage <= 4, `expected 2 to 4 damage, got ${damage}`);
    assert.equal(soldier.mw, null);
    assert.ok(floorObjectsAt(game.level, soldier.mx, soldier.my).includes(aklys));
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
        publish: async () => {},
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
