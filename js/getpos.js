// C refs: getpos.c:getpos(), drawing.c:defsyms[], symbols.c:gs.showsyms[],
// display.c:tmp_at() for the valid-location marking overlay.
import { COLNO, D_ISOPEN, DOOR, HI_ZAP, LOOK_ONCE, LOOK_QUICK, LOOK_TRADITIONAL, LOOK_VERBOSE, ROWNO, VIBRATING_SQUARE, WEB, IS_WALL, TREE, } from './const.js';
import { bot, clearMessageWindow, redrawMap, flush_screen, glyphAt, lastDirtyMapCursor, newsym_force, pline, show_glyph_cell, terrain_glyph, } from './display.js';
import { game } from './gstate.js';
import { nhgetch, readchar } from './input.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { MONSTER_NAME } from './monster_data.js';
import { BOULDER, ROCK } from './object_data.js';
import { CmapSymbol, GlyphOffset } from './glyph_numbers.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { NO_COLOR } from './terminal.js';
import { cansee } from './vision.js';
import { coordinateDescription } from './pager_lists.js';
import { showMultiSelectWindow } from './windows.js';
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
export function isGetposFeatureSymbol(ch, symset = '') {
    if (typeof ch !== 'string' || ch.length !== 1)
        return false;
    if (DEFAULT_GETPOS_FEATURE_SYMBOLS.has(ch))
        return true;
    return /^DECgraphics$/i.test(symset ?? '')
        && DEC_GETPOS_FEATURE_SYMBOLS.has(ch);
}
// A diagonal which crosses a map edge loses the same amount of movement on
// its other axis.  Clamping each axis separately would slide along the edge.
export function moveGetposCursor(cursor, dx, dy) {
    if (cursor.x + dx < 1) {
        dy -= Math.sign(dy) * (1 - (cursor.x + dx));
        dx = 1 - cursor.x;
    }
    else if (cursor.x + dx > COLNO - 1) {
        dy += Math.sign(dy) * ((COLNO - 1) - (cursor.x + dx));
        dx = (COLNO - 1) - cursor.x;
    }
    if (cursor.y + dy < 0) {
        dx -= Math.sign(dx) * (0 - (cursor.y + dy));
        dy = -cursor.y;
    }
    else if (cursor.y + dy > ROWNO - 1) {
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
    if (!shouldShowGetposTip(state))
        return false;
    state._travelTipShown = true;
    await currentLuaLifecycle().callCore(state, 'getpos_tip');
    return true;
}
// C uses cmap identities, not the terminal character of a remembered glyph.
// In particular, DEC's pi altar must still match the default '_' key.
const DEC_FEATURE_SYMBOLS = new Map([
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
function matchingGetposSymbols(key, state) {
    const matching = new Set();
    const dec = /^DECgraphics$/i.test(state.symset ?? '');
    for (let index = CmapSymbol.bars; index <= CmapSymbol.goodpos; index++) {
        if (index === CmapSymbol.room || index === CmapSymbol.darkroom
            || index === CmapSymbol.corr || index === CmapSymbol.litcorr)
            continue;
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
function getposGlyphSymbol(glyph) {
    if (glyph === undefined)
        return null;
    if (glyph >= GlyphOffset.cmapA && glyph < GlyphOffset.altar)
        return glyph - GlyphOffset.cmapA + CmapSymbol.ndoor;
    if (glyph >= GlyphOffset.altar && glyph < GlyphOffset.cmapB)
        return CmapSymbol.altar;
    if (glyph >= GlyphOffset.cmapB && glyph < GlyphOffset.zap)
        return glyph - GlyphOffset.cmapB + CmapSymbol.grave;
    if (glyph >= GlyphOffset.zap && glyph < GlyphOffset.cmapC)
        return (glyph - GlyphOffset.zap) % 4 + 74;
    if (glyph >= GlyphOffset.cmapC && glyph < GlyphOffset.swallow)
        return glyph - GlyphOffset.cmapC + CmapSymbol.digbeam;
    return null;
}
function getposFeatureMatches(x, y, key, matching, state) {
    const loc = state.level?.at?.(x, y);
    if (!loc)
        return false;
    const current = getposGlyphSymbol(glyphAt(x, y, state)?.glyph);
    if (current !== null && matching.has(current))
        return true;
    if (state.level?.flags.hero_memory !== false && !state.iflags.terrainmode) {
        const remembered = getposGlyphSymbol(loc.remembered_glyph?.glyph);
        if (remembered !== null && matching.has(remembered))
            return true;
    }
    if (key === '~' && state.level?.traps.some(trap => trap.tx === x && trap.ty === y && trap.ttyp === VIBRATING_SQUARE && trap.tseen))
        return true;
    if (loc.seenv) {
        const background = getposGlyphSymbol(terrain_glyph(loc, x, y).glyph);
        if (background !== null && matching.has(background))
            return true;
    }
    return false;
}
// Search from the cursor to the bottom-right of the map, then wrap around.
export function nextGetposFeature(cursor, symbol, state = game) {
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
export function getposFeatureMissMessage(ch, state = game) {
    const code = ch.codePointAt(0);
    const visible = code !== undefined && code < 32
        ? `^${String.fromCharCode(code + 64)}`
        : code === 127 ? '^?' : ch;
    return isGetposFeatureSymbol(ch, state.symset)
        ? `Can't find dungeon feature '${visible}'.`
        : `Unknown direction: '${visible}' (use 'h', 'j', 'k', 'l' or '.').`;
}
function mapPositionPickType(code) {
    const choices = [
        ['getpos.pick', LOOK_TRADITIONAL], ['getpos.pick.quick', LOOK_QUICK],
        ['getpos.pick.once', LOOK_ONCE], ['getpos.pick.verbose', LOOK_VERBOSE],
    ];
    return choices.find(([name]) => game.commandBindings.specialKey(name) === code)?.[1] ?? null;
}
export function isGetposPickCharacter(ch) {
    return mapPositionPickType(ch.charCodeAt(0)) !== null;
}
// redrawMap() rebuilds every map cell each round, so the tmp_at-style overlay
// must be re-applied after it (tty keeps such glyphs on screen instead).
export async function paintGetposCursor(cursor, message, markedSpots = null, preserveMap = false) {
    game._pending_message = message;
    if (!preserveMap)
        await redrawMap();
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
export async function getposHelpUntilDismissed(goal, { hasValidLocations = false } = {}) {
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
    lines.push("Use '#' to toggle automatic description.", "Type a '.' when you are at the right place.", '');
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
    do
        key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    return key;
}
async function describeSelectedPosition(describe, cursor, fallback) {
    return await describe?.(cursor.x, cursor.y) || fallback;
}
// selection_force_newsyms() redraws by column, then row. Hallucinated glyphs
// consume display randomness in that order, independently of target cycling.
function validMapSquares(isValidLocation) {
    const spots = [];
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            if (isValidLocation(x, y))
                spots.push({ x, y });
        }
    }
    return spots;
}
// C getpos.c:gather_locs()/gather_locs_interesting() with GLOC_VALID minus
// the hero injection: predicate-true squares ordered by cmp_coord_distu()
// (Chebyshev distance from the hero, then row, then column).  Unseen
// squares stay eligible for cycling; only the '$' marking is gated.
function gatherValidLocations(isValidLocation, state = game) {
    const ux = state.u.ux, uy = state.u.uy;
    const inArea = getposArea(state);
    const spots = validMapSquares((x, y) => isValidLocation(x, y)
        && (state.iflags.getloc_filter !== 1 || cansee(x, y))
        && (state.iflags.getloc_filter !== 2 || [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]
            .some(([dx = 0, dy = 0]) => inArea.has((y + dy) * COLNO + x + dx))));
    spots.sort((a, b) => {
        const distA = Math.max(Math.abs(ux - a.x), Math.abs(uy - a.y));
        const distB = Math.max(Math.abs(ux - b.x), Math.abs(uy - b.y));
        if (distA !== distB)
            return distA - distB;
        if (a.y !== b.y)
            return a.y - b.y;
        return a.x - b.x;
    });
    return spots;
}
// C gloc_filter_init()/gloc_filter_floodfill(): target areas follow known
// terrain classes. From a doorway, use the side of the last movement.
function getposArea(state) {
    const area = new Set();
    if (state.iflags.getloc_filter !== 2)
        return area;
    let x = state.u.ux, y = state.u.uy;
    if (state.level?.at(x, y)?.typ === DOOR) {
        if (!state.u.dx && !state.u.dy)
            return area;
        x += state.u.dx ?? 0;
        y += state.u.dy ?? 0;
    }
    const classify = (tx, ty) => {
        const location = state.level?.at(tx, ty);
        if (!location?.seenv || tx < 1 || tx >= COLNO || ty < 0 || ty >= ROWNO)
            return null;
        if (IS_WALL(location.typ) || location.typ === TREE)
            return 2;
        const symbol = getposGlyphSymbol(terrain_glyph(location, tx, ty).glyph);
        if (symbol === null)
            return 0;
        if (symbol >= CmapSymbol.room && symbol <= CmapSymbol.darkroom
            || symbol >= CmapSymbol.upstair && symbol <= CmapSymbol.fountain)
            return 1;
        if (symbol >= CmapSymbol.vwall && symbol <= CmapSymbol.trwall || symbol === CmapSymbol.tree)
            return 2;
        if (symbol === CmapSymbol.corr || symbol === CmapSymbol.litcorr)
            return 3;
        if (symbol === CmapSymbol.pool || symbol === CmapSymbol.water)
            return 4;
        if (symbol === CmapSymbol.lava || symbol === CmapSymbol.lavawall)
            return 5;
        return 0;
    };
    const category = classify(x, y);
    if (category === null)
        return area;
    const pending = [{ x, y }];
    for (let index = 0; index < pending.length; index++) {
        const spot = pending[index];
        if (!spot || classify(spot.x, spot.y) !== category)
            continue;
        const key = spot.y * COLNO + spot.x;
        if (area.has(key))
            continue;
        area.add(key);
        pending.push({ x: spot.x - 1, y: spot.y }, { x: spot.x + 1, y: spot.y }, { x: spot.x, y: spot.y - 1 }, { x: spot.x, y: spot.y + 1 });
    }
    return area;
}
// C getpos.c:getpos_sethilite(). Install after the caller's question and
// before getpos's tutorial or instructions can flush these forced redraws.
export function prepareMapPositionHighlights(isValidLocation) {
    for (const { x, y } of validMapSquares(isValidLocation))
        newsym_force(x, y);
}
function getposCycleKind(key) {
    const kinds = ['mon', 'obj', 'door', 'unexplored', 'all'];
    for (const kind of kinds) {
        if (key === game.commandBindings.specialKey(`getpos.${kind}.next`))
            return { kind, step: 1 };
        if (key === game.commandBindings.specialKey(`getpos.${kind}.prev`))
            return { kind, step: -1 };
    }
    return null;
}
function matchesGetposCycle(kind, x, y) {
    const glyph = glyphAt(x, y);
    if (kind === 'mon')
        return glyph?.kind === 'monster'
            && glyph.mnum !== MONSTER_NAME.indexOf('long worm tail');
    if (kind === 'obj')
        return glyph?.kind === 'object'
            && glyph.glyph !== GlyphOffset.object + BOULDER && glyph.glyph !== GlyphOffset.object + ROCK;
    const terrain = glyph?.kind === 'terrain' ? glyph.terrainName : null;
    const door = terrain && (terrain.includes('door') || terrain.includes('drawbridge'));
    if (kind === 'door')
        return !!door;
    if (kind === 'unexplored') {
        const floor = door || (terrain !== null && ['floor of a room', 'dark part of a room', 'corridor', 'lit corridor'].includes(terrain));
        const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        return !!floor && offsets.some(([dx, dy]) => {
            const adjacent = game.level?.at(x + dx, y + dy);
            return !!adjacent && !adjacent.seenv && (!adjacent.remembered_glyph
                || adjacent.remembered_glyph.kind === 'unexplored');
        });
    }
    if (door)
        return true;
    if (!glyph || ['nothing', 'unexplored'].includes(glyph.kind))
        return false;
    return terrain === null || !['wall', 'stone', 'tree', 'iron bars', 'ice', 'air', 'cloud',
        'water', 'molten lava', 'wall of lava', 'floor of a room',
        'dark part of a room', 'corridor', 'lit corridor'].includes(terrain);
}
export async function selectMapPosition({ start, prompt, goal, describe, afterPaint = null, isValidLocation = null, highlightHero = true, preserveMap = false, force = true, }) {
    const cursor = { ...start };
    const savedDirection = { dx: game.u.dx, dy: game.u.dy, dz: game.u.dz };
    const movePrompt = `Move cursor to ${goal}:`;
    let message = prompt;
    let firstPaint = true;
    // garr[GLOC_VALID]/gidx and the hilite state live inside C getpos();
    // getpos_sethilite(NULL, NULL) resets them at its exit.
    const validity = { cycle: null };
    let markValid = false;
    const targetCycles = new Map();
    const autoDescription = () => game.iflags.autodescribe ?? game.flags.autodescribe ?? true;
    const movementMessage = async () => autoDescription()
        ? await describeSelectedPosition(describe, cursor, movePrompt) : movePrompt;
    const validLocations = () => {
        if (!validity.cycle) {
            if (!isValidLocation)
                throw new Error('Valid-location selection requires a location predicate');
            const marked = gatherValidLocations(isValidLocation);
            const atHero = ({ x, y }) => x === game.u.ux && y === game.u.uy;
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
        const initialMapCursor = isValidLocation && !game.flags.verbose
            ? lastDirtyMapCursor() : null;
        for (;;) {
            // bgcolors off (this port's default): '$' alternates between no
            // marking and the S_goodpos overlay.  The cycle-only hero
            // injection never paints unless the predicate accepts the hero.
            const paintedSpots = isValidLocation && markValid
                ? validLocations().marked.filter(({ x, y }) => cansee(x, y)
                    && (highlightHero || x !== game.u.ux || y !== game.u.uy))
                : null;
            await paintGetposCursor(cursor, message, paintedSpots, preserveMap);
            if (firstPaint && initialMapCursor)
                game.nhDisplay?.setCursor(...initialMapCursor);
            if (afterPaint)
                await afterPaint(cursor, firstPaint);
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
            if (pickType !== null)
                return { ...cursor, pickType };
            const movement = game.commandBindings.movementForKey(key);
            if (movement && movement.direction < 8) {
                game.u.dx = movement.dx;
                game.u.dy = movement.dy;
                const fastMove = fast || movement.mode !== 0;
                let distance = fastMove ? 8 : 1;
                if (fastMove && game.iflags.getloc_moveskip) {
                    const glyph = glyphAt(cursor.x, cursor.y)?.glyph;
                    distance = 1;
                    const sameTerrain = (step) => {
                        const x = cursor.x + movement.dx * step, y = cursor.y + movement.dy * step;
                        return x >= 1 && x < COLNO && y >= 0 && y < ROWNO
                            && glyphAt(x, y)?.glyph === glyph;
                    };
                    while (sameTerrain(distance) && sameTerrain(distance + 1))
                        distance++;
                }
                moveGetposCursor(cursor, movement.dx * distance, movement.dy * distance);
                message = await movementMessage();
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
                if (isValidLocation)
                    markValid = !markValid;
                message = movePrompt;
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.autodescribe')) {
                game.iflags.autodescribe = !autoDescription();
                message = `Automatic description ${game.flags.verbose ? 'of features under cursor ' : ''}is ${autoDescription() ? 'on' : 'off'}.`;
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.filter')) {
                const previous = game.iflags.getloc_filter ?? 0;
                game.iflags.getloc_filter = previous === 0 ? 1 : previous === 1 ? 2 : 0;
                targetCycles.clear();
                validity.cycle = null;
                message = ['Not limiting targets.', 'Limiting targets to those in sight.',
                    'Limiting targets to those in same area.'][game.iflags.getloc_filter] ?? movePrompt;
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.menu')) {
                game.iflags.getloc_usemenu = !game.iflags.getloc_usemenu;
                message = `${game.iflags.getloc_usemenu ? 'Using' : 'Not using'} a menu to show possible targets${game.iflags.getloc_usemenu ? " for 'm|M', 'o|O', 'd|D', and 'x|X'" : ''}.`;
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.moveskip')) {
                game.iflags.getloc_moveskip = !game.iflags.getloc_moveskip;
                message = `${game.iflags.getloc_moveskip ? 'S' : 'Not s'}kipping over similar terrain when fastmoving the cursor.`;
                continue;
            }
            if (key === game.commandBindings.specialKey('getpos.self')) {
                cursor.x = game.u.ux;
                cursor.y = game.u.uy;
                // NHKF_GETPOS_SELF resets every gather index.
                if (validity.cycle)
                    validity.cycle.index = 0;
                for (const cycle of targetCycles.values())
                    cycle.index = 0;
                message = await movementMessage();
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
                if (!spot)
                    throw new Error('The selected valid location is missing');
                cursor.x = spot.x;
                cursor.y = spot.y;
                message = await movementMessage();
                continue;
            }
            const target = getposCycleKind(key);
            if (target) {
                let cycle = targetCycles.get(target.kind);
                if (!cycle) {
                    const spots = gatherValidLocations((x, y) => (x !== game.u.ux || y !== game.u.uy)
                        && matchesGetposCycle(target.kind, x, y));
                    cycle = {
                        spots: [{ x: game.u.ux, y: game.u.uy }, ...spots], index: 0,
                    };
                    targetCycles.set(target.kind, cycle);
                }
                if (game.iflags.getloc_usemenu) {
                    const names = { mon: 'monster', obj: 'item', door: 'door', unexplored: 'unexplored area', all: 'interesting thing' };
                    const spots = cycle.spots.slice(1);
                    if (!spots.length) {
                        const things = { mon: 'any monsters', obj: 'any items', door: 'any doors', unexplored: 'any unexplored areas', all: 'anything interesting' };
                        message = `You cannot ${game.iflags.getloc_filter === 1 ? 'see' : 'detect'} ${things[target.kind]}.`;
                        continue;
                    }
                    const items = [];
                    for (const spot of spots) {
                        const text = await describeSelectedPosition(describe, spot, 'unknown');
                        const coordinates = coordinateDescription(spot.x, spot.y, game.iflags.getpos_coords ?? 'n');
                        items.push({ text: text + (coordinates ? ` ${coordinates}` : ''), value: spot });
                    }
                    const filter = game.iflags.getloc_filter === 1 ? ' in view' : game.iflags.getloc_filter === 2 ? ' in this area' : '';
                    const name = names[target.kind];
                    const selection = await showMultiSelectWindow({ title: `Pick ${name === 'item' || name === 'unexplored area' || name === 'interesting thing' ? 'an' : 'a'} ${name}${filter}`,
                        omitHeadings: true, pageLocalKeys: true, pickOne: true, sections: [{ items }] });
                    const spot = selection[0];
                    if (spot) {
                        cursor.x = spot.x;
                        cursor.y = spot.y;
                    }
                    message = await movementMessage();
                    continue;
                }
                cycle.index = (cycle.index + target.step + cycle.spots.length)
                    % cycle.spots.length;
                const spot = cycle.spots[cycle.index];
                if (!spot)
                    throw new Error('The selected target location is missing');
                cursor.x = spot.x;
                cursor.y = spot.y;
                message = await movementMessage();
                continue;
            }
            const feature = nextGetposFeature(cursor, ch);
            if (feature) {
                cursor.x = feature.x;
                cursor.y = feature.y;
                message = await movementMessage();
                continue;
            }
            message = getposFeatureMissMessage(ch);
            if (!force && !isGetposFeatureSymbol(ch, game.symset)) {
                await pline(message.replace(/\(use .*\)/, '(aborted)'));
                await pline('Done.');
                return null;
            }
        }
    }
    finally {
        const hero = game.u;
        if (savedDirection.dx === undefined)
            delete hero.dx;
        else
            hero.dx = savedDirection.dx;
        if (savedDirection.dy === undefined)
            delete hero.dy;
        else
            hero.dy = savedDirection.dy;
        if (savedDirection.dz === undefined)
            delete hero.dz;
        else
            hero.dz = savedDirection.dz;
        // exitgetpos() clears the validity callbacks and force-redraws their
        // old selection once, also replacing any active '$' marks.
        if (isValidLocation) {
            for (const { x, y } of validMapSquares(isValidLocation))
                newsym_force(x, y);
        }
    }
}
//# sourceMappingURL=getpos.js.map