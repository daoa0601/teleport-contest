import test from 'node:test';
import assert from 'node:assert/strict';
import { MARK } from '../js/const.js';
import { makeEngravingAt } from '../js/engrave.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { levelTeleport } from '../js/level_teleport.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createStaffedShop } from './support/shop.js';

void test('level teleport announces materialization before reading an arrival engraving', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.debug = true;
    destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
    game.level = destination;
    makeEngravingAt(13, 10, 'Beware the monsters lurking below.', null, 0, MARK);
    game.level = source;
    const input = resetInputState();

    await answerPrompts(levelTeleport(), input, [
        { prompt: /To what level do you want to teleport\?/, keys: '2\r' },
        { prompt: /You materialize on a different level!--More--/, keys: ' ' },
        { prompt: /There's some graffiti on the floor here\.--More--/, keys: ' ' },
    ]);

    assert.equal(game.level, destination);
    assert.equal(game.u.uz.dlevel, 2);
    assert.equal(game._pending_message, 'You read: "Beware the monsters lurking below."');
});

void test('level teleport announces materialization before the shopkeeper welcomes the hero', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.debug = true;
    destination.downTeleportRegion = { lx: 13, ly: 10, hx: 13, hy: 10 };
    game.level = destination;
    game.u.uz = { dnum: 0, dlevel: 2 };
    const { shopkeeper } = await createStaffedShop({ left: 12, right: 16, keeperX: 15 });
    game.level = source;
    game.u.uz = { dnum: 0, dlevel: 1 };
    const input = resetInputState();

    await answerPrompts(levelTeleport(), input, [
        { prompt: /To what level do you want to teleport\?/, keys: '2\r' },
        { prompt: /You materialize on a different level!--More--/, keys: ' ' },
    ]);

    assert.equal(game.level, destination);
    assert.match(game._pending_message, /Welcome to/);
    assert.equal(shopkeeper.eshk.visitct, 1);
});
