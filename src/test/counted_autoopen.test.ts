import assert from 'node:assert/strict';
import test from 'node:test';

import { continueRun } from '../js/hack.js';
import { rhack } from '../js/cmd.js';
import { A_CON, A_DEX, A_STR, DOOR, D_CLOSED, D_ISOPEN } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requireGameLevel } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('a counted walk opens its door without time and continues through it', async () => {
    const input = freshTurnRoom({ flags: { autoopen: true } });
    const door = requireGameLevel().requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    assert.ok(game.u.acurr);
    for (const attribute of [A_STR, A_DEX, A_CON]) game.u.acurr.a[attribute] = 25;
    input.feed('2l');

    await rhack(0);
    await flush_screen(1);
    const opening = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
    assert.equal(opening, 'The door opens.');
    assert.equal(door.doormask, D_ISOPEN);
    assert.equal(game.context.move, 0);
    assert.equal(game.u.ux, 10);

    assert.equal((await continueRun()).tookTime, true, 'opening leaves the next counted step available');
    assert.equal(game.u.ux, 11);
    assert.equal(game.context.move, 1);
});
