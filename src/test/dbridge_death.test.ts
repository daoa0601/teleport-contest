import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DBWALL, DB_EAST, DB_FLOOR, DB_LAVA, DB_MOAT, DB_NORTH, DOOR,
    DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, NO_MINVENT, ROOM,
} from '../js/const.js';
import { closeDrawbridge, destroyDrawbridge, openDrawbridge } from '../js/dbridge.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { loadScoreRecords } from '../js/score_records.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';

function bridgeDeathRoom(open: boolean, onSpan: boolean) {
    const level = freshGameplayRoom({ right: 60, top: 2, bottom: 18,
        heroX: 12, heroY: onSpan ? 10 : 9, hero: { urexp: 100 },
        flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false } });
    requirePlayingGame(game);
    const span = level.requireAt(12, 10);
    span.typ = open ? DRAWBRIDGE_DOWN : DRAWBRIDGE_UP;
    span.drawbridgemask = DB_NORTH | DB_FLOOR;
    level.requireAt(12, 9).typ = open ? DOOR : DBWALL;
    game.u.fumbling = true;
    game.plname = 'Victim';
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    pushKeys(' '.repeat(100));
}

void test('a hero crushed underneath a lowering bridge has the native death reason', async () => {
    bridgeDeathRoom(false, true);

    await openDrawbridge(12, 10);

    assert.equal(game.program_state.gameover, true);
    assert.equal(loadScoreRecords()[0]?.death, 'crushed to death underneath a drawbridge');
});

void test('a falling portcullis records crushing by a falling drawbridge', async () => {
    bridgeDeathRoom(true, false);

    await closeDrawbridge(12, 10);

    assert.equal(game.program_state.gameover, true);
    assert.equal(loadScoreRecords()[0]?.death, 'crushed to death by a falling drawbridge');
});

void test('life saving from a portcullis moves the hero to a nearby safe square', async () => {
    bridgeDeathRoom(true, false);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');

    await closeDrawbridge(12, 10);

    assert.equal(!!game.program_state.gameover, false);
    assert.equal(amulet.where, 'gone');
    assert.equal(Math.max(Math.abs(game.u.ux - 12), Math.abs(game.u.uy - 9)), 1);
});

void test('a fumbling water-walker saved from an east-facing bridge collapse lands north', async () => {
    bridgeDeathRoom(true, true);
    requirePlayingGame(game);
    game.level.requireAt(12, 10).drawbridgemask = DB_EAST | DB_MOAT;
    game.level.requireAt(12, 9).typ = ROOM;
    game.level.requireAt(13, 10).typ = DOOR;
    game.u.waterWalking = true;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');

    await destroyDrawbridge(12, 10);

    assert.equal(!!game.program_state.gameover, false);
    assert.equal(amulet.where, 'gone');
    assert.equal(game.u.ux, 12);
    assert.equal(game.u.uy, 9);
});

void test('a held hero falling from a rising bridge still suffers lava effects', async () => {
    bridgeDeathRoom(true, true);
    requirePlayingGame(game);
    game.level.requireAt(12, 10).drawbridgemask = DB_NORTH | DB_LAVA;
    game.u.ustuck = await createMonsterAt('large mimic', 13, 10, NO_MINVENT);
    await createMonsterAt('xorn', 12, 9, NO_MINVENT);

    await closeDrawbridge(12, 10);

    assert.equal(game.program_state.gameover, true);
    assert.match(loadScoreRecords()[0]?.death ?? '', /molten lava/);
});
