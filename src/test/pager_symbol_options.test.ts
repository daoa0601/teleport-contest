import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MOAT } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

for (const flags of [{ dark_room: false }, { color: false }]) {
    void test(`quick look omits the dark-room meaning when ${Object.keys(flags)[0]} is disabled`, async () => {
        freshObjectRoom({ flags: { tips: false, ...flags } });
        resetInputState().feed('l. ');
        await rhack(';'.charCodeAt(0));
        await flush_screen(1);
        const text = requireGameDisplay().grid.slice(0, 2).map(row => row.map(cell => cell.ch).join('')).join('');
        assert.doesNotMatch(text, /dark part of a room/);
        assert.doesNotMatch(text, /can be many things/);
        assert.match(text, /floor of a room/);
    });
}

void test('quick look includes the regional moat name among water-symbol meanings', async () => {
    const level = freshObjectRoom({ flags: { tips: false } });
    game.medusa_level = { dnum: 0, dlevel: 8, flags: { town: false }, alignment: null };
    level.requireAt(11, 10).typ = MOAT;
    newsym(11, 10);
    const input = resetInputState();
    input.feed('l.');
    await answerPrompts(rhack(';'.charCodeAt(0)), input, [
        { prompt: /pool or shallow sea[\s\S]*--More--/, keys: ' ' },
    ]);
});
