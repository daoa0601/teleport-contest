import test from 'node:test';
import assert from 'node:assert/strict';
import { THRONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
void test('throne healing announces restored eyesight and updates visibility', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = THRONE;
    setHeroBlindnessTurns(30);
    vision_recalc(0);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    initRng(40n);
    await runExtendedCommand('sit', ' '.repeat(15));
    assert.equal(game.u.blindTurns, 0);
    assert.match([...messages, game._pending_message].join('\n'), /You can see again/);
});
//# sourceMappingURL=throne_healing_sight.test.js.map