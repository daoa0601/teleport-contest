import test from 'node:test';
import assert from 'node:assert/strict';
import { farlookLocationDescription } from '../js/cmd.js';
import { flush_screen, newsym, pline, plineWithContinuation } from '../js/display.js';
import { showFloorPile } from '../js/floor_object_display.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { nhgetch, resetInputState } from '../js/input.js';
import { APPLE, FOOD_RATION, LEASH } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { screenDescription } from '../js/pager_description.js';
import { freshObjectRoom } from './support/object-room.js';
import { GameDisplay } from '../js/game_display.js';
import { Terminal } from '../js/terminal.js';
function displayedRow(row) {
    const cells = requireGameDisplay(game).grid[row];
    assert.ok(cells, `Display row ${row} exists`);
    return cells.map(cell => cell.ch).join('');
}
for (const overlay of [true, false]) {
    void test(`a stale leash report finishes before the ${overlay ? 'corner' : 'full-screen'} floor pile appears`, async () => {
        await freshObjectRoom({ flags: { menu_overlay: overlay } });
        const apple = await floorObject(APPLE, 10, 10);
        const leash = await floorObject(LEASH, 10, 10, { leashmon: 4242 });
        const input = resetInputState();
        const screens = [];
        input.display = {
            readKey() {
                const screen = requireGameDisplay(game).grid
                    .map(row => row.map(cell => cell.ch).join('')).join('\n');
                assert.ok(screens.length < 8, `Too many pile acknowledgments:\n${screen}`);
                assert.match(screen, /--More--/);
                screens.push(screen);
                return Promise.resolve(32);
            },
        };
        await showFloorPile([apple, leash]);
        assert.ok(screens.some(screen => screen.includes('leashed monster #4242 not found')), 'the stale leash must produce its diagnostic');
        const pile = screens.at(-1) ?? '';
        assert.match(pile, /Things that are here:/, 'the pile must be visible at its own acknowledgment');
        assert.match(pile, /an uncursed apple/);
        assert.match(pile, /an uncursed leash/);
        assert.doesNotMatch(pile, /leashed monster|Program in disorder|Please report/);
        assert.equal(leash.leashmon, 0);
    });
}
void test('Escape during a stale leash report clears the message before the corner pile', async () => {
    await freshObjectRoom();
    game.program_state.something_worth_saving = true;
    const apple = await floorObject(APPLE, 10, 10);
    const leash = await floorObject(LEASH, 10, 10, { leashmon: 4242 });
    const input = resetInputState();
    const screens = [];
    input.display = {
        readKey() {
            const screen = requireGameDisplay(game).grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            screens.push(screen);
            assert.ok(screens.length < 8, `Too many pile acknowledgments:\n${screen}`);
            return Promise.resolve(screen.includes('leashed monster #4242 not found') ? 27 : 32);
        },
    };
    await showFloorPile([apple, leash]);
    assert.ok(screens.some(screen => screen.includes('leashed monster #4242 not found')));
    const pile = screens.at(-1) ?? '';
    assert.match(pile, /Things that are here:/);
    assert.match(pile, /an uncursed leash/);
    assert.doesNotMatch(pile, /leashed monster|Program in disorder|Please report/, 'the corner window clears the message even after message display was stopped');
    assert.equal(leash.leashmon, 0);
});
void test('a floor-pile corner window preserves seen prose to its left', async () => {
    await freshObjectRoom();
    const apple = await floorObject(APPLE, 10, 10);
    const ration = await floorObject(FOOD_RATION, 10, 10);
    const input = resetInputState();
    await pline('You hear a jackal barking in the corridor.');
    await flush_screen(1);
    input.feed('x');
    await nhgetch();
    const listing = showFloorPile([apple, ration]);
    await input.waitUntilBlocked();
    const title = displayedRow(0);
    input.feed(' ');
    await listing;
    assert.match(title, /^You hear a jackal barking/);
    assert.match(title, /Things that are here:/);
    assert.equal(apple.where, 'floor');
    assert.equal(ration.where, 'floor');
});
void test('a floor-pile window acknowledges an unread message before clearing it for the menu', async () => {
    await freshObjectRoom();
    const apple = await floorObject(APPLE, 10, 10);
    const ration = await floorObject(FOOD_RATION, 10, 10);
    const input = resetInputState();
    await pline('You hear a jackal barking in the corridor.');
    const listing = showFloorPile([apple, ration]);
    await input.waitUntilBlocked();
    const greeting = displayedRow(0);
    input.feed(' ');
    await input.waitUntilBlocked();
    const title = displayedRow(0);
    input.feed(' ');
    await listing;
    assert.match(greeting, /jackal barking in the corridor\.--More--/);
    assert.match(title, /^ +Things that are here:/);
    assert.doesNotMatch(title, /jackal|barking/);
});
void test('a floor-pile window follows paged wrapped prose without leaving text on the map', async () => {
    await freshObjectRoom();
    const apple = await floorObject(APPLE, 10, 10);
    const ration = await floorObject(FOOD_RATION, 10, 10);
    const input = resetInputState();
    input.feed(' ');
    await plineWithContinuation('You hear a jackal barking in the distant corridor, and another animal answering from beyond the closed door.');
    const listing = showFloorPile([apple, ration]);
    await input.waitUntilBlocked();
    const title = displayedRow(0);
    const uncoveredMapRow = displayedRow(1).slice(0, title.indexOf('Things'));
    input.feed(' ');
    await listing;
    assert.match(title, /^ +Things that are here:/);
    assert.doesNotMatch(uncoveredMapRow, /beyond|closed door|animal/);
});
void test('a floor-pile window too wide for a corner overlays only its own rows', async () => {
    await freshObjectRoom();
    const apple = await floorObject(APPLE, 10, 10, {
        oname: 'an extraordinarily long given name that leaves no room for a corner window',
    });
    const ration = await floorObject(FOOD_RATION, 10, 10);
    const input = resetInputState();
    const listing = showFloorPile([apple, ration]);
    await input.waitUntilBlocked();
    const title = displayedRow(0);
    const marker = displayedRow(4);
    const rowBelowWindow = displayedRow(8);
    input.feed(' ');
    await listing;
    assert.match(title, /^Things that are here:/);
    assert.match(marker, /^ --More--/);
    // look_here() flushes the lit room before the window; its rows stay.
    assert.match(rowBelowWindow, /^ {6}\.{10} *$/);
});
// C invent.c:look_here() shows the pile in a corner window and its
// destroy_nhwindow() runs docorner(), which erases every covered row from
// the window's left edge and repaints only map rows. The seen top line
// stays physically clipped until a new message replaces it.
void test('dismissing a floor-pile corner window leaves the seen top line clipped', async () => {
    await freshObjectRoom();
    const apple = await floorObject(APPLE, 10, 10);
    const ration = await floorObject(FOOD_RATION, 10, 10);
    const input = resetInputState();
    await pline('You hear a jackal barking in the corridor.');
    await flush_screen(1);
    input.feed('x');
    await nhgetch();
    const listing = showFloorPile([apple, ration]);
    await input.waitUntilBlocked();
    const duringDisplay = displayedRow(0);
    input.feed(' ');
    await listing;
    await flush_screen(1);
    const titleColumn = duringDisplay.indexOf('Things that are here:');
    assert.ok(titleColumn > 0, 'the corner window must be on screen');
    const clipped = displayedRow(0).trimEnd();
    assert.equal(clipped.length, titleColumn - 2, 'the top line survives only to the corner window\'s left edge');
    assert.equal(clipped, 'You hear a jackal barking in the corridor.'.slice(0, titleColumn - 2));
    await pline('You hear a jackal barking in the corridor.');
    await flush_screen(1);
    assert.equal(displayedRow(0).trimEnd(), 'You hear a jackal barking in the corridor.', 'repeating the clipped text repaints the whole top line');
});
void test('a narrower floor-pile window does not restore text a wider one erased', async () => {
    await freshObjectRoom();
    const apple = await floorObject(APPLE, 10, 10);
    const ration = await floorObject(FOOD_RATION, 10, 10, { oname: 'provisions for the long road home' });
    const leash = await floorObject(LEASH, 10, 10);
    const input = resetInputState();
    await pline('You hear a jackal barking in the corridor.');
    await flush_screen(1);
    input.feed('x');
    await nhgetch();
    const wide = showFloorPile([apple, ration, leash]);
    await input.waitUntilBlocked();
    const wideColumn = displayedRow(0).indexOf('Things that are here:');
    input.feed(' ');
    await wide;
    const narrow = showFloorPile([apple, leash]);
    await input.waitUntilBlocked();
    const narrowColumn = displayedRow(0).indexOf('Things that are here:');
    input.feed(' ');
    await narrow;
    await flush_screen(1);
    assert.ok(wideColumn > 0 && narrowColumn > wideColumn, 'the second window must sit further right');
    assert.equal(displayedRow(0).trimEnd(), 'You hear a jackal barking in the corridor.'.slice(0, wideColumn - 2), 'the wider window\'s erasure survives the narrower one');
});
// A farlook description returns through putmixed(): its leading map glyph
// is carried by \x0e/\x0f markers that occupy no screen cell. docorner()
// clears physical columns, so the clip must keep every cell before the
// window edge, not that many bytes of the encoded message.
void test('a farlook description is clipped by screen cells, not raw bytes', async () => {
    await freshObjectRoom();
    const apple = await floorObject(APPLE, 10, 10);
    const ration = await floorObject(FOOD_RATION, 10, 10);
    const input = resetInputState();
    // A wide terminal keeps the description on one row, so its whole
    // cell range falls inside the later corner clip.
    game.nhDisplay = new GameDisplay(new Terminal(null, { cols: 120, rows: 24 }));
    // The same putmixed() line the farlook command publishes for the
    // floor square west of the hero: the glyph prefix plus the resolved description.
    game.symset = 'DECgraphics';
    await newsym(game.u.ux - 1, game.u.uy);
    const detail = await farlookLocationDescription(game.u.ux - 1, game.u.uy);
    const described = screenDescription(game.u.ux - 1, game.u.uy, detail).text;
    assert.ok(described.includes('\x0e'), 'the farlook description must carry the mixed glyph prefix');
    await pline(described);
    await flush_screen(1);
    input.feed('x');
    await nhgetch();
    const listing = showFloorPile([apple, ration]);
    await input.waitUntilBlocked();
    const duringDisplay = displayedRow(0);
    input.feed(' ');
    await listing;
    await flush_screen(1);
    const titleColumn = duringDisplay.indexOf('Things that are here:');
    assert.ok(titleColumn > 0, 'the corner window must be on screen');
    const clipped = displayedRow(0).trimEnd();
    assert.equal(clipped.length, titleColumn - 2, 'the glyph markers must not consume clip columns');
    assert.ok(clipped.includes('a doorway or the floor of a ro'), 'the visible cells still carry the description');
    assert.ok(!clipped.includes('(floor of a room)'), 'the clip falls inside the message');
});
//# sourceMappingURL=floor_pile_window.test.js.map