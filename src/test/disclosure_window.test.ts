import assert from 'node:assert/strict';
import test from 'node:test';
import { docrt, flush_screen, plineWithContinuation } from '../js/display.js';
import { GameDisplay } from '../js/game_display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ATR_INVERSE, NO_COLOR, Terminal } from '../js/terminal.js';
import { showChoiceWindow, showDisclosureOverlay } from '../js/windows.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createMonsterAt } from './support/monsters.js';

function rowText(row: number): string {
    return requireGameDisplay().grid[row]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}

for (const kind of ['prose', 'choices'] as const) {
    void test(`a ${kind} window acknowledges unread prose before painting its contents`, async () => {
        freshPlayableRoom();
        await plineWithContinuation('You study the markings.');
        const input = resetInputState();
        const window = kind === 'prose'
            ? showDisclosureOverlay(['The runes describe a doorway.'])
            : showChoiceWindow({ title: 'Choose a doorway:', entries: [{ key: 'a', text: 'the east doorway' }] });
        try {
            await input.waitUntilBlocked();
            assert.equal(rowText(0), 'You study the markings.--More--');
            input.feed(' ');
            await input.waitUntilBlocked();
            assert.match(rowText(0), kind === 'prose' ? /The runes describe a doorway\./ : /Choose a doorway:/);
        } finally {
            input.feed('\x1b\x1b');
            await window;
        }
    });
}

for (const { width, firstColumn, mapVisible } of [
    { width: 76, firstColumn: 2, mapVisible: true },
    { width: 77, firstColumn: 1, mapVisible: false },
]) {
    void test(`a ${width}-character overview row includes both menu margins when choosing its placement`, async () => {
        freshPlayableRoom();
        const display = requireGameDisplay();
        display.setCell(5, 10, '@', NO_COLOR);
        const input = resetInputState();
        const overview = showDisclosureOverlay(['x'.repeat(width)], {
            pagerStyle: 'menu', marker: '(end)',
        });
        try {
            await input.waitUntilBlocked();
            assert.equal(rowText(0).indexOf('x'), firstColumn, 'the menu retains its leading blank');
            assert.equal(display.grid[0]?.[79]?.ch, ' ', 'the right margin stays blank');
            assert.equal(display.grid[10]?.[5]?.ch, mapVisible ? '@' : ' ', 'placement determines whether the map is covered');
        } finally {
            input.feed(27);
            await overview;
        }
    });
}

for (const overlay of [true, false]) {
    for (const entries of [53, 60]) {
        void test(`a ${entries}-row overview on a tall terminal pages after 52 entries with overlays ${overlay ? 'enabled' : 'disabled'}`, async () => {
            freshPlayableRoom({ flags: { menu_overlay: overlay } });
            const display = new GameDisplay(new Terminal(null, { cols: 80, rows: 60 }));
            game.nhDisplay = display;
            display.setCell(5, 55, '@', NO_COLOR);
            display.setCell(70, 20, '.', NO_COLOR);
            const input = resetInputState();
            const overview = showDisclosureOverlay(
                Array.from({ length: entries }, (_, n) => `Level ${n + 1}`),
                { pagerStyle: 'menu', marker: '(end)' },
            );
            try {
                await input.waitUntilBlocked();
                assert.equal(rowText(51).trim(), 'Level 52');
                assert.equal(rowText(52).trim(), '(1 of 2)', 'the pager follows the 52nd entry');
                assert.equal(display.grid[55]?.[5]?.ch, overlay ? '@' : ' ', 'a tall corner menu leaves the map visible');
                input.feed('>');
                await input.waitUntilBlocked();
                assert.equal(rowText(0).trim(), 'Level 53', 'the next entry begins the second page');
                assert.equal(rowText(entries - 52).trim(), '(2 of 2)');
                if (overlay) assert.equal(display.grid[20]?.[70]?.ch, '.', 'the shorter corner page exposes the map');
                input.feed('<');
                await input.waitUntilBlocked();
                assert.equal(rowText(0).trim(), 'Level 1', 'the previous-page key returns to the first entry');
            } finally {
                input.feed(27);
                await overview;
            }
        });
    }
}

void test('an overview filling all content rows uses the full screen for its pager', async () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    display.setCell(30, 10, '@', NO_COLOR);
    const input = resetInputState();
    const overview = showDisclosureOverlay(
        Array.from({ length: display.rows - 1 }, (_, n) => `Level ${n + 1}`),
        { pagerStyle: 'menu', marker: '(end)' },
    );
    try {
        await input.waitUntilBlocked();
        assert.equal(rowText(0).indexOf('Level 1'), 1, 'the menu keeps its left selector column');
        assert.equal(rowText(display.rows - 1).trim(), '(end)');
        assert.equal(display.grid[10]?.[30]?.ch, ' ', 'the full window covers the map');
    } finally {
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
    } finally {
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
    } finally {
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
        } finally {
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
        } finally {
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
    } finally {
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
    } finally {
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
    } finally {
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
        } finally {
            input.feed(' ');
            await disclosure;
        }
    });
}

void test('a disclosure wider than the terminal overlays only its own rows', async () => {
    freshPlayableRoom();
    const display = requireGameDisplay();
    display.setCell(5, 10, '@', NO_COLOR);
    const input = resetInputState();
    const disclosure = showDisclosureOverlay(['x'.repeat(90)]);
    try {
        await input.waitUntilBlocked();
        assert.equal(rowText(0).indexOf('x'), 0);
        assert.equal(rowText(1).trim(), '--More--');
        assert.equal(display.grid[10]?.[5]?.ch, '@', 'rows below the window keep the map');
    } finally {
        input.feed(' ');
        await disclosure;
    }
});

for (const pagerStyle of ['text', 'menu'] as const) {
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
        assert.ok(newGlyph.ch !== oldAppearance.ch || newGlyph.color !== oldAppearance.color,
            'dismissal gives the monster a fresh hallucinated appearance');
        assert.equal(display.cursorCol, game.u.ux - 1);
        assert.equal(display.cursorRow, game.u.uy + 1);
    });
}
