import test from 'node:test';
import assert from 'node:assert/strict';
import { isGetposFeatureSymbol } from '../js/getpos.js';
import { selectMapPosition } from '../js/getpos.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('getpos distinguishes default cmap keys from unknown directions', () => {
    for (const ch of ['_', '<', '>', '^', '"', '0', '#', '\\'])
        assert.equal(isGetposFeatureSymbol(ch), true, ch);
    for (const ch of ['a', 'e', 'q', 'Z'])
        assert.equal(isGetposFeatureSymbol(ch), false, ch);
});
void test('a lowercase DEC drawing letter remains an unknown direction during selection', async () => {
    await freshObjectRoom({ flags: { tips: false, verbose: false } });
    game.symset = 'DECgraphics';
    const input = resetInputState();
    const selection = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Choose a location.', goal: 'a location',
    }), input, [
        { prompt: /Choose a location\./, keys: 's' },
        { prompt: /Unknown direction: 's' \(use 'h', 'j', 'k', 'l' or '\.'\)\./, keys: '.' },
    ]);
    assert.equal(selection?.x, 10);
    assert.equal(selection?.y, 10);
});
void test('a Meta key is an unknown direction during DECgraphics selection', async () => {
    await freshObjectRoom({ flags: { tips: false, verbose: false } });
    game.symset = 'DECgraphics';
    const input = resetInputState();
    // 0xf3 shows as DEC S_sw_bc/S_expl_bc, 0xf8 as S_vbeam, 0xe7 as S_tree,
    // yet C reports all three as unknown directions: readchar_core()
    // returns the key as a char (cmd.c:5271), so the byte arrives negative
    // in getpos()'s c and never equals a uchar defsym or showsym
    // (getpos.c:1052-1060).
    const selection = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Choose a location.', goal: 'a location',
    }), input, [
        { prompt: /Choose a location\./, keys: '\xf3' },
        { prompt: /Unknown direction: 'M-s' \(use 'h', 'j', 'k', 'l' or '\.'\)\./, keys: '\xf8' },
        { prompt: /Unknown direction: 'M-x' \(use 'h', 'j', 'k', 'l' or '\.'\)\./, keys: '\xe7' },
        { prompt: /Unknown direction: 'M-g' \(use 'h', 'j', 'k', 'l' or '\.'\)\./, keys: '.' },
    ]);
    assert.equal(selection?.x, 10);
    assert.equal(selection?.y, 10);
});
void test('DECgraphics display bytes name no feature under any symbol set', () => {
    game.symset = 'DECgraphics';
    // DECgraphics displays these bytes on the map (S_tree, ladders,
    // S_altar, water, S_bars, beams, swallow/explosion edges), but getpos
    // receives a Meta key as a negative char, so it never equals a uchar
    // defsym or showsym (getpos.c:1052-1060).
    for (const ch of ['\xe7', '\xf9', '\xfa', '\xfb', '\xe0', '\xfc',
        '\xf8', '\xf1', '\xef', '\xf3', '\xfe'])
        assert.equal(isGetposFeatureSymbol(ch), false, ch);
    // The ASCII defsyms keep naming their features under DECgraphics too.
    for (const ch of ['_', '<', '>'])
        assert.equal(isGetposFeatureSymbol(ch), true, ch);
    game.symset = null;
    assert.equal(isGetposFeatureSymbol('qq'), false, 'only single bytes can name a feature');
});
//# sourceMappingURL=getpos.test.js.map