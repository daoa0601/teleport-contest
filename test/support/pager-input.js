import assert from 'node:assert/strict';
import { game, requireGameDisplay } from '../../js/gstate.js';
// InputGate uses this reader only after consuming the caller's queued keys.
// The observer in beforeRead remains responsible for recording every read.
export function installPagerInput(input, { expected, limit }) {
    let acknowledgements = 0;
    let followsDeathSummary = false;
    input.display = {
        async readKey() {
            const display = requireGameDisplay(game);
            const screen = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            const topRow = display.grid[0];
            assert.ok(topRow, 'The message pager needs its display row.');
            const message = game._pending_message || display.topMessage || display.toplines
                || topRow.map(cell => cell.ch).join('');
            assert.ok(++acknowledgements <= limit, `Exceeded ${limit} acknowledgements for ${expected}: ${message}`);
            assert.match(screen, /--More--|Hit space to continue/, `Expected a message pager, received: ${message}`);
            const trailingDeathPage = followsDeathSummary && /^\s*--More--\s*$/.test(screen);
            followsDeathSummary = false;
            if (!trailingDeathPage) {
                assert.match(message.trim() ? message : screen, expected, 'Unexpected prose at the message pager');
                // Native death text can overflow by one final blank line.
                // Only the immediately following empty pager is expected.
                followsDeathSummary = !!game.program_state.gameover
                    && /\bREST\b/.test(screen) && /\bPEACE\b/.test(screen)
                    && /You .+ with -?\d+ points,/.test(screen.replace(/\s+/g, ' '));
            }
            return ' '.charCodeAt(0);
        },
    };
}
// A turn test can finish the monster response, then cancel the next command.
// Paged combat prose still uses the caller's validated pager reader.
export async function finishAtCommandInput(input, operation, expected) {
    const pager = input.display;
    assert.ok(pager, 'The turn needs its configured message pager');
    let cancelled = false;
    input.display = {
        async readKey() {
            const display = requireGameDisplay(game);
            const screen = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (/--More--|Hit space to continue/.test(screen))
                return pager.readKey();
            const message = game._pending_message || display.topMessage || display.toplines;
            assert.doesNotMatch(message, /\?/, 'The next command must not bypass a question');
            assert.match(message, expected, 'Unexpected message before the next command');
            assert.equal(cancelled, false, 'Cancelling the next command must finish the turn');
            cancelled = true;
            return 27;
        },
    };
    try {
        const result = await operation();
        assert.equal(cancelled, true, 'The turn returned before reaching its expected command input');
        return result;
    }
    finally {
        input.display = pager;
    }
}
//# sourceMappingURL=pager-input.js.map