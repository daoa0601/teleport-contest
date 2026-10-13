import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { grantIntrinsicProperty, refreshProperty } from '../js/properties.js';
import { MOD_ENCUMBER, Upolyd } from '../js/const.js';
import { regenerateHeroHp } from '../js/hero_regeneration.js';
import { initRng } from '../js/rng.js';
import { ROCK } from '../js/object_data.js';
import { nearCapacity } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

void test('landing with a stressed load still allows HP recovery for the airborne turn', async () => {
    let recovered = 0;
    for (let seed = 1n; seed <= 8n; seed++) {
        const input = freshTurnRoom({ heroLevel: 30, seed });
        requirePlayingGame(game);
        game.u.uhp = 100;
        game.u.uhpmax = 500;
        await addInventoryObject(ROCK, { quan: 100, initialize: false });
        game.u.levitationTurns = 1;
        refreshProperty('levitation');
        assert.ok(nearCapacity(game) < MOD_ENCUMBER);
        installPagerInput(input, {
            expected: /float gently to the floor|rebalance your load/,
            limit: 2,
        });
        input.feed('l');
        await moveloop_core();

        await finishAtCommandInput(input, () => moveloop_core(),
            /float gently to the floor|rebalance your load/);

        assert.equal(game.u.levitating, false);
        assert.equal(nearCapacity(game), MOD_ENCUMBER);
        recovered += game.u.uhp - 100;
    }
    assert.ok(recovered > 0, 'An injured moving hero can heal on the turn levitation expires');
});

void test('landing with a stressed load still allows energy recovery for the airborne turn', async () => {
    const input = freshTurnRoom({ role: 'wizard', heroLevel: 30, moves: 3, energy: 20 });
    requirePlayingGame(game);
    game.u.uen = 5;
    await addInventoryObject(ROCK, { quan: 100, initialize: false });
    game.u.levitationTurns = 1;
    refreshProperty('levitation');
    assert.ok(nearCapacity(game) < MOD_ENCUMBER);
    installPagerInput(input, {
        expected: /float gently to the floor|rebalance your load/,
        limit: 2,
    });
    input.feed('l');
    await moveloop_core();

    await finishAtCommandInput(input, () => moveloop_core(),
        /float gently to the floor|rebalance your load/);

    assert.equal(game.u.levitating, false);
    assert.equal(nearCapacity(game), MOD_ENCUMBER);
    assert.ok(game.u.uen > 5, 'Energy recovery uses the load measured before landing');
});

void test('Regeneration adds healing to ordinary human recovery rather than replacing it', async () => {
    const input = freshTurnRoom({ heroLevel: 30, seed: 3n });
    requirePlayingGame(game);
    game.level.flags.rndmongen = false;
    game.flags.safe_wait = false;
    game.u.uhp = 100;
    game.u.uhpmax = 500;
    grantIntrinsicProperty('regeneration', 'outside');
    const moves = game.moves;
    input.feed('m.'.repeat(12));

    for (let i = 0; i < 12; i++) await moveloop_core();

    assert.ok(game.u.uhp - 100 > game.moves - moves,
        `Regeneration and ordinary healing restored ${game.u.uhp - 100} HP over ${game.moves - moves} turns`);
});

void test('a moving stressed hero cannot recover ordinary HP', async () => {
    freshObjectRoom({ hero: { uhp: 20, uhpmax: 40, umoved: true } });
    initRng(17n);

    for (let turn = 1; turn <= 20; turn++) await regenerateHeroHp(MOD_ENCUMBER, turn);

    assert.equal(game.u.uhp, 20);
});

void test('sleepiness supplies two points of sleeping recovery despite movement encumbrance', async () => {
    freshObjectRoom({ hero: { uhp: 20, uhpmax: 40, umoved: true, usleep: 1 } });
    requirePlayingGame(game);
    grantIntrinsicProperty('sleepy', 'outside');
    initRng(17n);

    await regenerateHeroHp(MOD_ENCUMBER, 1);

    assert.ok(game.u.uhp >= 22 && game.u.uhp <= 23);
});

void test('a dry eel loses HP without drying to death or healing at the twentieth turn', async () => {
    freshObjectRoom();
    installPolymorphedHero('giant eel', { hitPoints: 10, maxHitPoints: 20 });
    initRng(17n);

    for (let turn = 1; turn <= 80; turn++) await regenerateHeroHp(0, turn);

    assert.equal(game.u.mh, 1);
    assert.equal(Upolyd(game.u), true);
});
