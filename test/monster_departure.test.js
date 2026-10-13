import test from 'node:test';
import assert from 'node:assert/strict';
import { AMULET_OF_YENDOR, BOULDER, CORPSE, DAGGER, ORCISH_DAGGER, POT_HEALING, } from '../js/object_data.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MM_NOGRP, NO_MINVENT, PIT, TT_PIT, W_WEP } from '../js/const.js';
import { artifactObject, floorObject } from './support/game-objects.js';
import { mksobj, set_corpsenm } from '../js/mklev.js';
import { removeMonsterFromGame, removeWishGrantingMonster } from '../js/monster_departure.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { deleteObject } from '../js/object_delete.js';
import { pickupAtHero } from '../js/pickup.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { addShopDamage } from '../js/shop_damage.js';
import { addShopObjectToBill } from '../js/shk.js';
import { itemizedShopBill } from '../js/shop_payment.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { freshGame } from './support/game-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { installPagerInput } from './support/pager-input.js';
import { memoryStorage } from './support/memory-storage.js';
void test('removing a keeper after game over clears its room ownership and outstanding bill', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper, room, roomno } = await createStaffedShop({ keeperX: 12 });
    const purchase = await floorObject(POT_HEALING, 10, 10);
    const used = await floorObject(POT_HEALING, 11, 10);
    installPagerInput(resetInputState(), {
        expected: /potion|zorkmid|unpaid/,
        limit: 4,
    });
    await pickupAtHero();
    await addShopObjectToBill(used, game, { ininv: false, silent: true });
    await deleteObject(used);
    const owned = await floorObject(DAGGER, 13, 10, { no_charge: true });
    addShopDamage(13, 10, 20);
    assert.equal(game.inventory.includes(purchase), true);
    assert.equal(purchase.unpaid, true);
    assert.equal(itemizedShopBill(shopkeeper).length, 2);
    assert.ok(game.u.ushops.includes(roomno));
    game.program_state.gameover = true;
    const result = await removeMonsterFromGame(shopkeeper);
    assert.equal(result.removed, true);
    assert.equal(shopkeeper.dead, true);
    assert.equal(level.monsters.includes(shopkeeper), false);
    assert.equal(room.resident, null);
    assert.equal(purchase.unpaid, false);
    assert.equal(used.where, 'gone');
    assert.equal(owned.no_charge, false);
    assert.equal(itemizedShopBill(shopkeeper).length, 0);
    assert.equal(level.damagelist?.length, 0);
    assert.equal(game.u.ushops.includes(roomno), false);
});
void test('a fatal settling boulder during removal interrupts cleanup of an initially live game', async () => {
    const level = freshObjectRoom({ hero: { uhp: 1, uhpmax: 1 },
        flags: { disclose: '-i -a -v -c -o' } });
    requirePlayingGame(game);
    game.storage = memoryStorage();
    const worm = await createMonsterAt('purple worm', 11, 10, NO_MINVENT | MM_NOGRP);
    addTrap(level, PIT, 11, 10, { tseen: true });
    await floorObject(BOULDER, 11, 10);
    game.u.ustuck = worm;
    game.u.uswallow = true;
    game.u.utrap = 3;
    game.u.utraptype = TT_PIT;
    installPagerInput(resetInputState(), {
        expected: /boulder|pit|squished|You die|Goodbye|points|experience|REST|PEACE/i,
        limit: 20,
    });
    const result = await removeMonsterFromGame(worm);
    assert.equal(result.removed, true);
    assert.equal(game.program_state.gameover, true);
    assert.equal(level.monsters.includes(worm), false);
    assert.equal(!!worm.dead, false, 'Fatal removal must stop before completing the actor cleanup');
    assert.equal(game.u.ustuck, null);
    assert.equal(!!game.u.uswallow, false);
});
void test('wish departure leaves protected identities and removes ordinary cargo', async () => {
    freshGame({ role: 'samurai' });
    requirePlayingGame(game);
    initRng(3n);
    const monster = await createMonsterAt(315, 11, 10);
    game.u.ustuck = monster;
    game.u.uswallow = true;
    const invocation = await mksobj(AMULET_OF_YENDOR, true, false);
    const quest = await artifactObject('The Tsurugi of Muramasa');
    const foreignQuest = await artifactObject('The Orb of Detection');
    const ordinary = await mksobj(ORCISH_DAGGER, true, false);
    await addObjectToMonsterInventory(monster, invocation, game);
    await equipMonsterObject(monster, quest, W_WEP);
    await addObjectToMonsterInventory(monster, foreignQuest, game);
    await addObjectToMonsterInventory(monster, ordinary, game);
    await removeWishGrantingMonster(monster);
    assert.ok(floorObjectsAt(game.level, 11, 10).includes(invocation));
    assert.ok(floorObjectsAt(game.level, 11, 10).includes(quest));
    assert.equal(invocation.where, 'floor');
    assert.equal(quest.where, 'floor');
    assert.equal(quest.worn, false);
    assert.equal(quest.owornmask, 0);
    assert.equal(ordinary.where, 'gone');
    assert.equal(foreignQuest.where, 'gone');
    assert.equal(floorObjectsAt(game.level, 11, 10).includes(foreignQuest), false);
    assert.equal(monster.dead, true);
    assert.deepEqual(monster.minvent, []);
    assert.equal(game.level.monsters.includes(monster), false);
    assert.equal(game.u.ustuck, null);
    assert.equal(!!game.u.uswallow, false);
});
void test('Rider corpses survive departure as floor identities', async () => {
    freshGame();
    requirePlayingGame(game);
    initRng(3n);
    const monster = await createMonsterAt(289, 12, 9);
    game.u.ustuck = monster;
    game.u.uswallow = true;
    const rider = await mksobj(CORPSE, true, false);
    set_corpsenm(rider, 311);
    await addObjectToMonsterInventory(monster, rider, game);
    await removeWishGrantingMonster(monster);
    assert.equal(floorObjectsAt(game.level, 12, 9)[0], rider);
    assert.equal(rider.where, 'floor');
    assert.equal(game.level.monsters.includes(monster), false);
});
//# sourceMappingURL=monster_departure.test.js.map