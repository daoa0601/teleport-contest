import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { freshPlayableRoom } from './support/playable-room.js';

for (const [datetime, expected] of [
    ['20260831230000', 'It is nighttime.'],
    ['20260831000000', 'It is the midnight hour.'],
    ['20260831120000', null],
] as const) {
    void test(`attributes reports the game clock at ${datetime.slice(8, 10)} hours before moon effects`, async context => {
        // The fixed recorder clock inherits the host's current DST offset.
        context.mock.method(Date, 'now', () => Date.UTC(2026, 7, 31, 12));
        freshPlayableRoom({ datetime, flags: { moonphase: 4, friday13: true } });
        const input = resetInputState();
        const report = runExtendedCommand('attributes');
        const pages: string[] = [];
        try {
            for (;;) {
                const blocked = await Promise.race([
                    input.waitUntilBlocked().then(() => true), report.then(() => false),
                ]);
                if (!blocked) break;
                assert.ok(pages.length < 8, 'The attributes report must finish');
                pages.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
                input.feed(' ');
            }
        } finally {
            input.feed('\x1b');
            await report;
        }
        const text = pages.join('\n');
        if (expected) {
            assert.match(text, new RegExp(`You have just started your adventure\\.\\s+${expected.replaceAll('.', '\\.')}`));
            assert.ok(text.indexOf(expected) < text.indexOf('There is a full moon in effect.'));
        } else {
            assert.doesNotMatch(text, /nighttime|midnight hour/);
        }
        assert.match(text, /There is a full moon in effect\./);
        assert.match(text, /Bad things can happen on Friday the 13th\./);
        assert.equal(game.context.move, 0);
    });
}
