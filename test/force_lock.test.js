import test from 'node:test';
import assert from 'node:assert/strict';

import { continueCountedCommand, rhack } from '../js/cmd.js';
import { W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { CHEST, DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import {
    floorObject, inventoryObject,
} from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';

test('a blade can break while prying a chest lock', async () => {
    freshGameplayRoom();
    const dagger = inventoryObject(DAGGER, 'a', {
        spe: 0,
        cursed: false,
        wielded: true,
        owornmask: W_WEP,
    });
    const chest = floorObject(CHEST, 10, 10, {
        olocked: true,
        obroken: false,
        contents: [],
    });
    game.inventory = [dagger];
    game.uwep = game.u.uwep = dagger;
    initRng(46n);
    pushKeys('force\ny');

    await rhack('#'.charCodeAt(0));
    await continueCountedCommand(game);

    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(game.uwep, null);
    assert.match(game._pending_message, /Your dagger broke!.*give up/);
});
