import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { flush_screen, newsym, pline } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { placeHeroOnLevel } from '../js/hero_location.js';
import { resetInputState } from '../js/input.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
import { APPLE, FOOD_RATION, SACK } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { CORR } from '../js/const.js';
import { freshObjectRoom } from './support/object-room.js';
void test('blind automatic floor inspection names the ground in a corridor', async () => {
    const level = freshObjectRoom({ flags: { pickup: false }, hero: { blindTurns: 10 } });
    level.requireAt(10, 10).typ = CORR;
    await floorObject(APPLE, 10, 10);
    const input = resetInputState();
    const inspection = autopickupAtHero();
    await input.waitUntilBlocked();
    const message = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
    input.feed(' ');
    await inspection;
    assert.match(message, /You try to feel what is lying here on the ground\./);
});
void test('walking onto a floor pile redraws the hero before acknowledging an older message', async () => {
    freshObjectRoom({ heroX: 10, heroY: 10, flags: { pickup: false } });
    await floorObject(APPLE, 11, 10);
    await floorObject(FOOD_RATION, 11, 10);
    await flush_screen(1);
    await pline('You hear a creature in the corridor.');
    await placeHeroOnLevel(11, 10);
    newsym(10, 10);
    vision_recalc(1);
    const input = resetInputState();
    const inspection = autopickupAtHero();
    await input.waitUntilBlocked();
    const display = requireGameDisplay(game);
    const message = display.grid[0]?.map(cell => cell.ch).join('') ?? '';
    const destinationGlyph = display.grid[11]?.[10]?.ch;
    input.feed(' '.repeat(10));
    await inspection;
    assert.match(message, /creature in the corridor\.--More--/);
    assert.equal(destinationGlyph, '@', 'the message pager must show the hero at the newly entered pile');
});
void test('a manual pickup underfoot ends a lingering rush prefix and refreshes the turn counter', async () => {
    const input = freshTurnRoom({ flags: { tips: false, time: true } });
    const sack = await floorObject(SACK, 10, 10);
    installPagerInput(input, { expected: /sack|Unknown|pick/i, limit: 10 });
    // 'g' followed by an unbound key leaves the rush prefix pending across
    // rhack()'s unknown-command tail, so the later ',' runs dopickup()
    // while context.run is still set.
    input.feed('g~,');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.context.move, 1, 'the pickup takes the turn');
    assert.equal(game.inventory.includes(sack), true, 'the sack is picked up');
    assert.equal(game.context.run, 0, 'an object underfoot stops the lingering run');
    const turnBeforeBoundary = game.moves;
    await finishAtCommandInput(input, moveloop_core, /.*/);
    assert.equal(game.moves, turnBeforeBoundary + 1, 'the boundary follows the pickup turn');
    const status = game.nhDisplay?.statusLines?.[1] ?? '';
    assert.match(status, new RegExp(`T:${game.moves}\\b`), 'the ended run re-flags the time display for the pickup turn');
});
//# sourceMappingURL=pickup_display_timing.test.js.map