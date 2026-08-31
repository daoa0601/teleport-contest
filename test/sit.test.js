import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { CREAM_PIE } from '../js/object_data.js';
import { freshWeaponArena } from './support/weapon-arena.js';

test('sitting on cream pies crushes the whole floor stack', async () => {
    const level = freshWeaponArena();
    const pies = {
        otyp: CREAM_PIE,
        oclass: 7,
        name: 'cream pie',
        plural: 'cream pies',
        quan: 2,
        quantity: 2,
        ox: 10,
        oy: 10,
        where: 'floor',
    };
    level.objects[10] = [];
    level.objects[10][10] = [pies];
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.equal(level.objects[10][10].includes(pies), false);
    assert.match(game._pending_message, /Squelch!/);
});
