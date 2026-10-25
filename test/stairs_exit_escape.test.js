import test from 'node:test';
import assert from 'node:assert/strict';
import { SCORE_RECORD_STORAGE_KEY } from '../js/end.js';
import { loadScoreRecords } from '../js/score_records.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { requireFixtureGame } from './support/game-state.js';
import { createRoomLevel } from './support/playable-room.js';
import { memoryStorage } from './support/memory-storage.js';
// C dungeon.c:prev_level(): the level-1 exit stair of the Dungeons of Doom is
// the Elemental Planes branch stair.  Climbing it without the Amulet ends the
// game as an escape instead of letting goto_level() enter the branch.
function gateOnTheFirstExit() {
    const { source } = freshConnectedLevels({ generateDestination: true });
    requireFixtureGame(game);
    game.storage = memoryStorage();
    game.flags.disclose = '-i -a -v -c -o';
    game.u.ulevel = 8;
    game.u.urexp = 100;
    assert.ok(game.stairs);
    game.stairs.up = true;
    game.stairs.tolev = { dnum: 1, dlevel: 1 };
    game.dungeons.push({
        dname: 'The Wayward Branch', depth_start: 1, num_dunlevs: 2,
        entry_lev: 1, dunlev_ureached: 0,
        flags: { maze_like: false, hellish: false, alignment: null },
        bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined,
    });
    const branchLevel = createRoomLevel();
    game._levelCache?.set('1:1', {
        level: branchLevel,
        stairs: null,
        heroTrack: [],
        savedAt: game.moves,
        activeSpecialLevel: null,
    });
    return { source, branchLevel };
}
void test('climbing the level-1 exit stair without the Amulet escapes the dungeon', async () => {
    const { source } = gateOnTheFirstExit();
    const input = resetInputState();
    let next = 'y';
    input.beforeRead = () => { input.feed(next); next = ' '; };
    await rhack('<'.charCodeAt(0));
    assert.equal(game.program_state.gameover, true, 'the climb ends the game');
    assert.ok(game.level === source, 'the hero never enters the branch');
    assert.ok(game.u.uz, 'the hero stays on the exit level');
    assert.equal(game.u.uz.dnum, 0);
    assert.equal(game.u.uz.dlevel, 1);
    assert.equal(game.stairs?.u_traversed, true, 'prev_level() marks the stair traversed before the escape check');
    assert.ok(game.storage);
    assert.doesNotThrow(() => loadScoreRecords());
    const records = loadScoreRecords();
    assert.ok(records[0], 'the escape is recorded');
    assert.equal(records[0].outcome, 'escaped');
    assert.equal(game.storage.getItem(SCORE_RECORD_STORAGE_KEY) === null, false);
});
void test('the Amulet opens the level-1 exit stair into its branch', async () => {
    const { branchLevel } = gateOnTheFirstExit();
    game.u.uhave = { ...game.u.uhave, amulet: 1 };
    const input = resetInputState();
    let next = 'y';
    input.beforeRead = () => { input.feed(next); next = ' '; };
    await rhack('<'.charCodeAt(0));
    assert.ok(!game.program_state.gameover, 'carrying the Amulet continues the game');
    assert.ok(game.level === branchLevel, 'the hero climbs into the branch dungeon');
    assert.ok(game.u.uz, 'the climb leaves a destination level');
    assert.equal(game.u.uz.dnum, 1);
    assert.equal(game.u.uz.dlevel, 1);
});
//# sourceMappingURL=stairs_exit_escape.test.js.map