// C wizcmds.c:wiz_custom()/wizcustom_callback(), glyphs.c:wizcustom_glyphids().
import { Is_rogue_level, NHW_MENU, PICK_NONE } from './const.js';
import { cmapSymbolByte, docrt, objectClassSymbol, rogueColorsActive } from './display.js';
import { customizedGlyphs } from './glyph_customizations.js';
import { game } from './gstate.js';
import { symsetMenuValue } from './options.js';
import { NO_COLOR } from './terminal.js';
import { addMenuHeading } from './windows.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu } from './tty_menu.js';
export async function wizCustom() {
    const window = tty_create_nhwindow(NHW_MENU);
    addMenuHeading(window, '    glyph  glyph identifier                             sym   clr customcolor unicode utf8');
    const rogue = Is_rogue_level(game.u.uz);
    // reset_glyphmap() also clears Rogue colors unless its active set enables IBM color.
    const colorEnabled = game.flags.color !== false
        && (!rogue || rogueColorsActive());
    for (const glyph of customizedGlyphs()) {
        const byte = glyph.symbol.kind === 'cmap' ? cmapSymbolByte(glyph.symbol.index)
            : objectClassSymbol(glyph.symbol.oclass).charCodeAt(0);
        const baseColor = rogue ? glyph.rogueColor : glyph.baseColor;
        const color = colorEnabled ? baseColor : NO_COLOR;
        const customColor = glyph.customColor.toString(16).padStart(11, '0');
        const unicode = glyph.unicode === null ? ''
            : `U+${glyph.unicode.toString(16).padStart(4, '0')}`
                + [...new TextEncoder().encode(String.fromCodePoint(glyph.unicode))]
                    .map(byte => ` <${byte}>`).join('');
        const text = `[${String(glyph.glyph).padStart(4, '0')}] ${glyph.id.padEnd(44)} `
            + `'\\${String(byte).padStart(3, '0')}' ${String(color).padStart(2, '0')} ${customColor} ${unicode}`;
        tty_add_menu(window, { identifier: glyph.glyph + 1, text });
    }
    // The xterm-256color terminal profile advertises 256 available colors.
    tty_end_menu(window, `#wizcustom: colorcount=256 ${symsetMenuValue()}`);
    await tty_select_menu(window, PICK_NONE);
    await tty_destroy_nhwindow(window);
    await docrt();
    game.context.move = 0;
}
//# sourceMappingURL=wizard_custom.js.map