import test from 'node:test';
import assert from 'node:assert/strict';

import {
    A_CON, A_STR, BURNING, DISSOLVED, LAVAPOOL, PARANOID_SWIM, POOL, ROOM,
    TT_LAVA, WATER,
} from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { heroLiquidEffects, sinkHeroIntoLava } from '../js/hack.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    AMULET_OF_LIFE_SAVING, LEASH, LEATHER_ARMOR, LOADSTONE, POT_ACID,
    WATER_WALKING_BOOTS,
} from '../js/object_data.js';
import { vision_reset } from '../js/vision.js';
import { carriedObject as inventoryObject } from './support/game-objects.js';
import { freshWeaponArena } from './support/weapon-arena.js';

function liquidAtHero(terrain) {
    const level = freshWeaponArena();
    const { ux, uy } = game.u;
    level.at(ux, uy).typ = terrain;
    game.u.acurr.a[A_STR] = 3;
    game.u.acurr.a[A_CON] = 3;
    game.u.uhp = 20;
    return level;
}

function poolAtHero() {
    return liquidAtHero(POOL);
}

const noDisplay = {
    recalculateVision: () => {},
    resetVision: () => {},
    repaint: () => {},
};

test('leaving a pool clears the underwater state', async () => {
    freshWeaponArena();
    game.level.at(game.u.ux, game.u.uy).typ = ROOM;
    game.u.uinwater = 1;
    game.underwater = true;
    const messages = [];

    await heroLiquidEffects({
        ...noDisplay,
        publish: async message => messages.push(message),
    });

    assert.equal(!!game.u.uinwater, false);
    assert.equal(game.underwater, false);
    assert.equal(messages.at(-1), 'You are back on solid ground.');
});

test('fire resistance leaves the hero stuck in lava', async () => {
    liquidAtHero(LAVAPOOL);
    game.u.fireResistance = true;
    const messages = [];

    await heroLiquidEffects({
        ...noDisplay,
        publish: async message => messages.push(message),
        random: () => 0,
        rollDice: () => 12,
    });

    assert.equal(game.u.uhp, 19);
    assert.equal(game.u.utraptype, TT_LAVA);
    assert.ok(game.u.utrap > 0);
    assert.equal(
        messages.includes(
            'You sink into the molten lava, but it only burns slightly!',
        ),
        true,
    );
});

test('a trapped hero sinks deeper after another action in lava', async () => {
    liquidAtHero(LAVAPOOL);
    game.u.fireResistance = true;
    game.u.utrap = 2 << 8;
    game.u.utraptype = TT_LAVA;
    game.u.umoved = false;
    const messages = [];

    await sinkHeroIntoLava({
        ...noDisplay,
        publish: async message => messages.push(message),
        rollOne: () => 1,
    });

    assert.ok(game.u.utrap < 2 << 8);
    assert.equal(messages.includes('You sink deeper into the lava.'), true);
});

test('fireproof water-walking boots hold the hero above lava', async () => {
    liquidAtHero(LAVAPOOL);
    const boots = inventoryObject(WATER_WALKING_BOOTS, {
        oclass: 3,
        worn: true,
        oerodeproof: true,
    });
    game.inventory = [boots];
    game.uarmf = boots;
    game.u.uarmf = boots;
    const messages = [];

    await heroLiquidEffects({
        ...noDisplay,
        publish: async message => messages.push(message),
        rollDice: () => 8,
        die: async () => assert.fail('the hero should survive'),
    });

    assert.equal(game.u.uhp, 12);
    assert.equal(game.u.utrap, undefined);
    assert.equal(game.inventory.includes(boots), true);
    assert.equal(messages.includes('The lava here burns you!'), true);
});

test('an unprotected hero burns in lava', async () => {
    liquidAtHero(LAVAPOOL);
    const messages = [];
    let death = null;

    await heroLiquidEffects({
        ...noDisplay,
        publish: async message => messages.push(message),
        rollDice: () => 10,
        die: async details => { death = details; },
    });

    assert.equal(death.killer, 'molten lava');
    assert.equal(death.deathType, BURNING);
    assert.equal(messages.includes('You fall into the molten lava!'), true);
    assert.equal(messages.includes('You burn to a crisp...'), true);
});

test('a trapped fire-resistant hero eventually dissolves in lava', async () => {
    liquidAtHero(LAVAPOOL);
    game.u.fireResistance = true;
    game.u.utrap = 1 << 8;
    game.u.utraptype = TT_LAVA;
    let death = null;

    const result = await sinkHeroIntoLava({
        ...noDisplay,
        publish: async () => {},
        die: async details => { death = details; },
    });

    assert.equal(result.died, true);
    assert.equal(death.killer, 'molten lava');
    assert.equal(death.deathType, DISSOLVED);
});

test('life saving pulls the hero out after flammable gear burns', async () => {
    const level = liquidAtHero(LAVAPOOL);
    level.at(20, 5).typ = ROOM;
    const armor = inventoryObject(LEATHER_ARMOR, { oclass: 3 });
    const amulet = inventoryObject(AMULET_OF_LIFE_SAVING, {
        oclass: 5,
        worn: true,
    });
    game.inventory = [armor, amulet];
    game.uamul = amulet;
    game.u.uamul = amulet;

    await heroLiquidEffects({
        ...noDisplay,
        publish: async () => {},
        random: range => range === 21 ? 5 : range - 1,
        rollDice: () => 10,
        rollOne: () => 20,
        die: async () => assert.fail('life saving should prevent death'),
    });

    assert.deepEqual([game.u.ux, game.u.uy], [20, 5]);
    assert.equal(game.inventory.includes(armor), false);
    assert.equal(game.inventory.includes(amulet), false);
});

test('a hero can teleport out before trying to crawl', async () => {
    const level = poolAtHero();
    level.at(20, 5).typ = ROOM;
    game.u.teleporting = true;
    game.u.ulevel = 12;
    game.u.uen = 50;
    game.u.uhunger = 900;
    game.u.uluck = 0;
    game.u.acurr.a[A_STR] = 10;
    game.inventory = [];
    const messages = [];

    const result = await heroLiquidEffects({
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
    game.u.acurr.a[A_STR] = 10;
    game.inventory = [];

    const result = await heroLiquidEffects({
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

    const result = await heroLiquidEffects({
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

    const result = await heroLiquidEffects({
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

    const result = await heroLiquidEffects({
        ...noDisplay,
        publish: async () => assert.fail('the rider should stay dry'),
        die: async () => assert.fail('the rider should stay dry'),
    });

    assert.equal(result, null);
    assert.equal(game.u.usteed, steed);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
});

test('a hidden piercer stays above the pool', async () => {
    poolAtHero();
    game.u.mtimedone = 20;
    game.u.umonnum = MONSTER_NAME.indexOf('rock piercer');
    game.u.uundetected = 1;

    await heroLiquidEffects({
        ...noDisplay,
        publish: async () => assert.fail('the hidden hero should stay dry'),
        die: async () => assert.fail('the hidden hero should stay dry'),
    });

    assert.equal(!!game.u.uinwater, false);
});

test('known water-walking boots let the hero step onto a pool', async () => {
    const level = freshWeaponArena();
    level.at(11, 10).typ = POOL;
    vision_reset();
    const boots = inventoryObject(WATER_WALKING_BOOTS, {
        oclass: 3,
        worn: true,
        typeKnown: true,
    });
    game.inventory = [boots];
    game.uarmf = boots;
    game.u.uarmf = boots;
    game.flags.paranoia_bits = PARANOID_SWIM;

    await rhack('l'.charCodeAt(0));

    assert.equal(!!game.u.uinwater, false);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
});

test('a burdened hero drops gear before crawling out of a pool', async () => {
    const level = poolAtHero();
    const stone = inventoryObject(LOADSTONE);
    game.inventory = [stone];
    const messages = [];

    const result = await heroLiquidEffects({
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

    const result = await heroLiquidEffects({
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

test('life saving moves a drowned hero to dry land', async () => {
    const level = poolAtHero();
    level.at(20, 5).typ = ROOM;
    const loadstone = inventoryObject(LOADSTONE, { cursed: true });
    const amulet = inventoryObject(AMULET_OF_LIFE_SAVING, {
        oclass: 5,
        worn: true,
    });
    game.inventory = [loadstone, amulet];
    game.uamul = amulet;
    game.u.uamul = amulet;

    const result = await heroLiquidEffects({
        ...noDisplay,
        publish: async () => {},
        random: range => range === 21 ? 5 : range - 1,
        rollOne: () => 20,
        die: async () => assert.fail('life saving should prevent death'),
    });

    assert.equal(result.moved, true);
    assert.deepEqual([game.u.ux, game.u.uy], [20, 5]);
    assert.equal(game.uamul, null);
    assert.equal(game.inventory.includes(amulet), false);
    assert.ok(game.u.uhp > 0);
});

test('water wakes a sleeping hero before the crawl attempt', async () => {
    poolAtHero();
    game.u.usleep = game.moves || 1;
    game._helplessTurns = 5;
    game._helplessReason = 'sleeping';
    const messages = [];

    const result = await heroLiquidEffects({
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

    const result = await heroLiquidEffects({
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

    await heroLiquidEffects({
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

    await heroLiquidEffects({
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

    const result = await heroLiquidEffects({
        ...noDisplay,
        publish: async message => messages.push(message),
        die: async () => assert.fail('an amphibious hero should not drown'),
    });

    assert.equal(result.entered, true);
    assert.equal(game.u.uinwater, 1);
    assert.equal(messages[0], 'You plunge into the wall of water!');
});
