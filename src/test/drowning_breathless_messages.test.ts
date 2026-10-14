import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

for (const verbose of [false, true]) {
    void test(`a breathless hero reaches the pool bottom with verbose mode ${verbose ? 'on' : 'off'}`, async () => {
        const level = freshObjectRoom({ hero: { breathless: true }, flags: { verbose } });
        requirePlayingGame(game);
        level.requireAt(11, 10).typ = POOL;
        const messages: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => {
            messages.push(game._pending_message || '');
            input.feed(' ');
        };

        await rhack('l'.charCodeAt(0));

        messages.push(game._pending_message || '');
        const text = messages.join('\n');
        assert.match(text, /You touch bottom\./);
        assert.equal(text.includes("But you aren't drowning."), verbose);
        assert.equal(game.u.uinwater, 1);
        assert.equal(game.u.uhp, 40);
    });
}
