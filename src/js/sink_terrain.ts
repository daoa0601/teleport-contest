// Converting a sink to a fountain by breaking it.
// C ref: fountain.c breaksink().

import { FOUNTAIN, F_LOOTED, SINK } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { countLevelFeatures } from './mklev.js';
import { cansee } from './vision.js';
import type { GameState } from './game_state.js';

export async function breakSinkAt(x: number, y: number, state: GameState = game) {
    const level = state.level;
    const location = level?.at(x, y);
    if (!level || !location || location.typ !== SINK) return false;
    if (cansee(x, y) || (state.u?.ux === x && state.u?.uy === y)) {
        await plineWithContinuation('The pipes break!  Water spurts out!');
    }
    location.typ = FOUNTAIN;
    // set_levltyp() recounts the level's fountains and sinks from the map.
    countLevelFeatures(state);
    location.looted = F_LOOTED;
    location.blessedftn = 0;
    newsym(x, y);
    return true;
}
