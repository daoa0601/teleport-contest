// Blindness caused by cream pies and blinding venom.
// C refs: mondata.c can_blnd(), uhitm.c hmon_hitmon_misc_obj(), and
// mthrowu.c m_throw()/ohitmon().

import { W_ARMH } from './const.js';
import { heroHasArtifactDefense, monsterHasArtifactDefense } from './artifacts.js';
import { heroSpecies } from './hero_species.js';
import { heroIsUnaware } from './hero_sleep.js';
import {
    AD_BLND, AT_BOOM, AT_BREA, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE,
    AT_MAGC, AT_NONE, AT_SPIT, AT_STNG, AT_TUCH, AT_WEAP,
} from './monster_attack_types.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_NAME } from './monster_data.js';
import {
    BLINDING_VENOM, CREAM_PIE, OBJECT_DESCRIPTIONS,
} from './object_data.js';
import { heroEyeCount, heroEyeName, heroFaceName, heroHasEyes, monsterFaceName } from './body_parts.js';
import { makePlural, verbForSubject } from './object_grammar.js';
import { objectName, pluralizeObjectNoun } from './objnam.js';
import { rnd } from './rng.js';
import { blindfolded, heroIsBlind } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { plineWithContinuation } from './display.js';
import type { MessagePublisher } from './display.js';
import { monsterName } from './monster_name.js';

const M1_NOEYES = 0x00001000;
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
const PM_RAVEN = MONSTER_NAME.indexOf('raven');

export function heroResistsBlindingLight(state: GameState = game): boolean {
    return heroIsBlind(state) || heroIsUnaware(state) || !!state.u.blindResistance
        || (MONSTER_ATTACKS[heroSpecies(state)] || []).some(([method, damage]) =>
            damage === AD_BLND && (method === AT_EXPL || method === AT_GAZE))
        || heroHasArtifactDefense('blindness', state);
}

export function monsterResistsBlindingLight(monster: Monster, state: GameState = game): boolean {
    return !!monster.mblinded || !monster.mcansee || !!monster.msleeping
        || !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)
        || (MONSTER_ATTACKS[monster.mnum] || []).some(([method, damage]) =>
            damage === AD_BLND && (method === AT_EXPL || method === AT_GAZE))
        || monsterHasArtifactDefense(monster, 'blindness', state);
}

function wearsVisoredHelmet(objects: readonly GameObject[], state: GameState): boolean {
    return objects.some(object =>
        ((object?.owornmask ?? 0) & W_ARMH)
        && (state.objectDescriptions?.[object.otyp]
            ?? OBJECT_DESCRIPTIONS[object.otyp]) === 'visored helmet');
}

// C mondata.c:can_blnd() for a monster's contact attack on the hero.
export function heroCanBeBlindedByContact(
    attacker: Monster, attackType: number, state: GameState = game,
): boolean {
    if (!heroHasEyes(state)) return false;
    // "a crow will not pluck out the eye of another crow"
    if (attacker.mnum === PM_RAVEN && heroSpecies(state) === PM_RAVEN) return false;
    if ([AT_EXPL, AT_BOOM, AT_GAZE, AT_MAGC, AT_BREA].includes(attackType))
        return !attacker.mcan && !heroResistsBlindingLight(state);
    if ([AT_WEAP, AT_SPIT, AT_NONE].includes(attackType)) return false;
    if (attackType === AT_CLAW) {
        // All eyewear, including lenses, protects; so does a visor.
        if (state.ublindf ?? state.u.ublindf) return false;
        return !wearsVisoredHelmet(state.inventory, state);
    }
    if (attackType === AT_TUCH || attackType === AT_STNG) return !attacker.mcan;
    if (attackType === AT_ENGL)
        return !blindfolded(state) && !heroIsUnaware(state) && !state.u.ucreamed;
    return true;
}

export function monsterCanBeBlindedByObject(
    monster: Monster | null | undefined, objectType: number,
    {
        attackerSpecies = null,
        heroInsideTarget = false,
        state = game,
    }: {
        /** C magr species, or null for the C null-aggressor callers. */
        attackerSpecies?: number | null;
        heroInsideTarget?: boolean;
        state?: GameState;
    } = {},
) {
    if (!monster || ![CREAM_PIE, BLINDING_VENOM].includes(objectType)) return false;
    if ((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_NOEYES) return false;
    if (!monster?.mcansee && (monster?.mblinded ?? 0) === 0) return false;
    // "a crow will not pluck out the eye of another crow"
    if (attackerSpecies === PM_RAVEN && monster.mnum === PM_RAVEN) return false;
    if (heroInsideTarget) return false;
    if (objectType !== BLINDING_VENOM) return true;
    return !wearsVisoredHelmet(
        monster?.minvent || monster?.inventory || [],
        state,
    );
}

export function applyMonsterBlindness(monster: Monster, blindIncrement: number) {
    const wasSeeing = !!monster.mcansee;
    monster.mcansee = 0;
    monster.mblinded = Math.min(
        127, (monster.mblinded ?? 0) + blindIncrement,
    );
    return { blindIncrement, wasSeeing };
}

export function heroBlindingObjectHitMessage(
    monster: Monster,
    object: GameObject,
    {
        canBlind,
        state = game,
        thrown = false,
        describeTarget = () => monsterName(monster, { state }),
    }: { canBlind?: boolean; state?: GameState; thrown?: boolean; describeTarget?: () => string } = {},
): string {
    const impact = object?.otyp === CREAM_PIE ? 'Splat!' : 'Splash!';
    if (!canBlind || heroIsBlind(state)) return impact;
    if (object.otyp === BLINDING_VENOM) {
        return `The venom blinds ${describeTarget()}${
            monster.mcansee ? '' : ' further'
        }!`;
    }

    const target = creamPieTarget(monster, describeTarget());
    const count = object.quan ?? object.quantity ?? 1;
    const plural = thrown && count > 1;
    const noun = objectName(object, state);
    const subject = `${!thrown && count > 1 ? 'A' : 'The'} ${plural ? pluralizeObjectNoun(object, noun) : noun}`;
    return `${subject} ${plural ? 'splash' : 'splashes'} over ${target}!`;
}

function creamPieTarget(monster: Monster, name: string): string {
    const hasFace = !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)
        && monster.mnum !== PM_FLOATING_EYE;
    if (!hasFace) return name;
    const face = monsterFaceName(monster.mnum);
    return /s$/i.test(name) ? `${name}' ${face}` : `${name}'s ${face}`;
}

export function blindMonsterWithThrownObject(
    monster: Monster, objectType: number, {
        heroInsideTarget = false,
        state = game,
        rollOne = rnd,
    }: { heroInsideTarget?: boolean; state?: GameState; rollOne?: (sides: number) => number } = {},
) {
    if (!monsterCanBeBlindedByObject(
        monster, objectType, { heroInsideTarget, state },
    )) return null;
    return applyMonsterBlindness(monster, rollOne(25) + 20);
}

export function heroCanBeBlindedByVenom(state: GameState = game): boolean {
    const hero = state.u;
    if (!heroHasEyes(state)
        || state.ublindf || hero.ublindf || hero.ucreamed) return false;

    const helmet = state.uarmh || hero.uarmh;
    const wornObjects = helmet
        ? [helmet, ...(state.inventory || [])]
        : state.inventory || [];
    return !wearsVisoredHelmet(wornObjects, state);
}

function heroCanBeBlindedByCreamPie(state: GameState): boolean {
    return heroHasEyes(state) && !blindfolded(state);
}

export function heroCanBeBlindedByObject(
    objectType: number, state: GameState,
    { thrownByHero = false }: { thrownByHero?: boolean } = {},
): boolean {
    // can_blnd(): the hero is both magr and mdef for a self-thrown hit, so
    // "a crow will not pluck out the eye of another crow" protects a raven.
    // Monster-thrown objects pass a null aggressor and skip this branch.
    if (thrownByHero && heroSpecies(state) === PM_RAVEN) return false;
    if (objectType === CREAM_PIE)
        return heroCanBeBlindedByCreamPie(state);
    if (objectType === BLINDING_VENOM)
        return heroCanBeBlindedByVenom(state);
    return false;
}

function venomBlindMessage(state: GameState, wasBlind: boolean): string {
    if (!wasBlind) return 'The venom blinds you.';
    const eye = heroEyeName(state);
    const eyes = heroEyeCount(state) === 1 ? eye : makePlural(eye);
    return `Your ${eyes} ${verbForSubject(eyes, 'sting')}.`;
}

function creamPieBlindMessage(state: GameState, wasBlind: boolean): string {
    return wasBlind
        ? `There's something sticky all over your ${heroFaceName(state)}.`
        : "Yecch!  You've been creamed.";
}

export interface HeroThrownBlindness {
    blindIncrement: number;
    wasBlind: boolean;
    message: string;
}

// The impact message precedes the end of the visible missile flight.
export function prepareHeroThrownBlindness(
    objectType: number, state: GameState = game, rollOne: (sides: number) => number = rnd,
): HeroThrownBlindness | null {
    if (!heroCanBeBlindedByObject(objectType, state)) return null;

    const wasBlind = heroIsBlind(state);
    const blindIncrement = rollOne(25);
    const message = objectType === CREAM_PIE
        ? creamPieBlindMessage(state, wasBlind)
        : venomBlindMessage(state, wasBlind);
    return { blindIncrement, wasBlind, message };
}

export async function finishHeroThrownBlindness(
    effect: HeroThrownBlindness, state: GameState = game,
    publish: MessagePublisher = plineWithContinuation,
): Promise<void> {
    if (!effect.blindIncrement) return;
    state.u.ucreamed = (state.u.ucreamed ?? 0) + effect.blindIncrement;
    await makeBlinded((state.u.blindTurns ?? 0) + effect.blindIncrement, {
        state, publish, talk: false,
    });
    if (!heroIsBlind(state)) await publish('Your vision quickly clears.');
}
