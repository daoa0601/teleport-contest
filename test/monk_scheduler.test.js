import test from 'node:test';
import assert from 'node:assert/strict';

import { continueCountedCommand, rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { CORPSE, MEATBALL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import {
    roleOutcome,
} from './support/role-outcome.js';
import { freshWeaponArena } from './support/weapon-arena.js';

const monkInput = input => ({
    role: 'Monk', race: 'human', gender: 'male', align: 'neutral',
    datetime: '20260830160000',
    ...input,
});

test('future Monk command text cannot teleport a fresh live hero', async () => {
    // Thirteen directional commands can change each coordinate by at most
    // thirteen cells in total.  The later eat selector is invalid for this
    // fresh inventory and may not synthesize a corpse or rewrite elapsed time.
    const startup = await roleOutcome(monkInput({
        seed: 45003,
        moves: ' ',
    }));
    const outcome = await roleOutcome(monkInput({
        seed: 45003,
        moves: '  n:kkkhhhjjjlll.ssh,ek',
    }));
    const distance = Math.abs(outcome.hero[0] - startup.hero[0])
        + Math.abs(outcome.hero[1] - startup.hero[1]);

    assert.ok(distance <= 13);
    assert.match(outcome.message, /You don't have that object/);
});

test('a carried meat corpse applies the live Monk conduct penalty', async () => {
    freshWeaponArena();
    initRng(45300n);
    game.urole = { key: 'monk' };
    game.u.ualign = { type: 0, record: 10, abuse: 0 };
    game.u.uconduct = {};
    game.u.uhunger = 900;
    const corpse = {
        otyp: CORPSE,
        oclass: 7,
        corpsenm: 70,
        name: 'goblin corpse',
        invlet: 'a',
        quan: 1,
        quantity: 1,
        age: game.moves,
        where: 'inventory',
    };
    game.inventory = [corpse];
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.uconduct.unvegetarian, 1);
    assert.equal(game.u.ualign.record, 9);
    assert.equal(game.u.ualign.abuse, 1);
    assert.match(game._pending_message, /You feel guilty\./);
    assert.ok(game._occupation);

    pushKey(' ');
    for (let turn = 0; turn < 10 && game._occupation; turn++)
        await continueCountedCommand(game);

    assert.equal(game._occupation, null);
    assert.equal(game.inventory.includes(corpse), false);
    assert.match(game._pending_message, /finish eating the goblin corpse/);
});

test('a floor meat corpse keeps the same Monk penalty and floor lifecycle',
    async () => {
        const level = freshWeaponArena();
        initRng(45300n);
        game.urole = { key: 'monk' };
        game.u.ualign = { type: 0, record: 10, abuse: 0 };
        game.u.uconduct = {};
        const corpse = {
            otyp: CORPSE,
            oclass: 7,
            corpsenm: 70,
            name: 'goblin corpse',
            quan: 1,
            quantity: 1,
            age: game.moves,
            ox: 10,
            oy: 10,
            where: 'floor',
        };
        if (!level.objects[10]) level.objects[10] = [];
        level.objects[10][10] = [corpse];
        pushKey('y');

        await rhack('e'.charCodeAt(0));

        assert.equal(game.u.uconduct.unvegetarian, 1);
        assert.equal(game.u.ualign.record, 9);
        assert.match(game._pending_message, /You feel guilty\./);
        assert.ok(game._occupation);

        pushKey(' ');
        for (let turn = 0; turn < 10 && game._occupation; turn++)
            await continueCountedCommand(game);

        assert.equal(game._occupation, null);
        assert.equal(level.objects[10][10].includes(corpse), false);
    });

test('ordinary carried meat uses the same Monk vegetarian rule', async () => {
    freshWeaponArena();
    initRng(45300n);
    game.urole = { key: 'monk' };
    game.u.ualign = { type: 0, record: 10, abuse: 0 };
    game.u.uconduct = {};
    const meatball = {
        otyp: MEATBALL,
        oclass: 7,
        name: 'meatball',
        invlet: 'a',
        quan: 1,
        quantity: 1,
        age: game.moves,
        where: 'inventory',
    };
    game.inventory = [meatball];
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.uconduct.unvegetarian, 1);
    assert.equal(game.u.ualign.record, 9);
    assert.equal(game.u.ualign.abuse, 1);
    assert.equal(game.inventory.includes(meatball), false);
    assert.match(
        game._pending_message,
        /You feel guilty\.  This meatball is delicious!$/,
    );
});

test('the vegetarian alignment penalty remains Monk-specific', async () => {
    freshWeaponArena();
    initRng(45300n);
    game.urole = { key: 'rogue' };
    game.u.ualign = { type: -1, record: 10, abuse: 0 };
    game.u.uconduct = {};
    const meatball = {
        otyp: MEATBALL,
        oclass: 7,
        name: 'meatball',
        invlet: 'a',
        quan: 1,
        quantity: 1,
        age: game.moves,
        where: 'inventory',
    };
    game.inventory = [meatball];
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.uconduct.unvegetarian, 1);
    assert.equal(game.u.ualign.record, 10);
    assert.equal(game.u.ualign.abuse, 0);
    assert.doesNotMatch(game._pending_message, /guilty/);
});

test('rotten carried meat retains the preceding Monk guilt outcome',
    async () => {
        freshWeaponArena();
        initRng(45300n);
        game.urole = { key: 'monk' };
        game.u.ualign = { type: 0, record: 10, abuse: 0 };
        game.u.uconduct = {};
        const meatball = {
            otyp: MEATBALL,
            oclass: 7,
            name: 'meatball',
            invlet: 'a',
            quan: 1,
            quantity: 1,
            age: game.moves,
            where: 'inventory',
            cursed: true,
        };
        game.inventory = [meatball];
        pushKey('a');

        await rhack('e'.charCodeAt(0));

        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.u.ualign.abuse, 1);
        assert.match(game._pending_message, /You feel guilty\./);
        assert.match(game._pending_message, /Rotten food!/);
    });
