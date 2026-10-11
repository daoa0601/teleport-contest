// C display.c:xy_set_wall_state() and set_wall_state().
import { game, requireGameLevel } from './gstate.js';
import {
    BLCORNER, BRCORNER, COLNO, CORR, CROSSWALL, HWALL, IS_STWALL,
    ROWNO, SCORR, SDOOR, STONE, TDWALL, TLCORNER, TLWALL, TRCORNER,
    TRWALL, TUWALL, VWALL, WM_MASK, WM_X_BL, WM_X_BLTR, WM_X_BR,
    WM_X_TL, WM_X_TLBR, WM_X_TR, isok,
} from './const.js';

export function setWallStateAt(x: number, y: number): void {
    const loc = requireGameLevel().at(x, y);
    if (!loc) return;
    let mode = -1;
    switch (loc.typ) {
    case SDOOR:
        mode = straightWallMode(x, y, !!loc.horizontal);
        break;
    case VWALL:
        mode = straightWallMode(x, y, false);
        break;
    case HWALL:
        mode = straightWallMode(x, y, true);
        break;
    case TDWALL:
        mode = tWallMode([[x, y - 1], [x - 1, y + 1], [x + 1, y + 1]]);
        break;
    case TUWALL:
        mode = tWallMode([[x, y + 1], [x + 1, y - 1], [x - 1, y - 1]]);
        break;
    case TLWALL:
        mode = tWallMode([[x + 1, y], [x - 1, y - 1], [x - 1, y + 1]]);
        break;
    case TRWALL:
        mode = tWallMode([[x - 1, y], [x + 1, y + 1], [x + 1, y - 1]]);
        break;
    case TLCORNER:
        mode = cornerWallMode(
            [[x - 1, y - 1], [x, y - 1], [x - 1, y]], [x + 1, y + 1],
        );
        break;
    case TRCORNER:
        mode = cornerWallMode(
            [[x, y - 1], [x + 1, y - 1], [x + 1, y]], [x - 1, y + 1],
        );
        break;
    case BLCORNER:
        mode = cornerWallMode(
            [[x, y + 1], [x - 1, y + 1], [x - 1, y]], [x + 1, y - 1],
        );
        break;
    case BRCORNER:
        mode = cornerWallMode(
            [[x + 1, y], [x + 1, y + 1], [x, y + 1]], [x - 1, y - 1],
        );
        break;
    case CROSSWALL:
        mode = crossWallMode(x, y);
        break;
    default:
        break;
    }
    if (mode >= 0) loc.wall_info = ((loc.wall_info || 0) & ~WM_MASK) | mode;
}

export function setWallState(): void {
    if (!game.level) return;
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) setWallStateAt(x, y);
    }
}

// C ref: display.c set_wall_state()/xy_set_wall_state().  Wall topology and
// visibility are separate: the terrain type supplies the nominal junction,
// while the low three wall_info bits say which side is unfinished exterior.
// back_to_glyph()/wall_angle() later combines that mode with `seenv` so a
// hero beside a doorway does not see the outside face of the room wall.
function wallCheckPos(x: number, y: number, which: number): number {
    if (!isok(x, y)) return which;
    const typ = requireGameLevel().at(x, y)?.typ ?? STONE;
    return IS_STWALL(typ) || typ === CORR || typ === SCORR || typ === SDOOR
        ? which : 0;
}

function moreThanOne(...values: number[]): boolean {
    return values.filter(Boolean).length > 1;
}

function straightWallMode(x: number, y: number, horizontal: boolean): number {
    const first = horizontal
        ? wallCheckPos(x, y - 1, 1) : wallCheckPos(x - 1, y, 1);
    const second = horizontal
        ? wallCheckPos(x, y + 1, 2) : wallCheckPos(x + 1, y, 2);
    return moreThanOne(first, second) ? 0 : first + second;
}

function cornerWallMode(points: readonly (readonly [number, number])[], inner: readonly [number, number]): number {
    const outside = points.map(([x, y]) => wallCheckPos(x, y, 1));
    if (wallCheckPos(inner[0], inner[1], 1)) return 2;
    return outside.every(Boolean) ? 1 : 0;
}

function tWallMode(points: readonly (readonly [number, number])[]): number {
    const modes = points.map(([x, y], index) =>
        wallCheckPos(x, y, index + 1));
    return moreThanOne(...modes) ? 0 : modes.reduce((sum, value) => sum + value, 0);
}

function crossWallMode(x: number, y: number): number {
    const quadrants = [
        wallCheckPos(x - 1, y - 1, 1),
        wallCheckPos(x + 1, y - 1, 1),
        wallCheckPos(x + 1, y + 1, 1),
        wallCheckPos(x - 1, y + 1, 1),
    ];
    const present = quadrants.filter(Boolean);
    if (present.length <= 1) {
        if (quadrants[0]) return WM_X_TL;
        if (quadrants[1]) return WM_X_TR;
        if (quadrants[2]) return WM_X_BR;
        if (quadrants[3]) return WM_X_BL;
        return 0;
    }
    if (quadrants[0] && quadrants[2] && !quadrants[1] && !quadrants[3])
        return WM_X_TLBR;
    if (quadrants[1] && quadrants[3] && !quadrants[0] && !quadrants[2])
        return WM_X_BLTR;
    return 0;
}
