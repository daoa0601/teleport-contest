import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    POT_INVISIBILITY, SPE_INVISIBILITY, WAN_MAKE_INVISIBLE,
} from '../js/object_data.js';
import { castKnownSpell } from '../js/spell.js';
import { dozap } from '../js/zap.js';
import { freshWeaponArena } from './support/weapon-arena.js';

const PM_JACKAL = 12;

function carriedObject(otyp, oclass, name) {
    return {
        otyp,
        oclass,
        name,
        invlet: 'a',
        quan: 1,
        quantity: 1,
        spe: oclass === 11 ? 2 : undefined,
        charges: oclass === 11 ? { current: 2, recharged: 0 } : undefined,
        blessed: false,
        cursed: false,
        dknown: true,
        bknown: true,
    };
}

function addJackal() {
    const monster = {
        m_id: 901,
        mnum: PM_JACKAL,
        mx: 12,
        my: 10,
        m_lev: 1,
        mhp: 8,
        mhpmax: 8,
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

test('drinking an invisibility potion makes the hero invisible', async () => {
    freshWeaponArena();
    const potion = carriedObject(POT_INVISIBILITY, 8, 'invisibility');
    game.inventory = [potion];
    pushKeys('a');

    await rhack('q'.charCodeAt(0));

    assert.equal(game.u.invisible, true);
    assert.ok(game.u.invisibleTurns > 100);
    assert.equal(game.inventory.includes(potion), false);
});

test('the invisibility spell affects the hero without asking for a direction',
    async () => {
        freshWeaponArena();
        game.urole = { key: 'wizard' };
        game.u.ulevel = 8;
        game.u.uen = 40;

        await castKnownSpell({
            name: 'invisibility',
            otyp: SPE_INVISIBILITY,
            level: 5,
            category: 'escape',
            fail: 0,
        });

        assert.equal(game.u.invisible, true);
        assert.ok(game.u.invisibleTurns > 100);
        assert.equal(game.u.uen, 15);
        assert.equal(game.context.move, 1);
    });

test('a make-invisible wand turns a visible monster transparent', async () => {
    freshWeaponArena();
    game.u.seeInvisible = true;
    const monster = addJackal();
    const wand = carriedObject(
        WAN_MAKE_INVISIBLE, 11, 'make invisible',
    );
    game.inventory = [wand];
    pushKeys('al');

    await dozap();

    assert.equal(monster.minvis, 1);
    assert.equal(wand.typeKnown, true);
    assert.equal(wand.charges.current, 1);
});
