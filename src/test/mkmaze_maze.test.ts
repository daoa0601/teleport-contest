import test from 'node:test';
import assert from 'node:assert/strict';
import { COLNO, CORR, ROOM, ROWNO } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { freshGame } from './support/game-state.js';
import { create_maze, walkfrom } from '../js/mkmaze.js';
import { initRng, rn2 } from '../js/rng.js';

const mazeXMax = (COLNO - 1) & ~1;
const mazeYMax = (ROWNO - 1) & ~1;

// create_maze(1, 1, FALSE) takes no rnd() draws for its widths, so the two
// rn2() draws of maze0xy() (mkmaze.c:308) are the first random calls of the
// level, before walkfrom() picks its first direction.
void test('create_maze draws its maze0xy start point before any walk step', () => {
    const level = new GameMap();
    freshGame({ level });
    initRng(9182);
    create_maze(1, 1, false);
    // Re-run the same seed to predict the start cell maze0xy() chose.
    initRng(9182);
    const startX = 3 + 2 * rn2((mazeXMax >> 1) - 1);
    const startY = 3 + 2 * rn2((mazeYMax >> 1) - 1);
    const start = level.requireAt(startX, startY);
    assert.equal(start.typ, ROOM, 'the drawn start cell must be carved');
    assert.ok(startX % 2 === 1 && startY % 2 === 1,
        'the maze start must be an odd/odd cell');
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
