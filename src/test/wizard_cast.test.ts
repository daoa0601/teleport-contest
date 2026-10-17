import test from 'node:test';
import assert from 'node:assert/strict';
import { P_ESCAPE_SPELL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { ensureHeroSkills } from '../js/skills.js';
import { runExtendedCommand } from './support/commands.js';
import { freshCasterRoom } from './support/hero-state.js';

void test('wizard casting reaches an unknown spell on the second page without energy or practice', async () => {
    freshCasterRoom({ flags: { debug: true }, energy: 0 });
    requirePlayingGame(game);
    game.spells = [];
    const skills = ensureHeroSkills(game);
    assert.ok(skills);
    const practice = skills[P_ESCAPE_SPELL]?.advance;
    assert.ok(practice !== undefined);
    const hunger = game.u.uhunger;

    // The second page starts with charm monster, then haste self.
    await runExtendedCommand('wizcast', ' b');

    assert.equal(game.u.veryFast, true);
    assert.equal(game.u.uen, 0);
    assert.equal(game.u.uhunger, hunger);
    assert.equal(game.spells.length, 0);
    assert.equal(skills[P_ESCAPE_SPELL]?.advance, practice);
    assert.equal(game.context.move, 1);
});

void test('cancelling wizard casting spends no time', async () => {
    freshCasterRoom({ flags: { debug: true } });
    requirePlayingGame(game);

    await runExtendedCommand('wizcast', '\x1b');

    assert.equal(game.context.move, 0);
    assert.equal(game.u.uen, 40);
});
