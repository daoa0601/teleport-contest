import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MENU_TRADITIONAL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { nhgetch } from '../js/input.js';
import { ARROW, CLUB, FOOD_RATION } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('traditional pickup recall reuses a no answer after asking for classes again', async () => {
    const input = freshTurnRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const food = await floorObject(FOOD_RATION, 10, 10);
    const club = await floorObject(CLUB, 10, 10);
    const arrow = await floorObject(ARROW, 10, 10);
    await answerPrompts(rhack(','.charCodeAt(0)), input, [
        { prompt: /several objects here\.--More--/, keys: ' ' },
        { prompt: /What kinds of thing/, keys: ')\n' },
        { prompt: /Pick up .*arrow\?/, keys: 'n' },
        { prompt: /Pick up .*club\?/, keys: 'y' },
    ]);
    assert.equal(club.where, 'inventory');
    const repeat = rhack(1);
    try {
        await answerPrompts(repeat, input, [
            { prompt: /several objects here\.--More--/, keys: ' ' },
            { prompt: /What kinds of thing/, keys: ')\nh' },
        ]);
    }
    finally {
        input.feed('q');
        await repeat;
    }
    assert.equal(arrow.where, 'floor');
    assert.equal(food.where, 'floor');
    assert.equal(game.context.move, 0, 'the recalled no answer attempts no pickup');
    assert.equal(await nhgetch(), 'h'.charCodeAt(0));
});
void test('traditional pickup recall reuses yes and quit answers on the remaining objects', async () => {
    const input = freshTurnRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const food = await floorObject(FOOD_RATION, 10, 10);
    const club = await floorObject(CLUB, 10, 10);
    const arrow = await floorObject(ARROW, 10, 10);
    await answerPrompts(rhack(','.charCodeAt(0)), input, [
        { prompt: /several objects here\.--More--/, keys: ' ' },
        { prompt: /What kinds of thing/, keys: 'A\n' },
        { prompt: /Pick up .*arrow\?/, keys: 'y' },
        { prompt: /arrow.*--More--/, keys: ' ' },
        { prompt: /Pick up .*club\?/, keys: 'q' },
    ]);
    assert.equal(arrow.where, 'inventory');
    assert.equal(club.where, 'floor');
    const repeat = rhack(1);
    try {
        await answerPrompts(repeat, input, [
            { prompt: /several objects here\.--More--/, keys: ' ' },
            { prompt: /What kinds of thing/, keys: 'A\nh' },
        ]);
    }
    finally {
        input.feed('q');
        await repeat;
    }
    assert.equal(club.where, 'inventory');
    assert.equal(food.where, 'floor');
    assert.equal(game.context.move, 1);
    assert.equal(await nhgetch(), 'h'.charCodeAt(0));
});
void test('traditional pickup recall reuses all without asking about each remaining weapon', async () => {
    const input = freshTurnRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const food = await floorObject(FOOD_RATION, 10, 10);
    await floorObject(ARROW, 10, 10);
    await answerPrompts(rhack(','.charCodeAt(0)), input, [
        { prompt: /several objects here\.--More--/, keys: ' ' },
        { prompt: /What kinds of thing/, keys: 'A\n' },
        { prompt: /Pick up .*arrow\?/, keys: 'a' },
    ]);
    const club = await floorObject(CLUB, 10, 10);
    await floorObject(ARROW, 10, 10);
    const repeat = rhack(1);
    try {
        await answerPrompts(repeat, input, [
            { prompt: /several objects here\.--More--/, keys: ' ' },
            { prompt: /What kinds of thing/, keys: 'A\nh' },
        ]);
    }
    finally {
        input.feed('q');
        await repeat;
    }
    assert.equal(club.where, 'inventory');
    assert.equal(game.inventory.find(object => object.otyp === ARROW)?.quan, 2);
    assert.equal(food.where, 'floor');
    assert.equal(game.context.move, 1);
    assert.equal(await nhgetch(), 'h'.charCodeAt(0));
});
for (const anotherAnswer of [false, true]) {
    void test(`traditional pickup recall ${anotherAnswer ? 'uses zero after a later nonnumeric answer' : 'reuses the last numeric answer'}`, async () => {
        const input = freshTurnRoom({ flags: { menu_style: MENU_TRADITIONAL } });
        const other = await floorObject(anotherAnswer ? CLUB : FOOD_RATION, 10, 10);
        const arrows = await floorObject(ARROW, 10, 10, { quantity: 5 });
        await answerPrompts(rhack(','.charCodeAt(0)), input, [
            { prompt: /several objects here\.--More--/, keys: ' ' },
            { prompt: /What kinds of thing/, keys: ')\n' },
            { prompt: /Pick up .*arrows\?/, keys: '2\n' },
            ...(anotherAnswer ? [
                { prompt: /arrows.*--More--/, keys: ' ' },
                { prompt: /Pick up .*club\?/, keys: 'n' },
            ] : []),
        ]);
        assert.equal(arrows.quan, 3);
        const repeat = rhack(1);
        try {
            await answerPrompts(repeat, input, [
                { prompt: /several objects here\.--More--/, keys: ' ' },
                { prompt: /What kinds of thing/, keys: ')\nh' },
            ]);
        }
        finally {
            input.feed('q');
            await repeat;
        }
        assert.equal(arrows.quan, anotherAnswer ? 3 : 1);
        assert.equal(game.inventory.find(object => object.otyp === ARROW)?.quan, anotherAnswer ? 2 : 4);
        assert.equal(other.where, 'floor');
        assert.equal(game.context.move, anotherAnswer ? 0 : 1);
        assert.equal(await nhgetch(), 'h'.charCodeAt(0));
    });
}
//# sourceMappingURL=traditional_pickup_recall.test.js.map