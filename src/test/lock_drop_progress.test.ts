import assert from 'node:assert/strict';
import test from 'node:test';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { DOOR, D_LOCKED } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { CHEST, CLUB, CREDIT_CARD, LOADSTONE, TOWEL } from '../js/object_data.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

for (const action of ['picking', 'forcing'] as const) {
    for (const successfulDrop of [true, false]) {
        void test(`${successfulDrop ? 'dropping an item clears' : 'a refused drop preserves'} interrupted ${action} progress`, async () => {
            const level = freshObjectRoom({ hero: { acurr: { a: [18, 3, 18, 18, 18, 18] } } });
            const door = level.requireAt(11, 10);
            door.typ = DOOR;
            door.doormask = D_LOCKED;
            const chest = action === 'forcing' ? await floorObject(CHEST, 10, 10, { olocked: true }) : null;
            const tool = await addInventoryObject(action === 'picking' ? CREDIT_CARD : CLUB, { invlet: 'a' });
            if (action === 'forcing') game.uwep = game.u.uwep = tool;
            const dropped = await addInventoryObject(successfulDrop ? TOWEL : LOADSTONE, { invlet: 'b', cursed: !successfulDrop });
            const input = resetInputState();
            pushKeys(action === 'picking' ? 'al' : 'force\n');
            await answerPrompts(rhack((action === 'picking' ? 'a' : '#').charCodeAt(0)), input, [
                { prompt: action === 'picking' ? /Unlock it\?/ : /force its lock\?/, keys: 'y' },
            ]);
            initRng(1n);
            await continueCountedCommand();
            assert.equal(action === 'picking' ? door.doormask : chest?.olocked, action === 'picking' ? D_LOCKED : true);
            await stopHeroOccupation();
            await answerPrompts(flushPendingTopline(), input, [{ prompt: /--More--/, keys: ' ' }]);

            pushKeys('b');
            await rhack('d'.charCodeAt(0));
            assert.equal(game.inventory.includes(dropped), !successfulDrop);
            assert.equal(game.context.move, successfulDrop ? 1 : 0);
            await answerPrompts(flushPendingTopline(), input, [{ prompt: /--More--/, keys: ' ' }]);
            pushKeys(action === 'picking' ? 'a' : 'force\n');
            await answerPrompts(rhack((action === 'picking' ? 'a' : '#').charCodeAt(0)), input, successfulDrop ? [
                ...(action === 'picking' ? [{ prompt: /In what direction\?/, keys: 'l' }] : []),
                { prompt: action === 'picking' ? /Unlock it\?/ : /force its lock\?/, keys: 'n' },
            ] : []);

            if (successfulDrop) assert.equal(game._occupation, null);
            else {
                assert.equal(game._occupation?.key, action === 'picking' ? 'pick-lock' : 'force-lock');
                assert.match(game._pending_message, /You resume your attempt/);
            }
        });
    }
}
