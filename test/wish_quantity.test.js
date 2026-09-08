import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { readObjectName } from '../js/objnam.js';
import { makeWish } from '../js/wish.js';
import { freshObjectRoom } from './support/object-room.js';

for (const request of ['rock', '1 rock']) {
    test(`wishing for "${request}" gives one rock instead of a generated stack`, async () => {
        freshObjectRoom({ gameplaySeed: 6101 });

        const { object } = await readObjectName(request);

        assert.equal(object.quan, 1);
        assert.equal(object.owt, 10);
    });
}

for (const wizardWish of [false, true]) {
    test(`${wizardWish ? 'wizard' : 'ordinary'} wishes cannot stack long swords`, async () => {
        freshObjectRoom({ gameplaySeed: 6102 });

        const { object } = await readObjectName('3 long swords', { wizardWish });

        assert.equal(object.quan, 1);
    });
}

for (const [request, count] of [['20 arrows', 20], ['7 wax candles', 7]]) {
    test(`an ordinary wish can supply ${request}`, async () => {
        freshObjectRoom({ gameplaySeed: 6103 });

        const { object } = await readObjectName(request);

        assert.equal(object.quan, count);
    });
}

test('an excessive ammunition wish keeps the normal generated stack', async () => {
    freshObjectRoom({ gameplaySeed: 6104 });

    const { object } = await readObjectName('1000 arrows');

    assert.ok(object.quan >= 6 && object.quan <= 11, `received ${object.quan} arrows`);
});

test('wizard wishes can supply large ammunition stacks', async () => {
    freshObjectRoom({ gameplaySeed: 6104 });

    const { object } = await readObjectName('1000 arrows', { wizardWish: true });

    assert.equal(object.quan, 1000);
    assert.equal(object.owt, 1000);
});

for (const [wizardWish, amount, weight] of [[false, 5000, 50], [true, 10000, 100]]) {
    test(`${wizardWish ? 'wizard' : 'ordinary'} gold wishes use the appropriate limit`, async () => {
        freshObjectRoom();

        const { object } = await readObjectName('10000 gold pieces', { wizardWish });

        assert.equal(object.quan, amount);
        assert.equal(object.owt, weight);
    });
}

test('a count of globs increases one glob\'s weight instead of its stack size', async () => {
    freshObjectRoom({ gameplaySeed: 6105 });

    const result = await readObjectName('2 medium globs of gray ooze');

    assert.ok(result, 'the named glob was not recognized');
    assert.equal(result.object.quan, 1);
    assert.equal(result.object.owt, 240);
});

test('an ordinary glob wish respects the limit for very large globs', async () => {
    freshObjectRoom({ gameplaySeed: 6106 });

    const result = await readObjectName('10 very large gray ooze globs');

    assert.ok(result, 'the inverted glob name was not recognized');
    assert.equal(result.object.quan, 1);
    assert.equal(result.object.owt, 1040);
});

for (const [answer, weight] of [['y', 5200], ['n', 1040]]) {
    test(`a wizard can ${answer === 'y' ? 'override' : 'keep'} the glob weight limit`, async () => {
        freshObjectRoom({ gameplaySeed: 6107 });
        pushKey(answer);

        const result = await readObjectName('10 very large globs of gray ooze', {
            wizardWish: true,
        });

        assert.ok(result, 'the named glob was not recognized');
        assert.equal(result.object.quan, 1);
        assert.equal(result.object.owt, weight);
    });
}

test('a wish grants the requested single rock to the hero', async () => {
    freshObjectRoom({ gameplaySeed: 6108 });
    pushKeys('1 rock\n');

    await makeWish();

    const rocks = game.inventory.filter(object => object.otyp === ROCK);
    assert.equal(rocks.length, 1);
    assert.equal(rocks[0].quan, 1);
});
