import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU_COMBINATION, MENU_TRADITIONAL } from '../js/const.js';
import { useContainer } from '../js/container.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { ARROW, CLUB, FOOD_RATION, LOADSTONE, SACK } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('traditional take-out asks for classes and counts even for one contained stack', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const sack = await addInventoryObject(SACK, { invlet: 'a', cknown: true });
    const arrows = await knownObject(ARROW, { where: 'contained', container: sack, quantity: 5 });
    sack.contents = [arrows];
    const input = resetInputState();
    const action = useContainer(sack, { held: true });
    try {
        await input.waitUntilBlocked();
        input.feed('o');
        await input.waitUntilBlocked();
        assert.equal(topline(), 'What kinds of thing do you want to take out? [)mU]');
        input.feed(')\n');
        await input.waitUntilBlocked();
        assert.match(topline(), /^Take out: .*arrows\? \[yn#aq\] \(n\)/);
    }
    finally {
        input.feed('2\n' + ' '.repeat(12));
    }
    const result = await action;
    assert.equal(game.inventory.find(object => object.otyp === ARROW)?.quan, 2);
    assert.equal(arrows.quan, 3);
    assert.equal(result.spentTime, true);
    assert.match(topline(), /That was all\./);
});
void test('traditional take-out cancellation preserves unknown contents and spends no turn', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const sack = await addInventoryObject(SACK, { invlet: 'a', cknown: false });
    const arrow = await knownObject(ARROW, { where: 'contained', container: sack });
    sack.contents = [arrow];
    pushKeys('o\x1b');
    const result = await useContainer(sack, { held: true });
    assert.equal(sack.cknown, false);
    assert.equal(arrow.where, 'contained');
    assert.equal(result.spentTime, false);
});
void test('traditional take-out leaves a cursed loadstone stack whole after a numeric answer', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const sack = await addInventoryObject(SACK, { invlet: 'a', cknown: true });
    const stones = await knownObject(LOADSTONE, { where: 'contained', container: sack, quantity: 5, cursed: true });
    sack.contents = [stones];
    pushKeys('o*\n2\n' + ' '.repeat(12));
    const result = await useContainer(sack, { held: true });
    assert.equal(stones.quan, 5);
    assert.equal(stones.where, 'inventory');
    assert.equal(sack.contents.length, 0);
    assert.equal(result.spentTime, true);
});
void test('traditional put-in a accepts remaining classes and excludes the container itself', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const sack = await addInventoryObject(SACK, { invlet: 'a', cknown: true });
    const club = await addInventoryObject(CLUB, { invlet: 'b' });
    const food = await addInventoryObject(FOOD_RATION, { invlet: 'c' });
    pushKeys('iA\na' + ' '.repeat(20));
    const result = await useContainer(sack, { held: true });
    assert.equal(sack.where, 'inventory');
    assert.equal(sack.contents?.includes(club), true);
    assert.equal(sack.contents?.includes(food), true);
    assert.equal(result.spentTime, true);
});
void test('traditional put-in reports no applicable objects when only its own class was selected', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const sack = await addInventoryObject(SACK, { invlet: 'a', cknown: true });
    const club = await addInventoryObject(CLUB, { invlet: 'b' });
    pushKeys('i(a\n' + ' '.repeat(12));
    const result = await useContainer(sack, { held: true });
    assert.equal(club.where, 'inventory');
    assert.equal(result.spentTime, false);
    assert.match(topline(), /No applicable objects\./);
});
void test('traditional take-out supports an item-menu fallback with an unpaid filter', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const sack = await addInventoryObject(SACK, { invlet: 'a', cknown: false });
    const arrow = await knownObject(ARROW, { where: 'contained', container: sack, unpaid: true });
    const food = await knownObject(FOOD_RATION, { where: 'contained', container: sack });
    sack.contents = [arrow, food];
    pushKeys('oum\na\n' + ' '.repeat(12));
    const result = await useContainer(sack, { held: true });
    assert.equal(arrow.where, 'inventory');
    assert.equal(food.where, 'contained');
    assert.equal(sack.cknown, true);
    assert.equal(result.spentTime, true);
});
void test('combination container transfers use the item menu after the action prompt', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_COMBINATION } });
    const sack = await addInventoryObject(SACK, { invlet: 'a', cknown: true });
    const arrow = await knownObject(ARROW, { where: 'contained', container: sack });
    sack.contents = [arrow];
    const input = resetInputState();
    const action = useContainer(sack, { held: true });
    try {
        await input.waitUntilBlocked();
        input.feed('o');
        await input.waitUntilBlocked();
        assert.match(topline(), /Take out what\?/);
    }
    finally {
        input.feed('\x1b');
        await action;
    }
    assert.equal(arrow.where, 'contained');
});
void test('looking through a traditional class query learns the contents without taking anything', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const sack = await addInventoryObject(SACK, { invlet: 'a', cknown: false });
    const arrow = await knownObject(ARROW, { where: 'contained', container: sack });
    const food = await knownObject(FOOD_RATION, { where: 'contained', container: sack });
    sack.contents = [arrow, food];
    pushKeys('o:\n \x1b');
    const result = await useContainer(sack, { held: true });
    assert.equal(sack.cknown, true);
    assert.equal(arrow.where, 'contained');
    assert.equal(food.where, 'contained');
    assert.equal(result.spentTime, false);
});
void test('looking at a lone contained item uses a top-line message before the next class query', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const sack = await addInventoryObject(SACK, { invlet: 'a', cknown: false });
    const arrow = await knownObject(ARROW, { where: 'contained', container: sack });
    sack.contents = [arrow];
    const input = resetInputState();
    input.feed('o:\n');
    const action = useContainer(sack, { held: true });
    try {
        await input.waitUntilBlocked();
        assert.match(topline(), /arrow.*--More--/);
    }
    finally {
        input.feed(' \x1b');
    }
    const result = await action;
    assert.equal(sack.cknown, true);
    assert.equal(arrow.where, 'contained');
    assert.equal(result.spentTime, false);
});
function topline() {
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim() ?? '';
}
//# sourceMappingURL=traditional_container.test.js.map