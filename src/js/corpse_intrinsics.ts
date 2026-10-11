// Intrinsics and magical energy conveyed by flesh.
// C refs: eat.c:corpse_intrinsic(), givit(), and eye_of_newt_buzz().

import { gainHeroStrength } from './attrib.js';
import { heroHandName } from './body_parts.js';
import { TIMEOUT } from './const.js';
import { plineWithContinuation, see_monsters } from './display.js';
import { eatingDangerousCorpse } from './food_lifecycle.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { heroIsUnaware } from './hero_sleep.js';
import {
    MONSTER_CONVEYS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_NAME, requireMonsterData,
} from './monster_data.js';
import { CORPSE } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { killerObjectName } from './objnam.js';
import {
    grantIntrinsicProperty, hasIntrinsicProperty, refreshProperty,
} from './properties.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import type { GameState } from './game_state.js';

interface CorpseIntrinsicOptions { state?: GameState; }

const M1_TPORT = 0x02000000, M1_TPORT_CNTRL = 0x04000000;
const M2_GIANT = 0x00002000;
const TELEPATHIC_SPECIES = new Set([
    'floating eye', 'mind flayer', 'master mind flayer',
].map(name => MONSTER_NAME.indexOf(name)));
const KILLER_BEE = MONSTER_NAME.indexOf('killer bee');
const SCORPION = MONSTER_NAME.indexOf('scorpion');

// Native property order controls the reservoir draw for each candidate.
const RESISTANCES = [
    'fireResistance', 'coldResistance', 'sleepResistance',
    'disintegrationResistance', 'shockResistance', 'poisonResistance',
    'acidResistance', 'stoneResistance',
] as const;
const CANDIDATES = [...RESISTANCES, 'telepathy', 'teleportation', 'teleportControl'] as const;
type CorpseIntrinsic = typeof CANDIDATES[number];
type TimedCorpseResistance = 'acidResistance' | 'stoneResistance';
const timedResistances: readonly TimedCorpseResistance[] = ['acidResistance', 'stoneResistance'];

export async function grantCorpseIntrinsic(mnum: number, { state = game }: CorpseIntrinsicOptions = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const property = chooseCorpseIntrinsic(mnum);
    if (!property) return;
    if (property === 'strength') {
        await gainHeroStrength(null, 0, { state });
        return;
    }
    if (!shouldGiveIntrinsic(property, mnum)
        && !shouldGiveTemporaryResistance(property, mnum)) return;

    const timed = property === 'acidResistance' || property === 'stoneResistance';
    if (timed) {
        if (!state.u[property])
            await plineWithContinuation(intrinsicMessage(property, state));
        const timeout: `${TimedCorpseResistance}Turns` = `${property}Turns`;
        state.u[timeout] = Math.min(TIMEOUT, (state.u[timeout] || 0) + d(3, 6));
        refreshProperty(property, state);
        return;
    }
    if (hasIntrinsicProperty(property, 'outside', state)) return;
    await plineWithContinuation(intrinsicMessage(property, state));
    grantIntrinsicProperty(property, 'outside', state);
    if (property === 'telepathy' && heroIsBlind(state)) await see_monsters();
}

export function chooseCorpseIntrinsic(mnum: number): CorpseIntrinsic | 'strength' | null {
    const giant = !!(requireMonsterData(MONSTER_FLAGS2, mnum) & M2_GIANT);
    let count = giant ? 1 : 0;
    let selected: CorpseIntrinsic | 'strength' | null = giant ? 'strength' : null;
    for (const property of CANDIDATES) {
        if (!intrinsicPossible(property, mnum)) continue;
        if (!rn2(++count)) selected = property;
    }
    if (giant && count === 1 && !rn2(2)) selected = null;
    return selected;
}

function intrinsicPossible(property: CorpseIntrinsic, mnum: number) {
    const resistance = RESISTANCES.findIndex(resistance => resistance === property);
    if (resistance >= 0) return !!(requireMonsterData(MONSTER_CONVEYS, mnum) & (1 << resistance));
    if (property === 'telepathy') return TELEPATHIC_SPECIES.has(mnum);
    const flag = property === 'teleportation' ? M1_TPORT : M1_TPORT_CNTRL;
    return !!(requireMonsterData(MONSTER_FLAGS1, mnum) & flag);
}

export function shouldGiveIntrinsic(property: CorpseIntrinsic | 'strength', mnum: number) {
    let chance = 15;
    if (property === 'poisonResistance'
        && (mnum === KILLER_BEE || mnum === SCORPION) && !rn2(4)) chance = 1;
    else if (property === 'teleportation') chance = 10;
    else if (property === 'teleportControl') chance = 12;
    else if (property === 'telepathy') chance = 1;
    return requireMonsterData(MONSTER_LEVEL, mnum) > rn2(chance);
}

function shouldGiveTemporaryResistance(property: CorpseIntrinsic, mnum: number) {
    const chance = property === 'stoneResistance' ? 6
        : property === 'acidResistance' ? 3 : 0;
    return chance > 0 && requireMonsterData(MONSTER_LEVEL, mnum) > rn2(chance);
}

function intrinsicMessage(property: CorpseIntrinsic, state: GameState): string {
    const hallucinating = heroIsHallucinating(state);
    switch (property) {
    case 'fireResistance':
        return hallucinating ? "You be chillin'." : 'You feel a momentary chill.';
    case 'coldResistance': return 'You feel full of hot air.';
    case 'sleepResistance': return 'You feel wide awake.';
    case 'disintegrationResistance':
        return hallucinating ? 'You feel totally together, man.' : 'You feel very firm.';
    case 'shockResistance':
        return hallucinating ? 'You feel grounded in reality.'
            : 'Your health currently feels amplified!';
    case 'poisonResistance':
        return state.u.poisonResistance ? 'You feel especially healthy.' : 'You feel healthy.';
    case 'telepathy':
        return hallucinating ? 'You feel in touch with the cosmos.'
            : 'You feel a strange mental acuity.';
    case 'teleportation':
        return hallucinating ? 'You feel diffuse.' : 'You feel very jumpy.';
    case 'teleportControl':
        return hallucinating ? 'You feel centered in your personal space.'
            : 'You feel in control of yourself.';
    case 'acidResistance':
        return hallucinating ? 'You feel secure from flashbacks.'
            : 'You feel less concerned about being harmed by acid.';
    case 'stoneResistance':
        return hallucinating ? 'You feel unusually limber.'
            : 'You feel less concerned about becoming petrified.';
    }
}

export async function corpseEnergyBuzz({ state = game }: CorpseIntrinsicOptions = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    if (!rn2(3) && 3 * hero.uen > 2 * hero.uenmax) return;
    const previousEnergy = hero.uen;
    hero.uen += rnd(3);
    if (hero.uen > hero.uenmax) {
        if (!rn2(3)) {
            hero.uenmax++;
            hero.uenpeak = Math.max(hero.uenpeak || 0, hero.uenmax);
        }
        hero.uen = hero.uenmax;
    }
    if (hero.uen !== previousEnergy)
        await plineWithContinuation('You feel a mild buzz.');
}

// C timeout.c:ACID_RES/STONE_RES. Called in property order, after shock
// resistance and before the later status timeouts.
export async function advanceCorpseResistanceTimeouts(state: GameState = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    for (const property of timedResistances) {
        const timeout: `${TimedCorpseResistance}Turns` = `${property}Turns`;
        const remaining = state.u[timeout] ?? 0;
        if (!(remaining > 0)) continue;
        state.u[timeout] = remaining - 1;
        if (state.u[timeout] > 0) continue;
        refreshProperty(property, state);
        if (state.u[property]) continue;
        if (eatingDangerousCorpse(property, { state })) {
            state.u[timeout] = 1;
            refreshProperty(property, state);
            continue;
        }
        if (!heroIsUnaware(state))
            await plineWithContinuation(property === 'acidResistance'
                ? 'You no longer feel safe from acid.'
                : 'You no longer feel secure from petrification.');
        if (property === 'stoneResistance') {
            await touchWieldedCorpseAfterResistanceExpires(state);
            if (state.program_state.gameover) return;
        }
    }
}

async function touchWieldedCorpseAfterResistanceExpires(state: GameState) {
    if (state.uarmg || state.u.uarmg) return;
    const weapons = [state.uwep || state.u.uwep];
    if (state.u.twoweap) weapons.push(state.uswapwep || state.u.uswapwep);
    for (const object of weapons) {
        if (object?.otyp !== CORPSE || object.corpsenm === undefined || !touchPetrifies(object.corpsenm)
            || state.u.stoneResistance) continue;
        const corpse = killerObjectName(object, state);
        await plineWithContinuation(`You are wielding ${corpse} in your bare ${makePlural(heroHandName(state))}.`);
        const result = await resolveImmediatePetrification({
            state, killer: `resistance timing out while wielding ${corpse}`,
        });
        if (result.died) return;
        if (!state.u.stoneResistance) await releaseWeaponSlots(object, state);
    }
}
