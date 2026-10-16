// C cmd.c:doterrain(), detect.c:reveal_terrain()/reveal_terrain_getglyph().
import { COLNO, ROWNO, MENU_ITEMFLAGS_SELECTED, NHW_MENU, PICK_ONE, TER_FULL, TER_MAP, TER_OBJ, TER_TRP, TREE, M_AP_FURNITURE, M_AP_TYPE, } from './const.js';
import { cmapSymbolAppearance, displayMessageWindow, docrt, flush_screen, pline, show_glyph_cell, terrain_glyph, transientTrapGlyph, } from './display.js';
import { recordMappedOverviewState } from './dungeon.js';
import { game, requireGameLevel } from './gstate.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from './glyph_numbers.js';
import { selectMapPosition, shouldShowGetposTip, showGetposTip } from './getpos.js';
import { monsterAtPosition } from './monster_location.js';
import { visibleRegionAt } from './regions.js';
import { heroIsHallucinating } from './senses.js';
import { terrainCoversObjectsAt } from './terrain_properties.js';
import { CLR_BRIGHT_GREEN, CLR_GRAY, NO_COLOR } from './terminal.js';
import { cansee } from './vision.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu, } from './tty_menu.js';
export async function terrainCommand(describe) {
    recordMappedOverviewState();
    const window = tty_create_nhwindow(NHW_MENU);
    await tty_start_menu(window);
    const choices = ['known map without monsters, objects, and traps',
        'known map without monsters and objects', 'known map without monsters'];
    if (game.flags.explore || game.flags.debug)
        choices.push('full map without monsters, objects, and traps');
    for (const [index, text] of choices.entries())
        tty_add_menu(window, {
            identifier: index + 1, text,
            itemflags: index === 0 ? MENU_ITEMFLAGS_SELECTED : 0,
        });
    tty_end_menu(window, 'View which?');
    const result = await tty_select_menu(window, PICK_ONE);
    await tty_destroy_nhwindow(window);
    if (!result.cancelled) {
        const which = result.selections.find(selection => selection.identifier !== 1)?.identifier ?? 1;
        const subset = which === 4 ? TER_MAP | TER_FULL
            : TER_MAP | (which >= 2 ? TER_TRP : 0) | (which >= 3 ? TER_OBJ : 0);
        await revealTerrain(subset, describe);
    }
    game.context.move = 0;
}
async function revealTerrain(subset, describe) {
    const hero = game.u;
    const full = !!(subset & TER_FULL);
    if (!full && (heroIsHallucinating(game) || hero.stunned || hero.stunnedTurns
        || hero.confused || hero.confusionTurns)) {
        await pline('You are too disoriented for this.');
        return;
    }
    const saved = { water: hero.uinwater, buried: hero.uburied, swallowed: hero.uswallow,
        underwater: game.underwater, autodescribe: game.iflags.autodescribe };
    hero.uinwater = false;
    hero.uburied = false;
    hero.uswallow = 0;
    game.underwater = false;
    try {
        if (saved.water || saved.buried || saved.swallowed)
            await docrt();
        const level = requireGameLevel();
        for (let x = 1; x < COLNO; x++)
            for (let y = 0; y < ROWNO; y++) {
                const location = level.requireAt(x, y);
                const glyph = terrainViewGlyph(location, x, y, subset, !!saved.swallowed);
                show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx ?? false, 0, glyph);
            }
        await flush_screen(1);
        const kind = full ? 'underlying terrain' : subset & TER_OBJ
            ? 'known terrain, traps, and objects' : subset & TER_TRP
            ? 'known terrain and traps' : 'known terrain';
        await pline(`Showing ${kind} only...`);
        const firstUse = shouldShowGetposTip();
        if (firstUse)
            await showGetposTip();
        game.iflags.autodescribe = true;
        game.iflags.terrainmode = subset;
        await selectMapPosition({
            start: { x: hero.ux, y: hero.uy }, goal: 'anything of interest',
            prompt: firstUse ? "(For instructions type a '?')  Move cursor to anything of interest:"
                : `Showing ${kind} only...${game.flags.verbose ? "  (For instructions type a '?')" : ''}`,
            describe, force: false,
        });
        await displayMessageWindow();
    }
    finally {
        if (saved.water === undefined)
            delete hero.uinwater;
        else
            hero.uinwater = saved.water;
        if (saved.buried === undefined)
            delete hero.uburied;
        else
            hero.uburied = saved.buried;
        if (saved.swallowed === undefined)
            delete hero.uswallow;
        else
            hero.uswallow = saved.swallowed;
        if (saved.underwater === undefined)
            delete game.underwater;
        else
            game.underwater = saved.underwater;
        if (saved.autodescribe === undefined)
            delete game.iflags.autodescribe;
        else
            game.iflags.autodescribe = saved.autodescribe;
        game.iflags.terrainmode = 0;
        await docrt();
        await flush_screen(1);
    }
}
function terrainViewGlyph(location, x, y, subset, swallowed) {
    const level = requireGameLevel();
    const full = !!(subset & TER_FULL), keepObjects = !!(subset & TER_OBJ), keepTraps = !!(subset & TER_TRP);
    const background = () => terrainBackground({ ...location,
        typ: full ? location.typ : location.lastseentyp, seenv: full ? 255 : location.seenv }, x, y);
    const empty = () => level.flags.arboreal
        ? terrainBackground({ ...location, typ: TREE, seenv: 255 }, x, y)
        : { ch: ' ', color: NO_COLOR, decgfx: false,
            kind: 'terrain', terrainName: 'stone', glyph: cmapToGlyph(CmapSymbol.stone) };
    if (full)
        return normalizeTerrainGlyph(terrainBackground({ ...location, seenv: 255 }, x, y));
    const seen = level.flags.hero_memory !== false ? location.seenv : cansee(x, y);
    const remembered = level.flags.hero_memory !== false ? location.remembered_glyph
        : seen ? terrainBackground(location, x, y) : null;
    const displayed = location.disp_glyph;
    let glyph = !swallowed && displayed ? {
        ...displayed, ch: location.disp_ch, color: location.disp_color, decgfx: location.disp_decgfx,
    } : remembered ?? empty();
    let wasMonster = false;
    if (glyph.kind === 'monster' || glyph.kind === 'warning' || glyph.kind === 'effect') {
        glyph = remembered ?? empty();
        wasMonster = true;
    }
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y && candidate.tseen);
    const region = visibleRegionAt(game, x, y);
    const hidesObject = !keepObjects && glyph.kind === 'object';
    if ((hidesObject || glyph.kind === 'invisible')
        && keepTraps && trap && !terrainCoversObjectsAt(x, y))
        glyph = transientTrapGlyph(trap);
    const gas = !!region && glyph.kind === 'terrain'
        && (glyph.glyph === cmapToGlyph(CmapSymbol.cloud) || glyph.glyph === cmapToGlyph(CmapSymbol.poisoncloud));
    const removeObject = !keepObjects && glyph.kind === 'object';
    const removeTrap = !keepTraps && (glyph.kind === 'trap' || gas);
    const exposeRegion = !!region && wasMonster;
    if (removeObject || removeTrap || exposeRegion || glyph.kind === 'invisible') {
        if (!seen)
            glyph = region
                ? { ch: ' ', color: NO_COLOR, decgfx: false, kind: 'unexplored', glyph: GlyphOffset.unexplored } : empty();
        else if (keepTraps && region && (gas || wasMonster))
            glyph = trap ? transientTrapGlyph(trap)
                : { kind: 'terrain', terrainName: region.damage ? 'poison cloud' : 'cloud',
                    ch: '#', color: region.damage ? CLR_BRIGHT_GREEN : CLR_GRAY, decgfx: false,
                    glyph: cmapToGlyph(region.damage ? CmapSymbol.poisoncloud : CmapSymbol.cloud) };
        else {
            const mimic = monsterAtPosition(level, x, y);
            if (location.lastseentyp !== location.typ && mimic && M_AP_TYPE(mimic) === M_AP_FURNITURE) {
                const symbol = mimic.mappearance ?? CmapSymbol.stone;
                const appearance = cmapSymbolAppearance(symbol);
                glyph = { ...background(), ch: appearance.ch, decgfx: appearance.dec, glyph: cmapToGlyph(symbol) };
            }
            else
                glyph = background();
        }
    }
    return normalizeTerrainGlyph(glyph);
}
// back_to_glyph() retains the alternate character set with its glyph.
function terrainBackground(location, x, y) {
    const glyph = terrain_glyph(location, x, y);
    return { ...glyph, decgfx: glyph.dec };
}
function normalizeTerrainGlyph(glyph) {
    if (glyph.glyph !== cmapToGlyph(CmapSymbol.darkroom)
        && glyph.glyph !== cmapToGlyph(CmapSymbol.litcorr))
        return glyph;
    const corridor = glyph.glyph === cmapToGlyph(CmapSymbol.litcorr);
    const symbol = corridor ? CmapSymbol.corr : CmapSymbol.room;
    const appearance = cmapSymbolAppearance(symbol);
    return { kind: 'terrain', terrainName: corridor ? 'corridor' : 'floor of a room',
        ch: appearance.ch, color: NO_COLOR, decgfx: appearance.dec, glyph: cmapToGlyph(symbol) };
}
//# sourceMappingURL=terrain_view.js.map