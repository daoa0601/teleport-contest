// Map updates when the hero gains or loses sight, and zap.c:flashburn().
// potion.c make_blinded()/toggle_blindness() live in potion.ts.
import { COLNO, ROWNO } from './const.js';
import { redrawMap, shieldeff, terrain_glyph } from './display.js';
import { plineWithContinuation } from './pline.js';
import { heroHasArtifactDefense } from './artifacts.js';
import { heroResistsBlindingLight } from './blinding_attack.js';
import { game, requireLiveGame } from './gstate.js';
import { makeBlinded } from './potion.js';
import { heroIsBlind } from './senses.js';
import { cansee, vision_recalc } from './vision.js';
export function rememberVisibleTerrain() {
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            const location = game.level?.at(x, y);
            if (!location || location.remembered_glyph || !cansee(x, y))
                continue;
            const terrain = terrain_glyph(location, x, y);
            location.remembered_glyph = { ...terrain, decgfx: terrain.dec };
        }
    }
}
export async function redrawSight() {
    game.vision_full_recalc = 1;
    await vision_recalc(0);
    await redrawMap();
}
// C zap.c:flashburn(). The duration is rolled by the caller even when resisted.
export async function flashBurn(duration, viaLightning = false, { state = game, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    if (!heroResistsBlindingLight(state)) {
        await publish('You are blinded by the flash!');
        await makeBlinded(duration, { state, talk: false, publish });
        if (!heroIsBlind(state))
            await publish('Your vision clears.');
        return true;
    }
    if (!viaLightning && heroHasArtifactDefense('blindness', state)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        return true;
    }
    return false;
}
//# sourceMappingURL=sight_change.js.map