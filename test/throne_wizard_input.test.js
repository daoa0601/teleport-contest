import test from 'node:test';
import assert from 'node:assert/strict';
import { THRONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a negative wizard throne choice keeps the randomly selected healing effect', async () => {
    const level = freshObjectRoom({
        flags: { debug: true }, gameplaySeed: 40n,
        hero: { uhp: 10, uhpmax: 40 },
    });
    level.requireAt(10, 10).typ = THRONE;
    await runExtendedCommand('sit', ` -13\n${' '.repeat(10)}`);
    assert.equal(game.u.uhp, 40);
    assert.equal(game.u.confusionTurns ?? 0, 0);
});
void test('a wizard throne choice reads the integer prefix before trailing text', async () => {
    const level = freshObjectRoom({
        flags: { debug: true }, gameplaySeed: 40n,
        hero: { uhp: 10, uhpmax: 40 },
    });
    level.requireAt(10, 10).typ = THRONE;
    await runExtendedCommand('sit', ` 13 then 2\n${' '.repeat(10)}`);
    assert.ok((game.u.confusionTurns ?? 0) >= 16);
    assert.equal(game.u.uhp, 10);
});
//# sourceMappingURL=throne_wizard_input.test.js.map