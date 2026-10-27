import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { DUST } from '../js/const.js';
import { glyphAt } from '../js/display.js';
import { engravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { FOOD_RATION, SACK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshTurnRoom } from './support/playable-room.js';

// C pickup.c use_container() ends with no redraw of its own: the tty menu
// dismissal already repainted the covered screen from the glyph buffer. A
// remembered engraving whose text was just smudged away keeps its glyph in
// that buffer, so no map recomputation may replace it after looting.
void test('a dismissed container menu keeps a smudged-away engraving glyph', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    const sack = await addInventoryObject(SACK, { cknown: true });
    // A second inventory item makes the container action menu appear.
    await addInventoryObject(FOOD_RATION, {});
    input.feed('E');

    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\?/, keys: '-' },
        { prompt: /You write in the dust with your fingertip\./, keys: ' ' },
        { prompt: /What do you want to write in the dust here\?/, keys: 'a\r' },
    ]);
    await moveloop_core();
    assert.equal(engravingAt(10, 10)?.engr_type, DUST);

    // Step off the engraving with a wipe that erases the single letter.
    // newsym() runs before the smudge, so the engraving glyph is already in
    // hero memory when the record is deleted.
    initRng(4919n);
    await rhack('l'.charCodeAt(0));
    assert.ok(!engravingAt(10, 10), 'the dust engraving should be smudged away');
    assert.equal(game.level.requireAt(10, 10).remembered_glyph?.kind, 'engraving');

    await answerPrompts(rhack('a'.charCodeAt(0)), input, [
        { prompt: /What do you want to use or apply\?/, keys: sack.invlet },
        { prompt: /Do what with/, keys: '\x1b' },
    ]);

    assert.equal(glyphAt(10, 10)?.kind, 'engraving');
    assert.equal(game.level.requireAt(10, 10).remembered_glyph?.kind, 'engraving');
});
