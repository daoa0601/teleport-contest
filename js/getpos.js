// C refs: getpos.c:getpos(), drawing.c:defsyms[], symbols.c:gs.showsyms[].

import { COLNO, D_ISOPEN, DOOR, ROWNO } from './const.js';
import {
    bot, docrt, flush_screen, terrain_glyph,
} from './display.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { NO_COLOR } from './terminal.js';
import { showTextMenuOverlay } from './windows.js';

// When getpos receives a byte which is not one of its editor commands, it
// first maps that byte to every eligible cmap entry and only then searches
// the level.  "No such feature on this level" is therefore distinct from
// "not a dungeon-feature symbol".  Keep that classification here so travel,
// farlook, and controlled teleport do not grow independent symbol
// whitelists.

// Default symbols from defsym.h after excluding walls, room floors,
// corridors, doors, and S_ndoor, exactly as getpos.c does.  Several
// presentation/effect entries share these characters; getpos still treats
// them as eligible feature keys even if no corresponding glyph is present.
const DEFAULT_GETPOS_FEATURE_SYMBOLS = new Set([
    '#', '`', '<', '>', '_', '|', '\\', '{', '}', '.', ' ',
    '^', '"', '~', '-', '/', '*', '!', ')', '(', '0', '@', '$',
]);

// DECgraphics changes the active showsyms for eligible cmap entries.  C
// accepts both each entry's defsym and its active showsym.  These are the
// additional low-seven-bit input characters introduced by the DEC set; all
// of its other eligible projections are already in the default set above.
const DEC_GETPOS_FEATURE_SYMBOLS = new Set([
    'g', 'y', 'z', 'x', 'q', 'o', 's',
]);

export function isGetposFeatureSymbol(ch, symset = '') {
    if (typeof ch !== 'string' || ch.length !== 1) return false;
    if (DEFAULT_GETPOS_FEATURE_SYMBOLS.has(ch)) return true;
    return /^DECgraphics$/i.test(symset)
        && DEC_GETPOS_FEATURE_SYMBOLS.has(ch);
}

// A diagonal which crosses a map edge loses the same amount of movement on
// its other axis.  Clamping each axis separately would slide along the edge.
export function moveGetposCursor(cursor, dx, dy) {
    if (cursor.x + dx < 1) {
        dy -= Math.sign(dy) * (1 - (cursor.x + dx));
        dx = 1 - cursor.x;
    } else if (cursor.x + dx > COLNO - 1) {
        dy += Math.sign(dy) * ((COLNO - 1) - (cursor.x + dx));
        dx = (COLNO - 1) - cursor.x;
    }
    if (cursor.y + dy < 0) {
        dx -= Math.sign(dx) * (0 - (cursor.y + dy));
        dy = -cursor.y;
    } else if (cursor.y + dy > ROWNO - 1) {
        dx += Math.sign(dx) * ((ROWNO - 1) - (cursor.y + dy));
        dy = (ROWNO - 1) - cursor.y;
    }
    cursor.x += dx;
    cursor.y += dy;
}

function farlookTipLines() {
    return [
        'Tip: Farlooking or selecting a map location',
        '',
        'You are now in a "farlook" mode - the movement keys move the cursor,',
        'not your character.  Game time does not advance.  This mode is used',
        'to look around the map, or to select a location on it.',
        '',
        'When in this mode, you can press ESC to return to normal game mode,',
        'and pressing ? will show the key help.',
    ];
}

export async function farlookTipUntilDismissed() {
    return showTextMenuOverlay(farlookTipLines(), {
        validKeys: [27, 32, 10, 13],
    });
}

function getposFeatureMatches(x, y, symbol, state) {
    const loc = state.level?.at?.(x, y);
    if (!loc) return false;

    // `D` means an open door even when the active graphics set draws that
    // door with another character.
    if (symbol === 'D') {
        return loc.typ === DOOR && loc.doormask === D_ISOPEN
            && !!loc.remembered_glyph;
    }

    if (loc.remembered_glyph?.kind === 'terrain'
        && loc.remembered_glyph.ch === symbol) return true;
    if (loc.seenv) {
        const background = terrain_glyph(loc, x, y);
        if (background.ch === symbol) return true;
    }
    return false;
}

// Search from the cursor to the bottom-right of the map, then wrap around.
export function nextGetposFeature(cursor, symbol, state = game) {
    for (let pass = 0; pass <= 1; pass++) {
        const lowY = pass === 0 ? cursor.y : 0;
        const highY = pass === 0 ? ROWNO - 1 : cursor.y;
        for (let y = lowY; y <= highY; y++) {
            const lowX = pass === 0 && y === lowY ? cursor.x + 1 : 1;
            const highX = pass === 1 && y === highY
                ? cursor.x : COLNO - 1;
            for (let x = lowX; x <= highX; x++) {
                if (getposFeatureMatches(x, y, symbol, state))
                    return { x, y };
            }
        }
    }
    return null;
}

export function getposFeatureMissMessage(ch, state = game) {
    const code = ch.codePointAt(0);
    const visible = code < 32
        ? `^${String.fromCharCode(code + 64)}`
        : code === 127 ? '^?' : ch;
    return isGetposFeatureSymbol(ch, state.symset)
        ? `Can't find dungeon feature '${visible}'.`
        : `Unknown direction: '${visible}' (use 'h', 'j', 'k', 'l' or '.').`;
}

export function isGetposPickCharacter(ch) {
    return '.,;:'.includes(ch);
}

export async function paintGetposCursor(cursor, message) {
    game._pending_message = message;
    await docrt();
    await bot();
    await flush_screen(1);
    game.nhDisplay?.setCursor(cursor.x - 1, cursor.y + 1);
}

// C getpos.c:getpos_help() draws this menu over the right side of the map.
export async function getposHelpUntilDismissed(goal) {
    const display = game.nhDisplay;
    const left = 10;
    const lines = [
        `Use 'h', 'j', 'k', 'l' to move the cursor to ${goal}.`,
        "Use 'H', 'J', 'K', 'L' to fast-move the cursor, 8 units at a time.",
        "(or prefix normal move with 'G' or 'g' to fast-move)",
        "Or enter a background symbol (ex. '<').",
        "Use '@' to move the cursor on yourself.",
        "Use 'm'/'M' to move the cursor to next/previous monster.",
        "Use 'o'/'O' to move the cursor to next/previous object.",
        "Use 'd'/'D' to move the cursor to next/previous door or doorway.",
        "Use 'x'/'X' to move the cursor next to an unexplored location.",
        "Use 'a'/'A' to move the cursor to anything interesting.",
        "Use '*' to change fast-move mode to skipping same glyphs.",
        "Use '!' to toggle menu listing for possible targets.",
        `Use '"' to change the mode of limiting possible targets.`,
        "Use '#' to toggle automatic description.",
        "Type a '.' when you are at the right place.",
        '',
    ];

    game._pending_message = '';
    display?.clearRow(0);
    for (let row = 1; row <= lines.length; row++) {
        for (let col = left - 1; col < (display?.cols ?? 80); col++)
            display?.setCell(col, row, ' ', NO_COLOR, 0);
    }
    for (let row = 0; row < lines.length; row++) {
        for (let col = 0; col < lines[row].length; col++)
            display?.setCell(left + col, row, lines[row][col], NO_COLOR, 0);
    }
    const more = '--More--';
    for (let col = 0; col < more.length; col++)
        display?.setCell(left + col, lines.length, more[col], NO_COLOR, 0);
    display?.setCursor(left + more.length, lines.length);

    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    return key;
}

const GETPOS_DIRECTIONS = {
    h: [-1, 0], j: [0, 1], k: [0, -1], l: [1, 0],
    y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
};

function describeSelectedPosition(describe, cursor, fallback) {
    return describe?.(cursor.x, cursor.y) || fallback;
}

export async function selectMapPosition({
    start,
    prompt,
    goal,
    describe,
    afterPaint = null,
}) {
    const cursor = { ...start };
    const movePrompt = `Move cursor to ${goal}:`;
    let message = prompt;
    let firstPaint = true;

    for (;;) {
        await paintGetposCursor(cursor, message);
        if (afterPaint) await afterPaint(cursor, firstPaint);
        firstPaint = false;

        const key = await nhgetch();
        const ch = String.fromCharCode(key);
        if (key === 27) {
            game._pending_message = '';
            return null;
        }
        if (isGetposPickCharacter(ch)) return cursor;
        if (key === 18) {
            message = movePrompt;
            continue;
        }
        if (ch === '?') {
            await getposHelpUntilDismissed(goal);
            message = movePrompt;
            continue;
        }
        if (ch === ' ') {
            message = describeSelectedPosition(describe, cursor, movePrompt);
            continue;
        }
        if (ch === '$') {
            message = movePrompt;
            continue;
        }
        if (ch === '@') {
            cursor.x = game.u.ux;
            cursor.y = game.u.uy;
            message = describeSelectedPosition(describe, cursor, movePrompt);
            continue;
        }
        if (key === 10 || key === 13) {
            moveGetposCursor(cursor, 0, 8);
            message = describeSelectedPosition(describe, cursor, movePrompt);
            continue;
        }

        const direction = GETPOS_DIRECTIONS[ch.toLowerCase()];
        if (direction) {
            const distance = ch === ch.toUpperCase() ? 8 : 1;
            moveGetposCursor(
                cursor, direction[0] * distance, direction[1] * distance,
            );
            message = describeSelectedPosition(describe, cursor, movePrompt);
            continue;
        }

        const feature = nextGetposFeature(cursor, ch);
        if (feature) {
            cursor.x = feature.x;
            cursor.y = feature.y;
            message = describeSelectedPosition(describe, cursor, movePrompt);
            continue;
        }
        message = getposFeatureMissMessage(ch);
    }
}
