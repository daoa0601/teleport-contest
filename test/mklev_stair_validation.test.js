import assert from 'node:assert/strict';
import test from 'node:test';
import { COLNO, DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DB_WEST, DRAWBRIDGE_UP, ROWNO, STAIRS, } from '../js/const.js';
import { flush_screen } from '../js/display.js';
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
for (const [underneath, surface] of [
    [DB_MOAT, 'water'],
    [DB_LAVA, 'molten lava'],
    [DB_ICE, 'ice'],
    [DB_FLOOR, 'floor of a room'],
]) {
    void test(`stair diagnostics name ${surface} beneath a raised drawbridge`, async (t) => {
        await roomBindings(t);
        requirePlayingGame(game);
        game.u.uz = { dnum: 0, dlevel: 4 };
        await mklev();
        const display = new GameDisplay(null);
        game.nhDisplay = display;
        game.program_state.in_sanity_check = true;
        const square = requireGameLevel().requireAt(10, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = DB_WEST | underneath;
        await mkstairs(10, 10, false, null);
        await flush_screen(1);
        assert.equal(display.grid[0]?.map(cell => cell.ch).join('').trimEnd(), `mkstairs:  placing stairs down on ${surface} at <10,10>`);
        assert.equal(square.typ, STAIRS, 'the diagnostic must still allow stair construction');
    });
}
//# sourceMappingURL=mklev_stair_validation.test.js.map