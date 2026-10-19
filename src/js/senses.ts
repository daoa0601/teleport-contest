// senses.js — Derived hero blindness and deafness state.
// C refs: youprop.h Blind/Deaf, u_init.c:u_init_misc(), potion.c.

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { game } from './gstate.js';
import { TIMEOUT } from './const.js';
import { LENSES } from './object_data.js';
import { artifactById } from './artifacts.js';
import { hasIntrinsicProperty, propertyIsActive } from './properties.js';

const EYES_OF_THE_OVERWORLD = 'The Eyes of the Overworld';

export function heroDetectsMonsters(state = game) {
    return !!(state.u?.detectMonsters || state.detectMonsters
        || state.u?.monsterDetection || (state.u.monsterDetectionTurns ?? 0) > 0);
}

export function isEyesOfTheOverworld(
    object: Pick<GameObject, 'otyp' | 'oartifact'> | null | undefined, state = game,
) {
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

function intrinsicBlindnessWithTimeout(state: GameState, turns: number) {
    return permanentBlind(state) || turns > 0
        || hasIntrinsicProperty('blinded', null, state);
}

export function heroWouldBeBlindWithTimeout(state: GameState, turns: number) {
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

export function setHeroBlindnessTurns(turns: number, state = game) {
    const wasBlind = heroIsBlind(state);
    const blind = setHeroBlindnessTimeout(turns, state);
    if (wasBlind !== blind) state.vision_full_recalc = 1;
    return { blind, regainedSight: wasBlind && !blind };
}

// C set_itimeout(&HBlinded, turns) alone: callers such as polymon() and
// wipeoff() adjust the timeout before make_blinded() announces the change,
// so the next message must not yet redraw the map for the new sight.
export function setHeroBlindnessTimeout(turns: number, state = game) {
    state.u.blindTurns = Math.max(0, Math.min(TIMEOUT, Math.trunc(turns)));
    return syncBlindness(state);
}

export function permanentDeaf(state = game) {
    return !!state.u?.uroleplay?.deaf;
}

export function heroIsDeaf(state = game) {
    const u = state.u;
    return permanentDeaf(state)
        || propertyIsActive('deaf', state)
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
