import { GameMap } from '../js/game.js';
import { createSpecialLevel, createDungeon } from './support/topology.js';
import { loadScoreRecords } from '../js/score_records.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { chooseWizardLevelDestination, rhack } from '../js/cmd.js';
import { docrt, flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { SCORE_RECORD_STORAGE_KEY } from '../js/end.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { levelDepthByName, levelTeleport, randomTeleportDepth } from '../js/level_teleport.js';
import { finishScheduledLevelChange } from '../js/level_change.js';
import { AMULET_OF_LIFE_SAVING, DIAMOND, SCR_TELEPORTATION } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { teleportScrollEffect } from '../js/scroll_teleport.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { requireScreenCell } from './support/screen.js';
void test('blessed teleportation grants destination control and applies arrival pickup', async () => {
    freshObjectRoom({ flags: { tips: false, pickup: true } });
    requirePlayingGame(game);
    const scroll = await addInventoryObject(SCR_TELEPORTATION, { blessed: true });
    const gem = await floorObject(DIAMOND, 14, 10);
    pushKeys('llll.' + ' '.repeat(15));
    const result = await teleportScrollEffect(scroll);
    assert.equal(game.u.ux, 14);
    assert.equal(game.inventory.includes(gem), true);
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(SCR_TELEPORTATION), true);
    assert.equal(result.known, false);
    assert.equal(result.consumed, false, 'the read transaction still owns scroll disposal');
});
void test('cancelling a blessed teleport learns the scroll without moving', async () => {
    freshObjectRoom({ flags: { tips: false } });
    requirePlayingGame(game);
    const scroll = await addInventoryObject(SCR_TELEPORTATION, { blessed: true });
    pushKeys('\x1b');
    const result = await teleportScrollEffect(scroll);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.equal(result.known, false);
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(SCR_TELEPORTATION), true);
});
void test('a teleport restriction reveals an ordinary scroll before any destination input', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.flags.noteleport = true;
    const scroll = await addInventoryObject(SCR_TELEPORTATION);
    const result = await teleportScrollEffect(scroll);
    assert.equal(result.known, false);
    assert.equal(game.u.ux, 10);
    assert.match(game._pending_message, /mysterious force prevents you from teleporting/);
});
void test('a cursed scroll changes levels when the hero controls teleportation', async () => {
    const { destination } = freshConnectedLevels();
    grantIntrinsicProperty('teleportControl', 'outside');
    const scroll = await addInventoryObject(SCR_TELEPORTATION, { cursed: true });
    pushKeys('2\n' + ' '.repeat(20));
    const result = await teleportScrollEffect(scroll);
    await finishScheduledLevelChange();
    assert.equal(game.level, destination);
    assert.ok(game.u.uz !== undefined && game.u.uz !== null, 'Expected game.u.uz to be initialized');
    assert.equal(game.u.uz.dlevel, 2);
    assert.equal(result.known, true);
});
for (const restriction of ['amulet', 'sokoban', 'endgame']) {
    void test(`${restriction} blocks cursed level teleportation but still identifies it`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        if (restriction === 'amulet')
            game.u.uhave.amulet = true;
        if (restriction === 'sokoban')
            game.sokoban_dnum = game.u.uz.dnum;
        if (restriction === 'endgame')
            game.astral_level = createSpecialLevel({ dnum: game.u.uz.dnum, dlevel: 1 });
        const scroll = await addInventoryObject(SCR_TELEPORTATION, { cursed: true });
        const result = await teleportScrollEffect(scroll);
        assert.equal(game.u.uz.dlevel, 8);
        assert.equal(result.known, true);
        assert.match(game._pending_message, /very disoriented/);
    });
}
void test('controlled level teleport accepts a visited annotation', async () => {
    const { destination } = freshConnectedLevels();
    grantIntrinsicProperty('teleportControl', 'outside');
    game._levelAnnotations = new Map([['0:2', 'Safe camp']]);
    pushKeys('safe camp\n' + ' '.repeat(20));
    await levelTeleport();
    await finishScheduledLevelChange();
    assert.equal(game.level, destination);
});
void test('invalid level input repeats the prompt and Escape leaves the level intact', async () => {
    const { source } = freshConnectedLevels();
    grantIntrinsicProperty('teleportControl', 'outside');
    pushKeys('not a level\n\x1b');
    await levelTeleport();
    assert.equal(game.level, source);
    assert.ok(game.u.uz !== undefined && game.u.uz !== null, 'Expected game.u.uz to be initialized');
    assert.equal(game.u.uz.dlevel, 1);
});
void test('Nowhere confirmation can be declined without killing or moving the hero', async () => {
    const { source } = freshConnectedLevels();
    grantIntrinsicProperty('teleportControl', 'outside');
    pushKeys('0\nn');
    await levelTeleport();
    assert.equal(game.level, source);
    assert.ok(game.u.uhp !== undefined && game.u.uhp !== null, 'Expected game.u.uhp to be initialized');
    assert.ok(game.u.uhp > 0);
    assert.equal(!!game.program_state.gameover, false);
});
void test('named destinations require a visited level in a reachable branch', () => {
    freshConnectedLevels();
    game.medusa_level = createSpecialLevel({ dnum: 0, dlevel: 20 });
    game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    game.specialLevels = new Map([
        ['oracle', createSpecialLevel({ dnum: 0, dlevel: 2 })],
        ['castle', createSpecialLevel({ dnum: 0, dlevel: 20 })],
        ['minetn', createSpecialLevel({ dnum: 2, dlevel: 3 })],
    ]);
    assert.equal(levelDepthByName('the Delphi level'), 2);
    assert.equal(levelDepthByName('castle'), 0);
    assert.ok(game._levelCache !== undefined && game._levelCache !== null, 'Expected game._levelCache to be initialized');
    game._levelCache.set('2:3', { level: new GameMap(), stairs: null, savedAt: game.moves });
    assert.equal(levelDepthByName('minetn'), 0);
});
void test('random Quest teleportation cannot pass the unvisited locate level or leave the Quest', () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.quest_dnum = 0;
    game.u.uz.dlevel = 2;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', depth_start: 12, num_dunlevs: 6, dunlev_ureached: 2, flags: {} })];
    game.specialLevels = new Map([['x-loca', createSpecialLevel({ dnum: 0, dlevel: 3 })]]);
    initRng(7n);
    const destinations = Array.from({ length: 100 }, () => randomTeleportDepth());
    assert.ok(destinations.every(depth => depth >= 12 && depth <= 14));
    assert.ok(destinations.some(depth => depth === 14));
    assert.ok(destinations.some(depth => depth === 12));
});
void test('random Gehennom teleportation cannot reach the Sanctum before invocation', () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.uz.dlevel = 5;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', depth_start: 26, num_dunlevs: 6, flags: { hellish: true } })];
    initRng(11n);
    for (let attempt = 0; attempt < 100; attempt++)
        assert.ok(randomTeleportDepth() < 31);
});
void test('Fort Ludios random teleport stays on its isolated level', () => {
    freshObjectRoom({ hero: { uz: { dnum: 0, dlevel: 1 } } });
    requirePlayingGame(game);
    game.knox_level = createSpecialLevel(game.u.uz);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', depth_start: 1, num_dunlevs: 1, flags: {} })];
    initRng(2n);
    for (let attempt = 0; attempt < 10; attempt++)
        assert.equal(randomTeleportDepth(), game.u.uz.dlevel);
});
void test('controlled Gehennom teleport stops above the Sanctum until invocation', async () => {
    const { destination } = freshConnectedLevels({ destinationDepth: 5 });
    assert.ok(game.u.uz !== undefined && game.u.uz !== null, 'Expected game.u.uz to be initialized');
    game.u.uz.dlevel = 4;
    grantIntrinsicProperty('teleportControl', 'outside');
    const dungeon = game.dungeons[0];
    assert.ok(dungeon, 'Gehennom has no dungeon descriptor');
    dungeon.depth_start = 26;
    dungeon.num_dunlevs = 6;
    dungeon.flags.hellish = true;
    game.sanctum_level = createSpecialLevel({ dnum: 0, dlevel: 6 });
    pushKeys('99\n' + ' '.repeat(20));
    await levelTeleport();
    await finishScheduledLevelChange();
    assert.equal(game.level, destination);
    assert.equal(game.u.uz.dlevel, 5);
});
void test('a negative destination lets a flying hero escape with an actual game result', async () => {
    freshConnectedLevels();
    game.storage = memoryStorage();
    game.flags.disclose = '-i -a -v -c -o';
    grantIntrinsicProperty('teleportControl', 'outside');
    game.u.urexp = 100;
    grantIntrinsicProperty('flying', 'outside');
    pushKeys('-1\n' + ' '.repeat(30));
    await levelTeleport();
    await finishScheduledLevelChange();
    assert.equal(game.program_state.gameover, true);
    const records = loadScoreRecords(game);
    assert.equal(records[0]?.outcome, 'escaped');
});
void test('Quest controlled input uses Home levels rather than absolute dungeon depth', async () => {
    const { destination } = freshConnectedLevels({ dungeonName: 'The Quest' });
    game.quest_dnum = 0;
    game.specialLevels = new Map([['x-strt', createSpecialLevel({ dnum: 0, dlevel: 1 })]]);
    const dungeon = game.dungeons[0];
    assert.ok(dungeon, 'Quest has no dungeon descriptor');
    dungeon.depth_start = 12;
    grantIntrinsicProperty('teleportControl', 'outside');
    pushKeys('2\n' + ' '.repeat(20));
    await levelTeleport();
    await finishScheduledLevelChange();
    assert.equal(game.level, destination);
    assert.ok(game.u.uz !== undefined && game.u.uz !== null, 'Expected game.u.uz to be initialized');
    assert.equal(game.u.uz.dlevel, 2);
});
void test('requesting below the main dungeon arrives at the Gehennom entrance', async () => {
    const { destination } = freshConnectedLevels();
    assert.ok(game._levelCache !== undefined && game._levelCache !== null, 'Expected game._levelCache to be initialized');
    const cached = game._levelCache.get('0:2');
    assert.ok(cached, 'Gehennom destination was not built');
    game._levelCache.set('1:1', cached);
    game._levelCache.delete('0:2');
    game.dungeons.push(createDungeon({ dname: 'Gehennom', depth_start: 3, num_dunlevs: 3,
        entry_lev: 1, flags: { hellish: true } }));
    game.medusa_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    game.sanctum_level = createSpecialLevel({ dnum: 1, dlevel: 3 });
    grantIntrinsicProperty('teleportControl', 'outside');
    pushKeys('99\n' + ' '.repeat(30));
    await levelTeleport();
    await finishScheduledLevelChange();
    assert.equal(game.level, destination);
    assert.ok(game.u.uz !== undefined && game.u.uz !== null, 'Expected game.u.uz to be initialized');
    assert.equal(game.u.uz.dnum, 1);
    assert.equal(game.u.uz.dlevel, 1);
});
void test('life saving rematerializes a hero who deliberately teleports to Nowhere', async () => {
    const { source } = freshConnectedLevels();
    grantIntrinsicProperty('teleportControl', 'outside');
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    pushKeys(' 0\ny' + ' '.repeat(25));
    await levelTeleport();
    assert.equal(game.level, source);
    assert.ok(game.u.uhp !== undefined && game.u.uhp !== null, 'Expected game.u.uhp to be initialized');
    assert.ok(game.u.uhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.equal(game.u.umortality, 1);
    assert.equal(!!game.program_state.gameover, false);
    assert.match(game._pending_message, /body rematerializes/);
});
void test('the wizard level-teleport command uses the shared numeric destination rules', async () => {
    const { destination } = freshConnectedLevels();
    game.flags.debug = true;
    pushKeys('2\n' + ' '.repeat(20));
    await rhack(22);
    await finishScheduledLevelChange();
    assert.equal(game.level, destination);
    assert.ok(game.u.uz !== undefined && game.u.uz !== null, 'Expected game.u.uz to be initialized');
    assert.equal(game.u.uz.dlevel, 2);
    assert.equal(game.context.move, 0);
});
void test('the wizard destination menu bypasses confused numeric input', async () => {
    const { destination } = freshConnectedLevels();
    game.flags.debug = true;
    game.u.confusionTurns = 10;
    game.specialLevels = new Map([['oracle', createSpecialLevel({ dnum: 0, dlevel: 2 })]]);
    pushKeys('a' + ' '.repeat(20));
    await levelTeleport({ menuRequested: true });
    await finishScheduledLevelChange();
    assert.equal(game.level, destination);
    assert.deepEqual(game.u.uz, { dnum: 0, dlevel: 2 });
});
for (const overlay of [true, false]) {
    void test(`choosing a wizard destination ${overlay ? 'preserves uncovered' : 'redraws once for'} hallucinated monsters`, async () => {
        freshObjectRoom({ flags: { menu_overlay: overlay }, hero: { hallucinationTurns: 20 } });
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
        game.specialLevels = new Map([['oracle', createSpecialLevel({ dnum: 0, dlevel: 5 })]]);
        await createMonsterAt('jackal', 8, 10);
        await docrt();
        await flush_screen(1);
        if (!overlay) {
            // Full-screen dismissal must show the result of one native redraw.
            initRng(1n);
            await docrt();
            await flush_screen(1);
        }
        const glyph = requireScreenCell(7, 11).ch;
        const color = requireScreenCell(7, 11).color;
        assert.notEqual(glyph, ' ', 'the monster is visible on the map');
        if (!overlay)
            initRng(1n);
        const input = resetInputState();
        const selection = chooseWizardLevelDestination();
        try {
            await input.waitUntilBlocked();
            const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(text, /Level teleport to where:/);
            input.feed('a');
            assert.equal((await selection)?.destination.dlevel, 5);
            await flush_screen(1);
            assert.equal(requireScreenCell(7, 11).ch, glyph, 'the caller must leave map restoration to the tty window');
            assert.equal(requireScreenCell(7, 11).color, color, 'the caller must also leave the restored monster color alone');
        }
        finally {
            input.feed('\x1b');
            await selection;
        }
    });
}
//# sourceMappingURL=scroll_teleport.test.js.map