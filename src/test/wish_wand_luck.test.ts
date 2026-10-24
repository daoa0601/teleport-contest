import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { APPLE, WAN_WISHING } from '../js/object_data.js';
import { installPagerInput } from './support/pager-input.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a luckstone lets an unlucky hero still use a wishing wand', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.uluck = -5;
    game.u.moreluck = 5;
    const wand = await addInventoryObject(WAN_WISHING, { spe: 2 });
    const input = resetInputState();
    installPagerInput(input, { expected: /wish|apple|materialize|Careful|floor/i, limit: 8 });
    input.feed(`${wand.invlet} apple\n`);

    await rhack('z'.charCodeAt(0));

    assert.equal(game.u.uconduct.wishes, 1);
    assert.ok(game.inventory.some(object => object.otyp === APPLE));
    assert.equal(wand.spe, 1);
});
