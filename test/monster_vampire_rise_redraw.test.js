import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { glyphAt } from '../js/display.js';
import { GlyphOffset } from '../js/glyph_numbers.js';
import { AD_PHYS } from '../js/monster_attack_types.js';
import { MONSTER_NAME, MONSTER_COLOR } from '../js/monster_data.js';
import { finishMonsterKilled } from '../js/mon.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// mon.c:vamprises() closes with a single newsym(x, y) on the death square
// (mon.c:2983).  When the dying shape had engulfed the hero, expels() runs
// first and moves the swallower aside with mnexto() (mhitu.c:300), which
// redraws it, and newcham() then draws the risen form at that new square
// (mon.c:5458) before the rise message.  vamprises() itself never redraws
// the new square: with a hallucinating hero every monster-cell redraw
// spends an rn2_on_display_rng draw, and an extra newsym(mon->mx, mon->my)
// both repaints the risen vampire with a second hallucination and shifts
// every later hallucinated glyph on the map.
void test('a vampire rising after an expulsion is drawn once at its new square', async () => {
    await freshObjectRoom({ hero: { hallucinationTurns: 100 } });
    requirePlayingGame(game);
    const cloud = await createMonsterAt('fog cloud', 12, 10, NO_MINVENT);
    cloud.cham = MONSTER_NAME.indexOf('vampire leader');
    // The hero is engulfed by the dying cloud, so vamprises() must expel
    // first; the swallower ends the sequence away from its death square.
    game.u.ustuck = cloud;
    game.u.uswallow = 1;
    game.u.ux = cloud.mx;
    game.u.uy = cloud.my;
    initRng(4n);
    const messages = [];
    const death = await finishMonsterKilled(cloud, game, {
        damageType: AD_PHYS, cause: null,
        publish: async (message) => messages.push(message),
    });
    assert.equal(death.survived, true);
    assert.equal(cloud.mnum, MONSTER_NAME.indexOf('vampire leader'));
    assert.ok(messages.some(message => message.includes('rises as')), 'a visible vampire recovery must announce its new form');
    assert.ok(cloud.my !== 10 || cloud.mx !== 12, 'expels() moved the swallower away from its death square');
    // The risen form's square holds exactly the one hallucination draw that
    // newcham() made there (seed 4 draws species 355, "Norn").  A second
    // tail redraw spends the next display draw and repaints the square as
    // species 47 instead.
    const glyph = glyphAt(cloud.mx, cloud.my)?.glyph ?? -1;
    assert.ok(glyph >= GlyphOffset.monMale && glyph < GlyphOffset.monMale + MONSTER_COLOR.length, `the risen form is shown as a monster glyph, got ${glyph}`);
    assert.equal(glyph - GlyphOffset.monMale, 355);
});
//# sourceMappingURL=monster_vampire_rise_redraw.test.js.map