import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

function topline(): string {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}

void test('ordinary look gives the verbose cursor request while quick look stays brief', async () => {
    for (const quick of [false, true]) {
        freshObjectRoom({ flags: { tips: false, verbose: true } });
        const input = resetInputState();
        if (!quick) input.feed('/');
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

