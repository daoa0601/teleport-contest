import test from 'node:test';
import assert from 'node:assert/strict';
import { continueRun, rhack } from '../js/cmd.js';
import { BEAR_TRAP, CORR, POOL, STONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('rushing stops before a known trap on its very first step', async () => {
    const level = freshObjectRoom({ flags: { mention_walls: true } });
    addTrap(level, BEAR_TRAP, 11, 10, { tseen: true });
    pushKeys(' '.repeat(10));
    await rhack(12);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game.context.move, 0);
    assert.equal(game.context.run, 0);
    assert.equal(game._pending_message, 'You stop in front of a bear trap.');
});
void test('a blind runner keeps its direction instead of following an unseen corridor bend', async () => {
    const level = freshObjectRoom({ hero: { blindTurns: 10 } });
    for (let x = 9; x <= 13; x++)
        for (let y = 8; y <= 11; y++)
            level.requireAt(x, y).typ = STONE;
    level.requireAt(10, 10).typ = CORR;
    level.requireAt(11, 10).typ = CORR;
    level.requireAt(11, 9).typ = CORR;
    await rhack('L'.charCodeAt(0));
    await continueRun();
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.context.move, 0);
    assert.equal(game.context.run, 0);
});
void test('a sighted rush stops at a known pool edge during continuation', async () => {
    const level = freshObjectRoom({ flags: { mention_walls: true } });
    level.requireAt(12, 10).typ = POOL;
    pushKeys(' '.repeat(10));
    await rhack(12);
    await continueRun();
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, 'You stop at the edge of the water.');
});
//# sourceMappingURL=running_hazards.test.js.map