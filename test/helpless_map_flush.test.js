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
function cellAt(x, y) {
    return requireGameDisplay().grid[y + 1]?.[x - 1]?.ch ?? '';
}
function statusRows() {
    return requireGameDisplay().grid.slice(-2)
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
}
async function helplessTurnWithBufferedBoulder(status) {
    freshTurnRoom({ right: 16, energy: 2 });
    requirePlayingGame(game);
    game.flags.time = status === 'time';
    await flush_screen(1);
    const x = game.u.ux + 2, y = game.u.uy;
    const floor = cellAt(x, y);
    nomul(-3);
    game.u.uen = game.u.uenmax;
    game.u.uhp = game.u.uhpmax;
    game.context.botl = false;
    await placeObject(await mksobj(BOULDER, false, false), x, y);
    newsym(x, y);
    if (status === 'botl') {
        game.u.uen = game.u.uenmax = 4;
        game.context.botl = true;
    }
    // moveloop sets time_botl whenever the turn counter changes.
    if (status === 'time')
        game.context.time_botl = true;
    await moveloop_core();
    return { floor, shown: cellAt(x, y), x, y };
}
void test('a helpless turn without a status change leaves map changes buffered', async () => {
    const { floor, shown, x, y } = await helplessTurnWithBufferedBoulder('unchanged');
    assert.equal(shown, floor, 'no rhack() or curs_on_u() flush reaches the map');
    await flush_screen(1);
    assert.notEqual(cellAt(x, y), floor, 'the next flush shows the buffered boulder');
});
void test('a helpless turn that updates the status also draws the buffered map', async () => {
    const { floor, shown } = await helplessTurnWithBufferedBoulder('botl');
    assert.match(statusRows(), /Pw:4\(4\)/);
    assert.notEqual(shown, floor, 'bot() is followed by curs_on_u()');
});
void test('a helpless turn that advances the shown time draws the buffered map', async () => {
    const { floor, shown } = await helplessTurnWithBufferedBoulder('time');
    assert.notEqual(shown, floor, 'timebot() is followed by curs_on_u()');
});
//# sourceMappingURL=helpless_map_flush.test.js.map