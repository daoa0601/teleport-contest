import assert from 'node:assert/strict';
import test from 'node:test';

import { PARANOID_AUTOALL, PARANOID_CONFIRM } from '../js/const.js';
import { useContainer } from '../js/container.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CHEST, CLUB, LOADSTONE, POT_HEALING } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

async function filledChest() {
    freshObjectRoom();
    const chest = await addInventoryObject(CHEST, { olocked: false, otrapped: false, cknown: true });
    const club = await knownObject(CLUB, { where: 'contained', container: chest });
    const potion = await knownObject(POT_HEALING, { where: 'contained', container: chest });
    chest.contents = [club, potion];
    return { chest, club, potion };
}

void test('container category menus explain auto-selection and require another category', async () => {
    const { chest } = await filledChest();
    const input = resetInputState();
    input.feed('o');
    const looting = useContainer(chest, { held: true });
    await input.waitUntilBlocked();
    const rows = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('').trim()) || [];
    const autoSelect = rows.find(row => row.includes('Auto-select'));
    const hint = rows.find(row => row.includes('ignored unless'));
    input.feed('A\n');
    await looting;

    assert.equal(autoSelect, 'A - Auto-select every relevant item');
    assert.equal(hint, '(ignored unless some other choices are also picked)');
    assert.equal(chest.contents?.length, 2);
    assert.match(game._lastPlineMessage, /No relevant items selected/);
});

void test('auto-selecting the weapon category takes weapons without an object selection menu', async () => {
    const { chest, club, potion } = await filledChest();
    const input = resetInputState();
    input.feed('o');
    const looting = useContainer(chest, { held: true });
    await input.waitUntilBlocked();
    input.feed('A)\n');
    const result = await Promise.race([
        looting.then(value => ({ finished: true, value })),
        input.waitUntilBlocked().then(() => ({ finished: false, value: null })),
    ]);
    if (!result.finished) {
        const prompt = requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
        input.feed('\x1b');
        await looting;
        assert.fail(`Auto-selection unexpectedly asked for more input: ${prompt}`);
    }

    assert.equal(result.value?.spentTime, true);
    assert.ok(game.inventory.includes(club));
    assert.equal(chest.contents?.includes(potion), true);
});

void test('container filters require both the selected class and bless/curse status', async () => {
    const { chest, club, potion } = await filledChest();
    potion.cursed = true;
    const input = resetInputState();
    input.feed('oA)U\n');

    await useContainer(chest, { held: true });

    assert.ok(game.inventory.includes(club));
    assert.equal(chest.contents?.includes(potion), true);
});

void test('a count on a single just-picked stack stashes that many items directly', async () => {
    const { chest } = await filledChest();
    await addInventoryObject(POT_HEALING);
    const clubs = await addInventoryObject(CLUB, { quantity: 5, pickup_prev: true });
    const input = resetInputState();
    input.feed('i2P\n');
    const looting = useContainer(chest, { held: true });
    const result = await Promise.race([
        looting.then(value => ({ finished: true, value })),
        input.waitUntilBlocked().then(() => ({ finished: false, value: null })),
    ]);
    if (!result.finished) {
        input.feed('\x1b');
        await looting;
        assert.fail('A single just-picked stack should not require another object selection.');
    }

    assert.equal(clubs.quan, 3);
    const stored = chest.contents?.filter(object => object.otyp === CLUB);
    assert.equal(stored?.reduce((total, object) => total + object.quan, 0), 3);
});

void test('a just-picked held container and another item still require an item selection', async () => {
    freshObjectRoom();
    const chest = await addInventoryObject(CHEST, {
        olocked: false, otrapped: false, cknown: true, pickup_prev: true,
    });
    const club = await addInventoryObject(CLUB, { pickup_prev: true });
    await addInventoryObject(POT_HEALING);
    const input = resetInputState();
    input.feed('iP\n');
    const looting = useContainer(chest, { held: true });
    const boundary = await Promise.race([
        looting.then(() => 'finished' as const),
        input.waitUntilBlocked().then(() => 'input' as const),
    ]);
    const rows = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')) || [];
    input.feed('\x1b');
    const result = await looting;

    assert.equal(boundary, 'input', 'Two just-picked inventory items require the Put in what? menu.');
    assert.ok(rows.some(row => row.includes('Put in what?')));
    assert.ok(game.inventory.includes(club), 'Cancelling leaves the club in inventory.');
    assert.equal(chest.contents?.includes(club) ?? false, false);
    assert.equal(result.spentTime, false);
});

void test('a rejected counted just-picked selection keeps both stacks and spends a turn', async () => {
    const { chest } = await filledChest();
    await addInventoryObject(POT_HEALING);
    const stones = await addInventoryObject(LOADSTONE, {
        quantity: 5, cursed: true, pickup_prev: true,
    });
    const input = resetInputState();
    input.feed('i2P\n');

    const result = await useContainer(chest, { held: true });

    const carried = game.inventory.filter(object => object.otyp === LOADSTONE);
    assert.equal(stones.quan, 3, 'The original loadstone stack keeps the unselected three.');
    assert.equal(carried.length, 2, 'The rejected split stays in the inventory.');
    assert.equal(carried.find(object => object !== stones)?.quan, 2);
    assert.equal(chest.contents?.some(object => object.otyp === LOADSTONE), false);
    assert.equal(result.spentTime, true);
    assert.equal(game._lastPlineMessage, "The stones won't leave your person.");
});

void test('paranoid auto-selection offers quit and cancels without moving items', async () => {
    const { chest } = await filledChest();
    game.flags.paranoia_bits = PARANOID_AUTOALL | PARANOID_CONFIRM;
    const input = resetInputState();
    input.feed('oA\n');
    const looting = useContainer(chest, { held: true });
    await input.waitUntilBlocked();
    const prompt = requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
    input.feed('quit\n');

    const result = await looting;

    assert.equal(prompt, 'Really autoselect All? [yes|no|quit]');
    assert.equal(result.spentTime, false);
    assert.equal(chest.contents?.length, 2);
});

void test('a single-class category menu leaves the implied-all hint for its first eligible menu', async () => {
    const { chest, club, potion } = await filledChest();
    const cursedClub = await knownObject(CLUB, {
        cursed: true, where: 'contained', container: chest,
    });
    game.flags.paranoia_bits = PARANOID_AUTOALL;
    game.flags.cmdassist = false;
    const input = resetInputState();
    const hints: boolean[] = [];
    for (const contents of [[club, cursedClub], [club, cursedClub, potion], [club, cursedClub, potion]]) {
        chest.contents = contents;
        input.feed('o');
        const looting = useContainer(chest, { held: true });
        await input.waitUntilBlocked();
        const rows = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')) || [];
        hints.push(rows.some(row => row.includes("'a' is implied")));
        input.feed('\x1b');
        await looting;
    }

    assert.equal(hints[0], false, 'A single-class menu has no All types entry to explain.');
    assert.equal(hints[1], true, 'The first menu with All types must explain implied selection.');
    assert.equal(hints[2], false, 'With cmdassist off, the hint appears only once.');
});
