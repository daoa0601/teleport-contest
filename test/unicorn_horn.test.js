import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SICK_NONVOMITABLE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { UNICORN_HORN } from '../js/object_data.js';
import { useUnicornHorn } from '../js/unicorn_horn.js';
import { applyInventoryObject, runMonsterAbilityCommand, } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { freshPlayableRoom } from './support/playable-room.js';
async function freshHorn() {
    freshPlayableRoom({ seed: 1n });
    requirePlayingGame(game);
    game.context.move = 0;
    return await addInventoryObject(UNICORN_HORN);
}
void test('applying a unicorn horn uses a turn without consuming it', async () => {
    const horn = await freshHorn();
    requirePlayingGame(game);
    await applyInventoryObject(horn);
    assert.match(game._pending_message, /Nothing happens\.$/);
    assert.equal(game.context.move, 1);
    assert.equal(game.inventory.includes(horn), true);
});
void test('a unicorn form can use its natural horn', async () => {
    freshMonsterAbilityRoom('gray unicorn');
    requirePlayingGame(game);
    await runMonsterAbilityCommand();
    assert.match(game._pending_message, /Nothing happens\.$/);
    assert.equal(game.context.move, 1);
});
void test('an uncursed horn can cure several timed ailments', async () => {
    freshMonsterAbilityRoom('white unicorn');
    requirePlayingGame(game);
    game.u.sick = true;
    game.u.sickTurns = 20;
    game.u.sickType = SICK_NONVOMITABLE;
    game.u.sickCause = 'illness';
    game.u.confusionTurns = 12;
    const values = [1, 2];
    const result = await useUnicornHorn({
        state: game,
        publish: async () => undefined,
        random: range => {
            const value = values.shift();
            assert.ok(value != null, 'Expected value to be initialized');
            assert.ok(value >= 0 && value < range);
            return value;
        },
        rollDice: () => 4,
    });
    assert.deepEqual(result.cured.sort(), ['confusion', 'sickness']);
    assert.equal(game.u.sick, false);
    assert.equal(game.u.confusionTurns, 0);
});
void test('a cursed horn can blind its user', async () => {
    const horn = await freshHorn();
    requirePlayingGame(game);
    horn.cursed = true;
    const values = [5, 2];
    const messages = [];
    const result = await useUnicornHorn({
        object: horn,
        state: game,
        publish: async (message) => { messages.push(message); },
        random: range => {
            const value = values.shift();
            assert.ok(value != null, 'Expected value to be initialized');
            assert.ok(value >= 0 && value < range);
            return value;
        },
    });
    assert.equal(result.caused, 'blindness');
    assert.equal(game.u.blindTurns, 15);
    assert.equal(game.blind, true);
    assert.deepEqual(messages, ['A cloud of darkness falls upon you.']);
});
//# sourceMappingURL=unicorn_horn.test.js.map