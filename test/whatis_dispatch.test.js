import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { applyNethackrc } from '../js/options.js';
import { freshGameplayRoom } from './support/playable-room.js';
for (const keys of ['/', '#whatis\n', '!']) {
    void test(`${JSON.stringify(keys)} opens the whatis choices without spending a turn`, async () => {
        freshGameplayRoom();
        if (keys === '!')
            applyNethackrc('BIND=!:whatis');
        const input = resetInputState();
        input.feed(keys);
        const action = rhack(0);
        try {
            const blocked = await Promise.race([
                input.waitUntilBlocked().then(() => true), action.then(() => false),
            ]);
            assert.equal(blocked, true, 'whatis should wait for a menu selection');
            const text = requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(text, /What do you want to look at:/);
            assert.match(text, /something on the map/);
        }
        finally {
            input.feed('\x1b');
            await action;
        }
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=whatis_dispatch.test.js.map