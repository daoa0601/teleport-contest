import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { SPE_HASTE_SELF } from '../js/object_data.js';
import { castKnownSpell } from '../js/spell.js';
import { freshCasterRoom } from './support/hero-state.js';

test('haste self makes the hero very fast without asking for a direction',
    async () => {
        freshCasterRoom({ gameplaySeed: 701n });
        const spell = {
            name: 'haste self', otyp: SPE_HASTE_SELF,
            level: 3, category: 'escape', skill: 'skilled',
        };

        await castKnownSpell(spell);

        assert.equal(game.u.veryFast, true);
        assert.ok(game.u.veryFastTurns >= 160);
        assert.ok(game.u.veryFastTurns <= 169);
        assert.equal(game.u.uen, 25);
        assert.equal(game.context.move, 1);
    });
