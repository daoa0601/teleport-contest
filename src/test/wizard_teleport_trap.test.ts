import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { TELEP_TRAP } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('wizard teleport through a seen random teleport trap takes time without costing nutrition', async () => {
    const level = freshObjectRoom({ flags: { debug: true, tips: false, verbose: false } });
    requirePlayingGame(game);
    addTrap(level, TELEP_TRAP, 10, 10, { tseen: true });
    const hunger = game.u.uhunger;
    const input = resetInputState();
    const choices = [...'l.'];
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (screen.includes('--More--')) return ' '.charCodeAt(0);
            if (choices.length === 2) assert.match(screen, /Where do you want to be teleported/);
            const choice = choices.shift();
            assert.ok(choice, 'Teleport must finish after a destination is chosen');
            return choice.charCodeAt(0);
        },
    };

    await rhack(20);

    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uy, 10);
    assert.equal(game.u.uhunger, hunger);
    assert.equal(game.context.move, 1);
});
