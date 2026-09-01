// Map updates when the hero gains or loses sight.
// C ref: potion.c toggle_blindness().

import { COLNO, ROWNO } from './const.js';
import { docrt, terrain_glyph } from './display.js';
import { game } from './gstate.js';
import { cansee, vision_recalc } from './vision.js';

export function rememberVisibleTerrain() {
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            const location = game.level?.at(x, y);
            if (!location || location.remembered_glyph || !cansee(x, y))
                continue;
            const terrain = terrain_glyph(location, x, y);
            location.remembered_glyph = {
                ch: terrain.ch,
                color: terrain.color,
                decgfx: terrain.dec,
            };
        }
    }
}

export async function redrawSight() {
    game.vision_full_recalc = 1;
    vision_recalc(0);
    await docrt();
}
