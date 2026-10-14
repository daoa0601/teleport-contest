import type { TerminalColor } from '../js/terminal.js';
import { requireFixtureGame } from './support/game-state.js';
import type { Position } from '../js/map_types.js';
import type { MapPositionOptions } from '../js/getpos.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { HI_ZAP } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import {
    getposHelpUntilDismissed, selectMapPosition,
} from '../js/getpos.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { answerPrompts } from './support/input-boundaries.js';

for (const key of ['z', 'Z']) {
    void test(`menu mode offers valid locations for '${key}'`, async () => {
        freshObjectRoom({ flags: { tips: false, verbose: false } });
        const input = resetInputState();
        input.feed(`!${key}`);

        const selected = await answerPrompts(selectMapPosition({
            start: { x: 10, y: 10 }, prompt: 'Where do you want to hit?',
            goal: 'the spot to hit',
            isValidLocation: (x, y) => y === 10 && (x === 10 || x === 12 || x === 13),
            describe: () => 'floor of a room',
        }), input, [
            { prompt: /Pick a valid location[\s\S]*a - floor of a room[\s\S]*b - floor of a room/, keys: 'b' },
            { prompt: /floor of a room/, keys: '.' },
        ]);
        assert.equal(selected?.x, 13);
        assert.equal(selected?.y, 10);
    });
}

async function selectedCoordinates(selection: ReturnType<typeof selectMapPosition>) {
    const result = await selection;
    assert.ok(result);
    const { x, y } = result;
    return { x, y };
}

// Hero starts at (10,10) inside a lit rectangular room spanning x 7..16,
// y 6..14; everything outside the room is unseen stone.  Squares (10,8),
// (12,10), (11,12) sit at Chebyshev distance 2, (13,11) at distance 3, and
// (20,10) is a valid-but-unseen square outside the room.  The hero's own
// square is never valid here, matching the polearm minimum range.
const VISIBLE_VALID = [{ x: 10, y: 8 }, { x: 12, y: 10 }, { x: 11, y: 12 },
    { x: 13, y: 11 }];
const UNSEEN_VALID = { x: 20, y: 10 };
const ALL_VALID = [...VISIBLE_VALID, UNSEEN_VALID];

function isValidPolearmStyleSpot(x: number, y: number) {
    return ALL_VALID.some(spot => spot.x === x && spot.y === y);
}

// C getpos.c:gather_locs() + cmp_coord_distu(): the hero square is always
// index 0, then valid squares ordered by Chebyshev distance, row, column.
const EXPECTED_CYCLE = [
    { x: 10, y: 10 }, { x: 10, y: 8 }, { x: 12, y: 10 },
    { x: 11, y: 12 }, { x: 13, y: 11 }, { x: 20, y: 10 },
];

function glyphCell(x: number, y: number) {
    const cell = requireGameDisplay(game).grid[y + 1]?.[x - 1];
    assert.ok(cell, `The display contains map square (${x}, ${y})`);
    return cell;
}

function glyphAt(x: number, y: number) {
    return glyphCell(x, y).ch;
}

interface SelectionView {
    cursor: Position;
    glyphs: string[];
    colors: TerminalColor[];
}

function selectionView(spots: readonly Position[]): SelectionView {
    const display = requireGameDisplay(game);
    return {
        cursor: { x: display.cursorCol + 1, y: display.cursorRow - 1 },
        glyphs: spots.map(({ x, y }) => glyphCell(x, y).ch),
        colors: spots.map(({ x, y }) => glyphCell(x, y).color),
    };
}

function viewAfterInput(views: readonly SelectionView[], index: number): SelectionView {
    const view = views.at(index);
    assert.ok(view, `The selection displays a view after input ${index}`);
    return view;
}

async function driveSelection(keys: string, options: {
    sampleSpots?: readonly Position[];
    selectMapPosition?: Partial<Omit<MapPositionOptions, 'afterPaint'>>;
} = {}) {
    const input = resetInputState();
    const selection = selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy },
        prompt: 'Where do you want to hit?',
        goal: 'the spot to hit',
        isValidLocation: isValidPolearmStyleSpot,
        ...options.selectMapPosition,
    });
    const completed = selection.then(() => 'completed' as const, () => 'failed' as const);
    const views: SelectionView[] = [];
    for (const key of [...keys, null]) {
        const boundary = await Promise.race([
            completed, input.waitUntilBlocked().then(() => 'input' as const),
        ]);
        if (boundary !== 'input') break;
        views.push(selectionView(options.sampleSpots ?? ALL_VALID));
        assert.ok(key !== null, 'The planned position inputs finish the selection');
        input.feed(key);
    }
    return { selection, views };
}

void test("'z' cycles to valid squares in gather_locs order", async () => {
    freshObjectRoom();

    const { selection } = await driveSelection('z.');
    assert.deepEqual(await selectedCoordinates(selection), EXPECTED_CYCLE[1]);
});

void test("successive 'z' and 'Z' step through and wrap the valid cycle", async () => {
    freshObjectRoom();

    const second = await driveSelection('zz.');
    assert.deepEqual(await selectedCoordinates(second.selection), EXPECTED_CYCLE[2]);

    const back = await driveSelection('zZ.');
    assert.deepEqual(await selectedCoordinates(back.selection), EXPECTED_CYCLE[0]);

    const wrapBackwards = await driveSelection('Z.');
    assert.deepEqual(await selectedCoordinates(wrapBackwards.selection),
        EXPECTED_CYCLE[EXPECTED_CYCLE.length - 1]);
});

void test("'@' restarts the valid cycle from the hero square", async () => {
    freshObjectRoom();

    const { selection } = await driveSelection('zz@z.');
    assert.deepEqual(await selectedCoordinates(selection), EXPECTED_CYCLE[1]);
});

void test("unseen valid squares stay reachable by cycling", async () => {
    freshObjectRoom();

    const { selection, views } = await driveSelection('Z.');
    assert.deepEqual(await selectedCoordinates(selection), UNSEEN_VALID);
    // The cursor still views over an unseen square without revealing it.
    assert.equal(viewAfterInput(views, -1).glyphs.at(-1), ' ');
});

void test("'$' marks visible valid squares and leaves unseen ones unmarked",
    async () => {
        freshObjectRoom();

        const { selection, views } = await driveSelection('$.');
        await selection;

        const marked = viewAfterInput(views, 1).glyphs.slice(0, VISIBLE_VALID.length);
        assert.deepEqual(marked, ['$', '$', '$', '$']);
        assert.equal(viewAfterInput(views, 1).glyphs.at(-1), ' ');
        // S_goodpos marks use the HI_ZAP color from defsym.h.
        assert.equal(viewAfterInput(views, 1).colors[1], HI_ZAP);
        assert.equal(glyphAt(10, 11), '.');
    });

void test("marking leaves the hero '@' when the rule rejects the hero square",
    async () => {
        freshObjectRoom();

        // The cycle injects the hero square as its anchor, but C's hilite
        // callback calls the validity predicate per spot, so the hero stays
        // unmarked while a reachable square shows '$'.
        const { selection, views } = await driveSelection('$.', {
            sampleSpots: [{ x: 10, y: 10 }, { x: 12, y: 10 }],
        });
        await selection;

        assert.deepEqual(viewAfterInput(views, 1).glyphs, ['@', '$']);
    });

void test("a rule that accepts the hero square marks it too", async () => {
    freshObjectRoom();

    const { selection, views } = await driveSelection('$.', {
        sampleSpots: [{ x: 10, y: 10 }, { x: 12, y: 10 }],
        selectMapPosition: {
            isValidLocation: (x, y) => (x === 10 && y === 10)
                || (x === 12 && y === 10),
        },
    });
    await selection;

    assert.deepEqual(viewAfterInput(views, 1).glyphs, ['$', '$']);
});

void test("a second '$' removes the marking again", async () => {
    freshObjectRoom();

    const { selection, views } = await driveSelection('$$.');
    await selection;

    assert.deepEqual(viewAfterInput(views, 1).glyphs.slice(0, VISIBLE_VALID.length),
        ['$', '$', '$', '$']);
    assert.ok(viewAfterInput(views, 2).glyphs.slice(0, VISIBLE_VALID.length)
        .every(ch => ch !== '$'));
});

void test("marking ends when the help screen redraws the map", async () => {
    freshObjectRoom();

    // '?' draws the help menu; space dismisses it; '.' picks the spot.
    const { selection, views } = await driveSelection('$? .');
    await selection;

    assert.ok(viewAfterInput(views, 3).glyphs.slice(0, VISIBLE_VALID.length)
        .every(ch => ch !== '$'));
});

void test("getpos help lists the valid-location keys while a rule is active",
    async () => {
        freshObjectRoom();
        requireFixtureGame(game);

        const help = getposHelpUntilDismissed('the spot to hit',
            { hasValidLocations: true });
        pushKeys(' ');
        await help;
        const text = requireGameDisplay(game).grid
            .map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.ok(text.includes("Use 'z' or 'Z' to move to valid locations."));
        assert.ok(text.includes("Use '$' to toggle marking of valid locations."));

        freshObjectRoom();
        const plainHelp = getposHelpUntilDismissed('the spot to hit');
        pushKeys(' ');
        await plainHelp;
        const plainText = requireGameDisplay(game).grid
            .map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.ok(!plainText.includes('valid locations'));
    });

void test("the '$' marking is cleaned up after a pick, a cancel, and an error",
    async () => {
        freshObjectRoom();
        const picked = await driveSelection('$z.');
        await picked.selection;
        // exitgetpos queues restored glyphs; its caller flushes the map.
        await flush_screen(0);
        for (const { x, y } of VISIBLE_VALID)
            assert.equal(glyphAt(x, y), '.', `${x},${y}`);

        freshObjectRoom();
        const cancelled = await driveSelection('$\x1b');
        assert.equal(await cancelled.selection, null);
        await flush_screen(0);
        for (const { x, y } of VISIBLE_VALID)
            assert.equal(glyphAt(x, y), '.', `${x},${y}`);

        freshObjectRoom();
        const failing = await driveSelection('$ ', {
            selectMapPosition: {
                describe: () => {
                    throw new Error('describe failed');
                },
            },
        });
        await assert.rejects(failing.selection, /describe failed/);
        await flush_screen(0);
        for (const { x, y } of VISIBLE_VALID)
            assert.equal(glyphAt(x, y), '.', `${x},${y}`);
    });

void test("without a validity rule '$' and 'z' keep plain getpos behavior",
    async () => {
        freshObjectRoom();
        requireFixtureGame(game);

        const { selection, views } = await driveSelection('$z.', {
            sampleSpots: VISIBLE_VALID,
            selectMapPosition: { isValidLocation: null },
        });
        assert.deepEqual(await selectedCoordinates(selection), { x: 10, y: 10 });
        for (const view of views)
            assert.ok(view.glyphs.every(ch => ch !== '$'));
    });

void test("cycling moves the visible cursor while valid squares remain marked",
    async () => {
        freshObjectRoom();

        const { selection, views } = await driveSelection('$z.');
        await selection;

        assert.deepEqual(viewAfterInput(views, 2).cursor, EXPECTED_CYCLE[1]);
        assert.equal(viewAfterInput(views, 2).glyphs[1], '$');
    });
