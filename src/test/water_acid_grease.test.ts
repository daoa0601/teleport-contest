import assert from 'node:assert/strict';
import test from 'node:test';
import { POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { POT_ACID, SACK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { dropInventoryObject, runExtendedCommand } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('luck cannot save contained acid when dipping washes its grease off', async () => {
    freshObjectRoom({ hero: { uluck: 13 } });
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    const sack = await addInventoryObject(SACK);
    const acid = await knownObject(POT_ACID, { greased: true });
    await addCreatedObjectToContainer(sack, acid);
    resetInputState();
    initRng(4n);

    await runExtendedCommand('dip', sack.invlet + 'y' + ' '.repeat(20));

    assert.equal(acid.greased, false);
    assert.equal(acid.where, 'gone');
    assert.equal(sack.contents?.includes(acid), false);
    assert.match(game._pending_message, /A potion of acid explodes!/);
    assert.equal(game.u.uhp, 40);
    assert.equal(game.context.move, 1);
});

void test('luck cannot save dropped acid when a pool washes its grease off', async () => {
    freshObjectRoom({ hero: { uluck: 13 } });
    requirePlayingGame(game);
    const location = game.level.requireAt(game.u.ux, game.u.uy);
    location.typ = POOL;
    const acid = await addInventoryObject(POT_ACID, { greased: true });
    resetInputState();
    initRng(4n);

    await dropInventoryObject(acid, ' '.repeat(20));

    assert.equal(acid.greased, false);
    assert.equal(acid.where, 'gone');
    assert.equal(game.level.objects[game.u.ux]?.[game.u.uy]?.includes(acid) ?? false, false);
    assert.match(game._pending_message, /A potion of acid explodes!/);
    assert.equal(game.u.uhp, 40);
    assert.equal(game.context.move, 1);
});
