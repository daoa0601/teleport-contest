import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { VWALL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { plineWithContinuation } from '../js/display.js';
import { pushKeys } from '../js/input.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { moveHeroByTeleport } from '../js/teleport.js';
import { cansee, couldsee, unset_seenv, visibleCellsFrom, vision_recalc, vision_reset } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';

void test('visibility from a square stops behind a wall and at its range limit', () => {
    const level = freshObjectRoom({
        left: 31, right: 49, top: 1, bottom: 19,
        heroX: 40, heroY: 10,
    });
    requirePlayingGame(game);
    const includes = (cells: readonly { x: number; y: number }[], x: number, y: number) => cells.some(cell => cell.x === x && cell.y === y);
    const unobstructed = visibleCellsFrom(40, 10, 9);
    assert.ok(includes(unobstructed, 45, 10));
    assert.equal(includes(unobstructed, 50, 10), false);

    level.requireAt(43, 10).typ = VWALL;
    vision_reset();
    const obstructed = visibleCellsFrom(40, 10, 9);

    assert.ok(includes(obstructed, 42, 10));
    assert.ok(includes(obstructed, 43, 10));
    assert.equal(includes(obstructed, 45, 10), false);
});

void test('forgetting a corridor origin clears all views recorded for that square', () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const x = game.u.ux, y = game.u.uy;
    const location = level.requireAt(x, y);
    assert.notEqual(location.seenv, 0);

    unset_seenv(location, x, y, x, y);

    assert.equal(location.seenv, 0);
});

void test('forgetting one view of an adjacent wall preserves a view from elsewhere', async () => {
    const level = freshObjectRoom({ heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    const wall = level.requireAt(11, 11);
    wall.typ = VWALL;
    wall.seenv = 0;
    vision_reset();
    vision_recalc(0);
    const corridorView = wall.seenv;
    assert.notEqual(corridorView, 0);
    await moveHeroByTeleport(12, 12);
    vision_recalc(0);
    assert.notEqual(wall.seenv, corridorView);

    unset_seenv(wall, 10, 10, 11, 11);

    assert.equal(wall.seenv & corridorView, 0);
    assert.notEqual(wall.seenv, 0);
});

void test('a message refresh keeps both lines of sight closed while the hero is swallowed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10);
    assert.equal(couldsee(12, 10), true);
    assert.equal(cansee(12, 10), true);
    await installSwallowedHero(worm);
    pushKeys(' '.repeat(10));

    await plineWithContinuation('You are inside the purple worm.');

    assert.equal(couldsee(12, 10), false);
    assert.equal(cansee(12, 10), false);
    assert.equal(couldsee(game.u.ux, game.u.uy), false);
});
