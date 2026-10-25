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

    // Forcing with a blade asks about the same chest; declining must not
    // wipe the interrupted pick's progress.
    game.uwep = game.u.uwep = await addInventoryObject(DAGGER, { invlet: 'b' });
    pushKeys('force\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /here; force its lock\?/, keys: 'n' },
    ]);
    assert.match(game._pending_message, /You decide not to force the issue\./);

    // Applying the card again resumes the target-less attempt instead of
    // asking for a direction or a fresh chest question.
    await answerPrompts(rhack('a'.charCodeAt(0)), input, [
        { prompt: /Apply what|use or apply/, keys: 'a' },
    ]);
    assert.match(game._pending_message, /You resume your attempt at picking the lock\./);

    // The resumed attempt finds no target: it stops silently on its next
    // turn, and a fresh apply asks about the chest again instead of
    // resuming once more.
    initRng(1n);
    await continueCountedCommand();
    await answerPrompts(rhack('a'.charCodeAt(0)), input, [
        { prompt: /Apply what|use or apply/, keys: 'a' },
        { prompt: /In what direction/, keys: '.' },
        { prompt: /here; unlock it\?/, keys: 'q' },
    ]);
    assert.equal(chest.olocked, true);
});
