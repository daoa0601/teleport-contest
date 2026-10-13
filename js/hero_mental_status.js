// Native potion.c make_confused(), make_stunned(), and make_hallucinated().
import { game, requireLiveGame } from './gstate.js';
import { TIMEOUT } from './const.js';
import { heroEyeCount, heroEyeName, heroHasEyes } from './body_parts.js';
import { makePlural, verbForSubject } from './object_grammar.js';
import { plineWithContinuation, see_monsters, see_objects, see_traps, swallowed } from './display.js';
import { heroIsUnaware } from './hero_sleep.js';
import { heroSpecies } from './hero_species.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { updateMealMimicry } from './meal_mimic.js';
import { staggerVerb } from './monster_hurtle.js';
import { grantWornProperty, hasCarriedProperty, hasInvokedProperty, hasWornProperty, propertyIsActive, refreshProperty, removeWornProperty, setPropertyTimeout, } from './properties.js';
export async function makeConfused(turns, { state = game, talk = true, publish = plineWithContinuation, } = {}) {
    const old = state.u.confusionTurns ?? 0;
    if (!turns && state.u.confusionTurns && talk && !heroIsUnaware(state)) {
        await publish(`You feel less ${heroIsHallucinating(state) ? 'trippy' : 'confused'} now.`);
    }
    if (!!turns !== !!old)
        state.context.botl = true;
    setPropertyTimeout('confusion', turns, state);
}
export async function makeStunned(turns, { state = game, talk = true, publish = plineWithContinuation, } = {}) {
    const old = propertyIsActive('stunned', state);
    if (talk && !heroIsUnaware(state)) {
        if (!turns && old) {
            await publish(`You feel ${heroIsHallucinating(state) ? 'less wobbly' : 'a bit steadier'} now.`);
        }
        else if (turns && !old) {
            await publish(state.u.usteed ? 'You wobble in the saddle.'
                : `You ${staggerVerb(heroSpecies(state)).replace(/s$/, '')}...`);
        }
    }
    if (!!turns !== old)
        state.context.botl = true;
    state.u.stunnedTurns = Math.max(0, Math.min(0x00ffffff, Math.trunc(turns)));
    refreshProperty('stunned', state);
}
// A resistance source changes EHalluc_resistance, not the intrinsic timeout.
// Native reports a change whenever a nonzero timeout accompanies that mask
// operation, even if another source still masks the effect.
export async function makeHallucinated(turns, { state = game, talk = true, publish = plineWithContinuation, resistanceSource = null, } = {}) {
    requireLiveGame(state);
    const hero = state.u;
    const old = hero.hallucinationTurns ?? 0;
    const speaking = talk && !heroIsUnaware(state);
    const verb = heroIsBlind(state) ? 'feels' : 'looks';
    let changed;
    if (resistanceSource) {
        changed = !!old;
        const { object, slot } = resistanceSource;
        if (turns)
            removeWornProperty('hallucinationResistance', object, slot, state);
        else
            grantWornProperty('hallucinationResistance', object, slot, state);
    }
    else {
        const extrinsic = hasWornProperty('hallucinationResistance', state)
            || hasCarriedProperty('hallucinationResistance', null, state)
            || hasInvokedProperty('hallucinationResistance', state);
        changed = !extrinsic && (!!old !== !!turns);
        hero.hallucinationTurns = Math.max(0, Math.min(TIMEOUT, Math.trunc(turns)));
        if (!changed && !hero.hallucinationTurns && old && speaking) {
            if (!heroHasEyes(state)) {
                const feeling = heroIsHallucinating(state) ? 'normal' : 'strange';
                await publish(`You have a ${feeling} feeling for a moment, then it passes.`);
            }
            else if (heroIsBlind(state)) {
                const eye = heroEyeName(state);
                const eyes = heroEyeCount(state) === 1 ? eye : makePlural(eye);
                await publish(`Your ${eyes} momentarily ${verbForSubject(eyes, 'itch')}.`);
            }
            else {
                await publish('Your vision seems to flatten for a moment but is normal now.');
            }
        }
    }
    if (changed) {
        if (!heroIsHallucinating(state))
            updateMealMimicry(state);
        if (hero.uswallow)
            swallowed(false);
        else {
            await see_monsters();
            see_objects();
            see_traps();
        }
        // The pinned TTY port has no persistent inventory window to refresh.
        state.context.botl = true;
        if (speaking)
            await publish(turns
                ? `Oh wow!  Everything ${verb} so cosmic!`
                : `Everything ${verb} SO boring now.`);
    }
    return changed;
}
//# sourceMappingURL=hero_mental_status.js.map