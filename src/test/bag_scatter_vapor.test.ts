import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { BAG_OF_HOLDING, POT_FULL_HEALING, POT_OIL, POT_SEE_INVISIBLE, WAN_CANCELLATION } from '../js/object_data.js';
import { beginObjectBurn } from '../js/light.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a scattered see invisible potion wakes a peaceful monster without angering it', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const soldier = await createMonsterAt('soldier', 7, 7);
    soldier.mhp = 10;
    soldier.mhpmax = 100;
    soldier.msleeping = 1;
    soldier.mpeaceful = 1;
    const bag = await addInventoryObject(BAG_OF_HOLDING, {
        invlet: 'a', initialize: false, cknown: true,
    });
    const potion = await knownObject(POT_SEE_INVISIBLE, {
        initialize: false, where: 'contained', container: bag,
    });
    bag.contents = [potion];
    await addInventoryObject(WAN_CANCELLATION, {
        invlet: 'b', initialize: false, spe: 1,
    });
    initRng(369n);

    await applyInventoryObject(bag, 'sb\n' + ' '.repeat(30));

    assert.equal(bag.where, 'gone');
    assert.equal(potion.where, 'gone');
    assert.ok(soldier.mhp === 10 || soldier.mhp === 9,
        `The bottle deals at most one point of impact damage; the soldier has ${soldier.mhp} HP.`);
    assert.equal(soldier.msleeping, 0);
    assert.equal(soldier.mpeaceful, 1, 'A propelled potion does not count as a hero attack.');
});

void test('burning oil scattered by a bag explosion still angers monsters during the hero turn', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const soldier = await createMonsterAt('soldier', 7, 7);
    soldier.mhp = soldier.mhpmax = 100;
    soldier.mpeaceful = 1;
    const bag = await addInventoryObject(BAG_OF_HOLDING, {
        invlet: 'a', initialize: false, cknown: true,
    });
    const potion = await knownObject(POT_OIL, {
        initialize: false, where: 'contained', container: bag,
    });
    bag.contents = [potion];
    beginObjectBurn(potion);
    await addInventoryObject(WAN_CANCELLATION, {
        invlet: 'b', initialize: false, spe: 1,
    });
    initRng(369n);

    await applyInventoryObject(bag, 'sb\n' + ' '.repeat(30));

    assert.equal(potion.where, 'gone');
    assert.equal(potion.lamplit, false);
    assert.ok(soldier.mhp < 99, `The burning oil blast damages the soldier, who has ${soldier.mhp} HP.`);
    assert.equal(soldier.mpeaceful, 0, 'The oil explosion counts as a hero attack.');
});

for (const { name, x, y, seed } of [
    { name: 'distant potion vapors cannot cure the hero', x: 7, y: 7, seed: 369n },
    { name: 'the hero can avoid nearby potion vapors', x: 11, y: 11, seed: 266n },
]) {
    void test(`an exploding bag scatters a healing potion: ${name}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, blindTurns: 30 } });
        const soldier = await createMonsterAt('soldier', x, y);
        soldier.mhp = 10;
        soldier.mhpmax = 100;
        const bag = await addInventoryObject(BAG_OF_HOLDING, {
            invlet: 'a', initialize: false, cknown: true,
        });
        const potion = await knownObject(POT_FULL_HEALING, {
            initialize: false, where: 'contained', container: bag,
        });
        bag.contents = [potion];
        await addInventoryObject(WAN_CANCELLATION, {
            invlet: 'b', initialize: false, spe: 1,
        });
        initRng(seed);

        await applyInventoryObject(bag, 'sb\n' + ' '.repeat(30));

        assert.equal(bag.where, 'gone');
        assert.equal(soldier.mhp, soldier.mhpmax, 'The scattered potion heals the monster it hits.');
        assert.equal(game.u.blindTurns, 30, 'The hero does not receive the healing vapor.');
    });
}
