import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { NO_MINVENT } from '../js/const.js';
import { GameDisplay } from '../js/game_display.js';
import { game, requirePlayingGame, resetGame } from '../js/gstate.js';
import { dropInventoryObjectAtHero } from '../js/hero_drop.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { migrateMonsterOffLevel } from '../js/monster_migration.js';
import { OIL_LAMP } from '../js/object_data.js';
import { createHarmlessGasCloudSelection, runLevelRegions } from '../js/regions.js';
import { restoreGame, saveGame } from '../js/save.js';
import { cansee, couldsee, vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';

for (const lightSource of ['yellow light', 'carried lamp']) {
    void test(`waiting reveals floor illuminated by a moving ${lightSource}`, async () => {
        freshTurnRoom({ left: 8, right: 20, top: 10, bottom: 10 });
        requirePlayingGame(game);
        for (let x = 8; x <= 20; x++) {
            const location = game.level.requireAt(x, 10);
            location.lit = false;
            location.waslit = false;
            location.seenv = 0;
        }
        const source = await createMonsterAt(
            lightSource === 'yellow light' ? 'yellow light' : 'goblin',
            17, 10, NO_MINVENT,
        );
        source.mpeaceful = false;
        source.msleeping = 0;
        source.movement = 12;
        if (lightSource === 'carried lamp') {
            const lamp = await knownObject(OIL_LAMP, { age: 1000 });
            await addObjectToMonsterInventory(source, lamp);
            assert.equal(beginObjectBurn(lamp), true);
        }
        const floorX = lightSource === 'yellow light' ? 15 : 13;
        vision_reset_new_level();
        vision_recalc(0);
        assert.equal(cansee(floorX, 10), false);
        assert.equal(game.level.requireAt(floorX, 10).disp_ch, ' ');
        pushKeys('.\x1b');

        await moveloop_core();
        await moveloop_core();

        assert.ok(source.mx < 17, 'the light source must approach along the room');
        assert.equal(cansee(floorX, 10), true);
        assert.equal(game.level.requireAt(floorX, 10).disp_ch, '.');
    });
}

for (const lightSource of ['yellow light', 'carried lamp']) {
    void test(`waiting clears the light after the last ${lightSource} migrates`, async () => {
        freshTurnRoom({ left: 8, right: 20, top: 10, bottom: 10 });
        requirePlayingGame(game);
        for (let x = 8; x <= 20; x++) {
            const location = game.level.requireAt(x, 10);
            location.lit = false;
            location.waslit = false;
            location.seenv = 0;
        }
        const source = await createMonsterAt(
            lightSource === 'yellow light' ? 'yellow light' : 'goblin',
            17, 10, NO_MINVENT,
        );
        if (lightSource === 'carried lamp') {
            const lamp = await knownObject(OIL_LAMP, { age: 1000 });
            await addObjectToMonsterInventory(source, lamp);
            assert.equal(beginObjectBurn(lamp), true);
        }
        vision_reset_new_level();
        vision_recalc(0);
        assert.equal(cansee(17, 10), true);
        await migrateMonsterOffLevel(source, game, {
            dst: { dnum: 0, dlevel: 2 },
        });
        pushKeys('.\x1b');

        await moveloop_core();
        await moveloop_core();

        assert.equal(cansee(17, 10), false, 'a migrating source cannot illuminate its old square');
        assert.equal(couldsee(17, 10), true, 'migration does not block the line of sight');
    });
}

void test('waiting clears the light after the last lamp falls down a ladder', async () => {
    const { source } = freshConnectedLevels({ ladder: true });
    game._moveloopStarted = true;
    for (let x = 8; x <= 18; x++) {
        for (let y = 8; y <= 12; y++) {
            const location = source.requireAt(x, y);
            location.lit = false;
            location.waslit = false;
            location.seenv = 0;
        }
    }
    const lamp = await addInventoryObject(OIL_LAMP, { age: 1000 });
    assert.equal(beginObjectBurn(lamp), true);
    vision_reset_new_level();
    vision_recalc(0);
    assert.equal(cansee(13, 10), true);
    await dropInventoryObjectAtHero(lamp);
    assert.equal(lamp.where, 'migrating');
    pushKeys('.\x1b');

    await moveloop_core();
    await moveloop_core();

    assert.equal(cansee(13, 10), false, 'a migrating lamp cannot illuminate the departed level');
    assert.equal(couldsee(13, 10), true, 'the ladder does not block the line of sight');
});

void test('expired gas clears the view beyond it while overlapping gas still blocks', async () => {
    freshObjectRoom({ left: 8, right: 18, top: 10, bottom: 10 });
    requirePlayingGame(game);
    const cells = [{ x: 12, y: 10 }];
    const first = createHarmlessGasCloudSelection(game, cells, { ttl: 0 });
    const second = createHarmlessGasCloudSelection(game, cells, { ttl: 1 });
    assert.ok(first && second);
    vision_recalc(0);
    assert.equal(couldsee(14, 10), false);

    await runLevelRegions(game);
    vision_recalc(0);
    assert.equal(couldsee(14, 10), false, 'the second cloud still blocks sight');
    await runLevelRegions(game);
    vision_recalc(0);

    assert.equal(couldsee(14, 10), true);
    assert.equal(cansee(14, 10), true);
    assert.equal(game.level.requireAt(14, 10).disp_ch, '.');
});

void test('the first move after restoring draws newly seen floor', async () => {
    const level = freshObjectRoom({
        left: 8, right: 18, top: 10, bottom: 10,
        recalculateVision: false,
    });
    requirePlayingGame(game);
    for (let x = 8; x <= 18; x++) {
        const location = level.requireAt(x, 10);
        location.lit = false;
        location.waslit = false;
        location.seenv = 0;
    }
    vision_recalc(0);
    assert.equal(cansee(12, 10), false);
    assert.equal(level.requireAt(12, 10).disp_ch, ' ');
    game.plname = 'Cartographer';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    resetGame();
    assert.equal(restoreGame('Cartographer', storage), true);
    game.nhDisplay = new GameDisplay(null);
    resetInputState();

    await rhack('l'.charCodeAt(0));

    requirePlayingGame(game);
    assert.equal(game.u.ux, 11);
    assert.equal(cansee(12, 10), true);
    assert.equal(game.level.requireAt(12, 10).disp_ch, '.');
    assert.notEqual(game.level.requireAt(12, 10).seenv, 0);
});
