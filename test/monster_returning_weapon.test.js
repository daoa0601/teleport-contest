import test from 'node:test';
import assert from 'node:assert/strict';

import { findArmorClass } from '../js/armor.js';
import { NEED_WEAPON, NO_MINVENT, W_AMUL, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
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
import { finishRangedAttacks } from './support/ranged-combat.js';

async function armedSoldier() {
    freshObjectRoom();
    findArmorClass();
    const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
    equipMonsterObject(soldier, knownObject(AKLYS, { spe: 3 }), W_WEP);
    setMonsterApparentHeroPosition(soldier, game, rn2);
    return soldier;
}

test('a monster chooses its tethered club before an expendable dagger', async () => {
    freshObjectRoom();
    const soldier = await createMonsterAt('soldier', 13, 10, NO_MINVENT);
    setMonsterApparentHeroPosition(soldier, game, rn2);
    const aklys = addObjectToMonsterInventory(soldier, knownObject(AKLYS));
    addObjectToMonsterInventory(soldier, knownObject(DAGGER));
    soldier.weaponCheck = NEED_WEAPON;
    const input = resetInputState();

    const wielding = readyRangedMonsterWeapon(soldier);
    await input.waitUntilBlocked();
    input.feed(' ');
    await wielding;

    assert.equal(soldier.mw?.o_id, aklys.o_id);
});

test('a monster catches its returning aklys and can use it again', async () => {
    const soldier = await armedSoldier();
    const aklys = soldier.mw;
    const attack = throwMonsterWeaponAtHero(soldier, game, aklys);
    assert.equal(soldier.mw, null, 'the weapon leaves the hand during its flight');

    await finishRangedAttacks([attack], game, {
        random: () => 1,
        publish: async () => {},
    });

    assert.equal(soldier.mw?.o_id, aklys.o_id);
    assert.ok(soldier.minvent.includes(aklys));
    assert.equal(aklys.owornmask & W_WEP, W_WEP);
    assert.equal(floorObjectsAt(game.level, game.u.ux, game.u.uy).includes(aklys), false);
});

test('a snapped tether leaves the aklys where its outward flight ended', async () => {
    const soldier = await armedSoldier();
    const aklys = soldier.mw;
    const messages = [];
    const attack = throwMonsterWeaponAtHero(soldier, game, aklys);

    await finishRangedAttacks([attack], game, {
        random: () => 0,
        publish: async message => messages.push(message),
    });

    assert.equal(soldier.mw, null);
    assert.equal(aklys.owornmask, 0);
    assert.ok(floorObjectsAt(game.level, game.u.ux, game.u.uy).includes(aklys));
    assert.ok(messages.includes('You hear a loud snap!'));
});

test('a confused monster can be hit by its own returning club', async () => {
    const soldier = await armedSoldier();
    soldier.mconf = true;
    const aklys = soldier.mw;
    const health = soldier.mhp;
    const attack = throwMonsterWeaponAtHero(soldier, game, aklys);

    await finishRangedAttacks([attack], game, {
        random: () => 1,
        publish: async () => {},
    });

    const damage = health - soldier.mhp;
    assert.ok(damage >= 2 && damage <= 4, `expected 2 to 4 damage, got ${damage}`);
    assert.equal(soldier.mw, null);
    assert.ok(floorObjectsAt(game.level, soldier.mx, soldier.my).includes(aklys));
});

test('life saving revives a monster killed by its returning club without catching it', async () => {
    const soldier = await armedSoldier();
    soldier.mconf = true;
    soldier.mhp = 1;
    const aklys = soldier.mw;
    equipMonsterObject(soldier, knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const attack = throwMonsterWeaponAtHero(soldier, game, aklys);
    const input = resetInputState();

    const returning = finishRangedAttacks([attack], game, {
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
