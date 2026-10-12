import assert from 'node:assert/strict';
import test from 'node:test';
import { docrt, flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ATR_INVERSE, NO_COLOR } from '../js/terminal.js';
import { showDisclosureOverlay } from '../js/windows.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createMonsterAt } from './support/monsters.js';
function rowText(row) {
    return requireGameDisplay().grid[row]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}
void test('an overview filling all content rows uses the full screen for its pager', async () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    display.setCell(30, 10, '@', NO_COLOR);
    const input = resetInputState();
    const overview = showDisclosureOverlay(Array.from({ length: display.rows - 1 }, (_, n) => `Level ${n + 1}`), { pagerStyle: 'menu', marker: '(end)' });
    try {
        await input.waitUntilBlocked();
        assert.equal(rowText(0).indexOf('Level 1'), 1, 'the menu keeps its left selector column');
        assert.equal(rowText(display.rows - 1).trim(), '(end)');
        assert.equal(display.grid[10]?.[30]?.ch, ' ', 'the full window covers the map');
    }
    finally {
        input.feed(' ');
        await overview;
    }
});
void test('long disclosure prose wraps its final words onto the next page with its attribute', async () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    const input = resetInputState();
    const disclosure = showDisclosureOverlay([
        ...Array.from({ length: display.rows - 2 }, (_, n) => `Entry ${n + 1}`),
        {
            text: 'You were carrying an uncursed very heavy iron chain beside an enormous wooden chest containing golden coins.',
            attr: ATR_INVERSE,
        },
    ]);
    try {
        await input.waitUntilBlocked();
        assert.match(rowText(display.rows - 2), /^You were carrying/);
        assert.equal(rowText(display.rows - 1).trim(), '--More--');
        input.feed(' ');
        const nextPage = await Promise.race([
            disclosure.then(() => false),
            input.waitUntilBlocked().then(() => true),
        ]);
        assert.equal(nextPage, true, 'wrapped words still need a second page');
        assert.match(rowText(0), /^chest containing golden coins\.$/);
        assert.equal(display.grid[0]?.[0]?.attr, ATR_INVERSE);
        assert.equal(rowText(1).trim(), '--More--');
    }
    finally {
        input.feed(27);
        await disclosure;
    }
});
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
for (const prefix of ['1', '1x']) {
    void test(`Escape cancels an overview count after ${JSON.stringify(prefix)} before it can dismiss the window`, async () => {
        freshPlayableRoom();
        const input = resetInputState();
        const overview = showDisclosureOverlay(Array.from({ length: 28 }, (_, n) => `Level ${n + 1}`), {
            pagerStyle: 'menu', marker: '(end)',
        });
        try {
            await input.waitUntilBlocked();
            for (const key of prefix) {
                input.feed(key);
                await input.waitUntilBlocked();
            }
            input.feed(27);
            const state = await Promise.race([
                overview.then(() => 'dismissed'),
                input.waitUntilBlocked().then(() => 'waiting'),
            ]);
            assert.equal(state, 'waiting', 'Escape cancels the count and leaves the overview open');
            assert.equal(rowText(0).trim(), 'Level 1');
            input.feed(27);
            assert.equal(await overview, 27, 'Escape with no count dismisses the overview');
        }
        finally {
            input.feed('\x1b\x1b');
            await overview;
        }
    });
}
for (const prefix of ['0', '1>', '9223372036854775808']) {
    void test(`an overview dismisses on Escape after ${JSON.stringify(prefix)} leaves no active count`, async () => {
        freshPlayableRoom();
        const input = resetInputState();
        const overview = showDisclosureOverlay(Array.from({ length: 28 }, (_, n) => `Level ${n + 1}`), {
            pagerStyle: 'menu', marker: '(end)',
        });
        try {
            await input.waitUntilBlocked();
            for (const key of prefix) {
                input.feed(key);
                await input.waitUntilBlocked();
            }
            input.feed(27);
            const state = await Promise.race([
                overview.then(() => 'dismissed'),
                input.waitUntilBlocked().then(() => 'waiting'),
            ]);
            assert.equal(state, 'dismissed', 'there is no count for Escape to cancel');
        }
        finally {
            input.feed('\x1b\x1b');
            await overview;
        }
    });
}
void test('a full-screen overview clips long rows and leaves the final column blank', async () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    const input = resetInputState();
    const text = 'An unexplored level on a branch of the dungeon. '.repeat(3);
    const overview = showDisclosureOverlay([{ text, attr: ATR_INVERSE }], {
        pagerStyle: 'menu', marker: '(end)',
    });
    try {
        await input.waitUntilBlocked();
        assert.equal(display.grid[0]?.[0]?.ch, ' ', 'the menu keeps its leading blank');
        assert.equal(display.grid[0]?.[1]?.ch, text[0]);
        assert.equal(display.grid[0]?.[display.cols - 2]?.ch, text[display.cols - 3]);
        assert.equal(display.grid[0]?.[display.cols - 2]?.attr, ATR_INVERSE);
        assert.equal(display.grid[0]?.[display.cols - 1]?.ch, ' ', 'content stops before the final column');
        assert.equal(display.grid[0]?.[display.cols - 1]?.attr, 0, 'the final blank has no menu highlighting');
        assert.equal(rowText(1).trim(), '(end)', 'the clipped row does not wrap');
    }
    finally {
        input.feed(' ');
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
for (const width of [68, 72]) {
    void test(`a ${width}-column disclosure line keeps the map visible outside its corner`, async () => {
        freshPlayableRoom();
        const display = requireGameDisplay();
        display.setCell(5, 10, '@', NO_COLOR);
        const input = resetInputState();
        const disclosure = showDisclosureOverlay(['x'.repeat(width)]);
        try {
            await input.waitUntilBlocked();
            assert.equal(rowText(0).indexOf('x'), display.cols - width - 1);
            assert.equal(rowText(1).trim(), '--More--');
            assert.equal(display.grid[10]?.[5]?.ch, '@', 'the corner leaves uncovered map rows visible');
        }
        finally {
            input.feed(' ');
            await disclosure;
        }
    });
}
void test('a disclosure wider than the terminal uses the full screen', async () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    display.setCell(5, 10, '@', NO_COLOR);
    const input = resetInputState();
    const disclosure = showDisclosureOverlay(['x'.repeat(90)]);
    try {
        await input.waitUntilBlocked();
        assert.equal(rowText(0).indexOf('x'), 0);
        assert.equal(rowText(1).trim(), '--More--');
        assert.equal(display.grid[10]?.[5]?.ch, ' ', 'the full window covers the map');
    }
    finally {
        input.feed(' ');
        await disclosure;
    }
});
for (const pagerStyle of ['text', 'menu']) {
    void test(`closing a full-screen ${pagerStyle} disclosure redraws hallucinated monsters`, async () => {
        freshPlayableRoom({ seed: 61023n });
        requirePlayingGame(game);
        await createMonsterAt('newt', 12, 10);
        game.u.hallucinationTurns = 20;
        await docrt();
        await flush_screen(1);
        const display = requireGameDisplay();
        const oldGlyph = display.grid[11]?.[11];
        assert.ok(oldGlyph, 'the visible monster has a glyph');
        const oldAppearance = { ch: oldGlyph.ch, color: oldGlyph.color };
        // A full-screen dismissal must replace stale terminal cells from the
        // live map. '?' cannot be a monster glyph, hallucinated or otherwise.
        display.setCell(11, 11, '?', NO_COLOR);
        const input = resetInputState();
        game.flags.menu_overlay = false;
        const disclosure = showDisclosureOverlay(['Final disclosure'], { pagerStyle });
        await input.waitUntilBlocked();
        input.feed(' ');
        await disclosure;
        const newGlyph = display.grid[11]?.[11];
        assert.ok(newGlyph);
        assert.notEqual(newGlyph.ch, ' ', 'the visible monster is drawn again');
        assert.notEqual(newGlyph.ch, '?', 'the monster glyph is rebuilt from the live map');
        assert.ok(newGlyph.ch !== oldAppearance.ch || newGlyph.color !== oldAppearance.color, 'dismissal gives the monster a fresh hallucinated appearance');
        assert.equal(display.cursorCol, game.u.ux - 1);
        assert.equal(display.cursorRow, game.u.uy + 1);
    });
}
//# sourceMappingURL=disclosure_window.test.js.map