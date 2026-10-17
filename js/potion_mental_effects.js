// C potion.c: mental, attribute, and incapacitating potion effects.
// The drink transaction owns opening, knowledge, naming, and consumption.
import { heroHasFreeAction } from './armor.js';
import { adjustAttribute, attributeChangeMessage, exerciseAttribute, } from './attrib.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { heroFootName } from './body_parts.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { A_CON, A_DEX, A_INT, A_MAX, A_STR, A_WIS, Is_airlevel, Is_waterlevel, M_SEEN_SLEEP } from './const.js';
import { flushPendingTopline, plineWithContinuation as pline } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { healHero } from './hero_healing.js';
import { makeConfused, makeHallucinated } from './hero_mental_status.js';
import { putHeroToSleep } from './hero_sleep.js';
import { updateHeroHunger } from './hunger.js';
import { doEnlightenmentEffect, showEnlightenment } from './insight.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance } from './monster_perception.js';
import { POT_BLINDNESS, POT_BOOZE, POT_CONFUSION, POT_ENLIGHTENMENT, POT_GAIN_ABILITY, POT_HALLUCINATION, POT_PARALYSIS, POT_SLEEPING, } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { hasIntrinsicProperty, hasWornProperty, propertyIsActive } from './properties.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { blindnessBlocked, heroIsBlind, heroIsHallucinating } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { surfaceName } from './terrain_name.js';
export async function applyPotionMentalEffect(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    let unknown = 0;
    let nothing = false;
    switch (source.otyp) {
        case POT_HALLUCINATION:
            nothing = await hallucinationEffect(source, state);
            break;
        case POT_BOOZE:
            unknown = 1;
            await boozeEffect(source, state);
            break;
        case POT_ENLIGHTENMENT:
            if (source.cursed) {
                unknown = 1;
                await pline('You have an uneasy feeling...');
                await exerciseAttribute(A_WIS, false, state);
            }
            else {
                if (source.blessed) {
                    await increaseAttribute(A_INT, true, state);
                    await increaseAttribute(A_WIS, true, state);
                }
                await doEnlightenmentEffect();
            }
            break;
        case POT_PARALYSIS:
            await paralysisEffect(source, state);
            break;
        case POT_SLEEPING:
            await sleepingEffect(source, state);
            break;
        case POT_CONFUSION:
            if ((state.u.confusionTurns ?? 0) > 0) {
                nothing = true;
            }
            else if (heroIsHallucinating(state)) {
                await pline('What a trippy feeling!');
                unknown = 1;
            }
            else {
                await pline('Huh, What?  Where am I?');
            }
            await makeConfused((state.u.confusionTurns || 0)
                + rn1(7, 16 - 8 * blessing(source)), { state, talk: false });
            break;
        case POT_GAIN_ABILITY:
            if (source.cursed) {
                await pline('Ulch!  That potion tasted foul!');
                unknown = 1;
            }
            else if (state.u.fixedAbilities
                || propertyIsActive('sustainAbility', state)) {
                nothing = true;
            }
            else {
                for (let attempt = 0; attempt < A_MAX; attempt++) {
                    const attribute = source.blessed ? attempt : rn2(A_MAX);
                    const change = await increaseAttribute(attribute, !!source.blessed || attempt === A_MAX - 1, state);
                    if (change.changed && !source.blessed)
                        break;
                }
            }
            break;
        case POT_BLINDNESS: {
            const blind = heroIsBlind(state);
            nothing = blind || blindnessBlocked(state)
                && (!!state.u.permaBlind || !!state.u.blindTurns || hasIntrinsicProperty('blinded', null, state)
                    || hasWornProperty('blinded', state));
            await makeBlinded((state.u.blindTurns || 0)
                + rn1(200, 250 - 125 * blessing(source)), { state, talk: !blind });
            break;
        }
        default:
            return { handled: false, unknown: 0, nothing: false, heroDied: false };
    }
    return { handled: true, unknown, nothing, heroDied: !!state.program_state.gameover };
}
function blessing(source) {
    return source.blessed ? 1 : source.cursed ? -1 : 0;
}
async function hallucinationEffect(source, state) {
    if (state.u.hallucinationResistance
        || propertyIsActive('hallucinationResistance', state))
        return true;
    const nothing = heroIsHallucinating(state);
    await makeHallucinated((state.u.hallucinationTurns || 0)
        + rn1(200, 600 - 300 * blessing(source)), { state });
    if (source.blessed && !rn2(3) || !source.cursed && !rn2(6)) {
        await pline('You perceive yourself...');
        await flushPendingTopline();
        await showEnlightenment({ basic: false, magic: true });
        await pline('Your awareness re-normalizes.');
        await exerciseAttribute(A_WIS, true, state);
    }
    return nothing;
}
async function boozeEffect(source, state) {
    const dilution = source.odiluted ? 'watered down ' : '';
    const taste = heroIsHallucinating(state) ? 'dandelion wine' : 'liquid fire';
    await pline(`Ooph!  This tastes like ${dilution}${taste}!`);
    if (!source.blessed) {
        await makeConfused((state.u.confusionTurns || 0)
            + d(2 + (state.u.uhs || 0), 8), { state, talk: false });
    }
    if (!source.odiluted)
        await healHero(1, 0, { state });
    // peffect_booze adds nutrition directly; it does not call lesshungry's
    // fullness/choking checks, even when drunk on a full stomach.
    state.u.uhunger = (state.u.uhunger ?? 900) + 10 * (2 + blessing(source));
    await updateHeroHunger(false, { state });
    await exerciseAttribute(A_WIS, false, state);
    if (source.cursed) {
        await pline('You pass out.');
        state._helplessTurns = rnd(15);
        state._helplessDoneMessage = 'You awake with a headache.';
    }
}
async function paralysisEffect(source, state) {
    if (heroHasFreeAction(state)) {
        await pline('You stiffen momentarily.');
        return;
    }
    if (propertyIsActive('levitation', state) || Is_airlevel(state.u.uz)
        || Is_waterlevel(state.u.uz)) {
        await pline('You are motionlessly suspended.');
    }
    else if (state.u.usteed) {
        await pline('You are frozen in place!');
    }
    else {
        await pline(`Your ${makePlural(heroFootName(state))} are frozen to the ${surfaceName(state.u.ux, state.u.uy, state)}!`);
    }
    const turns = rn1(10, 25 - 12 * blessing(source));
    if ((state._helplessTurns || 0) <= turns) {
        endVoluntaryMultiTurn(state);
        state.u.invulnerable = false;
        state.u.usleep = 0;
        state._helplessTurns = turns;
    }
    state._helplessReason = 'frozen by a potion';
    state._helplessDoneMessage = 'You can move again.';
    await exerciseAttribute(A_DEX, false, state);
}
async function sleepingEffect(source, state) {
    if (state.u.sleepResistance
        || propertyIsActive('sleepResistance', state) || heroHasFreeAction(state)) {
        monstersObserveHeroResistance(M_SEEN_SLEEP, state);
        await pline('You yawn.');
    }
    else {
        await pline('You suddenly fall asleep!');
        monstersForgetHeroResistance(M_SEEN_SLEEP, state);
        putHeroToSleep(rn1(10, 25 - 12 * blessing(source)), { state });
    }
}
// msgflg -1 suppresses failed attempts but still reports successful changes.
async function increaseAttribute(attribute, reportFailure, state) {
    const change = adjustAttribute(attribute, 1, state);
    if (change.changed || reportFailure
        && (change.blockedByDunceCap || state.flags.verbose)) {
        const message = attributeChangeMessage(attribute, change, state);
        if (message)
            await pline(message);
    }
    if (change.changed && state._moveloopStarted
        && (attribute === A_STR || attribute === A_CON)) {
        await reportHeroEncumbrance(state);
    }
    return change;
}
//# sourceMappingURL=potion_mental_effects.js.map