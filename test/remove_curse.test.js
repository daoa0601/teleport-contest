import test from 'node:test';
import assert from 'node:assert/strict';

import { W_ARM, W_SADDLE } from '../js/const.js';
import { game } from '../js/gstate.js';
import {
    CLUB, LOADSTONE, SCR_REMOVE_CURSE,
} from '../js/object_data.js';
import { removeCurseEffect } from '../js/read.js';
import {
    addInventoryObject, knownObject,
} from './support/game-objects.js';
import {
    installHeroChainedToBuriedBall, installPunishedHero,
} from './support/hero-state.js';
import { freshGameplayRoom } from './support/playable-room.js';

test('remove curse releases a buried ball beside the hero at its original square', async () => {
    const level = freshGameplayRoom();
    const x = game.u.ux - 1;
    const y = game.u.uy;
    const ball = installHeroChainedToBuriedBall({ x, y });

    await removeCurseEffect();

    assert.equal(game.u.utrap, 0);
    assert.ok(level.objects[x][y].includes(ball));
    assert.equal(level.buriedObjects.includes(ball), false);
});

function addCursedObject(otyp, invlet, overrides = {}) {
    return addInventoryObject(otyp, {
        invlet, cursed: true, blessed: false, buc: 'cursed', ...overrides,
    });
}

test('remove curse affects worn items and loadstones, not the whole pack', async () => {
    freshGameplayRoom();
    const worn = addCursedObject(CLUB, 'a', { owornmask: W_ARM });
    const loadstone = addCursedObject(LOADSTONE, 'b');
    const carried = addCursedObject(CLUB, 'c');

    await removeCurseEffect({
        source: { otyp: SCR_REMOVE_CURSE },
    });

    assert.equal(worn.cursed, false);
    assert.equal(loadstone.cursed, false);
    assert.equal(carried.cursed, true);
});

test('a blessed remove curse affects the whole pack and ends punishment', async () => {
    freshGameplayRoom();
    const carried = addCursedObject(CLUB, 'a');

    const { ball, chain } = installPunishedHero();

    await removeCurseEffect({
        source: { otyp: SCR_REMOVE_CURSE, blessed: true },
    });

    const pile = game.level.objects[game.u.ux][game.u.uy];
    assert.equal(carried.cursed, false);
    assert.equal(game.u.punished, false);
    assert.equal(pile.includes(ball), true);
    assert.equal(pile.includes(chain), false);
});

test('confused remove curse leaves existing curses and punishment in place', async () => {
    freshGameplayRoom();
    const worn = addCursedObject(CLUB, 'a', {
        owornmask: W_ARM, bknown: true,
    });
    installPunishedHero();

    await removeCurseEffect({
        source: { otyp: SCR_REMOVE_CURSE }, confused: true,
    });

    assert.equal(worn.cursed, true);
    assert.equal(worn.bknown, false);
    assert.equal(game.u.punished, true);
});

test('remove curse also frees a steed from its cursed saddle', async () => {
    freshGameplayRoom();
    const saddle = knownObject(CLUB, {
        where: 'minvent', cursed: true, blessed: false,
        buc: 'cursed', owornmask: W_SADDLE, bknown: true,
    });
    game.u.usteed = { minvent: [saddle] };
    const messages = [];

    await removeCurseEffect({
        source: { otyp: SCR_REMOVE_CURSE },
        publish: async message => messages.push(message),
    });

    assert.equal(saddle.cursed, false);
    assert.equal(saddle.bknown, true);
    assert.equal(messages.at(-1), 'The saddle glows amber.');
});
