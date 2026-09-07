// senses.js — Derived hero blindness and deafness state.
// C refs: youprop.h Blind/Deaf, u_init.c:u_init_misc(), potion.c.

import { game } from './gstate.js';
import { LENSES } from './object_data.js';
import { artifactById } from './artifacts.js';
import { hasIntrinsicProperty } from './properties.js';

const EYES_OF_THE_OVERWORLD = 'The Eyes of the Overworld';

export function isEyesOfTheOverworld(object) {
    if (!object || object.otyp !== LENSES) return false;
    if (artifactById(object.oartifact)?.name === EYES_OF_THE_OVERWORLD)
        return true;
    return (object.oextra?.oname || object.oname) === EYES_OF_THE_OVERWORLD;
}

export function blindnessBlocked(state = game) {
    const eyewear = state.ublindf || state.u?.ublindf;
    return isEyesOfTheOverworld(eyewear);
}

export function blindfolded(state = game) {
    const eyewear = state.ublindf || state.u?.ublindf;
    return !!eyewear && eyewear.otyp !== LENSES;
}

export function permanentBlind(state = game) {
    return !!state.u?.permaBlind;
}

export function heroIsBlind(state = game) {
    if (blindnessBlocked(state)) return false;
    const u = state.u || {};
    return permanentBlind(state)
        || (u.blindTurns ?? 0) > 0
        || blindfolded(state)
        || hasIntrinsicProperty('blinded', 'form', state);
}

export function syncBlindness(state = game) {
    const blind = heroIsBlind(state);
    state.blind = blind;
    if (state.u) state.u.blind = blind;
    return blind;
}

export function setHeroBlindnessTurns(turns, state = game) {
    const wasBlind = heroIsBlind(state);
    const hero = state.u || (state.u = {});
    hero.blindTurns = Math.max(0, turns);
    const blind = syncBlindness(state);
    if (wasBlind !== blind) state.vision_full_recalc = 1;
    return { blind, regainedSight: wasBlind && !blind };
}

export function permanentDeaf(state = game) {
    return !!state.u?.uroleplay?.deaf;
}

export function heroIsDeaf(state = game) {
    const u = state.u || {};
    return permanentDeaf(state)
        || (u.deafTurns ?? 0) > 0
        || !!u.extrinsicDeaf;
}

export function heroIsHallucinating(state = game) {
    const hero = state.u || {};
    return !hero.hallucinationResistance
        && !!(hero.hallucinating || (hero.hallucinationTurns ?? 0) > 0);
}

export function syncDeafness(state = game) {
    const deaf = heroIsDeaf(state);
    state.deaf = deaf;
    if (state.u) state.u.deaf = deaf;
    return deaf;
}
