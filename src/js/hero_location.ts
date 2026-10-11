// Same-level u_on_newpos(), shared by hero and swallower relocation.
// Level transitions own their separate old-position and terrain bookkeeping.

import { senseBuriedObjects } from './buried_object.js';
import { see_nearby_objects } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';

export async function placeHeroOnLevel(x: number, y: number, state: GameState = game): Promise<void> {
    requireLiveGame(state);
    const hero = state.u;
    hero.ux = x;
    hero.uy = y;
    hero.uundetected = 0;
    if (hero.usteed) {
        hero.usteed.mx = x;
        hero.usteed.my = y;
    }
    if (!heroIsBlind(state) && !heroIsHallucinating(state) && !hero.uswallow)
        see_nearby_objects();
    await senseBuriedObjects(state);
}
