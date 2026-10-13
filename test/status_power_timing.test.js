import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, flush_screen, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { drainHeroEnergy } from '../js/hero_energy.js';
import { useHeroBreath } from '../js/hero_breath_command.js';
import { useHeroMindBlast } from '../js/hero_mind_blast.js';
import { resetInputState } from '../js/input.js';
import { POT_GAIN_ENERGY } from '../js/object_data.js';
import { applyPotionEffect } from '../js/potion_effects.js';
import { knownObject } from './support/game-objects.js';
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
void test('breath displays its power cost at the direction prompt even when cancelled', async () => {
    freshMonsterAbilityRoom('red dragon', { energy: 30 });
    await bot();
    const input = resetInputState();
    const breathing = useHeroBreath();
    await input.waitUntilBlocked();
    const promptPower = requireScreenRow(23).map(cell => cell.ch).join('');
    input.feed('\x1b');
    const result = await breathing;
    await flush_screen(1);
    assert.equal(game.u.uen, 15);
    assert.equal(result.spentTime, false);
    assert.match(promptPower, /Pw:15\(30\)/);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Pw:15\(30\)/);
});
for (const blessing of ['blessed', 'uncursed', 'cursed']) {
    void test(`a ${blessing} gain-energy potion displays its changed current and maximum power`, async () => {
        freshObjectRoom({ hero: { uen: 10, uenmax: 30 } });
        requirePlayingGame(game);
        const potion = await knownObject(POT_GAIN_ENERGY, {
            blessed: blessing === 'blessed', cursed: blessing === 'cursed',
        });
        await bot();
        await applyPotionEffect(potion);
        await flush_screen(1);
        assert.ok(blessing === 'cursed' ? game.u.uenmax < 30 : game.u.uenmax > 30);
        assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), new RegExp(`Pw:${game.u.uen}\\(${game.u.uenmax}\\)`));
    });
}
//# sourceMappingURL=status_power_timing.test.js.map