import test from 'node:test';
import assert from 'node:assert/strict';

import { PIT, POOL } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { installSwallowedHero } from './support/hero-state.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    addInventoryObject, floorObject, knownObject,
} from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { dropObjectAtHero, hitFloorWithObject } from '../js/object_drop.js';
import { CORPSE, OBJECT_NAMES, POT_OIL, STATUE } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { unlinkObject } from '../js/object_location.js';

const MEATBALL = OBJECT_NAMES.indexOf('meatball');
const PURPLE_WORM = 'purple worm';

// C do.c:809-814: dropping releases wielded/quivered/swap slots first.
void test('dropping releases the weapon slots and stacks on the floor', async () => {
    freshObjectRoom({ gameplaySeed: 61 });
    requirePlayingGame(game);
    const dagger = await addInventoryObject(OBJECT_NAMES.indexOf('dagger'));
    await setPrimaryWeapon(dagger, game);
    unlinkObject(dagger, game);

    const returned = await dropObjectAtHero(dagger);

    assert.equal(game.uwep ?? game.u?.uwep ?? null, null);
    assert.equal(game._unweapon, true);
    assert.equal(dagger.where, 'floor');
    assert.deepEqual([dagger.ox, dagger.oy], [game.u.ux, game.u.uy]);
    assert.ok(floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy).includes(dagger));
    assert.equal(returned, dagger);
});

// C dropz -> flooreffects: a boulder over a pool never lands.
void test('floor effects consume the dropped object before placement', async () => {
    freshObjectRoom({ gameplaySeed: 62 });
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    const boulder = await floorObject(OBJECT_NAMES.indexOf('boulder'), 11, 10);
    unlinkObject(boulder, game);
    pushKeys(' ');

    const returned = await dropObjectAtHero(boulder);

    assert.equal(returned, null);
    assert.equal(boulder.where, 'gone');
});

// C do.c:816-825: a digester swallower instantly eats dropped food.
void test('a digesting swallower instantly digests dropped meat', async () => {
    freshObjectRoom({ gameplaySeed: 63 });
    requirePlayingGame(game);
    const worm = await createMonsterAt(PURPLE_WORM, game.u.ux, game.u.uy);
    game.u.uswallow = 1;
    game.u.ustuck = worm;
    const meat = await knownObject(MEATBALL, {});
    unlinkObject(meat, game);
    pushKeys(' ');

    await dropObjectAtHero(meat);

    assert.equal(meat.where, 'gone');
    assert.equal(worm.minvent.includes(meat), false);
});

void test('a dropped cockatrice corpse petrifies its engulfer and gives the hero kill credit', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const worm = await createMonsterAt(PURPLE_WORM, 11, 10);
    await installSwallowedHero(worm);
    const x = worm.mx, y = worm.my;
    const corpse = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    pushKeys(' '.repeat(20));

    await dropObjectAtHero(corpse);

    assert.equal(game.u.uswallow, 0);
    assert.equal(worm.dead, true);
    assert.equal(game.u.uconduct.killer, 1);
    assert.equal(corpse.where, 'gone');
    const statue = floorObjectsAt(level, x, y).find(object => object.otyp === STATUE);
    assert.ok(statue, 'the engulfer leaves a statue at its original square');
    assert.equal(statue.contents?.includes(corpse) ?? false, false);
});

// Non-food dropped while swallowed joins the swallower's pack.
void test('dropped junk while swallowed joins the swallower pack', async () => {
    freshObjectRoom({ gameplaySeed: 64 });
    requirePlayingGame(game);
    const worm = await createMonsterAt(PURPLE_WORM, game.u.ux, game.u.uy);
    game.u.uswallow = 1;
    game.u.ustuck = worm;
    const gem = await knownObject(OBJECT_NAMES.indexOf('diamond'), {});
    unlinkObject(gem, game);

    await dropObjectAtHero(gem);

    assert.ok(worm.minvent.includes(gem));
});

// C dothrow.c:610-613: soft terrain or water bypasses breakage outright.
void test('hitfloor over a pool drops without impact breakage', async () => {
    freshObjectRoom({ gameplaySeed: 65 });
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    const flask = await knownObject(POT_OIL);
    unlinkObject(flask, game);

    const returned = await hitFloorWithObject(flask);

    assert.equal(returned, flask);
    assert.equal(flask.otyp, POT_OIL);
    assert.equal(flask.where, 'floor');
    assert.ok(floorObjectsAt(game.level, game.u.ux, game.u.uy).includes(flask));
});

// C dothrow.c:616-639: the verbose landing line names the surface, or the
// seen trap's edge.
void test('hitfloor names the seen pit edge', async () => {
    freshObjectRoom({ gameplaySeed: 66 });
    requirePlayingGame(game);
    addTrap(game.level, PIT, game.u.ux, game.u.uy, { tseen: true });
    const gem = await knownObject(OBJECT_NAMES.indexOf('diamond'), {});
    unlinkObject(gem, game);
    game._pending_message = '';
    pushKeys('        ');

    await hitFloorWithObject(gem);

    // the verbose landing line names the pit's edge; the floor effects then
    // settle the gem into the pit
    assert.match(game._pending_message, /edge of the pit|tumbles into the pit/);
    assert.equal(gem.where, 'floor');
});
