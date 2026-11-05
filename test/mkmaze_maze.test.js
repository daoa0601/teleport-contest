import test from 'node:test';
import assert from 'node:assert/strict';
import { COLNO, CORR, HWALL, ROOM, ROWNO, STONE } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { freshGame } from './support/game-state.js';
import { create_maze, walkfrom } from '../js/mkmaze.js';
import { initRng, rn2 } from '../js/rng.js';
const mazeXMax = (COLNO - 1) & ~1;
const mazeYMax = (ROWNO - 1) & ~1;
function mazeTerrain(level) {
    const rows = [];
    for (let x = 2; x <= mazeXMax; x++) {
        const row = [];
        for (let y = 2; y <= mazeYMax; y++)
            row.push(level.requireAt(x, y).typ);
        rows.push(row.join(','));
    }
    return rows.join('\n');
}
// create_maze(1, 1, FALSE) takes no rnd() draws for its widths, so the two
// rn2() draws of maze0xy() (mkmaze.c:308) must be the first random calls,
// before walkfrom() picks its first direction.  Replay that composition by
// hand from the same seed — grid fill, the two start draws, then the walk —
// and require the whole carved layout to match: an extra draw anywhere
// before or between them moves the start cell or shifts the walk and the
// spanning-tree openings differ.
void test('create_maze consumes maze0xy start draws before any walk step', () => {
    const fromCreateMaze = new GameMap();
    freshGame({ level: fromCreateMaze });
    initRng(9182);
    create_maze(1, 1, false);
    const byHand = new GameMap();
    freshGame({ level: byHand });
    initRng(9182);
    // C create_maze's non-corrmaze grid fill: odd/odd cells stone, the rest
    // horizontal wall.
    for (let x = 2; x <= mazeXMax; x++)
        for (let y = 2; y <= mazeYMax; y++)
            byHand.requireAt(x, y).typ = x % 2 && y % 2 ? STONE : HWALL;
    const startX = 3 + 2 * rn2((mazeXMax >> 1) - 1);
    const startY = 3 + 2 * rn2((mazeYMax >> 1) - 1);
    walkfrom(startX, startY, 0, mazeXMax, mazeYMax);
    assert.equal(mazeTerrain(fromCreateMaze), mazeTerrain(byHand), 'create_maze must equal grid fill + maze0xy draws + walkfrom');
    assert.ok(startX % 2 === 1 && startY % 2 === 1, 'the maze start must be an odd/odd cell');
});
// walkfrom(x, y, 0, ...) resolves the passage type from level.flags.corrmaze
// exactly as mkmaze.c:walkfrom() does when create_maze() passes typ 0.
void test('walkfrom resolves a zero passage type from the level maze style', () => {
    for (const corrmaze of [false, true]) {
        const level = new GameMap();
        level.flags.corrmaze = corrmaze;
        freshGame({ level });
        initRng(2450);
        walkfrom(3, 3, 0, mazeXMax, mazeYMax);
        assert.equal(level.requireAt(3, 3).typ, corrmaze ? CORR : ROOM);
    }
});
//# sourceMappingURL=mkmaze_maze.test.js.map