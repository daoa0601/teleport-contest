import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN, PIT } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { runExtendedCommand } from './support/commands.js';
void test('wizard mapping discovers traps even when furniture covers their map glyph', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    level.requireAt(40, 10).typ = FOUNTAIN;
    const trap = addTrap(level, PIT, 40, 10);
    trap.tseen = false;
    await rhack(6);
    assert.equal(trap.tseen, true);
    assert.equal(level.requireAt(40, 10).seenv, 255);
    assert.equal(game.context.move, 0);
});
void test('wizard mapping without hero memory opens the map browser and restores confusion and hallucination', async () => {
    const level = freshObjectRoom({
        flags: { debug: true, tips: false, verbose: true },
        hero: { confusionTurns: 12, hallucinationTurns: 15 },
    });
    requirePlayingGame(game);
    level.flags.hero_memory = false;
    const messages = [];
    resetInputState().beforeRead = () => {
        messages.push(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '');
    };
    await runExtendedCommand('wizmap', '\x1b');
    assert.ok(messages.some(message => message.includes("For instructions type a '?'")), 'Mapping must open a map browser');
    assert.equal(game.u.confusionTurns, 12);
    assert.equal(game.u.hallucinationTurns, 15);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=wizard_map.test.js.map