import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { POT_WATER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { floorObjectsAt } from './support/level-state.js';
// C do.c:318-360 flooreffects(): a potion stack landing on hot ground
// (level.flags.temperature > 0, ROOM/CORR square) heats up and survives
// when obj_resists(obj, survival_chance, 100) holds.  survival_chance is
// 70 for a blessed stack plus Luck * 2 when the stack was handled
// (do.c:338-341); Luck is u.uluck + u.moreluck (you.h:464), so a carried
// luckstone bonus protects the stack as much as base luck.  A surviving
// stack is placed normally (res stays FALSE) and the drop command still
// takes the turn: the monster phase and the turn counter advance before
// the next command input.
void test('a blessed potion stack survives hot ground with carried luck and the drop takes the turn', async () => {
    const level = await freshObjectRoom({
        gameplaySeed: 107n,
        // Base luck 0 with a +3 carried bonus: survival_chance 76, so the
        // fixed roll in [70, 75] survives only when moreluck is counted.
        hero: { uluck: 0, moreluck: 3 },
    });
    assert.ok(game.level, 'the fixture must own a level');
    game.level.flags.temperature = 1;
    game._moveloopStarted = true;
    const stack = await addInventoryObject(POT_WATER, {
        blessed: true, quan: 3, quantity: 3,
    });
    const movesBefore = game.moves;
    const input = resetInputState();
    const topLines = [];
    input.beforeRead = () => {
        const display = game.nhDisplay;
        if (display)
            topLines.push(display.grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '');
    };
    input.feed(`d${stack.invlet ?? 'a'}   \x1b`);
    await moveloop_core(); // 'd' drop command through the hot-ground roll
    await moveloop_core(); // elapsed turn: monster phase, moves advance
    const waters = floorObjectsAt(level, game.u.ux, game.u.uy)
        .filter(object => object.otyp === POT_WATER);
    assert.equal(waters.length, 1, 'the surviving stack lands once under the hero');
    assert.equal(waters[0]?.quan, 3, 'the whole stack survives together');
    assert.ok(game.moves > movesBefore, 'a surviving hot-ground landing still consumes the drop turn');
    const dropLine = topLines.findIndex(line => line.includes('You drop 3 potions of holy water.'));
    const heatLine = topLines.findIndex(line => line.includes('The potions of holy water heat up as they hit the hot ground.'));
    assert.ok(dropLine >= 0, 'the drop is announced before the heating');
    assert.ok(heatLine > dropLine, 'the heating message follows the drop message');
    assert.ok(topLines.every(line => !line.includes('shatter')), 'a surviving stack never announces shattering');
});
//# sourceMappingURL=hot_ground_drop_survival.test.js.map