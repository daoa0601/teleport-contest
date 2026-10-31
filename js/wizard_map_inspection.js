// C wizcmds.c:wiz_show_seenv(), wiz_show_vision(), wiz_show_wmodes().
import { COLNO, ROWNO, COULD_SEE, IN_SIGHT, TEMP_LIT, WM_MASK, CORR, SDOOR, IS_WALL, IS_ROOM, IS_DOOR } from './const.js';
import { displayMessageWindow } from './tty_topline.js';
import { game, requireGameLevel } from './gstate.js';
import { showTextWindow } from './windows.js';
// C wizcmds.c:wiz_show_seenv().
export async function showSeenVectors() {
    const level = requireGameLevel();
    const hero = game.u;
    let start = Math.max(1, hero.ux - Math.floor(COLNO / 4));
    const stop = Math.min(start + Math.floor(COLNO / 2), COLNO);
    if (stop - start === Math.floor(COLNO / 2))
        start++;
    const lines = [];
    for (let y = 0; y < ROWNO; y++) {
        let row = '';
        for (let x = start; x < stop; x++) {
            const seen = level.requireAt(x, y).seenv & 0xff;
            row += x === hero.ux && y === hero.uy ? '@@'
                : seen ? seen.toString(16).padStart(2, '0') : '  ';
        }
        lines.push(row.trimEnd());
    }
    await showInspection(lines);
}
// C wizcmds.c:wiz_show_vision().
export async function showVisionFlags() {
    const hero = game.u;
    const lines = [`Flags: 0x${COULD_SEE.toString(16)} could see, 0x${IN_SIGHT.toString(16)} in sight, 0x${TEMP_LIT.toString(16)} temp lit`, ''];
    for (let y = 0; y < ROWNO; y++) {
        let row = '';
        for (let x = 1; x < COLNO; x++) {
            const flags = game.viz_array?.[y]?.[x] ?? 0;
            row += x === hero.ux && y === hero.uy ? '@' : flags ? String(flags) : ' ';
        }
        lines.push(row.trimEnd());
    }
    await showInspection(lines);
}
// C wizcmds.c:wiz_show_wmodes().
export async function showWallModes() {
    const level = requireGameLevel();
    const hero = game.u;
    // tty's initial blank line aligns these rows with the normal map.
    const lines = [''];
    for (let y = 0; y < ROWNO; y++) {
        let row = '';
        for (let x = 1; x < COLNO; x++) {
            const location = level.requireAt(x, y);
            row += x === hero.ux && y === hero.uy ? '@'
                : IS_WALL(location.typ) || location.typ === SDOOR ? String(location.wall_info & WM_MASK)
                    : location.typ === CORR ? '#'
                        : IS_ROOM(location.typ) || IS_DOOR(location.typ) ? '.' : 'x';
        }
        lines.push(row);
    }
    await showInspection(lines);
}
async function showInspection(lines) {
    await displayMessageWindow();
    await showTextWindow(lines);
    game.context.move = 0;
}
//# sourceMappingURL=wizard_map_inspection.js.map