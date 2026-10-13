import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { applyNethackrc } from '../js/options.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
function topline() {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
void test('ordinary look gives the verbose cursor request while quick look stays brief', async () => {
    for (const quick of [false, true]) {
        freshObjectRoom({ flags: { tips: false, verbose: true } });
        const input = resetInputState();
        if (!quick)
            input.feed('/');
        const looking = rhack((quick ? ';' : '/').charCodeAt(0));
        await input.waitUntilBlocked();
        const request = topline();
        if (!quick) {
            input.feed(' ');
            await input.waitUntilBlocked();
            assert.match(topline(), /For instructions/);
        }
        input.feed('\x1b');
        await looking;
        assert.match(request, quick ? /^Pick a monster/ : /^Please move the cursor to a monster/);
        assert.equal(request.includes('--More--'), !quick);
    }
});
for (const [binding, key, label] of [
    ['!', '!', '!'],
    ['C-a', '\x01', '^A'],
]) {
    void test(`ordinary look advertises and accepts the rebound ${label} help key`, async () => {
        freshObjectRoom({ flags: { tips: false, verbose: true } });
        applyNethackrc(`BINDINGS=${binding}:getpos.help`);
        const input = resetInputState();
        input.feed('/');
        const looking = rhack('/'.charCodeAt(0));
        try {
            await input.waitUntilBlocked();
            input.feed(' ');
            await input.waitUntilBlocked();
            assert.ok(topline().includes(`(For instructions type a '${label}')`), `The look prompt should advertise the configured ${label} help key: ${topline()}`);
            input.feed(key);
            await input.waitUntilBlocked();
            assert.match(topline(), /Use .* to move the cursor to a monster/);
            input.feed(' ');
            await input.waitUntilBlocked();
            assert.match(topline(), /^Move cursor to a monster, object or location:/);
        }
        finally {
            input.feed('\x1b\x1b');
            await looking;
        }
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=look_prompt.test.js.map