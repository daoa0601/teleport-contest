import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { moreUntilDismissed } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_YENDOR } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
function topline() {
    const row = requireGameDisplay().grid[0];
    return row ? row.map(cell => cell.ch).join('').trim() : '';
}
// C allmain.c:446-451 announces the Amulet's wish with urgent_pline(), which
// overrides the message suppression an Escape at --More-- leaves behind.
void test('the Amulet wish announcement overrides Escape message suppression', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game._moveloopStarted = true;
    game.u.umovement = 12;
    game.u.uevent = {};
    await addInventoryObject(AMULET_OF_YENDOR);
    game.u.uhave.amulet = true;
    const input = resetInputState();
    // Dismissing a --More-- with Escape stops ordinary message output until
    // the next input request.
    const paging = moreUntilDismissed('You have escaped the dungeon guard.');
    input.feed('\x1b');
    await paging;
    const toplines = [];
    const core = moveloop_core();
    try {
        for (let step = 0; step < 6; step++) {
            await input.waitUntilBlocked();
            toplines.push(topline());
            const current = toplines[toplines.length - 1] ?? '';
            if (current.startsWith('For what do you wish')) {
                input.feed('nothing\n');
                break;
            }
            input.feed(' ');
        }
    }
    finally {
        input.feed('\x1b');
        await core;
    }
    assert.ok(toplines.some(line => line.includes('The Amulet is bestowing a wish upon you!')), `The wish announcement must reach the message window: ${toplines.join(' | ')}`);
});
//# sourceMappingURL=amulet_wish_announcement.test.js.map