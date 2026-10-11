import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { flushPendingTopline, flush_screen, plineWithContinuation } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { AMULET_OF_LIFE_SAVING, DAGGER, GOLD_PIECE, LEASH } from '../js/object_data.js';
import { pickupAtHero } from '../js/pickup.js';
import { unpaidObjectCost } from '../js/shk.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createStaffedShop } from './support/shop.js';
import { createDungeon } from './support/topology.js';
function screenText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
async function deathShop({ debug = false, bones = false, outside = false } = {}) {
    const level = freshObjectRoom({
        heroX: outside ? 20 : 10, right: 24,
        flags: { debug, bones, disclose: '-i -a -v -c -o', tombstone: false },
        hero: { uhp: 4, uhpmax: 12 },
    });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({
            dname: 'The Dungeons of Doom', num_dunlevs: 20, bonetag: 'D',
        })];
    const { shopkeeper } = await createStaffedShop({ keeperX: 11, keeperY: 10 });
    shopkeeper.eshk.shknam = '+SettlementControl';
    // Repossession uses the shop's entrance, not the keeper's current square.
    placeMonsterAt(shopkeeper, 14, 12);
    shopkeeper.eshk.debit = 37;
    const setupInput = resetInputState();
    installPagerInput(setupInput, { expected: /dagger|zorkmid|sale|pick/i, limit: 4 });
    const dagger = outside ? await addInventoryObject(DAGGER)
        : await floorObject(DAGGER, game.u.ux, game.u.uy);
    if (!outside)
        await pickupAtHero();
    await flushPendingTopline();
    assert.equal(dagger.where, 'inventory');
    if (!outside)
        assert.equal(dagger.unpaid, true);
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    return { state: game, level, shopkeeper, dagger };
}
void test('ordinary fatal damage settles shop debt before disclosure and retains live inventory identities', async () => {
    const { state, shopkeeper, dagger } = await deathShop();
    const inventory = state.inventory;
    const input = resetInputState();
    let sawSettlement = false;
    input.beforeRead = () => {
        const screen = screenText();
        if (!screen.includes('all your possessions'))
            return;
        sawSettlement = true;
        assert.match(screen, /SettlementControl comes and takes all your possessions/);
        assert.match(screen, /HP:0\(12\)/, 'The settlement message updates the fatal status');
        assert.equal(state.program_state.gameover, true);
        assert.equal(shopkeeper.eshk.debit, 0);
        assert.equal(shopkeeper.eshk.billct, 0);
        assert.equal(dagger.unpaid, false);
        assert.equal(state.inventory, inventory);
        assert.ok(state.inventory.includes(dagger));
        assert.equal(dagger.where, 'inventory');
    };
    installPagerInput(input, {
        expected: /rock|die|all your possessions|Goodbye|points|You were/i, limit: 10,
    });
    await flush_screen(1);
    await plineWithContinuation('A rock hits you.');
    const died = await loseHeroHp(5, 'a falling rock');
    assert.equal(died, true);
    assert.equal(sawSettlement, true, 'Generic fatal damage must reach shop settlement feedback');
    assert.equal(state.inventory, inventory);
    assert.equal(dagger.where, 'inventory', 'Without bones, finish_paybill does not move possessions');
});
for (const recovery of ['life saving', 'debug refusal']) {
    void test(`${recovery} after ordinary fatal damage leaves shop debt and purchases untouched`, async () => {
        const { state, shopkeeper, dagger } = await deathShop({ debug: recovery === 'debug refusal' });
        const debt = shopkeeper.eshk.debit;
        const billCount = shopkeeper.eshk.billct;
        const price = unpaidObjectCost(dagger);
        if (recovery === 'life saving') {
            const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        const input = resetInputState();
        installPagerInput(input, {
            expected: /rock|die|But wait|medallion|much better|don.t die/i, limit: 10,
        });
        const pager = input.display;
        assert.ok(pager);
        input.display = {
            async readKey() {
                if (screenText().includes('Die? [yn] (n)')) {
                    assert.equal(recovery, 'debug refusal');
                    return 'n'.charCodeAt(0);
                }
                return pager.readKey();
            },
        };
        await plineWithContinuation('A rock hits you.');
        const died = await loseHeroHp(5, 'a falling rock');
        assert.equal(died, false);
        assert.equal(state.program_state.gameover ?? false, false);
        assert.ok(state.u.uhp > 0);
        assert.equal(shopkeeper.eshk.debit, debt);
        assert.equal(shopkeeper.eshk.billct, billCount);
        assert.equal(dagger.unpaid, true);
        assert.equal(unpaidObjectCost(dagger), price);
        assert.ok(state.inventory.includes(dagger));
    });
}
void test('outside-shop death preserves possessions for disclosure and deposits them in the shop before bones', async () => {
    const { state, level, shopkeeper, dagger } = await deathShop({ debug: true, bones: true, outside: true });
    const pet = await createMonsterAt('little dog', 19, 10);
    initializePet(pet, { state });
    const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id });
    pet.mleashed = 1;
    const purse = setHeroGoldAmount(state, 31);
    assert.ok(purse);
    await addObjectToMonsterInventory(shopkeeper, await knownObject(GOLD_PIECE, { quan: 11 }), state);
    const keeperGoldBefore = (shopkeeper.minvent ?? []).filter(object => object.otyp === GOLD_PIECE)
        .reduce((sum, object) => sum + object.quan, 0);
    state.flags.disclose = '-a -v -c -o';
    const input = resetInputState();
    installPagerInput(input, {
        expected: /die|all your possessions|Goodbye|points|You were/i, limit: 10,
    });
    const pager = input.display;
    assert.ok(pager);
    let disclosed = false;
    input.display = {
        async readKey() {
            const screen = screenText();
            if (screen.includes('Die? [yn] (n)'))
                return 'y'.charCodeAt(0);
            if (screen.includes('see what you had when you died?')) {
                disclosed = true;
                assert.equal(dagger.where, 'inventory');
                assert.equal(leash.leashmon, pet.m_id);
                assert.equal(pet.mleashed, 1);
                return 'n'.charCodeAt(0);
            }
            if (screen.includes('Save bones?')) {
                assert.equal(disclosed, true);
                assert.equal(dagger.where, 'floor');
                assert.ok(floorObjectsAt(level, 12, 10).includes(dagger));
                assert.equal(leash.leashmon, 0);
                assert.equal(pet.mleashed, 0);
                assert.equal(heroGoldAmount(state), 0);
                return 'y'.charCodeAt(0);
            }
            return pager.readKey();
        },
    };
    const died = await loseHeroHp(10, 'a wand blast');
    assert.equal(died, true);
    assert.equal(disclosed, true);
    assert.equal(state._bonesSaved, true);
    assert.equal(state.inventory.length, 0);
    assert.ok(floorObjectsAt(level, 12, 10).includes(dagger));
    assert.ok(floorObjectsAt(level, 12, 10).includes(leash));
    assert.equal(floorObjectsAt(level, 20, 10).includes(dagger), false);
    const keeperGoldAfter = (shopkeeper.minvent ?? []).filter(object => object.otyp === GOLD_PIECE)
        .reduce((sum, object) => sum + object.quan, 0);
    assert.equal(keeperGoldAfter, keeperGoldBefore + 31);
});
//# sourceMappingURL=death_shop.test.js.map