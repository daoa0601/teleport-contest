// Hero transformation into green slime.
// C refs: potion.c make_slimed(), timeout.c slime_dialogue() and
// slimed_to_death(), uhitm.c mhitm_ad_slim().

import { heroIsHallucinating } from './senses.js';
import { exerciseAttribute } from './attrib.js';
import {
    A_DEX, GENOCIDED, G_GENOD, M_AP_MONSTER, TIMEOUT, TURNED_SLIME,
} from './const.js';
import { game, requireLiveGame } from './gstate.js';
import { heroSpecies } from './hero_species.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import type { DeathHandler } from './end.js';
import type { MonsterAction } from './monster_action_types.js';
import { plineWithContinuation } from './display.js';
import { MONSTER_NAME, MONSTER_SYMBOL, requireMonsterData } from './monster_data.js';
import { heroHasNoLimbs, heroIsPolymorphed } from './polyself.js';
import { removeIntrinsicProperty, setPropertyTimeout } from './properties.js';
import { stopHeroOccupation } from './occupation.js';

interface SlimeAdvanceOptions {
    state?: GameState;
    publish?: MessagePublisher;
    repaint?: (x: number, y: number) => unknown;
    randomMonsterName?: () => string;
    transform?: (species: number, options: { announceForm: false }) => unknown;
    die?: DeathHandler;
}

interface SlimeAdvanceResult {
    active: boolean;
    died: boolean;
    turns?: number;
    message?: string | null;
    transformed?: boolean;
    genocided?: boolean;
}

export const PM_GREEN_SLIME = 208;

const PM_FLAMING_SPHERE = 30;
const PM_FIRE_VORTEX = 111;
const PM_FIRE_ELEMENTAL = 155;
const PM_SALAMANDER = 329;
const S_GHOST = 54;
const FLAMING_FORMS = new Set([
    PM_FLAMING_SPHERE,
    PM_FIRE_VORTEX,
    PM_FIRE_ELEMENTAL,
    PM_SALAMANDER,
]);

function heroForm(state: GameState): number | null {
    return heroIsPolymorphed(state) ? heroSpecies(state) : null;
}

export function heroIsFlaming(state: GameState = game): boolean {
    const form = heroForm(state);
    return form !== null && FLAMING_FORMS.has(form);
}

export function heroIsNoncorporeal(state: GameState = game): boolean {
    const form = heroForm(state);
    return form !== null && MONSTER_SYMBOL[form] === S_GHOST;
}

export function heroIsGreenSlime(state: GameState = game): boolean {
    return heroForm(state) === PM_GREEN_SLIME;
}

export function heroIsSlimeproof(state: GameState = game): boolean {
    return heroIsGreenSlime(state)
        || heroIsFlaming(state)
        || heroIsNoncorporeal(state);
}

export function heroCanBeSlimed(state: GameState = game): boolean {
    const hero = state.u;
    return !heroIsSliming(state)
        && !hero.unchanging && !state.unchanging
        && !heroIsSlimeproof(state);
}

export function heroIsSliming(state: GameState = game): boolean {
    return (state.u?.slimedTurns ?? 0) > 0 || !!state.u?.slimed;
}

// C potion.c:make_slimed(). This directly sets the timeout; the caller
// separately decides whether a body admits infection and records its killer.
export async function setHeroSlimingTimeout(turns: number, {
    state = game, message = null, publish = plineWithContinuation,
}: { state?: GameState; message?: string | null; publish?: MessagePublisher } = {}): Promise<void> {
    requireLiveGame(state);
    if (!Number.isFinite(turns)) throw new RangeError('Sliming timeout must be finite.');
    const requested = Math.trunc(turns);
    const hero = state.u;
    const old = hero.slimedTurns ?? 0;
    hero.slimedTurns = Math.max(0, Math.min(TIMEOUT, requested));
    hero.slimed = hero.slimedTurns > 0;
    if ((requested !== 0) !== (old !== 0)) {
        state.context.botl = true;
        if (message !== null) await publish(message);
    }
    // The fake late-countdown appearance and cause survive the cure message.
    if (!hero.slimedTurns) clearHeroSliming(state);
}

export function startHeroSliming({
    state = game,
    turns = 10,
    killer = '',
}: { state?: GameState; turns?: number; killer?: string } = {}): boolean {
    const hero = state.u;
    if (!heroCanBeSlimed(state)) return false;
    hero.slimedTurns = turns;
    hero.slimed = turns > 0;
    if (hero.slimed) state.context.botl = true;
    hero.slimeKiller = killer;
    return hero.slimed;
}

export function clearHeroSliming(state: GameState = game): boolean {
    const hero = state.u;
    const wasSliming = heroIsSliming(state);
    if (wasSliming) state.context.botl = true;
    hero.slimedTurns = 0;
    hero.slimed = false;
    delete hero.slimeKiller;
    if (hero.m_ap_type === M_AP_MONSTER
        && hero.mappearance === PM_GREEN_SLIME) {
        hero.m_ap_type = 0;
        hero.mappearance = 0;
    }
    return wasSliming;
}

// C timeout.c:burn_away_slime(), through make_slimed(0, message).
export async function burnAwayHeroSlime({ state = game }: { state?: GameState } = {}): Promise<boolean> {
    if (!heroIsSliming(state)) return false;
    state.context.botl = true;
    state.u.slimedTurns = 0;
    state.u.slimed = false;
    await plineWithContinuation('The slime that covers you is burned away!');
    clearHeroSliming(state);
    return true;
}

export function resetHeroSlimingCountdown(state: GameState = game, turns = 10): boolean {
    if (!heroIsSliming(state)) return false;
    state.u.slimedTurns = turns;
    state.u.slimed = true;
    return true;
}

// Continue a green slime's touch after hitmsg(). The contact's ordinary
// damage remains unless the hero's current form cannot be slimed.
export function resumeDeferredHeroSlime(action: MonsterAction, state: GameState): MonsterAction {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredSlimeEffect) return action;
    attack.deferredSlimeEffect = false;

    if (attack.slimeNegated) {
        if (!attack.slimeCancelled)
            attack.slimeEffectMessage = 'You escape harm.';
    } else if (heroIsFlaming(state)) {
        attack.damage = 0;
        attack.slimeEffectMessage = 'The slime burns away!';
    } else if (state.u?.unchanging || state.unchanging
        || heroIsNoncorporeal(state)
        || heroIsGreenSlime(state)) {
        attack.damage = 0;
        attack.slimeEffectMessage = 'You are unaffected.';
    } else if (!heroIsSliming(state)) {
        attack.slimeEffectMessage = "You don't feel very well.";
        attack.slimeStartPending = true;
        attack.slimeKiller = requireMonsterData(MONSTER_NAME, action.monster.mnum);
    } else {
        attack.slimeEffectMessage = 'Yuck!';
    }
    attack.deferredPostHit = true;
    return action;
}

// make_slimed() runs after its warning line has crossed tty.
export function finishDeferredHeroSlime(action: MonsterAction, state: GameState): MonsterAction {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.slimeStartPending) return action;
    if (attack.slimeKiller === undefined) throw new Error('Deferred slime contact is missing its killer.');
    startHeroSliming({ state, killer: attack.slimeKiller });
    attack.slimeStartPending = false;
    return action;
}

function articleFor(name: string): string {
    return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

function slimeMessage(turns: number, state: GameState, randomMonsterName: () => string): string | null {
    if (turns === 9) {
        return state.blind || (state.u?.blindTurns ?? 0) > 0
            ? null : 'You are turning a little green.';
    }
    if (turns === 7) {
        return heroHasNoLimbs(state)
            ? 'Your extremities are getting oozy.'
            : 'Your limbs are getting oozy.';
    }
    if (turns === 5) return 'Your skin begins to peel away.';
    if (turns !== 3 && turns !== 1) return null;
    const hallucinating = heroIsHallucinating(state);
    const form = hallucinating ? randomMonsterName() : 'green slime';
    return turns === 3
        ? `You are turning into ${articleFor(form)}.`
        : `You have become ${articleFor(form)}.`;
}

function removeHeroSpeed(state: GameState): void {
    setPropertyTimeout('fast', 0, state);
    removeIntrinsicProperty('fast', state);
}

function cancelHeroPetrification(state: GameState): void {
    const hero = state.u;
    hero.stonedTurns = 0;
    hero.stoned = false;
    delete hero.stoneKiller;
    delete hero.stoneKillerFormat;
}

export async function advanceHeroSliming({
    state = game,
    publish = async () => {},
    repaint = () => {},
    randomMonsterName = () => 'green slime',
    transform,
    die,
}: SlimeAdvanceOptions = {}): Promise<SlimeAdvanceResult> {
    const hero = state.u;
    const turns = hero.slimedTurns ?? 0;
    if (turns <= 0) return { active: false, died: false };

    if (turns === 1) {
        hero.m_ap_type = M_AP_MONSTER;
        hero.mappearance = PM_GREEN_SLIME;
        repaint(hero.ux, hero.uy);
    }

    const message = slimeMessage(turns, state, randomMonsterName);
    if (message) await publish(message);

    const stage = Math.trunc(turns / 2);
    if (stage === 3) {
        removeHeroSpeed(state);
        await stopHeroOccupation(state, publish);
    } else if (stage === 2
        && hero.deafTurns !== undefined && hero.deafTurns > 0
        && hero.deafTurns < 5) {
        hero.deafTurns = 5;
    } else if (stage === 1) {
        cancelHeroPetrification(state);
    }
    await exerciseAttribute(A_DEX, false, state);

    hero.slimedTurns = turns - 1;
    if (hero.slimedTurns > 0) {
        hero.slimed = true;
        return { active: true, died: false, turns: hero.slimedTurns, message };
    }

    const killer = hero.slimeKiller || 'turned into green slime';
    const deathCause = hero.slimeKiller ? null : 'turned into green slime';
    clearHeroSliming(state);
    if (typeof transform !== 'function' || typeof die !== 'function') {
        throw new TypeError(
            'the final slime turn requires transform and death functions',
        );
    }
    const vitals = state.mvitals?.[PM_GREEN_SLIME];
    if (!vitals) throw new Error('Slime transformation requires initialized monster vitals.');
    const originalFlags = vitals.mvflags;
    // Slime infection completes even after genocide. Life saving then
    // encounters the genocided body, as in C slimed_to_death().
    vitals.mvflags &= ~G_GENOD;
    try {
        await transform(PM_GREEN_SLIME, { announceForm: false });
    } finally {
        vitals.mvflags = originalFlags;
    }
    const died = await die({
        killer,
        deathCause,
        deathVerb: 'turned into slime',
        deathLineShown: true,
        deathType: TURNED_SLIME,
    });
    if (died) return { active: false, died: true, transformed: true, message };

    const genocided = !!(
        (state.mvitals?.[PM_GREEN_SLIME]?.mvflags ?? 0) & G_GENOD
    );
    if (!genocided) {
        return { active: false, died: false, transformed: true, message };
    }

    await publish('Unfortunately, green slime has been genocided...');
    const genocidedDeath = await die({
        killer: 'slimicide',
        deathVerb: 'were genocided',
        deathLineShown: true,
        deathType: GENOCIDED,
    });
    return {
        active: false,
        died: genocidedDeath,
        transformed: true,
        genocided: true,
        message,
    };
}
