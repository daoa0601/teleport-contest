// C cmd.c:extcmdlist(): the recorded build defines DEBUG_MIGRATING_MONS, so
// the debug-mode key bindings list shows #migratemons with its full
// description, matching the description the command itself uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
void test('debug mode lists #migratemons with its migration description', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const input = resetInputState();
    input.feed('j');
    const action = rhack('?'.charCodeAt(0));
    const completed = action.then(() => 'completed');
    const screen = () => requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    let text = '';
    for (let page = 0; page < 40; page++) {
        const boundary = await Promise.race([completed, input.waitUntilBlocked().then(() => 'input')]);
        if (boundary === 'completed')
            break;
        text = screen();
        if (text.includes('#migratemons'))
            break;
        input.feed(' ');
    }
    assert.match(text, /#migratemons\s+show migrating monsters and migrate N random ones/);
    input.feed('\x1b');
    await action;
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=extcmd_debug_descriptions.test.js.map