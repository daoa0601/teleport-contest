import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { drainHeroEnergy } from '../js/hero_energy.js';
import { useHeroMindBlast } from '../js/hero_mind_blast.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('a mind blast displays its power cost with its concentration feedback', async () => {
    freshMonsterAbilityRoom('mind flayer', { energy: 30 });
    await bot();

    await useHeroMindBlast();

    assert.equal(game.u.uen, 20);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Pw:20\(30\)/);
});

void test('energy drain displays the reduced power before its feedback', async () => {
    freshObjectRoom({ hero: { uen: 30, uenmax: 30 } });
    await bot();

    await plineWithContinuation(drainHeroEnergy(game, 5));

    assert.equal(game.u.uen, 25);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Pw:25\(30\)/);
});

void test('energy drain clears and displays residual power when the maximum is depleted', async () => {
    freshObjectRoom({ hero: { uen: 5, uenmax: 0 } });
    await bot();

    await plineWithContinuation(drainHeroEnergy(game, 5));

    assert.equal(game.u.uen, 0);
    assert.equal(game.u.uenmax, 0);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Pw:0\(0\)/);
});
