import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { docrt, flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, SACK } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

for (const overlay of [true, false]) {
    for (const dismiss of [' ', '\u001b']) {
        void test(`multiple shop quotes restore the map after ${dismiss === ' ' ? 'Space' : 'Escape'} with overlay ${overlay}`, async () => {
            freshObjectRoom({ flags: { menu_overlay: overlay } });
            await createStaffedShop();
            await floorObject(DAGGER, 10, 10);
            await floorObject(SACK, 10, 10);
            await docrt();
            await flush_screen(1);
            const input = resetInputState();
            input.feed('chat\n');

            const chatting = rhack('#'.charCodeAt(0));
            try {
                await input.waitUntilBlocked();
                const display = requireGameDisplay();
                const lines = display.grid.map(row => row.map(cell => cell.ch).join(''));
                assert.match(lines[0] ?? '', /Fine goods for sale:/);
                assert.match(lines[2] ?? '', /sack|dagger/);
                assert.match(lines[3] ?? '', /sack|dagger/);
                assert.match(lines[4] ?? '', /--More--/, 'The menu pager immediately follows the quotes');
                if (overlay) assert.ok((lines[0] ?? '').indexOf('Fine goods') > 0);
                else assert.ok((lines[4] ?? '').startsWith(' --More--'));
            } finally {
                input.feed(dismiss);
                await chatting;
            }

            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.doesNotMatch(screen, /Fine goods for sale:|zorkmids|--More--/);
            assert.match(screen, /@/, 'Dismissing the quotes reveals the hero again');
            assert.equal(game.context.move, 1);
        });
    }
}
