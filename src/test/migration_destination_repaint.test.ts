import assert from 'node:assert/strict';
import test from 'node:test';

import { flush_screen, map_object, newsym, see_monsters, see_objects, see_traps } from '../js/display.js';
import { monsterName } from '../js/do_name.js';
import { placeMonsterOnMap } from '../js/steed.js';
import { detachMonsterFromLevel } from '../js/mon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { moveloop_core } from '../js/allmain.js';
import { LEVEL_TELEP, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { DAGGER } from '../js/object_data.js';

import { floorObject } from './support/game-objects.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { requireScreenCell } from './support/screen.js';

// C monmove.c:postmov() repaints the moved actor only while it still has a
// map position.  A trap that carried it elsewhere runs
//     if (mtmp->mx) newsym(mtmp->mx, mtmp->my);
//     return MMOVE_DIED;
// (monmove.c:1510-1513), and one that migrated it off the level has already
// zeroed mx (dog.c migrate_to_level, "mx==0 implies migrating"), so the
// square it left is drawn only by seetrap()'s and mon_leaving_level()'s
// newsym calls.  While the hero hallucinates, each of those repaints and
// each once-per-input refresh (allmain.c:456-459 see_monsters/see_objects/
// see_traps) consumes a display-RNG draw for the random object shown there
// (display.c map_object -> random_object), so one extra repaint shifts
// every later hallucinated glyph, color, and monster name.
const TRAP = { x: 12, y: 10 } as const;
const START = { x: 13, y: 10 } as const;
const SEED = 403n;

function hallucinatingRoom() {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    game.level.flags.rndmongen = false;
    game.u.hallucinationTurns = 20;
    addTrap(source, LEVEL_TELEP, TRAP.x, TRAP.y, { dst: { dnum: 0, dlevel: 2 } });
    return source;
}

void test('a monster a level teleport trap sends off the level is not repainted at its last square', async () => {
    // Expected glyph: consume the display draws in C's order.  The input
    // boundary before the monster's turn refreshes the hallucinating map
    // (see_monsters draws the orc, see_objects the dagger); the trap then
    // spends the "Suddenly, … disappears out of sight." name draws,
    // seetrap()'s newsym of the occupied square (object under the monster,
    // then the monster), and mon_leaving_level()'s newsym of the vacated
    // square; the next input boundary redraws the dagger once more.
    hallucinatingRoom();
    const dagger = await floorObject(DAGGER, TRAP.x, TRAP.y);
    const standing = await createMonsterAt('orc', START.x, START.y,
        MM_ANGRY | MM_NOGRP | NO_MINVENT);
    initRng(SEED);
    await see_monsters();
    await see_objects();
    await see_traps();
    // The move itself spends no display draw; the trap's message and
    // seetrap()'s newsym of the occupied square follow it (teleport.c
    // mlevel_tele_trap).
    await placeMonsterOnMap(standing, TRAP.x, TRAP.y, game);
    await monsterName(standing, { state: game });
    await newsym(TRAP.x, TRAP.y);
    await detachMonsterFromLevel(standing);
    await see_objects();
    await flush_screen(1);
    const expected = requireScreenCell(TRAP.x - 1, TRAP.y + 1);

    // The real event: the orc walks west toward the hero and lands on the
    // teleport trap during the monster phase of a resting turn.
    hallucinatingRoom();
    await floorObject(DAGGER, TRAP.x, TRAP.y);
    const orc = await createMonsterAt('orc', START.x, START.y,
        MM_ANGRY | MM_NOGRP | NO_MINVENT);
    orc.movement = 12;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const input = resetInputState();
    installPagerInput(input, { expected: /disappears/, limit: 4 });
    input.feed('.');
    initRng(SEED);

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /disappears|^\s*$/);

    assert.equal(orc.mx, 0, 'the trap should have migrated the orc off the level');
    const actual = requireScreenCell(TRAP.x - 1, TRAP.y + 1);
    assert.equal(actual.ch, expected.ch,
        'the vacated square keeps the input boundary redraw of mon_leaving_level()');
    assert.equal(actual.color, expected.color,
        'the vacated square was not drawn again from a later display-RNG draw');
});
