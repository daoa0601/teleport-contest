import test from 'node:test';
import assert from 'node:assert/strict';
import { flush_screen, pline, plineWithContinuation } from '../js/display.js';
import { showFloorPile } from '../js/floor_object_display.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { nhgetch, resetInputState } from '../js/input.js';
import { APPLE, FOOD_RATION, LEASH } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

function displayedRow(row: number) {
    const cells = requireGameDisplay(game).grid[row];
    assert.ok(cells, `Display row ${row} exists`);
    return cells.map(cell => cell.ch).join('');
}

for (const overlay of [true, false]) {
    void test(`a stale leash report finishes before the ${overlay ? 'corner' : 'full-screen'} floor pile appears`, async () => {
        freshObjectRoom({ flags: { menu_overlay: overlay } });
        const apple = await floorObject(APPLE, 10, 10);
        const leash = await floorObject(LEASH, 10, 10, { leashmon: 4242 });
        const input = resetInputState();
        const screens: string[] = [];
        input.display = {
            readKey(): Promise<number> {
                const screen = requireGameDisplay(game).grid
                    .map(row => row.map(cell => cell.ch).join('')).join('\n');
                assert.ok(screens.length < 8, `Too many pile acknowledgments:\n${screen}`);
                assert.match(screen, /--More--/);
                screens.push(screen);
                return Promise.resolve(32);
            },
        };

        await showFloorPile([apple, leash]);

        assert.ok(screens.some(screen => screen.includes('leashed monster #4242 not found')),
            'the stale leash must produce its diagnostic');
        const pile = screens.at(-1) ?? '';
        assert.match(pile, /Things that are here:/, 'the pile must be visible at its own acknowledgment');
        assert.match(pile, /an uncursed apple/);
        assert.match(pile, /an uncursed leash/);
        assert.doesNotMatch(pile, /leashed monster|Program in disorder|Please report/);
        assert.equal(leash.leashmon, 0);
    });
}

void test('a floor-pile corner window preserves seen prose to its left', async () => {
    freshObjectRoom();
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
    freshObjectRoom();
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
    freshObjectRoom();
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
    freshObjectRoom();
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
