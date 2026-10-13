import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { MOD_ENCUMBER, Upolyd } from '../js/const.js';
import { regenerateHeroHp } from '../js/hero_regeneration.js';
import { initRng } from '../js/rng.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';

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
