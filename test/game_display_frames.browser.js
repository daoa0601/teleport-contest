// Requires Chromium; run with node --test test/game_display_frames.browser.js.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from '@playwright/test';
void test('text windows erase map frame colors and targeting restores them after help', { timeout: 30000 }, async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.route('http://game.test/**', async (route) => {
            if (route.request().resourceType() === 'document') {
                await route.fulfill({ contentType: 'text/html', body: '<body></body>' });
                return;
            }
            const path = new URL(route.request().url()).pathname;
            if (!/^\/(js|test\/support)\/[\w/.-]+\.js$/.test(path)) {
                await route.abort();
                return;
            }
            await route.fulfill({ contentType: 'text/javascript',
                body: await readFile(new URL(`..${path}`, import.meta.url), 'utf8') });
        });
        // Relative module imports below resolve from the emitted test directory.
        await page.goto('http://game.test/test/game_display_frames.browser.js');
        const help = await page.evaluate(async () => {
            const { freshObjectRoom } = await import('./support/object-room.js');
            const { GameDisplay } = await import('../js/game_display.js');
            const { resetInputState } = await import('../js/input.js');
            const { selectMapPosition } = await import('../js/getpos.js');
            const { flush_screen, map_background } = await import('../js/display.js');
            freshObjectRoom({ iflags: { bgcolors: true }, flags: { tips: false, verbose: false } });
            const { game } = await import('../js/gstate.js');
            map_background(75, 10, true);
            const display = new GameDisplay(document.body);
            game.nhDisplay = display;
            const input = resetInputState();
            const selection = selectMapPosition({
                start: { x: 10, y: 10 }, prompt: 'Choose a location.', goal: 'a location',
                isValidLocation: (x, y) => x === 75 && y === 10,
            });
            await input.waitUntilBlocked();
            const span = display.spans?.[11]?.[74];
            if (!span)
                throw new Error('Targeting needs a rendered map square');
            const highlighted = span.style.backgroundColor;
            input.feed('?');
            await input.waitUntilBlocked();
            const covered = { text: span.textContent, background: span.style.backgroundColor };
            input.feed(' ');
            await input.waitUntilBlocked();
            const restored = span.style.backgroundColor;
            input.feed('\x1b');
            await selection;
            await flush_screen(1);
            return { highlighted, covered, restored, exited: span.style.backgroundColor };
        });
        assert.notEqual(help.highlighted, '');
        assert.equal(help.covered.text, ' ');
        assert.equal(help.covered.background, '', 'help clears highlighted blank stone');
        assert.equal(help.restored, help.highlighted, 'dismissing help redraws valid positions');
        assert.equal(help.exited, '', 'leaving targeting erases valid-position backgrounds');
        const writes = await page.evaluate(async () => {
            const { GameDisplay } = await import('../js/game_display.js');
            const { CLR_BLUE, CLR_GRAY } = await import('../js/terminal.js');
            const display = new GameDisplay(document.body);
            const writers = [
                { name: 'setCell', write: () => display.setCell(0, 0, ' ', CLR_GRAY) },
                { name: 'putstr', write: () => display.putstr(0, 0, ' ') },
                { name: 'clearRow', write: () => display.clearRow(0) },
                { name: 'clearScreen', write: () => display.clearScreen() },
                { name: 'putChar', write: () => display.putChar(1, 1, ' ') },
                { name: 'putString', write: () => display.putString(' ') },
                { name: 'putCharAtCursor', write: () => display.putCharAtCursor(' ') },
                { name: 'clearToEol', write: () => display.clearToEol() },
                { name: 'scrollUp', write: () => display.scrollUp() },
            ];
            return writers.map(({ name, write }) => {
                display.setCursor(0, 0);
                display.setMapCell(0, 0, ' ', CLR_GRAY, 0, CLR_BLUE);
                write();
                return { name, background: display.spans?.[0]?.[0]?.style.backgroundColor };
            });
        });
        for (const { name, background } of writes)
            assert.equal(background, '', `${name} erases the map background when replacing a cell`);
    }
    finally {
        await browser.close();
    }
});
//# sourceMappingURL=game_display_frames.browser.js.map