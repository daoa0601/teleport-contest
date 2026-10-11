import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { D_CLOSED, DOOR, MM_ANGRY, NO_MINVENT, STONE, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterWieldedWeapon } from '../js/monster_weapon.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { BOULDER, LONG_SWORD, PICK_AXE, ROCK } from '../js/object_data.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const occupied of [false, true]) {
    void test(`a close dwarf readies a pick before ${occupied ? 'attacking at' : 'entering'} a closed door`, async () => {
        const level = freshObjectRoom({ left: 10, right: 14, top: 10, bottom: 10,
            heroX: 12, heroY: 10 });
        requirePlayingGame(game);
        const dwarf = await createMonsterAt('dwarf', 10, 10, MM_ANGRY | NO_MINVENT);
        await equipMonsterObject(dwarf, await knownObject(LONG_SWORD), W_WEP);
        const pick = await addObjectToMonsterInventory(dwarf, await knownObject(PICK_AXE));
        const defender = occupied
            ? await createMonsterAt('kobold', 11, 10, MM_ANGRY | NO_MINVENT) : null;
        const health = defender?.mhp;
        if (occupied) dwarf.mconf = 1;
        const location = level.requireAt(11, 10);
        location.typ = DOOR;
        location.doormask = D_CLOSED;
        pushKeys(' '.repeat(100));

        await takeMonsterTurn(dwarf, game);

        assert.equal(monsterWieldedWeapon(dwarf), pick);
        assert.deepEqual([dwarf.mx, dwarf.my], [10, 10]);
        assert.equal(level.requireAt(11, 10).doormask, D_CLOSED);
        if (defender) assert.equal(defender.mhp, health);
    });
}

void test('a fleeing monster cannot leave a sticky hero holding it', async () => {
    freshObjectRoom({ left: 9, right: 15, top: 10, bottom: 10,
        heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    installPolymorphedHero('large mimic', { hitPoints: 200 });
    const kobold = await createMonsterAt('kobold', 11, 10, MM_ANGRY | NO_MINVENT);
    kobold.mflee = 1;
    kobold.mfleetim = 20;
    game.u.ustuck = kobold;
    pushKeys(' '.repeat(100));

    await takeMonsterTurn(kobold, game);

    assert.deepEqual([kobold.mx, kobold.my], [11, 10]);
    assert.equal(game.u.ustuck, kobold);
});

void test('being held by a sticky hero does not prevent attacking that hero', async () => {
    const level = freshObjectRoom({ left: 9, right: 15, top: 10, bottom: 10,
        heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    installPolymorphedHero('large mimic', { hitPoints: 200 });
    game.u.uac = 100;
    const kobold = await createMonsterAt('kobold', 11, 10, MM_ANGRY | NO_MINVENT);
    kobold.mconf = 1;
    level.requireAt(12, 10).typ = STONE;
    game.u.ustuck = kobold;
    pushKeys(' '.repeat(100));

    await takeMonsterTurn(kobold, game);

    assert.ok(game.u.mh < 200);
    assert.deepEqual([kobold.mx, kobold.my], [11, 10]);
});


void test('a Rider breaks a blocking boulder without entering its square', async () => {
    const level = freshObjectRoom({ left: 9, right: 16, top: 10, bottom: 10,
        heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    const rider = await createMonsterAt('Famine', 13, 10, MM_ANGRY | NO_MINVENT);
    await placeCreatedObject(await knownObject(BOULDER), 12, 10);
    pushKeys(' '.repeat(100));

    await takeMonsterTurn(rider, game);

    assert.deepEqual([rider.mx, rider.my], [13, 10]);
    assert.equal(floorObjectsAt(level, 12, 10).some(object => object.otyp === BOULDER), false);
    assert.ok(floorObjectsAt(level, 12, 10).some(object => object.otyp === ROCK));
});


void test('a rock-throwing giant can step onto a boulder without fracturing it', async () => {
    freshObjectRoom({ left: 9, right: 16, top: 10, bottom: 10,
        heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    const giant = await createMonsterAt('hill giant', 13, 10, MM_ANGRY | NO_MINVENT);
    const boulder = await knownObject(BOULDER);
    await placeCreatedObject(boulder, 12, 10);
    pushKeys(' '.repeat(100));

    await takeMonsterTurn(giant, game);

    assert.deepEqual([giant.mx, giant.my], [12, 10]);
    assert.equal(boulder.otyp, BOULDER);
});
