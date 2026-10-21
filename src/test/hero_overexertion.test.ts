import { addInventoryObject } from './support/game-objects.js';
import type { InitializedHero } from '../js/hero_types.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { checkHeroAttackOverexertion } from '../js/hero_overexertion.js';
import { resetInputState } from '../js/input.js';
import { BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { nearCapacity } from '../js/weight.js';
import { freshGame } from './support/game-state.js';
import { freshPlayableRoom } from './support/playable-room.js';

async function burdenHero(hero: Partial<InitializedHero> = {}) {
    freshGame({
        hero,
        moves: 1,
    });
    requireFixtureGame(game);
    initRng(1n);
    await addInventoryObject(BOULDER);
    initRng(4500);
    game._encumbranceLevel = nearCapacity(game);
}

void test('every attack charges metabolism without hurting an unburdened hero', async () => {
    freshGame({ hero: { uhunger: 900, uhp: 5 } });
    requireFixtureGame(game);
    initRng(4500);

    const stopped = await checkHeroAttackOverexertion();

    assert.equal(stopped, false);
    assert.equal(game.u.uhunger, 899);
    assert.equal(game.u.uhp, 5);
});

void test('heavy exertion costs one active-form hit point and the attack continues', async () => {
    await burdenHero({ uhunger: 900, uhp: 5 });
    requireFixtureGame(game);

    const stopped = await checkHeroAttackOverexertion();

    assert.equal(stopped, false);
    assert.equal(game.u.uhunger, 899);
    assert.equal(game.u.uhp, 4);
});

// C hack.c overexert_hp(): fall_asleep(-10, FALSE) leaves the ordinary
// You_can_move_again recovery message rather than "You wake up."
void test('heavy exertion at one hit point makes the hero pass out', async () => {
    await burdenHero({ uhunger: 900, uhp: 1 });
    requireFixtureGame(game);

    const stopped = await checkHeroAttackOverexertion();

    assert.equal(stopped, true);
    assert.equal(game.u.uhp, 1);
    assert.equal(game._helplessTurns, 10);
    assert.equal(game._helplessDoneMessage, 'You can move again.');
    assert.match(game._pending_message, /pass out from exertion/);
});


void test('heavy-load damage still occurs when the hero is already helpless', async () => {
    await burdenHero({ uhunger: 900, uhp: 5 });
    requireFixtureGame(game);
    game._helplessTurns = 1;

    const stopped = await checkHeroAttackOverexertion();

    assert.equal(stopped, true);
    assert.equal(game.u.uhp, 4);
});

void test('every third move skips the heavy-load hit point penalty', async () => {
    await burdenHero({ uhunger: 900, uhp: 1 });
    requireFixtureGame(game);
    game.moves = 3;

    const stopped = await checkHeroAttackOverexertion();

    assert.equal(stopped, false);
    assert.equal(game.u.uhp, 1);
    assert.equal(game._helplessTurns ?? 0, 0);
});

void test('a polymorphed hero loses monster-form hit points', async () => {
    await burdenHero({
        uhunger: 900, umonnum: 159, mtimedone: 20,
        mh: 3, mhmax: 3, uhp: 5,
    });
    requireFixtureGame(game);

    const stopped = await checkHeroAttackOverexertion();

    assert.equal(stopped, false);
    assert.equal(game.u.mh, 2);
    assert.equal(game.u.uhp, 5);
});

void test('passing out waits for the changed-load message before helplessness starts',
    { timeout: 2000 }, async () => {
        freshPlayableRoom({
            hero: { uhunger: 900, uhp: 1 },
            });
        requireFixtureGame(game);
        await addInventoryObject(BOULDER);
        game._encumbranceLevel = 0;
        const input = resetInputState();

        const attack = checkHeroAttackOverexertion();
        const phase = await Promise.race([
            input.waitUntilBlocked().then(() => 'pager'),
            attack.then(() => 'finished'),
        ]);

        let stopped;
        try {
            assert.equal(phase, 'pager', 'the new load must page the exertion message');
            assert.equal(game._helplessTurns ?? 0, 0);
            assert.match(game._pending_message, /pass out from exertion/);
        } finally {
            if (phase === 'pager') input.feed(' ');
            stopped = await attack;
        }
        assert.equal(stopped, true);
        assert.equal(game._helplessTurns, 10);
        assert.match(game._pending_message, /can't even move a handspan/);
    });
