import assert from 'node:assert/strict';
import test from 'node:test';

import { flush_screen } from '../js/display.js';
import { HOLE } from '../js/const.js';
import { makeBlinded } from '../js/sight_change.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { maketrap } from '../js/mklev.js';
import { createPoisonGasCloud } from '../js/regions.js';
import { cansee } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C trap.c:maketrap() links a new trap into the level's trap list only after
// the per-type construction finishes (trap.c:577). The newsym() that
// unearth_objs() issues from inside that construction (dig.c:2111) therefore
// cannot observe the fresh trap yet, and while a visible gas cloud keeps
// covering the square, newsym()'s region branch never maps it either. A hole
// dug under a monster standing in a cloud thus never enters hero memory: when
// the gas later blinds the hero, the remembered floor is displayed, not '^'.
void test('a hole dug under a monster in a gas cloud is not remembered', async () => {
    const level = await freshObjectRoom();
    requirePlayingGame(game);
    await createMonsterAt('vrock', 11, 10);
    await createPoisonGasCloud(game, 11, 10, 1, 8);
    assert.equal(cansee(11, 10), true);

    const trap = await maketrap(11, 10, HOLE);

    // Holes are the one trap type born already seen (unhideable_trap).
    assert.ok(trap);
    assert.equal(trap.tseen, true);
    // The digging-window redraw mapped the floor, not the fresh hole.
    assert.equal(level.requireAt(11, 10).remembered_glyph?.kind, 'terrain');

    await makeBlinded(1, { talk: false });
    await flush_screen(1);
    const cell = requireGameDisplay().grid[10]?.[11];
    assert.ok(cell);
    assert.notEqual(cell.ch, '^');
});
