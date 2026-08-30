import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { GameDisplay } from '../js/game_display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { POT_PARALYSIS } from '../js/object_data.js';
import {
    roleOutcome,
} from './support/role-outcome.js';
import { freshWeaponArena } from './support/weapon-arena.js';

const valkyrieInput = input => ({
    role: 'Valkyrie', race: 'human', gender: 'female', align: 'lawful',
    datetime: '20260830110000',
    ...input,
});

function actorOutcomes(world) {
    return world.actors.map(actor => ({
        species: actor.species,
        position: actor.position,
        hp: actor.hp,
        inventory: actor.inventory,
    }));
}

function petlessValkyrieArena() {
    freshWeaponArena();
    game.nhDisplay = new GameDisplay(null);
    game.nhDisplay.onEmptyQueue = () => { throw new Error('input done'); };
    game.urole = { key: 'valkyrie' };
    game._moveloopStarted = true;
    game._maintenanceMove = 1;
    game._monsterMovementInitialized = true;
    game.u.umovement = 12;
}

async function runUntilInput(maxCycles) {
    for (let cycle = 0; cycle < maxCycles; cycle++) {
        try {
            await moveloop_core();
        } catch (error) {
            if (error.message !== 'input done') throw error;
            return true;
        }
    }
    return false;
}

test('save-blocked chat text cannot replace elapsed Valkyrie waits',
    async () => {
        // The save request blocks before the trailing bytes are commands.
        // Four preceding dots therefore keep the hero still while live actors
        // receive four ordinary turn allocations.
        const startup = await roleOutcome(valkyrieInput({
            seed: 27001,
            moves: ' ',
        }));
        const afterTurns = await roleOutcome(valkyrieInput({
            seed: 27001,
            moves: ' ....Syny#chat',
        }));

        assert.deepEqual(afterTurns.hero, startup.hero);
        assert.equal(afterTurns.moves, startup.moves + 4);
        assert.equal(afterTurns.heroMovement, 12);
        assert.notDeepEqual(
            actorOutcomes(afterTurns), actorOutcomes(startup),
        );
    });

test('petless Valkyrie helplessness advances through live global turns',
    async () => {
        // A level with no active actor used to fall from the Valkyrie-only
        // early-turn cases into fastforward_step(). That replay advanced RNG
        // and `moves` but not negative multi, so paralysis never recovered.
        petlessValkyrieArena();
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

        const returnedToInput = await runUntilInput(60);

        assert.equal(returnedToInput, true);
        assert.equal(game._helplessTurns, 0);
        assert.match(game._pending_message, /You can move again\.$/);
    });

test('burdened Valkyrie waits for a complete live movement ration',
    async () => {
        petlessValkyrieArena();
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

        const returnedToInput = await runUntilInput(4);

        assert.equal(returnedToInput, true);
        assert.equal(game.moves, before.moves + 2);
        assert.equal(game.u.uhunger, before.hunger - 2);
    });
