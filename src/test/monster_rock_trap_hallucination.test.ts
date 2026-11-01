import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT, ROCKTRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { glyphAt, randomDisplayMonsterIdentity } from '../js/display.js';
import { performMonsterTurn } from '../js/monmove.js';
import { MONSTER_COLOR } from '../js/monster_data.js';
import { CORPSE, OBJECT_BASES, OBJECT_COLOR } from '../js/object_data.js';
import { initRng, rn2Display } from '../js/rng.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a monster that steps on a rock trap and dies paints its pile once', async () => {
    // C monmove.c:postmov() repaints the trap's square a single time after
    // mintrap() kills the mover (monmove.c:1512) and returns MMOVE_DIED, so
    // hallucinating hero sees one display-RNG object draw; a second repaint
    // would re-roll that glyph.
    const seed = 23n;
    const level = await freshObjectRoom({
        gameplaySeed: seed,
        left: 9, right: 12, top: 10, bottom: 10, heroX: 9, heroY: 10,
        hero: { hallucinationTurns: 20 },
    });
    requirePlayingGame(game);
    const monster = await createMonsterAt('giant', 12, 10, NO_MINVENT);
    monster.mhp = 1;
    monster.mhpmax = 1;
    addTrap(level, ROCKTRAP, 11, 10);
    const firstObject = OBJECT_BASES[2] ?? -1;

    initRng(seed);
    // The turn's display-RNG draws, in C order: seetrap() repaints the
    // trapped monster (trap.c:1392), thitm() prints "%s is hit by a rock!"
    // and monkilled() prints "%s is killed!" (one rndmonnam() each,
    // do_name.c), make_corpse() paints the corpse pile (mon.c newsym),
    // thitm() paints the death square (trap.c:6758), and postmov() paints
    // it one last time before returning MMOVE_DIED (monmove.c:1512).
    rn2Display(MONSTER_COLOR.length);
    randomDisplayMonsterIdentity();
    randomDisplayMonsterIdentity();
    const drawPileGlyph = () => {
        const otyp = firstObject + rn2Display(OBJECT_COLOR.length - firstObject);
        if (otyp === CORPSE) rn2Display(MONSTER_COLOR.length);
        return otyp;
    };
    drawPileGlyph();
    drawPileGlyph();
    const paintedPile = drawPileGlyph();
    const repaintedPile = drawPileGlyph();
    assert.notEqual(paintedPile, repaintedPile, 'seed must draw two distinct pile glyphs');
    initRng(seed);

    await performMonsterTurn(monster, game);

    assert.ok(monster.mhp <= 0, 'the falling rock must kill the one-hit giant');
    assert.ok(floorObjectsAt(level, 11, 10).some(object => object.otyp !== CORPSE),
        'the rock trap must leave its rock on the death square');
    const glyph = glyphAt(11, 10);
    assert.ok(glyph?.kind === 'object', JSON.stringify(glyph));
    assert.equal(glyph.otyp, paintedPile);
});
