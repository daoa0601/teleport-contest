import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ARROW, DAGGER, POT_OIL } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const blind of [false, true]) {
    void test(`oil dipping names arrows without their count when ${blind ? 'felt' : 'seen'}`, async () => {
        freshObjectRoom({ hero: { blindTurns: blind ? 20 : 0 } });
        requirePlayingGame(game);
        const arrows = await addInventoryObject(ARROW, { quan: 12, oeroded: 2 });
        const oil = await addInventoryObject(POT_OIL);
        resetInputState();

        await runExtendedCommand('dip', arrows.invlet + oil.invlet + ' '.repeat(20));

        assert.ok(game._pending_message.includes(blind ? 'Your arrows feel oily.'
            : 'Your arrows gleam with an oily sheen.'), game._pending_message);
        assert.equal(arrows.quan, 12);
        assert.equal(arrows.oeroded, 2, 'Oil does not repair ammunition.');
        assert.equal(game.inventory.includes(oil), false);
    });

    void test(`oil repair names a dagger stack without its count when ${blind ? 'felt' : 'seen'}`, async () => {
        freshObjectRoom({ hero: { blindTurns: blind ? 20 : 0 } });
        requirePlayingGame(game);
        const daggers = await addInventoryObject(DAGGER, { quan: 3, oeroded: 2, oeroded2: 3 });
        const oil = await addInventoryObject(POT_OIL);
        resetInputState();

        await runExtendedCommand('dip', daggers.invlet + oil.invlet + ' '.repeat(20));

        assert.ok(game._pending_message.includes(`Your daggers ${blind ? 'feel' : 'are'} less corroded and rusty.`),
            game._pending_message);
        assert.equal(daggers.quan, 3);
        assert.equal(daggers.oeroded, 1);
        assert.equal(daggers.oeroded2, 2);
        assert.equal(game.inventory.includes(oil), false);
    });
}

void test('a single oiled dagger uses a singular verb', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    const oil = await addInventoryObject(POT_OIL);
    resetInputState();

    await runExtendedCommand('dip', dagger.invlet + oil.invlet + ' '.repeat(20));

    assert.match(game._pending_message, /Your dagger gleams with an oily sheen\./);
});
