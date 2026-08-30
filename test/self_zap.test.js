import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { WAN_SLEEP } from '../js/object_data.js';
import { freshWeaponArena } from './support/weapon-arena.js';

test('sleep resistance prevents self-zap helplessness', async () => {
    freshWeaponArena();
    game.urole = { key: 'healer' };
    game.u.sleepResistance = true;
    const wand = {
        otyp: WAN_SLEEP,
        invlet: 'a',
        name: 'sleep',
        oclass: 11,
        quan: 1,
        quantity: 1,
        charges: { current: 3, recharged: 0 },
        spe: 3,
        dknown: true,
        bknown: true,
    };
    game.inventory = [wand];
    pushKey('a');
    pushKey('.');

    await rhack('z'.charCodeAt(0));

    assert.equal(wand.charges.current, 2);
    assert.equal(wand.typeKnown, true);
    assert.equal(game._helplessTurns, undefined);
    assert.equal(game._pending_message, "You don't feel sleepy!");
    assert.equal(game.context.move, 1);
});
