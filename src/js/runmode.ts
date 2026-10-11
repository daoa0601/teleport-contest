// runmode.js — Shared runmode display cadence.
// C refs: hack.c:runmode_delay_output(), allmain.c:moveloop_core().

import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { DirectionalRunMode, DirectionalRunState } from './command_types.js';
import type { TerminalCell } from './terminal.js';
import { flush_screen } from './display.js';
import { COLNO, ROWNO } from './const.js';

// C refs: cmd.c set_move_cmd(run=1) and hack.c lookaround().
export function startRun(dx: number, dy: number, g: GameState = game, mode: DirectionalRunMode = 1): DirectionalRunState {
    g._runState = {
        dx, dy,
        mode,
        lastStrTurn: 0,
    };
    if (mode && !g.multi) g.multi = Math.max(COLNO, ROWNO);
    g.context.run = mode;
    g.context.mv = true;
    return g._runState;
}

export function stopRun(g: GameState = game): void {
    g._runState = null;
    g.context.run = 0;
    g.context.mv = false;
    g.context.travel = false;
    g.context.travel1 = false;
    if (g.multi > 0) g.multi = 0;
}

export function runmodeDelayFrameCount(
    g: GameState = game, enabled = false, sourceTurn = g.moves || 0,
) {
    const runmode = String(g.flags?.runmode || 'run').toLowerCase();
    return !enabled
        || runmode === 'teleport' || runmode === 'tport'
        || ((runmode === 'run' || runmode === 'leap')
            && sourceTurn % 7 !== 0)
        ? 0 : runmode === 'crawl' ? 5 : 1;
}

export async function captureRunmodeDelay(
    g: GameState = game, enabled = false, sourceTurn = g.moves || 0,
    {
        preservePhysicalTopline = false,
        retainedTopline: suppliedRetainedTopline = null,
    }: { preservePhysicalTopline?: boolean; retainedTopline?: readonly TerminalCell[] | null } = {},
): Promise<void> {
    const runmodeDelayFrames = runmodeDelayFrameCount(
        g, enabled, sourceTurn,
    );
    if (!runmodeDelayFrames) return;

    const restoreTopline = (topline: readonly TerminalCell[] | null | undefined): void => {
        if (!topline) return;
        for (const [col, cell] of topline.entries()) {
            g.nhDisplay?.setCell(
                col, 0, cell.ch, cell.color, cell.attr,
            );
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
    g.nhDisplay?.setCursor(
        (g.u?.ux ?? 1) - 1,
        (g.u?.uy ?? 0) + 1,
    );
    try {
        for (let frame = 0; frame < runmodeDelayFrames; frame++)
            await g.animationFrame?.();
    } finally {
        // A retained physical prompt belongs only to the animation snapshot.
        // Leave the live tty grid in the logical post-flush state so a later
        // input boundary cannot inherit stale prompt text.
        restoreTopline(logicalTopline);
    }
}
