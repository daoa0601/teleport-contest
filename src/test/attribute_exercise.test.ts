import test from 'node:test';
import assert from 'node:assert/strict';

import { checkAttributeExercise, exerciseAttribute, exerciseWisdom } from '../js/attrib.js';
import { wearHeroArmor } from '../js/armor.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { A_CHA, A_CON, A_INT, A_STR, A_WIS } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { DUNCE_CAP, OBJECT_NAMES, ROCK } from '../js/object_data.js';
import { nearCapacity } from '../js/weight.js';
import { races } from '../js/roles.js';
import { initRng } from '../js/rng.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addInventoryObject } from './support/game-objects.js';

function freshExercise(seed = 1n) {
    freshPlayableRoom({ seed });
    requirePlayingGame(game);
    game.u._exercise = [0, 0, 0, 0, 0, 0];
    game._nextAttribCheck = 600;
    pushKeys(' '.repeat(20));
}

void test('exceptional Strength is not reduced by positive exercise at its cap', async () => {
    for (let seed = 1n; seed <= 8n; seed++) {
        freshExercise(seed);
        requirePlayingGame(game);
        assert.ok(game.u._exercise);
        game.u.acurr.a[A_STR] = game.u.amax.a[A_STR] = 100;
        game.u._exercise[A_STR] = 50;

        await checkAttributeExercise(600);

        assert.equal(game.u.acurr.a[A_STR], 100);
        assert.equal(game.u._exercise[A_STR], 25);
    }
});

void test('racial maximum and minimum prevent exercise from changing Constitution', async () => {
    for (const direction of [-1, 1]) {
        for (let seed = 1n; seed <= 8n; seed++) {
            freshExercise(seed);
            requirePlayingGame(game);
            assert.ok(game.u._exercise);
            const race = races.find((race) => race.name === 'elf');
            assert.ok(race);
            game.urace = race;
            const limit = direction > 0 ? game.urace.attrmax[A_CON] : game.urace.attrmin[A_CON];
            game.u.acurr.a[A_CON] = game.u.amax.a[A_CON] = limit;
            game.u._exercise[A_CON] = direction * 50;

            await checkAttributeExercise(600);

            assert.equal(game.u.acurr.a[A_CON], limit);
            assert.equal(game.u._exercise[A_CON], direction * 25);
        }
    }
});

void test('polymorph suppresses physical exercise gains while Wisdom can improve', async () => {
    for (let seed = 1n; seed <= 8n; seed++) {
        freshExercise(seed);
        requirePlayingGame(game);
        assert.ok(game.u._exercise);
        installPolymorphedHero('stone golem');
        const oldStrength = game.u.acurr.a[A_STR];
        game.u.acurr.a[A_WIS] = game.u.amax.a[A_WIS] = 10;
        game.u._exercise[A_STR] = game.u._exercise[A_WIS] = 50;

        await checkAttributeExercise(600);

        assert.equal(game.u.acurr.a[A_STR], oldStrength);
        assert.equal(game.u._exercise[A_STR], 25);
        assert.equal(game.u.acurr.a[A_WIS], 11);
        assert.equal(game.u._exercise[A_WIS], 0);
    }
});

void test('a worn sustain-ability ring prevents exercise gain while accumulation decays', async () => {
    freshExercise();
    requirePlayingGame(game);
    assert.ok(game.u._exercise);
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('sustain ability'));
    await wearHeroAccessory(ring, 'uleft');
    game.u.acurr.a[A_WIS] = 10;
    game.u._exercise[A_WIS] = 50;

    await checkAttributeExercise(600);

    assert.equal(game.u.acurr.a[A_WIS], 10);
    assert.equal(game.u._exercise[A_WIS], 25);
});

void test('successful Wisdom exercise gives the attribute message before its explanation', async () => {
    freshExercise();
    requirePlayingGame(game);
    assert.ok(game.u._exercise);
    game.u.acurr.a[A_WIS] = game.u.amax.a[A_WIS] = 10;
    game.u._exercise[A_WIS] = 50;

    await checkAttributeExercise(600);

    assert.equal(game.u.acurr.a[A_WIS], 11);
    assert.match(game._pending_message, /You feel wise!.*You must have been very observant\./);
    assert.ok(game._nextAttribCheck !== undefined);
    assert.ok(game._nextAttribCheck >= 1400 && game._nextAttribCheck <= 1599);
});

void test('Wisdom abuse reduces the base value and gives the loss explanation', async () => {
    freshExercise();
    requirePlayingGame(game);
    assert.ok(game.u._exercise);
    game.u.acurr.a[A_WIS] = game.u.amax.a[A_WIS] = 10;
    game.u._exercise[A_WIS] = -50;

    await checkAttributeExercise(600);

    assert.equal(game.u.acurr.a[A_WIS], 9);
    assert.ok(game.u._exercise[A_WIS] === 0);
    assert.match(game._pending_message, /You feel foolish!.*You haven't been paying attention\./);
});

void test('a worn dunce cap prevents Wisdom exercise gain without an adjustment message', async () => {
    freshExercise();
    requirePlayingGame(game);
    assert.ok(game.u._exercise);
    const cap = await addInventoryObject(DUNCE_CAP);
    wearHeroArmor(cap);
    game.u.acurr.a[A_WIS] = 10;
    game.u._exercise[A_WIS] = 50;

    await checkAttributeExercise(600);

    assert.equal(game.u.acurr.a[A_WIS], 10);
    assert.equal(game.u._exercise[A_WIS], 25);
    assert.equal(game._pending_message || '', '');
});

void test('exercise settlement resumes its message without applying the gain twice', async () => {
    freshExercise();
    requirePlayingGame(game);
    assert.ok(game.u._exercise);
    const input = resetInputState();
    game._pending_message =
        'You have a little trouble lifting a large box of tools and provisions.';
    game.u.acurr.a[A_WIS] = game.u.amax.a[A_WIS] = 10;
    game.u._exercise[A_WIS] = 50;

    const settlement = checkAttributeExercise(600);
    await input.waitUntilBlocked();
    assert.equal(game.u.acurr.a[A_WIS], 11);
    assert.equal(game._nextAttribCheck, 600);
    input.feed(' ');
    await settlement;

    assert.equal(game.u.acurr.a[A_WIS], 11);
    assert.equal(game.u._exercise[A_WIS], 0);
    assert.match(game._pending_message, /You feel wise!.*very observant/);
    assert.ok(game._nextAttribCheck !== undefined);
    assert.ok(game._nextAttribCheck >= 1400);
});

void test('an ongoing counted action defers exercise settlement until it ends', async () => {
    freshExercise();
    requirePlayingGame(game);
    assert.ok(game.u._exercise);
    game.multi = 2;
    game.u.acurr.a[A_WIS] = 10;
    game.u._exercise[A_WIS] = 50;

    await checkAttributeExercise(600);

    assert.equal(game.u.acurr.a[A_WIS], 10);
    assert.equal(game.u._exercise[A_WIS], 50);
    assert.equal(game._nextAttribCheck, 600);
    game.multi = 0;
    await checkAttributeExercise(601);
    assert.equal(game.u.acurr.a[A_WIS], 11);
});

for (const attribute of [A_STR, A_CON]) {
    void test(`capped ${attribute === A_STR ? 'Strength' : 'Constitution'} exercise still reports the real load`, async () => {
        freshExercise();
        requirePlayingGame(game);
        assert.ok(game.u._exercise);
        await addInventoryObject(ROCK, { quantity: 200 });
        game.u._exercise[attribute] = 50;
        game._encumbranceLevel = 0;
        const capacity = nearCapacity(game);
        assert.ok(capacity > 0);

        await exerciseAttribute(attribute, true);

        assert.equal(game.u._exercise[attribute], 50);
        assert.equal(game._encumbranceLevel, capacity);
        assert.match(game._pending_message, /load/);
    });
}

void test('non-exercisable and polymorphed physical attributes skip encumbrance messages', async () => {
    for (const attribute of [A_INT, A_CHA, A_STR, A_CON]) {
        freshExercise();
        requirePlayingGame(game);
        assert.ok(game.u._exercise);
        await addInventoryObject(ROCK, { quantity: 200 });
        game._encumbranceLevel = 0;
        if (attribute === A_STR || attribute === A_CON) installPolymorphedHero('stone golem');

        await exerciseAttribute(attribute, true);

        assert.equal(game.u._exercise[attribute], 0);
        assert.equal(game._encumbranceLevel, 0);
        assert.equal(game._pending_message || '', '');
    }
});

void test('knowledge-only Wisdom exercise remains synchronous and does not report load', async () => {
    freshExercise();
    requirePlayingGame(game);
    assert.ok(game.u._exercise);
    await addInventoryObject(ROCK, { quantity: 200 });
    game.u.acurr.a[A_WIS] = 3;
    game._encumbranceLevel = 0;

    const result = exerciseWisdom();

    assert.equal(result, undefined);
    assert.equal(game.u._exercise[A_WIS], 1);
    assert.equal(game._encumbranceLevel, 0);
    assert.equal(game._pending_message || '', '');
});

void test('periodic Strength gain waits for the load pager before updating remembered capacity', async () => {
    freshExercise();
    requirePlayingGame(game);
    assert.ok(game.u._exercise);
    await addInventoryObject(ROCK, { quantity: 200 });
    game._moveloopStarted = true;
    game._encumbranceLevel = 0;
    game.u.acurr.a[A_STR] = game.u.amax.a[A_STR] = 3;
    game.u._exercise[A_STR] = 50;
    game._pending_message = 'You finish examining the dark passage.';
    initRng(2n);
    const input = resetInputState();

    const settlement = checkAttributeExercise(600);
    const phase = await Promise.race([
        input.waitUntilBlocked().then(() => 'pager'),
        settlement.then(() => 'finished'),
    ]);
    try {
        assert.equal(phase, 'pager');
        assert.equal(game.u.acurr.a[A_STR], 4);
        assert.match(game._pending_message, /You feel strong!/);
        assert.equal(game._encumbranceLevel, 0);
    } finally {
        if (phase === 'pager') input.feed('  ');
        await settlement;
    }

    assert.equal(game._encumbranceLevel, nearCapacity(game));
    assert.equal(game.u.acurr.a[A_STR], 4);
});
