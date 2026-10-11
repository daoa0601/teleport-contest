// C mhitu.c:gulp_blnd_check() and the AD_BLND effect within gulpmu().
import { heroHasEyes } from './body_parts.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { resolveHeroEngulf } from './hero_engulf.js';
import { heroIsUnaware } from './hero_sleep.js';
import { AD_BLND, AT_ENGL } from './monster_attack_types.js';
import { MONSTER_ATTACKS } from './monster_data.js';
import { d } from './rng.js';
import { blindfolded, heroIsBlind, heroIsBlinded, setHeroBlindnessTurns, } from './senses.js';
import { makeBlinded } from './sight_change.js';
export async function gulpBlindnessCheck({ state = game, publish = plineWithContinuation, } = {}) {
    const hero = state.u;
    if (heroIsBlinded(state) || !hero.uswallow || !engulfCanBlindHero(state))
        return { triggered: false, died: false };
    const monster = hero.ustuck;
    if (!monster)
        throw new Error('Swallowed hero has no swallowing monster');
    const attacks = MONSTER_ATTACKS[monster.mnum];
    if (!attacks)
        throw new Error(`Swallowing species ${monster.mnum} has no attack data`);
    const attack = attacks.find(([method, damage]) => method === AT_ENGL && damage === AD_BLND);
    if (!attack)
        return { triggered: false, died: false };
    // The immediate exposure is not another elapsed turn inside the monster.
    if (hero.uswldtim === undefined)
        throw new Error('Swallowed hero has no digestion timeout');
    hero.uswldtim++;
    const duration = d(attack[2], attack[3]);
    const result = await resolveHeroEngulf(monster, AD_BLND, duration, { state, publish });
    return { triggered: true, died: result.died };
}
export async function applyEngulfBlindness(duration, { state = game, publish = plineWithContinuation, } = {}) {
    if (!engulfCanBlindHero(state))
        return;
    if (!heroIsBlind(state)) {
        const wasBlinded = heroIsBlinded(state);
        if (!wasBlinded)
            await publish("You can't see in here!");
        await makeBlinded(duration, { state, talk: false, publish });
        if (!wasBlinded && !heroIsBlind(state))
            await publish('Your vision quickly clears.');
    }
    else {
        setHeroBlindnessTurns((state.u.blindTurns ?? 0) + 1, state);
    }
}
// C mondata.c:can_blnd(AT_ENGL). Cancellation and light resistance do not help.
function engulfCanBlindHero(state) {
    return heroHasEyes(state) && !blindfolded(state)
        && !heroIsUnaware(state) && !state.u.ucreamed;
}
//# sourceMappingURL=engulf_blindness.js.map