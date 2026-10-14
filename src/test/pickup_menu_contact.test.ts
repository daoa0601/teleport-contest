import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { pushKeys } from '../js/input.js';
import { W_AMUL } from '../js/const.js';
import { AMULET_OF_LIFE_SAVING, CLUB, CORPSE } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('blind pickup inspects a lethal corpse before allowing a choice from the pile', async () => {
    freshPlayableRoom();
    game.u.blindTurns = 10;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
        invlet: 'a', worn: true, owornmask: W_AMUL,
    });
    game.uamul = game.u.uamul = amulet;
    const club = await floorObject(CLUB, 10, 10);
    const corpse = await floorObject(CORPSE, 10, 10, { corpsenm: 10 });
    pushKeys('a\n' + ' '.repeat(12));

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(amulet), false);
    assert.equal(game.inventory.includes(club), false);
    assert.equal(corpse.where, 'floor');
    assert.equal(game.context.move, 0);
});
