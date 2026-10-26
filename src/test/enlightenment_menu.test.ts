import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { WAN_ENLIGHTENMENT } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('wand enlightenment uses a short tty menu on the right side', async () => {
    freshObjectRoom({ role: 'wizard' });
    game.displayName = 'Ada';
    game.plname = 'Ada';
    const wand = await addInventoryObject(WAN_ENLIGHTENMENT, { spe: 2 });
    const input = resetInputState();
    let title = '';
    let marker = '';
    input.beforeRead = () => {
        const display = requireGameDisplay();
        const top = display.grid[0]?.map(cell => cell.ch).join('') ?? '';
        if (!top.includes("Ada the Wizard's attributes:")) return;
        title = top;
        marker = display.grid[display.cursorRow]?.map(cell => cell.ch).join('') ?? '';
    };
    input.feed(`${wand.invlet}${' '.repeat(10)}`);

    await rhack('z'.charCodeAt(0));

    assert.match(title, /Ada the Wizard's attributes:/);
    assert.ok(title.indexOf('Ada') > 1, 'a short attributes menu should overlay the right side');
    assert.match(marker, /\(end\)/);
    assert.equal(wand.spe, 1);
});
