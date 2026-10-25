// C detect.c:unconstrain_map(), browse_map(), map_monst(), map_redisplay().
import { COLNO, ROWNO, TER_MAP, TER_MON, TER_OBJ, TER_TRP } from './const.js';
import { displayedTrapDescription } from './pager_features.js';
import { farlookLocationDescription } from './cmd.js';
import { canSpotHeroSelf, cls, docrt, flush_screen, glyphAt, plineWithContinuation, show_glyph_cell, transientMonsterGlyph, under_ground, under_water, } from './display.js';
import { game } from './gstate.js';
import { selectMapPosition, showGetposInstructions, showGetposTip } from './getpos.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { objectName } from './objnam.js';
import { objectClassForType } from './object_knowledge.js';
import { NO_COLOR } from './terminal.js';
import { requireGameLevel } from './gstate.js';
const LONG_WORM = MONSTER_NAME.indexOf('long worm');
const LONG_WORM_TAIL = MONSTER_NAME.indexOf('long worm tail');
export function unconstrainMap(state = game) {
    const saved = { uinwater: state.u.uinwater, uburied: state.u.uburied,
        uswallow: state.u.uswallow, underwater: state.underwater };
    state.iflags.save_uswallow = !!saved.uswallow;
    state.u.uinwater = state.u.uburied = state.u.uswallow = 0;
    state.underwater = false;
    return { saved, changed: !!(saved.uinwater || saved.underwater
            || saved.uburied || saved.uswallow) };
}
export function reconstrainMap({ saved }, state = game) {
    state.iflags.save_uswallow = false;
    if (saved.uinwater === undefined)
        delete state.u.uinwater;
    else
        state.u.uinwater = saved.uinwater;
    if (saved.uburied === undefined)
        delete state.u.uburied;
    else
        state.u.uburied = saved.uburied;
    if (saved.uswallow === undefined)
        delete state.u.uswallow;
    else
        state.u.uswallow = saved.uswallow;
    if (saved.underwater === undefined)
        delete state.underwater;
    else
        state.underwater = saved.underwater;
}
export async function clearDetectionMap(_state = game) {
    await cls();
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++)
            show_glyph_cell(x, y, ' ', NO_COLOR, false, 0, { kind: 'unexplored' });
}
export function mapDetectedMonster(monster, showTail, state = game) {
    // Ghosts retain their space symbol. The detected glyph makes that space
    // visible through tty inverse video, independently of pet highlighting.
    const detected = MONSTER_SYMBOL[monster.mnum] === 54;
    const monsterState = detected ? 'detected' : monster.mtame ? 'pet' : 'normal';
    const glyph = transientMonsterGlyph(monster, monsterState);
    const inverse = state.flags.use_inverse !== false
        && state.iflags.use_inverse !== false && state.iflags.wc_inverse !== false;
    const attribute = detected ? inverse ? 1 : 0
        : monster.mtame && state.flags.hilite_pet ? 1 : 0;
    show_glyph_cell(monster.mx, monster.my, glyph.ch, glyph.color, false, attribute, glyph);
    if (!showTail || monster.mnum !== LONG_WORM)
        return;
    const tail = transientMonsterGlyph({ mnum: LONG_WORM_TAIL, female: !!monster.female }, monster.mtame ? 'pet' : 'normal');
    for (const segment of [...(monster.wormSegments || [])].reverse()) {
        if (!segment.x)
            continue;
        show_glyph_cell(segment.x, segment.y, tail.ch, tail.color, false, attribute, tail);
    }
}
async function detectionDescription(x, y, terrainMode, objects, state) {
    const glyph = glyphAt(x, y, state);
    if (state.iflags.save_uswallow && x === state.u.ux && y === state.u.uy
        && canSpotHeroSelf() && (glyph?.kind === 'monster'
        || glyph?.kind === 'object' || glyph?.kind === 'trap'))
        return farlookLocationDescription(x, y);
    if (glyph?.kind === 'invisible')
        return 'unseen creature';
    if (glyph?.kind === 'object' && (terrainMode & TER_OBJ)) {
        const detected = objects?.get(`${x},${y}`);
        const object = detected?.otyp === glyph.otyp ? detected : null;
        return objectName(object || { otyp: glyph.otyp,
            oclass: objectClassForType(glyph.otyp), quan: 1, quantity: 1 });
    }
    if (glyph?.kind === 'monster' && (terrainMode & TER_MON)) {
        return farlookLocationDescription(x, y);
    }
    if (glyph?.kind === 'trap' && (terrainMode & TER_TRP)) {
        const trapType = glyph.trapType || requireGameLevel(state).traps.find(trap => trap.tx === x && trap.ty === y)?.ttyp;
        return trapType === undefined ? 'trap' : displayedTrapDescription(trapType, x, y);
    }
    if (!(terrainMode & TER_MAP) || glyph?.kind === 'unexplored')
        return 'unexplored area';
    return farlookLocationDescription(x, y);
}
export async function browseDetectionMap(terrainMode, goal, { objects = null, state = game, } = {}) {
    const hadTip = await showGetposTip(state);
    const savedAutoDescribe = state.iflags.autodescribe;
    const savedTerrainMode = state.iflags.terrainmode;
    state.iflags.autodescribe = true;
    state.iflags.terrainmode = terrainMode;
    try {
        await showGetposInstructions(state);
        if (hadTip)
            await plineWithContinuation(`Move cursor to ${goal}:`);
        await selectMapPosition({
            start: { x: state.u.ux, y: state.u.uy },
            prompt: state._pending_message,
            goal, force: false,
            describe: (x, y) => detectionDescription(x, y, terrainMode, objects, state),
        });
    }
    finally {
        if (savedAutoDescribe === undefined)
            delete state.iflags.autodescribe;
        else
            state.iflags.autodescribe = savedAutoDescribe;
        if (savedTerrainMode === undefined)
            delete state.iflags.terrainmode;
        else
            state.iflags.terrainmode = savedTerrainMode;
    }
}
export async function redisplayDetectionMap(constraints, state = game) {
    reconstrainMap(constraints, state);
    await docrt();
    // C map_redisplay() defers a full restricted redraw: the turn's
    // under_water(0)/under_ground(0) clears the map again instead of
    // repairing only the previous three-by-three viewport.
    if (state.u.uinwater || state.underwater)
        await under_water(2);
    if (state.u.uburied)
        await under_ground(2);
    await flush_screen(1);
}
//# sourceMappingURL=magic_map_display.js.map