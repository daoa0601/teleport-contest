import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { ICE, ROOM, FOUNTAIN } from '../js/const.js';
import { bot, flush_screen, map_location } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
function status() {
    return requireScreenRow(23).map(cell => cell.ch).join('');
}
void test('terrain status describes the last seen floor instead of revealing a changed feature', async () => {
    const level = freshObjectRoom({ flags: { terrainstatus: true }, hero: { uhs: 1 } });
    const location = level.requireAt(10, 10);
    location.typ = FOUNTAIN;
    location.lastseentyp = ROOM;
    await bot();
    assert.match(status(), /\bFloor\b/);
    assert.doesNotMatch(status(), /Fountain/);
});
void test('stepping onto known ice updates terrain status during the next flush', async () => {
    const level = freshObjectRoom({ flags: { terrainstatus: true, pickup: false }, hero: { uhs: 1 } });
    requirePlayingGame(game);
    level.requireAt(11, 10).typ = ICE;
    map_location(11, 10, true);
    await bot();
    await rhack('l'.charCodeAt(0));
    await flush_screen(1);
    assert.equal(game.u.ux, 11);
    assert.match(status(), /\bIce\b/);
});
//# sourceMappingURL=status_terrain_field.test.js.map