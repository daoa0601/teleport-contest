import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { MENU_TRADITIONAL } from '../js/const.js';
import { CHEST, CLUB } from '../js/object_data.js';
import { addObjectToContainer } from '../js/object_container.js';
import { enableRngLog, getRngLog } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createStaffedShop } from './support/shop.js';

void test('opening a nonempty shop container chooses one hallucinated owner for its question', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    await createStaffedShop({ keeperX: 14 });
    const chest = await floorObject(CHEST, 10, 10, {
        initialize: false, olocked: false, otrapped: false, cknown: true,
    });
    await addObjectToContainer(chest, await knownObject(CLUB, { initialize: false }));
    game.u.hallucinationTurns = 20;
    const input = resetInputState();
    enableRngLog();

    await answerPrompts(runExtendedCommand('loot'), input, [
        { prompt: /Do what with .*'s chest\?/, keys: 'q' },
    ]);

    // Native shkname() chooses a shop type and a name for the displayed owner.
    assert.equal(getRngLog().length, 2, 'A nonempty chest has no empty feedback to name');
    assert.equal(chest.contents?.length, 1);
});

