import test from 'node:test';
import assert from 'node:assert/strict';

import { continueCountedCommand, rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { CORPSE, MEATBALL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { PM_GREEN_SLIME } from '../js/slime.js';
import {
    carriedObject, floorObject,
} from './support/game-objects.js';
import { freshWeaponArena } from './support/weapon-arena.js';

test('a carried meat corpse applies the live Monk conduct penalty', async () => {
    freshWeaponArena();
    initRng(45300n);
    game.urole = { key: 'monk' };
    game.u.ualign = { type: 0, record: 10, abuse: 0 };
    game.u.uconduct = {};
    game.u.uhunger = 900;
    const corpse = carriedObject(CORPSE, {
        corpsenm: 70,
        name: 'goblin corpse',
        age: game.moves,
    });
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

test('finishing a green slime corpse starts the transformation countdown',
    async () => {
        freshWeaponArena();
        initRng(45300n);
        const corpse = carriedObject(CORPSE, {
            corpsenm: PM_GREEN_SLIME,
            name: 'green slime corpse',
            age: game.moves,
        });
        game.inventory = [corpse];
        pushKey('a');

        await rhack('e'.charCodeAt(0));
        pushKey(' ');
        pushKey(' ');
        for (let turn = 0; turn < 10 && game._occupation; turn++)
            await continueCountedCommand(game);

        assert.equal(game.u.slimedTurns, 10);
        assert.equal(game.inventory.includes(corpse), false);
        assert.match(game._pending_message, /You don't feel very well\.$/);
    });

test('a floor meat corpse keeps the same Monk penalty and floor lifecycle',
    async () => {
        const level = freshWeaponArena();
        initRng(45300n);
        game.urole = { key: 'monk' };
        game.u.ualign = { type: 0, record: 10, abuse: 0 };
        game.u.uconduct = {};
        const corpse = floorObject(CORPSE, 10, 10, {
            corpsenm: 70,
            name: 'goblin corpse',
            age: game.moves,
        });
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
    const meatball = carriedObject(MEATBALL, {
        age: game.moves,
    });
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
    const meatball = carriedObject(MEATBALL, {
        age: game.moves,
    });
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
        const meatball = carriedObject(MEATBALL, {
            age: game.moves,
            cursed: true,
        });
        game.inventory = [meatball];
        pushKey('a');

        await rhack('e'.charCodeAt(0));

        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.u.ualign.abuse, 1);
        assert.match(game._pending_message, /You feel guilty\./);
        assert.match(game._pending_message, /Rotten food!/);
    });
