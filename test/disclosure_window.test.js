import assert from 'node:assert/strict';
import test from 'node:test';
import { docrt, flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { NO_COLOR } from '../js/terminal.js';
import { showDisclosureOverlay } from '../js/windows.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createMonsterAt } from './support/monsters.js';
function rowText(row) {
    return requireGameDisplay().grid[row]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}
void test('Enter dismisses a paged overview from its first page', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    const overview = showDisclosureOverlay(Array.from({ length: 28 }, (_, n) => `Level ${n + 1}`), {
        pagerStyle: 'menu', marker: '(end)',
    });
    await input.waitUntilBlocked();
    input.feed('\n');
    try {
        const state = await Promise.race([
            overview.then(() => 'dismissed'),
            input.waitUntilBlocked().then(() => 'waiting'),
        ]);
        assert.equal(state, 'dismissed');
    }
    finally {
        input.feed(27);
        await overview;
    }
});
void test('a paged overview goes back and keeps its marker beside the final content', async () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    const input = resetInputState();
    const overview = showDisclosureOverlay(Array.from({ length: 28 }, (_, n) => `Level ${n + 1}`), {
        pagerStyle: 'menu', marker: '(end)',
    });
    try {
        await input.waitUntilBlocked();
        assert.equal(rowText(display.rows - 1).trim(), '(1 of 2)');
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.equal(rowText(0).trim(), 'Level 24');
        input.feed('<');
        await input.waitUntilBlocked();
        assert.equal(rowText(0).trim(), 'Level 1');
        assert.equal(rowText(display.rows - 1).trim(), '(1 of 2)');
    }
    finally {
        input.feed(27);
        await overview;
    }
});
void test('a short last disclosure page places the cursor after its marker', async () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    const input = resetInputState();
    const disclosure = showDisclosureOverlay(Array.from({ length: 28 }, (_, n) => `Entry ${n + 1}`));
    try {
        await input.waitUntilBlocked();
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.equal(rowText(5).trim(), '--More--');
        assert.equal(display.cursorRow, 5);
        assert.equal(display.cursorCol, 9);
    }
    finally {
        input.feed(27);
        await disclosure;
    }
});
for (const width of [68, 72, 90]) {
    void test(`a ${width}-column disclosure line switches from corner to full screen`, async () => {
        freshPlayableRoom();
        const display = requireGameDisplay();
        display.setCell(5, 10, '@', NO_COLOR);
        const input = resetInputState();
        const disclosure = showDisclosureOverlay(['x'.repeat(width)]);
        try {
            await input.waitUntilBlocked();
            assert.equal(rowText(0).indexOf('x'), 0);
            assert.equal(rowText(1).trim(), '--More--');
            assert.equal(display.grid[10]?.[5]?.ch, ' ', 'the full window hides the uncovered map rows');
        }
        finally {
            input.feed(' ');
            await disclosure;
        }
    });
}
void test('closing full-screen in-game disclosure redraws hallucinated monsters', async () => {
    freshPlayableRoom({ seed: 61023n });
    requirePlayingGame(game);
    await createMonsterAt('newt', 12, 10);
    game.u.hallucinationTurns = 20;
    await docrt();
    await flush_screen(1);
    const display = requireGameDisplay();
    const oldGlyph = display.grid[11]?.[11];
    assert.ok(oldGlyph, 'the visible monster has a glyph');
    // A full-screen dismissal must replace stale terminal cells from the
    // live map. '?' cannot be a monster glyph, hallucinated or otherwise.
    display.setCell(11, 11, '?', NO_COLOR);
    const input = resetInputState();
    game.flags.menu_overlay = false;
    const disclosure = showDisclosureOverlay(['Vanquished creatures:'], { restoreUnderlay: true });
    await input.waitUntilBlocked();
    input.feed(' ');
    await disclosure;
    const newGlyph = display.grid[11]?.[11];
    assert.ok(newGlyph);
    assert.notEqual(newGlyph.ch, '?', 'the monster glyph is rebuilt from the live map');
    assert.equal(display.cursorCol, game.u.ux - 1);
    assert.equal(display.cursorRow, game.u.uy + 1);
});
//# sourceMappingURL=disclosure_window.test.js.map