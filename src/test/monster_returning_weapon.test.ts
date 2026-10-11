import test from 'node:test';
import assert from 'node:assert/strict';

import { findArmorClass } from '../js/armor.js';
import { NEED_WEAPON, NO_MINVENT, W_AMUL, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { monsterWieldedWeapon } from '../js/monster_weapon.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { setMonsterApparentHeroPosition } from '../js/monster_perception.js';
import { readyRangedMonsterWeapon, throwMonsterWeaponAtHero } from '../js/monster_throw.js';
import { AKLYS, AMULET_OF_LIFE_SAVING, DAGGER } from '../js/object_data.js';
import { rn2 } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

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
