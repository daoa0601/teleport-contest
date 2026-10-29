import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { GameDisplay } from '../js/game_display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { LEATHER_DRUM } from '../js/object_data.js';
import { Terminal } from '../js/terminal.js';
import { addInventoryObject } from './support/game-objects.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('a permanently deaf drummer feels the performance without gaining temporary deafness', async () => {
    const input = freshTurnRoom();
    assert.ok(game.u.uroleplay);
    game.u.uroleplay.deaf = true;
    const drum = await addInventoryObject(LEATHER_DRUM);
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /playing|pound|deafening/, limit: 5 });
    pushKeys(`a${drum.invlet}`);
    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /playing|pound|deafening|^$/);
    messages.push(game._pending_message);
    assert.equal(game.u.deafTurns ?? 0, 0);
    assert.match(messages.join('\n'), /You pound on the drum\./);
});
// C music.c LEATHER_DRUM deafens the drummer inside the same command whose
// row is still waiting for input, and bot() runs before that input request:
// the pager's screen carries the "Deaf" condition.
void test('a deafening drum row pages with its Deaf condition already in the status line', async () => {
    const input = freshTurnRoom();
    game.nhDisplay = new GameDisplay(new Terminal(null, { rows: 24, cols: 70 }));
    // A narrower topline keeps the drum's row from joining the previous
    // one, so the pager stops for it at an input request.
    const drum = await addInventoryObject(LEATHER_DRUM);
    const pages = [];
    input.beforeRead = () => {
        if (/use or apply/.test(game._pending_message))
            pushKeys(drum.invlet ?? '?');
    };
    input.display = {
        async readKey() {
            const grid = game.nhDisplay?.grid ?? [];
            pages.push(grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
            return ' '.charCodeAt(0);
        },
    };
    pushKeys('a');
    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /playing|deafening|^$/);
    assert.ok((game.u.deafTurns ?? 0) > 0, 'the drum deafens its player');
    const row = pages.find(page => /--More--/.test(page))?.split('\n')[23];
    assert.ok(row, 'The drum performance reaches the message pager');
    assert.match(row ?? '', / Deaf/);
});
//# sourceMappingURL=music_deafness.test.js.map