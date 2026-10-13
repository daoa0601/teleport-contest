import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a wizard who declines lava death recovers and teleports to safety', async () => {
    const level = freshObjectRoom({ flags: { debug: true, bones: false, disclose: '-i -a -v -g -c -o' } });
    level.requireAt(10, 10).typ = LAVAPOOL;
    const input = resetInputState();
    const burning = heroLiquidEffects();
    await input.waitUntilBlocked();
    input.feed(' ');
    await input.waitUntilBlocked();
    const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    try {
        assert.match(text, /Die\? \[yn\]/);
        input.feed('n');
        const result = await burning;
        assert.ok(result?.entered);
        assert.equal(result.died, false);
        assert.equal(!!game.program_state.gameover, false);
        assert.notEqual(level.requireAt(game.u.ux, game.u.uy).typ, LAVAPOOL);
        assert.ok((game.u.uhp ?? 0) > 0);
    } finally {
        input.feed(' '.repeat(20));
        await burning;
    }
});
