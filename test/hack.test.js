import test from 'node:test';
import assert from 'node:assert/strict';

import { POOL, ROOM, WATER } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroEntersPool } from '../js/hack.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { LEASH, LOADSTONE, POT_ACID } from '../js/object_data.js';
import { freshWeaponArena } from './support/weapon-arena.js';

function poolAtHero() {
    const level = freshWeaponArena();
    const { ux, uy } = game.u;
    level.at(ux, uy).typ = POOL;
    game.u.acurr.a[0] = 3;
    game.u.acurr.a[2] = 3;
    game.u.uhp = 20;
    return level;
}

function inventoryObject(otyp, overrides = {}) {
    return {
        otyp,
        oclass: 13,
        quan: 1,
        quantity: 1,
        where: 'inventory',
        cursed: false,
        blessed: false,
        worn: false,
        owornmask: 0,
        ...overrides,
    };
}

const noDisplay = {
    recalculateVision: () => {},
    resetVision: () => {},
    repaint: () => {},
};

test('a hero can teleport out before trying to crawl', async () => {
    const level = poolAtHero();
    level.at(20, 5).typ = ROOM;
    game.u.teleporting = true;
    game.u.ulevel = 12;
    game.u.uen = 50;
    game.u.uhunger = 900;
    game.u.uluck = 0;
    game.u.acurr.a[0] = 10;
    game.inventory = [];
    const messages = [];

    const result = await heroEntersPool({
        ...noDisplay,
        publish: async message => messages.push(message),
        random: range => range === 3 ? 0 : 5,
        rollOne: () => 20,
        die: async () => assert.fail('the hero should teleport'),
    });

    assert.equal(result.moved, true);
    assert.deepEqual([game.u.ux, game.u.uy], [20, 5]);
    assert.equal(game.u.uen, 20);
    assert.equal(game.u.uhunger, 800);
    assert.equal(messages.includes('You attempt a teleport spell.'), true);
});

test('teleport control chooses where a drowning hero lands', async () => {
    const level = poolAtHero();
    level.at(24, 6).typ = ROOM;
    game.u.teleporting = true;
    game.u.teleportControl = true;
    game.u.ulevel = 12;
    game.u.uen = 50;
    game.u.uhunger = 900;
    game.u.uluck = -10;
    game.u.acurr.a[0] = 10;
    game.inventory = [];

    const result = await heroEntersPool({
        ...noDisplay,
        publish: async () => {},
        chooseTeleportDestination: async () => ({ x: 24, y: 6 }),
        die: async () => assert.fail('the hero should teleport'),
    });

    assert.equal(result.moved, true);
    assert.deepEqual([game.u.ux, game.u.uy], [24, 6]);
    assert.equal(game.u.uen, 20);
    assert.equal(game.u.uhunger, 800);
});

test('a no-teleport level blocks escape without spending power', async () => {
    poolAtHero();
    game.level.flags.noteleport = true;
    game.u.teleporting = true;
    game.u.ulevel = 12;
    game.u.uen = 50;
    game.u.uhunger = 900;
    game.u.uluck = 0;
    const messages = [];

    const result = await heroEntersPool({
        ...noDisplay,
        publish: async message => messages.push(message),
        random: range => range === 3 ? 0 : range - 1,
        die: async () => assert.fail('the hero should crawl out'),
    });

    assert.equal(result.moved, true);
    assert.equal(game.u.uen, 50);
    assert.equal(game.u.uhunger, 900);
    assert.equal(
        messages.includes('The attempted teleport spell fails.'), true,
    );
});

test('a grounded steed drowns before the hero tries to crawl out', async () => {
    const level = poolAtHero();
    const steed = {
        mnum: MONSTER_NAME.indexOf('pony'),
        mx: game.u.ux,
        my: game.u.uy,
        mhp: 8,
        mhpmax: 8,
        mtame: 20,
        pet: true,
        minvent: [],
    };
    game.u.usteed = steed;
    level.monsters = [];
    const alignmentBefore = game.u.ualign.record;

    const result = await heroEntersPool({
        ...noDisplay,
        publish: async () => {},
        random: range => range - 1,
        die: async () => assert.fail('the hero should crawl out'),
    });

    assert.equal(game.u.usteed, null);
    assert.equal(steed.dead, true);
    assert.equal(level.monsters.includes(steed), false);
    assert.equal(game.u.ualign.record, alignmentBefore - 1);
    assert.equal(result.moved, true);
});

test('a flying steed keeps its rider above the pool', async () => {
    poolAtHero();
    const steed = {
        mnum: MONSTER_NAME.indexOf('couatl'),
        mx: game.u.ux,
        my: game.u.uy,
        mhp: 20,
        mhpmax: 20,
        mtame: 20,
        pet: true,
        minvent: [],
    };
    game.u.usteed = steed;

    const result = await heroEntersPool({
        ...noDisplay,
        publish: async () => assert.fail('the rider should stay dry'),
        die: async () => assert.fail('the rider should stay dry'),
    });

    assert.equal(result, null);
    assert.equal(game.u.usteed, steed);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
});

test('a burdened hero drops gear before crawling out of a pool', async () => {
    const level = poolAtHero();
    const stone = inventoryObject(LOADSTONE);
    game.inventory = [stone];
    const messages = [];

    const result = await heroEntersPool({
        ...noDisplay,
        publish: async message => messages.push(message),
        random: range => range - 1,
        die: async () => assert.fail('the hero should escape'),
    });

    assert.equal(result.moved, true);
    assert.deepEqual([game.u.ux, game.u.uy], [9, 10]);
    assert.equal(game.inventory.includes(stone), false);
    assert.equal(level.objects[10][10].includes(stone), true);
    assert.deepEqual(messages.slice(-3), [
        'You try to crawl out of the water.',
        'You dump some of your gear to lose weight...',
        'Pheew!  That was close.',
    ]);
});

test('a cursed loadstone can keep the hero from crawling out', async () => {
    poolAtHero();
    const loadstone = inventoryObject(LOADSTONE, { cursed: true });
    game.inventory = [loadstone];
    const messages = [];
    let death = null;

    const result = await heroEntersPool({
        ...noDisplay,
        publish: async message => messages.push(message),
        random: range => range - 1,
        die: async details => { death = details; },
    });

    assert.equal(result.died, true);
    assert.equal(game.inventory.includes(loadstone), true);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.deepEqual(messages.slice(-3), [
        'You try to crawl out of the water.',
        'But in vain.',
        'You drown.',
    ]);
    assert.equal(death.killer, 'deep water');
});

test('water wakes a sleeping hero before the crawl attempt', async () => {
    poolAtHero();
    game.u.usleep = game.moves || 1;
    game._helplessTurns = 5;
    game._helplessReason = 'sleeping';
    const messages = [];

    const result = await heroEntersPool({
        ...noDisplay,
        publish: async message => messages.push(message),
        random: range => range - 1,
        die: async () => assert.fail('the awakened hero should escape'),
    });

    assert.equal(result.moved, true);
    assert.equal(game.u.usleep, 0);
    assert.equal(game._helplessTurns, 0);
    assert.equal(messages.includes('Suddenly you wake up!'), true);
});

test('the Plane of Water does not make the hero drop gear to escape', async () => {
    const level = poolAtHero();
    level.flags.is_waterlevel = true;
    const stone = inventoryObject(LOADSTONE);
    game.inventory = [stone];

    const result = await heroEntersPool({
        ...noDisplay,
        publish: async () => {},
        random: range => range - 1,
        die: async () => assert.fail('the hero should reach the air pocket'),
    });

    assert.equal(result.moved, true);
    assert.equal(game.inventory.includes(stone), true);
});

test('swimming through the same pool usually leaves inventory dry', async () => {
    const level = freshWeaponArena();
    level.at(10, 10).typ = POOL;
    level.at(11, 10).typ = POOL;
    game.u.ux0 = 10;
    game.u.uy0 = 10;
    game.u.ux = 11;
    game.u.uy = 10;
    game.u.uinwater = 1;
    game.u.swimming = true;
    game.u.uluck = -5;
    const acid = inventoryObject(POT_ACID, { oclass: 8 });
    game.inventory = [acid];

    await heroEntersPool({
        ...noDisplay,
        publish: async () => {},
        random: () => 1,
        die: async () => assert.fail('a swimmer should not drown'),
    });

    assert.equal(game.inventory.includes(acid), true);
});

test('entering a pool releases every leash', async () => {
    const level = freshWeaponArena();
    level.at(10, 10).typ = POOL;
    game.u.amphibious = true;
    game.u.uluck = 100;
    const pet = {
        mnum: 16,
        m_id: 7001,
        mx: 11,
        my: 10,
        mhp: 8,
        mleashed: 1,
    };
    level.monsters = [pet];
    const leash = inventoryObject(LEASH, {
        oclass: 6,
        leashmon: pet.m_id,
    });
    game.inventory = [leash];
    const messages = [];

    await heroEntersPool({
        ...noDisplay,
        publish: async message => messages.push(message),
        die: async () => assert.fail('an amphibious hero should not drown'),
    });

    assert.equal(pet.mleashed, 0);
    assert.equal(leash.leashmon, 0);
    assert.equal(game.u.uinwater, 1);
    assert.equal(messages.includes('The leash slips loose.'), true);
});

test('water walking does not protect against a wall of water', async () => {
    const level = freshWeaponArena();
    level.at(10, 10).typ = WATER;
    game.u.waterWalking = true;
    game.u.amphibious = true;
    game.u.uluck = 100;
    const messages = [];

    const result = await heroEntersPool({
        ...noDisplay,
        publish: async message => messages.push(message),
        die: async () => assert.fail('an amphibious hero should not drown'),
    });

    assert.equal(result.entered, true);
    assert.equal(game.u.uinwater, 1);
    assert.equal(messages[0], 'You plunge into the wall of water!');
});
