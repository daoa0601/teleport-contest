// runmode.js — Shared runmode display cadence.
// C refs: hack.c:runmode_delay_output(), allmain.c:moveloop_core().
import { game } from './gstate.js';
import { flush_screen } from './display.js';
import { COLNO, MAX_TYPE, ROWNO } from './const.js';
import { classifyStatusTerrain } from './status_terrain.js';
// C refs: cmd.c set_move_cmd(run=1) and hack.c lookaround().
export function startRun(dx, dy, g = game, mode = 1) {
    g._runState = {
        dx, dy,
        mode,
        lastStrTurn: 0,
    };
    if (mode && !g.multi)
        g.multi = Math.max(COLNO, ROWNO);
    g.context.run = mode;
    g.context.mv = true;
    return g._runState;
}
// C hack.c:end_running(). An adjacent travel target first ends running
// without cancelling travel, then tests the step using ordinary move rules.
export function stopRun(g = game, andTravel = true) {
    const running = !!g.context.run;
    if (g.context.run && g.flags.time)
        g.context.time_botl = true;
    g.context.run = 0;
    if (g._runState?.mode === 8)
        delete g._runState.visited;
    if (running && g.flags.terrainstatus) {
        g.iflags.terrain_typ = MAX_TYPE;
        classifyStatusTerrain(g);
    }
    if (andTravel) {
        g._runState = null;
        g.context.mv = false;
        g.context.travel = false;
        g.context.travel1 = false;
    }
    if (g.multi > 0)
        g.multi = 0;
}
// C hack.c:findtravelpath() arrival (1404-1414): nomul(0) ends the run
// machinery and context.run is then restored to 8 "so domove run checks
// work".  The restored 8 lingers after travel ends: allmain.c:262 then
// suppresses time_botl on every later turn until a command resets run
// through reset_cmd_vars() or set_move_cmd(), so the status window's
// time field keeps its pre-arrival value across those turns.
export function arriveTravel(g = game, completedStep) {
    if (g._runState?.mode === 8)
        delete g._runState.visited;
    g._runState = null;
    g.context.mv = false;
    g.context.travel = false;
    g.context.travel1 = false;
    if (g.multi > 0)
        g.multi = 0;
    // A final step that ran to domove_core()'s tail keeps the pending time
    // repaint, which paints that turn -- even a refused pet swap, which
    // restores the hero but still reaches the tail (hack.c:2922-2923).
    // A step that returned early (an attack, or the 'm'-prefix pet bump
    // that nomul(0) let through on the final step) consumed that repaint
    // with its own message output, so no repaint is pending any more.
    if (!completedStep)
        g.context.time_botl = false;
}
export function runmodeDelayFrameCount(g = game, enabled = false, sourceTurn = g.moves || 0) {
    const runmode = String(g.flags?.runmode || 'run').toLowerCase();
    return !enabled
        || runmode === 'teleport' || runmode === 'tport'
        || ((runmode === 'run' || runmode === 'leap')
            && sourceTurn % 7 !== 0)
        ? 0 : runmode === 'crawl' ? 5 : 1;
}
export async function captureRunmodeDelay(g = game, enabled = false, sourceTurn = g.moves || 0, { preservePhysicalTopline = false, retainedTopline: suppliedRetainedTopline = null, } = {}) {
    const runmodeDelayFrames = runmodeDelayFrameCount(g, enabled, sourceTurn);
    if (!runmodeDelayFrames)
        return;
    g.context.time_botl = !!g.flags.time;
    const restoreTopline = (topline) => {
        if (!topline)
            return;
        for (const [col, cell] of topline.entries()) {
            g.nhDisplay?.setCell(col, 0, cell.ch, cell.color, cell.attr);
        }
    };
    const retainedTopline = preservePhysicalTopline && !g._pending_message
        ? (suppliedRetainedTopline
            || g.nhDisplay?.grid?.[0])?.map(cell => ({ ...cell }))
        : null;
    await flush_screen(1);
    const logicalTopline = retainedTopline
        ? g.nhDisplay?.grid?.[0]?.map(cell => ({ ...cell }))
        : null;
    restoreTopline(retainedTopline);
    g.nhDisplay?.setCursor((g.u?.ux ?? 1) - 1, (g.u?.uy ?? 0) + 1);
    try {
        for (let frame = 0; frame < runmodeDelayFrames; frame++)
            await g.animationFrame?.();
    }
    finally {
        // A retained physical prompt belongs only to the animation snapshot.
        // Leave the live tty grid in the logical post-flush state so a later
        // input boundary cannot inherit stale prompt text.
        restoreTopline(logicalTopline);
    }
}
//# sourceMappingURL=runmode.js.map