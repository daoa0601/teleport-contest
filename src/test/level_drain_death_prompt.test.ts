import assert from 'node:assert/strict';
import test from 'node:test';
import { loseHeroExperience } from '../js/exper.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

void test('fatal level drain asks the wizard death question directly and resumes the level loss', async () => {
    await freshObjectRoom({ flags: { debug: true }, hero: {
        ulevel: 1, uhp: 20, uhpmax: 20, uexp: 5,
        uen: 10, uenmax: 10, uhpinc: [0, 4], ueninc: [0, 2],
    } });
    const messages: string[] = [];
    resetInputState().display = {
        async readKey() {
            const row = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
            messages.push(row);
            return row.startsWith('Die?') ? 'n'.charCodeAt(0) : 32;
        },
    };

    const died = await loseHeroExperience('life drainage');

    assert.equal(died, false);
    assert.ok(messages.some(message => message.startsWith('Die?')));
    assert.equal(messages.some(message => message.includes('You die...')), false,
        'losexp() calls done() directly, without the damage death announcement');
    assert.equal(game.u.umortality, 1);
    assert.equal(game.u.ulevel, 1);
    assert.equal(game.u.uexp, 0);
    assert.equal(game.u.uhp, 16);
    assert.equal(game.u.uhpmax, 16);
    assert.equal(game.u.uenmax, 8);
});
