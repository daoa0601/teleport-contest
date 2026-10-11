// Native potion.c:healup(). Healing applies to the body currently occupied.

import type { GameState } from './game_state.js';
import { Upolyd } from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { makeDeaf } from './hero_hearing.js';
import { cureHeroSicknessWithMessages, cureHeroVomiting } from './hero_illness.js';
import { heroIsUnaware } from './hero_sleep.js';
import { makeBlinded } from './sight_change.js';

export async function healHero(amount: number, extraMaximum: number, {
    state = game, cureSickness = false, cureBlindness = false,
}: { state?: GameState; cureSickness?: boolean; cureBlindness?: boolean } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    const polymorphed = Upolyd(hero);
    if (amount) {
        const hp = polymorphed ? 'mh' : 'uhp';
        const maximum = polymorphed ? 'mhmax' : 'uhpmax';
        hero[hp] += amount;
        if (hero[hp] > hero[maximum]) {
            hero[maximum] += extraMaximum;
            hero[hp] = hero[maximum];
            if (!polymorphed) hero.uhppeak = Math.max(hero.uhppeak || 0, hero.uhpmax);
        }
    }
    if (cureBlindness) {
        hero.ucreamed = 0;
        await makeBlinded(0, { state });
        await makeDeaf(0, { state });
    }
    if (cureSickness) {
        if (cureHeroVomiting(state) && !heroIsUnaware(state))
            await plineWithContinuation('You feel much less nauseated now.');
        await cureHeroSicknessWithMessages(state);
    }
}
