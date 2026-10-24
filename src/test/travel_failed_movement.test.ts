import test from 'node:test';
import assert from 'node:assert/strict';
import { continueRun, heroTestMove, rhack } from '../js/cmd.js';
import { wearHeroArmor } from '../js/armor.js';
import { D_CLOSED, DOOR, ICE, LAVAPOOL, LAVAWALL, PIT, POOL, ROOM, STONE, VIBRATING_SQUARE, WATER } from '../js/const.js';
import type { GameMap } from '../js/game.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { WATER_WALKING_BOOTS } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng, rnd } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

function surroundHeroWithStone(level: GameMap): void {
    for (let x = game.u.ux - 2; x <= game.u.ux + 2; x++) {
        for (let y = game.u.uy - 2; y <= game.u.uy + 2; y++) {
            if (x !== game.u.ux || y !== game.u.uy)
                level.requireAt(x, y).typ = STONE;
        }
    }
    vision_recalc(0);
}

function assertTravelStopped(): void {
    assert.equal(game.context.run, 0);
    assert.equal(game.context.travel, false);
    assert.equal(game.context.travel1, false);
    assert.equal(game.context.mv, false);
    assert.equal(game.multi, 0);
}

for (const continuation of [false, true]) {
    void test(`a failed ${continuation ? 'continued' : 'first'} travel step still checks slippery ice`, async () => {
        const level = freshObjectRoom({ flags: { tips: false } });
        game._travelTarget = { x: 14, y: 10 };
        if (continuation) await rhack(31);
        const { ux, uy } = game.u;
        surroundHeroWithStone(level);
        level.requireAt(ux, uy).typ = ICE;
        game.u.umoved = false;
        initRng(4n);

        if (continuation) assert.equal(await continueRun(), true);
        else await rhack(31);

        assert.deepEqual([game.u.ux, game.u.uy], [ux, uy]);
        assert.equal(game.u.umoved, false);
        assert.equal(game.u.fumblingTurns, 1, 'ice can make the next move slippery without changing position');
        assert.equal(game.context.move, 1);
        assert.equal(game._pending_message, '');
        assertTravelStopped();
        assert.equal(rnd(1000), 778, 'the following roll includes the ice check');
    });
}

for (const continuation of [false, true]) {
    void test(`a swimming hero still encounters friction after a failed ${continuation ? 'continued' : 'first'} travel step`, async () => {
        const level = freshObjectRoom();
        game._travelTarget = { x: 14, y: 10 };
        if (continuation) await rhack(31);
        const { ux, uy } = game.u;
        surroundHeroWithStone(level);
        level.requireAt(ux, uy).typ = POOL;
        game.u.uinwater = 1;
        grantIntrinsicProperty('swimming', 'outside');
        initRng(4n);

        if (continuation) assert.equal(await continueRun(), true);
        else await rhack(31);

        assert.deepEqual([game.u.ux, game.u.uy], [ux, uy]);
        assert.deepEqual([game.u.dx, game.u.dy], [0, 0]);
        assert.equal(game.context.move, 1);
        assert.equal(game._pending_message, '');
        assertTravelStopped();
        assert.equal(rnd(1000), 778, 'a natural swimmer makes the friction check even with a zero direction');
    });
}

void test('a failed travel search can still send a stunned hero into a reachable square', async () => {
    const level = freshObjectRoom({ hero: { stunnedTurns: 10 } });
    surroundHeroWithStone(level);
    level.requireAt(9, 10).typ = ROOM;
    vision_recalc(0);
    game._travelTarget = { x: 14, y: 10 };
    initRng(1n);

    await rhack(31);

    assert.deepEqual([game.u.ux, game.u.uy], [9, 10]);
    assert.equal(game.u.umoved, true);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, '');
    assertTravelStopped();
    assert.equal(rnd(1000), 658, 'the following roll includes retries past the surrounding rock');
});

void test('a travel guess rejects known water before friction can divert the step', async () => {
    const level = freshObjectRoom({ hero: { uinwater: 1 } });
    for (let x = 9; x <= 11; x++)
        for (let y = 9; y <= 11; y++) level.requireAt(x, y).typ = POOL;
    grantIntrinsicProperty('magicalBreathing', 'outside');
    game._travelTarget = { x: 30, y: 10 };
    initRng(12n);

    await rhack(31);

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.deepEqual([game.u.dx, game.u.dy], [0, 0]);
    assert.equal(game._pending_message, '');
    assert.equal(game.context.move, 1);
    assertTravelStopped();
    assert.equal(rnd(1000), 794, 'a cancelled direction needs no water-friction roll');
});

void test('a travel guess rejects a known trap and still checks slippery ice', async () => {
    const level = freshObjectRoom({ hero: { utrap: 0 }, flags: { mention_walls: true } });
    surroundHeroWithStone(level);
    level.requireAt(10, 10).typ = ICE;
    level.requireAt(11, 10).typ = ROOM;
    addTrap(level, PIT, 11, 10, { tseen: true });
    vision_recalc(0);
    game._travelTarget = { x: 30, y: 10 };
    initRng(4n);

    await rhack(31);

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.deepEqual([game.u.dx, game.u.dy], [0, 0]);
    assert.equal(game.u.utrap, 0);
    assert.equal(game.u.fumblingTurns, 1);
    assert.equal(game._pending_message, '');
    assert.equal(game.context.move, 1);
    assertTravelStopped();
    assert.equal(rnd(1000), 778, 'rejecting the trap still leaves the ice check before the next roll');
});

for (const typeKnown of [false, true]) {
    void test(`travel previews ${typeKnown ? 'accept identified' : 'reject unidentified'} water-walking boots`, async () => {
        const level = freshObjectRoom({ context: { run: 8 } });
        level.requireAt(11, 10).typ = POOL;
        wearHeroArmor(await addInventoryObject(WATER_WALKING_BOOTS, { typeKnown }));

        assert.equal(heroTestMove(11, 10), typeKnown);
    });
}

void test('a travel movement preview permits known lava walking only from lava', async () => {
    const level = freshObjectRoom({ context: { run: 8 } });
    level.requireAt(11, 10).typ = LAVAPOOL;
    grantIntrinsicProperty('fireResistance', 'outside');
    wearHeroArmor(await addInventoryObject(WATER_WALKING_BOOTS, { oerodeproof: true, rknown: true }));

    assert.equal(heroTestMove(11, 10), false, 'travel cannot start walking onto lava from dry ground');
    level.requireAt(10, 10).typ = LAVAPOOL;
    assert.equal(heroTestMove(11, 10), true, 'a protected hero already on lava can continue across it');
});

for (const property of ['levitation', 'flying']) {
    void test(`a travel movement preview with ${property} permits liquid surfaces and rejects liquid walls`, () => {
        const level = freshObjectRoom({ context: { run: 8 } });
        if (property === 'levitation') grantIntrinsicProperty('levitation', 'outside');
        else grantIntrinsicProperty('flying', 'outside');
        level.requireAt(11, 10).typ = POOL;
        level.requireAt(10, 11).typ = LAVAPOOL;
        level.requireAt(9, 10).typ = WATER;
        level.requireAt(10, 9).typ = LAVAWALL;

        assert.equal(heroTestMove(11, 10), true, 'the hero can pass above a pool');
        assert.equal(heroTestMove(10, 11), true, 'the hero can pass above lava');
        assert.equal(heroTestMove(9, 10), false, 'a water wall cannot be flown over');
        assert.equal(heroTestMove(10, 9), false, 'a lava wall cannot be flown over');
    });
}

void test('a travel movement preview leaves unknown liquid for ordinary movement to discover', () => {
    const level = freshObjectRoom({ context: { run: 8 } });
    const pool = level.requireAt(11, 10);
    pool.typ = POOL;
    pool.seenv = 0;

    assert.equal(heroTestMove(11, 10), true);
});

void test('travel previews allow the current square and vibrating squares', () => {
    const level = freshObjectRoom({ context: { run: 8 } });
    level.requireAt(10, 10).typ = POOL;
    addTrap(level, PIT, 10, 10, { tseen: true });
    addTrap(level, VIBRATING_SQUARE, 11, 10, { tseen: true });

    assert.equal(heroTestMove(10, 10), true, 'travel can search backwards to the hero');
    assert.equal(heroTestMove(11, 10), true, 'a vibrating square is no obstacle');
});

void test('ordinary movement previews leave known hazards to the movement checks', () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = POOL;
    addTrap(level, PIT, 10, 11, { tseen: true });

    assert.equal(heroTestMove(11, 10), true);
    assert.equal(heroTestMove(10, 11), true);
});

void test('a guessed route toward an unreachable target still checks ice before moving', async () => {
    const level = freshObjectRoom({ top: 10, bottom: 10 });
    level.requireAt(10, 10).typ = ICE;
    game._travelTarget = { x: 30, y: 10 };
    initRng(4n);

    await rhack(31);

    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.u.umoved, true);
    assert.equal(game.u.fumblingTurns, 1);
    assert.equal(game.context.travel, true);
    assert.equal(game.context.travel1, false);
    assert.equal(rnd(1000), 778);
});

void test('choosing the final travel step stops repetition even if stun sends the hero elsewhere', async () => {
    freshObjectRoom({ hero: { stunnedTurns: 10 } });
    game._travelTarget = { x: 11, y: 10 };
    initRng(1n);

    await rhack(31);

    assert.deepEqual([game.u.ux, game.u.uy], [11, 9]);
    assert.equal(game.u.umoved, true);
    assert.equal(game._travelTarget, null);
    assertTravelStopped();
    assert.equal(rnd(1000), 755);
});

void test('a final continued step retains running checks after stun changes its destination', async () => {
    freshObjectRoom();
    game._travelTarget = { x: 12, y: 10 };
    await rhack(31);
    game.u.stunnedTurns = 10;
    game.u.umoved = false;
    initRng(1n);

    assert.equal(await continueRun(), true);

    assert.deepEqual([game.u.ux, game.u.uy], [12, 9]);
    assert.equal(game.u.umoved, true);
    assert.equal(game._travelTarget, null);
    assert.equal(game.context.run, 8);
    assert.equal(game.context.travel, false);
    assert.equal(game.context.travel1, false);
    assert.equal(game.context.mv, false);
    assert.equal(game.multi, 0);
    assert.equal(rnd(1000), 755);
});

void test('counted travel completes its last step after the count ends running', async () => {
    freshObjectRoom();
    game._travelTarget = { x: 14, y: 10 };
    resetInputState().feed('2\x1f');
    await rhack(0);

    assert.equal(await continueRun(), true);

    assert.deepEqual([game.u.ux, game.u.uy], [12, 10]);
    assert.equal(game.context.move, 1);
    assertTravelStopped();
});

void test('a final travel step retains the running check that prevents automatic door opening', async () => {
    const level = freshObjectRoom({ flags: { autoopen: true } });
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    game._travelTarget = { x: 11, y: 10 };
    initRng(1n);

    await rhack(31);

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(door.doormask, D_CLOSED);
    assert.equal(game._pending_message, 'That door is closed.');
    assert.equal(game.context.move, 1);
    assert.equal(game._travelTarget, null);
    assertTravelStopped();
    assert.equal(rnd(1000), 646);
});
