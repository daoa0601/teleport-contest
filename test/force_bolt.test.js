import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { SPE_FORCE_BOLT, WAN_STRIKING } from '../js/object_data.js';
import { castKnownSpell } from '../js/spell.js';
import { dozap } from '../js/zap.js';
import { freshWeaponArena } from './support/weapon-arena.js';

const PM_JACKAL = 12;

function addJackal() {
    const monster = {
        m_id: 921,
        mnum: PM_JACKAL,
        mx: 12,
        my: 10,
        m_lev: 1,
        mac: 100,
        mhp: 100,
        mhpmax: 100,
        mpeaceful: 0,
        mtame: 0,
        msleeping: 0,
        mcanmove: 1,
        minvent: [],
        inventory: [],
    };
    game.level.monsters.push(monster);
    return monster;
}

test('force bolt damages a monster in its path', async () => {
    freshWeaponArena();
    game.urole = { key: 'wizard' };
    game.u.ulevel = 8;
    game.u.uen = 40;
    const monster = addJackal();
    pushKeys('l');

    await castKnownSpell({
        name: 'force bolt',
        otyp: SPE_FORCE_BOLT,
        level: 1,
        category: 'attack',
        fail: 0,
    });

    assert.ok(monster.mhp < 100);
    assert.equal(game.u.uen, 35);
    assert.equal(game.context.move, 1);
});

test('magic resistance bounces a self-zapped wand of striking', async () => {
    freshWeaponArena();
    game.u.antimagic = true;
    const startingHitPoints = game.u.uhp;
    const wand = {
        otyp: WAN_STRIKING,
        name: 'striking',
        oclass: 11,
        invlet: 'a',
        spe: 2,
        charges: { current: 2, recharged: 0 },
        quan: 1,
        quantity: 1,
        dknown: true,
    };
    game.inventory = [wand];
    pushKeys('a.');

    await dozap();

    assert.equal(game.u.uhp, startingHitPoints);
    assert.equal(wand.typeKnown, true);
    assert.equal(wand.charges.current, 1);
});
