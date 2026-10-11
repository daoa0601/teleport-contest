import { addTrap } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { PIT, TT_PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

const RIN_LEVITATION = OBJECT_NAMES.indexOf('levitation');

async function ringAbovePit() {
    freshObjectRoom();
    requirePlayingGame(game);
    addTrap(game.level, PIT, game.u.ux, game.u.uy, { tseen: true });
    return await addInventoryObject(RIN_LEVITATION, { invlet: 'a', dknown: true });
}

void test('putting on a levitation ring lifts the hero out of a pit', async () => {
    await ringAbovePit();
    game.u.utrap = 4;
    game.u.utraptype = TT_PIT;
    pushKeys('al     ');
    await rhack('P'.charCodeAt(0));
    assert.equal(game.u.utrap, 0);
    assert.equal(game.u.levitating, true);
});

void test('removing the last levitation ring drops the hero into the pit below', async () => {
    const ring = await ringAbovePit();
    await wearHeroAccessory(ring, 'uleft');
    pushKeys('a     ');
    await rhack('R'.charCodeAt(0));
    assert.equal(game.u.levitating, false);
    assert.ok(game.u.utrap !== undefined);
    assert.ok(game.u.utrap > 0);
    assert.equal(game.u.utraptype, TT_PIT);
});
