import assert from 'node:assert/strict';
import test from 'node:test';

import { createBonesFromDeath } from '../js/bones_death.js';
import { dungeonOverviewDisclosure } from '../js/cmd.js';
import { CORR } from '../js/const.js';
import { map_location } from '../js/display.js';
import { game, requireGameDisplay, requireGameLevel, resetGame } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { readDungeonOverview } from './support/dungeon-overview.js';
import { memoryStorage } from './support/memory-storage.js';
import { createRoomLevel, freshPlayableRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';

function bonesRoom(storage: ReturnType<typeof memoryStorage>, name: string, heroX: number): void {
    freshPlayableRoom({ left: 8, right: 35, heroX, hero: { uz: { dnum: 0, dlevel: 7 } } });
    game.plname = name;
    game.dungeons = [createDungeon({
        dname: 'The Dungeons of Doom', num_dunlevs: 10, dunlev_ureached: 8, bonetag: 'D',
    })];
    game.storage = storage;
    game._canMakeBones = true;
    init_objects();
}

async function restoreBones(storage: ReturnType<typeof memoryStorage>): Promise<void> {
    bonesRoom(storage, 'Newcomer', 10);
    game.blind = true;
    initRng(1n);
    await mklev();
    assert.equal(game._restoredBones, true);
}

void test('an ancestor becomes known when the hero maps their resting square', async () => {
    const storage = memoryStorage();
    bonesRoom(storage, 'Ada', 30);
    assert.equal(await createBonesFromDeath('killed by a kobold', async () => 'y'), true);
    await restoreBones(storage);

    assert.doesNotMatch(await readDungeonOverview(), /Ada|Final resting place/);
    map_location(30, 10, false);

    const overview = await readDungeonOverview();
    assert.match(overview, /Final resting place for\s+Ada-Cav-Hum-Mal-Law, killed by a kobold\./);
});

void test('wizard overview discloses an ancestor before finding their resting square', async () => {
    const storage = memoryStorage();
    bonesRoom(storage, 'Ada', 30);
    assert.equal(await createBonesFromDeath('killed by a kobold', async () => 'y'), true);
    await restoreBones(storage);
    game.flags.debug = true;

    const overview = await readDungeonOverview();

    assert.match(overview, /Ada-Cav-Hum-Mal-Law, killed by a kobold\./);
});

void test('the ancestor death reason includes the involuntary delay at death', async () => {
    const storage = memoryStorage();
    bonesRoom(storage, 'Ada', 30);
    game.multi = -3;
    game._helplessReason = 'sleeping';
    assert.equal(await createBonesFromDeath('killed by a kobold', async () => 'y'), true);
    await restoreBones(storage);

    const text = dungeonOverviewDisclosure('quit', 'quit')
        .map(line => typeof line === 'string' ? line : line.text).join('\n');

    assert.match(text, /Ada-Cav-Hum-Mal-Law, killed by a kobold, while sleeping\./);
});

void test('ancestor death reasons sanitize named foes as the native score formatter does', async () => {
    const storage = memoryStorage();
    bonesRoom(storage, 'Ada', 30);
    assert.equal(await createBonesFromDeath("killed by a hobbit called Jim,=\tJoe", async () => 'y'), true);
    await restoreBones(storage);

    const text = dungeonOverviewDisclosure('quit', 'quit')
        .map(line => typeof line === 'string' ? line : line.text).join('\n');

    assert.match(text, /Ada-Cav-Hum-Mal-Law, killed by a hobbit called Jim;_ Joe\./);
});

void test('final disclosure lists the current death before every ancestor in newest-first order', async () => {
    const storage = memoryStorage();
    bonesRoom(storage, 'Ada', 30);
    assert.equal(await createBonesFromDeath('killed by a kobold', async () => 'y'), true);
    await restoreBones(storage);
    game.plname = 'Grace';
    assert.equal(await createBonesFromDeath('killed by a gnome', async () => 'y'), true);
    await restoreBones(storage);

    const text = dungeonOverviewDisclosure(null, 'killed by his own fire')
        .map(line => typeof line === 'string' ? line : line.text).join('\n');

    assert.match(text, /Final resting place for\n {9}you, killed by your own fire,\n {9}Grace-Cav-Hum-Mal-Law, killed by a gnome,\n {9}Ada-Cav-Hum-Mal-Law, killed by a kobold\./);
});

void test('known ancestors keep a level in the overview after leaving and restoring the game', async () => {
    const storage = memoryStorage();
    bonesRoom(storage, 'Ada', 30);
    requireGameLevel().requireAt(30, 10).typ = CORR;
    assert.equal(await createBonesFromDeath('killed by a kobold', async () => 'y'), true);
    await restoreBones(storage);
    map_location(30, 10, false);
    await readDungeonOverview();
    game._levelCache = new Map([['0:8', { level: createRoomLevel(), stairs: null, savedAt: game.moves }]]);

    await gotoLevel({ dlevel: 8 });

    assert.equal(game.u.uz?.dlevel, 8);
    assert.equal(await saveGame(storage), true);
    const display = requireGameDisplay();
    resetGame();
    game.nhDisplay = display;
    assert.equal(restoreGame('Newcomer', storage), true);
    const overview = await readDungeonOverview();
    assert.match(overview, /Level 7:[\s\S]*Ada-Cav-Hum-Mal-Law, killed by a kobold\./);
});
