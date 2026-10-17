import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU_COMBINATION, MENU_PARTIAL, MENU_TRADITIONAL } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { pickupAtHero } from '../js/pickup.js';
import { ARROW, CLUB, FOOD_RATION, GOLD_PIECE, POT_HEALING } from '../js/object_data.js';
import { recordObjectCall } from '../js/object_knowledge.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('traditional pickup takes a lone stack without prompting', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const arrows = await floorObject(ARROW, 10, 10, { quantity: 3 });
    await pickupAtHero();
    assert.equal(arrows.where, 'inventory');
    assert.equal(game.context.move, 1);
});
void test('a traditional command count takes at most the lone stack quantity', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const arrows = await floorObject(ARROW, 10, 10, { quantity: 3 });
    await pickupAtHero(9);
    assert.equal(arrows.where, 'inventory');
    assert.equal(arrows.quan, 3);
    assert.equal(game.context.move, 1);
});
void test('traditional pickup announces a pile, then Escape cancels the class query without a turn', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const food = await floorObject(FOOD_RATION, 10, 10, { bknown: false });
    const arrows = await floorObject(ARROW, 10, 10, { bknown: false });
    const previous = await addInventoryObject(CLUB, { pickup_prev: true });
    const input = resetInputState();
    const action = pickupAtHero();
    try {
        await input.waitUntilBlocked();
        assert.equal(topline(), 'There are several objects here.--More--');
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.equal(topline(), 'What kinds of thing do you want to pick up? [)% aA:mX]');
    }
    finally {
        input.feed('\x1b\x1bq');
        await action;
    }
    assert.equal(food.where, 'floor');
    assert.equal(arrows.where, 'floor');
    assert.equal(game.context.move, 0);
    assert.equal(previous.pickup_prev, true);
});
for (const style of [MENU_COMBINATION, MENU_PARTIAL]) {
    void test(`pickup style ${style} goes directly to the item menu`, async () => {
        freshPlayableRoom({ flags: { menu_style: style } });
        await floorObject(FOOD_RATION, 10, 10);
        await floorObject(ARROW, 10, 10);
        const input = resetInputState();
        const action = pickupAtHero();
        try {
            await input.waitUntilBlocked();
            assert.match(topline(), /Pick up what\?/);
        }
        finally {
            input.feed('\x1b');
            await action;
        }
        assert.equal(game.context.move, 0);
    });
}
for (const { response, foodPicked } of [
    { response: 'a', foodPicked: true },
    { response: ')a', foodPicked: false },
    { response: 'A\na', foodPicked: false },
]) {
    void test(`traditional pickup handles ${JSON.stringify(response)} with native class scope`, async () => {
        freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
        const food = await floorObject(FOOD_RATION, 10, 10);
        const club = await floorObject(CLUB, 10, 10);
        const arrows = await floorObject(ARROW, 10, 10, { quantity: 3 });
        pushKeys(` ${response}\n${' '.repeat(20)}`);
        await pickupAtHero();
        assert.equal(arrows.where, 'inventory');
        assert.equal(club.where, 'inventory');
        assert.equal(food.where, foodPicked ? 'inventory' : 'floor');
        assert.equal(game.context.move, 1);
    });
}
void test('traditional pickup accepts a count at an object prompt and resets the prior just-picked flags', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const previous = await addInventoryObject(FOOD_RATION, { pickup_prev: true });
    const club = await floorObject(CLUB, 10, 10);
    const arrows = await floorObject(ARROW, 10, 10, { quantity: 5 });
    pushKeys(' )\n2\n nq' + ' '.repeat(12));
    await pickupAtHero();
    const picked = game.inventory.find(object => object.otyp === ARROW);
    assert.equal(picked?.quan, 2);
    assert.equal(picked?.pickup_prev, true);
    assert.equal(arrows.quan, 3);
    assert.equal(club.where, 'floor');
    assert.equal(previous.pickup_prev, false);
    assert.equal(game.context.move, 1);
});
void test('traditional pickup intersects BUC and object classes but explicit coins override BUC', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const coins = await floorObject(GOLD_PIECE, 10, 10, { quantity: 20 });
    const cursed = await floorObject(ARROW, 10, 10, { cursed: true });
    const food = await floorObject(FOOD_RATION, 10, 10, { cursed: true });
    const uncursed = await floorObject(CLUB, 10, 10);
    pushKeys(' a)$C\n' + ' '.repeat(20));
    await pickupAtHero();
    assert.equal(coins.where, 'inventory');
    assert.equal(cursed.where, 'inventory');
    assert.equal(food.where, 'floor');
    assert.equal(uncursed.where, 'floor');
});
void test('a filtered traditional menu fallback still asks about a sole eligible object', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const food = await floorObject(FOOD_RATION, 10, 10);
    const arrows = await floorObject(ARROW, 10, 10);
    pushKeys(' )m\n\x1b');
    await pickupAtHero();
    assert.equal(arrows.where, 'floor');
    assert.equal(food.where, 'floor');
    assert.equal(game.context.move, 0);
});
void test('traditional pickup displays many for more than ten stacks', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    for (let spe = 0; spe < 11; spe++)
        await floorObject(ARROW, 10, 10, { spe });
    const input = resetInputState();
    const action = pickupAtHero();
    try {
        await input.waitUntilBlocked();
        assert.equal(topline(), 'There are many objects here.--More--');
    }
    finally {
        input.feed(' \x1b');
        await action;
    }
    assert.equal(game.context.move, 0);
});
void test('traditional pickup defaults to yes and q stops before another object', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const food = await floorObject(FOOD_RATION, 10, 10);
    const arrows = await floorObject(ARROW, 10, 10);
    const input = resetInputState();
    input.feed(' A\n');
    const action = pickupAtHero();
    try {
        await input.waitUntilBlocked();
        assert.match(topline(), /^Pick up .*arrow\? \[ynaq\] \(y\)/);
    }
    finally {
        input.feed('\n q');
        await action;
    }
    assert.equal(arrows.where, 'inventory');
    assert.equal(food.where, 'floor');
    assert.equal(game.context.move, 1);
});
void test('traditional pickup shortens a called name before removing known attributes', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    await floorObject(FOOD_RATION, 10, 10);
    const potion = await floorObject(POT_HEALING, 10, 10, {
        typeKnown: false, known: false, blessed: true, greased: true,
    });
    const callName = 'Restorative mixture reserved for healing wounds after dangerous encounters in the deeper dungeon';
    recordObjectCall(POT_HEALING, callName);
    const input = resetInputState();
    input.feed(' A\n');
    const action = pickupAtHero();
    try {
        await input.waitUntilBlocked();
        assert.equal(topline(), 'Pick up a blessed greased potion called Restorat...? [ynaq] (y)');
    }
    finally {
        input.feed('q');
        await action;
    }
    assert.equal(potion.where, 'floor');
    assert.equal(potion.bknown, true);
    assert.equal(potion.greased, true);
    assert.equal(game._objectCallNames?.[POT_HEALING], callName);
    assert.equal(game.context.move, 0);
});
void test('traditional pickup can look at the pile and return to its class prompt', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const food = await floorObject(FOOD_RATION, 10, 10);
    const arrows = await floorObject(ARROW, 10, 10);
    const input = resetInputState();
    input.feed(' :\n');
    const action = pickupAtHero();
    try {
        await input.waitUntilBlocked();
        const prose = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(prose, /arrow/);
        assert.match(prose, /food ration/);
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.match(topline(), /^What kinds of thing do you want to pick up\?/);
    }
    finally {
        input.feed('\x1b');
        await action;
    }
    assert.equal(arrows.where, 'floor');
    assert.equal(food.where, 'floor');
    assert.equal(game.context.move, 0);
});
void test('an absent class forces one-by-one pickup even when a was also entered', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const food = await floorObject(FOOD_RATION, 10, 10);
    const arrows = await floorObject(ARROW, 10, 10);
    pushKeys(' /a\n q');
    await pickupAtHero();
    assert.equal(arrows.where, 'floor');
    assert.equal(food.where, 'floor');
    assert.equal(game.context.move, 0);
});
void test('a menu prefix overrides traditional pickup', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    game.iflags.menu_requested = true;
    await floorObject(FOOD_RATION, 10, 10);
    await floorObject(ARROW, 10, 10);
    const input = resetInputState();
    const action = pickupAtHero();
    try {
        await input.waitUntilBlocked();
        assert.match(topline(), /Pick up what\?/);
    }
    finally {
        input.feed('\x1b');
        await action;
    }
    assert.equal(game.context.move, 0);
});
void test('traditional menu fallback assigns a normal letter to coins after the first item', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL, sortpack: false, sortloot: 'n' } });
    const coins = await floorObject(GOLD_PIECE, 10, 10, { quantity: 20 });
    const arrows = await floorObject(ARROW, 10, 10);
    pushKeys(' m\nb\n' + ' '.repeat(12));
    await pickupAtHero();
    assert.equal(coins.where, 'inventory');
    assert.equal(arrows.where, 'floor');
    assert.equal(game.context.move, 1);
});
void test('a priest learns coin BUC during category filtering even when the coins do not match', async () => {
    freshPlayableRoom({ role: 'priest', flags: { menu_style: MENU_TRADITIONAL } });
    await floorObject(FOOD_RATION, 10, 10);
    const coins = await floorObject(GOLD_PIECE, 10, 10, { quantity: 20, bknown: false });
    pushKeys(' aC\n');
    await pickupAtHero();
    assert.equal(coins.bknown, true);
    assert.equal(coins.where, 'floor');
    assert.equal(game.context.move, 0);
});
void test('a missing-class notice is acknowledged before the requested pickup menu', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    await floorObject(FOOD_RATION, 10, 10);
    await floorObject(ARROW, 10, 10);
    const input = resetInputState();
    input.feed(' /m\n');
    const action = pickupAtHero();
    try {
        await input.waitUntilBlocked();
        assert.equal(topline(), "There are no /'s here.--More--");
    }
    finally {
        input.feed(' \x1b');
        await action;
    }
    assert.equal(game.context.move, 0);
});
function topline() {
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim() ?? '';
}
//# sourceMappingURL=traditional_pickup.test.js.map