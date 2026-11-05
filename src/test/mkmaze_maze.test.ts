import test from 'node:test';
import assert from 'node:assert/strict';
import { COLNO, CORR, ROOM, ROWNO, STONE } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { freshGame } from './support/game-state.js';
import { walkfrom } from '../js/mkmaze.js';
import { initRng } from '../js/rng.js';

const mazeXMax = (COLNO - 1) & ~1;
const mazeYMax = (ROWNO - 1) & ~1;

// C mkmaze.c:okay() permits a step only when its destination is STONE.
void test('maze walk stops before an existing room', () => {
    const level = new GameMap();
    const state = freshGame({ level });
    level.requireAt(5, 3).typ = ROOM;
    initRng(1234);

    walkfrom(3, 3, CORR, 7, 3, state);

    assert.equal(level.requireAt(3, 3).typ, CORR, 'the starting cell is carved');
    assert.equal(level.requireAt(4, 3).typ, STONE, 'the room remains disconnected');
    assert.equal(level.requireAt(5, 3).typ, ROOM, 'the existing room is preserved');
    assert.equal(level.requireAt(7, 3).typ, STONE, 'the walk does not cross the room');
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
