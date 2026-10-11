import { createDungeon } from './support/topology.js';
import type { Trap } from '../js/map_types.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ARROW_TRAP, BEAR_TRAP, CORR, HOLE, LAVAWALL, PIT, ROOM, SPIKED_PIT,
    STONE, TT_LAVA, TT_PIT, VWALL, WEB,
} from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { flushPendingTopline, terrain_glyph } from '../js/display.js';
import { CLR_BLUE, NO_COLOR } from '../js/terminal.js';
import { digActualHole } from '../js/digging_terrain.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { gameLogEvents } from '../js/gamelog.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { triggerHeroTrapAt } from '../js/hero_traps.js';
import { heroLiquidEffects } from '../js/hack.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { initializeMonsterWormBody, removeMonsterWormBody } from '../js/monster_worm.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { deleteFloorTrap, maketrap, mksobj } from '../js/mklev.js';
import { BOULDER, STATUE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { connectPits, pitsAreConjoined } from '../js/pit_connections.js';
import { fillPitWithBoulderAt } from '../js/pit_fill.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { createStaffedShop } from './support/shop.js';

async function createTrap(...args: Parameters<typeof maketrap>) {
    const trap = await maketrap(...args);
    assert.ok(trap, 'The requested floor trap must be created');
    return trap;
}

function sokobanRoom() {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', entry_lev: 1, num_dunlevs: 20, depth_start: 1 }),
        createDungeon({ dname: 'Sokoban', entry_lev: 4, num_dunlevs: 4, depth_start: 6 }),
    ];
    game.sokoban_dnum = 1;
    game.u.uz = { dnum: 1, dlevel: 3 };
    level.flags.sokoban_rules = true;
    return level;
}

async function fillWithBoulder(trap: Trap) {
    placeCreatedObject(await mksobj(BOULDER, false, false), trap.tx, trap.ty);
    assert.equal((await fillPitWithBoulderAt(trap.tx, trap.ty)).filled, true);
}

function completions() {
    return gameLogEvents().filter(event => event.text.includes('Sokoban level'));
}

void test('filling the last Sokoban pit lifts the diagonal restriction and records completion', async () => {
    const level = sokobanRoom();
    requirePlayingGame(game);
    const pit = await createTrap(12, 10, PIT);
    level.requireAt(11, 10).typ = STONE;
    level.requireAt(10, 11).typ = STONE;

    await rhack('n'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    await fillWithBoulder(pit);
    await rhack('n'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [11, 11]);
    assert.equal(level.flags.sokoban_rules, false);
    assert.equal(completions().length, 1);
    assert.equal(completions()[0]?.text, 'completed 2nd Sokoban level');
});

void test('an original hole keeps Sokoban active after the other pit is filled', async () => {
    const level = sokobanRoom();
    requirePlayingGame(game);
    const pit = await createTrap(12, 10, PIT);
    const hole = await createTrap(13, 10, HOLE);

    await fillWithBoulder(pit);
    assert.equal(level.flags.sokoban_rules, true);
    assert.equal(completions().length, 0);
    await fillWithBoulder(hole);

    assert.equal(level.flags.sokoban_rules, false);
    assert.equal(completions().length, 1);
});

void test('player-made pits and spiked pits do not prevent Sokoban completion', async () => {
    const level = sokobanRoom();
    requirePlayingGame(game);
    const original = await createTrap(12, 10, PIT);
    await createTrap(14, 10, SPIKED_PIT);
    await digActualHole(11, 10, 'you', PIT);
    const dug = level.traps.find(trap => trap.tx === 11 && trap.ty === 10);
    assert.ok(dug != null, 'Expected dug to be initialized');
    assert.equal(dug.madeby_u, true);

    await fillWithBoulder(original);

    assert.equal(level.flags.sokoban_rules, false);
    assert.equal(level.traps.includes(dug), true);
    assert.equal(completions().length, 1);
    pushKey(' ');
    await flushPendingTopline();
    await fillWithBoulder(dug);
    assert.equal(completions().length, 1);
});

void test('generation and new trap placement do not finish Sokoban, but replacement can', async () => {
    const level = sokobanRoom();
    requirePlayingGame(game);
    game.in_mklev = true;
    const pit = await createTrap(12, 10, PIT);
    await fillWithBoulder(pit);
    assert.equal(level.flags.sokoban_rules, true);
    assert.equal(completions().length, 0);

    game.in_mklev = false;
    const bear = await createTrap(12, 10, BEAR_TRAP);
    assert.equal(level.flags.sokoban_rules, true);
    await createTrap(12, 10, ARROW_TRAP);

    assert.equal(level.traps.includes(bear), true);
    assert.ok(bear != null, 'Expected bear to be initialized');
    assert.equal(bear.ttyp, ARROW_TRAP);
    assert.equal(level.flags.sokoban_rules, false);
    assert.equal(completions().length, 1);
});

void test('removing a non-pit floor trap does not check Sokoban completion', async () => {
    const level = sokobanRoom();
    requirePlayingGame(game);
    const bear = await createTrap(12, 10, BEAR_TRAP);
    assert.equal(await deleteFloorTrap(bear), true);
    assert.equal(level.flags.sokoban_rules, true);
    assert.equal(completions().length, 0);

    const pit = await createTrap(12, 10, PIT);
    assert.equal(await deleteFloorTrap(pit), true);
    assert.equal(level.flags.sokoban_rules, false);
    assert.equal(completions().length, 1);
});

void test('removing a connected pit lets its neighbors join a new pit at the same square', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const left = await createTrap(11, 10, PIT);
    const middle = await createTrap(12, 10, PIT);
    const below = await createTrap(12, 11, PIT);
    assert.equal(connectPits(left, middle), true);
    assert.equal(connectPits(middle, below), true);
    assert.equal(pitsAreConjoined(left, middle), true);

    await deleteFloorTrap(middle);
    const replacement = await createTrap(12, 10, PIT);

    assert.equal(connectPits(left, replacement), true);
    assert.equal(connectPits(below, replacement), true);
    assert.equal(pitsAreConjoined(left, replacement), true);
    assert.equal(pitsAreConjoined(below, replacement), true);
});

for (const replacement of [SPIKED_PIT, WEB]) {
    void test(`replacing an occupied pit ${replacement === WEB ? 'releases the hero for a web' : 'keeps the hero trapped in a spiked pit'}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const { ux: x, uy: y } = game.u;
        const pit = await createTrap(x, y, PIT);
        await triggerHeroTrapAt(x, y);
        assert.ok((game.u.utrap ?? 0) > 0);
        assert.equal(game.u.utraptype, TT_PIT);
        const trappedTurns = game.u.utrap;

        const changed = await createTrap(x, y, replacement);

        assert.equal(changed, pit);
        assert.equal(game.u.utrap, replacement === WEB ? 0 : trappedTurns);
    });
}

void test('replacing a floor trap does not release the hero from a lava wall', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const { ux: x, uy: y } = game.u;
    await createTrap(x, y, BEAR_TRAP);
    level.requireAt(x, y).typ = LAVAWALL;
    grantIntrinsicProperty('fireResistance', 'outside', game);
    await heroLiquidEffects();
    assert.equal(game.u.utraptype, TT_LAVA);
    assert.ok((game.u.utrap ?? 0) > 0);
    const trappedTurns = game.u.utrap;

    await createTrap(x, y, ARROW_TRAP);
    assert.equal(game.u.utrap, trappedTurns);

    level.requireAt(x, y).typ = ROOM;
    await createTrap(x, y, BEAR_TRAP);
    assert.equal(game.u.utrap, 0);
});

void test('removing a floor trap beneath a worm segment releases the trapped worm', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const worm = await createMonsterAt('long worm', 14, 10);
    removeMonsterWormBody(worm);
    placeMonsterAt(worm, worm.mx, worm.my);
    initializeMonsterWormBody(worm, { segmentCount: 1 });
    assert.ok(worm.wormSegments != null, 'Expected worm.wormSegments to be initialized');
    const segment = worm.wormSegments[0];
    assert.ok(segment);
    assert.notDeepEqual([segment.x, segment.y], [worm.mx, worm.my]);
    const headPit = await createTrap(worm.mx, worm.my, PIT);
    const action = await triggerImmediateMonsterTrap(worm, game);
    await resumeDeferredMonsterTrap(action, game);
    assert.equal(worm.mtrapped, 1);
    const tailTrap = await createTrap(segment.x, segment.y, BEAR_TRAP);

    await deleteFloorTrap(tailTrap);

    assert.equal(worm.mtrapped, 0);
    assert.equal(game.level.traps.includes(headPit), true);
});

for (const solved of [false, true]) {
    void test(`monsters born in ${solved ? 'solved' : 'unsolved'} Sokoban know its pits and holes unless mindless`, async () => {
        const level = sokobanRoom();
        requirePlayingGame(game);
        if (solved) await fillWithBoulder(await createTrap(12, 10, PIT));
        assert.equal(level.flags.sokoban_rules, !solved);
        const goblin = await createMonsterAt('goblin', 13, 10);
        const blob = await createMonsterAt('acid blob', 14, 10);

        for (const type of [PIT, HOLE]) {
            assert.notEqual((goblin.mtrapseen ?? 0) & (1 << (type - 1)), 0);
            assert.equal((blob.mtrapseen ?? 0) & (1 << (type - 1)), 0);
        }
    });
}

void test('solving Sokoban keeps its DEC wall color without coloring other branches', async () => {
    const level = sokobanRoom();
    requirePlayingGame(game);
    game.symset = 'DECgraphics';
    const wall = level.requireAt(12, 9);
    wall.typ = VWALL;
    assert.equal(terrain_glyph(wall, 12, 9).color, CLR_BLUE);

    await fillWithBoulder(await createTrap(12, 10, PIT));

    assert.equal(terrain_glyph(wall, 12, 9).color, CLR_BLUE);
    game.u.uz.dnum = 0;
    assert.equal(terrain_glyph(wall, 12, 9).color, NO_COLOR);
});

void test('solved Sokoban still excludes the maze-statue mimic disguise', async () => {
    const appearances: [number[], number[]] = [[], []];
    for (const inSokoban of [false, true]) {
        for (let seed = 0; seed < 8; seed++) {
            const level = sokobanRoom();
            requirePlayingGame(game);
            await fillWithBoulder(await createTrap(12, 10, PIT));
            if (!inSokoban) game.u.uz = { dnum: 0, dlevel: 8 };
            level.flags.is_maze_lev = true;
            const terrainSquare = level.requireAt(13, 10);
            terrainSquare.typ = CORR;
            terrainSquare.roomno = 0;
            initRng(BigInt(seed));
            const mimic = await createMonsterAt('small mimic', 13, 10);
            assert.ok(mimic.mappearance !== undefined);
            appearances[inSokoban ? 1 : 0].push(mimic.mappearance);
        }
    }
    requirePlayingGame(game);

    assert.ok(appearances[0] != null);
    assert.ok(appearances[0].includes(STATUE), 'ordinary mazes can use statues');
    assert.ok(appearances[1] != null);
    assert.ok(appearances[1].every(appearance => appearance === BOULDER),
        'Sokoban uses the roomless boulder disguise after completion');
});

void test('Sokoban rules do not prevent shop mimics from disguising as stock', async () => {
    sokobanRoom();
    requirePlayingGame(game);
    await createStaffedShop();
    const appearances = [];
    for (const [x, y] of [[12, 8], [13, 8], [14, 8], [12, 9], [13, 9], [14, 9]] as const) {
        const mimic = await createMonsterAt('small mimic', x, y);
        assert.ok(mimic.mappearance !== undefined);
        appearances.push(mimic.mappearance);
    }

    assert.ok(appearances.some(appearance => appearance > 0));
});
