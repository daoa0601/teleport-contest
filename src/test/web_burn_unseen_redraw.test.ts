import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT, WEB } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C zap.c:zap_over_floor() ZT_FIRE web case (zap.c:5165-5172): delfloortrap()
// always destroys the web, but the burst message and the newsym() refresh are
// both gated on see_it.  A blind hero therefore never hears about the web and
// the unseen square is not redrawn: a telepathically sensed monster standing
// there keeps the hallucinated appearance it was last drawn with instead of
// being rerolled from the display RNG.
void test('a fire ray burning a web the hero cannot see keeps the sensed monster display', async () => {
    await freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    setHeroBlindnessTurns(30);
    await vision_recalc(0);
    grantIntrinsicProperty('telepathy', 'outside');
    await createMonsterAt('kobold', 12, 10, NO_MINVENT);
    addTrap(requireGameLevel(), WEB, 12, 10, { tseen: true });
    await newsym(12, 10);
    const before = glyphAt(12, 10);
    assert.equal(before?.kind, 'monster',
        'a blind telepathic hero senses the monster in the web');
    initRng(5n);

    await applyRayFloorFeatures('fire', 12, 10);

    assert.ok(!requireGameLevel().traps.some(trap =>
        trap.tx === 12 && trap.ty === 10),
        'delfloortrap() destroys the unseen web (zap.c:5169)');
    assert.notEqual(game._pending_message, 'A web bursts into flames!',
        'the burst message stays behind the see_it gate (zap.c:5167-5168)');
    const after = glyphAt(12, 10);
    assert.ok(before?.kind === 'monster' && after?.kind === 'monster');
    assert.equal(after.mnum, before.mnum,
        'the unseen cell is not refreshed, so the hallucinated appearance is not rerolled (zap.c:5170-5171)');
});
