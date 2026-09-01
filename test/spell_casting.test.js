import test from 'node:test';
import assert from 'node:assert/strict';

import { game, resetGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { SPE_HASTE_SELF } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { castKnownSpell } from '../js/spell.js';

function freshCaster() {
    resetGame();
    resetInputState();
    game.urole = { key: 'wizard' };
    game.u = {
        ulevel: 8,
        uen: 40,
        uhunger: 900,
        ualign: { type: 0, record: 0 },
    };
    game.moves = 40;
    game.context = {};
    game.flags = {};
    game.inventory = [];
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
