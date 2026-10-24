import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, STRAT_WAITFORU } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { initializePet } from '../js/dog.js';
import { pline } from '../js/display.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { saveBonesLevel } from '../js/mklev.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { migrateMonsterOffLevel } from '../js/monster_migration.js';
import { init_objects } from '../js/o_init.js';
import { AMULET_OF_YENDOR, LEASH } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { cansee } from '../js/vision.js';
import { wizMakeMap } from '../js/wizard_makemap.js';
import { runExtendedCommand } from './support/commands.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { startLuaCore } from './support/lua-game.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createStaffedShop } from './support/shop.js';
import { createDungeon } from './support/topology.js';

void test('#wizmakemap clears old sight before acknowledging the replacement level', async t => {
    const oldLevel = freshObjectRoom({
        hero: { uz: { dnum: 0, dlevel: 1 } },
        flags: { debug: true, bones: false },
    });
    await init_dungeons();
    await startLuaCore(t);
    const pet = await createMonsterAt('little dog', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(pet);
    assert.equal(cansee(12, 10), true);
    await pline('The dungeon shifts around you.');
    const input = resetInputState();
    const visibleAtAcknowledgement: boolean[] = [];
    input.beforeRead = () => { visibleAtAcknowledgement.push(cansee(12, 10)); };
    installPagerInput(input, { expected: /The dungeon shifts around you/, limit: 1 });

    await wizMakeMap();

    assert.ok(requireGameLevel() !== oldLevel);
    assert.equal(visibleAtAcknowledgement.length, 1);
    assert.equal(visibleAtAcknowledgement[0], false,
        'Acknowledging the replacement must not expose sight from the discarded level');
    assert.ok(requireGameLevel().monsters.includes(pet));
});

void test('#wizmakemap loading bones does not make a cached bones level familiar again', async () => {
    const storage = memoryStorage();
    for (const dlevel of [1, 2]) {
        freshObjectRoom({ hero: { uz: { dnum: 0, dlevel } }, flags: { debug: true } });
        game.storage = storage;
        game.plname = 'Ada';
        assert.ok(saveBonesLevel(), `Could not save bones on level ${dlevel}`);
    }
    freshConnectedLevels({ generateDestination: true });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    init_objects();
    game.storage = storage;
    game.plname = 'Ada';
    game.flags.debug = true;
    initRng(3n);
    pushKeys('yn');
    await gotoLevel({ dlevel: 2 });
    const cachedBones = requireGameLevel();
    assert.match(game._pending_message, /sense of deja vu|been here before|place .*familiar/);
    pushKeys(' ');
    await gotoLevel({ dlevel: 1 });

    await runExtendedCommand('wizmakemap', 'yn');
    await gotoLevel({ dlevel: 2 });

    assert.equal(requireGameLevel(), cachedBones, 'The hero must return to the visited bones level');
    assert.doesNotMatch(game._pending_message, /sense of deja vu|been here before|place .*familiar/,
        'Returning to a cached level must not repeat first-arrival familiarity');
});

void test('#wizmakemap returns an adjacent leashed pet after releasing its mundane restraints', async t => {
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
    assert.ok(Math.abs(pet.mx - game.u.ux) <= 1 && Math.abs(pet.my - game.u.uy) <= 1,
        `The pet must arrive beside the hero, got pet (${pet.mx},${pet.my}) and hero (${game.u.ux},${game.u.uy})`);
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

void test('#wizmakemap discards a distant pet and an adjacent untamed pursuer', async t => {
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

void test('#wizmakemap removes an off-level priest whose temple is being replaced', async t => {
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
    assert.equal(game._migratingMonsters?.includes(priest), false,
        'The priest must not retain a reference to the discarded temple');
    assert.equal(requireGameLevel().monsters.includes(priest), false);
});

void test('#wizmakemap leaves an Amulet-bearing pet behind and loosens its leash', async t => {
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
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };

    await runExtendedCommand('wizmakemap', '   ');

    assert.ok(messages.some(message => message.includes('seems very disoriented for a moment.')));
    assert.equal(leash.leashmon, 0);
    assert.equal(pet.mleashed, 0);
    assert.equal(pet.mhp, 0);
    assert.equal(requireGameLevel().monsters.includes(pet), false);
});

void test('#wizmakemap cannot bring a pet that has not noticed the hero', async t => {
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
