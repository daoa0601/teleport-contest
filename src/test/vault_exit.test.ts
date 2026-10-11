import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAVE, MM_NOGRP, NO_MINVENT, ROOM, ROOMOFFSET, VAULT } from '../js/const.js';
import { currency } from '../js/currency.js';
import { engravingAt } from '../js/engrave.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hiddenGold } from '../js/gold.js';
import { heroGoldAmount } from '../js/hero_gold.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { addObjectToContainer } from '../js/object_container.js';
import { DAGGER, GOLD_PIECE, LARGE_BOX, POT_HEALING } from '../js/object_data.js';
import { updateHeroRoomMembership } from '../js/room.js';
import { payVaultGuardOnExit } from '../js/vault_exit.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';

async function vaultExit({ peaceful = true, inVault = true } = {}) {
    const level = freshObjectRoom({ left: 2, right: 35, top: 2, bottom: 18 });
    requirePlayingGame(game);
    const state = game;
    state.u.uinvault = inVault ? 10 : 0;
    const vaultX = inVault ? 9 : 20;
    const vault = createRoom({ lx: vaultX, hx: vaultX + 1, ly: 9, hy: 10, rtype: VAULT });
    level.rooms.push(vault);
    level.nroom = 1;
    for (let x = vault.lx; x <= vault.hx; x++)
        for (let y = vault.ly; y <= vault.hy; y++) level.requireAt(x, y).roomno = ROOMOFFSET;
    updateHeroRoomMembership(state);
    const guard = await createMonsterAt('guard', 14, 10, NO_MINVENT | MM_NOGRP);
    guard.isgd = 1;
    guard.mpeaceful = peaceful;
    guard._egd = { gdlevel: { ...state.u.uz }, vault, gddone: 0,
        ogx: 14, ogy: 10, gdx: 16, gdy: 10, warncnt: 0, dropgoldcnt: 0,
        fcbeg: 0, fcend: 0, fakecorr: [] };
    const messages: string[] = [];
    const publish = async (message: string) => { messages.push(message); };
    return { state, level, vault, guard, messages, publish };
}

void test('vault exit moves the same gold stack to the hero square and removes the guard after game over', async () => {
    const { state, level, guard, messages, publish } = await vaultExit();
    const coins = await addInventoryObject(GOLD_PIECE, { quan: 137 });
    state.program_state.gameover = true;

    await payVaultGuardOnExit({ publish });

    assert.equal(heroGoldAmount(state), 0);
    assert.equal(state.inventory.includes(coins), false);
    assert.equal(floorObjectsAt(level, state.u.ux, state.u.uy).includes(coins), true);
    assert.equal(coins.quan, 137);
    assert.equal(coins.where, 'floor');
    assert.equal(level.monsters.includes(guard), false);
    assert.equal(guard.dead, true);
    assert.deepEqual(messages, ['Your 137 zorkmids goes into the Magic Memory Vault.']);
});

void test('recovered vault coins merge with an existing floor pile without losing value', async () => {
    const { state, level, publish } = await vaultExit();
    await floorObject(GOLD_PIECE, state.u.ux, state.u.uy, { quan: 23 });
    const coins = await addInventoryObject(GOLD_PIECE, { quan: 71 });
    state.program_state.gameover = true;

    await payVaultGuardOnExit({ publish });

    const pile = floorObjectsAt(level, state.u.ux, state.u.uy)
        .filter(object => object.otyp === GOLD_PIECE);
    assert.equal(pile.length, 1);
    assert.equal(pile[0], coins);
    assert.equal(coins.quan, 94);
    assert.equal(heroGoldAmount(state), 0);
});

void test('vault settlement leaves contained gold and ordinary inventory with the hero', async () => {
    const { state, publish } = await vaultExit();
    await addInventoryObject(GOLD_PIECE, { quan: 11 });
    const box = await addInventoryObject(LARGE_BOX);
    const hidden = await knownObject(GOLD_PIECE, { quan: 73 });
    await addObjectToContainer(box, hidden);
    const dagger = await addInventoryObject(DAGGER);
    state.program_state.gameover = true;

    await payVaultGuardOnExit({ publish });

    assert.equal(heroGoldAmount(state), 0);
    assert.equal(hiddenGold(state), 73);
    assert.equal(hidden.container, box);
    assert.equal(hidden.where, 'contained');
    assert.equal(state.inventory.includes(box), true);
    assert.equal(state.inventory.includes(dagger), true);
});

void test('a peaceful guard outside the vault departs without claiming the hero gold', async () => {
    const { state, level, guard, messages, publish } = await vaultExit({ inVault: false });
    const coins = await addInventoryObject(GOLD_PIECE, { quan: 137 });
    state.program_state.gameover = true;

    await payVaultGuardOnExit({ publish });

    assert.equal(heroGoldAmount(state), 137);
    assert.equal(coins.where, 'inventory');
    assert.equal(level.monsters.includes(guard), false);
    assert.equal(guard.dead, true);
    assert.equal(messages.length, 0);
});

void test('an angry guard remits gold to the vault and leaves a memorial in the original female role', async () => {
    const { state, level, vault, guard, messages, publish } = await vaultExit({ peaceful: false, inVault: false });
    const coins = await addInventoryObject(GOLD_PIECE, { quan: 137 });
    state.plname = 'Ada';
    state.flags.female = true;
    installPolymorphedHero('red dragon');
    state.program_state.gameover = true;

    await payVaultGuardOnExit({ publish, random: () => 0 });

    assert.equal(heroGoldAmount(state), 0);
    assert.equal(floorObjectsAt(level, vault.lx, vault.ly).includes(coins), true);
    assert.equal(level.requireAt(vault.lx, vault.ly).typ, GRAVE);
    assert.equal(engravingAt(vault.lx, vault.ly)?.text,
        "To Croesus: here's the gold recovered from Ada the cavewoman.");
    assert.ok(Math.abs(guard.mx - state.u.ux) <= 1 && Math.abs(guard.my - state.u.uy) <= 1);
    assert.equal(level.monsters.includes(guard), false);
    assert.deepEqual(messages, ['The guard remits your gold to the vault.']);
});

for (const inVault of [false, true]) {
    void test(`silent settlement ${inVault ? 'inside' : 'outside'} the vault still transfers gold and removes the guard`, async () => {
        const { state, level, vault, guard, messages, publish } = await vaultExit({ peaceful: false, inVault });
        const coins = await addInventoryObject(GOLD_PIECE, { quan: 29 });
        state.program_state.gameover = true;

        await payVaultGuardOnExit({ silent: true, publish, random: () => 0 });

        assert.equal(heroGoldAmount(state), 0);
        assert.equal(coins.where, 'floor');
        assert.equal(coins.ox, inVault ? state.u.ux : vault.lx);
        assert.equal(coins.oy, inVault ? state.u.uy : vault.ly);
        assert.equal(level.monsters.includes(guard), false);
        assert.equal(messages.length, 0);
    });
}

void test('an empty open purse leaves the guard and contained gold untouched', async () => {
    const { state, level, guard, publish } = await vaultExit();
    const box = await addInventoryObject(LARGE_BOX);
    await addObjectToContainer(box, await knownObject(GOLD_PIECE, { quan: 73 }));
    state.program_state.gameover = true;

    await payVaultGuardOnExit({ publish });

    assert.equal(level.monsters.includes(guard), true);
    assert.ok(guard.mhp > 0);
    assert.equal(hiddenGold(state), 73);
});

void test('an unfinished parked guard is found even when no gold payment is possible', async () => {
    const { state, level, guard, publish } = await vaultExit();
    guard.mx = guard.my = 0;
    guard.mhp = 0;
    state.program_state.gameover = true;

    await payVaultGuardOnExit({ publish });

    assert.equal(guard.mhp, guard.mhpmax);
    assert.equal(level.monsters.includes(guard), true);
});

void test('a guard tied to another dungeon level cannot collect this purse', async () => {
    const { state, level, guard, publish } = await vaultExit();
    await addInventoryObject(GOLD_PIECE, { quan: 31 });
    assert.ok(guard._egd);
    guard._egd.gdlevel.dlevel++;
    state.program_state.gameover = true;

    await payVaultGuardOnExit({ publish });

    assert.equal(heroGoldAmount(state), 31);
    assert.equal(level.monsters.includes(guard), true);
});

void test('guard departure discards its cargo without mistaking that gold for the hero purse', async () => {
    const { state, level, guard, publish } = await vaultExit();
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 31 });
    const guardGold = await knownObject(GOLD_PIECE, { quan: 500 });
    const potion = await knownObject(POT_HEALING);
    await addObjectToMonsterInventory(guard, guardGold);
    await addObjectToMonsterInventory(guard, potion);
    state.program_state.gameover = true;

    await payVaultGuardOnExit({ publish });

    assert.equal(purse.where, 'floor');
    assert.equal(purse.quan, 31);
    assert.equal(guardGold.where, 'gone');
    assert.equal(potion.where, 'gone');
    assert.equal(level.monsters.includes(guard), false);
});

void test('the vault payment message uses a hallucinated currency', async () => {
    const { state, messages, publish } = await vaultExit();
    await addInventoryObject(GOLD_PIECE, { quan: 2 });
    await makeHallucinated(20, { state, talk: false, publish });
    state.program_state.gameover = true;

    await payVaultGuardOnExit({ publish, random: () => 0 });

    assert.ok(messages.includes('Your 2 Altarian Dollars goes into the Magic Memory Vault.'));
    assert.equal(heroGoldAmount(state), 0);
});

void test('currency has native singular and plural forms for ordinary and hallucinated amounts', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    assert.equal(currency(1), 'zorkmid');
    assert.equal(currency(0), 'zorkmids');
    await makeHallucinated(20, { state: game, talk: false, publish: async () => {} });

    assert.equal(currency(1, { random: () => 1 }), 'Ankh-Morpork Dollar');
    assert.equal(currency(3, { random: () => 1 }), 'Ankh-Morpork Dollars');
});

void test('a vault payment does not turn the hero square into a grave', async () => {
    const { state, level, publish } = await vaultExit();
    await addInventoryObject(GOLD_PIECE, { quan: 1 });
    state.program_state.gameover = true;

    await payVaultGuardOnExit({ publish });

    assert.equal(level.requireAt(state.u.ux, state.u.uy).typ, ROOM);
});
