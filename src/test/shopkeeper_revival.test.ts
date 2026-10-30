import test from 'node:test';
import assert from 'node:assert/strict';
import { reviveCorpseForHero } from '../js/corpse_revival.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { resetInputState } from '../js/input.js';
import { createCorpstatAt } from '../js/mklev.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import type { GameObject } from '../js/object_types.js';
import { unlinkObject } from '../js/object_location.js';
import { CORPSE, DAGGER, STATUE } from '../js/object_data.js';
import { addShopObjectToBill, checkSpecialRoom, objectOwnershipPrefix, shopResident } from '../js/shk.js';
import { animateStatue } from '../js/statue_trap.js';
import { addInventoryItem } from '../js/u_init.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createRoomLevel } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';

for (const petrified of [false, true]) {
    void test(`a shopkeeper restored from ${petrified ? 'a statue' : 'a corpse'} owns stock and bills purchases again`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const { shopkeeper, roomno } = await createStaffedShop({ keeperX: 12, keeperY: 10 });
        shopkeeper.eshk.shknam = 'Anja';
        const cargo = await floorObject(DAGGER, 13, 10);
        installPagerInput(resetInputState(), {
            expected: /murderer|thunder|glows iridescently|comes to life|Welcome|Anja/,
            limit: 10,
        });
        let remains: GameObject;
        if (petrified) {
            remains = await createCorpstatAt(STATUE, shopkeeper, null, 12, 10, 0);
            await finishEnvironmentalMonsterDeath(shopkeeper, game, { noCorpse: true });
        } else {
            await finishHeroMonsterKill(shopkeeper, 12, 10, { showKillMessage: false, recordConduct: false });
            const corpse = floorObjectsAt(requireGameLevel(game), 12, 10).find(object => object.otyp === CORPSE);
            assert.ok(corpse, 'A shopkeeper leaves a corpse with saved traits');
            remains = corpse;
        }
        assert.equal(shopResident(roomno), null);

        const result = petrified
            ? await animateStatue(remains, 12, 10, { magic: true })
            : await reviveCorpseForHero(remains);
        assert.ok(result.monster);

        assert.equal(objectOwnershipPrefix(cargo), "Anja's ");
        assert.equal(shopResident(roomno), result.monster);
        await checkSpecialRoom();
        const transaction = await addShopObjectToBill(cargo, game, { silent: true });
        assert.ok(transaction, 'The restored shopkeeper must charge for stock');
        assert.equal(cargo.unpaid, true);
    });
}

void test('a carried shopkeeper corpse can revive on a level with no shop', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 12, keeperY: 10 });
    await finishEnvironmentalMonsterDeath(shopkeeper, game);
    const corpse = floorObjectsAt(requireGameLevel(game), 12, 10).find(object => object.otyp === CORPSE);
    assert.ok(corpse);
    unlinkObject(corpse);
    game.level = createRoomLevel({ left: 7, right: 16, top: 6, bottom: 14 });
    game.u.uz = { dnum: 0, dlevel: 9 };
    vision_reset_new_level();
    vision_recalc(0);
    await addInventoryItem(corpse);
    installPagerInput(resetInputState(), { expected: /glows iridescently/, limit: 2 });

    const result = await reviveCorpseForHero(corpse);

    assert.ok(result.monster);
    assert.equal(result.monster.isshk, true);
    assert.equal(result.monster.mhp, result.monster.mhpmax);
    assert.equal(corpse.where, 'gone');
});
