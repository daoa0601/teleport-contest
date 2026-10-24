import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { triggerHeroFireTrap } from '../js/fire_trap.js';
import { CHEST } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { freshObjectRoom } from './support/object-room.js';

// C trap.c:4246/4254 -> objnam.c:627-628: naming the box with the() runs
// xname(), which calls observe_object() when the hero is not blind, setting
// dknown and recording the discovery.
void test('a chest fire teaches the chest type to a sighted hero', async () => {
    freshObjectRoom({ hero: { uhp: 40, uhpmax: 40 } });
    requireFixtureGame(game);
    const box = await addInventoryObject(CHEST, { dknown: false, observed: false });

    await triggerHeroFireTrap(box, { publish: async () => {} });

    assert.equal(box.dknown, true, 'the burning chest becomes recognized');
});

void test('a blind hero keeps the burning chest unrecognized', async () => {
    freshObjectRoom({ hero: { uhp: 40, uhpmax: 40, blindTurns: 30 } });
    requireFixtureGame(game);
    const box = await addInventoryObject(CHEST, { dknown: false, observed: false });

    await triggerHeroFireTrap(box, { publish: async () => {} });

    assert.equal(box.dknown, false);
});
