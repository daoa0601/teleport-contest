import test from 'node:test';
import assert from 'node:assert/strict';
import { POOL, W_ARM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { CHAIN_MAIL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

void test('water sitting wets exposed armor after an earlier unarmored sit', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = POOL;
    const armor = await addInventoryObject(CHAIN_MAIL, { blessed: false });
    initRng(49n);

    await runExtendedCommand('sit');
    game.uarm = game.u.uarm = armor;
    armor.owornmask = W_ARM;
    await runExtendedCommand('sit', ' '.repeat(10));

    assert.equal(armor.oeroded, 1);
    assert.match(game._pending_message, /Your armor rusts!/);
    assert.equal(game.context.move, 1);
});
