import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { TELEP_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { DIAMOND } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('normal ^T spends energy and nutrition after controlled teleport and pickup', async () => {
    freshObjectRoom({ flags: { tips: false, pickup: true }, hero: { ulevel: 12, uen: 50, uhunger: 900 } });
    requirePlayingGame(game);
    grantIntrinsicProperty('teleportation', 'outside');
    grantIntrinsicProperty('teleportControl', 'outside');
    const gem = await floorObject(DIAMOND, 12, 10);
    pushKeys('ll.' + ' '.repeat(20));

    await rhack(20);

    assert.equal(game.u.ux, 12);
    assert.equal(game.inventory.includes(gem), true);
    assert.equal(game.u.uen, 20);
    assert.equal(game.u.uhunger, 800);
    assert.equal(game.context.move, 1);
});

void test('normal ^T refuses insufficient energy without spending time or nutrition', async () => {
    freshObjectRoom({ hero: { ulevel: 12, uen: 29, uhunger: 900 } });
    grantIntrinsicProperty('teleportation', 'outside');

    await rhack(20);

    assert.match(game._pending_message, /You lack the energy to teleport\./);
    assert.equal(game.u.uen, 29);
    assert.equal(game.u.uhunger, 900);
    assert.equal(game.context.move, 0);
});

void test('normal ^T uses a seen fixed trap without intrinsic teleport or resource costs', async () => {
    const level = freshObjectRoom({ flags: { tips: false }, hero: { uen: 0, uhunger: 900 } });
    addTrap(level, TELEP_TRAP, 10, 10, { tseen: true, teledest: { x: 14, y: 10 } });
    pushKeys(' '.repeat(20));

    await rhack(20);

    assert.equal(game.u.ux, 14);
    assert.equal(game.u.uen, 0);
    assert.equal(game.u.uhunger, 900);
    assert.equal(game.context.move, 1);
});
