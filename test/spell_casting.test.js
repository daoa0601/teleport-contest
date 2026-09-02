import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { SPE_HASTE_SELF } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { castKnownSpell } from '../js/spell.js';
import { freshGame } from './support/game-state.js';

function freshCaster() {
    freshGame({
        role: 'wizard',
        hero: {
            ulevel: 8,
            uen: 40,
            ualign: { type: 0, record: 0 },
        },
        moves: 40,
        context: {},
        flags: {},
    });
    initRng(701n);
}

test('haste self makes the hero very fast without asking for a direction',
    async () => {
        freshCaster();
        const spell = {
            name: 'haste self', otyp: SPE_HASTE_SELF,
            level: 3, category: 'escape', skill: 'skilled', fail: 0,
        };

        await castKnownSpell(spell);

        assert.equal(game.u.veryFast, true);
        assert.ok(game.u.veryFastTurns >= 160);
        assert.ok(game.u.veryFastTurns <= 169);
        assert.equal(game.u.uen, 25);
        assert.equal(game.context.move, 1);
    });
