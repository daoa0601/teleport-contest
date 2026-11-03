import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { glyphAt } from '../js/display.js';
import { game } from '../js/gstate.js';
import { initRng, rn2Display } from '../js/rng.js';
import { randomDisplayMonsterName } from '../js/do_name.js';
import { releaseHeroFromMonster } from '../js/hero_expulsion.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C mon.c:unstuck() keeps the hero's current vision bounds: it only raises
// vision_full_recalc and calls docrt().  docrt() starts with vision_recalc(2)
// (display.c:1740), whose update loop scans the *previous* row bounds and
// newsym()s every formerly in-sight cell while the fresh vision array is
// still empty, so cansee() is false there.  For a cell that held a visible,
// non-infravisible hostile monster, that newsym() reaches newsym()'s warning
// branch (display.c:1030) and display_warning() spends one display-RNG draw
// on the hallucinated danger numeral (display.c:640,
// rn2_on_display_rng(WARNCOUNT - 1) + 1) before vision_recalc(0) and
// see_monsters() redraw the monster itself.  A hallucinating hero therefore
// sees the whole expulsion redraw advance the display stream by that warning
// draw plus the monster's two renewed glyphs.

void test('expelling a swallowed hero spends the release redraw display draws in native order', async () => {
    await freshObjectRoom({ hero: { warning: true, hallucinationTurns: 100 } });
    const engulfer = await createMonsterAt('purple worm', game.u.ux, game.u.uy,
        MM_NOGRP | NO_MINVENT);
    const warned = await createMonsterAt('earth elemental', 12, 10, MM_NOGRP | NO_MINVENT);
    game.u.ustuck = engulfer;
    game.u.uswallow = 1;
    assert.equal(glyphAt(12, 10)?.kind, 'monster');

    initRng(23n);
    await releaseHeroFromMonster(engulfer);
    const perceivedName = randomDisplayMonsterName();

    // The release redraw consumes exactly three display draws: the warning
    // flash for the no-longer-seen elemental, then its monster glyph twice
    // (renewed sight in docrt's vision_recalc(0), then see_monsters()).
    initRng(23n);
    rn2Display(2);
    rn2Display(2);
    rn2Display(2);
    const nameAfterThreeDraws = randomDisplayMonsterName();

    assert.equal(perceivedName, nameAfterThreeDraws);
});
