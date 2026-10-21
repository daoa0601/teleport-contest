import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { nomul } from '../js/command_state.js';
import { flush_screen, newsym } from '../js/display.js';
import { placeObject } from '../js/floor_object.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { mksobj } from '../js/mklev.js';
import { BOULDER } from '../js/object_data.js';
import { freshTurnRoom } from './support/playable-room.js';

function cellAt(x: number, y: number): string {
    return requireGameDisplay().grid[y + 1]?.[x - 1]?.ch ?? '';
}

function statusRows(): string {
    return requireGameDisplay().grid.slice(-2)
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
}

void test('a helpless turn updates the status but leaves map changes buffered', async () => {
    freshTurnRoom({ right: 16, energy: 2 });
    requirePlayingGame(game);
    await flush_screen(1);
    const x = game.u.ux + 2, y = game.u.uy;
    const floor = cellAt(x, y);
    nomul(-3);
    await placeObject(await mksobj(BOULDER, false, false), x, y);
    newsym(x, y);
    game.u.uen = game.u.uenmax = 4;
    game.context.botl = true;

    await moveloop_core();

    assert.match(statusRows(), /Pw:4\(4\)/, 'bot() still runs for a helpless hero');
    assert.equal(cellAt(x, y), floor, 'no rhack() flush_screen() reaches the map');
    await flush_screen(1);
    assert.notEqual(cellAt(x, y), floor, 'the next flush shows the buffered boulder');
});
