import type { DisplayGlyph } from '../js/display.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { BC_CHAIN, PIT, TT_BEARTRAP } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { dropBall, setBallAndChainFelt } from '../js/ball.js';
import { punishHero } from '../js/punishment.js';
import { moveObject, placeObjectSynchronously, remove_object } from '../js/floor_object.js';
import { floatHeroDown } from '../js/terrain_movement.js';
import { feel_location } from '../js/display.js';
import { HEAVY_IRON_BALL, ROCK } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { initRng } from '../js/rng.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

// Real punishment ownership: punishHero creates the ball and chain and
// places them; repositioning uses the shared floor owners only.
async function punishedHero({
    ballAt = [10, 10],
    chainAt = [10, 10],
    seed = 70,
}: {
    ballAt?: readonly [number, number];
    chainAt?: readonly [number, number];
    seed?: number;
} = {}) {
    freshObjectRoom({ gameplaySeed: seed });
    requirePlayingGame(game);
    pushKeys('  ');
    await punishHero(null, game);
    const ball = game.uball || game.u.uball;
    const chain = game.uchain || game.u.uchain;
    assert.ok(ball);
    assert.ok(chain);
    remove_object(ball);
    placeObjectSynchronously(ball, ballAt[0], ballAt[1], game);
    remove_object(chain);
    placeObjectSynchronously(chain, chainAt[0], chainAt[1], game);
    return { ball, chain };
}

// C ball.c:884-889: dropping the ball at the hero's own square only
// refreshes the blind order; nothing is pulled.
void test('dropping the ball on the hero square leaves the hero in place', async () => {
    const { ball } = await punishedHero();
    pushKeys(' ');

    await dropBall(game.u.ux, game.u.uy);

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.ok(floorObjectsAt(requireGameLevel(), 10, 10).includes(ball));
});

// C ball.c:931-941: a pit under the dropped ball drags the hero onto its
// square, where the landing spot effects trap her in the pit.
void test('a ball dropped over a pit pulls the hero onto it', async () => {
    const { chain } = await punishedHero({
        ballAt: [11, 10],
        chainAt: [10, 10],
        seed: 72,
    });
    addTrap(requireGameLevel(), PIT, 11, 10, { tseen: true });
    pushKeys(' ');

    await dropBall(11, 10);

    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.deepEqual([chain.ox, chain.oy], [11, 10]);
    assert.equal(game.u.utraptype, 2); // TT_PIT
    assert.ok((game.u.utrap ?? 0) > 0);
});

// C ball.c:952 movobj(uchain, u.ux, u.uy): the chain leaves its old floor
// pile and joins the pile at the hero's square.
void test('the chain really moves between floor piles', async () => {
    const { chain } = await punishedHero({
        ballAt: [11, 10],
        chainAt: [10, 11],
        seed: 74,
    });
    requireGameLevel().requireAt(11, 10).typ = 16; // POOL: pulls the hero onto the ball
    pushKeys('                        ');

    await dropBall(11, 10);

    // movobj left the old pile and joined the pile at the ball's square
    // where the hero was pulled to; the pool's later crawl-out relocating
    // the hero again is the liquid owner's separate behavior
    assert.deepEqual([chain.ox, chain.oy], [11, 10]);
    assert.ok(!floorObjectsAt(requireGameLevel(), 10, 11).includes(chain));
    assert.ok(floorObjectsAt(requireGameLevel(), 11, 10).includes(chain));
});

// C trap.c:5164 teleds(TELEDS_ALLOW_DRAG) crawl-out: valid initial geometry
// forces the chain to move — hero(10,10), ball(11,10), chain(11,11) all in
// the pool, and (9,9) the only adjacent dry square.
void test('the crawl-out drags the chain toward the escape square', async () => {
    freshObjectRoom({ gameplaySeed: 75 });
    requirePlayingGame(game);
    pushKeys('  ');
    await punishHero(null, game);
    const ball = game.uball || game.u.uball;
    const chain = game.uchain || game.u.uchain;
    assert.ok(ball);
    assert.ok(chain);
    remove_object(ball);
    placeObjectSynchronously(ball, 11, 10, game);
    remove_object(chain);
    placeObjectSynchronously(chain, 11, 11, game);
    // float_down first pulls the punished hero onto the pool ball at
    // (11,10); of that square's neighbors only (12,9) stays dry, so the
    // crawl escape is forced there — two squares from the chain at (11,11)
    for (const [x, y] of [
        [10, 10],
        [11, 10],
        [11, 11],
        [10, 9],
        [9, 10],
        [10, 11],
        [9, 11],
        [11, 9],
        [12, 10],
        [12, 11],
    ] as const)
        requireGameLevel().requireAt(x, y).typ = 16; // POOL
    game.u.levitationTurns = 5;
    initRng(75002n);
    pushKeys('                                ');

    await floatHeroDown(0x00ffffff, 0);

    // the crawl could only leave through (12,9)
    assert.deepEqual([game.u.ux, game.u.uy], [12, 9]);
    // the chain physically left its old pile and was drag-placed into a
    // real pile adjacent to both the escaped hero and the ball
    assert.ok(!floorObjectsAt(requireGameLevel(), 11, 11).includes(chain));
    assert.equal(chain.where, 'floor');
    assert.ok((requireGameLevel().objects[chain.ox]?.[chain.oy] || []).includes(chain));
    assert.ok(Math.abs(chain.ox - game.u.ux) <= 1 && Math.abs(chain.oy - game.u.uy) <= 1);
    assert.ok(Math.abs(chain.ox - ball.ox) <= 1 && Math.abs(chain.oy - ball.oy) <= 1);
});

// C ball.c:896-927: the pull releases a bear trap holding the hero.
void test('a dropped ball pulls the hero out of a bear trap', async () => {
    await punishedHero({
        ballAt: [11, 10],
        chainAt: [10, 10],
        seed: 73,
    });
    game.u.utrap = 4;
    game.u.utraptype = TT_BEARTRAP;
    requirePlayingGame(game);
    const hp = game.u.uhp;
    pushKeys(' '.repeat(10));

    await dropBall(11, 10);

    assert.equal(game.u.utrap, 0);
    assert.ok(game.u.uhp < hp + 1); // wounded legs damage possible
});

void test('dropping a blind ball restores the known floor beneath the felt chain', async () => {
    const { chain } = await punishedHero({
        ballAt: [11, 10],
        chainAt: [10, 11],
        seed: 76,
    });
    const rock = await floorObject(ROCK, 10, 11);
    await moveObject(chain, 10, 11);
    await setBallAndChainFelt(false);
    setHeroBlindnessTurns(20);
    vision_recalc(0);
    feel_location(10, 11);
    pushKeys(' '.repeat(10));

    await dropBall(11, 10);

    assert.equal(objectGlyphType(requireGameLevel().requireAt(10, 11).remembered_glyph), rock.otyp);
    assert.equal(game.u.bc_felt, BC_CHAIN);
    assert.equal(objectGlyphType(game.u.bglyph), HEAVY_IRON_BALL);
    assert.equal(objectGlyphType(game.u.cglyph), HEAVY_IRON_BALL);
});

function objectGlyphType(glyph: DisplayGlyph | null | undefined): number {
    assert.ok(glyph?.kind === 'object', 'the remembered square must contain an object glyph');
    return glyph.otyp;
}
