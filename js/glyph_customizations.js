// Pinned dat/symbols, expanded as glyphs.c:glyph_find_core()/apply_customizations().
import { game } from './gstate.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from './glyph_numbers.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { MONSTER_NAME, MONSTER_COLOR, MONSTER_SYMBOL, MONSTER_CLASS_SYMBOLS } from './monster_data.js';
import { OBJECT_NAMES, OBJECT_COLOR, getObjectDefinition, requireObjectData } from './object_data.js';
import { CLR_BLACK, CLR_BLUE, CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA, CLR_BROWN, CLR_GRAY, CLR_GREEN, CLR_MAGENTA, CLR_ORANGE, CLR_RED, CLR_WHITE, CLR_YELLOW, NO_COLOR } from './terminal.js';
const BASIC_COLOR = 0x1000000;
const WALL_NAMES = ['vwall', 'hwall', 'tlcorn', 'trcorn', 'blcorn', 'brcorn',
    'crwall', 'tuwall', 'tdwall', 'tlwall', 'trwall'];
const SINGLE_WALLS = [0x2502, 0x2500, 0x250c, 0x2510, 0x2514, 0x2518,
    0x253c, 0x2534, 0x252c, 0x2524, 0x251c];
const DOUBLE_WALLS = [0x2551, 0x2550, 0x2554, 0x2557, 0x255a, 0x255d,
    0x256c, 0x2569, 0x2566, 0x2563, 0x2560];
const BRANCHES = [
    { offset: GlyphOffset.cmapMain, name: 'main', palette: 0, rgb: 0 },
    { offset: GlyphOffset.cmapMines, name: 'mines', palette: BASIC_COLOR | CLR_BROWN, rgb: 0xbe7e00 },
    { offset: GlyphOffset.cmapGehennom, name: 'gehennom', palette: BASIC_COLOR | CLR_RED, rgb: BASIC_COLOR | CLR_RED },
    { offset: GlyphOffset.cmapKnox, name: 'knox', palette: BASIC_COLOR | CLR_YELLOW, rgb: 0x7ee6e6 },
    { offset: GlyphOffset.cmapSokoban, name: 'sokoban', palette: BASIC_COLOR | CLR_BLUE, rgb: BASIC_COLOR | CLR_BLUE },
];
// S_ replacements common to Enhanced1 and Enhanced2. Wall entries are
// separate because Enhanced2 uses double lines for S_, but single lines for G_.
const ENHANCED_SYMBOLS = [
    [CmapSymbol.corr, 'corr', 0x2591], [CmapSymbol.engrcorr, 'engrcorr', 0x2591],
    [CmapSymbol.litcorr, 'litcorr', 0x2592], [CmapSymbol.ndoor, 'ndoor', 0x00b7],
    [CmapSymbol.vodoor, 'vodoor', 0x2592], [CmapSymbol.hodoor, 'hodoor', 0x2592],
    [CmapSymbol.bars, 'bars', 0x2261], [CmapSymbol.tree, 'tree', 0x03a8],
    [CmapSymbol.room, 'room', 0x00b7], [CmapSymbol.engroom, 'engroom', 0x03be],
    [CmapSymbol.darkroom, 'darkroom', 0x00b7], [CmapSymbol.upladder, 'upladder', 0x2264],
    [CmapSymbol.dnladder, 'dnladder', 0x2265], [CmapSymbol.altar, 'altar', 0x03a9],
    [CmapSymbol.grave, 'grave', 0x2020], [CmapSymbol.pool, 'pool', 0x224b],
    [CmapSymbol.ice, 'ice', 0x00b7], [CmapSymbol.lava, 'lava', 0x224b],
    [CmapSymbol.lavawall, 'lavawall', 0x2248], [CmapSymbol.vodbridge, 'vodbridge', 0x00b7],
    [CmapSymbol.hodbridge, 'hodbridge', 0x00b7], [CmapSymbol.water, 'water', 0x2248],
    [CmapSymbol.web, 'web', 0x00a4],
    [CmapSymbol.vbeam, 'vbeam', 0x2502], [CmapSymbol.hbeam, 'hbeam', 0x2500],
    [CmapSymbol.swallowTopLeft + 1, 'sw_tc', 0x2594],
    [CmapSymbol.swallowTopLeft + 3, 'sw_ml', 0x258f],
    [CmapSymbol.swallowTopLeft + 4, 'sw_mr', 0x2595],
    [CmapSymbol.swallowTopLeft + 6, 'sw_bc', 0x2581],
    [CmapSymbol.explosionTopLeft + 1, 'expl_tc', 0x2594],
    [CmapSymbol.explosionTopLeft + 3, 'expl_ml', 0x258f],
    [CmapSymbol.explosionTopLeft + 5, 'expl_mr', 0x2595],
    [CmapSymbol.explosionTopLeft + 7, 'expl_bc', 0x2581],
];
// The display.h color enums used by reset_glyphmap(), in native range order.
const ALTAR_NAMES = ['unaligned_altar', 'chaotic_altar', 'neutral_altar', 'lawful_altar', 'altar_other'];
const ALTAR_COLORS = [CLR_RED, CLR_GRAY, CLR_GRAY, CLR_GRAY, CLR_BRIGHT_MAGENTA];
const ZAP_NAMES = ['missile', 'fire', 'frost', 'sleep', 'death', 'lightning', 'poison_gas', 'acid'];
const ZAP_COLORS = [CLR_BRIGHT_BLUE, CLR_ORANGE, CLR_WHITE, CLR_BRIGHT_BLUE,
    CLR_BLACK, CLR_WHITE, CLR_GREEN, CLR_YELLOW];
const SWALLOW_NAMES = ['top_left', 'top_center', 'top_right', 'middle_left',
    'middle_right', 'bottom_left', 'bottom_center', 'bottom_right'];
const EXPLOSION_NAMES = ['dark', 'noxious', 'muddy', 'wet', 'magical', 'fiery', 'frosty'];
const EXPLOSION_COLORS = [CLR_BLACK, CLR_GREEN, CLR_BROWN, CLR_BLUE, CLR_MAGENTA, CLR_ORANGE, CLR_WHITE];
export function customizedGlyphs() {
    const name = game.symset?.toLowerCase() ?? '';
    const enhanced = name === 'enhanced1' || name === 'enhanced2';
    const palette = /^(?:decgraphics|curses|ibmgraphics(?:_[12])?)$/.test(name);
    if (!enhanced && !palette)
        return [];
    const glyphs = new Map();
    if (enhanced) {
        const walls = name === 'enhanced2' ? DOUBLE_WALLS : SINGLE_WALLS;
        WALL_NAMES.forEach((wall, index) => {
            const unicode = walls[index];
            if (unicode === undefined)
                throw new Error(`Missing Unicode wall ${wall}`);
            for (const glyph of cmapGlyphs(CmapSymbol.vwall + index, wall))
                customize(glyphs, glyph, unicode, 0);
        });
        for (const [symbol, id, value] of ENHANCED_SYMBOLS) {
            const unicode = name === 'enhanced2' && symbol === CmapSymbol.bars ? 0x2980
                : name === 'enhanced2' && symbol === CmapSymbol.tree ? 0x2660 : value;
            for (const glyph of cmapGlyphs(symbol, id))
                customize(glyphs, glyph, unicode, 0);
        }
        if (name === 'enhanced2') {
            for (const glyph of cmapGlyphs(CmapSymbol.cloud, 'cloud'))
                customize(glyphs, glyph, 0x2601, 0);
            // glyph_find_core(find_oc) compares glyph_to_obj() with the
            // loadsyms ordinal. S_amulet is ordinal 4, the generic ring slot.
            for (const glyph of objectGlyphs(4))
                customize(glyphs, glyph, 0x2299, 0);
        }
        for (const glyph of cmapGlyphs(CmapSymbol.fountain, 'fountain'))
            customize(glyphs, glyph, 0x2320, 0x0096ff);
    }
    for (const branch of BRANCHES) {
        if (branch.name === 'main')
            continue;
        WALL_NAMES.forEach((wall, index) => {
            const glyph = wallGlyph(branch.offset, branch.name, index, wall);
            const unicode = enhanced ? SINGLE_WALLS[index] : null;
            if (unicode === undefined)
                throw new Error(`Missing Unicode wall ${wall}`);
            customize(glyphs, glyph, unicode, enhanced ? branch.rgb : branch.palette);
        });
    }
    // wizcustom_glyphids() walks glyph numbers, not customization-file order.
    return [...glyphs.values()].sort((left, right) => left.glyph - right.glyph);
}
function customize(glyphs, glyph, unicode, color) {
    const appliedUnicode = game.flags.customsymbols === false ? null : unicode;
    const customColor = game.flags.customcolors === false ? 0 : color;
    if (appliedUnicode !== null || customColor !== 0)
        glyphs.set(glyph.glyph, { ...glyph, unicode: appliedUnicode, customColor });
}
function cmapGlyphs(symbol, name) {
    if (symbol >= CmapSymbol.vwall && symbol <= CmapSymbol.trwall) {
        const index = symbol - CmapSymbol.vwall;
        return BRANCHES.map(branch => wallGlyph(branch.offset, branch.name, index, name));
    }
    if (symbol === CmapSymbol.altar) {
        return ALTAR_NAMES.map((id, index) => {
            const color = ALTAR_COLORS[index];
            if (color === undefined)
                throw new Error(`Missing altar color ${id}`);
            return dungeonGlyph(GlyphOffset.altar + index, symbol, id, color, cmapToRogueColor(symbol));
        });
    }
    if (symbol >= CmapSymbol.vbeam && symbol < CmapSymbol.digbeam) {
        return ZAP_NAMES.map((type, index) => {
            const color = ZAP_COLORS[index];
            if (color === undefined)
                throw new Error(`Missing beam color ${type}`);
            return dungeonGlyph(GlyphOffset.zap + index * 4 + symbol - CmapSymbol.vbeam, symbol, `${type}_zap_${name}`, color, NO_COLOR);
        });
    }
    if (symbol >= CmapSymbol.swallowTopLeft && symbol <= CmapSymbol.swallowBottomRight) {
        const index = symbol - CmapSymbol.swallowTopLeft;
        const position = SWALLOW_NAMES[index];
        if (!position)
            throw new Error(`Unknown swallow position ${index}`);
        return MONSTER_NAME.map((name, mnum) => {
            const color = MONSTER_COLOR[mnum];
            if (color === undefined)
                throw new Error(`Missing monster color ${mnum}`);
            return dungeonGlyph(GlyphOffset.swallow + mnum * 8 + index, symbol, `swallow_${monsterGlyphName(name, mnum)}_${position}`, color, NO_COLOR);
        });
    }
    if (symbol >= CmapSymbol.explosionTopLeft && symbol <= CmapSymbol.explosionBottomRight) {
        const index = symbol - CmapSymbol.explosionTopLeft;
        return EXPLOSION_NAMES.map((type, style) => {
            const color = EXPLOSION_COLORS[style];
            if (color === undefined)
                throw new Error(`Missing explosion color ${type}`);
            return dungeonGlyph(GlyphOffset.explodeDark + style * 9 + index, symbol, `${type}_${name}`, color, color);
        });
    }
    // The raw corridor and lit-corridor symbols are both '#', so native
    // reset_glyphmap() uses white for the lit corridor's base color.
    const color = symbol === CmapSymbol.litcorr ? CLR_WHITE : MAP_SYMBOLS[symbol]?.color ?? CLR_GRAY;
    return [dungeonGlyph(cmapToGlyph(symbol), symbol, name, color, cmapToRogueColor(symbol))];
}
function wallGlyph(offset, branch, index, name) {
    return dungeonGlyph(offset + index, CmapSymbol.vwall + index, `${name}_${branch}`, CLR_GRAY, branch === 'main' ? CLR_BROWN : CLR_GRAY);
}
function dungeonGlyph(glyph, symbol, id, baseColor, rogueColor) {
    return { glyph, id: `G_${id}`, symbol: { kind: 'cmap', index: symbol }, baseColor, rogueColor };
}
function objectGlyphs(otyp) {
    const name = OBJECT_NAMES[otyp];
    if (!name)
        throw new Error(`Missing object glyph name ${otyp}`);
    const { oclass } = getObjectDefinition(otyp);
    const baseColor = game.objectColors?.[otyp] ?? requireObjectData(OBJECT_COLOR, otyp);
    const rogueColor = oclass === 12 ? CLR_YELLOW : oclass === 7 ? CLR_RED : CLR_BRIGHT_BLUE;
    return [GlyphOffset.object, GlyphOffset.objectPiletop].map((offset, index) => ({
        glyph: offset + otyp, id: `G_${index ? 'piletop_' : ''}${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        symbol: { kind: 'object', oclass }, baseColor, rogueColor,
    }));
}
function monsterGlyphName(name, mnum) {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    // monsters.h enum names distinguish human were-creatures from animal forms.
    return MONSTER_SYMBOL[mnum] === MONSTER_CLASS_SYMBOLS.indexOf('@')
        && ['wererat', 'werejackal', 'werewolf'].includes(normalized)
        ? `human_${normalized}` : normalized;
}
// display.c:cmap_to_roguecolor(), shared with map rendering.
export function cmapToRogueColor(index) {
    if (index >= CmapSymbol.vwall && index <= CmapSymbol.hcdoor)
        return CLR_BROWN;
    if (index >= CmapSymbol.arrowTrap && index <= CmapSymbol.arrowTrap + 21)
        return CLR_MAGENTA;
    if (index === CmapSymbol.corr || index === CmapSymbol.litcorr)
        return CLR_GRAY;
    if (index >= CmapSymbol.room && index <= CmapSymbol.water
        && index !== CmapSymbol.darkroom)
        return CLR_GREEN;
    return NO_COLOR;
}
//# sourceMappingURL=glyph_customizations.js.map