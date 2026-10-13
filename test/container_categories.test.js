import assert from 'node:assert/strict';
import test from 'node:test';
import { useContainer } from '../js/container.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CHEST, CLUB, POT_HEALING } from '../js/object_data.js';
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
//# sourceMappingURL=container_categories.test.js.map