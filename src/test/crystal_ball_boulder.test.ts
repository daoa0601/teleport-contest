import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { glyphAt } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { applyNethackrc } from '../js/options.js';
import { BOULDER, CRYSTAL_BALL } from '../js/object_data.js';
import { requirePlayingGame } from '../js/gstate.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';

// C detect.c:use_crystal_ball() checks the search character against
// showsyms[SYM_BOULDER + SYM_OFF_X] before the trap symbol, so a BOULDER=
// override selects rock-class object detection instead of a distant vision.

void test('searching for the configured boulder symbol detects large stones', async t => {
    const level = freshObjectRoom({
        flags: { verbose: false, tips: false },
        hero: { acurr: { a: [12, 12, 12, 18, 12, 12] } },
    });
    requirePlayingGame(game);
    applyNethackrc('BOULDER=35');
    await floorObject(BOULDER, 30, 10, { dknown: true });
    const ball = await addInventoryObject(CRYSTAL_BALL, { blessed: true, spe: 2 });

    const input = resetInputState();
    input.feed('invoke\r');
    planInput(input, t, [
        { prompt: /What do you want to invoke\?/, keys: ball.invlet },
        { prompt: /What do you look for\?/, keys: '#' },
        { prompt: /You peer into the crystal ball\.\.\./, keys: ' ' },
        { prompt: /You detect the presence of large stones/, keys: '\x1b' },
    ]);
    await rhack('#'.charCodeAt(0));

    const glyph = glyphAt(30, 10);
    assert.ok(glyph?.kind === 'object', 'rock-class detection maps the boulder');
    assert.equal(glyph.otyp, BOULDER);
    assert.doesNotMatch(game._pending_message ?? '', /vision is unclear|You see/);
    assert.equal(ball.spe, 1);
});

void test('a class symbol shared with the boulder override also detects large stones', async t => {
    freshObjectRoom({
        flags: { verbose: false, tips: false },
        hero: { acurr: { a: [12, 12, 12, 18, 12, 12] } },
    });
    requirePlayingGame(game);
    applyNethackrc('BOULDER=48');
    await floorObject(BOULDER, 30, 10, { dknown: true });
    const ball = await addInventoryObject(CRYSTAL_BALL, { blessed: true, spe: 2 });

    const input = resetInputState();
    input.feed('invoke\r');
    planInput(input, t, [
        { prompt: /What do you want to invoke\?/, keys: ball.invlet },
        { prompt: /What do you look for\?/, keys: '0' },
        { prompt: /You peer into the crystal ball\.\.\./, keys: ' ' },
        { prompt: /You detect the presence of iron balls and\/or large stones/, keys: '\x1b' },
    ]);
    await rhack('#'.charCodeAt(0));

    const glyph = glyphAt(30, 10);
    assert.ok(glyph?.kind === 'object', 'ball-class detection includes the boulder');
    assert.equal(glyph.otyp, BOULDER);
    assert.equal(ball.spe, 1);
});
