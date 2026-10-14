import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

void test('the menu prefix reports that it has no effect on #wizgenesis before requesting a monster', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const messages: string[] = [];
    const input = resetInputState();
    input.feed('m#wizgenesis\n');
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            messages.push(screen);
            if (screen.includes('--More--')) return ' '.charCodeAt(0);
            assert.match(screen, /Create what kind of monster/);
            return 27;
        },
    };

    await rhack(0);

    assert.ok(messages.some(message => message.includes("'m' prefix has no effect for the wizgenesis command.")));
    assert.equal(game.context.move, 0);
});
