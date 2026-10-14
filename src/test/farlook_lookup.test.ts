import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { LA_DOWN, LA_UP, STAIRS } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('ordinary farlook offers information about the hero and keeps looking after declining it', async () => {
    freshObjectRoom({ role: 'wizard', flags: { tips: false, verbose: true, help: true } });
    game.plname = 'Aster';
    newsym(game.u.ux, game.u.uy);
    const input = resetInputState();
    input.feed('/');

    await answerPrompts(rhack('/'.charCodeAt(0)), input, [
        { prompt: /Please move the cursor.*--More--/, keys: ' ' },
        { prompt: /For instructions/, keys: '.' },
        { prompt: /human wizard called Aster\).*--More--/, keys: ' ' },
        { prompt: /More info about "human wizard"\?/, keys: 'n' },
        { prompt: /Pick a monster, object or location\./, keys: '\x1b' },
    ]);

    assert.equal(game.context.move, 0);
});

for (const up of [false, true]) {
    void test(`farlook explains ordinary and branch staircases ${up ? 'up' : 'down'}`, async () => {
        const level = freshObjectRoom({ flags: { tips: false } });
        game.symset = 'DECgraphics';
        const stairs = level.requireAt(11, 10);
        stairs.typ = STAIRS;
        stairs.ladder = up ? LA_UP : LA_DOWN;
        game.stairs = { sx: 11, sy: 10, up, isladder: false,
            tolev: { dnum: 1, dlevel: 1 }, u_traversed: true, next: null };
        newsym(11, 10);
        const input = resetInputState();
        input.feed('l.');

        await rhack(';'.charCodeAt(0));
        await flush_screen(1);

        const description = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('');
        assert.ok(description);
        const direction = up ? 'up' : 'down';
        assert.ok(description.startsWith(up ? '<' : '>'), description);
        assert.ok(description.includes(`a staircase ${direction} or a branch staircase ${direction}`), description);
        assert.ok(description.includes(`(branch staircase ${direction})`), description);
    });
}
