import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, STRAT_WAITFORU } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { migrateMonsterOffLevel } from '../js/monster_migration.js';
import { AMULET_OF_YENDOR, LEASH } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { startLuaCore } from './support/lua-game.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
void test('#wizmakemap returns an adjacent leashed pet after releasing its mundane restraints', async (t) => {
    const oldLevel = freshObjectRoom({
        hero: { uz: { dnum: 0, dlevel: 1 } },
        flags: { debug: true, bones: false },
    });
    await init_dungeons();
    await startLuaCore(t);
    // This flag skips keepdogs(FALSE) on level travel, but not pets-only calls.
    game.iflags.nofollowers = true;
    const pet = await createMonsterAt('little dog', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(pet);
    pet.mtrapped = 1;
    pet.meating = 5;
    pet.msleeping = 1;
    pet.mfrozen = 8;
    pet.mcanmove = 0;
    pet.mleashed = 1;
    const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id });
    const moves = game.moves;
    await runExtendedCommand('wizmakemap');
    const level = requireGameLevel();
    assert.ok(level !== oldLevel, 'The command must replace the dungeon level');
    assert.ok(level.monsters.includes(pet), 'The same pet must arrive on the replacement level');
    assert.ok(Math.abs(pet.mx - game.u.ux) <= 1 && Math.abs(pet.my - game.u.uy) <= 1, `The pet must arrive beside the hero, got pet (${pet.mx},${pet.my}) and hero (${game.u.ux},${game.u.uy})`);
    assert.equal(pet.mtrapped, 0);
    assert.equal(pet.meating, 0);
    assert.equal(pet.msleeping, 0);
    assert.equal(pet.mfrozen, 0);
    assert.equal(pet.mcanmove, 1);
    assert.equal(pet.mleashed, 1);
    assert.equal(leash.leashmon, pet.m_id);
    assert.equal(game.moves, moves);
    assert.equal(game.context.move, 0);
});
void test('#wizmakemap discards a distant pet and an adjacent untamed pursuer', async (t) => {
    freshObjectRoom({
        hero: { uz: { dnum: 0, dlevel: 1 } },
        flags: { debug: true, bones: false },
    });
    await init_dungeons();
    await startLuaCore(t);
    const distant = await createMonsterAt('kitten', 15, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(distant);
    const pursuer = await createMonsterAt('watchman', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    pursuer.msleeping = 0;
    const { shopkeeper } = await createStaffedShop({ left: 11, right: 16, top: 11, bottom: 14,
        keeperX: 11, keeperY: 11 });
    shopkeeper.eshk.following = 1;
    const guard = await createMonsterAt('guard', 9, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    guard.isgd = 1;
    await runExtendedCommand('wizmakemap');
    const level = requireGameLevel();
    assert.equal(level.monsters.includes(distant), false);
    assert.equal(level.monsters.includes(pursuer), false);
    assert.equal(distant.mhp, 0, 'The distant pet belongs to the discarded level');
    assert.equal(pursuer.mhp, 0, 'An untamed pursuer must not be carried to the new level');
    assert.equal(shopkeeper.mhp, 0, 'A pursuing shopkeeper must not be kept as a pet');
    assert.equal(guard.mhp, 0, 'A vault guard must not survive its discarded vault');
});
void test('#wizmakemap removes an off-level priest whose temple is being replaced', async (t) => {
    freshObjectRoom({
        hero: { uz: { dnum: 0, dlevel: 1 } },
        flags: { debug: true, bones: false },
    });
    await init_dungeons();
    await startLuaCore(t);
    const priest = await createMonsterAt('aligned cleric', 15, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    priest.ispriest = 1;
    priest.epri = {
        parentmid: priest.m_id, shroom: 0, shralign: 0,
        shrpos: { x: 15, y: 10 }, shrlevel: { dnum: 0, dlevel: 1 },
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    await migrateMonsterOffLevel(priest, game, { dst: { dnum: 0, dlevel: 2 } });
    await runExtendedCommand('wizmakemap');
    assert.equal(priest.mhp, 0);
    assert.equal(game._migratingMonsters?.includes(priest), false, 'The priest must not retain a reference to the discarded temple');
    assert.equal(requireGameLevel().monsters.includes(priest), false);
});
void test('#wizmakemap leaves an Amulet-bearing pet behind and loosens its leash', async (t) => {
    freshObjectRoom({
        hero: { uz: { dnum: 0, dlevel: 1 } },
        flags: { debug: true, bones: false },
    });
    await init_dungeons();
    await startLuaCore(t);
    const pet = await createMonsterAt('little dog', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(pet);
    pet.mleashed = 1;
    const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id });
    await addObjectToMonsterInventory(pet, await knownObject(AMULET_OF_YENDOR));
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    await runExtendedCommand('wizmakemap', '   ');
    assert.ok(messages.some(message => message.includes('seems very disoriented for a moment.')));
    assert.equal(leash.leashmon, 0);
    assert.equal(pet.mleashed, 0);
    assert.equal(pet.mhp, 0);
    assert.equal(requireGameLevel().monsters.includes(pet), false);
});
void test('#wizmakemap cannot bring a pet that has not noticed the hero', async (t) => {
    freshObjectRoom({
        hero: { uz: { dnum: 0, dlevel: 1 } },
        flags: { debug: true, bones: false },
    });
    await init_dungeons();
    await startLuaCore(t);
    const pet = await createMonsterAt('kitten', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(pet);
    pet.mstrategy = STRAT_WAITFORU;
    await runExtendedCommand('wizmakemap');
    assert.equal(pet.mhp, 0);
    assert.equal(requireGameLevel().monsters.includes(pet), false);
});
//# sourceMappingURL=wizard_makemap.test.js.map