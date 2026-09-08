import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { NEED_WEAPON, NO_MINVENT, NO_WEAPON_WANTED, PIT, POOL, STONE, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    AMULET_OF_STRANGULATION, CLUB, LONG_SWORD, OBJECT_NAMES, POT_PARALYSIS, WAN_MAGIC_MISSILE,
} from '../js/object_data.js';
import {
    startHeroSickness, startHeroVomiting,
} from '../js/hero_illness.js';
import { startHeroSliming } from '../js/slime.js';
import { startHeroPetrification } from '../js/stoning.js';
import { addInventoryObject, chargedWand, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { installSwallowedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { checkMonsterGearNextTurn } from '../js/monworn.js';
import { canSeeMonster } from '../js/display.js';

function freshTurnArena() {
    freshGameplayRoom();
    game.urole = { key: 'valkyrie' };
    game._moveloopStarted = true;
    game._maintenanceMove = 1;
    game._monsterMovementInitialized = true;
    game.u.umovement = 12;
    return resetInputState();
}

test('a giant chooses its club over a sword during its turn', async () => {
    freshTurnArena();
    const giant = await createMonsterAt('giant', 12, 10, NO_MINVENT);
    giant.mpeaceful = false;
    giant.movement = 12;
    giant.weaponCheck = NEED_WEAPON;
    addObjectToMonsterInventory(giant, knownObject(CLUB));
    addObjectToMonsterInventory(giant, knownObject(LONG_SWORD));
    pushKeys('.                                .');

    await moveloop_core();
    await moveloop_core();

    assert.equal(giant.mw?.otyp, CLUB);
});

test('a failed weapon switch costs the monster its turn and leaves its welded weapon held', async () => {
    freshTurnArena();
    const giant = await createMonsterAt('giant', 12, 10, NO_MINVENT);
    giant.mpeaceful = false;
    giant.movement = 12;
    giant.weaponCheck = NEED_WEAPON;
    const sword = equipMonsterObject(giant,
        knownObject(LONG_SWORD, { cursed: true, bknown: false }), W_WEP);
    addObjectToMonsterInventory(giant, knownObject(CLUB));
    const health = game.u.uhp;
    pushKeys('.                                .');

    await moveloop_core();
    await moveloop_core();

    assert.equal(giant.mw?.o_id, sword.o_id);
    assert.equal(sword.bknown, true);
    assert.equal(giant.weaponCheck, NO_WEAPON_WANTED);
    assert.equal(game.u.uhp, health);
});

test('a monster can put on an invisibility cloak during its turn', async () => {
    freshTurnArena();
    const soldier = await createMonsterAt('soldier', 12, 10, NO_MINVENT);
    soldier.mpeaceful = 1;
    soldier.movement = 12;
    const cloak = addObjectToMonsterInventory(soldier,
        knownObject(OBJECT_NAMES.indexOf('cloak of invisibility')));
    checkMonsterGearNextTurn(soldier);
    pushKeys('.                                .');

    await moveloop_core();
    await moveloop_core();

    assert.equal(cloak.worn, true);
    assert.equal(canSeeMonster(soldier, soldier.mx, soldier.my), false);
    assert.equal(soldier.mx, 12);
    assert.equal(soldier.my, 10);
});

async function runUntilInput(inputGate, maxCycles) {
    const turns = (async () => {
        for (let cycle = 0; cycle < maxCycles; cycle++)
            await moveloop_core();
        return false;
    })();
    const inputNeeded = inputGate.waitUntilBlocked().then(() => true);
    return Promise.race([turns, inputNeeded]);
}

test('a giant escapes its pit and continues moving during a game turn', async () => {
    freshTurnArena();
    const giant = await createMonsterAt('giant', 13, 10);
    giant.mpeaceful = 1;
    giant.mtrapped = 1;
    giant.movement = 12;
    const trap = addTrap(game.level, PIT, 13, 10);
    pushKeys('.                                .');

    await moveloop_core();
    await moveloop_core();

    assert.equal(giant.mtrapped, 0);
    assert.equal(trap.tseen, true);
    assert.ok(giant.mx !== 13 || giant.my !== 10);
});

test('an engulfing monster releases the hero when its hold expires during a turn', async () => {
    freshTurnArena();
    const cloud = await createMonsterAt('fog cloud', game.u.ux + 1, game.u.uy);
    cloud.movement = 12;
    installSwallowedHero(cloud, 1);
    pushKeys('.                                ');

    await moveloop_core();
    await moveloop_core();

    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.ok(cloud.mx !== game.u.ux || cloud.my !== game.u.uy);
});

test('strangulation advances during world turns and pauses during prayer', async () => {
    const inputGate = freshTurnArena();
    wearHeroAccessory(addInventoryObject(AMULET_OF_STRANGULATION), 'uamul');
    pushKeys('h');

    await moveloop_core();
    const secondMove = moveloop_core();
    await inputGate.waitUntilBlocked();

    assert.equal(game.u.strangledTurns, 5);
    game.u.invulnerable = true;
    pushKeys('h');
    await secondMove;
    const nextCommand = moveloop_core();
    await inputGate.waitUntilBlocked();
    assert.equal(game.u.strangledTurns, 5);
    pushKeys('\x1b');
    await nextCommand;
});

test('helplessness advances through live global turns',
    async () => {
        const inputGate = freshTurnArena();
        addInventoryObject(POT_PARALYSIS, {
            initialize: false,
            invlet: 'a',
            name: 'potion of paralysis',
            plural: 'potions of paralysis',
        });
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

test('a stationary monster in water is checked during world maintenance',
    async () => {
        const inputGate = freshTurnArena();
        game.level.at(12, 10).typ = POOL;
        const oracle = await createMonsterAt('Oracle', 12, 10);
        oracle.mpeaceful = 1;
        oracle.movement = 0;
        pushKeys('.');

        await runUntilInput(inputGate, 8);

        assert.equal(game.level.monsters.includes(oracle), false);
        assert.equal(game.u.uconduct.killer, 1);
        assert.match(game._pending_message, /You drown the Oracle\./);
    });

test('a monster-fired magic missile can kill another monster', async () => {
    const inputGate = freshTurnArena();
    const target = await createMonsterAt('jackal', 13, 10);
    Object.assign(target, {
        mhp: 1, mhpmax: 1, mac: 20,
        mpeaceful: 1, mcanmove: 0, mfrozen: 100,
    });
    const wand = chargedWand(WAN_MAGIC_MISSILE, {
        charges: 2,
    });
    const wizard = await createMonsterAt(
        'gnomish wizard', 14, 10, NO_MINVENT,
    );
    Object.assign(wizard, {
        movement: 12, mwandexp: true,
        mux: game.u.ux, muy: game.u.uy,
    });
    addObjectToMonsterInventory(wizard, wand);
    for (const [x, y] of [
        [13, 9], [14, 9], [15, 9],
        [13, 11], [14, 11], [15, 10], [15, 11],
    ]) game.level.at(x, y).typ = STONE;
    pushKeys('. ');

    await runUntilInput(inputGate, 8);

    assert.equal(game.level.monsters.includes(target), false);
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
