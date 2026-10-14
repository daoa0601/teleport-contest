import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { CORR, GFILTER_AREA, LA_DOWN, STAIRS } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { nhgetch } from '../js/input.js';
import type { InterfaceFlags } from '../js/flags.js';
import { freshTurnRoom } from './support/playable-room.js';
import { answerPrompts } from './support/input-boundaries.js';

const travelCoordinateModes: readonly {
    mode: NonNullable<InterfaceFlags['getpos_coords']>;
    row: RegExp;
}[] = [
    { mode: 'n', row: /a - staircase down\s*\n/ },
    { mode: 'm', row: /a - staircase down <14,10>\s*\n/ },
    { mode: 's', row: /a - staircase down \[12,14\]\s*\n/ },
    { mode: 'c', row: /a - staircase down \(4e\)\s*\n/ },
    { mode: 'f', row: /a - staircase down \(4east\)\s*\n/ },
];

for (const { mode, row } of travelCoordinateModes) {
    void test(`travel menu uses the ${mode} coordinate format for destinations`, async () => {
        const input = freshTurnRoom({ flags: { tips: false } });
        const stair = game.level?.requireAt(14, 10);
        assert.ok(stair);
        stair.typ = STAIRS;
        stair.ladder = LA_DOWN;
        newsym(14, 10);
        game.iflags.getpos_coords = mode;
        input.feed('m_');

        const action = rhack(0);
        try {
            await input.waitUntilBlocked();
            assert.ok(game.nhDisplay);
            const text = game.nhDisplay.grid.map(cells => cells.map(cell => cell.ch).join('')).join('\n');
            assert.match(text, row);
        } finally {
            input.feed('a');
            await action;
        }

        assert.equal(game.u.ux, 11);
        assert.equal(game.context.move, 1);
    });
}

for (const selection of ['a', '\x1b']) {
    void test(`travel menu includes visible destinations outside the area filter when ${JSON.stringify(selection)} is selected`, async () => {
        const input = freshTurnRoom({ flags: { tips: false } });
        assert.ok(game.level);
        for (let y = 8; y <= 12; y++) game.level.requireAt(12, y).typ = CORR;
        const stair = game.level.requireAt(14, 10);
        stair.typ = STAIRS;
        stair.ladder = LA_DOWN;
        newsym(14, 10);
        game.iflags.getloc_filter = GFILTER_AREA;
        input.feed('m_');

        await answerPrompts(rhack(0), input, [{
            prompt: /a - staircase down/,
            keys: selection,
        }]);

        assert.equal(game.iflags.getloc_filter, GFILTER_AREA, 'travel must preserve the configured area filter');
        assert.equal(game.u.ux, selection === 'a' ? 11 : 10);
        assert.equal(game.context.move, selection === 'a' ? 1 : 0);
    });
}

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
    } finally {
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
    } finally {
        input.feed('\x1b');
        await action;
    }
});
