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
import {
    carriedObject, chargedWand,
} from './support/game-objects.js';
import { addMonster } from './support/monsters.js';
import { freshWeaponArena } from './support/weapon-arena.js';

const PM_JACKAL = 12;

function addJackal() {
    return addMonster({
        m_id: 901,
        mnum: PM_JACKAL,
        x: 12,
        y: 10,
        hitPoints: 8,
    });
}

test('drinking an invisibility potion makes the hero invisible', async () => {
    freshWeaponArena();
    const potion = carriedObject(POT_INVISIBILITY);
    game.inventory = [potion];
    pushKeys('a');

    await rhack('q'.charCodeAt(0));

    assert.equal(game.u.invisible, true);
    assert.ok(game.u.invisibleTurns > 100);
    assert.equal(game.inventory.includes(potion), false);
});

test('the invisibility spell affects the hero without asking for a direction',
    async () => {
        freshWeaponArena({ role: 'wizard', heroLevel: 8, energy: 40 });

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
    const wand = chargedWand(WAN_MAKE_INVISIBLE, { charges: 2 });
    game.inventory = [wand];
    pushKeys('al');

    await dozap();

    assert.equal(monster.minvis, 1);
    assert.equal(wand.typeKnown, true);
    assert.equal(wand.charges.current, 1);
});
