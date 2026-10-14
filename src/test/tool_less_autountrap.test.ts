import assert from 'node:assert/strict';
import test from 'node:test';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { AUTOUNLOCK_UNTRAP } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { CHEST } from '../js/object_data.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { floorObject } from './support/game-objects.js';
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
