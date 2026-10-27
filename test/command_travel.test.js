import assert from 'node:assert/strict';
import test from 'node:test';
import { continueRun, rhack } from '../js/cmd.js';
import { LAVAPOOL } from '../js/const.js';
import { CORR, GFILTER_AREA, LA_DOWN, PIT, STAIRS } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { nhgetch } from '../js/input.js';
import { freshTurnRoom } from './support/playable-room.js';
import { answerPrompts } from './support/input-boundaries.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { requireScreenRow } from './support/screen.js';
void test('travel reports the first hostile in map order rather than monster creation order', async () => {
    const input = freshTurnRoom({ flags: { tips: false, mention_walls: true } });
    input.feed('_llllll.');
    await rhack(0);
    const goblin = await createMonsterAt('goblin', 12, 11);
    goblin.mpeaceful = false;
    const orc = await createMonsterAt('orc', 10, 10);
    orc.mpeaceful = false;
    assert.equal((await continueRun()).tookTime, false);
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /An orc blocks your path\./);
    assert.equal(game.u.ux, 11);
    assert.equal(game.context.run, 0);
});
void test('travel reports a trap ahead before a hostile later in map order', async () => {
    const input = freshTurnRoom({ flags: { tips: false, mention_walls: true } });
    input.feed('_llllll.');
    await rhack(0);
    assert.ok(game.level);
    const pit = addTrap(game.level, PIT, 12, 10);
    pit.tseen = true;
    const goblin = await createMonsterAt('goblin', 12, 11);
    goblin.mpeaceful = false;
    assert.equal((await continueRun()).tookTime, false);
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /You stop in front of a pit\./);
    assert.equal(game.u.ux, 11);
    assert.equal(game.context.run, 0);
});
void test('travel with no previous direction ignores a known trap underfoot', async () => {
    const input = freshTurnRoom({ flags: { tips: false, mention_walls: true } });
    input.feed('_llllll.');
    await rhack(0);
    assert.ok(game.level);
    const pit = addTrap(game.level, PIT, 11, 10);
    pit.tseen = true;
    game.u.dx = 0;
    game.u.dy = 0;
    assert.equal((await continueRun()).tookTime, true);
    assert.equal(game.u.ux, 12);
    await flush_screen(1);
    assert.doesNotMatch(requireScreenRow(0).map(cell => cell.ch).join(''), /You stop in front/);
});
void test('travel menu describes a discovered pit with coordinates and no path warning', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    assert.ok(game.level);
    const pit = addTrap(game.level, PIT, 14, 10);
    pit.tseen = true;
    newsym(14, 10);
    game.iflags.getpos_coords = 'm';
    input.feed('m_');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        assert.ok(game.nhDisplay);
        const text = game.nhDisplay.grid.map(cells => cells.map(cell => cell.ch).join('')).join('\n');
        assert.match(text, /a - pit <14,10>\s*\n/);
    }
    finally {
        input.feed('\x1b');
        await action;
    }
    assert.equal(game.u.ux, 10);
    assert.equal(game.context.move, 0);
});
const travelCoordinateModes = [
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
        }
        finally {
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
        for (let y = 8; y <= 12; y++)
            game.level.requireAt(12, y).typ = CORR;
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
// C hack.c:lookaround() with context.run==8: an automatic travel step stops
// at the edge of liquid the hero cannot safely cross.
void test('travel continuation stops at a lava edge before the next step', async () => {
    const input = freshTurnRoom({ flags: { tips: false, mention_walls: true } });
    const level = game.level;
    assert.ok(level);
    const lava = level.requireAt(12, 10);
    lava.typ = LAVAPOOL;
    lava.seenv = 1;
    input.feed('_ll.');
    await rhack(0);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10], 'first travel step moves once');
    await continueRun();
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.context.move, 0);
    assert.equal(game.context.run, 0);
    await flush_screen(1);
    assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trimEnd(), 'You stop at the edge of the lava.');
});
//# sourceMappingURL=command_travel.test.js.map