import assert from 'node:assert/strict';
import test from 'node:test';
import { LANDMINE, MOAT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrapAt } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

// C trap.c:drown() escapes a flooded land-mine hole through
// teleds(x, y, TELEDS_ALLOW_DRAG), and teleds() finishes with
// spoteffects(TRUE) (teleport.c:568).  spoteffects() runs pickup()
// (hack.c:3381), which describes the landing square's item via
// look_here() (invent.c:4282): "You see here a gold piece." follows
// "Pheew!  That was close.".
void test('crawling out of a flooded land-mine hole reports the item on the landing square', async () => {
    const level = await freshObjectRoom({
        flags: { pickup: false, verbose: true },
        hero: { uhp: 200, uhpmax: 200 },
    });
    const mine = addTrap(level, LANDMINE, 10, 10);
    // An adjacent pool makes blow_up_landmine() fill the hole with water.
    level.requireAt(11, 10).typ = MOAT;
    // Wherever the crawl lands among the remaining dry neighbors, an item
    // is there to be described.
    const neighbors: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];
    for (const [dx, dy] of neighbors) {
        await floorObject(GOLD_PIECE, 10 + dx, 10 + dy, { quan: 1 });
    }
    resetInputState().feed(' '.repeat(40));

    await triggerHeroTrapAt(10, 10);

    const log = [...game._messageHistory, game._pending_message].join(' | ');
    const crawl = log.indexOf('Pheew!  That was close.');
    assert.ok(crawl >= 0, `expected a crawl-out: ${log}`);
    const after = log.slice(crawl);
    assert.match(after, /You see here (?:a gold piece|\d+ gold pieces)\./,
        `the crawl landing must describe the square: ${log}`);
    assert.equal(level.requireAt(10, 10).typ, MOAT);
    assert.ok(game.u.ux !== 10 || game.u.uy !== 10, 'the hero escaped the water');
    assert.ok(mine.ttyp !== LANDMINE, 'the mine is gone');
});
