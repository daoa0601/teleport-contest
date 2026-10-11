// senses.js — Derived hero blindness and deafness state.
// C refs: youprop.h Blind/Deaf, u_init.c:u_init_misc(), potion.c.
import { game } from './gstate.js';
import { TIMEOUT } from './const.js';
import { LENSES } from './object_data.js';
import { artifactById } from './artifacts.js';
import { hasIntrinsicProperty } from './properties.js';
const EYES_OF_THE_OVERWORLD = 'The Eyes of the Overworld';
export function heroDetectsMonsters(state = game) {
    return !!(state.u?.detectMonsters || state.detectMonsters
        || state.u?.monsterDetection || (state.u.monsterDetectionTurns ?? 0) > 0);
}
export function isEyesOfTheOverworld(object, state = game) {
    return !!object && object.otyp === LENSES
        && artifactById(object.oartifact, state)?.name === EYES_OF_THE_OVERWORLD;
}
export function blindnessBlocked(state = game) {
    const eyewear = state.ublindf || state.u?.ublindf;
    return isEyesOfTheOverworld(eyewear, state);
}
export function blindfolded(state = game) {
    const eyewear = state.ublindf || state.u?.ublindf;
    return !!eyewear && eyewear.otyp !== LENSES;
}
export function permanentBlind(state = game) {
    return !!state.u?.permaBlind;
}
function intrinsicBlindnessWithTimeout(state, turns) {
    return permanentBlind(state) || turns > 0
        || hasIntrinsicProperty('blinded', null, state);
}
export function heroWouldBeBlindWithTimeout(state, turns) {
    return !blindnessBlocked(state)
        && (intrinsicBlindnessWithTimeout(state, turns) || blindfolded(state));
}
export function heroIsBlind(state = game) {
    return heroWouldBeBlindWithTimeout(state, state.u?.blindTurns ?? 0);
}
// C Blinded excludes blindfolds but still respects the Eyes' blocker.
export function heroIsBlinded(state = game) {
    return !blindnessBlocked(state)
        && intrinsicBlindnessWithTimeout(state, state.u?.blindTurns ?? 0);
}
export function syncBlindness(state = game) {
    const blind = heroIsBlind(state);
    state.blind = blind;
    state.u.blind = blind;
    return blind;
}
export function setHeroBlindnessTurns(turns, state = game) {
    const wasBlind = heroIsBlind(state);
    const hero = state.u;
    hero.blindTurns = Math.max(0, Math.min(TIMEOUT, Math.trunc(turns)));
    const blind = syncBlindness(state);
    if (wasBlind !== blind)
        state.vision_full_recalc = 1;
    return { blind, regainedSight: wasBlind && !blind };
}
export function permanentDeaf(state = game) {
    return !!state.u?.uroleplay?.deaf;
}
export function heroIsDeaf(state = game) {
    const u = state.u;
    return permanentDeaf(state)
        || (u.deafTurns ?? 0) > 0
        || !!u.extrinsicDeaf;
}
export function heroIsHallucinating(state = game) {
    const hero = state.u;
    return !hero.hallucinationResistance && (hero.hallucinationTurns ?? 0) > 0;
}
export function syncDeafness(state = game) {
    const deaf = heroIsDeaf(state);
    state.deaf = deaf;
    state.u.deaf = deaf;
    return deaf;
}
//# sourceMappingURL=senses.js.map