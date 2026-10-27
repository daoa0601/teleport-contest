// C detect.c:unconstrain_map(), browse_map(), map_monst(), map_redisplay().
import { COLNO, ROWNO } from './const.js';
import { cls, docrt, flush_screen, plineWithContinuation, show_glyph_cell, transientMonsterGlyph, under_ground, under_water, } from './display.js';
import { game } from './gstate.js';
import { selectMapPosition, showGetposInstructions, showGetposTip } from './getpos.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { NO_COLOR } from './terminal.js';
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
export async function browseDetectionMap(terrainMode, goal, { state = game, } = {}) {
    const hadTip = await showGetposTip(state);
    const savedAutoDescribe = state.iflags.autodescribe;
    const savedTerrainMode = state.iflags.terrainmode;
    state.iflags.autodescribe = true;
    state.iflags.terrainmode = terrainMode;
    try {
        await showGetposInstructions(state);
        if (hadTip)
            await plineWithContinuation(`Move cursor to ${goal}:`);
        // C browse_map() supplies no description callback: getpos.c
        // auto_describe() renders do_screen_description() with the browse's
        // terrainmode active, and that mode already gates which glyph
        // classes its symbol matching and lookat() detail report.
        await selectMapPosition({
            start: { x: state.u.ux, y: state.u.uy },
            prompt: state._pending_message,
            goal, force: false,
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
    // C map_redisplay() does not flush: docrt() only sets the status
    // redraw flag ("caller needs to call bot()"), so the restored map and
    // the status line both repaint at moveloop's once-per-input bot() +
    // curs_on_u(), after any monster phase and moves++ have settled.  An
    // eager flush here renders the turn counter one input early whenever
    // the suppressing run flag (travel leaves context.run at 8) blocks the
    // time update that would otherwise re-flag it.
}
//# sourceMappingURL=magic_map_display.js.map