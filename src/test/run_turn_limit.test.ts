import test from 'node:test';
import assert from 'node:assert/strict';
import { continueRun, rhack } from '../js/cmd.js';
import { CORR, STONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

// C cmd.c:rhack() does not reset u.last_str_turn for a counted walk.
// If its live run value later changes, lookaround() still limits turns
// using the bend taken during the earlier run.
void test('a counted walk retains the earlier run turn limit', async () => {
    const level = freshObjectRoom();
    for (let x = 7; x <= 16; x++)
        for (let y = 6; y <= 14; y++) level.requireAt(x, y).typ = STONE;
    for (const position of [
        { x: 10, y: 10 }, { x: 11, y: 10 }, { x: 11, y: 9 },
        { x: 11, y: 8 }, { x: 10, y: 8 },
    ]) level.requireAt(position.x, position.y).typ = CORR;
    await rhack('L'.charCodeAt(0));
    await continueRun();
    assert.deepEqual([game.u.ux, game.u.uy], [11, 9], 'the first run turns left');
    await rhack(27);
    pushKeys('3k');
    await rhack(0);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 8], 'the counted walk starts north');
    game.context.run = 1;

    const result = await continueRun();

    assert.equal(result.tookTime, false, 'a second left turn exceeds the earlier run limit');
    assert.deepEqual([game.u.ux, game.u.uy], [11, 8]);
});
