// C refs: cmd.c:dolookaround(), lookaround_known_room(),
// dolookaround_floodfill_findroom(), u_have_seen_whole_selection(),
// u_have_seen_bounds_selection(), u_can_see_whole_selection(),
// getpos.c:gather_locs_interesting(), pager.c:do_screen_description(),
// pline.c:pline_xy() and vpline()'s accessiblemsg location prefix.
import { CORR, COLNO, DIR_W, DRAWBRIDGE_UP, GFILTER_VIEW, GLOC_DOOR, GLOC_INTERESTING, IRONBARS, IS_DOOR, IS_ROOM, IS_STWALL, IS_TREE, IS_WATERWALL, LAVAWALL, N_DIRS, ROOMOFFSET, ROWNO, SCORR, SDOOR, isok, xdir, ydir, } from './const.js';
import { glyphAt, pline, pline_xy, set_msg_xy } from './display.js';
import { cansee } from './vision.js';
import { game } from './gstate.js';
import { CmapSymbol, GlyphOffset } from './glyph_numbers.js';
import { glyphToCmapSymbol, knownVibratingSquareAt } from './getpos.js';
import { farlookLocationDescription } from './cmd.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { screenDescription } from './pager_description.js';
import { selection_floodfill, selection_getbounds, selection_getpoint, selection_new, selection_size_description, } from './selvar.js';
// C getpos.c:gather_locs_interesting().  #lookaround forces GFILTER_VIEW
// before scanning, so the GFILTER_AREA flood-fill branch is unreachable here.
function gatherLocsInteresting(x, y, gloc) {
    if (game.iflags.getloc_filter === GFILTER_VIEW && !cansee(x, y))
        return false;
    const glyph = glyphAt(x, y);
    const symbol = glyph ? glyphToCmapSymbol(glyph.glyph) : null;
    if (gloc === GLOC_DOOR)
        // C is_cmap_door(), is_cmap_drawbridge(), plus S_ndoor.
        return symbol !== null
            && (symbol >= CmapSymbol.vodoor && symbol <= CmapSymbol.hcdoor
                || symbol >= CmapSymbol.vodbridge && symbol <= CmapSymbol.hcdbridge
                || symbol === CmapSymbol.ndoor);
    // GLOC_INTERESTING
    if (gatherLocsInteresting(x, y, GLOC_DOOR))
        return true;
    // The uninteresting background: is_cmap_wall() (stone through trwall),
    // tree, bars, ice, air, cloud, is_cmap_lava(), is_cmap_water(), the
    // open-doorway marker S_ndoor, is_cmap_room() floors and
    // is_cmap_corr() corridors, plus the nothing and unexplored markers.
    // A missing map cell behaves like unexplored.  Everything else --
    // monsters, objects, traps, stairs and other furniture, engravings,
    // warning signs -- is worth mentioning.
    const boring = !glyph
        || glyph.kind === 'nothing' || glyph.kind === 'unexplored'
        || symbol !== null && (symbol >= CmapSymbol.stone && symbol <= CmapSymbol.trwall
            || symbol === CmapSymbol.tree || symbol === CmapSymbol.bars
            || symbol === CmapSymbol.ice || symbol === CmapSymbol.air
            || symbol === CmapSymbol.cloud
            || symbol === CmapSymbol.lava || symbol === CmapSymbol.lavawall
            || symbol === CmapSymbol.pool || symbol === CmapSymbol.water
            || symbol === CmapSymbol.ndoor
            || symbol >= CmapSymbol.room && symbol <= CmapSymbol.darkroom
            || symbol >= CmapSymbol.corr && symbol <= CmapSymbol.litcorr);
    return !boring || knownVibratingSquareAt(x, y, game);
}
// C cmd.c:dolookaround_floodfill_findroom(): the room flood-fill boundary.
// A missing map cell behaves like solid rock and stops the fill.
function lookaroundFloodFillFindRoom(x, y) {
    const typ = game.level?.at(x, y)?.typ ?? 0;
    return !(IS_STWALL(typ) || IS_DOOR(typ) || IS_TREE(typ)
        || IS_WATERWALL(typ) || typ === LAVAWALL || typ === IRONBARS
        || typ === SCORR || typ === SDOOR || typ === DRAWBRIDGE_UP);
}
// C cmd.c:u_have_seen_whole_selection(): no selected square still shows the
// unexplored glyph.
function haveSeenWholeSelection(selection) {
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (isok(x, y) && selection_getpoint(x, y, selection)) {
                const glyph = glyphAt(x, y);
                if (!glyph || glyph.glyph === GlyphOffset.unexplored)
                    return false;
            }
    return true;
}
// C cmd.c:u_have_seen_bounds_selection(): the rectangular outline of the
// selection has been seen, even when its interior has not.
function haveSeenBoundsSelection(selection) {
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++) {
        for (const y of [bounds.ly, bounds.hy])
            if (isok(x, y) && selection_getpoint(x, y, selection)) {
                const glyph = glyphAt(x, y);
                if (!glyph || glyph.glyph === GlyphOffset.unexplored)
                    return false;
            }
    }
    for (let y = bounds.ly; y <= bounds.hy; y++) {
        for (const x of [bounds.lx, bounds.hx])
            if (isok(x, y) && selection_getpoint(x, y, selection)) {
                const glyph = glyphAt(x, y);
                if (!glyph || glyph.glyph === GlyphOffset.unexplored)
                    return false;
            }
    }
    return true;
}
// C cmd.c:u_can_see_whole_selection().
function canSeeWholeSelection(selection) {
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (isok(x, y) && selection_getpoint(x, y, selection)
                && !cansee(x, y))
                return false;
    return true;
}
// C cmd.c:lookaround_known_room(): describe the room containing x,y.
async function lookaroundKnownRoom(x, y) {
    const selection = selection_new();
    selection_floodfill(selection, x, y, true, lookaroundFloodFillFindRoom);
    const heroHere = game.u.ux === x && game.u.uy === y;
    if (!heroHere)
        set_msg_xy(x, y);
    // C reads the hero's own room membership, even when describing an
    // adjacent room from a doorway.
    const roomNumber = (game.u.urooms?.[0] ?? 0) - ROOMOFFSET;
    const noun = roomNumber >= 0 ? 'room' : 'area';
    const size = withIndefiniteArticle(selection_size_description(selection));
    if (haveSeenWholeSelection(selection)) {
        const inside = !!selection_getpoint(x, y, selection);
        const verb = heroHere
            ? inside && canSeeWholeSelection(selection) ? 'are in' : 'remember this as'
            : 'remember that as';
        await pline(`You ${verb} ${size} ${noun}.`);
    }
    else if (haveSeenBoundsSelection(selection)) {
        await pline(`You guess ${heroHere ? 'this' : 'that'} to be ${size} ${noun}.`);
    }
    else {
        await pline(`You can't guess the size of ${heroHere ? 'this' : 'that'} area.`);
    }
}
// C cmd.c:dolookaround(): the #lookaround extended command.  Describes the
// hero's room (or the rooms beside a doorway, or nothing in a corridor),
// then every seen interesting square plus remembered corridors.  Messages
// carry the accessiblemsg "(north,3east): " location prefix.
export async function dolookaround() {
    const savedFilter = game.iflags.getloc_filter;
    const savedAccessible = game.flags.accessiblemsg;
    game.flags.accessiblemsg = true;
    try {
        const heroType = game.level?.at(game.u.ux, game.u.uy)?.typ;
        let corridorNextToHero = false;
        if (heroType === CORR) {
            // In a corridor, mention corridors next to you.
            corridorNextToHero = true;
        }
        else if (heroType !== undefined && IS_DOOR(heroType)) {
            // In a doorway, describe the rooms next to you.
            for (let direction = DIR_W; direction < N_DIRS; direction += 2) {
                const dx = xdir[direction], dy = ydir[direction];
                if (dx === undefined || dy === undefined)
                    throw new RangeError(`Invalid direction ${direction}`);
                const x = game.u.ux + dx;
                const y = game.u.uy + dy;
                if (isok(x, y) && IS_ROOM(game.level?.at(x, y)?.typ ?? 0))
                    await lookaroundKnownRoom(x, y);
            }
            corridorNextToHero = true;
        }
        else {
            await lookaroundKnownRoom(game.u.ux, game.u.uy);
        }
        game.iflags.getloc_filter = GFILTER_VIEW;
        for (let y = 0; y < ROWNO; y++) {
            for (let x = 1; x < COLNO; x++) {
                const glyph = glyphAt(x, y);
                const symbol = glyph ? glyphToCmapSymbol(glyph.glyph) : null;
                // In a corridor or doorway, remembered corridors count even
                // beyond the current view.  (GLOC_INTERESTING itself catches
                // S_engrcorr.)
                const isCorridor = corridorNextToHero && symbol !== null
                    && (symbol === CmapSymbol.corr || symbol === CmapSymbol.litcorr);
                if (x === game.u.ux && y === game.u.uy)
                    continue;
                if (!(gatherLocsInteresting(x, y, GLOC_INTERESTING) || isCorridor))
                    continue;
                // do_screen_description() with looked=TRUE: the detailed
                // lookat() description replaces the symbol explanation
                // whenever the screen symbol is ambiguous.
                const screen = screenDescription(x, y, '');
                const firstMatch = screen.needsDetail
                    ? await farlookLocationDescription(x, y) || screen.firstMatch
                    : screen.firstMatch;
                await pline_xy(x, y, `${firstMatch}.`);
            }
        }
    }
    finally {
        if (savedFilter === undefined)
            delete game.iflags.getloc_filter;
        else
            game.iflags.getloc_filter = savedFilter;
        if (savedAccessible === undefined)
            delete game.flags.accessiblemsg;
        else
            game.flags.accessiblemsg = savedAccessible;
    }
    game.context.move = 0;
}
//# sourceMappingURL=lookaround.js.map