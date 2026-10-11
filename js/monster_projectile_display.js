// Native m_throw's tmp_at flight. Impacts run between frames, so a suspended
// hit message retains the last flight cell until the input resumes.
import { flush_screen, lastDirtyMapCursor, newsym, show_glyph_cell, transientObjectGlyph } from './display.js';
import { COLNO, isok } from './const.js';
import { CLR_WHITE } from './terminal.js';
import { cansee } from './vision.js';
export function monsterProjectileDisplay(object, state, { tethered = false, } = {}) {
    const glyph = transientObjectGlyph(object);
    const topRow = state.nhDisplay?.grid[0]?.map(cell => ({ ...cell }));
    const retainedTopline = !state._pending_message && topRow?.some(cell => cell.ch !== ' ') ? topRow : null;
    let previous = null;
    const trail = [];
    let first = true;
    function drawObject(position) {
        show_glyph_cell(position.x, position.y, glyph.ch, glyph.color, glyph.decgfx, glyph.attr);
    }
    async function flushFrame() {
        const cursor = lastDirtyMapCursor();
        await flush_screen(1);
        if (retainedTopline && !state._pending_message) {
            for (const [column, cell] of retainedTopline.entries())
                state.nhDisplay?.setCell(column, 0, cell.ch, cell.color, cell.attr);
        }
        if (cursor)
            state.nhDisplay?.setCursor(...cursor);
        await state.animationFrame?.();
    }
    function clear() {
        for (const position of trail)
            newsym(position.x, position.y);
        trail.length = 0;
        if (previous)
            newsym(previous.x, previous.y);
        previous = null;
    }
    return {
        async show(position) {
            if (!isok(position.x, position.y))
                return;
            const visible = cansee(position.x, position.y);
            if (first && (visible || tethered))
                await flush_screen(1);
            first = false;
            if (tethered) {
                if (trail.length >= COLNO * 2)
                    return;
                const end = trail.at(-1);
                if (end)
                    drawTether(end, state);
                trail.push({ ...position });
                drawObject(position);
            }
            else {
                if (previous)
                    newsym(previous.x, previous.y);
                previous = null;
                if (visible) {
                    drawObject(position);
                    previous = position;
                }
            }
            await flushFrame();
        },
        async backtrack() {
            // DISP_END/BACKTRACK moves inward before the first return frame.
            while (trail.length > 1) {
                const end = trail.pop();
                const next = trail.at(-1);
                if (!end || !next)
                    throw new Error('A returning tether needs two path cells.');
                newsym(end.x, end.y);
                drawObject(next);
                await flushFrame();
            }
            clear();
        },
        clear,
    };
}
function drawTether(position, state) {
    // Pinned tether_glyph() uses the hero's position even for a monster's aklys.
    const dx = Math.sign(state.u.ux - position.x);
    const dy = Math.sign(state.u.uy - position.y);
    if (dx === dy)
        show_glyph_cell(position.x, position.y, '\\', CLR_WHITE);
    else if (dx && dy)
        show_glyph_cell(position.x, position.y, '/', CLR_WHITE);
    else if (dx)
        show_glyph_cell(position.x, position.y, 'q', CLR_WHITE, true);
    else
        show_glyph_cell(position.x, position.y, 'x', CLR_WHITE, true);
}
//# sourceMappingURL=monster_projectile_display.js.map