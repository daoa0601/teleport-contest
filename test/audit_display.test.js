import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen, glyphAt, map_background, newsym, under_water } from '../js/display.js';
import { GlyphOffset } from '../js/glyph_numbers.js';
import { def_warnsyms, POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { CLR_RED } from '../js/terminal.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
// display.c:warning_of()/display_warning()/mon_warning() and under_water() --
// paths the recorded corpus never executes natively, so their behavior is
// pinned here directly from the C rules.  A warned monster is shown as a
// numbered glyph when the hero carries Warning and neither sees nor senses
// it: wl = min(WARNCOUNT - 1, mon->m_lev / 4).
const OFFSCREEN = { x: 3, y: 3 };
async function unseenWarnedMonster(mlev) {
    freshObjectRoom({ hero: { warning: true } });
    const monster = await createMonsterAt('soldier ant', OFFSCREEN.x, OFFSCREEN.y);
    monster.m_lev = mlev;
    newsym(OFFSCREEN.x, OFFSCREEN.y);
    await flush_screen(1);
    return monster;
}
void test('an unseen hostile monster warns by level quarters', async () => {
    // m_lev 4..7 -> '1', the first danger numeral.
    await unseenWarnedMonster(4);
    assert.equal(requireScreenCell(2, 4).ch, '1');
    assert.equal(glyphAt(OFFSCREEN.x, OFFSCREEN.y)?.glyph, GlyphOffset.warning + 1);
    assert.equal(requireScreenCell(2, 4).color, CLR_RED);
});
void test('warning numerals grow with the monster level', async () => {
    // m_lev 19 -> trunc(19/4) = 4.
    await unseenWarnedMonster(19);
    assert.equal(requireScreenCell(2, 4).ch, '4');
    assert.equal(glyphAt(OFFSCREEN.x, OFFSCREEN.y)?.glyph, GlyphOffset.warning + 4);
});
void test('the strongest monsters clamp at the top warning numeral', async () => {
    // m_lev 30 -> 30/4 = 7 clamps to WARNCOUNT - 1 = 5.
    await unseenWarnedMonster(30);
    assert.equal(requireScreenCell(2, 4).ch, String(def_warnsyms.length - 1));
    assert.equal(glyphAt(OFFSCREEN.x, OFFSCREEN.y)?.glyph, GlyphOffset.warning + def_warnsyms.length - 1);
});
void test('a peaceful monster never raises a warning glyph', async () => {
    freshObjectRoom({ hero: { warning: true } });
    const pet = await createMonsterAt('kitten', OFFSCREEN.x, OFFSCREEN.y);
    pet.mpeaceful = 1;
    pet.m_lev = 30;
    newsym(OFFSCREEN.x, OFFSCREEN.y);
    await flush_screen(1);
    assert.equal(glyphAt(OFFSCREEN.x, OFFSCREEN.y)?.glyph, GlyphOffset.unexplored);
    assert.equal(requireScreenCell(2, 4).ch, ' ');
});
void test('a hallucinating hero sees a random nonzero warning numeral', async () => {
    freshObjectRoom({ hero: { warning: true, hallucinationTurns: 100 } });
    const monster = await createMonsterAt('soldier ant', OFFSCREEN.x, OFFSCREEN.y);
    monster.m_lev = 4; // a non-hallucinated hero would always see '1'
    initRng(7n);
    newsym(OFFSCREEN.x, OFFSCREEN.y);
    await flush_screen(1);
    const level = (glyphAt(OFFSCREEN.x, OFFSCREEN.y)?.glyph ?? -1) - GlyphOffset.warning;
    assert.ok(level >= 1 && level <= def_warnsyms.length - 1, `hallucinated warning level ${level} outside 1..${def_warnsyms.length - 1}`);
    assert.equal(requireScreenCell(2, 4).ch, String(level));
});
// display.c:under_water(): while swimming, the map collapses to a 3x3 window
// around the hero showing only pool, lava and ice squares; every other cell
// renders unexplored.  A blind swimmer sees unexplored water too, but still
// updates their own square.
async function swimmingHero({ blind = false } = {}) {
    const map = freshObjectRoom({ hero: blind ? { blindTurns: 50 } : {} });
    for (const [x, y] of [[10, 10], [11, 10], [10, 11]]) {
        const loc = map.requireAt(x, y);
        loc.typ = POOL;
    }
    game.u.uinwater = true;
    game.blind = blind;
    return map;
}
void test('a swimmer sees only adjacent water squares', async () => {
    await swimmingHero();
    await under_water(1);
    await flush_screen(1);
    assert.equal(requireScreenCell(9, 11).ch, '@', 'the hero remains visible');
    assert.equal(requireScreenCell(10, 11).ch, '}', 'east pool square');
    assert.equal(requireScreenCell(9, 12).ch, '}', 'south pool square');
    assert.equal(requireScreenCell(8, 11).ch, ' ', 'stone square stays unexplored');
    assert.equal(requireScreenCell(9, 10).ch, ' ', 'stone square stays unexplored');
});
void test('a deferred underwater redraw keeps magic mapping visible until the next update', async () => {
    const map = await swimmingHero();
    await under_water(1);
    await flush_screen(1);
    // magic mapping paints remembered terrain beyond the swim window...
    const far = map.requireAt(13, 10);
    far.lit = false;
    far.waslit = false;
    map_background(13, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(12, 11).ch, '.', 'mapped floor beyond the window');
    // ...and under_water(2) defers the restore instead of clearing it.
    await under_water(2);
    await flush_screen(1);
    assert.equal(requireScreenCell(12, 11).ch, '.', 'defer does not redraw yet');
    // the next ordinary update performs the deferred full redraw.
    await under_water(0);
    await flush_screen(1);
    assert.equal(requireScreenCell(12, 11).ch, ' ', 'window restored');
    assert.equal(requireScreenCell(10, 11).ch, '}', 'pool square redrawn');
});
void test('a blind swimmer sees unexplored water but still their own square', async () => {
    await swimmingHero({ blind: true });
    await under_water(1);
    await flush_screen(1);
    assert.equal(requireScreenCell(9, 11).ch, '@');
    assert.equal(requireScreenCell(10, 11).ch, ' ', 'blind pool east is unexplored');
    assert.equal(requireScreenCell(9, 12).ch, ' ', 'blind pool south is unexplored');
});
//# sourceMappingURL=audit_display.test.js.map