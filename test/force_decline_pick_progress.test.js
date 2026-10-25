import test from 'node:test';
import assert from 'node:assert/strict';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { CHEST, CREDIT_CARD, DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a declined force keeps pick progress alive without its chest target', async () => {
    freshObjectRoom({ hero: { acurr: { a: [3, 3, 3, 3, 3, 3] } } });
    const chest = await floorObject(CHEST, 10, 10, { olocked: true });
    await addInventoryObject(CREDIT_CARD, { invlet: 'a' });
    const input = resetInputState();
    pushKeys('a.');
    await answerPrompts(rhack('a'.charCodeAt(0)), input, [
        { prompt: /here; unlock it\?/, keys: 'y' },
    ]);
    initRng(1n);
    await continueCountedCommand();
    assert.equal(chest.olocked, true);
    await stopHeroOccupation();
    // Forcing with a blade asks about the same chest; declining drops only
    // the box target of the interrupted pick, not its progress.
    game.uwep = game.u.uwep = await addInventoryObject(DAGGER, { invlet: 'b' });
    pushKeys('force\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /here; force its lock\?/, keys: 'n' },
    ]);
    assert.match(game._pending_message, /You decide not to force the issue\./);
    assert.equal(game._lockAttempt?.key, 'pick-lock');
    assert.equal(game._lockAttempt.usedtime, 1);
    assert.equal(game._lockAttempt.container, undefined);
    // Applying the card again resumes that target-less attempt, which
    // spends its turn and then stops silently on the next one.
    await answerPrompts(rhack('a'.charCodeAt(0)), input, [
        { prompt: /Apply what|use or apply/, keys: 'a' },
    ]);
    assert.equal(game._occupation?.key, 'pick-lock');
    assert.equal(game._occupation.container, undefined);
    assert.match(game._pending_message, /You resume your attempt at picking the lock\./);
    initRng(1n);
    await continueCountedCommand();
    assert.equal(game._occupation, null);
    assert.equal(game._lockAttempt?.usedtime ?? 0, 0);
    assert.equal(chest.olocked, true);
});
//# sourceMappingURL=force_decline_pick_progress.test.js.map