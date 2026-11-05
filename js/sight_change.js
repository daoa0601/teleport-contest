// Map updates when the hero gains or loses sight; zap.c:flashburn() moved to
// zap.ts.
// potion.c make_blinded()/toggle_blindness() live in potion.ts.
import { COLNO, ROWNO } from './const.js';
import { redrawMap, back_to_glyph } from './display.js';
import { game } from './gstate.js';
import { cansee, vision_recalc } from './vision.js';
export function rememberVisibleTerrain() {
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            const location = game.level?.at(x, y);
            if (!location || location.remembered_glyph || !cansee(x, y))
                continue;
            const terrain = back_to_glyph(location, x, y);
            location.remembered_glyph = { ...terrain, decgfx: terrain.dec };
        }
    }
}
export async function redrawSight() {
    game.vision_full_recalc = 1;
    await vision_recalc(0);
    await redrawMap();
}
//# sourceMappingURL=sight_change.js.map