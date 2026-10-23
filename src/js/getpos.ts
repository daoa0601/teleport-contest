// C refs: getpos.c:getpos(), drawing.c:defsyms[], symbols.c:gs.showsyms[],
// display.c:tmp_at() for the valid-location marking overlay.

import {
    COLNO, D_ISOPEN, DOOR, GFILTER_NONE, GFILTER_VIEW, HI_ZAP, LOOK_ONCE, LOOK_QUICK,
    LOOK_TRADITIONAL, LOOK_VERBOSE, NHW_MENU, PICK_ONE, ROWNO, SCORR, STONE, VIBRATING_SQUARE, WEB, IS_WALL, TREE,
} from './const.js';
import {
    clearMessageWindow, flush_screen, glyphAt, lastDirtyMapCursor,
    newsym_force, pline, plineWithContinuation, show_glyph_cell, showUnrememberedTopline,
    terrain_glyph,
} from './display.js';
import { game } from './gstate.js';
import { nhgetch, readchar } from './input.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { MONSTER_NAME } from './monster_data.js';
import { BOULDER, ROCK } from './object_data.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from './glyph_numbers.js';
import { TemporaryMapEffect } from './temporary_map_effect.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { NO_COLOR } from './terminal.js';
import { cansee } from './vision.js';
import { coordinateDescription } from './pager_lists.js';
import { screenDescription } from './pager_description.js';
import { farlookLocationDescription } from './cmd.js';
import {
    tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu,
    tty_select_menu, tty_start_menu,
} from './tty_menu.js';
import type { GameState } from './game_state.js';
import type { Position } from './map_types.js';
import { rememberCommandKey, takeRepeatCommand } from './command_repeat.js';
import { visibleCommandKey } from './command_keys.js';

export type MapPositionPickType = typeof LOOK_TRADITIONAL | typeof LOOK_QUICK
    | typeof LOOK_ONCE | typeof LOOK_VERBOSE;
export type PositionDescription = (x: number, y: number) => string | null | undefined | Promise<string | null | undefined>;
export type ValidLocation = (x: number, y: number) => boolean;
export interface MapPositionSelection extends Position {
    pickType: MapPositionPickType;
}
export interface MapPositionOptions {
    start: Position;
    prompt: string;
    goal: string;
    describe?: PositionDescription | null;
    afterPaint?: ((cursor: Position, firstPaint: boolean) => void | Promise<void>) | null;
    isValidLocation?: ValidLocation | null;
    // Jump, spell, and cloud targeting admit the hero but omit its '$' overlay.
    highlightHero?: boolean;
    force?: boolean;
}

interface LocationCycle {
    spots: Position[];
    index: number;
}
type MapPositionHilite = 'normal' | 'symbols' | 'background';
type GetposCycleKind = 'mon' | 'obj' | 'door' | 'unexplored' | 'all' | 'valid';

// defsym.h S_goodpos: the dollar sign doubles as the default getpos key
// which toggles valid-position marking, so the mark glyph shares it.
const GOODPOS_CH = '$';

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
// additional input bytes introduced by the DEC set. The high bit belongs to
// showsyms: an ordinary letter such as 's' is not the bottom-edge glyph.
const DEC_GETPOS_FEATURE_SYMBOLS = new Set([
    '\xe7', '\xf9', '\xfa', '\xfb', '\xe0', '\xfe',
    '\xf8', '\xf1', '\xef', '\xf3', '\xfc',
]);

export function isGetposFeatureSymbol(ch: string, symset: string | null | undefined = ''): boolean {
    if (typeof ch !== 'string' || ch.length !== 1) return false;
    if (DEFAULT_GETPOS_FEATURE_SYMBOLS.has(ch)) return true;
    return /^DECgraphics$/i.test(symset ?? '')
        && DEC_GETPOS_FEATURE_SYMBOLS.has(ch);
}

// A diagonal which crosses a map edge loses the same amount of movement on
// its other axis.  Clamping each axis separately would slide along the edge.
export function moveGetposCursor(cursor: Position, dx: number, dy: number): void {
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

export function shouldShowGetposTip(state = game) {
    return state.flags?.tips !== false && !state._travelTipShown;
}

// C hack.c:handle_tip(). Dismissing the tip does not cancel map selection.
export async function showGetposTip(state = game) {
    if (!shouldShowGetposTip(state)) return false;
    state._travelTipShown = true;
    await currentLuaLifecycle().callCore(state, 'getpos_tip');
    return true;
}

// getpos() prints a separate pline; tty decides whether it fits after the caller's message.
export async function showGetposInstructions(state: GameState = game): Promise<void> {
    if (!state.flags.verbose) return;
    const helpKey = state.commandBindings.specialKey('getpos.help');
    if (helpKey === undefined) throw new Error('Map selection requires a getpos.help binding');
    await plineWithContinuation(`(For instructions type a '${visibleCommandKey(helpKey)}')`);
}

// C uses cmap identities, not the terminal character of a remembered glyph.
// In particular, DEC's pi altar must still match the default '_' key.
const DEC_FEATURE_SYMBOLS = new Map<number, string>([
    [CmapSymbol.bars, '\xfc'], [CmapSymbol.tree, '\xe7'],
    [CmapSymbol.upladder, '\xf9'], [CmapSymbol.dnladder, '\xfa'],
    [CmapSymbol.brupladder, '\xf9'], [CmapSymbol.brdnladder, '\xfa'],
    [CmapSymbol.altar, '\xfb'], [CmapSymbol.pool, '\xe0'],
    [CmapSymbol.ice, '\xfe'], [CmapSymbol.lava, '\xe0'],
    [CmapSymbol.lavawall, '\xe0'], [CmapSymbol.vodbridge, '\xfe'],
    [CmapSymbol.hodbridge, '\xfe'], [CmapSymbol.water, '\xe0'],
    [74, '\xf8'], [75, '\xf1'],
]);
const EFFECT_FEATURE_SYMBOLS = ['|', '-', '\\', '/', '*', '!', ')', '(', '0', '#', '@', '*', '#', '$'];

function matchingGetposSymbols(key: string, state: GameState): ReadonlySet<number> {
    const matching = new Set<number>();
    const dec = /^DECgraphics$/i.test(state.symset ?? '');
    for (let index = CmapSymbol.bars; index <= CmapSymbol.goodpos; index++) {
        if (index === CmapSymbol.room || index === CmapSymbol.darkroom
            || index === CmapSymbol.corr || index === CmapSymbol.litcorr) continue;
        const trap = index >= CmapSymbol.arrowTrap && index < 74;
        const defaultSymbol = MAP_SYMBOLS[index]?.ch ?? (trap
            ? index === CmapSymbol.arrowTrap + WEB - 1 ? '"'
                : index === CmapSymbol.arrowTrap + VIBRATING_SQUARE - 1 ? '~' : '^'
            : EFFECT_FEATURE_SYMBOLS[index - 74]);
        const activeSymbol = dec ? DEC_FEATURE_SYMBOLS.get(index) ?? defaultSymbol : defaultSymbol;
        if (key === defaultSymbol || key === activeSymbol || key === '^' && trap
            || key === '`' && (index === CmapSymbol.engroom || index === CmapSymbol.engrcorr))
            matching.add(index);
    }
    return matching;
}

// C glyphs.c:glyph_to_cmap(), restricted to the eligible getpos features.
function getposGlyphSymbol(glyph: number | undefined): number | null {
    if (glyph === undefined) return null;
    if (glyph >= GlyphOffset.cmapA && glyph < GlyphOffset.altar)
        return glyph - GlyphOffset.cmapA + CmapSymbol.ndoor;
    if (glyph >= GlyphOffset.altar && glyph < GlyphOffset.cmapB) return CmapSymbol.altar;
    if (glyph >= GlyphOffset.cmapB && glyph < GlyphOffset.zap)
        return glyph - GlyphOffset.cmapB + CmapSymbol.grave;
    if (glyph >= GlyphOffset.zap && glyph < GlyphOffset.cmapC)
        return (glyph - GlyphOffset.zap) % 4 + 74;
    if (glyph >= GlyphOffset.cmapC && glyph < GlyphOffset.swallow)
        return glyph - GlyphOffset.cmapC + CmapSymbol.digbeam;
    return null;
}

function getposFeatureMatches(
    x: number, y: number, key: string, matching: ReadonlySet<number>, state: GameState,
): boolean {
    const loc = state.level?.at?.(x, y);
    if (!loc) return false;
    const current = getposGlyphSymbol(glyphAt(x, y, state)?.glyph);
    if (current !== null && matching.has(current)) return true;
    if (state.level?.flags.hero_memory !== false && !state.iflags.terrainmode) {
        const remembered = getposGlyphSymbol(loc.remembered_glyph?.glyph);
        if (remembered !== null && matching.has(remembered)) return true;
    }
    if (key === '~' && state.level?.traps.some(trap =>
        trap.tx === x && trap.ty === y && trap.ttyp === VIBRATING_SQUARE && trap.tseen))
        return true;
    if (loc.seenv) {
        const background = getposGlyphSymbol(terrain_glyph(loc, x, y).glyph);
        if (background !== null && matching.has(background)) return true;
    }
    return false;
}

// Search from the cursor to the bottom-right of the map, then wrap around.
export function nextGetposFeature(cursor: Position, symbol: string, state: GameState = game): Position | null {
    const matching = matchingGetposSymbols(symbol, state);
    for (let pass = 0; pass <= 1; pass++) {
        const lowY = pass === 0 ? cursor.y : 0;
        const highY = pass === 0 ? ROWNO - 1 : cursor.y;
        for (let y = lowY; y <= highY; y++) {
            const lowX = pass === 0 && y === lowY ? cursor.x + 1 : 1;
            const highX = pass === 1 && y === highY
                ? cursor.x : COLNO - 1;
            for (let x = lowX; x <= highX; x++) {
                if (getposFeatureMatches(x, y, symbol, matching, state))
                    return { x, y };
            }
        }
    }
    return null;
}

export function getposFeatureMissMessage(ch: string, state: GameState = game): string {
    const code = ch.codePointAt(0);
    const visible = code !== undefined && code < 32
        ? `^${String.fromCharCode(code + 64)}`
        : code === 127 ? '^?' : ch;
    return isGetposFeatureSymbol(ch, state.symset)
        ? `Can't find dungeon feature '${visible}'.`
        : `Unknown direction: '${visible}' (use 'h', 'j', 'k', 'l' or '.').`;
}

function mapPositionPickType(code: number): MapPositionPickType | null {
    const choices: readonly (readonly [string, MapPositionPickType])[] = [
        ['getpos.pick', LOOK_TRADITIONAL], ['getpos.pick.quick', LOOK_QUICK],
        ['getpos.pick.once', LOOK_ONCE], ['getpos.pick.verbose', LOOK_VERBOSE],
    ];
    return choices.find(([name]) => game.commandBindings.specialKey(name) === code)?.[1] ?? null;
}

export function isGetposPickCharacter(ch: string): boolean {
    return mapPositionPickType(ch.charCodeAt(0)) !== null;
}

// getpos() flushes the existing glyph buffer. Recalculating sight here would
// discover warnings or erase unseen-monster memory in the middle of a turn.
export async function paintGetposCursor(cursor: Position, message: string, markedSpots: readonly Position[] | null = null): Promise<TemporaryMapEffect | null> {
    game._pending_message = message;
    // display.c:tmp_at() with DISP_BEAM shows the glyph only on squares the
    // hero can see, so a validity rule that admits unseen squares (polearm
    // couldsee+glyph policy) still cannot reveal them.
    const markers = markedSpots ? new TemporaryMapEffect('beam', {
        ch: GOODPOS_CH, color: HI_ZAP, decgfx: false, kind: 'effect',
        glyph: cmapToGlyph(CmapSymbol.goodpos),
    }) : null;
    if (markers && markedSpots) {
        await markers.start();
        for (const { x, y } of markedSpots)
            await markers.show(x, y);
    }
    // C getpos() only flushes, so a status change nothing marked for
    // redisplay stays unpainted.
    await flush_screen(1);
    if (message) showUnrememberedTopline(message);
    game.nhDisplay?.setCursor(cursor.x - 1, cursor.y + 1);
    return markers;
}

// C getpos.c:getpos_help() draws this menu over the right side of the map.
export async function getposHelpUntilDismissed(
    goal: string, { hasValidLocations = false }: { hasValidLocations?: boolean } = {},
) {
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
    ];
    if (hasValidLocations) {
        // getpos_help() adds these only while a getvalid rule and a hilite
        // callback are installed (getpos_sethilite() callers).
        const keyLabel = (name: string) => {
            const key = game.commandBindings.specialKey(name);
            if (key === undefined) throw new Error(`Map selection requires a ${name} binding`);
            return visibleCommandKey(key);
        };
        lines.push(`Use '${keyLabel('getpos.valid.next')}' or '${keyLabel('getpos.valid.prev')}' to move to valid locations.`);
        lines.push(`Use '${keyLabel('getpos.valid')}' to toggle marking of valid locations.`);
    }
    lines.push(
        "Use '#' to toggle automatic description.",
        "Type a '.' when you are at the right place.",
        '',
    );

    game._pending_message = '';
    display?.clearRow(0);
    for (let row = 1; row <= lines.length; row++) {
        for (let col = left - 1; col < (display?.cols ?? 80); col++)
            display?.setCell(col, row, ' ', NO_COLOR, 0);
    }
    for (const [row, line] of lines.entries()) {
        for (let col = 0; col < line.length; col++)
            display?.setCell(left + col, row, line.charAt(col), NO_COLOR, 0);
    }
    const more = '--More--';
    for (let col = 0; col < more.length; col++)
        display?.setCell(left + col, lines.length, more.charAt(col), NO_COLOR, 0);
    display?.setCursor(left + more.length, lines.length);

    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    return key;
}

async function describeSelectedPosition(describe: PositionDescription | null | undefined, cursor: Position, fallback: string): Promise<string> {
    return await describe?.(cursor.x, cursor.y) || fallback;
}

async function selectGetposMenu(spots: readonly Position[], kind: GetposCycleKind): Promise<Position | null> {
    const names = { mon: 'monster', obj: 'item', door: 'door', unexplored: 'unexplored area', all: 'interesting thing', valid: 'valid location' };
    const name = names[kind];
    const article = ['item', 'unexplored area', 'interesting thing'].includes(name) ? 'an' : 'a';
    const filter = game.iflags.getloc_filter === 1 ? ' in view' : game.iflags.getloc_filter === 2 ? ' in this area' : '';
    const window = tty_create_nhwindow<Position>(NHW_MENU);
    try {
        await tty_start_menu(window);
        for (const spot of spots) {
            const text = await describeMenuPosition(spot);
            if (text === null) continue;
            const coordinates = coordinateDescription(spot.x, spot.y, game.iflags.getpos_coords ?? 'n');
            tty_add_menu(window, { identifier: spot,
                text: text + (coordinates ? ` ${coordinates}` : '') });
        }
        // getpos_menu() supplies an end_menu prompt, so the tty owner applies
        // the configured prompt attributes and color while items stay plain.
        tty_end_menu(window, `Pick ${article} ${name}${filter}`);
        const result = await tty_select_menu(window, PICK_ONE);
        if (result.cancelled) return null;
        return result.selections[0]?.identifier ?? null;
    } finally {
        await tty_destroy_nhwindow(window);
    }
}

// getpos_menu() describes the displayed glyph even when the caller only
// supplied a validity rule, such as spell or polearm targeting.
async function describeMenuPosition({ x, y }: Position): Promise<string | null> {
    const screen = screenDescription(x, y, '');
    if (!screen.count) return null;
    return screen.needsDetail
        ? await farlookLocationDescription(x, y) || screen.firstMatch : screen.firstMatch;
}

export async function describeGetposLocation(x: number, y: number): Promise<string | null> {
    const description = await describeMenuPosition({ x, y });
    if (!description) return null;
    const coordinates = coordinateDescription(x, y, game.iflags.getpos_coords ?? 'n');
    return description + (coordinates ? ` ${coordinates}` : '');
}

// selection_force_newsyms() redraws by column, then row. Hallucinated glyphs
// consume display randomness in that order, independently of target cycling.
function validMapSquares(isValidLocation: ValidLocation): Position[] {
    const spots = [];
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            if (isValidLocation(x, y)) spots.push({ x, y });
        }
    }
    return spots;
}

// C getpos.c:gather_locs()/gather_locs_interesting() with GLOC_VALID minus
// the hero injection: predicate-true squares ordered by cmp_coord_distu()
// (Chebyshev distance from the hero, then row, then column).  Unseen
// squares stay eligible for cycling; only the '$' marking is gated.
function gatherValidLocations(isValidLocation: ValidLocation, state: GameState = game): Position[] {
    const ux = state.u.ux, uy = state.u.uy;
    const inArea = getposArea(state);
    const spots = validMapSquares((x, y) => isValidLocation(x, y)
        && (state.iflags.getloc_filter !== 1 || cansee(x, y))
        && (state.iflags.getloc_filter !== 2 || [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]
            .some(([dx = 0, dy = 0]) => inArea.has((y + dy) * COLNO + x + dx))));
    spots.sort((a, b) => {
        const distA = Math.max(Math.abs(ux - a.x), Math.abs(uy - a.y));
        const distB = Math.max(Math.abs(ux - b.x), Math.abs(uy - b.y));
        if (distA !== distB) return distA - distB;
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
    });
    return spots;
}

// C gloc_filter_init()/gloc_filter_floodfill(): target areas follow known
// terrain classes. From a doorway, use the side of the last movement.
function getposArea(state: GameState): ReadonlySet<number> {
    const area = new Set<number>();
    if (state.iflags.getloc_filter !== 2) return area;
    let x = state.u.ux, y = state.u.uy;
    if (state.level?.at(x, y)?.typ === DOOR) {
        if (!state.u.dx && !state.u.dy) return area;
        x += state.u.dx ?? 0;
        y += state.u.dy ?? 0;
    }
    const classify = (tx: number, ty: number): number | null => {
        const location = state.level?.at(tx, ty);
        if (!location?.seenv || tx < 1 || tx >= COLNO || ty < 0 || ty >= ROWNO) return null;
        if (location.typ === STONE || location.typ === SCORR || IS_WALL(location.typ) || location.typ === TREE) return 2;
        const symbol = getposGlyphSymbol(terrain_glyph(location, tx, ty).glyph);
        if (symbol === null) return 0;
        if (symbol >= CmapSymbol.room && symbol <= CmapSymbol.darkroom
            || symbol >= CmapSymbol.upstair && symbol <= CmapSymbol.fountain) return 1;
        if (symbol >= CmapSymbol.vwall && symbol <= CmapSymbol.trwall || symbol === CmapSymbol.tree) return 2;
        if (symbol === CmapSymbol.corr || symbol === CmapSymbol.litcorr) return 3;
        if (symbol === CmapSymbol.pool || symbol === CmapSymbol.water) return 4;
        if (symbol === CmapSymbol.lava || symbol === CmapSymbol.lavawall) return 5;
        return 0;
    };
    const category = classify(x, y);
    if (category === null) return area;
    const pending = [{ x, y }];
    for (let index = 0; index < pending.length; index++) {
        const spot = pending[index];
        if (!spot || classify(spot.x, spot.y) !== category) continue;
        const key = spot.y * COLNO + spot.x;
        if (area.has(key)) continue;
        area.add(key);
        pending.push({ x: spot.x - 1, y: spot.y }, { x: spot.x + 1, y: spot.y },
            { x: spot.x, y: spot.y - 1 }, { x: spot.x, y: spot.y + 1 });
    }
    return area;
}

// C getpos.c:getpos_sethilite(). Install after the caller's question and
// before getpos's tutorial or instructions can flush these forced redraws.
export function prepareMapPositionHighlights(isValidLocation: ValidLocation): void {
    setMapPositionHighlights(isValidLocation, game.iflags.bgcolors !== false);
}

function setMapPositionHighlights(isValidLocation: ValidLocation | null, background: boolean): void {
    const previous = game._mapPositionHighlight;
    if (isValidLocation) game._mapPositionHighlight = { isValidLocation, background };
    else delete game._mapPositionHighlight;
    if (previous?.isValidLocation === isValidLocation && previous.background === background) return;
    // getpos_sethilite() redraws the union of the old and new selections,
    // once per square, when the rule or background color changes.
    for (const { x, y } of validMapSquares((x, y) =>
        !!previous?.isValidLocation(x, y) || !!isValidLocation?.(x, y))) newsym_force(x, y);
}

function getposCycleKind(key: number): { kind: GetposCycleKind; step: -1 | 1 } | null {
    const kinds: readonly GetposCycleKind[] = ['mon', 'obj', 'door', 'unexplored', 'all', 'valid'];
    for (const kind of kinds) {
        if (key === game.commandBindings.specialKey(`getpos.${kind}.next`))
            return { kind, step: 1 };
        if (key === game.commandBindings.specialKey(`getpos.${kind}.prev`))
            return { kind, step: -1 };
    }
    return null;
}

function matchesGetposCycle(kind: Exclude<GetposCycleKind, 'valid'>, x: number, y: number): boolean {
    const glyph = glyphAt(x, y);
    if (kind === 'mon') return glyph?.kind === 'monster'
        && glyph.mnum !== MONSTER_NAME.indexOf('long worm tail');
    if (kind === 'obj') return glyph?.kind === 'object'
        && glyph.glyph !== GlyphOffset.object + BOULDER && glyph.glyph !== GlyphOffset.object + ROCK;
    const terrain = glyph?.kind === 'terrain' ? glyph.terrainName : null;
    const door = terrain && (terrain.includes('door') || terrain.includes('drawbridge'));
    if (kind === 'door') return !!door;
    if (kind === 'unexplored') {
        const floor = door || (terrain !== null && ['floor of a room', 'dark part of a room', 'corridor', 'lit corridor'].includes(terrain));
        const offsets: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        return !!floor && offsets.some(([dx, dy]) => {
            const adjacent = game.level?.at(x + dx, y + dy);
            return !!adjacent && !adjacent.seenv && (!adjacent.remembered_glyph
                || adjacent.remembered_glyph.kind === 'unexplored');
        });
    }
    if (door) return true;
    if (!glyph || ['nothing', 'unexplored'].includes(glyph.kind)) return false;
    return terrain === null || !['wall', 'stone', 'tree', 'iron bars', 'ice', 'air', 'cloud',
        'water', 'molten lava', 'wall of lava', 'floor of a room',
        'dark part of a room', 'corridor', 'lit corridor'].includes(terrain);
}

// C getpos.c:getpos_menu(GLOC_INTERESTING), with GFILTER_VIEW for travel.
export async function selectTravelMenuPosition(describe: PositionDescription): Promise<Position | null> {
    // cmd.c:dotravel() uses GFILTER_VIEW only for this menu, then restores
    // the player's target filter even when no destination is selected.
    const previousFilter = game.iflags.getloc_filter ?? GFILTER_NONE;
    game.iflags.getloc_filter = GFILTER_VIEW;
    try {
        const hero = game.u;
        const spots = gatherValidLocations((x, y) => (x !== hero.ux || y !== hero.uy)
            && cansee(x, y) && matchesGetposCycle('all', x, y));
        if (!spots.length) {
            await pline('You cannot see anything interesting.');
            return null;
        }
        const window = tty_create_nhwindow<Position>(NHW_MENU);
        await tty_start_menu(window);
        for (const spot of spots) {
            const description = await describe(spot.x, spot.y);
            if (!description) continue;
            const coordinates = coordinateDescription(spot.x, spot.y, game.iflags.getpos_coords ?? 'n');
            tty_add_menu(window, { identifier: spot,
                text: description + (coordinates ? ` ${coordinates}` : '') });
        }
        tty_end_menu(window, 'Pick an interesting thing in view for travel destination');
        const result = await tty_select_menu(window, PICK_ONE);
        await tty_destroy_nhwindow(window);
        return result.selections[0]?.identifier ?? null;
    } finally {
        game.iflags.getloc_filter = previousFilter;
    }
}

export async function selectMapPosition({
    start,
    prompt,
    goal,
    describe,
    afterPaint = null,
    isValidLocation = null,
    highlightHero = true,
    force = true,
}: MapPositionOptions): Promise<MapPositionSelection | null> {
    const cursor = { ...start };
    const savedDirection = { dx: game.u.dx, dy: game.u.dy, dz: game.u.dz };
    const movePrompt = `Move cursor to ${goal}:`;
    let message = prompt;
    let firstPaint = true;
    // Native msg_given clears prompts at exit, but leaves automatic
    // descriptions visible after the player has read them.
    let clearMessageOnExit = true;
    // garr[GLOC_VALID]/gidx and the hilite state live inside C getpos();
    // getpos_sethilite(NULL, NULL) resets them at its exit.
    const validity: { cycle: LocationCycle | null } = { cycle: null };
    const defaultHilite = game.iflags.bgcolors !== false ? 'background' : 'normal';
    const hilite: { state: MapPositionHilite } = { state: defaultHilite };
    let marking: TemporaryMapEffect | null = null;
    const clearMarking = () => {
        marking?.clear();
        marking = null;
    };
    const setHilite = (next: MapPositionHilite) => {
        hilite.state = next;
        setMapPositionHighlights(isValidLocation, hilite.state === 'background');
    };
    const refreshHilite = () => {
        if (hilite.state === 'symbols') {
            clearMarking();
            setHilite(defaultHilite);
        }
    };
    const targetCycles = new Map<GetposCycleKind, LocationCycle>();
    const autoDescription = (): boolean => game.iflags.autodescribe ?? true;
    // Without autodescribe, nxtc leaves whatever the message window shows.
    const movementMessage = async (): Promise<string> => autoDescription()
        ? await describeSelectedPosition(describe, cursor, movePrompt) : message;

    const validLocations = (): LocationCycle => {
        if (!validity.cycle) {
            if (!isValidLocation) throw new Error('Valid-location selection requires a location predicate');
            const spots = gatherValidLocations(isValidLocation);
            const atHero = ({ x, y }: Position) => x === game.u.ux && y === game.u.uy;
            validity.cycle = {
                // gather_locs() injects the hero square so the cycle is
                // never empty and wraps visibly back to the hero.
                spots: spots.some(atHero)
                    ? spots : [{ x: game.u.ux, y: game.u.uy }, ...spots],
                index: 0,
            };
        }
        return validity.cycle;
    };

    try {
        if (isValidLocation) setMapPositionHighlights(isValidLocation, hilite.state === 'background');
        const initialMapCursor = isValidLocation && !game.flags.verbose
            ? lastDirtyMapCursor() : null;
        for (;;) {
            // The symbol callback runs only when entering that state. Cursor
            // movement keeps its temporary glyphs until a toggle or refresh.
            const paintedSpots = isValidLocation && hilite.state === 'symbols' && !marking
                ? validMapSquares(isValidLocation).filter(({ x, y }) => cansee(x, y)
                    && (highlightHero || x !== game.u.ux || y !== game.u.uy))
                : null;
            const painted = await paintGetposCursor(cursor, message, paintedSpots);
            if (painted) marking = painted;
            if (firstPaint && initialMapCursor) game.nhDisplay?.setCursor(...initialMapCursor);
            if (afterPaint) await afterPaint(cursor, firstPaint);
            firstPaint = false;

            const queued = takeRepeatCommand();
            if (queued && queued.kind !== 'key') return null;
            let key = queued ? queued.key : (await readchar('position')) & 255;
            if (!queued && game.iflags.remember_getpos) rememberCommandKey(key);
            if (autoDescription()) clearMessageOnExit = false;
            let fast = false;
            if (key === game.commandBindings.keyForCommand('run')
                || key === game.commandBindings.keyForCommand('rush')) {
                key = (await readchar('position')) & 255;
                fast = true;
            }
            const ch = String.fromCharCode(key);
            if (key === 27) {
                clearMessageOnExit = true;
                return null;
            }
            const pickType = mapPositionPickType(key);
            if (pickType !== null) return { ...cursor, pickType };
            const movement = game.commandBindings.movementForKey(key);
            if (movement && movement.direction < 8) {
                game.u.dx = movement.dx;
                game.u.dy = movement.dy;
                const fastMove = fast || movement.mode !== 0;
                let distance = fastMove ? 8 : 1;
                if (fastMove && game.iflags.getloc_moveskip) {
                    const glyph = glyphAt(cursor.x, cursor.y)?.glyph;
                    distance = 1;
                    const sameTerrain = (step: number) => {
                        const x = cursor.x + movement.dx * step, y = cursor.y + movement.dy * step;
                        return x >= 1 && x < COLNO && y >= 0 && y < ROWNO
                            && glyphAt(x, y)?.glyph === glyph;
                    };
                    while (sameTerrain(distance) && sameTerrain(distance + 1)) distance++;
                }
                moveGetposCursor(cursor, movement.dx * distance, movement.dy * distance);
                message = await movementMessage();
                continue;
            }

            const helpRequested = key === game.commandBindings.specialKey('getpos.help');
            if (helpRequested || game.commandBindings.lookup(key)?.command?.handler === 'doredraw') {
                // Help takes priority when its key is also bound to redraw.
                if (helpRequested) {
                    await getposHelpUntilDismissed(goal, {
                        hasValidLocations: !!isValidLocation,
                    });
                }
                refreshHilite();
                message = movePrompt;
                continue;
            }
            if (!force && [' ', '\n', '\r'].includes(ch)) {
                await pline('Done.');
                clearMessageOnExit = false;
                return null;
            }
            if (ch === ' ') {
                message = await movementMessage();
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.valid')) {
                if (isValidLocation) {
                    switch (hilite.state) {
                    case 'normal':
                        setHilite('symbols');
                        break;
                    case 'symbols':
                        clearMarking();
                        setHilite(defaultHilite);
                        break;
                    case 'background':
                        setHilite('normal');
                        break;
                    }
                }
                message = movePrompt;
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.autodescribe')) {
                game.iflags.autodescribe = !autoDescription();
                clearMessageOnExit = true;
                message = `Automatic description ${game.flags.verbose ? 'of features under cursor ' : ''}is ${autoDescription() ? 'on' : 'off'}.`;
                if (!autoDescription()) {
                    await pline(message);
                    await flush_screen(1);
                    // show_goal_msg: the next loop pass pline()s the goal,
                    // which tty pages when it cannot share the notice's line.
                    await pline(movePrompt);
                    message = movePrompt;
                }
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.filter')) {
                clearMessageOnExit = true;
                const previous = game.iflags.getloc_filter ?? 0;
                game.iflags.getloc_filter = previous === 0 ? 1 : previous === 1 ? 2 : 0;
                targetCycles.clear();
                validity.cycle = null;
                message = ['Not limiting targets.', 'Limiting targets to those in sight.',
                    'Limiting targets to those in same area.'][game.iflags.getloc_filter] ?? movePrompt;
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.menu')) {
                clearMessageOnExit = true;
                game.iflags.getloc_usemenu = !game.iflags.getloc_usemenu;
                message = `${game.iflags.getloc_usemenu ? 'Using' : 'Not using'} a menu to show possible targets${game.iflags.getloc_usemenu ? " for 'm|M', 'o|O', 'd|D', and 'x|X'" : ''}.`;
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.moveskip')) {
                clearMessageOnExit = true;
                game.iflags.getloc_moveskip = !game.iflags.getloc_moveskip;
                message = `${game.iflags.getloc_moveskip ? 'S' : 'Not s'}kipping over similar terrain when fastmoving the cursor.`;
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.self')) {
                cursor.x = game.u.ux;
                cursor.y = game.u.uy;
                // NHKF_GETPOS_SELF resets every gather index.
                if (validity.cycle) validity.cycle.index = 0;
                for (const cycle of targetCycles.values()) cycle.index = 0;
                message = await movementMessage();
                continue;
            }
            const target = getposCycleKind(key);
            if (target) {
                const kind = target.kind;
                const gatherTargets = () => gatherValidLocations((x, y) =>
                    (x !== game.u.ux || y !== game.u.uy)
                    && (kind === 'valid' ? isValidLocation?.(x, y) ?? matchesGetposCycle('all', x, y)
                        : matchesGetposCycle(kind, x, y)));
                if (game.iflags.getloc_usemenu) {
                    // getpos_menu gathers each time; a doorway's area
                    // follows the direction of the latest cursor movement.
                    const spots = gatherTargets();
                    if (!spots.length) {
                        const things = { mon: 'any monsters', obj: 'any items', door: 'any doors', unexplored: 'any unexplored areas', all: 'anything interesting', valid: 'any valid locations' };
                        message = `You cannot ${game.iflags.getloc_filter === 1 ? 'see' : 'detect'} ${things[target.kind]}.`;
                        continue;
                    }
                    const spot = await selectGetposMenu(spots, kind);
                    if (spot) { cursor.x = spot.x; cursor.y = spot.y; }
                    message = await movementMessage();
                    continue;
                }
                let cycle = kind === 'valid' && isValidLocation ? validLocations() : targetCycles.get(kind);
                if (!cycle) {
                    cycle = {
                        spots: [{ x: game.u.ux, y: game.u.uy }, ...gatherTargets()], index: 0,
                    };
                    targetCycles.set(kind, cycle);
                }
                cycle.index = (cycle.index + target.step + cycle.spots.length)
                    % cycle.spots.length;
                const spot = cycle.spots[cycle.index];
                if (!spot) throw new Error('The selected target location is missing');
                cursor.x = spot.x;
                cursor.y = spot.y;
                message = await movementMessage();
                continue;
            }
            const feature = nextGetposFeature(cursor, ch);
            if (feature) {
                cursor.x = feature.x;
                cursor.y = feature.y;
                if (clearMessageOnExit) {
                    clearMessageWindow();
                    message = '';
                }
                clearMessageOnExit = false;
                if (autoDescription()) message = await movementMessage();
                continue;
            }
            message = getposFeatureMissMessage(ch);
            clearMessageOnExit = true;
            if (!force && !isGetposFeatureSymbol(ch, game.symset)) {
                await pline(message.replace(/\(use .*\)/, '(aborted)'));
                await plineWithContinuation('Done.');
                clearMessageOnExit = false;
                return null;
            }
        }
    } finally {
        if (clearMessageOnExit) clearMessageWindow();
        const hero = game.u;
        if (savedDirection.dx === undefined) delete hero.dx;
        else hero.dx = savedDirection.dx;
        if (savedDirection.dy === undefined) delete hero.dy;
        else hero.dy = savedDirection.dy;
        if (savedDirection.dz === undefined) delete hero.dz;
        else hero.dz = savedDirection.dz;
        // exitgetpos() clears the validity callbacks and force-redraws their
        // old selection once, also replacing any active '$' marks.
        if (isValidLocation) setMapPositionHighlights(null, game.iflags.bgcolors !== false);
    }
}
