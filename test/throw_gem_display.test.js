import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DIAMOND } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('hallucinated gem flight looks the same when a unicorn catches it on the first or a later square', async () => {
    const catchNames = [];
    for (const distance of [1, 3]) {
        const level = freshObjectRoom({ hero: { hallucinationTurns: 20 } });
        level.flags.noteleport = true;
        await createMonsterAt('gray unicorn', 10 + distance, 10);
        const gem = await addInventoryObject(DIAMOND);
        const messages = [];
        resetInputState().beforeRead = () => { messages.push(game._pending_message); };
        initRng(42n);
        await throwInventoryObject(gem, 'l', ' '.repeat(20));
        const text = messages.join('\n') + '\n' + game._pending_message;
        const name = text.match(/([^\n]+) catches the diamond\./)?.[1];
        assert.ok(name, text);
        catchNames.push(name);
    }
    assert.equal(catchNames[0], catchNames[1]);
});
//# sourceMappingURL=throw_gem_display.test.js.map