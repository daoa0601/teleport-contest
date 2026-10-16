// Native m_throw() and bhit() tmp_at flight. Impacts run between frames, so a suspended
// hit message retains the last flight cell until the input resumes.
import { flush_screen, lastDirtyMapCursor, transientObjectGlyph } from './display.js';
import { TemporaryMapEffect } from './temporary_map_effect.js';
import { isok } from './const.js';
import type { PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Position } from './map_types.js';

export function monsterProjectileDisplay(object: GameObject, state: PlayingGameState, {
    tethered = false,
}: { tethered?: boolean } = {}) {
    const glyph = transientObjectGlyph(object);
    const topRow = state.nhDisplay?.grid[0]?.map(cell => ({ ...cell }));
    const retainedTopline = !state._pending_message && topRow?.some(cell => cell.ch !== ' ') ? topRow : null;
    const effect = new TemporaryMapEffect(tethered ? 'tether' : 'flash', glyph);
    let first = true;

    async function flushFrame(): Promise<void> {
        const cursor = lastDirtyMapCursor();
        await flush_screen(1);
        if (retainedTopline && !state._pending_message) {
            for (const [column, cell] of retainedTopline.entries())
                state.nhDisplay?.setCell(column, 0, cell.ch, cell.color, cell.attr);
        }
        if (cursor) state.nhDisplay?.setCursor(...cursor);
        await state.animationFrame?.();
    }

    function clear(): void {
        effect.clear();
    }

    return {
        glyph,
        async show(position: Position): Promise<void> {
            if (!isok(position.x, position.y)) return;
            if (first) await effect.start();
            first = false;
            effect.draw(position.x, position.y);
            await flushFrame();
        },
        async backtrack(): Promise<void> {
            // DISP_END/BACKTRACK moves inward before the first return frame.
            while (effect.retract()) {
                await flushFrame();
            }
            clear();
        },
        clear,
    };
}
