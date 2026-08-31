import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { WAN_FIRE, WAN_SLEEP } from '../js/object_data.js';
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

test('a fire ray burns a monster in its path', async () => {
    freshWeaponArena();
    game.u.fireResistance = true;
    game.u.uhp = game.u.uhpmax = 100;
    const monster = {
        mnum: 0,
        m_id: 9001,
        mx: 11,
        my: 10,
        mac: 100,
        m_lev: 1,
        mhp: 100,
        mhpmax: 100,
        msleeping: 1,
        mstrategy: 0x20000000,
        minvent: [],
        inventory: [],
    };
    game.level.monsters = [monster];
    const wand = {
        otyp: WAN_FIRE,
        invlet: 'a',
        name: 'fire',
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
    pushKey('l');
    for (let count = 0; count < 30; count++) pushKey(' ');

    await rhack('z'.charCodeAt(0));

    assert.ok(monster.mhp < 100);
    assert.equal(monster.msleeping, 0);
    assert.equal(wand.typeKnown, true);
    assert.equal(game.context.move, 1);
});
