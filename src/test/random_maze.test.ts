import type { GameMap } from '../js/game.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ACCESSIBLE, COLNO, CORR, FIRE_TRAP, Invocation_lev, MAGIC_PORTAL,
    PANICLOG, ROOM, ROWNO, STAIRS, VIBRATING_SQUARE,
} from '../js/const.js';
import { GameDisplay } from '../js/game_display.js';
import { dungeonFeatureSentenceAt } from '../js/dungeon_feature.js';
import { game, requireGameLevel, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { heroIsOnStairs, isInvocationPosition } from '../js/invocation_position.js';
import { generateRandomMaze, mklev } from '../js/mklev.js';
import { BOULDER, GOLD_PIECE } from '../js/object_data.js';
import { addTrap, floorObjects, levelStairs } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';
import { memoryStorage } from './support/memory-storage.js';

function prepareMaze({ seed = 173, depth = 24, hell = false } = {}) {
    freshSpecialLevel({ prototype: 'random-maze', seed, depth });
    game._activeSpecialLevel = null;
    game.made_branch = false;
    game.flags.bones = false;
    const dungeon = game.dungeons[0];
    assert.ok(dungeon);
    dungeon.dname = hell ? 'Gehennom' : 'The Dungeons of Doom';
    dungeon.depth_start = 1;
    dungeon.num_dunlevs = 30;
    dungeon.flags.hellish = hell;
    if (hell) game.valley_level = { dnum: 0, dlevel: 1, flags: { town: false }, alignment: null };
    game.medusa_level = { dnum: 0, dlevel: 20, flags: { town: false }, alignment: null };
}

void test('a maze branch at level one remains unknown until the hero traverses it', async () => {
    prepareMaze({ depth: 1 });
    game.branches = [{
        type: 'stair', portal: false, end1_up: true,
        end1: { dnum: 0, dlevel: 1 }, end2: { dnum: 1, dlevel: 1 },
    }];

    await generateRandomMaze();

    const entrance = levelStairs(game).find(stair => stair.tolev.dnum === 1);
    assert.ok(entrance);
    assert.equal(dungeonFeatureSentenceAt(entrance.sx, entrance.sy),
        'There is a staircase up here.');
});

function assertConnectedMaze(level: GameMap) {
    const passages = [];
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            if (ACCESSIBLE(level.requireAt(x, y).typ)) passages.push({ x, y });
        }
    }
    assert.ok(passages.length > 100, 'a generated maze must have usable passages');
    const seen = new Set();
    const first = passages[0];
    assert.ok(first);
    const pending = [first];
    while (pending.length) {
        const position = pending.pop();
        assert.ok(position);
        const { x, y } = position;
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
            const neighbor = level.at(x + dx, y + dy);
            if (neighbor && ACCESSIBLE(neighbor.typ))
                pending.push({ x: x + dx, y: y + dy });
        }
    }
    assert.equal(seen.size, passages.length, 'every passage must be reachable');
}

void test('random mazes have connected terrain, stairs, real treasure, residents and traps',
    async () => {
        for (const seed of [173, 4321, 1038]) {
            prepareMaze({ seed });

            await generateRandomMaze();

            assert.equal(requireGameLevel().flags.is_maze_lev, true);
            assert.equal(requireGameLevel().nroom, 0);
            assert.equal(game.made_branch, false);
            assertConnectedMaze(requireGameLevel());
            assert.equal(levelStairs(game).length, 2);
            assert.equal(levelStairs(game).filter(stair => stair.up).length, 1);
            for (const stair of levelStairs(game))
                assert.equal(requireGameLevel().requireAt(stair.sx, stair.sy).typ, STAIRS);
            const objects = floorObjects(requireGameLevel());
            assert.ok(objects.filter(object => object.otyp === BOULDER)
                .reduce((sum, object) => sum + object.quan, 0) >= 2);
            assert.ok(objects.some(object => object.otyp === GOLD_PIECE
                && object.quan > 0));
            assert.ok(objects.some(object => object.otyp !== GOLD_PIECE
                && object.otyp !== BOULDER));
            assert.ok(requireGameLevel().monsters.length >= 7);
            assert.ok(requireGameLevel().traps.length >= 7 && requireGameLevel().traps.length <= 12);
            for (const trap of requireGameLevel().traps) {
                assert.ok([ROOM, CORR].includes(requireGameLevel().requireAt(trap.tx, trap.ty).typ));
                assert.notEqual(trap.ttyp, FIRE_TRAP);
            }
        }
    });

void test('normal generation selects a populated maze below Medusa and finalizes it',
    async () => {
        prepareMaze();

        await mklev();

        assert.equal(requireGameLevel().flags.is_maze_lev, true);
        assertConnectedMaze(requireGameLevel());
        assert.equal(game.in_mklev, false);
        assert.equal(levelStairs(game).length, 2);
        assert.ok(requireGameLevel().monsters.length >= 7);
        assert.equal(game._activeSpecialLevel, null);
    });

void test('Gehennom without a fill script generates a hot maze', async () => {
    prepareMaze({ hell: true });

    await mklev();

    assert.equal(requireGameLevel().flags.is_maze_lev, true);
    assert.equal(requireGameLevel().flags.temperature, 1);
    assertConnectedMaze(requireGameLevel());
    assert.ok(requireGameLevel().traps.some(trap => trap.ttyp === FIRE_TRAP));
});

void test('an explicit Hell fill script retains its Lua-owned level', async () => {
    prepareMaze({ hell: true });
    assert.ok(game.dungeons[0]);
    game.dungeons[0].levelFill = 'hellfill';

    await mklev();

    assert.ok(game._activeSpecialLevel != null);
    assert.equal(game._activeSpecialLevel.file, 'hellfill.lua');
    assert.equal(levelStairs(game).length, 2);
    assert.ok(requireGameLevel().monsters.length >= 8);
});

void test('dungeon prototypes precede fill scripts and select the numbered tower floor', async () => {
    prepareMaze({ depth: 2 });
    assert.ok(game.dungeons[0]);
    game.dungeons[0].protofile = 'tower';
    assert.ok(game.dungeons[0]);
    game.dungeons[0].levelFill = 'hellfill';
    assert.ok(game.dungeons[0]);
    game.dungeons[0].num_dunlevs = 3;

    await mklev();

    assert.ok(game._activeSpecialLevel != null);
    assert.equal(game._activeSpecialLevel.file, 'tower2.lua');
    assert.equal(requireGameLevel().flags.noteleport, true);
    assert.equal(requireGameLevel().flags.hardfloor, true);
    assert.equal(levelStairs(game).length, 2);
    assert.ok(levelStairs(game).every(stair => stair.isladder));
});

void test('Quest filler selection changes at the locate level', async () => {
    for (const depth of [2, 5]) {
        prepareMaze({ depth });
        assert.ok(game.dungeons[0]);
    game.dungeons[0].dname = 'The Quest';
        assert.ok(game.specialLevels);
        game.specialLevels.set('Arc-loca', { dnum: 0, dlevel: 4, flags: { town: false }, alignment: null });

        await mklev();

        assert.ok(game._activeSpecialLevel != null);
        assert.equal(game._activeSpecialLevel.file,
            depth < 4 ? 'Arc-fila.lua' : 'Arc-filb.lua');
        assert.equal(levelStairs(game).length, 2);
        assert.ok(requireGameLevel().nroom > 0);
        assert.ok(requireGameLevel().monsters.length > 0);
    }
});

void test('a missing configured maze script reports the problem before generating its fallback', async () => {
    prepareMaze({ hell: true });
    assert.ok(game.dungeons[0]);
    game.dungeons[0].levelFill = 'unavailable-fill';
    game.nhDisplay = new GameDisplay(null);
    game.storage = memoryStorage();
    const input = resetInputState();
    const generation = mklev();
    try {
        assert.equal(await Promise.race([
            input.waitUntilBlocked().then(() => 'waiting'),
            generation.then(() => 'finished'),
        ]), 'waiting', 'missing-file diagnostics must wait for acknowledgment');
        const visible = requireGameDisplay().grid.map(row =>
            row.map(cell => cell.ch).join('')).join('\n');
        assert.match(visible, /Couldn't load "unavailable-fill.lua" - making a maze\./);
        assert.match(visible, /--More--/);
        assert.equal(requireGameLevel().flags.is_maze_lev, false);
        assert.equal(requireGameLevel().monsters.length, 0);
        assert.equal(levelStairs(game).length, 0);
        assert.match(game.storage.getItem(PANICLOG) ?? '', /Couldn't load/);
    } finally {
        input.beforeRead = () => input.feed(' ');
        input.feed(' ');
        await generation;
    }

    assert.equal(requireGameLevel().flags.is_maze_lev, true);
    assertConnectedMaze(requireGameLevel());
    assert.ok(requireGameLevel().monsters.length >= 7);
});

void test('an invocation maze has a distant square instead of a down stair', async () => {
    prepareMaze({ hell: true, depth: 29, seed: 519 });

    await mklev();

    const stairs = levelStairs(game);
    assert.equal(stairs.length, 1);
    const firstStair = stairs[0];
    assert.ok(firstStair);
    assert.equal(firstStair.up, true);
    const squares = requireGameLevel().traps.filter(trap => trap.ttyp === VIBRATING_SQUARE);
    assert.equal(squares.length, 1);
    const square = squares[0];
    assert.ok(square);
    const dx = Math.abs(square.tx - firstStair.sx);
    const dy = Math.abs(square.ty - firstStair.sy);
    assert.ok(dx && dy && dx !== dy && Math.max(dx, dy) > 11);
    assert.ok(square.tx >= 7 && square.tx <= 73);
    assert.ok(square.ty >= 6 && square.ty <= 16);
    assert.ok([ROOM, CORR].includes(requireGameLevel().requireAt(square.tx, square.ty).typ));
    assert.equal(isInvocationPosition(square.tx, square.ty), true);
    assert.equal(isInvocationPosition(firstStair.sx, firstStair.sy), false);
    game.u.ux = square.tx;
    game.u.uy = square.ty;
    assert.equal(heroIsOnStairs(), false);
    game.u.uz = { dnum: 0, dlevel: 28 };
    assert.ok(square != null);
    assert.equal(isInvocationPosition(square.tx, square.ty), false);
});

void test('heat alone does not identify an invocation level', () => {
    prepareMaze({ hell: true, depth: 29 });
    const mainDungeon = game.dungeons[0];
    assert.ok(mainDungeon);
    game.dungeons.push({ ...mainDungeon, dname: 'Hot custom dungeon', flags: { ...mainDungeon.flags, hellish: false } });
    requireGameLevel().flags.temperature = 1;
    game.u.uz = { dnum: 1, dlevel: 29 };
    addTrap(requireGameLevel(), VIBRATING_SQUARE, 10, 10);

    assert.equal(Invocation_lev(game.u.uz), false);
    assert.equal(isInvocationPosition(10, 10), false);
});

for (const type of ['stair', 'portal', 'no_end1', 'no_end2'] as const) {
    void test(`a roomless maze places its ${type} branch with native endpoint rules`, async () => {
        prepareMaze();
        game.branches = [{
            type, portal: type === 'portal', end1_up: true,
            end1: { dnum: 0, dlevel: 24 }, end2: { dnum: 1, dlevel: 1 },
        }];

        await generateRandomMaze();

        assert.equal(game.made_branch, true);
        const branchStairs = levelStairs(game).filter(stair => stair.tolev.dnum === 1);
        const portals = requireGameLevel().traps.filter(trap => trap.ttyp === MAGIC_PORTAL);
        assert.equal(branchStairs.length, type === 'stair' || type === 'no_end2' ? 1 : 0);
        assert.equal(portals.length, type === 'portal' ? 1 : 0);
        if (type === 'stair' || type === 'no_end2') {
            assert.equal(branchStairs[0]?.up, true);
            const levelUpstair = requireGameLevel().upstair;
            const sameDungeonStair = levelStairs(game).find(stair => stair.up && stair.tolev.dnum === 0);
            assert.ok(levelUpstair && sameDungeonStair);
            assert.equal(levelUpstair.x, sameDungeonStair.sx);
        }
        if (type === 'portal')
            assert.deepEqual(portals[0]?.dst, { dnum: 1, dlevel: 1 });
    });
}
