// C refs: getpos.c:getpos(), drawing.c:defsyms[], symbols.c:gs.showsyms[].
//
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
