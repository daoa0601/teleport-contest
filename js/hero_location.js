// Same-level u_on_newpos(), shared by hero and swallower relocation.
// Level transitions own their separate old-position and terrain bookkeeping.
import { senseBuriedObjects } from './buried_object.js';
import { see_nearby_objects } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
export async function placeHeroOnLevel(x, y, state = game) {
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
//# sourceMappingURL=hero_location.js.map