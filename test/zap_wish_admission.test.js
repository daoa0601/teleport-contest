import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { addFruit } from '../js/fruit.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BOULDER, ROCK, SLIME_MOLD, WAN_WISHING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPagerInput } from './support/pager-input.js';
import { freshObjectRoom } from './support/object-room.js';
void test('dropping a wished fruit stack keeps an already plural registered name', async () => {
    const level = freshObjectRoom({
        flags: { debug: true, verbose: false },
        hero: { fumblingTurns: 10 },
    });
    requirePlayingGame(game);
    const fruitId = addFruit('glorpberries');
    const wand = await addInventoryObject(WAN_WISHING, { spe: 2 });
    const input = resetInputState();
    input.feed(`${wand.invlet}2 glorpberries\n`);
    await rhack('z'.charCodeAt(0));
    assert.equal(game._pending_message, 'Oops!  The 2 glorpberries drop to the floor!');
    const fruit = level.objects[game.u.ux]?.[game.u.uy]?.find(object => object.otyp === SLIME_MOLD);
    assert.ok(fruit, 'The wished fruit must land on the floor.');
    assert.equal(fruit.quan, 2);
    assert.equal(fruit.spe, fruitId);
    assert.equal(wand.spe, 1);
});
for (const [request, type, hero] of [
    ['rock', ROCK, { fumblingTurns: 10 }],
    ['boulder', BOULDER, {}],
]) {
    void test(`a wishing wand leaves ${request} on the floor when the hero cannot hold it`, async () => {
        const level = freshObjectRoom({ hero });
        requirePlayingGame(game);
        const wand = await addInventoryObject(WAN_WISHING, { spe: 2 });
        const input = resetInputState();
        installPagerInput(input, { expected: /may wish|Oops!|Careful!|floor|materialize|drop/, limit: 8 });
        input.feed(`${wand.invlet} ${request}\n`);
        await rhack('z'.charCodeAt(0));
        assert.ok(!game.inventory.some(object => object.otyp === type));
        assert.ok(level.objects[10]?.[10]?.some(object => object.otyp === type));
        assert.equal(game.u.uconduct.wishes, 1);
        assert.equal(wand.spe, 1);
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=zap_wish_admission.test.js.map