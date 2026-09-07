// C hack.c:losehp(). Damage belongs to the body the hero currently occupies.

import { Upolyd } from './const.js';
import { plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { returnHeroToHumanForm } from './polyself.js';
import { stopRun } from './runmode.js';

export async function loseHeroHp(amount, killer, {
    state = game,
    publish = plineWithContinuation,
    die = finishHeroDeath,
} = {}) {
    const hero = state.u;
    const polymorphed = Upolyd(hero);
    const current = polymorphed ? 'mh' : 'uhp';
    const maximum = polymorphed ? 'mhmax' : 'uhpmax';
    stopRun(state);
    hero[current] -= amount;
    hero[maximum] = Math.max(hero[maximum], hero[current]);
    if (hero[current] > 0) return false;
    if (polymorphed) {
        const result = await returnHeroToHumanForm(state, { publish, die });
        return result.died;
    }
    return die({ killer });
}
