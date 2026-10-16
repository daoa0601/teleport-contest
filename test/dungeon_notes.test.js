import assert from 'node:assert/strict';
import test from 'node:test';
import { ALTAR, AM_NEUTRAL, DELPHI, ROOMOFFSET, VIBRATING_SQUARE } from '../js/const.js';
import { mapLevel } from '../js/detect.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { ensureQuestStatus } from '../js/quest.js';
import { questLeaderName } from '../js/quest_pager.js';
import { readDungeonOverview } from './support/dungeon-overview.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon, createRoom, createSpecialLevel } from './support/topology.js';
for (const [name, note] of [['bigrm', 'A very big room.'], ['rogue', 'A primitive area.']]) {
    void test(`the overview recognizes ${name}`, async () => {
        assert.ok(name && note);
        freshObjectRoom();
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: 'Dungeon', num_dunlevs: 20 })];
        game.specialLevels = new Map([[name, createSpecialLevel(game.u.uz)]]);
        if (name === 'rogue')
            game.rogue_level = { ...game.u.uz };
        assert.ok((await readDungeonOverview()).includes(note));
    });
}
void test('a discovered former Oracle room retains its automatic annotation', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'Dungeon', num_dunlevs: 20 })];
    level.rooms = [createRoom({ lx: 7, ly: 6, hx: 16, hy: 14, orig_rtype: DELPHI })];
    level.nroom = 1;
    level.requireAt(11, 10).roomno = ROOMOFFSET;
    mapLevel({ exercise: false });
    assert.match(await readDungeonOverview(), /Oracle of Delphi\./);
});
void test('the overview reports Sokoban as solved or unsolved', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'Sokoban', num_dunlevs: 8, entry_lev: 8 })];
    game.sokoban_dnum = 0;
    level.flags.sokoban_rules = true;
    assert.match(await readDungeonOverview(), /Unsolved\./);
    level.flags.sokoban_rules = false;
    assert.match(await readDungeonOverview(), /Solved\./);
});
void test('the Quest home uses local level numbers and the leader quest note', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Quest', depth_start: 15, num_dunlevs: 5 })];
    game.quest_dnum = 0;
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.specialLevels = new Map([['x-strt', createSpecialLevel(game.u.uz)]]);
    ensureQuestStatus().got_quest = true;
    const text = await readDungeonOverview();
    assert.match(text, /Level 1:/);
    assert.ok(text.includes(`Given quest by ${questLeaderName()}.`), text);
});
void test('the Sanctum altar replaces the invocation gateway annotation', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'Gehennom', num_dunlevs: 9,
            dunlev_ureached: 9, flags: { hellish: true } })];
    game.sanctum_level = createSpecialLevel({ dnum: 0, dlevel: 9 });
    addTrap(level, VIBRATING_SQUARE, 12, 10, { tseen: true });
    assert.match(await readDungeonOverview(), /Gateway to Moloch's Sanctum\./);
    game.u.uz = { dnum: 0, dlevel: 9 };
    level.traps = [];
    const altar = level.requireAt(12, 10);
    altar.typ = ALTAR;
    altar.flags = AM_NEUTRAL;
    mapLevel({ exercise: false });
    const text = await readDungeonOverview();
    assert.match(text, /Moloch's Sanctum\./);
    assert.doesNotMatch(text, /Gateway to /);
});
void test('wizard overview does not label ordinary Quest filler levels as special levels', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Quest', num_dunlevs: 5 })];
    game.quest_dnum = 0;
    game.u.uz = { dnum: 0, dlevel: 2 };
    game.specialLevels = new Map([
        ['x-strt', createSpecialLevel({ dnum: 0, dlevel: 1 })],
        ['x-loca', createSpecialLevel({ dnum: 0, dlevel: 3 })],
    ]);
    const text = await readDungeonOverview();
    assert.match(text, /Level 2: <- You are here\./);
});
//# sourceMappingURL=dungeon_notes.test.js.map