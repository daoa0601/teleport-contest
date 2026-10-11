import { createSaddledSteed } from './support/monsters.js';
import type { InventoryObjectOverrides } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { W_ARM } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import {
    CLUB, LOADSTONE, SCR_REMOVE_CURSE,
} from '../js/object_data.js';
import { removeCurseEffect } from '../js/scroll_effects.js';
import {
    addInventoryObject, knownObject,
} from './support/game-objects.js';
import {
    installHeroChainedToBuriedBall, installPunishedHero,
} from './support/hero-state.js';
import { freshGameplayRoom } from './support/playable-room.js';

void test('remove curse releases a buried ball beside the hero at its original square', async () => {
    const level = freshGameplayRoom();
    const x = game.u.ux - 1;
    const y = game.u.uy;
    const ball = await installHeroChainedToBuriedBall({ x, y });

    await removeCurseEffect();

    assert.equal(game.u.utrap, 0);
    assert.ok(floorObjectsAt(level, x, y).includes(ball));
    assert.ok(level.buriedObjects != null);
    assert.equal(level.buriedObjects.includes(ball), false);
});

async function addCursedObject(otyp: number, invlet: string, overrides: InventoryObjectOverrides = {}) {
    return await addInventoryObject(otyp, {
        invlet, cursed: true, blessed: false, buc: 'cursed', ...overrides,
    });
}

void test('remove curse affects worn items and loadstones, not the whole pack', async () => {
    freshGameplayRoom();
    const worn = await addCursedObject(CLUB, 'a', { owornmask: W_ARM });
    const loadstone = await addCursedObject(LOADSTONE, 'b');
    const carried = await addCursedObject(CLUB, 'c');

    await removeCurseEffect({
        source: await knownObject(SCR_REMOVE_CURSE, { initialize: false }),
    });

    assert.equal(worn.cursed, false);
    assert.equal(loadstone.cursed, false);
    assert.equal(carried.cursed, true);
});

void test('a blessed remove curse affects the whole pack and ends punishment', async () => {
    freshGameplayRoom();
    const carried = await addCursedObject(CLUB, 'a');

    const { ball, chain } = await installPunishedHero();

    await removeCurseEffect({
        source: { otyp: SCR_REMOVE_CURSE, blessed: true },
    });

    const pile = floorObjectsAt(requireGameLevel(), game.u.ux, game.u.uy);
    assert.equal(carried.cursed, false);
    assert.equal(game.u.punished, false);
    assert.equal(pile.includes(ball), true);
    assert.equal(pile.includes(chain), false);
});

void test('confused remove curse leaves existing curses and punishment in place', async () => {
    freshGameplayRoom();
    const worn = await addCursedObject(CLUB, 'a', {
        owornmask: W_ARM, bknown: true,
    });
    await installPunishedHero();

    await removeCurseEffect({
        source: await knownObject(SCR_REMOVE_CURSE, { initialize: false }), confused: true,
    });

    assert.equal(worn.cursed, true);
    assert.equal(worn.bknown, false);
    assert.equal(game.u.punished, true);
});

void test('remove curse also frees a steed from its cursed saddle', async () => {
    freshGameplayRoom();
    const steed = await createSaddledSteed('pony', {
        saddle: { cursed: true, blessed: false, buc: 'cursed', bknown: true },
    });
    const saddle = steed.saddle;
    assert.ok(saddle);
    game.u.usteed = steed;
    const messages: string[] = [];

    await removeCurseEffect({
        source: await knownObject(SCR_REMOVE_CURSE, { initialize: false }),
        publish: async message => messages.push(message),
    });

    assert.equal(saddle.cursed, false);
    assert.equal(saddle.bknown, true);
    assert.equal(messages.at(-1), "Your pony's saddle glows amber.");
});


void test('cursed remove curse releases punishment without uncursing possessions', async () => {
    freshGameplayRoom();
    const carried = await addCursedObject(CLUB, 'a');
    await installPunishedHero();

    await removeCurseEffect({ source: { otyp: SCR_REMOVE_CURSE, cursed: true } });

    assert.equal(carried.cursed, true);
    assert.equal(game.u.punished, false);
});
