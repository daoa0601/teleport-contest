// C dungeon.c:u_on_newpos(), shared by hero and swallower relocation.

import { senseBuriedObjects } from './buried_object.js';
import { map_location, see_nearby_objects } from './display.js';
import { MAX_TYPE } from './const.js';
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
    if (hero.uz?.dnum !== hero.uz0?.dnum || hero.uz?.dlevel !== hero.uz0?.dlevel) {
        hero.ux0 = x;
        hero.uy0 = y;
        map_location(x, y, false);
        state.iflags.terrain_typ = MAX_TYPE;
    } else if (!heroIsBlind(state) && !heroIsHallucinating(state) && !hero.uswallow)
        see_nearby_objects();
    await senseBuriedObjects(state);
}
