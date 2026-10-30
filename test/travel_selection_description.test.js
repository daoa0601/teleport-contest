import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { readCommandInput } from '../js/command_input.js';
import { STONE, VWALL } from '../js/const.js';
import { displayMessageWindow, flush_screen, newsym, pline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
function topline() {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
// getpos.c:getpos() leaves auto_describe() visible after each pick key.
// A later display_nhwindow(WIN_MESSAGE), such as monmove.c:vamp_shift()
// calls even for an unseen vampire, must preserve that already-read line.
for (const pick of ['.', ',', ';', ':']) {
    void test(`displaying the message window after travel picked with ${pick} keeps the wall description`, async () => {
        const level = await freshObjectRoom({
            flags: { tips: false, verbose: false },
        });
        level.requireAt(12, 10).typ = VWALL;
        await vision_recalc(0);
        await newsym(12, 10);
        const input = resetInputState();
        input.feed(`ll${pick}`);
        await rhack('_'.charCodeAt(0));
        await displayMessageWindow();
        await flush_screen(1);
        assert.equal(topline(), 'wall (no travel path)');
        assert.equal(game.context.move, 1, 'selecting an unreachable destination spends a turn');
    });
}
void test('displaying the message window keeps a reachable dark-room travel description', async () => {
    const level = await freshObjectRoom({
        flags: { tips: false, verbose: false },
    });
    const floor = level.requireAt(12, 10);
    floor.lit = floor.waslit = false;
    await vision_recalc(0);
    await newsym(12, 10);
    const input = resetInputState();
    input.feed('ll,');
    await rhack('_'.charCodeAt(0));
    await displayMessageWindow();
    await flush_screen(1);
    assert.equal(topline(), 'dark part of a room');
    assert.equal(game.u.ux, 11, 'travel begins toward the reachable floor');
});
void test('displaying the message window keeps the stone travel description', async () => {
    const level = await freshObjectRoom({
        flags: { tips: false, verbose: false },
    });
    const stone = level.requireAt(12, 10);
    stone.typ = STONE;
    await vision_recalc(0);
    await newsym(12, 10);
    const input = resetInputState();
    input.feed('ll,');
    await rhack('_'.charCodeAt(0));
    await displayMessageWindow();
    await flush_screen(1);
    assert.equal(topline(), 'stone (no travel path)');
});
void test('travel clears the selection prompt when autodescribe is off', async () => {
    await freshObjectRoom({
        flags: { tips: false, verbose: false },
        iflags: { autodescribe: false },
    });
    const input = resetInputState();
    input.feed('ll,');
    await rhack('_'.charCodeAt(0));
    await displayMessageWindow();
    await flush_screen(1);
    assert.equal(topline(), '');
    assert.equal(game.u.ux, 11);
});
void test('an empty message window leaves the travel description while reading the next command', async () => {
    const level = await freshObjectRoom({ flags: { tips: false, verbose: false } });
    level.requireAt(12, 10).typ = VWALL;
    await vision_recalc(0);
    await newsym(12, 10);
    const input = resetInputState();
    input.feed('ll.');
    await rhack('_'.charCodeAt(0));
    await displayMessageWindow();
    input.feed('h');
    const command = await readCommandInput();
    await flush_screen(1);
    assert.equal(command.key, 'h'.charCodeAt(0));
    assert.equal(topline(), 'wall (no travel path)');
    await pline('A nearby door opens.');
    await flush_screen(1);
    assert.equal(topline(), 'A nearby door opens.');
});
//# sourceMappingURL=travel_selection_description.test.js.map