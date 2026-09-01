import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    SPE_SLOW_MONSTER, WAN_SPEED_MONSTER,
} from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { castKnownSpell } from '../js/spell.js';
import { dozap } from '../js/zap.js';
import { freshWeaponArena } from './support/weapon-arena.js';

const PM_JACKAL = 12;

function addJackal({ peaceful = false, speed = 0 } = {}) {
    const monster = {
        m_id: 801,
        mnum: PM_JACKAL,
        mx: 12, my: 10,
        m_lev: 1,
        mhp: 8, mhpmax: 8,
        mpeaceful: peaceful ? 1 : 0,
        mtame: 0,
        msleeping: 0,
        mcanmove: 1,
        permspeed: speed,
        mspeed: speed,
        minvent: [], inventory: [],
    };
    game.level.monsters.push(monster);
    return monster;
}

function slowMonsterSpell() {
    return {
        name: 'slow monster', otyp: SPE_SLOW_MONSTER,
        level: 2, category: 'enchantment', fail: 0,
    };
}

test('a speed-monster wand hastens a peaceful target without angering it',
    async () => {
        freshWeaponArena();
        const monster = addJackal({ peaceful: true });
        const wand = {
            otyp: WAN_SPEED_MONSTER,
            name: 'speed monster',
            oclass: 11,
            invlet: 'a',
            spe: 2,
            charges: { current: 2, recharged: 0 },
            quan: 1,
            quantity: 1,
            dknown: true,
        };
        game.inventory = [wand];
        pushKeys('al');

        await dozap();

        assert.equal(monster.mspeed, 2);
        assert.equal(monster.mpeaceful, 1);
        assert.equal(wand.spe, 1);
        assert.equal(wand.typeKnown, true);
    });

test('slow monster removes permanent speed and angers a peaceful target',
    async () => {
        freshWeaponArena();
        game.u.ulevel = 8;
        game.u.uen = 30;
        const monster = addJackal({ peaceful: true, speed: 2 });
        pushKeys('l');

        await castKnownSpell(slowMonsterSpell());

        assert.equal(monster.mspeed, 0);
        assert.equal(monster.mpeaceful, 0);
        assert.equal(game.context.move, 1);
    });

test('slow monster aimed at yourself removes intrinsic speed', async () => {
    freshWeaponArena();
    game.u.ulevel = 8;
    game.u.uen = 30;
    grantIntrinsicProperty('fast', 'role', game);
    pushKeys('.');

    await castKnownSpell(slowMonsterSpell());

    assert.equal(game.u.fast, false);
    assert.equal(game.u.veryFast, false);
    assert.equal(game.context.move, 1);
});

test('a speed-monster wand aimed down hastens the hero\'s mount', async () => {
    freshWeaponArena();
    const steed = addJackal();
    game.u.usteed = steed;
    const wand = {
        otyp: WAN_SPEED_MONSTER,
        name: 'speed monster',
        oclass: 11,
        invlet: 'a',
        spe: 2,
        charges: { current: 2, recharged: 0 },
        quan: 1,
        quantity: 1,
        dknown: true,
    };
    game.inventory = [wand];
    pushKeys('a>');

    await dozap();

    assert.equal(steed.mspeed, 2);
    assert.equal(wand.charges.current, 1);
});
