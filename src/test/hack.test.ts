import { monsterAtPosition } from '../js/monster_location.js';
import type { OrdinaryDeathOptions } from '../js/end.js';
import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    A_CON, A_STR, BURNING, DISSOLVED, LAVAPOOL, M_SEEN_FIRE, PARANOID_SWIM, POOL, ROOM,
    TT_LAVA, WATER,
} from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { bot, plineWithContinuation } from '../js/display.js';
import { heroLiquidEffects, sinkHeroIntoLava } from '../js/hack.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    AMULET_OF_LIFE_SAVING, LEASH, LEATHER_ARMOR, LOADSTONE, POT_ACID,
    WATER_WALKING_BOOTS,
} from '../js/object_data.js';
import { vision_reset } from '../js/vision.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
import { createSpecialLevel } from './support/topology.js';

function liquidAtHero(terrain: number) {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    const { ux, uy } = game.u;
    level.requireAt(ux, uy).typ = terrain;
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

void test('leaving a pool clears the underwater state', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = ROOM;
    game.u.uinwater = 1;
    game.underwater = true;
    const messages: string[] = [];

    await heroLiquidEffects({
        ...noDisplay,
        publish: async (message: string) => messages.push(message),
    });

    assert.equal(!!game.u.uinwater, false);
    assert.equal(game.underwater, false);
    assert.equal(messages.at(-1), 'You are back on solid ground.');
});

void test('fire resistance leaves the hero stuck in lava', async () => {
    liquidAtHero(LAVAPOOL);
    requireFixtureGame(game);
    game.u.fireResistance = true;
    const messages: string[] = [];

    await heroLiquidEffects({
        ...noDisplay,
        publish: async (message: string) => messages.push(message),
        random: () => 0,
        rollDice: () => 12,
    });

    assert.equal(game.u.uhp, 19);
    assert.equal(game.u.utraptype, TT_LAVA);
    assert.ok((game.u.utrap ?? 0) > 0);
    assert.equal(
        messages.includes(
            'You sink into the molten lava, but it only burns slightly!',
        ),
        true,
    );
});

void test('sinking into lava shows InLava at once and teaches onlookers about fire resistance', async () => {
    liquidAtHero(LAVAPOOL);
    requireFixtureGame(game);
    game.u.fireResistance = true;
    const hound = await createMonsterAt('hell hound', game.u.ux + 3, game.u.uy);
    hound.seen_resistance = 0;
    game.context.botl = true;
    await bot();
    const input = resetInputState();
    let checked = 0;
    input.display = { async readKey() {
        const top = requireScreenRow(0).map(cell => cell.ch).join('');
        if (top.includes('The hole fills with lava!') && top.includes('--More--')) {
            assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bInLava\b/);
            checked++;
        }
        return 32;
    } };
    await plineWithContinuation('The hole fills with lava!');

    await heroLiquidEffects({
        ...noDisplay,
        publish: plineWithContinuation,
        random: () => 0,
        rollDice: () => 12,
    });

    assert.equal(checked, 1);
    assert.equal(hound.seen_resistance & M_SEEN_FIRE, M_SEEN_FIRE);
});

void test('a trapped hero sinks deeper after another action in lava', async () => {
    liquidAtHero(LAVAPOOL);
    requireFixtureGame(game);
    game.u.fireResistance = true;
    game.u.utrap = 2 << 8;
    game.u.utraptype = TT_LAVA;
    game.u.umoved = false;
    const messages: string[] = [];

    await sinkHeroIntoLava({
        ...noDisplay,
        publish: async (message: string) => messages.push(message),
        rollOne: () => 1,
    });

    assert.ok((game.u.utrap ?? 0) < 2 << 8);
    assert.equal(messages.includes('You sink deeper into the lava.'), true);
});

// C trap.c:sink_into_lava() uses Norep(), which compares pline.c's previous
// message even after tty joined it to an earlier one on the top line.
void test('sinking deeper is not repeated after it shared the top line', async () => {
    liquidAtHero(LAVAPOOL);
    requireFixtureGame(game);
    game.u.fireResistance = true;
    game.u.utrap = 4 << 8;
    game.u.utraptype = TT_LAVA;
    game.u.umoved = false;
    pushKeys(' '.repeat(10));
    const messages: string[] = [];
    const publish = async (message: string) => {
        messages.push(message);
        return await plineWithContinuation(message);
    };

    await plineWithContinuation('You feel a bit steadier now.');
    await sinkHeroIntoLava({ ...noDisplay, publish, rollOne: () => 1 });
    await sinkHeroIntoLava({ ...noDisplay, publish, rollOne: () => 1 });

    assert.deepEqual(messages, ['You sink deeper into the lava.']);
});

void test('fireproof water-walking boots hold the hero above lava', async () => {
    liquidAtHero(LAVAPOOL);
    requireFixtureGame(game);
    const boots = await addInventoryObject(WATER_WALKING_BOOTS, {
        oclass: 3,
        worn: true,
        oerodeproof: true,
    });
    game.uarmf = boots;
    game.u.uarmf = boots;
    const messages: string[] = [];

    await heroLiquidEffects({
        ...noDisplay,
        publish: async (message: string) => messages.push(message),
        rollDice: () => 8,
        die: async () => assert.fail('the hero should survive'),
    });

    assert.equal(game.u.uhp, 12);
    assert.equal(game.u.utrap, undefined);
    assert.equal(game.inventory.includes(boots), true);
    assert.equal(messages.includes('The lava here burns you!'), true);
});

void test('an unprotected hero burns in lava', async () => {
    liquidAtHero(LAVAPOOL);
    const messages: string[] = [];
    const deaths: OrdinaryDeathOptions[] = [];

    await heroLiquidEffects({
        ...noDisplay,
        publish: async (message: string) => messages.push(message),
        rollDice: () => 10,
        die: async details => {
            deaths.push(details);
            game.program_state.gameover = true;
        },
    });
    const death = deaths[0];
    assert.ok(death !== undefined);
    assert.equal(death.killer, 'molten lava');
    assert.equal(death.deathType, BURNING);
    assert.equal(messages.includes('You fall into the molten lava!'), true);
    assert.equal(messages.includes('You burn to a crisp...'), true);
});

void test('lethal lava marks the doomed inventory before announcing the fall', async () => {
    liquidAtHero(LAVAPOOL);
    const armor = await addInventoryObject(LEATHER_ARMOR);
    let announced = false;

    await heroLiquidEffects({
        ...noDisplay,
        publish: async message => {
            if (!message.includes('fall into')) return;
            announced = true;
            assert.equal(armor.in_use, true, 'a save at this message must retain the pending destruction');
        },
        die: async () => { game.program_state.gameover = true; },
    });

    assert.equal(announced, true);
    assert.equal(armor.where, 'gone');
});

void test('lava removes but preserves boots already in use by another action', async () => {
    liquidAtHero(LAVAPOOL);
    requireFixtureGame(game);
    const boots = await addInventoryObject(WATER_WALKING_BOOTS, { worn: true, in_use: true });
    game.uarmf = game.u.uarmf = boots;

    await heroLiquidEffects({
        ...noDisplay,
        rollDice: () => 36,
        publish: async () => {},
        die: async () => { game.program_state.gameover = true; },
    });

    assert.equal(game.inventory.includes(boots), true);
    assert.equal(game.uarmf, null);
    assert.equal(boots.in_use, true);
});

void test('a trapped fire-resistant hero eventually dissolves in lava', async () => {
    liquidAtHero(LAVAPOOL);
    requireFixtureGame(game);
    game.u.fireResistance = true;
    game.u.utrap = 1 << 8;
    game.u.utraptype = TT_LAVA;
    const deaths: OrdinaryDeathOptions[] = [];

    const result = await sinkHeroIntoLava({
        ...noDisplay,
        publish: async () => {},
        die: async details => {
            deaths.push(details);
            game.program_state.gameover = true;
        },
    });
    assert.ok(result !== null && result !== undefined);
    assert.equal(result.died, true);
    const death = deaths[0];
    assert.ok(death !== undefined);
    assert.equal(death.killer, 'molten lava');
    assert.equal(death.deathType, DISSOLVED);
});

void test('life saving pulls the hero out after flammable gear burns', async () => {
    const level = liquidAtHero(LAVAPOOL);
    requireFixtureGame(game);
    level.requireAt(20, 5).typ = ROOM;
    const armor = await addInventoryObject(LEATHER_ARMOR, { oclass: 3 });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
        oclass: 5,
        worn: true,
    });
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

void test('a hero can teleport out before trying to crawl', async () => {
    const level = poolAtHero();
    requireFixtureGame(game);
    level.requireAt(20, 5).typ = ROOM;
    grantIntrinsicProperty('teleportation', 'outside');
    game.u.ulevel = 12;
    game.u.uen = 50;
    game.u.uhunger = 900;
    game.u.uluck = 0;
    game.u.acurr.a[A_STR] = 10;
    game.inventory = [];
    const messages: string[] = [];

    const result = await heroLiquidEffects({
        ...noDisplay,
        publish: async (message: string) => messages.push(message),
        random: range => range === 3 ? 0 : 5,
        rollOne: () => 20,
        die: async () => assert.fail('the hero should teleport'),
    });
    assert.ok(result !== null && result !== undefined);
    assert.equal(result.moved, true);
    assert.deepEqual([game.u.ux, game.u.uy], [20, 5]);
    assert.equal(game.u.uen, 20);
    assert.equal(game.u.uhunger, 800);
    assert.equal(messages.includes('You attempt a teleport spell.'), true);
});

void test('teleport control chooses where a drowning hero lands', async () => {
    const level = poolAtHero();
    requireFixtureGame(game);
    level.requireAt(24, 6).typ = ROOM;
    grantIntrinsicProperty('teleportation', 'outside');
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
    assert.ok(result !== null && result !== undefined);
    assert.equal(result.moved, true);
    assert.deepEqual([game.u.ux, game.u.uy], [24, 6]);
    assert.equal(game.u.uen, 20);
    assert.equal(game.u.uhunger, 800);
});

void test('a no-teleport level blocks escape without spending power', async () => {
    poolAtHero();
    requireFixtureGame(game);
    game.level.flags.noteleport = true;
    grantIntrinsicProperty('teleportation', 'outside');
    game.u.ulevel = 12;
    game.u.uen = 50;
    game.u.uhunger = 900;
    game.u.uluck = 0;
    const messages: string[] = [];

    const result = await heroLiquidEffects({
        ...noDisplay,
        publish: async (message: string) => messages.push(message),
        random: range => range === 3 ? 0 : range - 1,
        die: async () => assert.fail('the hero should crawl out'),
    });
    assert.ok(result !== null && result !== undefined);
    assert.equal(result.moved, true);
    assert.equal(game.u.uen, 50);
    assert.equal(game.u.uhunger, 900);
    assert.equal(
        messages.includes('The attempted teleport spell fails.'), true,
    );
});

void test('a neutral rider is blamed when the pony drowns before the rider escapes', async () => {
    const level = freshObjectRoom({
        role: 'barbarian',
        hero: { ulevel: 30, ualign: { type: 0, record: 10 } },
    });
    requireFixtureGame(game);
    const steed = await createSaddledSteed();
    await runExtendedCommand('ride', 'l ');
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    const alignmentBefore = game.u.ualign.record;
    // The dismount's tail float_down owns the liquid entry with the shared
    // production owners; reseed for a deterministic crawl-out and give the
    // real topline its --More-- dismissals.
    initRng(31001n);
    pushKeys('                                ');

    const result = await heroLiquidEffects({ ...noDisplay });

    assert.equal(game.u.usteed, null);
    assert.equal(steed.dead, true);
    assert.notEqual(monsterAtPosition(level, steed.mx, steed.my), steed);
    // C adds the pet penalty, the coaligned peaceful penalty, and the riding penalty.
    assert.equal(game.u.ualign.record, alignmentBefore - 25);
    assert.ok(result !== null && result !== undefined);
    assert.equal(result.moved, true);
    assert.notDeepEqual([game.u.ux, game.u.uy], [11, 10]);
});

void test('a flying steed keeps its rider above the pool', async () => {
    const level = freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requireFixtureGame(game);
    const steed = await createSaddledSteed('silver dragon');
    await runExtendedCommand('ride', 'l ');
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;

    const result = await heroLiquidEffects({
        ...noDisplay,
        publish: async () => assert.fail('the rider should stay dry'),
        die: async () => assert.fail('the rider should stay dry'),
    });

    assert.equal(result, null);
    assert.equal(game.u.usteed, steed);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
});

void test('a hidden piercer stays above the pool', async () => {
    poolAtHero();
    requireFixtureGame(game);
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

void test('known water-walking boots let the hero step onto a pool', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    level.requireAt(11, 10).typ = POOL;
    vision_reset();
    const boots = await addInventoryObject(WATER_WALKING_BOOTS, {
        oclass: 3,
        worn: true,
        typeKnown: true,
    });
    game.uarmf = boots;
    game.u.uarmf = boots;
    game.flags.paranoia_bits = PARANOID_SWIM;

    await rhack('l'.charCodeAt(0));

    assert.equal(!!game.u.uinwater, false);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
});

void test('a burdened hero drops gear before crawling out of a pool', async () => {
    const level = poolAtHero();
    requireFixtureGame(game);
    const stone = await addInventoryObject(LOADSTONE);
    const messages: string[] = [];

    const result = await heroLiquidEffects({
        ...noDisplay,
        publish: async (message: string) => messages.push(message),
        random: range => range - 1,
        die: async () => assert.fail('the hero should escape'),
    });
    assert.ok(result !== null && result !== undefined);
    assert.equal(result.moved, true);
    assert.deepEqual([game.u.ux, game.u.uy], [9, 10]);
    assert.equal(game.inventory.includes(stone), false);
    assert.equal(floorObjectsAt(level, 10, 10).includes(stone), true);
    assert.deepEqual(messages.slice(-3), [
        'You try to crawl out of the water.',
        'You dump some of your gear to lose weight...',
        'Pheew!  That was close.',
    ]);
});

void test('a cursed loadstone can keep the hero from crawling out', async () => {
    poolAtHero();
    requireFixtureGame(game);
    const loadstone = await addInventoryObject(LOADSTONE, { cursed: true });
    const messages: string[] = [];
    const deaths: OrdinaryDeathOptions[] = [];

    const result = await heroLiquidEffects({
        ...noDisplay,
        publish: async (message: string) => messages.push(message),
        random: range => range - 1,
        die: async details => {
            deaths.push(details);
            game.program_state.gameover = true;
        },
    });
    assert.ok(result !== null && result !== undefined);
    assert.equal(result.died, true);
    assert.equal(game.inventory.includes(loadstone), true);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.deepEqual(messages.slice(-3), [
        'You try to crawl out of the water.',
        'But in vain.',
        'You drown.',
    ]);
    const death = deaths[0];
    assert.ok(death !== undefined);
    assert.equal(death.killer, 'pool of water');
    assert.equal(death.deathCause, 'drowned in a pool of water');
});

void test('life saving moves a drowned hero to dry land', async () => {
    const level = poolAtHero();
    requireFixtureGame(game);
    level.requireAt(20, 5).typ = ROOM;
    const loadstone = await addInventoryObject(LOADSTONE, { cursed: true });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
        oclass: 5,
        worn: true,
    });
    game.uamul = amulet;
    game.u.uamul = amulet;

    const result = await heroLiquidEffects({
        ...noDisplay,
        publish: async () => {},
        random: range => range === 21 ? 5 : range - 1,
        rollOne: () => 20,
        die: async () => assert.fail('life saving should prevent death'),
    });
    assert.ok(result !== null && result !== undefined);
    assert.equal(result.moved, true);
    assert.deepEqual([game.u.ux, game.u.uy], [20, 5]);
    assert.equal(game.uamul, null);
    assert.equal(game.inventory.includes(amulet), false);
    assert.ok(game.u.uhp > 0);
});

void test('water wakes a sleeping hero before the crawl attempt', async () => {
    poolAtHero();
    requireFixtureGame(game);
    game.u.usleep = game.moves || 1;
    game._helplessTurns = 5;
    game._helplessReason = 'sleeping';
    const messages: string[] = [];

    const result = await heroLiquidEffects({
        ...noDisplay,
        publish: async (message: string) => messages.push(message),
        random: range => range - 1,
        die: async () => assert.fail('the awakened hero should escape'),
    });
    assert.ok(result !== null && result !== undefined);
    assert.equal(result.moved, true);
    assert.equal(game.u.usleep, 0);
    assert.equal(game._helplessTurns, 0);
    assert.equal(messages.includes('Suddenly you wake up!'), true);
});

void test('the Plane of Water does not make the hero drop gear to escape', async () => {
    poolAtHero();
    requireFixtureGame(game);
    game.water_level = createSpecialLevel(game.u.uz);
    const stone = await addInventoryObject(LOADSTONE);

    const result = await heroLiquidEffects({
        ...noDisplay,
        publish: async () => {},
        random: range => range - 1,
        die: async () => assert.fail('the hero should reach the air pocket'),
    });
    assert.ok(result !== null && result !== undefined);
    assert.equal(result.moved, true);
    assert.equal(game.inventory.includes(stone), true);
});

void test('swimming through the same pool usually leaves inventory dry', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    level.requireAt(10, 10).typ = POOL;
    level.requireAt(11, 10).typ = POOL;
    game.u.ux0 = 10;
    game.u.uy0 = 10;
    game.u.ux = 11;
    game.u.uy = 10;
    game.u.uinwater = 1;
    game.u.swimming = true;
    game.u.uluck = -5;
    const acid = await addInventoryObject(POT_ACID, { oclass: 8 });

    await heroLiquidEffects({
        ...noDisplay,
        publish: async () => {},
        random: () => 1,
        die: async () => assert.fail('a swimmer should not drown'),
    });

    assert.equal(game.inventory.includes(acid), true);
});

void test('entering a pool releases every leash', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    level.requireAt(10, 10).typ = POOL;
    game.u.amphibious = true;
    game.u.uluck = 100;
    const pet = await createMonsterAt('little dog', 11, 10);
    pet.mleashed = 1;
    const leash = await addInventoryObject(LEASH, {
        oclass: 6,
        leashmon: pet.m_id,
    });
    const messages: string[] = [];

    await heroLiquidEffects({
        ...noDisplay,
        publish: async (message: string) => messages.push(message),
        die: async () => assert.fail('an amphibious hero should not drown'),
    });

    assert.equal(pet.mleashed, 0);
    assert.equal(leash.leashmon, 0);
    assert.equal(game.u.uinwater, 1);
    assert.equal(messages.includes('The leash slips loose.'), true);
});

void test('water walking does not protect against a wall of water', async () => {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    level.requireAt(10, 10).typ = WATER;
    game.u.waterWalking = true;
    game.u.amphibious = true;
    game.u.uluck = 100;
    const messages: string[] = [];

    const result = await heroLiquidEffects({
        ...noDisplay,
        publish: async (message: string) => messages.push(message),
        die: async () => assert.fail('an amphibious hero should not drown'),
    });
    assert.ok(result !== null && result !== undefined);
    assert.equal(result.entered, true);
    assert.equal(game.u.uinwater, 1);
    assert.equal(messages[0], 'You plunge into the wall of water.');
});
