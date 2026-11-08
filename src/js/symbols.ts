// symbols.js — the symbols.c symbol-set state: the shown set, the Rogue
// set tables, and the SYM_BOULDER lookup (get_othersym). The symbol-set
// picker (do_symset) lives in options.ts; glyph rendering in display.ts.

import { Is_rogue_level } from './const.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import { CmapSymbol } from './glyph_numbers.js';
import {
    WEAPON_CLASS, ARMOR_CLASS, RING_CLASS,
    AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS,
    SPBOOK_CLASS, WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS,
    BALL_CLASS, CHAIN_CLASS, VENOM_CLASS,
} from './objclass.js';

// Port only: the currently shown symbol set (rogue or primary).
export function shownSymbolSet(state: GameState = game) {
    const rogue = Is_rogue_level(state.u?.uz, state);
    return state.shownSymbols ?? {
        rogue, name: (rogue ? state.rogueSymset : state.symset) ?? null,
    };
}

// C symbols.c:get_othersym(): the SYM_BOULDER lookup for the active symbol
// set — the active set's override, else the default rock-class symbol (the
// port computes the effective symbol on demand where C materializes
// showsyms[SYM_OFF_X + SYM_BOULDER]; the SYM_NOTHING default is inlined at
// its one use in reglyphSymbolSet in display.ts, and no port site reads
// SYM_UNEXPLORED or SYM_INVISIBLE).  optfn_boulder() fills both sets'
// overrides, while the BOULDER= statement (cfgfiles.c) only fills the
// primary one. A named primary selection can display that slot on Rogue.
export function currentBoulderSymbol(state: GameState = game): string {
    if (shownSymbolSet(state).rogue) {
        const set = activeRogueSymset(state);
        return state.rogueBoulderSym
            || (set?.blank ? BLANK_SYMBOL : '`');
    }
    return state.boulderSym || '`';
}

// symbols.c:init_rogue_symbols() changes ordinary stairs and open doorways.
// Branch stairs retain their default symbols.
export const rogueFurnitureSymbols = new Map<number, string>([
    [CmapSymbol.ndoor, '+'], [CmapSymbol.vodoor, '+'], [CmapSymbol.hodoor, '+'],
    [CmapSymbol.upstair, '%'], [CmapSymbol.dnstair, '%'],
]);

// dat/symbols `start:` bodies for the sets a Rogue level can display,
// layered over the base rogue set exactly as load_symset() replaces the
// entries update_rogue_symset() writes. `blank` models the Blank set,
// which replaces every symbol with \032 — decimal 32, a space (options.c
// escapes() reads a bare \nnn as decimal; octal needs the \o prefix).
export interface RogueSymsetSymbols {
    cmap?: ReadonlyMap<number, string>;
    blank?: boolean;
    objectClasses?: Partial<Record<number, string>>;
    boulderSymbol?: string;
    trapSymbol?: string;
    humanSymbol?: string;
    ibm?: boolean;
    // `Color: Yes` clears nocolor; together with IBM handling, that turns
    // the Rogue-level color tables on.
    color?: boolean;
}

const ROGUE_DOUBLE_WALLS: ReadonlyMap<number, string> = new Map([
    [CmapSymbol.vwall, '\u00ba'], [CmapSymbol.hwall, '\u00cd'],
    [CmapSymbol.tlcorn, '\u00c9'], [CmapSymbol.trcorn, '\u00bb'],
    [CmapSymbol.blcorn, '\u00c8'], [CmapSymbol.brcorn, '\u00bc'],
    [CmapSymbol.crwall, '\u00ce'], [CmapSymbol.tuwall, '\u00ca'],
    [CmapSymbol.tdwall, '\u00cb'], [CmapSymbol.tlwall, '\u00b9'], [CmapSymbol.trwall, '\u00cc'],
    [CmapSymbol.ndoor, '\u00ce'], [CmapSymbol.vodoor, '\u00ce'], [CmapSymbol.hodoor, '\u00ce'],
    [CmapSymbol.room, '\u00fa'], [CmapSymbol.corr, '\u00b1'], [CmapSymbol.litcorr, '\u00b2'],
    [CmapSymbol.engrcorr, '\u00b1'],
    [CmapSymbol.upstair, '\u00f0'], [CmapSymbol.dnstair, '\u00f0'],
    [CmapSymbol.brupstair, '\u00f0'], [CmapSymbol.brdnstair, '\u00f0'],
]);

// The three IBMgraphics sets share these S_ entries; their doorway,
// corridor and floor replacements differ in dat/symbols.
const IBM_COMMON_SYMBOLS: ReadonlyMap<number, string> = new Map([
    [CmapSymbol.vwall, '\xb3'], [CmapSymbol.hwall, '\xc4'],
    [CmapSymbol.tlcorn, '\xda'], [CmapSymbol.trcorn, '\xbf'],
    [CmapSymbol.blcorn, '\xc0'], [CmapSymbol.brcorn, '\xd9'],
    [CmapSymbol.crwall, '\xc5'], [CmapSymbol.tuwall, '\xc1'],
    [CmapSymbol.tdwall, '\xc2'], [CmapSymbol.tlwall, '\xb4'], [CmapSymbol.trwall, '\xc3'],
    [CmapSymbol.engroom, '\xee'],
    [CmapSymbol.vbeam, '\xb3'], [CmapSymbol.hbeam, '\xc4'],
    [CmapSymbol.swallowTopLeft + 3, '\xb3'], [CmapSymbol.swallowTopLeft + 4, '\xb3'],
    [CmapSymbol.explosionTopLeft + 3, '\xb3'], [CmapSymbol.explosionTopLeft + 5, '\xb3'],
]);

export const ROGUE_SYMSETS: Readonly<Record<string, RogueSymsetSymbols>> = {
    plain: { cmap: new Map([
        [CmapSymbol.tlcorn, '+'], [CmapSymbol.trcorn, '+'],
        [CmapSymbol.blcorn, '+'], [CmapSymbol.brcorn, '+'],
        [CmapSymbol.crwall, '+'], [CmapSymbol.tuwall, '+'],
        [CmapSymbol.tdwall, '+'], [CmapSymbol.tlwall, '+'], [CmapSymbol.trwall, '+'],
    ]) },
    blank: { blank: true },
    ibmgraphics: {
        ibm: true,
        cmap: new Map([...IBM_COMMON_SYMBOLS,
            [CmapSymbol.ndoor, '\xfa'], [CmapSymbol.vodoor, '\xfe'], [CmapSymbol.hodoor, '\xfe'],
            [CmapSymbol.bars, '\xf0'], [CmapSymbol.tree, '\xf1'], [CmapSymbol.room, '\xfa'],
            [CmapSymbol.corr, '\xb0'], [CmapSymbol.litcorr, '\xb1'], [CmapSymbol.engrcorr, '\xb0'],
            [CmapSymbol.fountain, '\xf4'], [CmapSymbol.sink, '\xf4'],
            [CmapSymbol.pool, '\xf7'], [CmapSymbol.ice, '\xfa'],
            [CmapSymbol.lava, '\xf7'], [CmapSymbol.lavawall, '\xf7'],
            [CmapSymbol.vodbridge, '\xfa'], [CmapSymbol.hodbridge, '\xfa'], [CmapSymbol.water, '\xf7'],
        ]),
    },
    ibmgraphics_1: { ibm: true, cmap: IBM_COMMON_SYMBOLS },
    ibmgraphics_2: {
        ibm: true,
        cmap: new Map([...IBM_COMMON_SYMBOLS,
            [CmapSymbol.vodoor, '\xfe'], [CmapSymbol.hodoor, '\xfe'],
            [CmapSymbol.corr, '\xb0'], [CmapSymbol.litcorr, '\xb1'], [CmapSymbol.engrcorr, '\xb0'],
        ]),
    },
    amigafont: { cmap: new Map([
        [CmapSymbol.stone, ' '], [CmapSymbol.vwall, '\xc0'], [CmapSymbol.hwall, '\xc1'],
        [CmapSymbol.tlcorn, '\xc2'], [CmapSymbol.trcorn, '\xc3'],
        [CmapSymbol.blcorn, '\xc4'], [CmapSymbol.brcorn, '\xc5'], [CmapSymbol.crwall, '\xc6'],
        [CmapSymbol.tuwall, '\xd8'], [CmapSymbol.tdwall, '\xd6'],
        [CmapSymbol.tlwall, '\xd7'], [CmapSymbol.trwall, '\xd5'],
        [CmapSymbol.ndoor, '\xd9'], [CmapSymbol.vodoor, '\x91'], [CmapSymbol.hodoor, '\x92'],
        [CmapSymbol.vcdoor, '\x93'], [CmapSymbol.hcdoor, '\x94'],
        [CmapSymbol.bars, '#'], [CmapSymbol.tree, '#'], [CmapSymbol.room, '.'], [CmapSymbol.darkroom, ' '],
        [CmapSymbol.corr, '\xe5'], [CmapSymbol.litcorr, '\xe5'],
        [CmapSymbol.upstair, '<'], [CmapSymbol.dnstair, '>'],
        [CmapSymbol.upladder, '<'], [CmapSymbol.dnladder, '>'], [CmapSymbol.altar, '_'],
        [CmapSymbol.grave, '\\'], [CmapSymbol.throne, '#'], [CmapSymbol.sink, '{'], [CmapSymbol.fountain, '}'],
        [CmapSymbol.pool, '*'], [CmapSymbol.ice, '}'], [CmapSymbol.lava, '*'],
        [CmapSymbol.vodbridge, '*'], [CmapSymbol.hodbridge, '#'],
        [CmapSymbol.vcdbridge, '#'], [CmapSymbol.hcdbridge, '.'], [CmapSymbol.air, '#'], [CmapSymbol.cloud, '}'],
        [CmapSymbol.vbeam, '\xf1'], [CmapSymbol.hbeam, '\xf0'],
        [CmapSymbol.lslant, '\xf2'], [CmapSymbol.rslant, '\xf3'],
        [CmapSymbol.digbeam, '*'], [CmapSymbol.flashbeam, '!'],
        [CmapSymbol.boomleft, '{'], [CmapSymbol.boomright, '}'],
        ...['@', '&', '*', '#'].map((ch, index): [number, string] => [CmapSymbol.shieldFirst + index, ch]),
        ...['\xf4', '\xf5', '\xf6', '\xf7', '\xef', '\xf8', '\xf9', '\xfa']
            .map((ch, index): [number, string] => [CmapSymbol.swallowTopLeft + index, ch]),
        ...['\xe6', '\xea', '\xe7', '\xec', '\xd4', '\xed', '\xe8', '\xeb', '\xe9']
            .map((ch, index): [number, string] => [CmapSymbol.explosionTopLeft + index, ch]),
    ]) },
    rogueibm: {
        ibm: true,
        cmap: ROGUE_DOUBLE_WALLS,
        objectClasses: {
            [WEAPON_CLASS]: ')', [AMULET_CLASS]: ',', [FOOD_CLASS]: ':',
            [POTION_CLASS]: '\u00ad', [SCROLL_CLASS]: '?', [SPBOOK_CLASS]: '+',
            [WAND_CLASS]: '\u00e7',
        },
    },
    rogueepyx: {
        ibm: true,
        cmap: new Map([...ROGUE_DOUBLE_WALLS, [CmapSymbol.engroom, '\u00ee']]),
        objectClasses: {
            [WEAPON_CLASS]: '\x18', [ARMOR_CLASS]: '[', [RING_CLASS]: '=',
            [AMULET_CLASS]: '\x0c', [TOOL_CLASS]: '(', [FOOD_CLASS]: '\x05',
            [POTION_CLASS]: '\u00ad', [SCROLL_CLASS]: '\x0e', [SPBOOK_CLASS]: '+',
            [WAND_CLASS]: '\u00e7', [COIN_CLASS]: '\x0f', [GEM_CLASS]: '\x0f',
            [ROCK_CLASS]: '`', [BALL_CLASS]: '0', [CHAIN_CLASS]: '_',
            [VENOM_CLASS]: '.',
        },
        trapSymbol: '\x04',
        humanSymbol: '\x01',
        color: true,
    },
    roguewindows: {
        ibm: true,
        cmap: new Map([...ROGUE_DOUBLE_WALLS, [CmapSymbol.engroom, '\u00ee']]),
        objectClasses: {
            [WEAPON_CLASS]: ')', [AMULET_CLASS]: ',', [FOOD_CLASS]: ':',
            [POTION_CLASS]: '\u00ad', [SCROLL_CLASS]: '?', [SPBOOK_CLASS]: '+',
            [WAND_CLASS]: '\u00e7',
        },
    },
};

// The Blank set's \032 entries are decimal (options.c escapes()), so the
// blank glyph is a space, not C-style octal 0x1a.
export const BLANK_SYMBOL = ' ';

// Port only: the named Rogue symbol set (C's loaded rogue showsyms).
export function activeRogueSymset(state: GameState = game): RogueSymsetSymbols | null {
    const shown = shownSymbolSet(state);
    if (!shown.rogue || !shown.name) return null;
    return ROGUE_SYMSETS[shown.name.toLowerCase()] ?? null;
}
