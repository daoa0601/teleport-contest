import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { GameDisplay } from '../js/game_display.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { POT_PARALYSIS } from '../js/object_data.js';
import { freshWeaponArena } from './support/weapon-arena.js';

function freshTurnArena() {
    freshWeaponArena();
    game.nhDisplay = new GameDisplay(null);
    game.urole = { key: 'valkyrie' };
    game._moveloopStarted = true;
    game._maintenanceMove = 1;
    game._monsterMovementInitialized = true;
    game.u.umovement = 12;
    return resetInputState();
}

async function runUntilInput(inputGate, maxCycles) {
    const turns = (async () => {
        for (let cycle = 0; cycle < maxCycles; cycle++)
            await moveloop_core();
        return false;
    })();
    const inputNeeded = inputGate.waitUntilBlocked().then(() => true);
    return Promise.race([turns, inputNeeded]);
}

test('helplessness advances through live global turns',
    async () => {
        const inputGate = freshTurnArena();
        game.inventory = [{
            otyp: POT_PARALYSIS,
            invlet: 'a',
            name: 'potion of paralysis',
            plural: 'potions of paralysis',
            class: 'Potions',
            oclass: 8,
            quan: 1,
            quantity: 1,
            where: 'inventory',
            cursed: false,
            blessed: false,
            bknown: true,
            dknown: true,
        }];
        pushKeys('qa');

        const returnedToInput = await runUntilInput(inputGate, 60);

        assert.equal(returnedToInput, true);
        assert.equal(game._helplessTurns, 0);
        assert.match(game._pending_message, /You can move again\.$/);
    });

test('a burdened hero waits for a complete movement ration',
    async () => {
        const inputGate = freshTurnArena();
        // Strength 10 + Constitution 10 carries 550 units.  A 600-unit
        // payload is Burdened, so each global allocation grants 9 rather than
        // 12 movement points.  One wait therefore needs two world turns.
        game.inventory = [{
            otyp: -1,
            invlet: 'a',
            name: 'test payload',
            plural: 'test payloads',
            oclass: 0,
            quan: 1,
            quantity: 1,
            where: 'inventory',
            owt: 600,
        }];
        const before = { moves: game.moves, hunger: game.u.uhunger };
        pushKeys('.');

        const returnedToInput = await runUntilInput(inputGate, 4);

        assert.equal(returnedToInput, true);
        assert.equal(game.moves, before.moves + 2);
        assert.equal(game.u.uhunger, before.hunger - 2);
    });
