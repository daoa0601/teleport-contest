import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AXE, BOULDER, PICK_AXE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { placeCreatedObject } from '../js/floor_object.js';

// C dig.c use_pick_axe2(): whacking a boulder with an applied axe throws
// sparks, and one blow in three vibrates the handle hard enough to hurt.
void test('an applied axe sparks against a boulder and may bruise its wielder', async () => {
    const expectations = [
        [1n, 'Sparks fly as you whack the boulder.  The axe-handle vibrates violently!', 38],
        [2n, 'Sparks fly as you whack the boulder.', 40],
    ] as const;
    for (const [seed, message, hp] of expectations) {
        freshObjectRoom();
        const boulder = await knownObject(BOULDER);
        placeCreatedObject(boulder, 11, 10, game);
        const axe = await addInventoryObject(AXE, { spe: 0 });
        game.uwep = game.u.uwep = axe;
        const input = resetInputState();
        input.display = { async readKey() { return ' '.charCodeAt(0); } };
        input.feed(`${axe.invlet}l`);
        initRng(seed);

        await rhack('a'.charCodeAt(0));

        assert.equal(game._pending_message, message);
        assert.equal(game.u.uhp, hp);
        assert.ok(!game._occupation, 'Sparks must not start a dig occupation.');
    }
});

// C dig.c use_pick_axe2(): an underwater hero cannot dig at all.
void test('an underwater hero cannot dig sideways', async () => {
    for (const tool of [PICK_AXE, AXE] as const) {
        freshObjectRoom();
        game.u.uinwater = 1;
        const item = await addInventoryObject(tool, { spe: 0 });
        game.uwep = game.u.uwep = item;
        const input = resetInputState();
        input.feed(`${item.invlet}l`);

        await rhack('a'.charCodeAt(0));

        assert.equal(game._pending_message,
            `Turbulence torpedoes your ${tool === PICK_AXE ? 'digging' : 'chopping'} attempts.`);
        assert.ok(!game._occupation, 'Underwater turbulence must not start a dig.');
    }
});
