import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MENU_FULL, PARANOID_AUTOALL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { APPLE, CHEST, CLUB } from '../js/object_data.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('repeating container autoselection asks for confirmation again before moving items', async () => {
    const input = freshTurnRoom({ flags: { menu_style: MENU_FULL, paranoia_bits: PARANOID_AUTOALL } });
    const chest = await floorObject(CHEST, 10, 10, {
        initialize: false, olocked: false, otrapped: false, cknown: true,
    });
    for (const type of [CLUB, APPLE])
        await addCreatedObjectToContainer(chest, await knownObject(type, { where: 'free' }));
    input.feed('#loot\n');
    await answerPrompts(rhack(0), input, [
        { prompt: /Do what with/, keys: 'o' },
        { prompt: /Auto-select every relevant item/, keys: 'A\n' },
        { prompt: /Really autoselect All\?/, keys: 'y' },
    ]);
    assert.equal(chest.contents?.length, 0);
    const club = await knownObject(CLUB, { where: 'free' });
    const apple = await knownObject(APPLE, { where: 'free' });
    await addCreatedObjectToContainer(chest, club);
    await addCreatedObjectToContainer(chest, apple);
    input.feed('\x01');
    await answerPrompts(rhack(0), input, [
        { prompt: /Do what with/, keys: 'o' },
        { prompt: /Auto-select every relevant item/, keys: 'A\n' },
        { prompt: /Really autoselect All\?/, keys: 'q' },
    ]);
    assert.equal(chest.contents?.length, 2);
    assert.equal(club.where, 'contained');
    assert.equal(apple.where, 'contained');
    assert.equal(game.inventory.includes(club), false);
    assert.equal(game.inventory.includes(apple), false);
});
//# sourceMappingURL=container_repeat.test.js.map