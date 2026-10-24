import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createRoomLevel } from './support/playable-room.js';
// A one-way branch descent: the stair on the source level leads into
// dungeon 1 level 3, and that level holds no stairway back toward the
// hero's origin, so the arrival runs do.c:goto_level()'s newdungeon path
// through stairs.c:u_on_sstairs().
function branchDestination(stairs) {
    freshConnectedLevels({ generateDestination: true });
    game.stairs = {
        sx: 10, sy: 10, up: false, isladder: false, u_traversed: false,
        tolev: { dnum: 1, dlevel: 3 }, next: null,
    };
    game.dungeons.push({
        dname: 'The Wayward Branch', depth_start: 5, num_dunlevs: 4,
        entry_lev: 1, dunlev_ureached: 0,
        flags: { maze_like: false, hellish: false, alignment: null },
        bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined,
    });
    const destination = createRoomLevel();
    game._levelCache?.set('1:3', {
        level: destination, stairs, heroTrack: [],
        savedAt: game.moves, activeSpecialLevel: null,
    });
    return destination;
}
void test('branch descent without a return staircase lands on the branch stairs', async () => {
    branchDestination({
        // The branch level's own upstairs must not capture the arrival.
        sx: 12, sy: 10, up: true, isladder: false, u_traversed: false,
        tolev: { dnum: 1, dlevel: 2 },
        next: {
            // A second branch's staircase leading up out of the level.
            sx: 14, sy: 10, up: true, isladder: false, u_traversed: false,
            tolev: { dnum: 5, dlevel: 1 },
            next: null,
        },
    });
    requirePlayingGame(game);
    resetInputState().feed(' '.repeat(10));
    await gotoLevel({ dnum: 1, dlevel: 3 }, { arrival: 'stairs', ladder: false });
    assert.equal(game.u.ux, 14);
    assert.equal(game.u.uy, 10);
});
void test('branch descent without any staircase arrives within the down-teleport region', async () => {
    const destination = branchDestination({
        // Only a staircase continuing deeper into the branch dungeon.
        sx: 12, sy: 10, up: false, isladder: false, u_traversed: false,
        tolev: { dnum: 1, dlevel: 4 }, next: null,
    });
    destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
    requirePlayingGame(game);
    resetInputState().feed(' '.repeat(10));
    await gotoLevel({ dnum: 1, dlevel: 3 }, { arrival: 'stairs', ladder: false });
    assert.equal(game.u.ux, 13);
    assert.equal(game.u.uy, 10);
});
//# sourceMappingURL=stairs_branch_arrival.test.js.map