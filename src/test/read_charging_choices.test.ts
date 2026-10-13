import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES, WAN_FIRE } from '../js/object_data.js';
import { readInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('choosing hands for a charging scroll mimes charging and still consumes the scroll', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    let answered = false;
    input.display = {
        async readKey() {
            if (/^What do you want to charge/.test(game._pending_message)) {
                const key = answered ? 27 : 45;
                answered = true;
                return key;
            }
            return 32;
        },
    };
    const scroll = await addInventoryObject(OBJECT_NAMES.indexOf('charging'), { typeKnown: true });
    const wand = await addInventoryObject(WAN_FIRE, { spe: 0 });

    await readInventoryObject(scroll);

    assert.equal(game._pending_message, 'You mime charging something.');
    assert.equal(wand.spe, 0);
    assert.equal(scroll.where, 'gone');
    assert.equal(game.context.move, 1);
});
