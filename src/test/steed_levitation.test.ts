import type { RngSeed } from '../js/rng.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DISMOUNT_POLY, PIT, TT_PIT,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { dismountHero, stuckSteed } from '../js/steed.js';
import { copyPersistentState } from '../js/state_schema.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const DIAMOND = OBJECT_NAMES.indexOf('diamond');
// dismountHero(DISMOUNT_POLY) lands the hero south of the pony (deterministic
// with the seeded rooms below); the pony keeps the hero's old square.

async function mountedPony(seed: RngSeed) {
    freshObjectRoom({ gameplaySeed: seed });
    requirePlayingGame(game);
    const pony = await createMonsterAt('pony', 11, 10);
    game.u.usteed = pony;
    // landingSpot() breaks equal-distance ties with the game RNG; re-seed
    // after monster creation so the descent square is deterministic.
    initRng(BigInt(seed));
    pushKeys('     ');
    return pony;
}

// C steed.c:808-812: the dismount tail runs float_down(0, W_SADDLE); the
// saddle bit suppresses float_down's own landing message, and the descent
// owns the pickup that spoteffects deferred while dismounting.
void test('dismount descends without the float message and picks up the floor', async () => {
    await mountedPony(41);
    requirePlayingGame(game);
    // seed 41 lands the hero north of the pony
    const gem = await floorObject(DIAMOND, 10, 9);
    game.flags.pickup = true;

    const result = await dismountHero(DISMOUNT_POLY);

    assert.equal(result.dismounted, true);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 9]);
    assert.doesNotMatch(game._pending_message || '', /float gently/);
    assert.match(game._pending_message || '', /can no longer ride/);
    assert.ok(game.inventory.includes(gem));
    // C decl.c initializes in_steed_dismounting FALSE; the finally-tail
    // restores the lowered state rather than deleting the flag.
    assert.equal(game._steedDismounting, false);
});

// C float_down(): another levitation source returns early, so a rider with
// own levitation stays airborne after the saddle is gone.
void test('own levitation keeps the hero aloft through a dismount', async () => {
    await mountedPony(42);
    requirePlayingGame(game);
    grantIntrinsicProperty('levitation', 'outside');
    const gem = await floorObject(DIAMOND, 10, 11);
    game.flags.pickup = true;
    addTrap(game.level, PIT, 10, 11);

    const result = await dismountHero(DISMOUNT_POLY);

    assert.equal(result.dismounted, true);
    assert.equal(game.u.levitating, true);
    assert.equal(game.u.utrap, 0);
    assert.ok(!game.inventory.includes(gem));
});

// C steed.c dismount + hack.c:3355: spoteffects defers its trap while
// dismounting; float_down's own dotrap fires exactly once at the landing.
void test('the deferred trap fires once through the descent', async () => {
    await mountedPony(43);
    requirePlayingGame(game);
    addTrap(game.level, PIT, 10, 11, { tseen: true });

    const result = await dismountHero(DISMOUNT_POLY);

    assert.equal(result.dismounted, true);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 11]);
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) > 0);
});

// C steed.c:875-895 stucksteed(): helpless and mid-meal steeds refuse to
// move; holding traps are not consulted.
void test('stuckSteed reports a helpless or eating steed', async () => {
    freshObjectRoom({ gameplaySeed: 45 });
    requirePlayingGame(game);
    assert.equal(await stuckSteed(), false); // not riding

    const pony = await createMonsterAt('pony', 11, 10);
    game.u.usteed = pony;
    game._pending_message = '';
    assert.equal(await stuckSteed(), false);
    assert.equal(game._pending_message, '');

    pony.msleeping = 1;
    assert.equal(await stuckSteed(), true);
    assert.match(game._pending_message, /Your pony won't move!/);

    pony.msleeping = 0;
    pony.meating = 5;
    game._pending_message = '';
    assert.equal(await stuckSteed(), true);
    assert.match(game._pending_message, /Your pony is still eating\./);
    game._pending_message = '';
    assert.equal(await stuckSteed(false), false);
    assert.equal(game._pending_message, '');
});

// C decl.c in_steed_dismounting: never saved; the schema classifies the
// port's transient flag so copyPersistentState cannot throw on it.
void test('the dismounting flag is transient save state', () => {
    freshObjectRoom({ gameplaySeed: 44 });
    requirePlayingGame(game);
    game._steedDismounting = true;
    const snapshot = copyPersistentState(game);
    assert.equal('_steedDismounting' in snapshot, false);
    game._steedDismounting = false;
});
