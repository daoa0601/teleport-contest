import test from 'node:test';
import assert from 'node:assert/strict';

import { continueCountedCommand, rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import {
    CORPSE, FOOD_RATION, GLOB_OF_GREEN_SLIME, MEATBALL,
} from '../js/object_data.js';
import { PM_GREEN_SLIME } from '../js/slime.js';
import {
    floorObject, addInventoryObject,
} from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

test('a carried meat corpse applies the live Monk conduct penalty', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    game.urole = { key: 'monk' };
    game.u.ualign = { type: 0, record: 10, abuse: 0 };
    game.u.uconduct = {};
    game.u.uhunger = 900;
    const corpse = addInventoryObject(CORPSE, {
        corpsenm: 70,
        name: 'goblin corpse',
        age: game.moves,
    });
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

test('the first bite of green slime starts the transformation countdown',
    async () => {
        freshObjectRoom({ gameplaySeed: 45300n });
        const corpse = addInventoryObject(CORPSE, {
            corpsenm: PM_GREEN_SLIME,
            name: 'green slime corpse',
            age: game.moves,
        });
        pushKey('a');

        await rhack('e'.charCodeAt(0));
        assert.equal(game.u.slimedTurns, 10);
        assert.equal(game.inventory.includes(corpse), true);
        assert.match(game._pending_message, /You don't feel very well\.$/);

        pushKey(' ');
        pushKey(' ');
        for (let turn = 0; turn < 10 && game._occupation; turn++)
            await continueCountedCommand(game);

        assert.equal(game.u.slimedTurns, 10);
        assert.equal(game.inventory.includes(corpse), false);
        assert.match(
            game._pending_message,
            /finish eating the green slime corpse/,
        );
    });

test('a food ration remains in the pack until its last bite', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    game.u.uhunger = 900;
    const ration = addInventoryObject(FOOD_RATION, { age: game.moves });
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.inventory.includes(ration), true);
    assert.equal(game.u.uhunger, 1060);
    assert.equal(game._occupation?.key, 'eat-food');

    for (let bite = 1; bite < 5; bite++)
        await continueCountedCommand(game);

    assert.equal(game.inventory.includes(ration), true);
    assert.equal(game.u.uhunger, 1700);

    pushKey(' ');
    await continueCountedCommand(game);

    assert.equal(game.inventory.includes(ration), false);
    assert.equal(game._occupation, null);
    assert.match(game._pending_message, /finish eating the food ration/);
});

test('a green slime glob is a multi-turn slime meal', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    const glob = addInventoryObject(GLOB_OF_GREEN_SLIME, {
        age: game.moves,
    });
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.slimedTurns, 10);
    assert.equal(game.inventory.includes(glob), true);
    assert.equal(game._occupation?.key, 'eat-food');

    pushKey(' ');
    for (let turn = 0; turn < 3; turn++)
        await continueCountedCommand(game);

    assert.equal(game.inventory.includes(glob), false);
    assert.equal(game._occupation, null);
    assert.match(
        game._pending_message,
        /finish eating the glob of green slime/,
    );
});

test('a floor meat corpse keeps the same Monk penalty and floor lifecycle',
    async () => {
        const level = freshObjectRoom({ gameplaySeed: 45300n });
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
    freshObjectRoom({ gameplaySeed: 45300n });
    game.urole = { key: 'monk' };
    game.u.ualign = { type: 0, record: 10, abuse: 0 };
    game.u.uconduct = {};
    const meatball = addInventoryObject(MEATBALL, {
        age: game.moves,
    });
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
    freshObjectRoom({ gameplaySeed: 45300n });
    game.urole = { key: 'rogue' };
    game.u.ualign = { type: -1, record: 10, abuse: 0 };
    game.u.uconduct = {};
    const meatball = addInventoryObject(MEATBALL, {
        age: game.moves,
    });
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.uconduct.unvegetarian, 1);
    assert.equal(game.u.ualign.record, 10);
    assert.equal(game.u.ualign.abuse, 0);
    assert.doesNotMatch(game._pending_message, /guilty/);
});

test('rotten carried meat retains the preceding Monk guilt outcome',
    async () => {
        freshObjectRoom({ gameplaySeed: 45300n });
        game.urole = { key: 'monk' };
        game.u.ualign = { type: 0, record: 10, abuse: 0 };
        game.u.uconduct = {};
        const meatball = addInventoryObject(MEATBALL, {
            age: game.moves,
            cursed: true,
        });
        pushKey('a');

        await rhack('e'.charCodeAt(0));

        assert.equal(game.u.ualign.record, 9);
        assert.equal(game.u.ualign.abuse, 1);
        assert.match(game._pending_message, /You feel guilty\./);
        assert.match(game._pending_message, /Rotten food!/);
    });
