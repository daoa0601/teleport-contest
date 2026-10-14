import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { WEB } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

for (const seen of [true, false]) {
    void test(`showtrap identifies only a known web with seen=${seen}`, async () => {
        const level = freshObjectRoom();
        level.traps.push({ tx: 11, ty: 10, ttyp: WEB, tseen: seen,
            madeby_u: true, once: false, launch: { x: 0, y: 0 } });
        newsym(11, 10);
        const input = resetInputState();
        await answerPrompts(rhack('^'.charCodeAt(0)), input, [
            { prompt: /In what direction\?/, keys: 'l' },
        ]);
        await flush_screen(1);
        const text = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
        assert.match(text, seen ? /That is a web woven by you\./ : /I can't see a trap there\./);
        assert.equal(game.context.move, 0);
    });
}
