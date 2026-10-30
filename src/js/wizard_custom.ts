// C wizcmds.c:wiz_custom()/wizcustom_callback(), glyphs.c:wizcustom_glyphids().
import { NHW_MENU, PICK_NONE } from './const.js';
import { customizedBranchWalls, docrt } from './display.js';
import { game } from './gstate.js';
import { symsetMenuValue } from './options.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { addMenuHeading } from './windows.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow,
    tty_end_menu, tty_select_menu } from './tty_menu.js';

export async function wizCustom(): Promise<void> {
    const window = tty_create_nhwindow<number>(NHW_MENU);
    addMenuHeading(window, '    glyph  glyph identifier                             sym   clr customcolor unicode utf8');
    for (const wall of customizedBranchWalls()) {
        const color = MAP_SYMBOLS[wall.symbol]?.color;
        if (color === undefined) throw new Error(`Customized wall ${wall.id} has no base color`);
        // color.h:NH_BASIC_COLOR tags palette indices in customcolor.
        const customColor = (0x1000000 | wall.color).toString(16).padStart(11, '0');
        const text = `[${String(wall.glyph).padStart(4, '0')}] ${wall.id.padEnd(44)} `
            + `'\\${String(wall.symbolByte).padStart(3, '0')}' ${String(color).padStart(2, '0')} ${customColor} `;
        tty_add_menu(window, { identifier: wall.glyph + 1, text });
    }
    // The xterm-256color terminal profile advertises 256 available colors.
    tty_end_menu(window, `#wizcustom: colorcount=256 ${symsetMenuValue()}`);
    await tty_select_menu(window, PICK_NONE);
    await tty_destroy_nhwindow(window);
    await docrt();
    game.context.move = 0;
}
