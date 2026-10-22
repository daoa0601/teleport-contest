// C display.c:set_mimic_blocking() and potion.c:peffect_see_invisible().
import { newsym, see_monsters } from './display.js';
import { game, requireLiveGame, requireGameLevel } from './gstate.js';
import { grantIntrinsicProperty, refreshProperty } from './properties.js';
import { TIMEOUT } from './const.js';
import { mimicBlocksLight, vision_note_blocker_change } from './vision.js';

export async function refreshHeroSeeing({ state = game } = {}) {
    await refreshInvisibleMonsters({ state });
    newsym(state.u.ux, state.u.uy);
}

// see_monsters() includes the hero. Rings add a second hero redraw only
// when the ring makes the hero visible or invisible to themselves.
export async function refreshInvisibleMonsters({ state = game } = {}) {
    setMimicBlocking({ state });
    await see_monsters();
}

// C set_mimic_blocking() only updates vision blockers; callers redraw later.
export function setMimicBlocking({ state = game } = {}) {
    requireLiveGame(state);
    for (const monster of requireGameLevel(state).monsters) {
        if (!monster.dead && monster.minvis && mimicBlocksLight(monster))
            vision_note_blocker_change(monster.mx, monster.my);
    }
}

export async function grantHeroSeeInvisible({
    permanent = false, duration = 0, state = game,
} = {}) {
    requireLiveGame(state);
    if (permanent) grantIntrinsicProperty('seeInvisible', 'outside', state);
    else {
        state.u.seeInvisibleTurns = Math.min(TIMEOUT,
            (state.u.seeInvisibleTurns || 0) + duration);
        refreshProperty('seeInvisible', state);
    }
    await refreshHeroSeeing({ state });
}
