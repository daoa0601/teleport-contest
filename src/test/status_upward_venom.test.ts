import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { useHeroSpit } from '../js/hero_spit.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { requireScreenRow } from './support/screen.js';

void test('venom falling onto a cobra hero displays its resulting blindness', async () => {
    freshMonsterAbilityRoom('cobra');
    await bot();

    await useHeroSpit({
        readDirection: async () => ({ key: '<', dx: 0, dy: 0, dz: -1 }),
        random: limit => limit === 5 ? 0 : 1, rollOne: () => 5,
        publish: async () => undefined,
    });
    await flush_screen(1);

    assert.equal(game.u.blindTurns, 5);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bBlind\b/);
});
