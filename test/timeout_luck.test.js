import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { FULL_MOON, NEW_MOON } from '../js/const.js';
import { game } from '../js/gstate.js';
import { LUCKSTONE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireFixtureGame } from './support/game-state.js';
import { installPagerInput } from './support/pager-input.js';
for (const scenario of [
    { name: 'ordinary good luck', luck: 4, expected: 3 },
    { name: 'ordinary bad luck', luck: -4, expected: -3 },
    { name: 'uncursed stone preserves good luck', luck: 4, stone: 'uncursed', expected: 4 },
    { name: 'uncursed stone preserves bad luck', luck: -4, stone: 'uncursed', expected: -4 },
    { name: 'blessed stone preserves good luck', luck: 4, stone: 'blessed', expected: 4 },
    { name: 'blessed stone allows bad luck recovery', luck: -4, stone: 'blessed', expected: -3 },
    { name: 'cursed stone allows good luck decay', luck: 4, stone: 'cursed', expected: 3 },
    { name: 'cursed stone preserves bad luck', luck: -4, stone: 'cursed', expected: -4 },
]) {
    void test(`luck timeout: ${scenario.name}`, async () => {
        const input = freshTurnRoom({ flags: { moonphase: NEW_MOON, friday13: false } });
        if (scenario.stone)
            await addInventoryObject(LUCKSTONE, {
                initialize: false,
                blessed: scenario.stone === 'blessed', cursed: scenario.stone === 'cursed',
            });
        game.moves = 599;
        game.u.uluck = scenario.luck;
        input.feed('..');
        await moveloop_core();
        await moveloop_core();
        assert.equal(game.moves, 600);
        assert.equal(game.u.uluck, scenario.expected);
    });
}
void test('luck recovers during prayer toward the calendar baseline', async () => {
    const input = freshTurnRoom({ flags: { moonphase: FULL_MOON, friday13: false } });
    game.moves = 599;
    game.u.uluck = 0;
    game.u.invulnerable = true;
    input.feed('..');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u.uluck, 1);
});
for (const cause of ['amulet', 'anger']) {
    void test(`${cause} makes luck recover at 300 turns`, async () => {
        const input = freshTurnRoom({ flags: { moonphase: NEW_MOON, friday13: false } });
        requireFixtureGame(game);
        installPagerInput(input, { expected: /./, limit: 4 });
        game.moves = 299;
        game.u.uluck = -2;
        if (cause === 'amulet') {
            game.u.uhave.amulet = true;
            game.u.uevent = { amulet_wish: 1 };
        }
        else
            game.u.ugangr = 1;
        input.feed('..');
        await moveloop_core();
        await moveloop_core();
        assert.equal(game.u.uluck, -1);
    });
}
//# sourceMappingURL=timeout_luck.test.js.map