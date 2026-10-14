import assert from 'node:assert/strict';
import test from 'node:test';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { flushPendingTopline } from '../js/display.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { CHEST, CLUB, DAGGER, OBJECT_NAMES, BOULDER, TOWEL } from '../js/object_data.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
void test('forcing while levitating refuses before asking about a chest', async () => {
    freshObjectRoom({ hero: { levitating: true } });
    game.uwep = game.u.uwep = await addInventoryObject(DAGGER);
    const chest = await floorObject(CHEST, 10, 10, { olocked: true });
    pushKeys('force\nq');
    await rhack('#'.charCodeAt(0));
    assert.equal(game._pending_message, "You can't reach the floor.");
    assert.equal(game.context.move, 0);
    assert.equal(chest.olocked, true);
});
for (const type of [TOWEL, OBJECT_NAMES.indexOf('flail')]) {
    void test(`forcing with ${type === TOWEL ? 'a nonweapon' : 'a flail'} gives the native refusal`, async () => {
        freshObjectRoom();
        game.uwep = game.u.uwep = await addInventoryObject(type);
        pushKeys('force\n');
        await rhack('#'.charCodeAt(0));
        assert.equal(game._pending_message, type === TOWEL ? "You can't force anything without a proper weapon." : "You can't force anything with that weapon.");
        assert.equal(game.context.move, 0);
    });
}
void test('a forcing prompt does not disclose an unknown locked chest before the question', async () => {
    freshObjectRoom();
    game.uwep = game.u.uwep = await addInventoryObject(DAGGER);
    const chest = await floorObject(CHEST, 10, 10, { olocked: true, lknown: false, bknown: false });
    const input = resetInputState();
    pushKeys('force\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [{ prompt: /There is a chest here; force its lock\?/, keys: 'q' }]);
    assert.equal(chest.lknown, true);
    assert.equal(chest.olocked, true);
});
void test('a stopped forcing attempt resumes without another chest question', async () => {
    freshObjectRoom();
    game.uwep = game.u.uwep = await addInventoryObject(BOULDER);
    const chest = await floorObject(CHEST, 10, 10, { olocked: true });
    pushKeys('force\ny');
    await rhack('#'.charCodeAt(0));
    initRng(1n);
    await continueCountedCommand();
    assert.equal(chest.olocked, true);
    await stopHeroOccupation();
    pushKeys('force\nq ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game._occupation?.key, 'force-lock');
    assert.match(game._pending_message, /You resume your attempt to force the lock\./);
});
void test('walking away and back requires a fresh chest forcing question', async () => {
    freshObjectRoom();
    game.uwep = game.u.uwep = await addInventoryObject(CLUB);
    const chest = await floorObject(CHEST, 10, 10, { olocked: true, obroken: false });
    const input = resetInputState();
    pushKeys('force\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [{ prompt: /here; force its lock\?/, keys: 'y' }]);
    initRng(1n);
    await continueCountedCommand();
    await stopHeroOccupation();
    await answerPrompts(flushPendingTopline(), input, [{ prompt: /--More--/, keys: ' ' }]);
    await rhack('h'.charCodeAt(0));
    assert.equal(game.u.ux, 9);
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    pushKeys('force\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [{ prompt: /here; force its lock\?/, keys: 'n' }]);
    assert.equal(game._occupation, null);
    assert.equal(chest.olocked, true);
    assert.equal(chest.obroken, false);
});
void test('breaking a shop chest lock bills only the chest', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const { shopkeeper } = await createStaffedShop({ left: 8, right: 14, top: 8, bottom: 12, keeperX: 13 });
    const dagger = await addInventoryObject(DAGGER, { spe: 10 });
    game.uwep = game.u.uwep = dagger;
    const chest = await floorObject(CHEST, 10, 10, { olocked: true, contents: [] });
    pushKeys('force\ny' + ' '.repeat(30));
    await rhack('#'.charCodeAt(0));
    for (let turn = 0; game._occupation && turn < 51; turn++)
        await continueCountedCommand();
    assert.equal(chest.obroken, true);
    assert.equal(chest.olocked, false);
    assert.ok(shopkeeper.eshk.bill.some(entry => entry.useup), 'the damaged chest remains charged as a used-up bill item');
});
//# sourceMappingURL=force_lock_limits.test.js.map