import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { slimeDialogue, startHeroSliming } from '../js/slime.js';
import { freshHeroConditionRoom } from './support/hero-state.js';
// C timeout.c slime_dialogue() names the hallucinated form with an(), so
// just_an()'s long-'u' and 'wun' exceptions apply to random monster names.
for (const [turns, form, expected] of [
    [3, 'unicorn pegasus kitten', 'You are turning into a unicorn pegasus kitten.'],
    [1, 'one-winged dewinged stab-bat', 'You have become a one-winged dewinged stab-bat.'],
    [3, 'umber hulk', 'You are turning into an umber hulk.'],
]) {
    void test(`hallucinated slime form takes the native article: ${form}`, async () => {
        freshHeroConditionRoom();
        game.u.hallucinationTurns = 100;
        startHeroSliming({ state: game, turns, killer: 'green slime' });
        const messages = [];
        await slimeDialogue({
            state: game,
            publish: async (message) => { messages.push(message); },
            randomMonsterName: () => form,
        });
        assert.ok(messages.includes(expected), messages.join(' | '));
    });
}
//# sourceMappingURL=article_checks.test.js.map