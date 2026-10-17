import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { finishHeroHelplessness } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { heroGazeAttack, useHeroGaze } from '../js/hero_gaze.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
function gaze(options = {}) {
    return useHeroGaze({
        state: game,
        attack: heroGazeAttack(game),
        publish: async () => undefined,
        ...options,
    });
}
void test('an umber hulk uses #monster to confuse a visible monster', async () => {
    freshMonsterAbilityRoom('umber hulk', { energy: 30 });
    requireFixtureGame(game);
    const jackal = await createMonsterAt('jackal', 11, 10);
    await runMonsterAbilityCommand(' '.repeat(6));
    assert.equal(jackal.mconf, 1);
    assert.equal(game.u.uen, 15);
    assert.equal(game.context.move, 1);
});
void test('a blind hero cannot use a gaze attack', async () => {
    freshMonsterAbilityRoom('umber hulk', {
        energy: 30,
        polymorph: { blindTurns: 3 },
    });
    requireFixtureGame(game);
    await createMonsterAt('jackal', 11, 10);
    const result = await gaze();
    assert.equal(result.reason, 'blind');
    assert.equal(result.spentTime, false);
    assert.equal(game.u.uen, 30);
});
void test('a pyrolisk fiery gaze burns a monster', async () => {
    freshMonsterAbilityRoom('pyrolisk', { energy: 30 });
    requireFixtureGame(game);
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mhp = jackal.mhpmax = 12;
    await gaze({
        random: () => 19,
        rollDice: () => 4,
    });
    assert.equal(jackal.mhp, 8);
    assert.equal(game.u.uen, 15);
});
void test('gazing at a floating eye can freeze the hero', async () => {
    freshMonsterAbilityRoom('umber hulk', { energy: 30 });
    requireFixtureGame(game);
    const eye = await createMonsterAt('floating eye', 11, 10);
    eye.m_lev = 2;
    const result = await gaze({ rollDice: () => 9 });
    assert.ok('stopped' in result && result.stopped);
    assert.equal(game._helplessTurns, 9);
    assert.equal(game._helplessReason, "frozen by a monster's gaze");
    await finishHeroHelplessness();
    assert.match(game._pending_message, /You can move again\./);
});
void test('a gaze reaches the newest monster first and spares a pet', async () => {
    freshMonsterAbilityRoom('umber hulk', { energy: 30 });
    requireFixtureGame(game);
    const pet = await createMonsterAt('jackal', 11, 10);
    pet.mtame = 10;
    const newt = await createMonsterAt('newt', 9, 10);
    const messages = [];
    await gaze({ publish: async (message) => { messages.push(message); } });
    assert.deepEqual(messages, [
        'Your gaze confuses the newt!',
        'You avoid gazing at your jackal.',
    ]);
    assert.equal(newt.mconf, 1);
    assert.ok(!pet.mconf);
});
//# sourceMappingURL=hero_gaze.test.js.map