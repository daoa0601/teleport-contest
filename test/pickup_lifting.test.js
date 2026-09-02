import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { PIT, POOL, TT_PIT, W_AMUL, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    AMULET_OF_LIFE_SAVING, BOW, CHEST, CLUB, CORPSE, DART, FOOD_RATION,
    HEAVY_IRON_BALL, LOADSTONE, ROCK, SCR_SCARE_MONSTER,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import {
    floorArtifact, floorObject, inventoryObject, looseObject,
} from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshCommandRoom } from './support/playable-room.js';

function freshPickupGame(inventory = []) {
    freshCommandRoom({ inventory, seed: 32001n });
}

function carriedRocks(count) {
    return inventoryObject(ROCK, 'a', {
        quantity: count,
        nomerge: true,
    });
}

function swallowHeroWith(...objects) {
    const worm = addMonster({
        mnum: 115,
        x: game.u.ux,
        y: game.u.uy,
        hitPoints: 30,
        level: 15,
    });
    for (const object of objects)
        addObjectToMonsterInventory(worm, object);
    game.u.uswallow = 1;
    game.u.ustuck = worm;
    return worm;
}

test('floor pickup honors a count chosen from a multi-object pile', async () => {
    freshPickupGame();
    const darts = floorObject(DART, 10, 10, { quantity: 20 });
    const ration = floorObject(FOOD_RATION, 10, 10);
    pushKeys('5a\n');

    await rhack(','.charCodeAt(0));

    const carried = game.inventory.find(object => object.otyp === DART);
    assert.equal(carried.quan, 5);
    assert.equal(darts.quan, 15);
    assert.equal(game.level.objects[10][10].includes(darts), true);
    assert.equal(game.level.objects[10][10].includes(ration), true);
});

test('a new pickup replaces the previous just-picked batch', async () => {
    const club = inventoryObject(CLUB, 'a', { pickup_prev: true });
    freshPickupGame([club]);
    const ration = floorObject(FOOD_RATION, 10, 10);

    await rhack(','.charCodeAt(0));

    assert.equal(club.pickup_prev, false);
    assert.equal(ration.pickup_prev, true);
});

test('picking up a bones bow adjusts it for a left-handed hero', async () => {
    freshPickupGame();
    game.u.rightHanded = false;
    const bow = floorObject(BOW, 10, 10, {
        ghostly: true,
        name: 'bow',
    });

    await rhack(','.charCodeAt(0));

    assert.equal(bow.ghostly, false);
    assert.match(game._pending_message,
        /make adjustments to the bow to suit your left hand\.$/);
});

test('floor pickup takes the largest stack that remains below overload',
    async () => {
        freshPickupGame([carriedRocks(150)]);
        const darts = floorObject(DART, 10, 10, { quantity: 200 });
        pushKeys(' '.repeat(5));

        await rhack(','.charCodeAt(0));

        const carried = game.inventory.find(object => object.otyp === DART);
        assert.equal(carried.quan, 149);
        assert.equal(darts.quan, 51);
        assert.equal(game.level.objects[10][10].includes(darts), true);
    });

test('declining a heavier burden leaves the floor object in place',
    async () => {
        freshPickupGame([carriedRocks(70)]);
        const ball = floorObject(HEAVY_IRON_BALL, 10, 10);
        pushKey('n');

        await rhack(','.charCodeAt(0));

        assert.equal(game.inventory.includes(ball), false);
        assert.equal(game.level.objects[10][10].includes(ball), true);
        assert.equal(game.context.move, 1);
    });

test('accepting a heavier burden picks up the floor object', async () => {
    freshPickupGame([carriedRocks(70)]);
    const ball = floorObject(HEAVY_IRON_BALL, 10, 10);
    pushKey('y');

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(ball), true);
    assert.equal(game.level.objects[10][10].includes(ball), false);
});

test('a full pack rejects a new stack which cannot merge', async () => {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const inventory = [...letters].map((letter, index) =>
        inventoryObject(CLUB, letter, {
            o_id: 32000 + index,
            nomerge: true,
        }));
    freshPickupGame(inventory);
    const dart = floorObject(DART, 10, 10, { nomerge: true });

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(dart), false);
    assert.equal(game.level.objects[10][10].includes(dart), true);
});

test('a loadstone ignores the ordinary weight limit', async () => {
    freshPickupGame([carriedRocks(160)]);
    const loadstone = floorObject(LOADSTONE, 10, 10, { cursed: true });

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(loadstone), true);
    assert.equal(game.level.objects[10][10].includes(loadstone), false);
});

test('container removal uses the same partial-stack limit', async () => {
    freshPickupGame([carriedRocks(150)]);
    const chest = floorObject(CHEST, 10, 10, { cknown: true });
    const darts = inventoryObject(DART, null, {
        where: 'contained',
        container: chest,
        quantity: 200,
    });
    chest.contents = [darts];
    pushKeys(`loot\noa\n${' '.repeat(5)}`);

    await rhack('#'.charCodeAt(0));

    const carried = game.inventory.find(object => object.otyp === DART);
    assert.equal(carried.quan, 149);
    assert.equal(darts.quan, 51);
    assert.deepEqual(chest.contents, [darts]);
});

test('a floor artifact can blast the hero and evade pickup', async () => {
    freshPickupGame();
    const orb = floorArtifact('The Orb of Detection', 10, 10);
    game.u.ualign.type = -1;
    game.u.ualign.record = 0;
    game.u.uhp = game.u.uhpmax = 100;
    initRng(8401n);
    pushKeys(' '.repeat(10));

    await rhack(','.charCodeAt(0));

    assert.equal(game.level.objects[10][10].includes(orb), true);
    assert.equal(game.inventory.includes(orb), false);
    assert.ok(game.u.uhp < 100);
});

test('a fatal floor corpse stops pickup after life saving', async () => {
    const amulet = inventoryObject(AMULET_OF_LIFE_SAVING, 'a', {
        worn: true,
        owornmask: W_AMUL,
    });
    freshPickupGame([amulet]);
    game.uamul = game.u.uamul = amulet;
    const corpse = floorObject(CORPSE, 10, 10, {
        corpsenm: 10,
        quantity: 2,
    });
    pushKeys(' '.repeat(10));

    await rhack(','.charCodeAt(0));

    assert.equal(corpse.quan, 2);
    assert.equal(game.level.objects[10][10].includes(corpse), true);
    assert.equal(game.inventory.includes(amulet), false);
    assert.ok(game.u.uhp > 0);
});

test('touching a Rider corpse revives it instead of picking it up',
    async () => {
        freshPickupGame();
        game.moves = 40;
        const corpse = floorObject(CORPSE, 10, 10, {
            age: 40,
            corpsenm: 311,
        });
        pushKeys(' '.repeat(5));

        await rhack(','.charCodeAt(0));

        assert.equal(game.inventory.includes(corpse), false);
        assert.equal(game.level.objects[10][10].includes(corpse), false);
        assert.ok(game.level.monsters.some(monster =>
            monster.mnum === 311 && monster.mhp > 0));
    });

test('a blessed scare scroll becomes uncursed when picked up', async () => {
    freshPickupGame();
    const scroll = floorObject(SCR_SCARE_MONSTER, 10, 10, {
        blessed: true,
        dknown: false,
        spe: 0,
    });

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(scroll), true);
    assert.equal(scroll.blessed, false);
    assert.equal(scroll.spe, 0);
    assert.equal(scroll.dknown, true);
    assert.equal(game._encounteredObjectTypes.has(SCR_SCARE_MONSTER), true);
});

test('only the carryable part of a cursed scare-scroll stack turns to dust',
    async () => {
        freshPickupGame([carriedRocks(164)]);
        game._knownObjectTypes = new Set([SCR_SCARE_MONSTER]);
        const scrolls = floorObject(SCR_SCARE_MONSTER, 10, 10, {
            cursed: true,
            quantity: 2,
            spe: 0,
        });
        pushKeys(' '.repeat(5));

        await rhack(','.charCodeAt(0));

        assert.equal(scrolls.quan, 1);
        assert.deepEqual(game.level.objects[10][10], [scrolls]);
        assert.equal(game.inventory.some(object =>
            object.otyp === SCR_SCARE_MONSTER), false);
    });

test('an unliftable scare scroll remains unchanged', async () => {
    freshPickupGame([carriedRocks(165)]);
    const scroll = floorObject(SCR_SCARE_MONSTER, 10, 10, {
        cursed: false,
        spe: 0,
    });

    await rhack(','.charCodeAt(0));

    assert.equal(scroll.spe, 0);
    assert.equal(game.level.objects[10][10].includes(scroll), true);
    assert.equal(game.inventory.includes(scroll), false);
});

test('a swallowed hero can pick up an object inside the monster', async () => {
    freshPickupGame();
    const club = looseObject(CLUB);
    const worm = swallowHeroWith(club);

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(club), true);
    assert.equal(worm.minvent.includes(club), false);
    assert.equal(club.where, 'inventory');
    assert.equal(club.carrierMid, undefined);
    assert.equal(game.context.move, 1);
});

test('a swallowed hero cannot take the monster weapon', async () => {
    freshPickupGame();
    const club = looseObject(CLUB, {
        owornmask: W_WEP,
        wielded: true,
    });
    const worm = swallowHeroWith(club);
    worm.mw = club;
    worm.misc_worn_check = W_WEP;

    await rhack(','.charCodeAt(0));

    assert.equal(worm.minvent.includes(club), true);
    assert.equal(game.inventory.includes(club), false);
    assert.equal(club.where, 'minvent');
    assert.equal(game.context.move, 0);
});

test('a handless form which can carry objects can pick one up', async () => {
    freshPickupGame();
    game.u.umonster = 260;
    game.u.umonnum = 8;
    game.u.mtimedone = 100;
    const club = floorObject(CLUB, 10, 10);

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(club), true);
    assert.equal(game.context.move, 1);
});

test('levitation keeps floor objects out of reach', async () => {
    freshPickupGame();
    game.u.levitating = true;
    const club = floorObject(CLUB, 10, 10);

    await rhack(','.charCodeAt(0));

    assert.equal(game.level.objects[10][10].includes(club), true);
    assert.equal(game.inventory.includes(club), false);
    assert.equal(game.context.move, 0);
});

test('a hero at a pit edge cannot reach an object at the bottom', async () => {
    freshPickupGame();
    addTrap(game.level, PIT, 10, 10, { tseen: true });
    const club = floorObject(CLUB, 10, 10);

    await rhack(','.charCodeAt(0));

    assert.equal(game.level.objects[10][10].includes(club), true);
    assert.equal(game.inventory.includes(club), false);
    assert.equal(game.context.move, 0);
});

test('a hero inside a pit can pick up an object at the bottom', async () => {
    freshPickupGame();
    addTrap(game.level, PIT, 10, 10, { tseen: true });
    game.u.utrap = 3;
    game.u.utraptype = TT_PIT;
    const club = floorObject(CLUB, 10, 10);

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(club), true);
    assert.equal(game.context.move, 1);
});

test('autopickup leaves an unreachable floor object behind', async () => {
    freshPickupGame();
    game.flags.pickup = true;
    game.u.levitating = true;
    const club = floorObject(CLUB, 11, 10);

    await rhack('l'.charCodeAt(0));

    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.level.objects[11][10].includes(club), true);
    assert.equal(game.inventory.includes(club), false);
});

test('a pickup command count takes that many objects', async () => {
    freshPickupGame();
    const darts = floorObject(DART, 10, 10, { quantity: 10 });

    await rhack('3'.charCodeAt(0));
    await rhack(','.charCodeAt(0));

    const carried = game.inventory.find(object => object.otyp === DART);
    assert.equal(carried.quan, 3);
    assert.equal(darts.quan, 7);
    assert.equal(game._commandCount, 0);
});

test('a pickup command count chooses one matching stack', async () => {
    freshPickupGame();
    const darts = floorObject(DART, 10, 10, { quantity: 10 });
    const rocks = floorObject(ROCK, 10, 10, { quantity: 10 });
    pushKey('a');

    await rhack('3'.charCodeAt(0));
    await rhack(','.charCodeAt(0));

    const carried = game.inventory.find(object => object.otyp === DART);
    assert.equal(carried.quan, 3);
    assert.equal(darts.quan, 7);
    assert.equal(rocks.quan, 10);
});

test('an empty digesting monster still consumes a pickup turn', async () => {
    freshPickupGame();
    swallowHeroWith();
    pushKeys(' '.repeat(3));

    await rhack(','.charCodeAt(0));

    assert.deepEqual(game.inventory, []);
    assert.equal(game.context.move, 1);
});

test('water walking cannot reach objects at the bottom of a pool', async () => {
    freshPickupGame();
    game.level.at(10, 10).typ = POOL;
    game.u.waterWalking = true;
    const club = floorObject(CLUB, 10, 10);

    await rhack(','.charCodeAt(0));

    assert.equal(game.level.objects[10][10].includes(club), true);
    assert.equal(game.inventory.includes(club), false);
    assert.equal(game.context.move, 0);
});
