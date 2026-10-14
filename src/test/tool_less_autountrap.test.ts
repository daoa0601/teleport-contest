import assert from 'node:assert/strict';
import test from 'node:test';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { AUTOUNLOCK_UNTRAP } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { CHEST, CLUB } from '../js/object_data.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('declining autountrap and accepting unlocking without a tool spends turns but never opens the lock', async () => {
    freshObjectRoom({ flags: { autounlock: AUTOUNLOCK_UNTRAP } });
    const box = await floorObject(CHEST, 10, 10, { initialize: false, olocked: true, lknown: true, tknown: false });
    const input = resetInputState();
    pushKeys('loot\n');

    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /The chest is locked\..*--More--/, keys: ' ' },
        { prompt: /Check .*chest for a trap\?/, keys: 'n' },
        { prompt: /There is .*chest here; unlock it\?/, keys: 'y' },
    ]);

    assert.equal(game.context.move, 1);
    assert.equal(game._occupation?.key, 'pick-lock');
    await continueCountedCommand();
    await stopHeroOccupation();
    await answerPrompts(flushPendingTopline(), input, [{ prompt: /--More--/, keys: ' ' }]);
    pushKeys('loot\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, []);
    assert.match(game._pending_message, /You resume your attempt at unlocking the chest\./);
    await answerPrompts(flushPendingTopline(), input, [{ prompt: /--More--/, keys: ' ' }]);
    for (let turn = 0; game._occupation && turn < 51; turn++) await continueCountedCommand();

    assert.equal(box.olocked, true);
    assert.equal(game._occupation, null);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'You give up your attempt at unlocking the chest.');
});

void test('tool-less autounlock resumes blunt forcing and can unlock the chest without breaking it', async () => {
    freshObjectRoom({ flags: { autounlock: AUTOUNLOCK_UNTRAP } });
    game.uwep = game.u.uwep = await addInventoryObject(CLUB);
    const box = await floorObject(CHEST, 10, 10, { initialize: false, olocked: true, obroken: false });
    const input = resetInputState();
    pushKeys('force\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [{ prompt: /force its lock\?/, keys: 'y' }]);
    initRng(1n);
    await continueCountedCommand();
    assert.equal(box.olocked, true);
    await stopHeroOccupation();
    await answerPrompts(flushPendingTopline(), input, [{ prompt: /--More--/, keys: ' ' }]);

    pushKeys('loot\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, []);
    assert.match(game._pending_message, /You resume your attempt at unlocking the chest\./);
    assert.equal(game.context.move, 1);
    await answerPrompts(flushPendingTopline(), input, [{ prompt: /--More--/, keys: ' ' }]);
    initRng(10n);
    await continueCountedCommand();

    assert.equal(box.olocked, false);
    assert.equal(box.obroken, false);
    assert.equal(box.where, 'floor');
    assert.equal(game._occupation, null);
    assert.equal(game._pending_message, 'You succeed in unlocking the chest.');
});

void test('tool-less autounlock keeps the turns already spent bashing a chest', async () => {
    freshObjectRoom({ flags: { autounlock: AUTOUNLOCK_UNTRAP } });
    game.uwep = game.u.uwep = await addInventoryObject(CLUB);
    const box = await floorObject(CHEST, 10, 10, { initialize: false, olocked: true });
    const input = resetInputState();
    pushKeys('force\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [{ prompt: /force its lock\?/, keys: 'y' }]);
    for (let turn = 0; turn < 49; turn++) {
        initRng(1n);
        await continueCountedCommand();
    }
    await stopHeroOccupation();
    await answerPrompts(flushPendingTopline(), input, [{ prompt: /--More--/, keys: ' ' }]);

    pushKeys('loot\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, []);
    await answerPrompts(flushPendingTopline(), input, [{ prompt: /--More--/, keys: ' ' }]);
    initRng(1n);
    await continueCountedCommand();
    assert.ok(game._occupation, 'the fiftieth attempt still works on the lock');
    await continueCountedCommand();

    assert.equal(game._occupation, null, 'the next turn gives up instead of restarting the limit');
    assert.equal(box.olocked, true);
    assert.equal(game._pending_message, 'You give up your attempt at unlocking the chest.');
});

void test('blunt forcing resumes tool-less picking with the same effort limit', async () => {
    freshObjectRoom({ flags: { autounlock: AUTOUNLOCK_UNTRAP } });
    game.uwep = game.u.uwep = await addInventoryObject(CLUB);
    const box = await floorObject(CHEST, 10, 10, { initialize: false, olocked: true, lknown: true, tknown: false });
    const input = resetInputState();
    pushKeys('loot\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /The chest is locked\..*--More--/, keys: ' ' },
        { prompt: /Check .*chest for a trap\?/, keys: 'n' },
        { prompt: /There is .*chest here; unlock it\?/, keys: 'y' },
    ]);
    for (let turn = 0; turn < 49; turn++) await continueCountedCommand();
    await stopHeroOccupation();
    await answerPrompts(flushPendingTopline(), input, [{ prompt: /--More--/, keys: ' ' }]);

    pushKeys('force\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, []);
    assert.equal(game._pending_message, 'You resume your attempt to force the lock.');
    assert.equal(game.context.move, 1);
    await answerPrompts(flushPendingTopline(), input, [{ prompt: /--More--/, keys: ' ' }]);
    initRng(10n);
    await continueCountedCommand();
    assert.ok(game._occupation, 'a club does not replace the zero chance of the resumed attempt');
    await continueCountedCommand();

    assert.equal(game._occupation, null);
    assert.equal(box.olocked, true);
    assert.equal(game._pending_message, 'You give up your attempt to force the lock.');
});
