import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { ICE_BOX, OIL_LAMP, POT_OIL, WAX_CANDLE } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

for (const { name, type } of [{ name: 'an oil lamp', type: OIL_LAMP },
    { name: 'a potion of oil', type: POT_OIL }, { name: 'a wax candle', type: WAX_CANDLE }]) {
    void test(`refrigerating ${name} preserves its remaining fuel`, async () => {
        freshPlayableRoom();
        const box = await addInventoryObject(ICE_BOX, {
            invlet: 'a', cknown: true, olocked: false, otrapped: false, initialize: false,
        });
        const fuel = await addInventoryObject(type, { invlet: 'b', age: 500 });
        game.moves = 40;

        await applyInventoryObject(box, 'sb');

        assert.equal(box.contents?.includes(fuel), true, game._pending_message);
        assert.equal(fuel.age, 500);
        game.moves = 80;
        await applyInventoryObject(box, 'oa\n');
        assert.equal(fuel.age, 500);
        assert.equal(game.inventory.includes(fuel), true);
    });
}
