import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { encumber_msg } from '../js/pickup.js';
import { ROCK } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { nearCapacity } from '../js/hack.js';
// C pickup.c:encumber_msg() uses stagger(youmonst.data, "stagger") and
// marks the status line for the next flush.
for (const [form, verb] of [
    ['human', 'stagger'],
    ['cobra', 'falter'],
    ['gray ooze', 'tremble'],
]) {
    void test(`a strained ${form} hero ${verb}s under a lightened load`, async () => {
        await freshObjectRoom();
        if (form !== 'human')
            installPolymorphedHero(form);
        while (nearCapacity(game) < 3)
            await addInventoryObject(ROCK);
        if (nearCapacity(game) !== 3)
            return assert.fail(`load ended at capacity ${nearCapacity(game)}`);
        game._encumbranceLevel = 4;
        game.context.botl = false;
        const messages = [];
        await encumber_msg(game, async (message) => { messages.push(message); });
        assert.deepEqual(messages, [`You ${verb} under your load.  Movement is still very hard.`]);
        assert.equal(game.context.botl, true);
    });
}
void test('a heavier load reports the new burden only once', async () => {
    await freshObjectRoom();
    while (nearCapacity(game) < 2)
        await addInventoryObject(ROCK);
    assert.equal(nearCapacity(game), 2, 'the rocks make movement difficult');
    game._encumbranceLevel = 0;
    game.context.botl = false;
    const messages = [];
    await encumber_msg(game, async (message) => { messages.push(message); });
    assert.equal(messages.length, 1);
    assert.equal(messages[0], 'You rebalance your load.  Movement is difficult.');
    assert.equal(game.context.botl, true);
    game.context.botl = false;
    await encumber_msg(game, async (message) => { messages.push(message); });
    assert.equal(messages.length, 1, 'an unchanged load produces no further notice');
    assert.equal(game.context.botl, false);
});
//# sourceMappingURL=encumbrance_form_verb.test.js.map