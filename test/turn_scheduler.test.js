import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { GameDisplay } from '../js/game_display.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { POT_PARALYSIS } from '../js/object_data.js';
import {
    startHeroSickness, startHeroVomiting,
} from '../js/hero_illness.js';
import { startHeroSliming } from '../js/slime.js';
import { startHeroPetrification } from '../js/stoning.js';
import { carriedObject } from './support/game-objects.js';
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
        game.inventory = [carriedObject(POT_PARALYSIS, {
            name: 'potion of paralysis',
            plural: 'potions of paralysis',
        })];
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

test('poison clouds act after old blindness expires for the turn', async () => {
    const inputGate = freshTurnArena();
    game.u.uhp = game.u.uhpmax = 40;
    game.u.blindTurns = 1;
    game.blind = true;
    game.level.regions = [{
        kind: 'gas-cloud',
        visible: true,
        damage: 8,
        ttl: 3,
        heroFault: false,
        cells: [{ x: game.u.ux, y: game.u.uy }],
    }];
    pushKeys('.   ');

    const returnedToInput = await runUntilInput(inputGate, 6);

    assert.equal(returnedToInput, true);
    assert.ok(game.u.uhp < 40);
    assert.equal(game.u.blindTurns, 1);
    assert.equal(game.blind, true);
    assert.equal(game.level.regions[0].ttl, 2);
});

test('slime infection advances during an ordinary world turn', async () => {
    const inputGate = freshTurnArena();
    startHeroSliming({ state: game, turns: 7, killer: 'green slime' });
    pushKeys('h');

    await moveloop_core();
    const nextInput = moveloop_core();
    await inputGate.waitUntilBlocked();

    assert.equal(game.u.slimedTurns, 6);
    assert.match(game._pending_message, /Your limbs are getting oozy\.$/);
    pushKeys(' ');
    await nextInput;
});

test('petrification advances during an ordinary world turn', async () => {
    const inputGate = freshTurnArena();
    startHeroPetrification({ state: game, killer: 'cockatrice egg' });
    pushKeys('h');

    await moveloop_core();
    const nextInput = moveloop_core();
    await inputGate.waitUntilBlocked();

    assert.equal(game.u.stonedTurns, 4);
    assert.match(game._pending_message, /You are slowing down\.$/);
    pushKeys(' ');
    await nextInput;
});

test('fatal sickness advances during an ordinary world turn', async () => {
    const inputGate = freshTurnArena();
    startHeroSickness({
        state: game,
        turns: 7,
        cause: 'rotted goblin corpse',
    });
    pushKeys('h');

    await moveloop_core();
    const nextInput = moveloop_core();
    await inputGate.waitUntilBlocked();

    assert.equal(game.u.sickTurns, 6);
    assert.match(game._pending_message, /Your sickness feels worse\.$/);
    pushKeys(' ');
    await nextInput;
});

test('nausea advances before sickness during an ordinary world turn',
    async () => {
        const inputGate = freshTurnArena();
        startHeroVomiting({ state: game, turns: 15 });
        startHeroSickness({
            state: game,
            turns: 7,
            cause: 'tainted meat',
        });
        pushKeys('h');

        await moveloop_core();
        const nextInput = moveloop_core();
        await inputGate.waitUntilBlocked();

        assert.equal(game.u.vomitingTurns, 14);
        assert.equal(game.u.sickTurns, 6);
        assert.match(
            game._pending_message,
            /mildly nauseated.*sickness feels worse/,
        );
        pushKeys(' ');
        await nextInput;
    });
