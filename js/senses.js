// senses.js — Derived hero blindness and deafness state.
// C refs: youprop.h Blind/Deaf, u_init.c:u_init_misc(), potion.c.
import { game } from './gstate.js';
import { FAINTED, TIMEOUT } from './const.js';
import { heroHasInvoluntaryDelay } from './cmd.js';
import { heroIsUnconscious } from './trap.js';
import { LENSES } from './object_data.js';
import { artifactById } from './artifact.js';
import { hasIntrinsicProperty, propertyIsActive } from './properties.js';
// C youprop.h:Unaware — gm.multi < 0 && (unconscious() || is_fainted()),
// using the current involuntary-delay representation.
export function heroIsUnaware(state = game) {
    return heroHasInvoluntaryDelay(state)
        && (heroIsUnconscious(state) || state.u?.uhs === FAINTED);
}
const EYES_OF_THE_OVERWORLD = 'The Eyes of the Overworld';
// C youprop.h:Detect_monsters().
export function heroDetectsMonsters(state = game) {
    return !!(state.u?.detectMonsters || state.u.clairvoyanceDetection || state.detectMonsters
        || state.u?.monsterDetection || (state.u.monsterDetectionTurns ?? 0) > 0);
}
// Part of C youprop.h:BBlinded(): the Eyes-of-the-Overworld lenses test.
export function isEyesOfTheOverworld(object, state = game) {
    return !!object && object.otyp === LENSES
        && artifactById(object.oartifact, state)?.name === EYES_OF_THE_OVERWORLD;
}
// C youprop.h:BBlinded().
export function blindnessBlocked(state = game) {
    const eyewear = state.ublindf || state.u?.ublindf;
    return isEyesOfTheOverworld(eyewear, state);
}
// C youprop.h:Blindfolded().
export function blindfolded(state = game) {
    const eyewear = state.ublindf || state.u?.ublindf;
    return !!eyewear && eyewear.otyp !== LENSES;
}
// C youprop.h:PermaBlind().
export function permanentBlind(state = game) {
    return !!state.u?.permaBlind;
}
// C youprop.h:HBlinded(): the intrinsic half with a caller-supplied
// timeout.
function intrinsicBlindnessWithTimeout(state, turns) {
    return permanentBlind(state) || turns > 0
        || hasIntrinsicProperty('blinded', null, state);
}
// C youprop.h:Blind(): with a caller-supplied timed-blindness value.
export function heroWouldBeBlindWithTimeout(state, turns) {
    return !blindnessBlocked(state)
        && (intrinsicBlindnessWithTimeout(state, turns) || blindfolded(state));
}
// C youprop.h:Blind().
export function heroIsBlind(state = game) {
    return heroWouldBeBlindWithTimeout(state, state.u?.blindTurns ?? 0);
}
// C youprop.h:Blinded().
// C Blinded excludes blindfolds but still respects the Eyes' blocker.
export function heroIsBlinded(state = game) {
    return !blindnessBlocked(state)
        && intrinsicBlindnessWithTimeout(state, state.u?.blindTurns ?? 0);
}
// Port only: caches the derived Blind value on the JS game state.
export function syncBlindness(state = game) {
    const blind = heroIsBlind(state);
    state.blind = blind;
    state.u.blind = blind;
    return blind;
}
// Part of C potion.c:make_blinded(): the timeout write, vision recalc,
// and regained-sight result without its messages.
export function setHeroBlindnessTurns(turns, state = game) {
    const wasBlind = heroIsBlind(state);
    const blind = setHeroBlindnessTimeout(turns, state);
    if (wasBlind !== blind)
        state.vision_full_recalc = 1;
    return { blind, regainedSight: wasBlind && !blind };
}
// C potion.c:set_itimeout(): the HBlinded timeout write alone.
// C set_itimeout(&HBlinded, turns) alone: callers such as polymon() and
// wipeoff() adjust the timeout before make_blinded() announces the change,
// so the next message must not yet redraw the map for the new sight.
export function setHeroBlindnessTimeout(turns, state = game) {
    state.u.blindTurns = Math.max(0, Math.min(TIMEOUT, Math.trunc(turns)));
    return syncBlindness(state);
}
// Part of C youprop.h:Deaf(): the u.uroleplay.deaf term.
export function permanentDeaf(state = game) {
    return !!state.u?.uroleplay?.deaf;
}
// C youprop.h:Deaf().
export function heroIsDeaf(state = game) {
    const u = state.u;
    return permanentDeaf(state)
        || propertyIsActive('deaf', state)
        || !!u.extrinsicDeaf;
}
// C youprop.h:Hallucination().
export function heroIsHallucinating(state = game) {
    const hero = state.u;
    return !hero.hallucinationResistance && (hero.hallucinationTurns ?? 0) > 0;
}
// Port only: caches the derived Deaf value on the JS game state.
export function syncDeafness(state = game) {
    const deaf = heroIsDeaf(state);
    state.deaf = deaf;
    state.u.deaf = deaf;
    return deaf;
}
//# sourceMappingURL=senses.js.map