// runmode.js — Shared runmode display cadence.
// C refs: hack.c:runmode_delay_output(), allmain.c:moveloop_core().

import { game } from './gstate.js';
import { flush_screen } from './display.js';

export function runmodeDelayFrameCount(
    g = game, enabled = false, sourceTurn = g.moves || 0,
) {
    const runmode = String(g.flags?.runmode || 'run').toLowerCase();
    return !enabled
        || runmode === 'teleport' || runmode === 'tport'
        || ((runmode === 'run' || runmode === 'leap')
            && sourceTurn % 7 !== 0)
        ? 0 : runmode === 'crawl' ? 5 : 1;
}

export async function captureRunmodeDelay(
    g = game, enabled = false, sourceTurn = g.moves || 0,
    {
        preservePhysicalTopline = false,
        retainedTopline: suppliedRetainedTopline = null,
    } = {},
) {
    const runmodeDelayFrames = runmodeDelayFrameCount(
        g, enabled, sourceTurn,
    );
    if (!runmodeDelayFrames) return;

    const restoreTopline = topline => {
        if (!topline) return;
        for (let col = 0; col < topline.length; col++) {
            const cell = topline[col];
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
