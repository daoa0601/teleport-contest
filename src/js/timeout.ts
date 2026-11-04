// C timeout.c — the once-per-turn countdown allmain.c calls between glibr()
// and run_regions(), the fatal-condition dialogues, every timed intrinsic
// expiring in prop.h order, fall_asleep(), the egg/figurine/burn object
// timers, slip_or_trip(), do_storms(), the saveable timer queue, and
// wiz_timeout_queue(). Folded here from slime.js, hero_illness.js,
// hero_sleep.js, hero_strangulation.js, levitation_timeout.js,
// timeout_queue.js, timeout_warnings.js, storms.js, timer_effects.js,
// timeout_luck.js, and timeout_body.js.

import { castMonsterSpellRay } from './breath_ray.js';
import { runClaimedCorpseRevivalTimer } from './corpse_revival.js';

import type { CorpseRevivalTimerEvent } from './corpse_revival.js';

import { formatFeltMessage, formatHeardMessage, formatSeenMessage, publishHeardMessage } from './hero_speech.js';
import {
    clearHeroSliming, cureHeroSickness, cureHeroVomiting, heroIsSick, heroIsSliming,
    heroIsVomiting, makeBlinded, makeConfused, makeHallucinated, makeStunned, makeDeaf,
    setSlipperyHands,
} from './potion.js';
import { clearHeroStrangulation } from './do_wear.js';
import {
    corpseName, definiteName, killerObjectName, makePlural, objectDescription, objectName,
    observeObjectForNaming, withIndefiniteArticle,
} from './objnam.js';
import { advanceSpellProtection } from './spell.js';
import { advanceDisplacementTimeout } from './hero_displacement.js';
import { requireInitializedGame, game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { PropertyName } from './property_types.js';
import { applyHeroLocationEffects, endVoluntaryMultiTurn, nomul, invWeight } from './hack.js';
import { wakeMonstersNearWithMessages, restartMonsterShapechanging, maybeUnhideAt } from './mon.js';
import { deferredDecor } from './pickup.js';
import { d, rnd, rn1, rn2 } from './rng.js';
import {
    hasCarriedProperty, hasIntrinsicProperty, hasInvokedProperty, hasWornProperty,
    propertyIsActive, propertyIsBlocked, propertyTimeout, refreshProperty,
    removeIntrinsicProperty, setPropertyTimeout,
} from './properties.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating, heroIsUnaware } from './senses.js';
import { healHeroLegs } from './do.js';
import { isPoolAt, isIceAt, isPoolOrLavaAt } from './dbridge.js';
import {
    ACCESSIBLE, A_CON, A_DEX, A_STR, CLOUD, COLNO, DIED, DISMOUNT_FELL, FAINTING, FULL_MOON,
    G_GENOD, GENOCIDED, I_SPECIAL, Is_waterlevel, KILLED_BY, KILLED_BY_AN, LEVEL_TIMER_KIND,
    M_AP_MONSTER, MV_KNOWS_EGG, NO_KILLER_PREFIX, OBJECT_TIMER_KIND, PLNMSG_OK_DONT_DIE,
    PLNMSG_ONE_ITEM_HERE, POISONING, ROWNO, SICK_ALL, SICK_NONVOMITABLE, STONING, TIMEOUT,
    TURNED_SLIME, W_SADDLE,
} from './const.js';
import {
    AMULET_OF_STRANGULATION, BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, CORPSE, FEDORA,
    GOLD_DRAGON_SCALE_MAIL, GOLD_DRAGON_SCALES, LUCKSTONE, MAGIC_LAMP, OIL_LAMP, POT_OIL,
    ROCK, TALLOW_CANDLE, WAX_CANDLE,
} from './object_data.js';
import { confersLuck } from './invent.js';
import { AD_ELEC, AT_MAGC } from './monster_attack_types.js';
import { isWereMonster, revertHeroWereForm } from './were.js';
import { heroFootName, heroHandName, heroNeckName } from './body_parts.js';
import { clearHeroPetrification, heroIsPetrifying, heroResistsStoning, touchPetrifies } from './stoning.js';
import { displayColorName, monsterName, randomDisplayMonsterName } from './do_name.js';
import { dismountHero } from './steed.js';
import { adjustAttribute, currentAttribute, exerciseAttribute } from './attrib.js';
import {
    extinguishHeroFormLight, heroHasNoLimbs, heroIsBreathless, heroIsGreenSlime,
    heroIsPolymorphed, heroIsUnchanging, heroSpecies, polymonHero, returnHeroToHumanForm,
} from './polyself.js';
import { hurtleHero } from './dothrow.js';
import { finishTeleportArrival } from './teleport.js';
import { gotoLevel } from './level_change.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { refreshHeroSeeing } from './hero_seeing.js';
import { syncHeroInvisibility } from './hero_invisibility.js';
import { stopHeroOccupation } from './occupation.js';
import { finishHeroDeath } from './end.js';
import type { DeathHandler } from './end.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_NAME, PM_GREEN_SLIME, requireMonsterData } from './monster_data.js';
import { canSpotMonster, newsym, see_monsters } from './display.js';
import { pline, plineWithContinuation } from './pline.js';
import type { MessagePublisher } from './pline.js';
import type { GameObject, ObjectTimer, ObjectTimerKind, LevelTimer } from './object_types.js';
import { CANDLE_TYPES, LIGHT_TYPES, TIMED_LIGHT_TYPES, registerObjectLightSource } from './light.js';
import { eating_dangerous_corpse, Popeye, morehungry, vomit } from './eat.js';
import { removeWornHeroItem } from './hero_equipment.js';
import {
    captureLevitationState, floatHeroDown, heroIsUnconscious, resolveImmediatePetrification,
} from './trap.js';
import { runClaimedEggHatchTimer, finishEggHatchTimer } from './egg.js';
import { runClaimedFigurineTimer, finishFigurineTimer } from './figurine.js';
import { meltIce } from './zap.js';

import { runClaimedObjectRotTimer, finishBuriedZombieTimer } from './mklev.js';
import {objectWeight, runClaimedGlobTimer, finishGlobTimer} from './mkobj.js';
import { useUpInventoryStack } from './invent.js';
import { carriedObjectOwner, deleteObject } from './shk.js';
import { possessiveName } from './hacklib.js';
import { getObjectLocation } from './zap.js';
import { artifactEmitsLight } from './artifacts.js';
import { cansee } from './vision.js';
import { heroIsSurroundedByRock } from './pray.js';
import { heroIsInDangerousRegion, visibleRegionLines } from './regions.js';
import { showDisclosureOverlay } from './windows.js';
import { surfaceName } from './terrain_name.js';
import { heroCannotVomit, nameToMonster, monsterHasProperName, monsterOlderForm } from './mondata.js';
import { encumber_msg } from './pickup.js';

interface PetrificationAdvanceResult {
    active: boolean;
    died: boolean;
    turns?: number;
}

// C timeout.c:stoned_dialogue().
export async function petrificationDialogue({
    state = game,
    publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}): Promise<void> {
    const hero = state.u;
    const turns = hero.stonedTurns ?? 0;
    if (turns <= 0) return;

    // stoned_texts[SIZE - i], with "limbs" replaced for a limbless body.
    if (turns > 0 && turns <= 5) {
        let message: string;
        if (turns === 5) message = 'You are slowing down.';
        else if (turns === 4) {
            message = heroHasNoLimbs(state)
                ? 'Your extremities are stiffening.'
                : 'Your limbs are stiffening.';
        } else if (turns === 3) {
            message = heroHasNoLimbs(state)
                ? 'Your extremities have turned to stone.'
                : 'Your limbs have turned to stone.';
        } else if (turns === 2) message = 'You have turned to stone.';
        else message = 'You are a statue.';
        await publish(message, { urgent: true });
    }

    if (turns === 5) {
        removeHeroSpeed(state);
        if (state.multi > 0) endVoluntaryMultiTurn(state);
    } else if (turns === 4) {
        if (!Popeye('stoned', state)) await stopHeroOccupation(state, publish);
        if (state.multi > 0) endVoluntaryMultiTurn(state);
    } else if (turns === 3) {
        await stopHeroOccupation(state, publish);
        nomul(-3, state);
        state._helplessReason = 'getting stoned';
        state._helplessDoneMessage = 'You can move again.';
        if (!hero.usteed)
            await healHeroLegs(state, { cause: 'petrification', publish });
    } else if (turns === 2) {
        if (hero.deafTurns !== undefined && hero.deafTurns > 0 && hero.deafTurns < 5)
            hero.deafTurns = 5;
        cureHeroVomiting(state);
        clearHeroSliming(state);
    }
    await exerciseAttribute(A_DEX, false, state);
}


// C timeout.c:vomiting_dialogue().
export async function vomitingDialogue({
    state = game,
    publish = pline,
    rollDice = d,
}: { state?: GameState; publish?: MessagePublisher; rollDice?: typeof d } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    if (!heroIsVomiting(state)) return { active: false, vomited: false };

    // Untimed nausea has no countdown stage; only timeout 1 triggers vomiting.
    const nextTurns = (hero.vomitingTurns ?? 0) - 1;
    if (nextTurns === 6) {
        await makeStunned((hero.stunnedTurns ?? 0) + rollDice(2, 4), { state, talk: false });
        // stop_occupation finishes an already swallowed last bite before
        // abandoning the meal, including that food's digestion effects.
        if (!Popeye('vomiting', state)) await stopHeroOccupation(state, publish);
        if (state.program_state.gameover)
            return { active: false, vomited: false, turns: nextTurns, died: true };
    }
    if (nextTurns === 6 || nextTurns === 9) {
        await makeConfused((hero.confusionTurns ?? 0) + rollDice(2, 4), { state, talk: false });
        if (state.multi > 0) endVoluntaryMultiTurn(state);
    }

    // vomiting_texts[], with "confused"/"can't seem to" adjusted when the
    // matching condition already holds.
    let message: string | null = null;
    if (nextTurns === 14) message = 'You are feeling mildly nauseated.';
    else if (nextTurns === 11) {
        message = propertyIsActive('confusion', state)
            ? 'You feel slightly more confused.' : 'You feel slightly confused.';
    } else if (nextTurns === 8) {
        message = propertyIsActive('stunned', state)
            ? "You can't think straight."
            : "You can't seem to think straight.";
    } else if (nextTurns === 5) message = 'You feel incredibly sick.';
    else if (nextTurns === 2) {
        if (heroCannotVomit(state)) message = 'You gag uncontrollably.';
        else message = heroIsHallucinating(state)
            ? 'You are about to hurl!' : 'You are about to vomit.';
    }
    if (message) await publish(message);

    let vomited = false;
    if (nextTurns === 0) {
        await stopHeroOccupation(state, publish);
        if (state.program_state.gameover)
            return { active: false, vomited: false, turns: nextTurns, died: true };
        if (!heroCannotVomit(state)) {
            await morehungry(20, { state });
            if (state.program_state.gameover)
                return { active: false, vomited: false, turns: nextTurns, died: true };
            if (hero.uhs < FAINTING) {
                await publish(heroIsHallucinating(state)
                    ? 'You hurl chunks!' : 'You vomit!');
            }
        }
        await vomit({ state, publish });
        vomited = true;
    }

    await exerciseAttribute(A_CON, false, state);
    return { active: heroIsVomiting(state), vomited, turns: nextTurns };
}

const CHOKING_MESSAGES = [
    'You find it hard to breathe.',
    "You're gasping for air.",
    'You can no longer breathe.',
    "You're turning %s.",
    'You suffocate.',
];
const CONSTRICTION_MESSAGES = [
    'Your %s is becoming constricted.',
    'Your blood is having trouble reaching your brain.',
    'The pressure on your %s increases.',
    'Your consciousness is fading.',
    'You suffocate.',
];

// C timeout.c:choke_dialogue().
export async function strangulationDialogue({
    state = game,
    publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}): Promise<void> {
    const hero = state.u;
    const turns = hero.strangledTurns || 0;
    if (turns <= 0) return;

    if (turns <= 5) {
        const index = 5 - turns;
        const constriction = CONSTRICTION_MESSAGES[index];
        const choking = CHOKING_MESSAGES[index];
        if (constriction === undefined || choking === undefined)
            throw new RangeError(`Invalid strangulation countdown: ${turns}`);
        if (heroIsBreathless(state) || rn2(50) === 0) {
            await publish(constriction.replace(
                '%s', heroNeckName(state),
            ), { urgent: true });
        } else {
            let message = choking;
            if (message.includes('%s'))
                message = message.replace('%s', displayColorName('blue', state));
            await publish(message, { urgent: true });
            await stopHeroOccupation(state, publish);
        }
    }
    await exerciseAttribute(A_STR, false, state);
}

// C timeout.c:sickness_dialogue().
export async function sicknessDialogue({
    state = game, publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}): Promise<void> {
    if (!heroIsSick(state)) return;
    // sickness_texts[SIZE - i] on odd countdowns, with "illness" replaced
    // by "sickness" for food poisoning.
    const turns = state.u.sickTurns ?? 0;
    let message: string | null = null;
    if (turns % 2 !== 0) {
        const stage = Math.trunc(turns / 2);
        const noun = ((state.u.sickType ?? 0) & SICK_NONVOMITABLE)
            ? 'illness' : 'sickness';
        if (stage === 3) message = `Your ${noun} feels worse.`;
        else if (stage === 2) message = `Your ${noun} is severe.`;
        else if (stage === 1) message = "You are at Death's door.";
    }
    if (message === "You are at Death's door." && heroIsHallucinating(state)) {
        // C mhe() uses the core RNG for hallucinated pronouns.
        const invitation = ['He is', 'She is', 'It is', 'They are'][rn2(4)];
        if (!invitation) throw new Error('Sickness dialogue chose no pronoun');
        message += `  ${invitation} inviting you in.`;
    }
    if (message) await publish(message, { urgent: true });
    await exerciseAttribute(A_CON, false, state);
}

const LEVITATION_TEXTS = [
    'You float slightly lower.',
    'You wobble unsteadily %s the %s.',
];

// C timeout.c:levitation_dialogue().  Message only; the timeout itself is
// not touched.
// Extrinsic levitation (worn ring or boots, invoked artifact, or the
// mid-drop carried source) suppresses the dialogue entirely, as does
// inaccessible terrain which is not pool or lava.
export async function levitationDialogue(
    state: GameState = game,
    { publish = plineWithContinuation }: { publish?: MessagePublisher } = {},
): Promise<string | null> {
    const hero = state.u;
    const turns = hero.levitationTurns ?? 0;
    // -1 because the last message comes via float_down()
    const index = Math.floor((turns - 1) / 2);

    if (hasWornProperty('levitation', state)
        || hasInvokedProperty('levitation', state)
        || hasCarriedProperty('levitation', null, state))
        return null;

    const terrain = requireGameLevel(state).requireAt(hero.ux, hero.uy);
    const poolOrLava = isPoolOrLavaAt(hero.ux, hero.uy, state);
    if (!ACCESSIBLE(terrain.typ) && !poolOrLava)
        return null;

    if (turns % 2 === 1 && index > 0 && index <= LEVITATION_TEXTS.length) {
        const template = LEVITATION_TEXTS[LEVITATION_TEXTS.length - index];
        if (!template) throw new Error(`No levitation message for ${turns} turns remaining`);
        let message: string;
        if (template.includes('%')) {
            // C uses urgent_pline() for the danger warning.
            const danger = poolOrLava && !Is_waterlevel(hero.uz);
            message = template
                .replace('%s', danger ? 'over' : 'in')
                .replace('%s', danger
                    ? surfaceName(hero.ux, hero.uy, state) : 'air');
        } else {
            message = template;
        }
        await publish(message, { urgent: template.includes('%') });
        await stopHeroOccupation(state, publish);
        return message;
    }
    return null;
}

interface SlimeAdvanceOptions {
    state?: GameState;
    publish?: MessagePublisher;
    repaint?: (x: number, y: number) => unknown;
    randomMonsterName?: () => string;
    transform?: (species: number) => unknown;
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

function removeHeroSpeed(state: GameState): void {
    setPropertyTimeout('fast', 0, state);
    removeIntrinsicProperty('fast', state);
}

// C timeout.c:slime_dialogue().
export async function slimeDialogue({
    state = game,
    publish = plineWithContinuation,
    repaint = () => {},
    randomMonsterName = randomDisplayMonsterName,
}: SlimeAdvanceOptions = {}): Promise<void> {
    const hero = state.u;
    const turns = hero.slimedTurns ?? 0;
    if (turns <= 0) return;

    if (turns === 1) {
        hero.m_ap_type = M_AP_MONSTER;
        hero.mappearance = PM_GREEN_SLIME;
        await repaint(hero.ux, hero.uy);
    }

    // slime_texts[SIZE - i - 1] on odd countdowns; the green warning needs
    // sight, and the transformed-into names honor hallucination.
    const stage = Math.trunc(turns / 2);
    if (turns % 2 !== 0 && stage >= 0 && stage < 5) {
        let message: string | null = null;
        if (turns === 9) {
            message = heroIsBlind(state)
                ? null : `You are turning a little ${displayColorName('green', state)}.`;
        } else if (turns === 7) {
            message = heroHasNoLimbs(state)
                ? 'Your extremities are getting oozy.'
                : 'Your limbs are getting oozy.';
        } else if (turns === 5) message = 'Your skin begins to peel away.';
        else {
            const hallucinating = heroIsHallucinating(state);
            const form = hallucinating ? randomMonsterName() : 'green slime';
            message = turns === 3
                ? `You are turning into ${withIndefiniteArticle(form)}.`
                : `You have become ${withIndefiniteArticle(form)}.`;
        }
        if (message) await publish(message, { urgent: true });
    }


    if (stage === 3) {
        removeHeroSpeed(state);
        if (!Popeye('slimed', state)) await stopHeroOccupation(state, publish);
        if (state.multi > 0) endVoluntaryMultiTurn(state);
    } else if (stage === 2
        && hero.deafTurns !== undefined && hero.deafTurns > 0
        && hero.deafTurns < 5) {
        hero.deafTurns = 5;
    } else if (stage === 1) {
        clearHeroPetrification(state);
    }
    await exerciseAttribute(A_DEX, false, state);
}

// C timeout.c:burn_away_slime(), through make_slimed(0, message).
export async function burnAwayHeroSlime({
    state = game, publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}): Promise<boolean> {
    if (!heroIsSliming(state)) return false;
    state.context.botl = true;
    state.u.slimedTurns = 0;
    state.u.slimed = false;
    await publish('The slime that covers you is burned away!');
    clearHeroSliming(state);
    return true;
}

// The bare Slimed reset shared by potion.c's make_slimed(0) and
// slimed_to_death() below: no botl request, so the status line keeps
// "Slime" until something else asks for a redraw.
// Also C end.c:dealloc_killer(): the delayed slime killer is removed inline here
export function dropHeroSliming(hero: GameState['u']): void {
    hero.slimedTurns = 0;
    hero.slimed = false;
    delete hero.slimeKiller;
    if (hero.m_ap_type === M_AP_MONSTER
        && hero.mappearance === PM_GREEN_SLIME) {
        hero.m_ap_type = 0;
        hero.mappearance = 0;
    }
}

// C timeout.c:slimed_to_death().
export async function advanceHeroSliming({
    state = game, publish = plineWithContinuation, transform, die,
}: SlimeAdvanceOptions = {}): Promise<SlimeAdvanceResult> {
    const hero = state.u;
    const turns = hero.slimedTurns ?? 0;
    if (turns <= 0) return { active: false, died: false };
    hero.slimedTurns = turns - 1;
    if (hero.slimedTurns > 0) {
        hero.slimed = true;
        return { active: true, died: false, turns: hero.slimedTurns };
    }

    if (heroIsGreenSlime(state)) {
        dropHeroSliming(hero);
        return { active: false, died: false };
    }

    const killer = hero.slimeKiller || 'turned into green slime';
    const deathCause = hero.slimeKiller ? null : 'turned into green slime';
    dropHeroSliming(hero);
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
    // polymon() does not do polyself()'s light bookkeeping.
    extinguishHeroFormLight(state);
    try {
        await transform(PM_GREEN_SLIME);
    } finally {
        vitals.mvflags = originalFlags;
    }
    // C done_timeout() sets I_SPECIAL after polymon() cures the timeout.
    // Keep the fatal condition visible through done() and final disclosure.
    hero.slimed = true;
    const died = await die({
        killer,
        deathCause,
        deathVerb: 'turned into slime',
        deathLineShown: true,
        deathType: TURNED_SLIME,
    });
    if (died) return { active: false, died: true, transformed: true };
    clearHeroSliming(state);

    const genocided = !!(
        (state.mvitals?.[PM_GREEN_SLIME]?.mvflags ?? 0) & G_GENOD
    );
    if (!genocided) {
        return { active: false, died: false, transformed: true };
    }

    await publish(state._lastPlineKind === PLNMSG_OK_DONT_DIE
        ? 'Yes, you do.  Green slime has been genocided...'
        : 'Unfortunately, green slime has been genocided...', { urgent: true });
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
    };
}

// C timeout.c:phaze_dialogue().
export async function wallPassageDialogue(state = game): Promise<void> {
    const turns = propertyTimeout('passesWalls', state);
    if (hasIntrinsicProperty('passesWalls', null, state)
        || hasWornProperty('passesWalls', state)
        || hasCarriedProperty('passesWalls', null, state)
        || hasInvokedProperty('passesWalls', state)) return;
    if (turns === 5) await plineWithContinuation('You start to feel bloated.');
    else if (turns === 3) await plineWithContinuation('You are feeling rather flabby.');
}

// C timeout.c:region_dialogue().
export async function breathingDialogue(state = game): Promise<void> {
    const turns = propertyTimeout('magicalBreathing', state);
    if (turns !== 5 && turns !== 3) return;
    // C temporarily masks only the timed source to ask whether the warning
    // is still relevant to this body and the region it currently occupies.
    setPropertyTimeout('magicalBreathing', 0, state);
    let danger: boolean;
    try {
        danger = !heroIsBreathless(state) && heroIsInDangerousRegion(state);
    } finally {
        setPropertyTimeout('magicalBreathing', turns, state);
    }
    if (danger) await plineWithContinuation(turns === 5
        ? 'You seem to have some trouble breathing.' : 'The air here seems foul.');
}


// C timeout.c:sleep_dialogue().
async function sleepDialogue(state: GameState): Promise<void> {
    if (propertyTimeout('sleepy', state) === 4)
        await plineWithContinuation('You yawn.');
}

// C timeout.c:done_timeout() ORs I_SPECIAL into a fatal intrinsic after its
// timer has counted down; the port keeps that condition's flag set at zero.
export function expiredFatally(active: boolean | undefined, turns: number | undefined): boolean {
    return !!active && !turns;
}

// C timeout.c decrements every intrinsic timeout in prop.h order. These
// properties have no dedicated recovery action; their source projection still
// needs refreshing when the timed source ends.
function advanceSimplePropertyTimeouts(properties: readonly PropertyName[], state: GameState): void {
    for (const property of properties) advancePropertyTimeout(property, state);
}

function advancePropertyTimeout(property: PropertyName, state: GameState): boolean {
    const remaining = propertyTimeout(property, state);
    if (remaining <= 0) return false;
    setPropertyTimeout(property, remaining - 1, state);
    return remaining === 1;
}

export async function advanceHeroVomiting({
    state = game, publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}) {
    const hero = state.u;
    const turns = hero.vomitingTurns ?? 0;
    if (turns <= 0) return { active: heroIsVomiting(state), turns: 0 };
    const nextTurns = turns - 1;
    hero.vomitingTurns = nextTurns;
    hero.vomiting = propertyIsActive('vomiting', state);
    if (nextTurns === 0) {
        state.context.botl = true;
        if (hero.vomiting && !heroIsUnaware(state))
            await publish(formatFeltMessage('much less nauseated now.', state));
    }
    return { active: hero.vomiting, turns: nextTurns };
}

export async function advanceHeroSickness({
    state = game,
    publish = pline,
    die = finishHeroDeath,
    random = rn2,
}: {
    state?: GameState;
    publish?: MessagePublisher;
    die?: DeathHandler;
    random?: typeof rn2;
} = {}) {
    const hero = state.u;
    if (!heroIsSick(state)) return { active: false, died: false };

    hero.sickTurns = Math.max(0, (hero.sickTurns ?? 0) - 1);
    if (hero.sickTurns > 0)
        return { active: true, died: false, turns: hero.sickTurns };
    // nh_timeout() has already decremented Sick to zero without marking the
    // status line; only an earlier pending refresh shows the change.
    hero.sick = false;

    const canRecover = !((hero.sickType ?? 0) & SICK_NONVOMITABLE)
        && random(100) < currentAttribute(A_CON, state);
    if (canRecover) {
        await publish('You have recovered from your illness.');
        hero.sickType = 0;
        delete hero.sickCause;
        await exerciseAttribute(A_CON, false, state);
        const change = adjustAttribute(A_CON, -1, state);
        if (change.changed && state._moveloopStarted) await encumber_msg(state);
        return { active: false, died: false, recovered: true, turns: 0 };
    }

    await publish('You die from your illness.', { urgent: true });
    let killer = hero.sickCause || 'illness';
    const species = nameToMonster(killer);
    const personal = species >= 0 && monsterHasProperName(species);
    const unique = species >= 0 && !!((MONSTER_GENO[species] ?? 0) & 0x1000);
    // nh_timeout() resolves personal and unique monster names when the
    // delayed illness becomes fatal, before formatkiller() adds an article.
    if (unique && !personal) killer = definiteName(killer);
    // done_timeout() marks Sick with I_SPECIAL while done() runs.
    hero.sick = true;
    const died = await die({
        killer,
        deathCause: `poisoned by ${personal || unique || killer === '#wizintrinsic'
            ? killer : withIndefiniteArticle(killer)}`,
        deathLineShown: true,
        deathType: POISONING,
    });
    cureHeroSickness(state);
    return { active: false, died: !!died, recovered: false, turns: 0 };
}

export async function advanceHeroPetrification({
    state = game, die = finishHeroDeath,
}: { state?: GameState; die?: DeathHandler } = {}): Promise<PetrificationAdvanceResult> {
    const hero = state.u;
    const turns = hero.stonedTurns ?? 0;
    if (turns <= 0) return { active: false, died: false };
    hero.stonedTurns = turns - 1;
    if (hero.stonedTurns > 0)
        return { active: true, died: false, turns: hero.stonedTurns };

    const killer = hero.stoneKiller || 'petrification';
    const died = await die({
        killer,
        deathCause: petrificationDeathCause(state),
        deathVerb: 'turned to stone',
        deathLineShown: true,
        deathType: STONING,
    });
    clearHeroPetrification(state);
    return { active: false, died: !!died, turns: 0 };
}

// Reading the stored petrification killer and its prefix format back for
// the death report (C end.c:find_delayed_killer()).
function petrificationDeathCause(state: GameState): string {
    const name = state.u.stoneKiller;
    if (!name) return 'killed by petrification';
    const format = state.u.stoneKillerFormat;
    if (format === undefined) throw new Error('Petrification requires its delayed killer format.');
    if (format === NO_KILLER_PREFIX) return name;
    return `petrified by ${format === KILLED_BY_AN ? withIndefiniteArticle(name) : name}`;
}

export async function advanceHeroStrangulation({
    state = game, publish = plineWithContinuation, die = finishHeroDeath,
}: { state?: GameState; publish?: MessagePublisher; die?: DeathHandler } = {}) {
    const hero = state.u;
    const turns = hero.strangledTurns ?? 0;
    if (turns <= 0) return { died: false };
    hero.strangledTurns = turns - 1;
    if (hero.strangledTurns > 0) return { died: false };

    // C done_timeout() keeps the condition visible during death disclosure.
    hero.strangled = true;
    const died = await die({
        killer: hero.uburied ? 'suffocation' : 'strangulation',
        killerFormat: KILLED_BY,
        deathType: DIED,
        // C's timeout death path calls done() directly; only losehp()
        // prints a "You die..." line before the disclosure.
        deathLineShown: true,
    });
    clearHeroStrangulation(state);
    const amulet = state.uamul || hero.uamul;
    if (!died && amulet?.otyp === AMULET_OF_STRANGULATION) {
        await publish('Your amulet vanishes!');
        await deleteObject(amulet, state);
    }
    return { died };
}



// C timeout.c:nh_timeout() (timeout.c:588-948): luck drifts back toward its
// calendar baseline, the fatal-condition dialogues, one countdown pass over
// u.uprops in the prop.h order, and run_timers().
export async function nhTimeout(): Promise<void> {
    const game = requireInitializedGame();
    // C timeout.c:595-620: luck drifts toward its calendar baseline every
    // 600 turns (300 while carrying the Amulet or angering a god).
    {
        let baseline = game.flags.moonphase === FULL_MOON ? 1 : 0;
        if (game.flags.friday13) baseline--;
        if (game.quest_status?.killed_leader) baseline -= 4;
        if (game.urole?.key === 'archeologist'
            && (game.uarmh ?? game.u.uarmh)?.otyp === FEDORA) baseline++;

        const luck = game.u.uluck ?? 0;
        const interval = game.u.uhave?.amulet || game.u.ugangr ? 300 : 600;
        if (luck !== baseline && game.moves % interval === 0) {
            // attrib.c:stone_luck(): count quantities, including luck
            // artifacts.  Uncursed items count for possession but do not
            // favor either timeout.
            let allStones = 0;
            let blessedAndCursed = 0;
            let luckstone = false;
            for (const object of game.inventory) {
                if (!confersLuck(object, game)) continue;
                const quantity = object.quan;
                allStones += object.cursed ? -quantity : quantity;
                if (object.cursed) blessedAndCursed -= quantity;
                else if (object.blessed) blessedAndCursed += quantity;
                if (object.otyp === LUCKSTONE) luckstone = true;
            }
            const noStone = !luckstone && allStones === 0;
            if (luck > baseline && (noStone || blessedAndCursed < 0)) game.u.uluck = luck - 1;
            else if (luck < baseline && (noStone || blessedAndCursed > 0)) game.u.uluck = luck + 1;
        }
    }
    // C timeout.c:621-622: prayer's u.uinvulnerable returns before the
    // dialogues, the countdown, and run_timers().
    if (game.u.invulnerable) return;

    // C timeout.c:623-640: the fatal-condition dialogues.
    if (heroIsPetrifying(game)) {
        await petrificationDialogue({
            state: game,
            publish: plineWithContinuation,
        });
        if (game.program_state?.gameover) return;
    }
    if (heroIsSliming(game)) {
        await slimeDialogue({
            state: game,
            publish: plineWithContinuation,
            repaint: newsym,
            randomMonsterName: randomDisplayMonsterName,
        });
        if (game.program_state?.gameover) return;
    }
    if (heroIsVomiting(game)) {
        await vomitingDialogue({
            state: game,
            publish: plineWithContinuation,
        });
    }
    if (game.u.strangledTurns !== undefined && game.u.strangledTurns > 0) {
        await strangulationDialogue({
            state: game,
            publish: plineWithContinuation,
        });
        if (game.program_state?.gameover) return;
    }
    if (heroIsSick(game)) {
        await sicknessDialogue({
            state: game,
            publish: plineWithContinuation,
        });
        if (game.program_state?.gameover) return;
    }
    await levitationDialogue(game);
    await wallPassageDialogue(game);
    await breathingDialogue(game);
    if (propertyTimeout('sleepy', game) > 0) await sleepDialogue(game);

    // C timeout.c:641-650: the polymorph and creamed counters between the
    // dialogues and the property loop.
    {
        const hero = game.u;
        if (hero.mtimedone !== undefined && hero.mtimedone > 0 && --hero.mtimedone === 0) {
            if (hero.umonnum === undefined) throw new Error('Timed polymorph has no species');
            if (heroIsUnchanging(game)) {
                hero.mtimedone = rnd(100 * requireMonsterData(MONSTER_LEVEL, hero.umonnum) + 1);
            } else if (isWereMonster({ mnum: hero.umonnum })) {
                await revertHeroWereForm({ state: game });
            } else {
                await returnHeroToHumanForm(game);
            }
        }
        if ((hero.ucreamed ?? 0) > 0) hero.ucreamed = (hero.ucreamed ?? 0) - 1;
    }
    if (game.program_state.gameover) return;
    // C timeout.c:652-662: dissipate spell-based protection.
    await advanceSpellProtection(game);
    // C timeout.c:664-667: the steed's gallop counter.
    {
        const hero = game.u;
        if ((hero.ugallop ?? 0) > 0) {
            hero.ugallop = (hero.ugallop ?? 0) - 1;
            if (hero.ugallop === 0 && hero.usteed)
                await plineWithContinuation(`${monsterName(hero.usteed, { state: game, capitalized: true })} stops galloping.`);
        }
    }
    // C timeout.c:669: was_flying is sampled before the countdown loop.
    const wasFlying = propertyIsActive('flying', game);

    // C timeout.c:670-945: one countdown loop over u.uprops in the prop.h
    // enum order. Each expiry runs its case at the point C prints it.
    if (advancePropertyTimeout('fireResistance', game)
        && !propertyIsActive('fireResistance', game))
        await plineWithContinuation('Your temporary ability to survive burning has ended.');
    advanceSimplePropertyTimeouts([
        'coldResistance', 'sleepResistance', 'disintegrationResistance',
    ], game);
    if (game.u.shockResistanceTurns !== undefined && game.u.shockResistanceTurns > 0
        && --game.u.shockResistanceTurns === 0)
        refreshProperty('shockResistance', game);
    advancePropertyTimeout('poisonResistance', game);
    // C timeout.c:813-825 case ACID_RES, 826-844 case STONE_RES, in the
    // loop order right after poison resistance. eating_dangerous_corpse()
    // extends the countdown mid-meal; wielding_corpse() is the bare-handed
    // cockatrice check at the end of STONE_RES.
    requireLiveGame(game);
    requirePlayingGame(game);
    for (const property of ['acidResistance', 'stoneResistance'] as const) {
        const timeout: 'acidResistanceTurns' | 'stoneResistanceTurns' = `${property}Turns`;
        const remaining = game.u[timeout] ?? 0;
        if (!(remaining > 0)) continue;
        game.u[timeout] = remaining - 1;
        if (game.u[timeout] > 0) continue;
        refreshProperty(property, game);
        if (game.u[property]) continue;
        if (eating_dangerous_corpse(property, { state: game })) {
            game.u[timeout] = 1;
            refreshProperty(property, game);
            continue;
        }
        if (!heroIsUnaware(game))
            await plineWithContinuation(property === 'acidResistance'
                ? 'You no longer feel safe from acid.'
                : 'You no longer feel secure from petrification.');
        if (property === 'stoneResistance' && !game.uarmg && !game.u.uarmg) {
            const weapons = [game.uwep || game.u.uwep];
            if (game.u.twoweap) weapons.push(game.uswapwep || game.u.uswapwep);
            for (const object of weapons) {
                if (object?.otyp !== CORPSE || object.corpsenm === undefined
                    || !touchPetrifies(object.corpsenm) || game.u.stoneResistance) continue;
                await plineWithContinuation(`You are wielding ${corpseName(object, { includeArticle: true })} in your bare ${makePlural(heroHandName(game))}.`);
                const result = await resolveImmediatePetrification({
                    state: game,
                    killer: `resistance timing out while wielding ${killerObjectName(object, game)}`,
                });
                if (result.died) return;
                if (!game.u.stoneResistance)
                    // C wielding_corpse() unwields via remove_worn_item(obj, FALSE).
                    await removeWornHeroItem(object, game, { unchainBall: false });
            }
        }
        if (game.program_state.gameover) return;
    }
    advanceSimplePropertyTimeouts(['drainResistance', 'sicknessResistance'], game);
    if (game.u.invulnerableTurns !== undefined && game.u.invulnerableTurns > 0) {
        game.u.invulnerableTurns--;
    }
    if (game.u.magicResistanceTurns !== undefined && game.u.magicResistanceTurns > 0
        && --game.u.magicResistanceTurns === 0)
        refreshProperty('antimagic', game);

    // C timeout.c:737-742 case STUNNED: the loop has consumed the final
    // tick, so make_stunned(0) reports the recovery and redraws.
    if (game.u.stunnedTurns !== undefined && game.u.stunnedTurns > 0) {
        if (game.u.stunnedTurns === 1) {
            await makeStunned(0);
            if (!propertyIsActive('stunned', game)) await stopHeroOccupation(game);
        } else game.u.stunnedTurns--;
    }

    // C timeout.c:730-736 case CONFUSION.
    if (game.u.confusionTurns !== undefined && game.u.confusionTurns > 0) {
        if (game.u.confusionTurns === 1) {
            await makeConfused(0);
            await stopHeroOccupation(game);
        } else game.u.confusionTurns--;
    }

    // C timeout.c:743-758 case BLINDED: sample Blind after the decrement,
    // then restore one tick for make_blinded()'s recovery message.
    if (game.u.blindTurns !== undefined && game.u.blindTurns > 0) {
        game.u.blindTurns--;
        if (game.u.blindTurns === 0) {
            const wasBlind = heroIsBlind(game);
            game.u.blindTurns = 1;
            await makeBlinded(0);
            if (wasBlind && !heroIsBlind(game)) await stopHeroOccupation(game);
        }
    }

    // C timeout.c:752-758 case DEAF.
    if (game.u.deafTurns !== undefined && game.u.deafTurns > 0) {
        if (game.u.deafTurns === 1) {
            await makeDeaf(0);
            if (!heroIsDeaf(game)) await stopHeroOccupation(game);
        } else game.u.deafTurns--;
    }

    // C timeout.c:692-724 case SICK, 674-685 case STONED, 890-901 case
    // STRANGLED, 689-691 case VOMITING.
    await advanceHeroSickness({ publish: plineWithContinuation });
    if (game.program_state.gameover) return;
    await advanceHeroPetrification();
    if (game.program_state.gameover) return;
    await advanceHeroStrangulation();
    if (game.program_state.gameover) return;
    await advanceHeroVomiting();

    // C timeout.c:935-937 case GLIB.
    if (advancePropertyTimeout('glib', game))
        setSlipperyHands(0, game);

    // C timeout.c:686-688 case SLIMED: slimed_to_death().
    await advanceHeroSliming({ transform: polymonHero, die: finishHeroDeath });
    if (game.program_state.gameover) return;

    // C timeout.c:778-783 case HALLUC, 24 no case: HALLUC_RES.
    if (game.u.hallucinationTurns !== undefined && game.u.hallucinationTurns > 0) {
        if (game.u.hallucinationTurns === 1) {
            await makeHallucinated(0);
            if (!heroIsHallucinating(game)) await stopHeroOccupation(game);
        } else game.u.hallucinationTurns--;
    }
    advancePropertyTimeout('hallucinationResistance', game);

    // C timeout.c:902-931 case FUMBLING: slip_or_trip() and its noise run
    // only when a move took place; the rest of the case is local.
    if (game.u.fumblingTurns !== undefined && game.u.fumblingTurns > 0) {
        game.u.fumblingTurns--;
        if (game.u.fumblingTurns === 0) {
            const levitating = !!(game.u?.levitating
                || game.u?.levitation || game.levitating);
            const flying = !!(game.u?.flying || game.flying);
            if (game.u?.umoved && !levitating && !flying) {
                await slipOrTrip(plineWithContinuation);
                if (game.program_state.gameover) return;
                nomul(-2);
                game._helplessDoneMessage = '';
                game._helplessReason = 'fumbling';
                // The more you are carrying the more likely you
                // are to make noise when you fumble.
                if (invWeight(game) > -500) {
                    if (!heroIsDeaf(game)) await plineWithContinuation('You make a lot of noise!');
                    await wakeMonstersNearWithMessages(game.u.ux, game.u.uy, game.u.ulevel * 20, game, plineWithContinuation);
                }
            }
            // From outside means slippery ice; don't reset the counter if
            // that's the only fumble reason.
            game.u.fumblingFromIce = false;
            if (game.u?.fumblingFromArmor || game.u.fumblingIntrinsic || propertyIsActive('fumbling', game))
                game.u.fumblingTurns = (game.u.fumblingTurns ?? 0) + rnd(20);
            game.u.fumbling = !!(game.u?.fumblingFromArmor
                || game.u.fumblingIntrinsic
                || propertyIsActive('fumbling', game)
                || (game.u.fumblingTurns !== undefined && game.u.fumblingTurns > 0));
            // A decor message deferred past the trip catches up here.
            if (game.iflags.deferDecor) await deferredDecor(false);
        }
    }

    // C timeout.c:774-777 case WOUNDED_LEGS.
    if (game.u._woundedLegTurns !== undefined && game.u._woundedLegTurns > 0) {
        game.u._woundedLegTurns--;
        if (game.u._woundedLegTurns === 0) {
            await healHeroLegs(game);
            refreshProperty('woundedLegs', game);
            await stopHeroOccupation(game);
        }
    }

    // C timeout.c:784-793 case SLEEPY, 28 no case: HUNGER.
    if (advancePropertyTimeout('sleepy', game)) {
        if (heroIsUnconscious(game) || game.u.sleepResistance) {
            setPropertyTimeout('sleepy', rnd(100), game);
        } else if (propertyIsActive('sleepy', game)) {
            await plineWithContinuation('You fall asleep.');
            const sleeptime = rnd(20);
            await putHeroToSleep(sleeptime, { state: game });
            setPropertyTimeout('sleepy', sleeptime + rnd(100), game);
        }
    }
    advancePropertyTimeout('hunger', game);

    // C timeout.c:768-773 case SEE_INVIS.
    if (game.u.seeInvisibleTurns !== undefined && game.u.seeInvisibleTurns > 0) {
        game.u.seeInvisibleTurns--;
        if (game.u.seeInvisibleTurns === 0) {
            refreshProperty('seeInvisible', game);
            await refreshHeroSeeing();
            await stopHeroOccupation(game);
        }
    }

    // C timeout.c: no case for TELEPAT and WARNING; 862-873 case WARN_OF_MON.
    advanceSimplePropertyTimeouts(['telepathy', 'warning'], game);
    if (advancePropertyTimeout('warnOfMonster', game)
        && !propertyIsActive('warnOfMonster', game)) {
        const species = game.context.warntype?.speciesidx;
        if (game.context.warntype) game.context.warntype.speciesidx = -1;
        if (species !== undefined && species >= 0) {
            const name = MONSTER_NAME[species];
            if (name) await plineWithContinuation(`You are no longer warned about ${makePlural(name)}.`);
        }
    }
    advanceSimplePropertyTimeouts([
        'warnUndead', 'searching', 'clairvoyant', 'infravision',
    ], game);

    // C timeout.c:932-934 case DETECT_MONSTERS.
    if (game.u.monsterDetectionTurns !== undefined && game.u.monsterDetectionTurns > 0) {
        game.u.monsterDetectionTurns--;
        if (!game.u.monsterDetectionTurns) {
            refreshProperty('detectMonsters', game);
            await see_monsters();
        }
    }
    advanceSimplePropertyTimeouts(['blindResistance', 'adorned'], game);

    // C timeout.c:759-767 case INVIS.
    if (game.u.invisibleTurns !== undefined && game.u.invisibleTurns > 0) {
        game.u.invisibleTurns--;
        if (game.u.invisibleTurns === 0) {
            const stillInvisible = syncHeroInvisibility(game);
            await newsym(game.u.ux, game.u.uy);
            if (!stillInvisible && !propertyIsBlocked('invisible', game) && !heroIsBlind(game)) {
                await plineWithContinuation(game.u.seeInvisible
                    ? 'You can no longer see through yourself.'
                    : 'You are no longer invisible.');
                await stopHeroOccupation(game);
            }
        }
    }

    // C timeout.c:858-861 case DISPLACED.
    await advanceDisplacementTimeout(game);

    advanceSimplePropertyTimeouts([
        'stealth', 'aggravateMonster', 'conflict', 'jumping',
        'teleportation', 'teleportControl',
    ], game);

    // C timeout.c:794-812 cases LEVITATION and FLYING, in that order.
    // Expiry lands the hero through the live float-down owner.
    requireLiveGame(game);
    {
        const turns = game.u.levitationTurns ?? 0;
        if (turns > 0) {
            // `previous` is captured before the decrement so float_down
            // reports the pre-expiry movement state.
            const previous = captureLevitationState(game);
            game.u.levitationTurns = turns - 1;
            // C macros read live state after the countdown; keep the
            // projected hero fields in step before any expiry work.
            refreshProperty('levitation', game);
            if (game.u.levitationTurns === 0) {
                // Timed Flying expiring on the same turn would make
                // float_down report "stopped levitating and are now flying";
                // end it early to skip that false takeover.  Assumes
                // levitation is handled before flying (timeout.c:795-802).
                if ((game.u.flyingTurns ?? 0) === 1) {
                    game.u.flyingTurns = 0;
                    refreshProperty('flying', game);
                }
                await floatHeroDown(I_SPECIAL | TIMEOUT, 0, game, previous);
            }
        }
    }
    if (game.program_state?.gameover) return;
    requireLiveGame(game);
    {
        const turns = game.u.flyingTurns ?? 0;
        if (turns > 0) {
            game.u.flyingTurns = turns - 1;
            // C macros read live state after the countdown; keep the
            // projected hero fields in step before the landing checks.
            refreshProperty('flying', game);
            if (game.u.flyingTurns === 0 && wasFlying && !propertyIsActive('flying', game)) {
                game.context.botl = true;
                await plineWithContinuation('You land.');
                await applyHeroLocationEffects(plineWithContinuation);
            }
        }
    }
    if (game.program_state?.gameover) return;

    // C timeout.c:853-857 case WWALKING, 51 no case: SWIMMING,
    // 883-889 case MAGICAL_BREATHING, 874-882 case PASSES_WALLS,
    // 54 no case: SLOW_DIGESTION.
    if (advancePropertyTimeout('waterWalking', game)
        && !propertyIsActive('waterWalking', game))
        await plineWithContinuation('Your temporary ability to walk on liquid has ended.');
    advancePropertyTimeout('swimming', game);
    // C timeout.c:883-889 case MAGICAL_BREATHING.
    if (advancePropertyTimeout('magicalBreathing', game)
        && !heroIsBreathless(game) && heroIsInDangerousRegion(game))
        await plineWithContinuation(game.u.poisonResistance
            ? 'You cough.' : 'You cough and spit blood!');
    // C timeout.c:874-882 case PASSES_WALLS.
    if (advancePropertyTimeout('passesWalls', game)
        && !propertyIsActive('passesWalls', game))
        await plineWithContinuation(heroIsSurroundedByRock(game)
            ? formatFeltMessage('hemmed in again.', game)
            : `You're back to your ${heroIsPolymorphed(game) ? 'unusual' : 'normal'} self again.`);
    advancePropertyTimeout('slowDigestion', game);
    advanceSimplePropertyTimeouts(['halfSpellDamage', 'halfPhysicalDamage'], game);
    advanceSimplePropertyTimeouts([
        'regeneration', 'energyRegeneration', 'protection',
    ], game);

    // C timeout.c:938-943 case PROT_FROM_SHAPE_CHANGERS.
    if (advancePropertyTimeout('protectionFromShapeChangers', game)
        && !propertyIsActive('protectionFromShapeChangers', game))
        await restartMonsterShapechanging(game);
    advanceSimplePropertyTimeouts([
        'polymorph', 'polymorphControl', 'unchanging',
    ], game);

    // C timeout.c:725-729 case FAST: timed FAST is very fast.
    if (game.u.veryFastTurns !== undefined && game.u.veryFastTurns > 0) {
        setPropertyTimeout('fast', game.u.veryFastTurns - 1, game);
        if (game.u.veryFastTurns === 0) {
            if (!game.u.veryFast)
                await plineWithContinuation(formatFeltMessage(game.u.fast ? 'yourself slow down a bit.' : 'yourself slow down.'));
        }
    }
    advanceSimplePropertyTimeouts([
        'reflection', 'freeAction', 'sustainAbility', 'lifeSaving',
    ], game);

    // C timeout.c:947: run_timers() is nh_timeout()'s last statement. The
    // turn's moves value is already final here, so timer_effects.js owns the
    // loop.
    await runDueTimers();
}

// C timeout.c:fall_asleep().
export async function putHeroToSleep(turns: number, {
    state = game,
    doneMessage = 'You wake up.',
    publish = plineWithContinuation as MessagePublisher,
} = {}) {
    const hero = state.u;
    // fall_asleep() begins with stop_occupation(), which reports the
    // interrupted activity.
    await stopHeroOccupation(state, publish);
    const duration = Math.max(0, turns);
    // nomul() refuses to shorten an existing involuntary delay. fall_asleep()
    // still installs its sleep marker and recovery message afterward.
    nomul(-duration, state);
    state._helplessReason = 'sleeping';
    state._helplessDoneMessage = doneMessage;
    hero.usleep = state.moves || 1;
    return state._helplessTurns;
}

// C timeout.c:learn_egg_type().
export function learnEggType(mnum: number, state: GameState) {
    const adult = monsterOlderForm(mnum);
    if (!Array.isArray(state.mvitals)) state.mvitals = [];
    const vital = state.mvitals[adult]
        || (state.mvitals[adult] = { mvflags: 0, born: 0, died: 0 });
    vital.mvflags = (vital.mvflags ?? 0) | MV_KNOWS_EGG;
}

// C timeout.c:attach_egg_hatch_timeout().
export function attachEggHatchTimer(egg: GameObject, remaining = 0): void {
    stopObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG);
    if (remaining > 0) {
        scheduleObjectTimer(
            egg, OBJECT_TIMER_KIND.HATCH_EGG,
            (game.moves ?? 0) + remaining, game,
        );
        return;
    }
    // The legacy per-turn hatch trial: age 151 through 200, hatching when
    // a roll of the age itself beats 150.
    for (let age = 151; age <= 200; age++) {
        if (rnd(age) <= 150) continue;
        scheduleObjectTimer(
            egg, OBJECT_TIMER_KIND.HATCH_EGG,
            (game.moves ?? 0) + age, game,
        );
        return;
    }
}

// C timeout.c:kill_egg(): prevent an egg from ever hatching.
export function killEgg(egg: GameObject | null | undefined): void {
    stopObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG);
}

// Saveable object and level-position timer ordering (folded from
// object_timers.js into its C owner).
// C ref: timeout.c start_timer()/insert_timer()/run_timers().

type TimerKind = ObjectTimerKind | LevelTimer['kind'];
export type DueObjectTimer = {
    object: GameObject;
    timer: ObjectTimer;
} | {
    object: null;
    position: { x: number; y: number };
    timer: LevelTimer;
};
const OBJECT_TIMER_KINDS = new Set(Object.values(OBJECT_TIMER_KIND));
function timersFor(object: GameObject | null | undefined): ObjectTimer[] {
    if (!object) return [];
    if (!Array.isArray(object.objectTimers))
        object.objectTimers = [];
    object.timed = object.objectTimers.length;
    return object.objectTimers;
}
function levelTimersFor(state: GameState = game): LevelTimer[] {
    if (!state.level) return [];
    if (!Array.isArray(state.level.levelTimers))
        state.level.levelTimers = [];
    return state.level.levelTimers;
}
function allocateTimerId(state: GameState = game): number {
    const prior = state._nextObjectTimerId ?? 0;
    const id = prior + 1;
    state._nextObjectTimerId = id;
    return id;
}
function nextTimerOrder(state: GameState): number {
    state._timerSerial = (state._timerSerial ?? 0) + 1;
    return state._timerSerial;
}
export function scheduleObjectTimer(
    object: GameObject | null | undefined, kind: ObjectTimerKind,
    deadline: number, state: GameState = game,
): ObjectTimer | null {
    if (!object || !OBJECT_TIMER_KINDS.has(kind) || !Number.isFinite(deadline))
        return null;
    const timers = timersFor(object);
    if (timers.some(timer => timer.kind === kind)) return null;
    const timer = { kind, deadline, id: allocateTimerId(state), order: nextTimerOrder(state) };
    timers.push(timer);
    object.timed = timers.length;
    return timer;
}
export function scheduleLevelTimer(
    x: number, y: number, kind: LevelTimer['kind'],
    deadline: number, state: GameState = game,
): LevelTimer | null {
    if (!state.level || kind !== LEVEL_TIMER_KIND.MELT_ICE_AWAY
        || !Number.isInteger(x) || !Number.isInteger(y)
        || !Number.isFinite(deadline)) return null;
    const timers = levelTimersFor(state);
    if (timers.some(timer => timer.x === x && timer.y === y && timer.kind === kind)) return null;
    const timer = {
        kind, deadline, id: allocateTimerId(state), order: nextTimerOrder(state), x, y,
    };
    timers.push(timer);
    return timer;
}
// C timeout.c:spot_stop_timers().
// C timeout.c:remove_timer(): the splice that pulls the matching timers
// out of the level's list.
export function stopLevelTimer(
    x: number, y: number, kind: LevelTimer['kind'], state: GameState = game,
): LevelTimer[] {
    const timers = levelTimersFor(state);
    const removed: LevelTimer[] = [];
    for (let index = timers.length - 1; index >= 0; index--) {
        const timer = timers[index];
        if (!timer) throw new Error(`Missing level timer at index ${index}`);
        if (timer.x !== x || timer.y !== y || timer.kind !== kind) continue;
        removed.unshift(...timers.splice(index, 1));
    }
    return removed;
}
// C timeout.c:stop_timer(), the object variant; C timeout.c:remove_timer():
// the find-and-splice that pulls one timer out of its object's list.
export function stopObjectTimer(
    object: GameObject | null | undefined, kind: ObjectTimerKind | null,
): ObjectTimer | null {
    if (!object) return null;
    const timers = timersFor(object);
    const index = timers.findIndex(timer => timer.kind === kind);
    if (index < 0) return null;
    const [timer] = timers.splice(index, 1);
    if (!timer) throw new Error(`Missing object timer at index ${index}`);
    object.timed = timers.length;
    return timer;
}
export function stopAllObjectTimers(
    object: GameObject | null | undefined,
): ObjectTimer[] {
    if (!object) return [];
    const timers = timersFor(object).splice(0);
    object.timed = 0;
    return timers;
}
export function stopObjectTimers(object: GameObject, state: GameState): void {
    const stoppedTimers = stopAllObjectTimers(object);
    const burn = stoppedTimers.find(timer =>
        timer.kind === OBJECT_TIMER_KIND.BURN_OBJECT);
    if (burn) cleanupObjectBurn(object, burn.deadline, state);
}

// The port's whole-object graph: every list that C shk.c:find_oid()
// searches by o_id, walked once so callers can inline their o_on() scan.
export function objectsInTimerGraph(state: GameState = game): GameObject[] {
    const objects: GameObject[] = [];
    const seen = new Set<GameObject>();
    const visit = (object: GameObject | null | undefined): void => {
        if (!object || seen.has(object)) return;
        seen.add(object);
        objects.push(object);
        for (const content of object.contents || []) visit(content);
    };
    for (const column of state.level?.objects || [])
        for (const pile of column || [])
            for (const object of pile || []) visit(object);
    for (const object of state.level?.buriedObjects || []) visit(object);
    for (const object of state.inventory || []) visit(object);
    for (const object of state._tutorialState?.inventory || []) visit(object);
    for (const reference of state._luaObjectRefs || []) visit(reference.deref());
    for (const object of state.migratingObjects || []) visit(object);
    const monsters = (state.level?.monsters ?? []).concat(state._migratingMonsters ?? []);
    for (const monster of monsters) {
        for (const object of monster.minvent || []) visit(object);
        for (const object of monster.inventory || []) visit(object);
    }
    return objects;
}
function allowedKind(
    kind: TimerKind, allowedKinds: ReadonlySet<TimerKind> | null,
): boolean {
    return !allowedKinds || allowedKinds.has(kind);
}
function precedes(left: DueObjectTimer, right: DueObjectTimer | null): boolean {
    return !right || left.timer.deadline < right.timer.deadline
        || (left.timer.deadline === right.timer.deadline
            && left.timer.order > right.timer.order);
}
export function peekNextDueObjectTimer(
    state: GameState = game, currentTurn: number = state.moves ?? 0,
    allowedKinds: ReadonlySet<TimerKind> | null = null,
): DueObjectTimer | null {
    let next: DueObjectTimer | null = null;
    for (const object of objectsInTimerGraph(state)) {
        for (const timer of timersFor(object)) {
            if (timer.deadline > currentTurn
                || !allowedKind(timer.kind, allowedKinds)) continue;
            // timeout.c:insert_timer() inserts a new timer before the first
            // existing timer with an equal deadline.  Equal-time callbacks
            // therefore execute in descending insertion order. Restoring
            // reinserts timers without changing their diagnostic IDs.
            const candidate = { object, timer };
            if (precedes(candidate, next)) next = candidate;
        }
    }
    for (const timer of levelTimersFor(state)) {
        if (timer.deadline > currentTurn
            || !allowedKind(timer.kind, allowedKinds)) continue;
        const candidate = {
            object: null,
            position: { x: timer.x, y: timer.y },
            timer,
        };
        if (precedes(candidate, next)) next = candidate;
    }
    return next;
}
export function claimNextDueObjectTimer(
    state: GameState = game, currentTurn: number = state.moves ?? 0,
    allowedKinds: ReadonlySet<TimerKind> | null = null,
): DueObjectTimer | null {
    const next = peekNextDueObjectTimer(state, currentTurn, allowedKinds);
    if (!next) return null;
    if (next.object) {
        const timers = timersFor(next.object);
        const index = timers.indexOf(next.timer);
        if (index >= 0) timers.splice(index, 1);
        next.object.timed = timers.length;
    } else {
        const timers = levelTimersFor(state);
        const index = timers.indexOf(next.timer);
        if (index >= 0) timers.splice(index, 1);
    }
    return next;
}
export function objectTimers(object: GameObject | null | undefined): ObjectTimer[] {
    return timersFor(object).map(timer => ({ ...timer }));
}
export function copyObjectTimers(
    source: GameObject | null | undefined, destination: GameObject,
    state: GameState = game,
): ObjectTimer[] {
    // C obj_split_timers() walks the queue in expiry order, including its
    // newest-first order for ties, before assigning the copied timer IDs.
    const timers = objectTimers(source).sort((left, right) =>
        left.deadline - right.deadline || right.order - left.order);
    for (const timer of timers) {
        scheduleObjectTimer(
            destination, timer.kind, timer.deadline, state,
        );
    }
    return objectTimers(destination);
}
export function levelTimers(state: GameState = game): LevelTimer[] {
    return levelTimersFor(state).map(timer => ({ ...timer }));
}
export interface QueuedObjectTimer {
    object: GameObject;
    timer: ObjectTimer;
}
export interface QueuedLevelTimer {
    position: { x: number; y: number };
    timer: LevelTimer;
}
export type QueuedTimer = QueuedObjectTimer | QueuedLevelTimer;
// C timeout.c: the timer queue holds object and level timers in one
// deadline-ordered list; insert_timer() places a new entry before existing
// equal-deadline entries, so ties run most recently inserted first.
export function queuedTimers(state: GameState = game): QueuedTimer[] {
    const queued: QueuedTimer[] = [];
    for (const object of objectsInTimerGraph(state))
        for (const timer of timersFor(object))
            queued.push({ object, timer: { ...timer } });
    for (const timer of levelTimersFor(state))
        queued.push({ position: { x: timer.x, y: timer.y }, timer: { ...timer } });
    return queued.sort((left, right) =>
        left.timer.deadline - right.timer.deadline || right.timer.order - left.timer.order);
}
// C timeout.c:obj_is_local(). Contents follow their outermost owner;
// objects carried by migrating monsters belong to the global batch.
// Also C timeout.c:timer_is_local(): object-timer classification is inlined here
function objectTimerIsGlobal(object: GameObject, state: GameState): boolean {
    let outer = object;
    while (outer.where === 'contained' && outer.container) outer = outer.container;
    if (outer.where === 'inventory' || outer.where === 'migrating') return true;
    return outer.where === 'minvent' && !!outer.ocarry
        && !!state._migratingMonsters?.includes(outer.ocarry);
}

// A light's global/local batch split: light.c decides with
// `is_global = !obj_is_local(...)` (light.c:450,583), using its own local
// `mon_is_local(mon)` macro — `(mon)->mx > 0` (light.c:373) — rather than
// timeout.c's mon_is_local(); the timer queue's port of obj_is_local() is
// objectTimerIsGlobal() above.
export function lightObjectIsGlobal(object: GameObject): boolean {
    let outermost = object;
    while (outermost.where === 'contained' && outermost.container)
        outermost = outermost.container;
    switch (outermost.where) {
        case 'inventory':
        case 'migrating':
            return true;
        case 'minvent':
            return !outermost.ocarry || outermost.ocarry.mx === 0;
        case 'buried':
        case 'contained':
        case 'floor':
        case 'free':
        case 'gone':
        case 'onbill':
            return false;
    }
}
// save_timers() writes queue order; restore_timers() calls insert_timer()
// for each saved entry. Equal-time entries reverse within each batch.
function restoreTimerBatch(timers: readonly (ObjectTimer | LevelTimer)[], state: GameState): void {
    const savedOrder = [...timers].sort((left, right) =>
        left.deadline - right.deadline || right.order - left.order);
    for (const timer of savedOrder) timer.order = nextTimerOrder(state);
}
export function restoreLevelTimers(state: GameState = game): void {
    const local = objectsInTimerGraph(state).filter(object => !objectTimerIsGlobal(object, state));
    restoreTimerBatch([
        ...local.flatMap(object => timersFor(object)), ...levelTimersFor(state),
    ], state);
}
export function restoreSavedTimers(state: GameState = game): void {
    const global = objectsInTimerGraph(state).filter(object => objectTimerIsGlobal(object, state));
    restoreTimerBatch(global.flatMap(object => timersFor(object)), state);
    // dorecover() reloads the current level after the global state, placing
    // its timers ahead of equal-time global timers.
    restoreLevelTimers(state);
}


// C timeout.c:slip_or_trip().  Fumbling arrival message, ice slides, and
// the pet-loss dismount, all after the fumbling source's timeout fires.

export async function slipOrTrip(publish: MessagePublisher = plineWithContinuation): Promise<void> {
    const hero = game.u;
    const steed = hero.usteed;
    const pile = game.level?.objects[hero.ux]?.[hero.uy] ?? [];
    const top = !steed && !(isPoolAt(hero.ux, hero.uy) && !hero.uinwater) ? pile[0] : undefined;
    const hallucinating = heroIsHallucinating(game);
    if (top) {
        let what: string;
        if (game._lastPlineKind === PLNMSG_ONE_ITEM_HERE)
            what = top.quan === 1 ? 'it' : hallucinating ? 'they' : 'them';
        else if (top.dknown || !heroIsBlind(game)) {
            observeObjectForNaming(top);
            what = await objectDescription(top, { state: game });
        }
        else {
            const rocks = pile.find(object => object.otyp === ROCK);
            what = rocks ? rocks.quan === 1 ? 'a rock' : 'some rocks' : 'something';
        }
        await publish(hallucinating
            ? `Egads!  ${what.charAt(0).toUpperCase()}${what.slice(1)} bite${top.quan === 1 ? 's' : ''} your ${heroFootName(game)}!`
            : `You trip over ${what}.`);
        if (!game.uarmf && !hero.uarmf && top.otyp === CORPSE
            && touchPetrifies(top.corpsenm) && !heroResistsStoning(game)) {
            await resolveImmediatePetrification({
                killer: `tripping over ${withIndefiniteArticle(MONSTER_NAME[top.corpsenm ?? -1] ?? 'monster')} corpse`, publish,
            });
        }
        return;
    }
    const onIce = isIceAt(hero.ux, hero.uy);
    const saddle = steed?.minvent?.find(object => (object.owornmask ?? 0) & W_SADDLE);
    if (hero.fumblingFromIce || onIce && !rn2(3)) {
        const iceOnly = !hero.fumblingFromArmor && !hero.fumblingIntrinsic
            && !propertyIsActive('fumbling', game);
        const subject = steed ? monsterName(steed, {
            state: game, capitalized: true, suppressSaddle: true,
        }) : 'You';
        const verb = rn2(2) ? 'slip' : 'slide';
        await publish(`${subject} ${verb}${steed ? 's' : ''} ${onIce ? 'on' : 'off'} the ice.`);
        if (steed && !saddle?.cursed && (!iceOnly || !rn2(3))) {
            await publish('You lose your balance.');
            await dismountHero(DISMOUNT_FELL, { announce: publish });
        } else if (!rn2(10 + currentAttribute(A_DEX, game))) {
            if (heroSpecies(game) !== MONSTER_NAME.indexOf('grid bug')) {
                const directions: readonly (readonly [number, number])[] = [
                    [-1, 0], [0, -1], [1, 0], [0, 1], [-1, -1], [1, -1], [1, 1], [-1, 1],
                ];
                const direction = directions[rn2(directions.length)];
                if (!direction) throw new Error('Ice slip chose no direction');
                [hero.dx, hero.dy] = direction;
            }
            const dx = hero.dx ?? 0, dy = hero.dy ?? 0;
            if (hero.ux + dx !== hero.ux0 || hero.uy + dy !== hero.uy0)
                await hurtleHero(dx, dy, 1, {
                    verbose: false, finishTeleport: finishTeleportArrival, gotoLevel,
                    finishMonsterDeath: (monster, death) => finishHeroMonsterKill(
                        monster, monster.mx, monster.my, {
                            ...death, showKillMessage: false, recordConduct: false, publish,
                        },
                    ),
                });
        }
        return;
    }
    if (steed && saddle?.cursed) return;
    const feet = makePlural(heroFootName(game));
    const messages = steed ? [
        'You slide to one side of the saddle.', `Your ${feet} slip out of the stirrups.`,
        'You let go of the reins.', 'You bang into the saddle-horn.',
    ] : [
        'You stumble.', `You trip over your own ${hallucinating ? 'elbow' : feet}.`,
        `You slip ${hallucinating ? 'on a banana peel' : 'and nearly fall'}.`, 'You flounder.',
    ];
    const message = messages[rn2(4)];
    if (!message) throw new Error('Fumbling chose no message');
    await publish(message);
    if (steed) await dismountHero(DISMOUNT_FELL, { announce: publish });
}

export interface BurnTimerResult {
    object: GameObject;
    threshold: number;
    overdue: boolean;
    destroyed?: boolean;
}


// C timeout.c:see_lamp_flicker().  Print a lamp flicker message with
// tailer.  Only called if seen.
async function seeLampFlicker(
    object: GameObject, tailer: string, state: GameState,
): Promise<void> {
    if (object.where === 'floor')
        await plineWithContinuation(formatSeenMessage(
            `${withIndefiniteArticle(objectName(object, state))} flicker${tailer}.`, state));
    else
        await plineWithContinuation(`${burnName(object, state)} flickers${tailer}.`);
}

// C timeout.c:lantern_message().  Print a dimming message for brass
// lanterns.  Only called if seen.
async function lanternMessage(object: GameObject, state: GameState): Promise<void> {
    if (object.where === 'floor') {
        await plineWithContinuation(formatSeenMessage('a lantern getting dim.', state));
        return;
    }
    await plineWithContinuation(object.where === 'inventory' ? 'Your lantern is getting dim.'
        : `${burnOwner(object, state)} lantern is getting dim.`);
    if (object.where === 'inventory' && heroIsHallucinating(state))
        await plineWithContinuation('Batteries have not been invented yet.');
}

async function announceCandleBurn(
    object: GameObject, threshold: number, visible: boolean, byTouch: boolean,
    state: GameState, ownership: string,
): Promise<void> {
    const menorah = object.otyp === CANDELABRUM_OF_INVOCATION;
    const many = menorah ? object.spe > 1 : (object.quan ?? object.quantity ?? 1) > 1;
    const floor = object.where === 'floor';
    const candle = `${menorah ? "candelabrum's " : ''}candle`;
    const owner = floor ? formatSeenMessage(`${menorah ? 'a ' : many ? 'some ' : 'a '}`, state) : `${ownership} `;
    if (threshold === 75 && visible) {
        await plineWithContinuation(`${owner}${candle}${many ? 's' : ''}${floor ? '' : many ? ' are' : ' is'} getting short.`);
    } else if (threshold === 15 && visible) {
        await plineWithContinuation(`${owner}${candle}${many ? "s'" : "'s"} flame${many ? 's' : ''} flicker${floor || many ? '' : 's'} low!`);
    } else if (threshold === 0 && (visible || byTouch)) {
        if (menorah) await plineWithContinuation(floor
            ? formatSeenMessage(`a candelabrum's flame${many ? 's' : ''} die.`, state)
            : `${ownership} candelabrum's flame${many ? 's die' : ' dies'}.`);
        else {
            const name = objectName(object, state);
            await plineWithContinuation(floor
                ? formatSeenMessage(`${many ? `some ${makePlural(name)}` : withIndefiniteArticle(name)} consumed!`, state)
                : `${burnName(object, state)} ${many ? 'are' : 'is'} consumed!`);
            if (heroIsHallucinating(state)) await plineWithContinuation(many ? 'They shriek!' : 'It shrieks!');
            else if (!heroIsBlind(state)) await plineWithContinuation(many ? 'Their flames die.' : 'Its flame dies.');
        }
    }
}

// C timeout.c:burn_object(). The claimed timer is already removed. Messages
// may pause before expiry removes equipment or bills; a late level timer
// catches up silently without replaying warnings from the absent hero.
export async function runClaimedObjectBurnTimer(
    claimed: DueObjectTimer | null | undefined, state: GameState = game, currentTurn = state.moves ?? 0,
): Promise<BurnTimerResult | null> {
    const object = claimed?.object;
    const timeout = claimed?.timer?.deadline;
    if (!object || !TIMED_LIGHT_TYPES.has(object.otyp) || !object.lamplit
        || typeof timeout !== 'number' || !Number.isFinite(timeout)) return null;
    if (timeout !== currentTurn) {
        const elapsed = currentTurn - timeout;
        if (elapsed >= (object.age ?? 0)) {
            object.age = 0;
            const destroyed = await finishBurnedObject(object, state, { overdue: true });
            return { object, threshold: 0, overdue: true, destroyed };
        }
        object.age -= elapsed;
        beginObjectBurn(object, state, currentTurn);
        return { object, threshold: object.age, overdue: true };
    }
    const threshold = object.age ?? 0;
    const location = getObjectLocation(object, state);
    const visible = !heroIsBlind(state) && !!location && cansee(location.x, location.y);
    const owner = location ? burnOwner(object, state) : '';
    const byTouch = object.where === 'inventory' && object.otyp !== BRASS_LANTERN;
    if (object.otyp === POT_OIL) {
        if (visible) await plineWithContinuation(object.where === 'floor'
            ? formatSeenMessage('a burning potion of oil go out.', state) : `${owner} potion of oil has burnt away.`);
    } else if (CANDLE_TYPES.has(object.otyp)) {
        // C timeout.c:1546-1670: candelabrum and candle countdowns.
        await announceCandleBurn(object, threshold, visible, byTouch, state, owner);
    } else {
        // C timeout.c:1474-1544: BRASS_LANTERN and OIL_LAMP.  The magic
        // ages are 150, 100, 50, 25 and 0.
        const lantern = object.otyp === BRASS_LANTERN;
        const floor = object.where === 'floor';
        if (threshold === 150 || threshold === 100 || threshold === 50) {
            if (visible) {
                if (lantern) await lanternMessage(object, state);
                else await seeLampFlicker(object, threshold === 50 ? ' considerably' : '', state);
            }
        } else if (threshold === 25) {
            if (visible) {
                if (lantern) await lanternMessage(object, state);
                else await plineWithContinuation(floor
                    ? formatSeenMessage(`${withIndefiniteArticle(objectName(object, state))} about to go out.`, state)
                    : `${burnName(object, state)} seems about to go out.`);
            }
        } else if (threshold === 0 && (visible || byTouch)) {
            // Even if blind you'll know if holding it.
            await plineWithContinuation(lantern
                ? floor ? formatSeenMessage('a lantern run out of power.', state) : `${owner} lantern has run out of power.`
                : floor ? formatSeenMessage(`${withIndefiniteArticle(objectName(object, state))} go out.`, state) : `${burnName(object, state)} has gone out.`);
        }
    }
    const destroyed = threshold === 0 || object.otyp === POT_OIL
        ? await finishBurnedObject(object, state) : false;
    if (!destroyed && threshold > 0) beginObjectBurn(object, state, currentTurn);
    if (visible && location && threshold === 0
        && (object.otyp === POT_OIL || object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE))
        await newsym(location.x, location.y);
    return { object, threshold, overdue: false, destroyed };
}

function burnOwner(object: GameObject, state: GameState) {
    if (object.where === 'inventory') {
        const owner = carriedObjectOwner(object, state);
        return owner.charAt(0).toUpperCase() + owner.slice(1);
    }
    const carrier = object.ocarry || requireGameLevel(state).monsters.find(monster =>
        (monster.minvent || monster.inventory || []).includes(object));
    // C shk.c:mon_owns(): s_suffix(y_monnam(obj->ocarry)), so a pet's item
    // reads "Your saddled pony's".
    return carrier ? possessiveName(monsterName(carrier, { article: 'your', capitalized: true, state })) : 'The';
}

function burnName(object: GameObject, state: GameState) {
    const count = object.quan ?? object.quantity ?? 1;
    const name = objectName(object, state);
    return `${burnOwner(object, state)} ${count > 1 ? makePlural(name) : name}`;
}

async function finishBurnedObject(object: GameObject, state: GameState, { overdue = false } = {}) {
    extinguishTimedLight(object, state);
    if (object.otyp === CANDELABRUM_OF_INVOCATION) {
        object.spe = 0;
        object.owt = objectWeight(object);
        return false;
    }
    if (object.otyp !== POT_OIL && object.otyp !== TALLOW_CANDLE && object.otyp !== WAX_CANDLE)
        return false;
    const floor = object.where === 'floor' && { x: object.ox, y: object.oy };
    if (!overdue && object.where === 'inventory') await useUpInventoryStack(object, state);
    else {
        if (object.where === 'migrating') object.owornmask = 0;
        await deleteObject(object, state);
    }
    if (floor && (overdue || object.otyp !== POT_OIL))
        await maybeUnhideAt(floor.x, floor.y, state);
    return true;
}

function extinguishTimedLight(object: GameObject, state: GameState) {
    object.lamplit = false;
    delete object._litSeq;
    stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    state.vision_full_recalc = 1;
}



// C timeout.c:begin_burn() stores only the fuel remaining after the next warning
// breakpoint; the timer owns the intervening turns.  Keeping both fields is
// what lets save/restore and an overdue callback reconstruct source state.
export function beginObjectBurn(
    object: GameObject | null | undefined, state: GameState = game, currentTurn = state.moves ?? 0,
) {
    if (!object
        || (!LIGHT_TYPES.has(object.otyp) && !artifactEmitsLight(object))) {
        return false;
    }
    const alreadyLit = !!object.lamplit;
    if (artifactEmitsLight(object)) {
        object.lamplit = true;
        if (!alreadyLit) {
            registerObjectLightSource(object, state);
            state.vision_full_recalc = 1;
        }
        return true;
    }
    if (object.otyp === MAGIC_LAMP) {
        if ((object.spe ?? 0) <= 0) return false;
        object.lamplit = true;
        if (!alreadyLit) {
            registerObjectLightSource(object, state);
            state.vision_full_recalc = 1;
        }
        return true;
    }
    if (object.otyp === CANDELABRUM_OF_INVOCATION
        && (object.spe ?? 0) <= 0) return false;
    if ((object.age ?? 0) <= 0) return false;
    // begin_burn()'s switch: magic times are 150/100/50/25/0 for lamps and
    // 75/15/0 for candles; diluted oil burns three quarters as long.
    const age = object.age ?? 0;
    let turns: number;
    if (object.otyp === POT_OIL) {
        turns = object.odiluted ? Math.trunc((3 * age + 2) / 4) : age;
    } else if (CANDLE_TYPES.has(object.otyp)) {
        turns = age > 75 ? age - 75 : age > 15 ? age - 15 : age;
    } else {
        turns = age > 150 ? age - 150
            : age > 100 ? age - 100
                : age > 50 ? age - 50
                    : age > 25 ? age - 25 : age;
    }
    const timer = scheduleObjectTimer(
        object, OBJECT_TIMER_KIND.BURN_OBJECT, currentTurn + turns, state,
    );
    object.lamplit = !!timer;
    if (!timer) return false;
    object.age -= turns;
    if (!alreadyLit) {
        registerObjectLightSource(object, state);
        state.vision_full_recalc = 1;
    }
    return true;
}

// C timeout.c:end_burn(), timer_attached TRUE, reaches cleanup_burn() through stop_timer().
// The object's stored age excludes the turns owned by its active timer, so a
// manual switch-off must restore the still-unspent portion before darkening
// the source.  Natural expiry has already claimed its timer and deliberately
// uses extinguishTimedLight() below instead.
export function endObjectBurn(
    object: GameObject | null | undefined, state: GameState = game, currentTurn = state.moves ?? 0,
) {
    if (!object?.lamplit)
        return false;
    if (object.otyp === MAGIC_LAMP || artifactEmitsLight(object)
        || object.otyp === GOLD_DRAGON_SCALE_MAIL || object.otyp === GOLD_DRAGON_SCALES) {
        object.lamplit = false;
        delete object._litSeq;
        state.vision_full_recalc = 1;
        return true;
    }
    const timer = stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    if (!timer || !Number.isFinite(timer.deadline)) return false;
    return cleanupObjectBurn(object, timer.deadline, state, currentTurn);
}

// C timeout.c:cleanup_burn(), also called when Lua stops a burning object's timer.
// Also C light.c:delete_ls(): inlined as the lamplit/_litSeq clearing and
// vision_full_recalc that removes the source.
export function cleanupObjectBurn(
    object: GameObject, deadline: number, state: GameState = game,
    currentTurn = state.moves ?? 0,
): boolean {
    if (!object.lamplit) return false;
    object.age = (object.age ?? 0) + deadline - currentTurn;
    object.lamplit = false;
    delete object._litSeq;
    state.vision_full_recalc = 1;
    return true;
}

const DIRECTIONS: readonly (readonly [number, number, string])[] = [
    [-1, -1, 'y'], [0, -1, 'k'], [1, -1, 'u'], [-1, 0, 'h'],
    [1, 0, 'l'], [-1, 1, 'b'], [0, 1, 'j'], [1, 1, 'n'],
];

// C timeout.c:do_storms(), after ambient sounds and before hunger.
export async function doStorms(state = game): Promise<void> {
    requirePlayingGame(state);
    const level = state.level;
    if (!level.flags.stormy || rn2(8) !== 0) return;

    for (let strike = rnd(64); strike <= 64; strike *= 2) {
        let count = 0;
        let x: number, y: number;
        do {
            x = rnd(COLNO - 1);
            y = rn2(ROWNO);
        } while (++count < 100 && level.requireAt(x, y).typ !== CLOUD);
        if (count >= 100) continue;
        const dx = rn2(3) - 1, dy = rn2(3) - 1;
        if (dx === 0 && dy === 0) continue;
        const direction = DIRECTIONS.find(([xdir, ydir]) => xdir === dx && ydir === dy)?.[2];
        if (!direction) throw new Error(`Storm chose invalid direction ${dx},${dy}`);
        await castMonsterSpellRay(direction, x, y, [AT_MAGC, AD_ELEC, 8, 6], { state });
        if (state.program_state.gameover) return;
    }

    if (level.requireAt(state.u.ux, state.u.uy).typ !== CLOUD) {
        const message = formatHeardMessage('a rumbling noise.', state);
        if (message) await plineWithContinuation(message);
        return;
    }
    await plineWithContinuation('Kaboom!!!  Boom!!  Boom!!');
    setPropertyTimeout('deaf', propertyTimeout('deaf', state) + rn1(20, 30), state);
    state.context.botl = true;
    if (state.u.invulnerable) return;
    await stopHeroOccupation(state);
    nomul(-3, state);
    state._helplessReason = 'hiding from thunderstorm';
    delete state._helplessDoneMessage;
}

interface TimedProperty {
    readonly name: string;
    readonly property: PropertyName;
}

// timeout.c:propertynames[], C order. Hallucination resistance is listed
// here (unlike the #wizintrinsic table, which omits Grayswandir's property).
const PROPERTY_NAMES: readonly TimedProperty[] = [
    { name: 'invulnerable', property: 'invulnerable' },
    { name: 'petrifying', property: 'stoned' },
    { name: 'becoming slime', property: 'slimed' },
    { name: 'strangling', property: 'strangled' },
    { name: 'fatally sick', property: 'sick' },
    { name: 'stunned', property: 'stunned' },
    { name: 'confused', property: 'confusion' },
    { name: 'hallucinating', property: 'hallucination' },
    { name: 'blinded', property: 'blinded' },
    { name: 'deafness', property: 'deaf' },
    { name: 'vomiting', property: 'vomiting' },
    { name: 'slippery fingers', property: 'glib' },
    { name: 'wounded legs', property: 'woundedLegs' },
    { name: 'sleepy', property: 'sleepy' },
    { name: 'teleporting', property: 'teleportation' },
    { name: 'polymorphing', property: 'polymorph' },
    { name: 'levitating', property: 'levitation' },
    { name: 'very fast', property: 'fast' },
    { name: 'clairvoyant', property: 'clairvoyant' },
    { name: 'monster detection', property: 'detectMonsters' },
    { name: 'see invisible', property: 'seeInvisible' },
    { name: 'invisible', property: 'invisible' },
    { name: 'acid resistance', property: 'acidResistance' },
    { name: 'stoning resistance', property: 'stoneResistance' },
    { name: 'displaced', property: 'displaced' },
    { name: 'pass thru walls', property: 'passesWalls' },
    { name: 'magical breathing', property: 'magicalBreathing' },
    { name: 'water walking', property: 'waterWalking' },
    { name: 'fire resistance', property: 'fireResistance' },
    // Entries from here on only obtain timeouts through #wizintrinsic.
    { name: 'cold resistance', property: 'coldResistance' },
    { name: 'sleep resistance', property: 'sleepResistance' },
    { name: 'disintegration resistance', property: 'disintegrationResistance' },
    { name: 'shock resistance', property: 'shockResistance' },
    { name: 'poison resistance', property: 'poisonResistance' },
    { name: 'drain resistance', property: 'drainResistance' },
    { name: 'sickness resistance', property: 'sicknessResistance' },
    { name: 'magic resistance', property: 'antimagic' },
    { name: 'hallucination resistance', property: 'hallucinationResistance' },
    { name: 'light-induced blindness resistance', property: 'blindResistance' },
    { name: 'fumbling', property: 'fumbling' },
    { name: 'voracious hunger', property: 'hunger' },
    { name: 'telepathic', property: 'telepathy' },
    { name: 'warning', property: 'warning' },
    { name: 'warn: monster type or class', property: 'warnOfMonster' },
    { name: 'warn: undead', property: 'warnUndead' },
    { name: 'searching', property: 'searching' },
    { name: 'infravision', property: 'infravision' },
    { name: 'adorned (+/- Cha)', property: 'adorned' },
    { name: 'stealthy', property: 'stealth' },
    { name: 'monster aggravation', property: 'aggravateMonster' },
    { name: 'conflict', property: 'conflict' },
    { name: 'jumping', property: 'jumping' },
    { name: 'teleport control', property: 'teleportControl' },
    { name: 'flying', property: 'flying' },
    { name: 'swimming', property: 'swimming' },
    { name: 'slow digestion', property: 'slowDigestion' },
    { name: 'half spell damage', property: 'halfSpellDamage' },
    { name: 'half physical damage', property: 'halfPhysicalDamage' },
    { name: 'HP regeneration', property: 'regeneration' },
    { name: 'energy regeneration', property: 'energyRegeneration' },
    { name: 'extra protection', property: 'protection' },
    { name: 'protection from shape changers', property: 'protectionFromShapeChangers' },
    { name: 'polymorph control', property: 'polymorphControl' },
    { name: 'unchanging', property: 'unchanging' },
    { name: 'reflecting', property: 'reflection' },
    { name: 'free action', property: 'freeAction' },
    { name: 'fixed abilities', property: 'sustainAbility' },
    { name: 'life will be saved', property: 'lifeSaving' },
];

const WIZINTRINSIC_ONLY_INDEX = PROPERTY_NAMES.findIndex(
    entry => entry.property === 'coldResistance');

const TIMER_FUNC_NAMES: Record<ObjectTimerKind | 'melt-ice-away', string> = {
    [OBJECT_TIMER_KIND.ROT_ORGANIC]: 'rot_organic',
    [OBJECT_TIMER_KIND.ROT_CORPSE]: 'rot_corpse',
    [OBJECT_TIMER_KIND.REVIVE_MON]: 'revive_mon',
    [OBJECT_TIMER_KIND.ZOMBIFY_MON]: 'zombify_mon',
    [OBJECT_TIMER_KIND.BURN_OBJECT]: 'burn_object',
    [OBJECT_TIMER_KIND.HATCH_EGG]: 'hatch_egg',
    [OBJECT_TIMER_KIND.FIG_TRANSFORM]: 'fig_transform',
    [OBJECT_TIMER_KIND.SHRINK_GLOB]: 'shrink_glob',
    'melt-ice-away': 'melt_ice_away',
};

// C timeout.c:print_queue()
// Also C timeout.c:kind_name(): object and level labels are inlined here
// C shows fmt_ptr() of the timer argument: the
// packed (x << 16 | y) spot coordinate for level timers and the object
// address for object timers. Object addresses belong to the native heap, so
// the port shows the object's stable id in the same 0x-prefixed shape.
function timerQueueLines(state: GameState): string[] {
    const timers = queuedTimers(state);
    if (!timers.length) return [' <empty>'];
    const rows = ['timeout  id   kind   call'];
    for (const entry of timers) {
        const funcName = TIMER_FUNC_NAMES[entry.timer.kind];
        if (!funcName) throw new Error(`No timer callback name for ${entry.timer.kind}`);
        const argument = 'object' in entry
            ? `0x${entry.object.o_id.toString(16)}`
            : `0x${((entry.position.x << 16) | entry.position.y).toString(16)}`;
        rows.push(` ${String(entry.timer.deadline).padStart(4)}   `
            + `${String(entry.timer.id).padStart(4)}  `
            + `${'object' in entry ? 'object' : 'level'}`.padEnd(6)
            + ` ${funcName}(${argument})`);
    }
    return rows;
}

// The #timeout listing's timed-property rows.
// C timeout.c:property_by_index(): the PROPERTY_NAMES iteration; its
// bounds guard is the typed table itself.
function timedPropertyLines(state: GameState): string[] {
    const timed = PROPERTY_NAMES
        .map((entry, index) => ({ ...entry, index, timeout: propertyTimeout(entry.property, state) }))
        .filter(entry => entry.timeout > 0);
    if (!timed.length) return ['No timed properties.'];
    const longest = Math.max(...timed.map(entry => entry.name.length));
    const lines = ['Timed properties:', ''];
    let markerPending = true;
    for (const entry of timed) {
        if (markerPending && entry.index >= WIZINTRINSIC_ONLY_INDEX) {
            lines.push(' -- settable via #wizintrinsic only --');
            markerPending = false;
        }
        lines.push(` ${entry.name.padEnd(longest)} ${String(entry.timeout).padStart(4)}`);
    }
    return lines;
}

// C timeout.c:wiz_timeout_queue() — the #timeout debug listing: current time,
// the timer queue, every timed intrinsic, and the hero/level counters that
// share this status surface.
export async function wizTimeoutQueue(): Promise<void> {
    const state = requireInitializedGame();
    const lines: string[] = [
        `Current time = ${state.moves ?? 0}.`,
        '',
        'Active timeout queue:',
        '',
        ...timerQueueLines(state),
        '',
        ...timedPropertyLines(state),
    ];
    const hero = state.u;
    if (hero.uswldtim) {
        lines.push('', `Swallow countdown is ${hero.uswldtim}.`);
    }
    if (hero.uinvault) {
        lines.push('', `Vault counter is ${hero.uinvault}.`);
    }
    lines.push(...visibleRegionLines(state));
    const stasisUntil = requireGameLevel(state).flags.stasis_until;
    if (stasisUntil !== undefined && stasisUntil >= (state.moves ?? 0)) {
        const turns = stasisUntil - (state.moves ?? 0);
        lines.push('', `Level is no-teleport for ${turns + 1} ${turns > 0 ? 'turns' : 'more turn'}.`);
    }
    // C builds the listing with putstr in an NHW_MENU window, which tty
    // paints over the live map at a corner offset and dismisses by
    // restoring it; the disclosure overlay owns that geometry.
    await showDisclosureOverlay(lines, { restoreUnderlay: true });
    state._pending_message = '';
    state._retained_message = '';
    state.context.move = 0;
}

// C timeout.c:run_timers().
export async function runDueTimers(): Promise<void> {
    while (!game.program_state?.gameover) {
        const timer = claimNextDueObjectTimer(game, game.moves);
        if (!timer) return;
        await runObjectTimer(timer, game.moves);
    }
}

// The caller has removed this timer from the queue. Its callback may add or
// cancel timers, so the next due timer must be selected after it finishes.
export async function runObjectTimer(claimed: DueObjectTimer, currentTurn: number) {
    if (claimed.object === null) {
        const wasMonsterMoving = game.context.mon_moving;
        game.context.mon_moving = true;
        try {
            const { x, y } = claimed.position;
            return await meltIce(x, y, { message: 'Some ice melts away.' });
        } finally {
            game.context.mon_moving = wasMonsterMoving;
        }
    }
    const kind = claimed.timer.kind;
    if (kind === OBJECT_TIMER_KIND.BURN_OBJECT)
        return runClaimedObjectBurnTimer(claimed, game, currentTurn);
    if (kind === OBJECT_TIMER_KIND.HATCH_EGG) {
        const event = await runClaimedEggHatchTimer(claimed, game, currentTurn);
        if (event?.message) await plineWithContinuation(event.message);
        if (event?.followupMessage) await plineWithContinuation(event.followupMessage);
        return finishEggHatchTimer(event, game, currentTurn);
    }
    if (kind === OBJECT_TIMER_KIND.SHRINK_GLOB) {
        const event = await runClaimedGlobTimer(claimed, game, currentTurn);
        if (event?.message) await plineWithContinuation(event.message);
        return finishGlobTimer(event, game, currentTurn);
    }
    if (kind === OBJECT_TIMER_KIND.FIG_TRANSFORM) {
        const event = await runClaimedFigurineTimer(claimed, game, currentTurn);
        for (const message of event?.waterMessages || []) await plineWithContinuation(message);
        if (event?.message) await plineWithContinuation(event.message);
        return await finishFigurineTimer(event, game);
    }
    if (kind === OBJECT_TIMER_KIND.REVIVE_MON || kind === OBJECT_TIMER_KIND.ZOMBIFY_MON) {
        const event = await runClaimedCorpseRevivalTimer(claimed, game, currentTurn);
        for (const message of event?.messages || []) await plineWithContinuation(message);
        if (event?.buried) await announceBuriedRevival(event);
        return await finishBuriedZombieTimer(event, game);
    }
    const event = await runClaimedObjectRotTimer(claimed, game);
    if (kind === OBJECT_TIMER_KIND.ROT_ORGANIC && event && 'where' in event && event.where === 'floor')
        await newsym(event.x, event.y);
    return event;
}

async function announceBuriedRevival(event: CorpseRevivalTimerEvent): Promise<void> {
    if (event.kind !== 'revived' || !event.monster) return;
    const { monster, trap } = event;
    if (cansee(monster.mx, monster.my)) {
        let subject = 'Something';
        if (canSpotMonster(monster))
            subject = monsterName(monster, { article: 'a', capitalized: true });
        if (trap) trap.tseen = true;
        await plineWithContinuation(`${subject} claws itself out of the ground!`);
        await newsym(monster.mx, monster.my);
    } else {
        const dx = monster.mx - game.u.ux;
        const dy = monster.my - game.u.uy;
        // C do.c:revive_corpse(): `else if (mdistu(mtmp) < 5*5)` calls
        // `You_hear("scratching noises.");` with no caller-level Deaf guard.
        if (dx * dx + dy * dy < 25)
            await publishHeardMessage('scratching noises.', plineWithContinuation);
    }
}
