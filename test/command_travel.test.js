import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { LA_DOWN, STAIRS } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { nhgetch } from '../js/input.js';
import { freshTurnRoom } from './support/playable-room.js';
for (const command of ['_', '#travel\n']) {
    void test(`cancelling ${JSON.stringify(command)} clears travel recall`, async () => {
        const input = freshTurnRoom({ flags: { tips: false } });
        input.feed(`${command}\x1b`);
        await rhack(0);
        input.feed('\x01\x1b');
        await rhack(0);
        assert.equal(game._pending_message, 'There is no command available to repeat.');
        assert.equal(game.u.ux, 10);
        assert.equal(game.context.move, 0);
        assert.equal(await nhgetch(), 27, 'repeat must not reopen the destination prompt');
    });
}
void test('cancelling the travel menu retains the command for recall', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    const stair = game.level?.requireAt(14, 10);
    assert.ok(stair);
    stair.typ = STAIRS;
    stair.ladder = LA_DOWN;
    newsym(14, 10);
    input.feed('m_\x1b');
    await rhack(0);
    input.feed('\x01');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        const text = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
        assert.match(text, /Pick an interesting thing in view for travel destination/);
        input.feed('a');
        await action;
        assert.equal(game.u.ux, 11);
        assert.equal(game.context.move, 1);
    }
    finally {
        input.feed('\x1b');
        await action;
    }
});
void test('retravel reports when no destination has been selected', async () => {
    const input = freshTurnRoom();
    input.feed('\x1f');
    await rhack(0);
    assert.equal(game._pending_message, 'No travel destination set.');
    assert.equal(game.context.move, 0);
});
void test('retravel resumes toward the previously selected destination without a prompt', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    input.feed('_llllll.');
    await rhack(0);
    assert.equal(game.u.ux, 11);
    input.feed('\x1f');
    await rhack(0);
    assert.equal(game.u.ux, 12);
    assert.equal(game.context.move, 1);
    assert.equal(game.context.nopick, true);
});
void test('retravel clears a destination already occupied by the hero', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    input.feed('_llllll.');
    await rhack(0);
    game.u.ux = 16;
    input.feed('\x1f');
    await rhack(0);
    assert.equal(game._pending_message, 'You are already here.');
    assert.equal(game.context.move, 0);
    input.feed('\x1f');
    await rhack(0);
    assert.equal(game._pending_message, 'No travel destination set.');
});
void test('the travel menu prefix lists visible interesting destinations', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    const stair = game.level?.requireAt(14, 10);
    assert.ok(stair);
    stair.typ = STAIRS;
    stair.ladder = LA_DOWN;
    newsym(14, 10);
    input.feed('m_');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        const text = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
        assert.match(text, /Pick an interesting thing in view for travel destination/);
        assert.match(text, /staircase down/);
        input.feed('a');
        await action;
        assert.equal(game.u.ux, 11);
        assert.equal(game.context.move, 1);
    }
    finally {
        input.feed('\x1b');
        await action;
    }
});
//# sourceMappingURL=command_travel.test.js.map