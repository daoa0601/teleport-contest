import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { ALTAR, W_AMUL } from '../js/const.js';
import { AMULET_OF_LIFE_SAVING, CLUB, CORPSE } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('blind pickup on an altar introduces touch inspection without repeating the altar', async () => {
    const level = freshPlayableRoom({ hero: { blindTurns: 10 } });
    level.requireAt(10, 10).typ = ALTAR;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
        invlet: 'a', worn: true, owornmask: W_AMUL,
    });
    game.uamul = game.u.uamul = amulet;
    const club = await floorObject(CLUB, 10, 10);
    await floorObject(CORPSE, 10, 10, { corpsenm: 10 });
    const input = resetInputState();
    const operation = rhack(','.charCodeAt(0));
    await input.waitUntilBlocked();
    const message = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('');
    assert.ok(message);
    assert.match(message, /You try to feel what is here\./);
    input.feed(' '.repeat(12));
    await operation;
    assert.equal(game.inventory.includes(club), false);
    assert.equal(amulet.where, 'gone');
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=pickup_blind_altar.test.js.map