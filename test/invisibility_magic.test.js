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
    addInventoryObject, chargedWand,
} from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshCasterRoom } from './support/hero-state.js';
import { freshGameplayRoom } from './support/playable-room.js';

test('drinking an invisibility potion makes the hero invisible', async () => {
    freshGameplayRoom();
    const potion = addInventoryObject(POT_INVISIBILITY, {
        initialize: false,
        invlet: 'a',
    });
    pushKeys('a');

    await rhack('q'.charCodeAt(0));

    assert.equal(game.u.invisible, true);
    assert.ok(game.u.invisibleTurns > 100);
    assert.equal(game.inventory.includes(potion), false);
});

test('the invisibility spell affects the hero without asking for a direction',
    async () => {
        freshCasterRoom();

        await castKnownSpell({
            name: 'invisibility',
            otyp: SPE_INVISIBILITY,
            level: 5,
            category: 'escape',
            skill: 'expert',
        });

        assert.equal(game.u.invisible, true);
        assert.ok(game.u.invisibleTurns > 100);
        assert.equal(game.u.uen, 15);
        assert.equal(game.context.move, 1);
    });

test('a make-invisible wand turns a visible monster transparent', async () => {
    freshGameplayRoom();
    game.u.seeInvisible = true;
    const monster = await createMonsterAt('jackal', 12, 10);
    const wand = chargedWand(WAN_MAKE_INVISIBLE, { charges: 2 });
    game.inventory = [wand];
    pushKeys('al');

    await dozap();

    assert.equal(monster.minvis, 1);
    assert.equal(wand.typeKnown, true);
    assert.equal(wand.charges.current, 1);
});
