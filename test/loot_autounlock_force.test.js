import assert from 'node:assert/strict';
import test from 'node:test';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_FORCE, AUTOUNLOCK_KICK, AUTOUNLOCK_UNTRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { CHEST, CLUB, LARGE_BOX, SKELETON_KEY, TOWEL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
for (const answer of ['y', 'n', 'q']) {
    void test(`looting a locked chest offers forcing without a key and handles '${answer}'`, async () => {
        await freshObjectRoom({ flags: { autounlock: AUTOUNLOCK_APPLY_KEY | AUTOUNLOCK_FORCE } });
        game.uwep = game.u.uwep = await addInventoryObject(CLUB);
        const chest = await floorObject(CHEST, 10, 10, {
            initialize: false, olocked: true, lknown: false, bknown: false,
        });
        game.u.dz = -1;
        const input = resetInputState();
        pushKeys('loot\n');
        await answerPrompts(rhack('#'.charCodeAt(0)), input, []);
        assert.equal(chest.lknown, true);
        assert.equal(chest.olocked, true);
        assert.equal(game.context.move, 0, 'discovering the lock takes no turn');
        await answerPrompts(rhack(0), input, [
            { prompt: /Hmmm, the chest turns out to be locked\.--More--/, keys: ' ' },
            { prompt: /There is a locked chest here; force its lock\?/, keys: answer },
        ]);
        assert.equal(game.u.dz, 0, 'looting clears the previous vertical direction');
        assert.equal(chest.olocked, true, 'the offer itself does not force the lock');
        assert.equal(game.context.move, answer === 'q' ? 0 : 1);
        assert.equal(Boolean(game._occupation), answer === 'y');
        assert.equal(game._pending_message, answer === 'y'
            ? 'You start bashing it with your club.' : answer === 'n'
            ? 'You decide not to force the issue.' : '');
        if (answer === 'y') {
            initRng(1n);
            await continueCountedCommand();
            assert.equal(chest.olocked, true, 'an unsuccessful forcing turn leaves the chest locked');
            assert.equal(game._occupation?.key, 'force-lock');
            assert.equal(game.context.move, 1);
        }
    });
}
void test('declining an available key does not fall back to forcing', async () => {
    await freshObjectRoom({ flags: { autounlock: AUTOUNLOCK_APPLY_KEY | AUTOUNLOCK_FORCE } });
    game.uwep = game.u.uwep = await addInventoryObject(CLUB);
    await addInventoryObject(SKELETON_KEY);
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, olocked: true });
    const input = resetInputState();
    pushKeys('loot\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /Hmmm, the chest turns out to be locked\.--More--/, keys: ' ' },
        { prompt: /Unlock it with your skeleton key\?/, keys: 'n' },
    ]);
    assert.equal(game.context.move, 0);
    await answerPrompts(rhack('.'.charCodeAt(0)), input, []);
    assert.equal(game.context.move, 1, 'the next typed command runs without a force offer');
    assert.equal(Boolean(game._occupation), false);
    assert.equal(chest.olocked, true);
});
void test('quitting an automatic trap check does not fall back to forcing', async () => {
    await freshObjectRoom({ flags: { autounlock: AUTOUNLOCK_UNTRAP | AUTOUNLOCK_FORCE } });
    game.uwep = game.u.uwep = await addInventoryObject(CLUB);
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, olocked: true, tknown: false });
    const input = resetInputState();
    pushKeys('loot\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /Hmmm, the chest turns out to be locked\.--More--/, keys: ' ' },
        { prompt: /Check .*chest for a trap\?/, keys: 'q' },
    ]);
    assert.equal(game.context.move, 0);
    await answerPrompts(rhack('.'.charCodeAt(0)), input, []);
    assert.equal(Boolean(game._occupation), false);
    assert.equal(chest.olocked, true);
});
for (const { name, setting, weapon } of [
    { name: 'apply-key alone', setting: AUTOUNLOCK_APPLY_KEY, weapon: CLUB },
    { name: 'kick alone', setting: AUTOUNLOCK_KICK, weapon: CLUB },
    { name: 'force with an unsuitable weapon', setting: AUTOUNLOCK_FORCE, weapon: TOWEL },
]) {
    void test(`looting with ${name} does not offer forcing`, async () => {
        await freshObjectRoom({ flags: { autounlock: setting } });
        game.uwep = game.u.uwep = await addInventoryObject(weapon);
        const chest = await floorObject(CHEST, 10, 10, { initialize: false, olocked: true });
        const input = resetInputState();
        pushKeys('loot\n');
        await answerPrompts(rhack('#'.charCodeAt(0)), input, []);
        assert.equal(game.context.move, 0);
        assert.equal(chest.lknown, true);
        await answerPrompts(rhack('.'.charCodeAt(0)), input, []);
        assert.equal(game.context.move, 1);
        assert.equal(Boolean(game._occupation), false);
        assert.equal(chest.olocked, true);
    });
}
void test('selecting several locked containers does not offer forcing', async () => {
    await freshObjectRoom({ flags: { autounlock: AUTOUNLOCK_FORCE } });
    game.uwep = game.u.uwep = await addInventoryObject(CLUB);
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, olocked: true });
    const box = await floorObject(LARGE_BOX, 10, 10, { initialize: false, olocked: true });
    const input = resetInputState();
    pushKeys('loot\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /Loot which containers\?/, keys: 'ab\n' },
        { prompt: /--More--/, keys: ' ' },
    ]);
    assert.equal(game.context.move, 0);
    assert.equal(chest.lknown, true);
    assert.equal(box.lknown, true);
    await answerPrompts(rhack('.'.charCodeAt(0)), input, []);
    assert.equal(Boolean(game._occupation), false);
    assert.equal(chest.olocked, true);
    assert.equal(box.olocked, true);
});
void test('forcing after looting one selected chest still offers the first floor box', async () => {
    await freshObjectRoom({ flags: { autounlock: AUTOUNLOCK_FORCE } });
    game.uwep = game.u.uwep = await addInventoryObject(CLUB);
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, olocked: true, bknown: false });
    const box = await floorObject(LARGE_BOX, 10, 10, { initialize: false, olocked: true, bknown: false });
    const input = resetInputState();
    pushKeys('loot\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /Loot which containers\?/, keys: 'b\n' },
    ]);
    assert.equal(chest.lknown, true);
    assert.equal(Boolean(box.lknown), false, 'the first box in the pile was not selected for looting');
    assert.equal(game.context.move, 0);
    await answerPrompts(rhack(0), input, [
        { prompt: /Hmmm, the chest turns out to be locked\.--More--/, keys: ' ' },
        { prompt: /There is a large box here; force its lock\?/, keys: 'q' },
    ]);
    assert.equal(box.lknown, true, 'the ordinary force command offers the first floor box');
    assert.equal(game.context.move, 0);
    assert.equal(Boolean(game._occupation), false);
    assert.equal(chest.olocked, true);
    assert.equal(box.olocked, true);
});
//# sourceMappingURL=loot_autounlock_force.test.js.map