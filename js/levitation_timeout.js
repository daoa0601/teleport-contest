// C ref: timeout.c levitation_dialogue() and the LEVITATION/FLYING expiry
// cases of nhTimeout().  The allmain turn hook owns the ordering: dialogue
// runs in the pre-countdown dialogue block (timeout.c:633-634), expiry runs
// in the property loop at C property order, levitation before flying.
import { ACCESSIBLE, IS_LAVA, IS_POOL, I_SPECIAL, Is_waterlevel, TIMEOUT, } from './const.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { captureLevitationState, hasCarriedProperty, hasInvokedProperty, hasWornProperty, propertyIsActive, refreshProperty, } from './properties.js';
import { floatHeroDown } from './terrain_movement.js';
import { stopHeroOccupation } from './occupation.js';
import { applyHeroLocationEffects } from './cmd.js';
import { surfaceName } from './terrain_name.js';
const LEVITATION_TEXTS = [
    'You float slightly lower.',
    'You wobble unsteadily %s the %s.',
];
// C timeout.c:352-378.  Message only; the timeout itself is not touched.
// Extrinsic levitation (worn ring or boots, invoked artifact, or the
// mid-drop carried source) suppresses the dialogue entirely, as does
// inaccessible terrain which is not pool or lava.
export async function levitationDialogue(state = game, { publish = plineWithContinuation } = {}) {
    const hero = state.u;
    const turns = hero.levitationTurns ?? 0;
    // -1 because the last message comes via float_down()
    const index = Math.floor((turns - 1) / 2);
    if (hasWornProperty('levitation', state)
        || hasInvokedProperty('levitation', state)
        || hasCarriedProperty('levitation', null, state))
        return null;
    const terrain = requireGameLevel(state).requireAt(hero.ux, hero.uy);
    const poolOrLava = IS_POOL(terrain.typ) || IS_LAVA(terrain.typ);
    if (!ACCESSIBLE(terrain.typ) && !poolOrLava)
        return null;
    if (turns % 2 === 1 && index > 0 && index <= LEVITATION_TEXTS.length) {
        const template = LEVITATION_TEXTS[LEVITATION_TEXTS.length - index];
        if (!template)
            throw new Error(`No levitation message for ${turns} turns remaining`);
        let message;
        if (template.includes('%')) {
            // C uses urgent_pline() for the danger warning.
            const danger = poolOrLava && !Is_waterlevel(hero.uz);
            message = template
                .replace('%s', danger ? 'over' : 'in')
                .replace('%s', danger
                ? surfaceName(hero.ux, hero.uy, state) : 'air');
        }
        else {
            message = template;
        }
        await publish(message, { urgent: template.includes('%') });
        await stopHeroOccupation(state, publish);
        return message;
    }
    return null;
}
// C timeout.c:670-672 countdown plus the LEVITATION expiry case 794-804.
// `previous` is captured before the decrement so float_down reports the
// pre-expiry movement state.
export async function advanceLevitationTimeout(state = game) {
    // Expiry lands the hero through the live float-down owner.
    requireLiveGame(state);
    const hero = state.u;
    const turns = hero.levitationTurns ?? 0;
    if (turns <= 0)
        return { active: false, expired: false, flyingBypassed: false };
    const previous = captureLevitationState(state);
    hero.levitationTurns = turns - 1;
    // C macros read live state after the countdown; keep the projected
    // hero fields in step before any expiry work.
    refreshProperty('levitation', state);
    if (hero.levitationTurns > 0)
        return { active: true, expired: false, flyingBypassed: false,
            turns: hero.levitationTurns };
    // Timed Flying expiring on the same turn would make float_down report
    // "stopped levitating and are now flying"; end it early to skip that
    // false takeover.  Assumes levitation is handled before flying
    // (timeout.c:795-802).
    let flyingBypassed = false;
    if ((hero.flyingTurns ?? 0) === 1) {
        hero.flyingTurns = 0;
        flyingBypassed = true;
        refreshProperty('flying', state);
    }
    const landed = await floatHeroDown(I_SPECIAL | TIMEOUT, 0, state, previous);
    return { active: false, expired: true, flyingBypassed, landed };
}
// C timeout.c:805-812.  was_flying is read at entry, matching the pre-loop
// capture when allmain runs this after advanceLevitationTimeout in C
// property order: the levitation path's only Flying change this turn is the
// flyingTurns === 1 bypass, which never reaches the expiry below.
export async function advanceFlyingTimeout(state = game, { publish = plineWithContinuation } = {}) {
    // Flight expiry publishes the landing and runs spot effects on the
    // live world.
    requireLiveGame(state);
    const hero = state.u;
    const turns = hero.flyingTurns ?? 0;
    if (turns <= 0)
        return { active: false, expired: false, landed: false };
    const wasFlying = propertyIsActive('flying', state);
    hero.flyingTurns = turns - 1;
    // C macros read live state after the countdown; keep the projected
    // hero fields in step before the landing checks.
    refreshProperty('flying', state);
    if (hero.flyingTurns > 0)
        return { active: true, expired: false, landed: false,
            turns: hero.flyingTurns };
    if (wasFlying && !propertyIsActive('flying', state)) {
        state.context.botl = true;
        await publish('You land.');
        await applyHeroLocationEffects(publish);
        return { active: false, expired: true, landed: true };
    }
    return { active: false, expired: true, landed: false };
}
//# sourceMappingURL=levitation_timeout.js.map