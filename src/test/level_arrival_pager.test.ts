import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { LA_DOWN, LA_UP, MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { docrt, flush_screen, pline, redrawMap } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function screenText() {
    assert.ok(game.nhDisplay);
    return game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

for (const [up, ladder] of [[false, false], [false, true], [true, false], [true, true]] as const) {
    void test(`${up ? 'ascending' : 'descending'} ${ladder ? 'a ladder' : 'stairs'} pages before the arrival turn can run`, async () => {
        const { source, destination } = freshConnectedLevels({ ladder });
        requirePlayingGame(game);
        if (up) {
            source.requireAt(10, 10).ladder = LA_UP;
            destination.requireAt(12, 10).ladder = LA_DOWN;
            game.u.uz.dlevel = 2;
            assert.ok(game.stairs);
            game.stairs.up = true;
            game.stairs.tolev.dlevel = 1;
            assert.ok(game._levelCache);
            const cached = game._levelCache.get('0:2');
            assert.ok(cached?.stairs);
            cached.stairs.up = false;
            cached.stairs.tolev.dlevel = 2;
            game._levelCache.delete('0:2');
            game._levelCache.set('0:1', cached);
        }
        game._moveloopStarted = true;
        game.u.umovement = 12;
        game.u.uhp = game.u.uhpmax = 100;
        game.u.uac = 20;
        game.level = destination;
        const monster = await createMonsterAt('goblin', 13, 10, MM_ANGRY | NO_MINVENT);
        monster.movement = 12;
        game.level = source;
        await flush_screen(1);
        const input = resetInputState();
        input.feed(up ? '<' : '>');

        const command = moveloop_core();
        const boundary = await Promise.race([
            command.then(() => 'completed'),
            input.waitUntilBlocked().then(() => 'pager'),
        ]);

        assert.equal(boundary, 'pager', 'arrival must await its message before returning to the turn scheduler');
        const message = up ? `You climb up the ${ladder ? 'ladder' : 'stairs'}.`
            : ladder ? 'You climb down the ladder.' : 'You descend the stairs.';
        assert.ok(screenText().includes(`${message}--More--`), 'the travel message owns the pager');
        assert.equal(game.level, destination);
        assert.equal(game.u.uhp, 100);
        assert.equal(monster.movement, 12);
        assert.equal(!!game._heroTimePending, false);
        input.feed('k');
        await input.waitUntilBlocked();
        assert.equal(game.u.uhp, 100, 'an unaccepted pager key cannot advance the arrival turn');
        input.feed(' ');
        await command;
        assert.equal(game._heroTimePending, true, 'the acknowledged descent still costs one action');

        const nextInput = moveloop_core();
        await input.waitUntilBlocked();
        assert.ok(game.u.uhp < 100, 'the adjacent goblin acts after acknowledgment');
        input.feed('\x1b');
        await nextInput;
    });
}

void test('a nonverbose stair descent has no synthetic arrival pager', async () => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.verbose = false;
    const input = resetInputState();

    await rhack('>'.charCodeAt(0));

    assert.equal(game.level, destination);
    assert.equal(input.isBlocked, false);
    assert.equal(game._pending_message || '', '');
    assert.equal(game.context.move, 1);
});

void test('a native screen redraw waits for its existing message before clearing the screen', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await redrawMap();
    await flush_screen(1);
    await pline('A bell rings nearby.');
    const input = resetInputState();
    const moves = game.moves;

    const redraw = docrt();
    await input.waitUntilBlocked();

    assert.match(screenText(), /A bell rings nearby\.--More--/);
    assert.equal(game.nhDisplay?.grid[11]?.[9]?.ch, '@', 'the old map remains during the pager');
    input.feed(' ');
    await redraw;
    await flush_screen(1);
    assert.equal(game._pending_message, '');
    assert.equal(game.nhDisplay?.grid[11]?.[9]?.ch, '@');
    assert.equal(game.moves, moves);
});

void test('an ordinary map refresh preserves the pending message without requiring input', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await pline('A bell rings nearby.');
    const input = resetInputState();

    await redrawMap();
    await flush_screen(1);

    assert.equal(input.isBlocked, false);
    assert.equal(game._pending_message, 'A bell rings nearby.');
    assert.doesNotMatch(screenText(), /--More--/);
});
