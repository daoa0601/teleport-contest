import test from 'node:test';
import assert from 'node:assert/strict';
import { selectMapPosition } from '../js/getpos.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { applyNethackrc } from '../js/cfgfiles.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
// C getpos.c:1052-1061 builds the feature-key table from defsyms[] plus the
// ACTIVE gs.showsyms[], never from the primary symset choice.  On Rogue
// levels do.c:goto_level() has called assign_graphics(ROGUESET)
// (do.c:1666-1667, symbols.c:222-234), so showsyms holds the rogue table and
// a DEC byte introduced by a primary DECgraphics choice names no feature:
// getpos answers "Unknown direction" and, not forced, aborts (getpos.c:1117-
// 1141) instead of reporting a missing feature.
void test('a DEC feature byte is an unknown direction on a Rogue level with a DECgraphics primary set', async () => {
    await freshObjectRoom({ flags: { verbose: false, tips: false, help: false } });
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=symset:DECgraphics');
    game.rogue_level = { ...game.u.uz };
    const input = resetInputState();
    const selection = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Choose a location.', goal: 'a location',
        force: false,
    }), input, [
        { prompt: /Choose a location\./, keys: '\xe7' },
    ]);
    assert.equal(selection?.x, -1, 'the DEC byte aborts the selection');
    assert.equal(selection?.y, 0);
});
// options.c:3553-3566 loads roguesymset without checking `Restrictions:`
// (files.c read_sym_file only filters the interactive picker), so DECgraphics
// can be the ROGUESET: assign_graphics(ROGUESET) installs its bytes in
// showsyms and getpos.c:1053 accepts the DEC feature keys on the Rogue level.
void test('a DEC feature byte still names a feature when DECgraphics is the rogue set', async () => {
    await freshObjectRoom({ flags: { verbose: false, tips: false, help: false } });
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=symset:DECgraphics');
    applyNethackrc('OPTIONS=roguesymset:DECgraphics');
    game.rogue_level = { ...game.u.uz };
    const input = resetInputState();
    const selection = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Choose a location.', goal: 'a location',
    }), input, [
        { prompt: /Choose a location\./, keys: '\xe7' },
        { prompt: /Can't find dungeon feature/, keys: '.' },
    ]);
    assert.equal(selection?.x, 10);
    assert.equal(selection?.y, 10);
});
//# sourceMappingURL=getpos_rogue_symset.test.js.map