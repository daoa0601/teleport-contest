import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCESSIBLE, COLNO, CORR, DOOR, D_CLOSED, HWALL, ROOM, ROWNO, STONE, } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { freshGame } from './support/game-state.js';
import { carveMazeFrom, createMaze } from '../js/maze_terrain.js';
import { initRng } from '../js/rng.js';
const mazeXMax = (COLNO - 1) & ~1;
const mazeYMax = (ROWNO - 1) & ~1;
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function freshMaze(corrmaze = false) {
    const level = new GameMap();
    level.flags.corrmaze = corrmaze;
    const state = freshGame({ level });
    initRng(4321);
    return state;
}
function assertConnectedPassages(level) {
    const passages = [];
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            if (ACCESSIBLE(level.requireAt(x, y).typ))
                passages.push([x, y]);
        }
    }
    assert.ok(passages.length > 0, 'maze must contain a passage');
    const first = passages[0];
    assert.ok(first);
    const pending = [first];
    const visited = new Set();
    while (pending.length) {
        const next = pending.pop();
        assert.ok(next);
        const [x, y] = next;
        const key = `${x},${y}`;
        if (visited.has(key))
            continue;
        visited.add(key);
        for (const [dx, dy] of directions) {
            const neighbor = level.at(x + dx, y + dy);
            if (neighbor && ACCESSIBLE(neighbor.typ))
                pending.push([x + dx, y + dy]);
        }
    }
    assert.equal(visited.size, passages.length, 'all passages must be reachable');
}
for (const corrmaze of [false, true]) {
    void test(`${corrmaze ? 'corridor' : 'room'} maze connects every maze cell`, () => {
        const state = freshMaze(corrmaze);
        createMaze(1, 1, false, state);
        const passageType = corrmaze ? CORR : ROOM;
        let cells = 0;
        let connections = 0;
        for (let x = 3; x < mazeXMax; x += 2) {
            for (let y = 3; y < mazeYMax; y += 2) {
                assert.equal(state.level.requireAt(x, y).typ, passageType, `cell ${x},${y}`);
                cells++;
                if (state.level.requireAt(x + 1, y).typ === passageType)
                    connections++;
                if (state.level.requireAt(x, y + 1).typ === passageType)
                    connections++;
            }
        }
        assert.equal(connections, cells - 1, 'ordinary carving does not create loops');
        assert.equal(state.level.requireAt(2, 2).typ, corrmaze ? STONE : HWALL);
        assert.equal(state.level.requireAt(4, 4).typ, corrmaze ? STONE : HWALL);
        assertConnectedPassages(state.level);
    });
}
void test('corridor maze leaves its upper boundaries intact; room maze initializes them', () => {
    for (const corrmaze of [true, false]) {
        const state = freshMaze(corrmaze);
        state.level.requireAt(mazeXMax, 4).typ = DOOR;
        state.level.requireAt(4, mazeYMax).typ = DOOR;
        state.level.requireAt(2, 2).flags = 7;
        state.level.requireAt(2, 2).lit = true;
        createMaze(1, 1, false, state);
        assert.equal(state.level.requireAt(mazeXMax, 4).typ, corrmaze ? DOOR : HWALL);
        assert.equal(state.level.requireAt(4, mazeYMax).typ, corrmaze ? DOOR : HWALL);
        assert.equal(state.level.requireAt(2, 2).flags, 7, 'grid initialization changes terrain only');
        assert.equal(state.level.requireAt(2, 2).lit, true);
        assert.equal(state.level.requireAt(1, 3).typ, STONE, 'outside the maze remains untouched');
    }
});
void test('maze walk preserves its starting door and respects the supplied bounds', () => {
    const state = freshMaze();
    const door = state.level.requireAt(3, 3);
    door.typ = DOOR;
    door.flags = D_CLOSED;
    door.doormask = D_CLOSED;
    state.level.requireAt(5, 3).flags = 7;
    state.level.requireAt(4, 3).flags = 7;
    carveMazeFrom(3, 3, CORR, 7, 3, state);
    assert.equal(door.typ, DOOR);
    assert.equal(door.flags, D_CLOSED);
    assert.equal(door.doormask, D_CLOSED);
    assert.equal(state.level.requireAt(5, 3).typ, CORR);
    assert.equal(state.level.requireAt(5, 3).flags, 0, 'new maze cell loses old terrain flags');
    assert.equal(state.level.requireAt(4, 3).flags, 7, 'connecting square keeps its flags');
    assert.equal(state.level.requireAt(9, 3).typ, STONE);
    assert.equal(state.level.requireAt(3, 5).typ, STONE);
    assertConnectedPassages(state.level);
});
void test('wide corridors expand maze cells while retaining the outer wall and local lighting', () => {
    const state = freshMaze();
    state.level.requireAt(4, 4).lit = true;
    createMaze(3, 2, false, state);
    for (let x = 3; x <= 5; x++) {
        for (let y = 3; y <= 5; y++)
            assert.equal(state.level.requireAt(x, y).typ, ROOM, `expanded cell ${x},${y}`);
    }
    assert.equal(state.level.requireAt(2, 4).typ, HWALL, 'outer wall stays one square thick');
    assert.equal(state.level.requireAt(6, 6).typ, HWALL);
    assert.equal(state.level.requireAt(7, 7).typ, HWALL, 'interior wall expands to two squares');
    assert.equal(state.level.requireAt(4, 4).lit, true);
    assert.equal(state.level.requireAt(3, 3).lit, false, 'scaling does not copy lighting');
    assertConnectedPassages(state.level);
});
void test('dead-end removal connects each narrow maze cell to at least two neighbors', () => {
    const state = freshMaze(true);
    createMaze(1, 1, true, state);
    for (let x = 3; x < mazeXMax; x += 2) {
        for (let y = 3; y < mazeYMax; y += 2) {
            const exits = directions.filter(([dx, dy]) => ACCESSIBLE(state.level.requireAt(x + dx, y + dy).typ)).length;
            assert.ok(exits >= 2, `maze cell ${x},${y} has only ${exits} exit(s)`);
        }
    }
    assertConnectedPassages(state.level);
});
void test('default and clamped maze widths produce usable connected passages', () => {
    for (const [corridor, wall] of [[-1, -1], [0, 0], [9, 9]]) {
        const state = freshMaze();
        createMaze(corridor, wall, true, state);
        assertConnectedPassages(state.level);
        assert.equal(state.level.requireAt(1, 3).typ, STONE);
    }
});
//# sourceMappingURL=maze_terrain.test.js.map