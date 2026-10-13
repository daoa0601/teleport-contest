// C refs: getpos.c:getpos(), drawing.c:defsyms[], symbols.c:gs.showsyms[],
// display.c:tmp_at() for the valid-location marking overlay.

import {
    COLNO, D_ISOPEN, DOOR, HI_ZAP, LOOK_ONCE, LOOK_QUICK,
    LOOK_TRADITIONAL, LOOK_VERBOSE, ROWNO,
} from './const.js';
import {
    bot, clearMessageWindow, redrawMap, flush_screen, glyphAt, newsym, pline, show_glyph_cell, terrain_glyph,
} from './display.js';
import { game } from './gstate.js';
import { nhgetch, readchar } from './input.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { MONSTER_NAME } from './monster_data.js';
import { BOULDER, ROCK } from './object_data.js';
import { NO_COLOR } from './terminal.js';
import { cansee } from './vision.js';
import type { GameState } from './game_state.js';
import type { Position } from './map_types.js';

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
    preserveMap?: boolean;
    force?: boolean;
}

interface LocationCycle {
    spots: Position[];
    index: number;
}
interface ValidLocationCycle extends LocationCycle {
    marked: Position[];
}
type GetposCycleKind = 'mon' | 'obj' | 'door' | 'unexplored' | 'all';

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
// additional low-seven-bit input characters introduced by the DEC set; all
// of its other eligible projections are already in the default set above.
const DEC_GETPOS_FEATURE_SYMBOLS = new Set([
    'g', 'y', 'z', 'x', 'q', 'o', 's',
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

function getposFeatureMatches(x: number, y: number, symbol: string, state: GameState): boolean {
    const loc = state.level?.at?.(x, y);
    if (!loc) return false;
    if (state.iflags?.terrainmode) {
        const glyph = glyphAt(x, y, state);
        if (glyph?.kind === 'trap') return symbol === '^' || loc.disp_ch === symbol;
        if (glyph?.kind === 'engraving') return symbol === '`' || loc.disp_ch === symbol;
        return glyph?.kind === 'terrain' && loc.disp_ch === symbol;
    }

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
export function nextGetposFeature(cursor: Position, symbol: string, state: GameState = game): Position | null {
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

// redrawMap() rebuilds every map cell each round, so the tmp_at-style overlay
// must be re-applied after it (tty keeps such glyphs on screen instead).
export async function paintGetposCursor(cursor: Position, message: string, markedSpots: readonly Position[] | null = null, preserveMap = false): Promise<void> {
    game._pending_message = message;
    if (!preserveMap) await redrawMap();
    // display.c:tmp_at() with DISP_BEAM shows the glyph only on squares the
    // hero can see, so a validity rule that admits unseen squares (polearm
    // couldsee+glyph policy) still cannot reveal them.
    if (markedSpots) {
        for (const { x, y } of markedSpots)
            show_glyph_cell(x, y, GOODPOS_CH, HI_ZAP, false);
    }
    await bot();
    await flush_screen(1);
    game.nhDisplay?.setCursor(cursor.x - 1, cursor.y + 1);
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
        lines.push("Use 'z' or 'Z' to move to valid locations.");
        lines.push("Use '$' to toggle marking of valid locations.");
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

// C getpos.c:gather_locs()/gather_locs_interesting() with GLOC_VALID minus
// the hero injection: predicate-true squares ordered by cmp_coord_distu()
// (Chebyshev distance from the hero, then row, then column).  Unseen
// squares stay eligible for cycling; only the '$' marking is gated.
function gatherValidLocations(isValidLocation: ValidLocation, state: GameState = game): Position[] {
    const ux = state.u.ux, uy = state.u.uy;
    const spots = [];
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            if (isValidLocation(x, y)) spots.push({ x, y });
        }
    }
    spots.sort((a, b) => {
        const distA = Math.max(Math.abs(ux - a.x), Math.abs(uy - a.y));
        const distB = Math.max(Math.abs(ux - b.x), Math.abs(uy - b.y));
        if (distA !== distB) return distA - distB;
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
    });
    return spots;
}

function getposCycleKind(key: number): { kind: GetposCycleKind; step: -1 | 1 } | null {
    const kinds: readonly GetposCycleKind[] = ['mon', 'obj', 'door', 'unexplored', 'all'];
    for (const kind of kinds) {
        if (key === game.commandBindings.specialKey(`getpos.${kind}.next`))
            return { kind, step: 1 };
        if (key === game.commandBindings.specialKey(`getpos.${kind}.prev`))
            return { kind, step: -1 };
    }
    return null;
}

function matchesGetposCycle(kind: GetposCycleKind, x: number, y: number): boolean {
    const glyph = glyphAt(x, y);
    if (kind === 'mon') return glyph?.kind === 'monster'
        && glyph.mnum !== MONSTER_NAME.indexOf('long worm tail');
    if (kind === 'obj') return glyph?.kind === 'object'
        && ![BOULDER, ROCK].includes(glyph.otyp);
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

export async function selectMapPosition({
    start,
    prompt,
    goal,
    describe,
    afterPaint = null,
    isValidLocation = null,
    preserveMap = false,
    force = true,
}: MapPositionOptions): Promise<MapPositionSelection | null> {
    const cursor = { ...start };
    const savedDirection = { dx: game.u.dx, dy: game.u.dy, dz: game.u.dz };
    const movePrompt = `Move cursor to ${goal}:`;
    let message = prompt;
    let firstPaint = true;
    // garr[GLOC_VALID]/gidx and the hilite state live inside C getpos();
    // getpos_sethilite(NULL, NULL) resets them at its exit.
    const validity: { cycle: ValidLocationCycle | null } = { cycle: null };
    let markValid = false;
    let paintedSpots: Position[] | null = null;
    const targetCycles = new Map<GetposCycleKind, LocationCycle>();

    const validLocations = (): ValidLocationCycle => {
        if (!validity.cycle) {
            if (!isValidLocation) throw new Error('Valid-location selection requires a location predicate');
            const marked = gatherValidLocations(isValidLocation);
            const atHero = ({ x, y }: Position) => x === game.u.ux && y === game.u.uy;
            validity.cycle = {
                // gather_locs() injects the hero square so the cycle is
                // never empty and wraps visibly back to the hero; the
                // marking list stays predicate-only.
                spots: marked.some(atHero)
                    ? marked : [{ x: game.u.ux, y: game.u.uy }, ...marked],
                marked,
                index: 0,
            };
        }
        return validity.cycle;
    };

    try {
        for (;;) {
            // bgcolors off (this port's default): '$' alternates between no
            // marking and the S_goodpos overlay.  The cycle-only hero
            // injection never paints unless the predicate accepts the hero.
            paintedSpots = isValidLocation && markValid
                ? validLocations().marked.filter(({ x, y }) => cansee(x, y))
                : null;
            await paintGetposCursor(cursor, message, paintedSpots, preserveMap);
            if (afterPaint) await afterPaint(cursor, firstPaint);
            firstPaint = false;

            let key = (await readchar('position')) & 255;
            let fast = false;
            if (key === game.commandBindings.keyForCommand('run')
                || key === game.commandBindings.keyForCommand('rush')) {
                key = (await readchar('position')) & 255;
                fast = true;
            }
            const ch = String.fromCharCode(key);
            if (key === 27) {
                clearMessageWindow();
                return null;
            }
            const pickType = mapPositionPickType(key);
            if (pickType !== null) return { ...cursor, pickType };
            const movement = game.commandBindings.movementForKey(key);
            if (movement && movement.direction < 8) {
                game.u.dx = movement.dx;
                game.u.dy = movement.dy;
                const distance = fast || movement.mode !== 0 ? 8 : 1;
                moveGetposCursor(cursor, movement.dx * distance, movement.dy * distance);
                message = await describeSelectedPosition(describe, cursor, movePrompt);
                continue;
            }

            if (key === 18) {
                // redraw_cmd(): getpos_refresh() ends an active marking.
                markValid = false;
                message = movePrompt;
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.help')) {
                // getpos_help() runs before getpos_refresh(), which resets
                // the hilite state to its default (marking off).
                markValid = false;
                await getposHelpUntilDismissed(goal, {
                    hasValidLocations: !!isValidLocation,
                });
                message = movePrompt;
                continue;
            }
            if (!force && [' ', '\n', '\r'].includes(ch)) {
                await pline('Done.');
                return null;
            }
            if (ch === ' ') {
                message = await describeSelectedPosition(describe, cursor, movePrompt);
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.valid')) {
                if (isValidLocation) markValid = !markValid;
                message = movePrompt;
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.self')) {
                cursor.x = game.u.ux;
                cursor.y = game.u.uy;
                // NHKF_GETPOS_SELF resets every gather index.
                if (validity.cycle) validity.cycle.index = 0;
                for (const cycle of targetCycles.values()) cycle.index = 0;
                message = await describeSelectedPosition(describe, cursor, movePrompt);
                continue;
            }
            if (isValidLocation && (key === game.commandBindings.specialKey('getpos.valid.next')
                || key === game.commandBindings.specialKey('getpos.valid.prev'))) {
                // mMoOdDxX cycling precedes the feature-symbol search while
                // a validity rule is installed (cmd.c defaults 'z'/'Z').
                const cycle = validLocations();
                cycle.index = key === game.commandBindings.specialKey('getpos.valid.next')
                    ? (cycle.index + 1) % cycle.spots.length
                    : cycle.index > 0
                        ? cycle.index - 1 : cycle.spots.length - 1;
                const spot = cycle.spots[cycle.index];
                if (!spot) throw new Error('The selected valid location is missing');
                cursor.x = spot.x;
                cursor.y = spot.y;
                message = await describeSelectedPosition(describe, cursor, movePrompt);
                continue;
            }
            const target = getposCycleKind(key);
            if (target) {
                let cycle = targetCycles.get(target.kind);
                if (!cycle) {
                    const spots = gatherValidLocations((x, y) =>
                        (x !== game.u.ux || y !== game.u.uy)
                        && matchesGetposCycle(target.kind, x, y));
                    cycle = {
                        spots: [{ x: game.u.ux, y: game.u.uy }, ...spots], index: 0,
                    };
                    targetCycles.set(target.kind, cycle);
                }
                cycle.index = (cycle.index + target.step + cycle.spots.length)
                    % cycle.spots.length;
                const spot = cycle.spots[cycle.index];
                if (!spot) throw new Error('The selected target location is missing');
                cursor.x = spot.x;
                cursor.y = spot.y;
                message = await describeSelectedPosition(describe, cursor, movePrompt);
                continue;
            }
            const feature = nextGetposFeature(cursor, ch);
            if (feature) {
                cursor.x = feature.x;
                cursor.y = feature.y;
                message = await describeSelectedPosition(describe, cursor, movePrompt);
                continue;
            }
            message = getposFeatureMissMessage(ch);
            if (!force && !isGetposFeatureSymbol(ch, game.symset)) {
                await pline(message.replace(/\(use .*\)/, '(aborted)'));
                await pline('Done.');
                return null;
            }
        }
    } finally {
        const hero = game.u;
        if (savedDirection.dx === undefined) delete hero.dx;
        else hero.dx = savedDirection.dx;
        if (savedDirection.dy === undefined) delete hero.dy;
        else hero.dy = savedDirection.dy;
        if (savedDirection.dz === undefined) delete hero.dz;
        else hero.dz = savedDirection.dz;
        // exitgetpos(): getpos_sethilite(NULL, NULL) force-newsyms the old
        // valid selection; tmp_at(DISP_END) newsyms only squares it drew.
        if (paintedSpots) {
            for (const { x, y } of paintedSpots) newsym(x, y);
            await flush_screen(1);
            // exitgetpos() leaves the tty cursor at the last selection spot.
            game.nhDisplay?.setCursor(cursor.x - 1, cursor.y + 1);
        }
    }
}
