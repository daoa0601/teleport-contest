import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_MOAT, DRAWBRIDGE_UP, MOAT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { DIAMOND } from '../js/object_data.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const bridge of [false, true]) {
    void test(`a thrown gem splashes when landing in ${bridge ? 'water below a raised bridge' : 'a moat'}`, async () => {
        const level = freshObjectRoom({ right: 25 });
        const square = level.requireAt(16, 10);
        square.typ = bridge ? DRAWBRIDGE_UP : MOAT;
        square.drawbridgemask = DB_MOAT;
        const gem = await addInventoryObject(DIAMOND);

        await throwInventoryObject(gem, 'l', ' '.repeat(10));

        assert.equal(gem.ox, 16);
        assert.equal(gem.oy, 10);
        assert.match(game._pending_message, /Plop!/);
    });
}
