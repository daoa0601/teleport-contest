// Native display.c:tmp_at(). Each active effect owns its saved positions,
// so nested effects keep independent trails without global display state.
import { COLNO, isok } from './const.js';
import { flush_screen, newsym, show_glyph_cell, zapdir_to_glyph } from './display.js';
import type { DisplayGlyph } from './display.js';
import { game } from './gstate.js';
import type { Position } from './map_types.js';
import { cansee } from './vision.js';

export type TemporaryGlyphStyle = 'beam' | 'all' | 'tether' | 'flash' | 'always';

export class TemporaryMapEffect {
    private readonly positions: Position[] = [];

    constructor(private readonly style: TemporaryGlyphStyle, private glyph: DisplayGlyph) {}

    async start(): Promise<void> {
        await flush_screen(0);
    }

    changeGlyph(glyph: DisplayGlyph): void {
        this.glyph = glyph;
    }

    // Callers with their own frame publication draw before flushing.
    // show() supplies tmp_at()'s ordinary flush boundary.
    async draw(x: number, y: number): Promise<boolean> {
        if (!isok(x, y)) return false;
        if (this.style === 'beam' || this.style === 'all' || this.style === 'tether') {
            if (this.style === 'beam' && !cansee(x, y)) return false;
            if (this.positions.length >= COLNO * 2) return false;
            if (this.style === 'tether') {
                const previous = this.positions.at(-1);
                if (previous) {
                    const tether = zapdir_to_glyph(Math.sign(game.u.ux - previous.x),
                        Math.sign(game.u.uy - previous.y), 2);
                    await this.paint(previous.x, previous.y, tether);
                }
            }
        } else {
            await this.clear();
            if (this.style === 'flash' && !cansee(x, y)) return false;
        }
        this.positions.push({ x, y });
        await this.paint(x, y, this.glyph);
        return true;
    }

    async show(x: number, y: number): Promise<void> {
        if (await this.draw(x, y)) await flush_screen(0);
    }

    // A returning tether restores its far end before advancing the weapon.
    async retract(): Promise<boolean> {
        if (this.style !== 'tether' || this.positions.length < 2) return false;
        const end = this.positions.pop();
        const previous = this.positions.at(-1);
        if (!end || !previous) throw new Error('A returning tether needs two saved positions');
        await newsym(end.x, end.y);
        await this.paint(previous.x, previous.y, this.glyph);
        return true;
    }

    async end(backtrack = false): Promise<void> {
        try {
            if (backtrack) {
                while (await this.retract()) {
                    await flush_screen(0);
                    await game.animationFrame?.();
                }
            }
        } finally {
            await this.clear();
        }
    }

    async clear(): Promise<void> {
        // Keep repeated coordinates: each native saved entry is restored,
        // including its independent hallucinated map projection.
        for (const position of this.positions) await newsym(position.x, position.y);
        this.positions.length = 0;
    }

    private async paint(x: number, y: number, glyph: DisplayGlyph): Promise<void> {
        await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx,
            glyph.attr ?? 0, glyph);
    }
}
