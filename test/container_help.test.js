import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CHEST, CLUB } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { answerPrompts } from './support/input-boundaries.js';
void test('container help describes the actions and returns to the action prompt without spending time', async () => {
    freshPlayableRoom();
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a', initialize: false, olocked: false, cknown: true,
    });
    const club = await knownObject(CLUB, { where: 'contained', container: chest });
    chest.contents = [club];
    const input = resetInputState();
    await answerPrompts(applyInventoryObject(chest, '?'), input, [
        { prompt: /Container actions:[\s\S]*Reversed: put things in, then take things out/, keys: ' ' },
        { prompt: /Do what with/, keys: 'q' },
    ]);
    assert.equal(chest.contents.includes(club), true);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=container_help.test.js.map