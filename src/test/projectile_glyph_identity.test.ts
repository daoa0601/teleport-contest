import assert from 'node:assert/strict';
import test from 'node:test';
import { redrawMap } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { monsterProjectileDisplay } from '../js/monster_projectile_display.js';
import { ARROW } from '../js/object_data.js';
import { captureThrownObjectFlight } from '../js/thrown_object.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

void test('a monster arrow passing over an identical floor arrow leaves the cursor after the restored cell', async () => {
    freshObjectRoom({ heroX: 10, heroY: 12 });
    requirePlayingGame(game);
    await floorObject(ARROW, 12, 10, { initialize: false });
    await redrawMap();
    const flight = monsterProjectileDisplay(await knownObject(ARROW, { initialize: false }), game);

    await flight.show({ x: 11, y: 10 });
    await flight.show({ x: 12, y: 10 });

    const display = requireGameDisplay(game);
    assert.equal(requireScreenCell(11, 11).ch, ')');
    assert.deepEqual([display.cursorCol, display.cursorRow], [11, 11]);
    flight.clear();
});

void test('a hero arrow passing over an identical floor arrow leaves the cursor after the restored cell', async () => {
    freshObjectRoom({ heroX: 10, heroY: 12 });
    await floorObject(ARROW, 12, 10, { initialize: false });
    await redrawMap();
    const arrow = await knownObject(ARROW, { initialize: false });

    await captureThrownObjectFlight(arrow, [{ x: 11, y: 10 }, { x: 12, y: 10 }]);

    const display = requireGameDisplay(game);
    assert.equal(requireScreenCell(11, 11).ch, ')');
    assert.deepEqual([display.cursorCol, display.cursorRow], [11, 11]);
});
