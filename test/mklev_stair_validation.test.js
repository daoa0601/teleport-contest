import assert from 'node:assert/strict';
import test from 'node:test';
import { COLNO, ROWNO } from '../js/const.js';
import { GameDisplay } from '../js/game_display.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mklev, mkstairs } from '../js/mklev.js';
import { installPagerInput } from './support/pager-input.js';
import { roomBindings } from './support/themed-room-bindings.js';
void test('stair construction rejects coordinates outside the playable map', async (t) => {
    await roomBindings(t);
    requirePlayingGame(game);
    game.u.uz = { dnum: 0, dlevel: 4 };
    await mklev();
    game.nhDisplay = new GameDisplay(null);
    const previousStairs = game.stairs;
    const unusedColumn = requireGameLevel().requireAt(0, 10).typ;
    installPagerInput(resetInputState(), {
        expected: /bogus stair attempt|Program in disorder|Please report these messages/,
        limit: 12,
    });
    for (const point of [{ x: 0, y: 10 }, { x: COLNO, y: 10 }, { x: 10, y: -1 }, { x: 10, y: ROWNO }]) {
        await mkstairs(point.x, point.y, false, null, true);
        assert.ok(game.stairs === previousStairs, `invalid stairs at ${point.x},${point.y} must not enter the level's stair list`);
    }
    assert.equal(requireGameLevel().requireAt(0, 10).typ, unusedColumn, 'forcing invalid stairs must not turn the unused map column into floor');
});
//# sourceMappingURL=mklev_stair_validation.test.js.map