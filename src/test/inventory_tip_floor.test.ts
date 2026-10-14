import assert from 'node:assert/strict';
import test from 'node:test';
import { HOLE, MENU_TRADITIONAL, POOL, TRAPDOOR } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CHEST, SACK } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';

for (const location of ['underwater', 'hole', 'trapdoor']) {
    const position = location === 'underwater' ? 'underwater' : `over a seen ${location}`;
    void test(`traditional inventory tipping offers floor containers ${position}`, async t => {
        const level = freshObjectRoom({ flags: { menu_style: MENU_TRADITIONAL } });
        const { ux: x, uy: y } = game.u;
        if (location === 'underwater') {
            level.requireAt(x, y).typ = POOL;
            game.u.uinwater = true;
            game.underwater = false;
        } else {
            addTrap(level, location === 'hole' ? HOLE : TRAPDOOR, x, y, { tseen: true });
        }
        const carried = await addInventoryObject(SACK, { initialize: false, cknown: false });
        await floorObject(SACK, x, y, { initialize: false });
        const chest = await floorObject(CHEST, x, y, {
            initialize: false, olocked: false, cknown: false,
        });
        const input = resetInputState();
        planInput(input, t, [
            { prompt: /Tools/, keys: carried.invlet },
            { prompt: /T - Tip all the contents out of this container/, keys: 'T' },
            { prompt: /Tip which container\?[\s\S]*a - .*chest/, keys: 'a' },
            { prompt: /Where to tip the contents of .*chest/, keys: '\n' },
        ]);

        await rhack('i'.charCodeAt(0));
        await rhack(0);

        assert.equal(chest.cknown, true);
        assert.equal(carried.cknown, false);
        assert.equal(game._pending_message, 'The chest is empty.');
        assert.equal(game.context.move, 1);
    });
}
