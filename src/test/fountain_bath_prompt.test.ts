import test from 'node:test';
import assert from 'node:assert/strict';
import { FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

void test('the urge to bathe needs no extra dismissal when the hero has no gold to lose', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const rock = await addInventoryObject(ROCK);
    resetInputState().display = {
        async readKey() { assert.fail(`Unexpected input after dipping: ${game._pending_message}`); },
    };
    initRng(52n);

    await runExtendedCommand('dip', rock.invlet + 'y');

    assert.match(game._pending_message, /An urge to take a bath overwhelms you/);
    assert.equal(game.context.move, 1);
});
