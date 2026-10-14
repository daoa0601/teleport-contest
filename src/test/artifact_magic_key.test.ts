import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { untrap } from '../js/untrap.js';
import { artifactObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { DOOR, D_CLOSED, D_TRAPPED, D_NODOOR } from '../js/const.js';
import { grantIntrinsicProperty } from '../js/properties.js';

void test('a cursed Master Key cannot overcome a rogue fumbling while untrapping a door', async () => {
    const level = freshObjectRoom({ role: 'rogue', gameplaySeed: 1n,
        hero: { ualign: { type: -1, record: 10 }, ulevel: 30, uhp: 200, uhpmax: 200 } });
    requirePlayingGame(game);
    grantIntrinsicProperty('fumbling', 'outside', game);
    const key = await artifactObject('The Master Key of Thievery', {
        invlet: 'a', where: 'inventory', cursed: true,
    });
    game.inventory = [key];
    const door = level.requireAt(game.u.ux + 1, game.u.uy);
    door.typ = DOOR;
    door.doormask = D_CLOSED | D_TRAPPED;

    await untrap({
        chooseDirection: async () => ({ key: 'l', dx: 1, dy: 0, dz: 0 }),
        ask: async () => 'y', random: () => 0, publish: async () => {},
    });

    assert.equal(door.doormask, D_NODOOR, 'The failed disarm sets off and destroys the door');
    assert.ok(game.u.uhp < 200);
});
