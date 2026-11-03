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
import { formatFeltMessage, formatHeardMessage, formatSeenMessage } from './hero_speech.js';
import { clearHeroSliming, cureHeroSickness, cureHeroVomiting, heroIsSick, heroIsSliming, heroIsVomiting, makeBlinded, makeConfused, makeHallucinated, makeStunned, makeDeaf, setSlipperyHands, } from './potion.js';
import { clearHeroStrangulation } from './do_wear.js';
import { corpseName, definiteName, killerObjectName, makePlural, objectDescription, objectName, observeObjectForNaming, withIndefiniteArticle, } from './objnam.js';
import { advanceSpellProtection } from './spell.js';
import { advanceDisplacementTimeout } from './hero_displacement.js';
import { requireInitializedGame, game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import { applyHeroLocationEffects, endVoluntaryMultiTurn, nomul, invWeight } from './hack.js';
import { wakeMonstersNearWithMessages, restartMonsterShapechanging, maybeUnhideAt } from './mon.js';
import { deferredDecor } from './dungeon_feature.js';
import { d, rnd, rn1, rn2 } from './rng.js';
import { hasCarriedProperty, hasIntrinsicProperty, hasInvokedProperty, hasWornProperty, propertyIsActive, propertyIsBlocked, propertyTimeout, refreshProperty, removeIntrinsicProperty, setPropertyTimeout, } from './properties.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating, heroIsUnaware } from './senses.js';
import { healHeroLegs } from './hero_legs.js';
import { isPoolAt, isIceAt, isPoolOrLavaAt } from './dbridge.js';
import { ACCESSIBLE, A_CON, A_DEX, A_STR, CLOUD, COLNO, DIED, DISMOUNT_FELL, FAINTING, FULL_MOON, G_GENOD, GENOCIDED, I_SPECIAL, Is_waterlevel, KILLED_BY, KILLED_BY_AN, LEVEL_TIMER_KIND, M_AP_MONSTER, MV_KNOWS_EGG, NO_KILLER_PREFIX, OBJECT_TIMER_KIND, PLNMSG_OK_DONT_DIE, PLNMSG_ONE_ITEM_HERE, POISONING, ROWNO, SICK_ALL, SICK_NONVOMITABLE, STONING, TIMEOUT, TURNED_SLIME, W_SADDLE, } from './const.js';
import { AMULET_OF_STRANGULATION, BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, CORPSE, FEDORA, GOLD_DRAGON_SCALE_MAIL, GOLD_DRAGON_SCALES, LUCKSTONE, MAGIC_LAMP, OIL_LAMP, POT_OIL, ROCK, TALLOW_CANDLE, WAX_CANDLE, } from './object_data.js';
import { confersLuck } from './hero_inventory.js';
import { AD_ELEC, AT_MAGC } from './monster_attack_types.js';
import { isWereMonster, revertHeroWereForm } from './were.js';
import { heroFootName, heroHandName, heroNeckName } from './body_parts.js';
import { clearHeroPetrification, heroIsPetrifying, heroResistsStoning, touchPetrifies } from './stoning.js';
import { monsterName } from './do_name.js';
import { dismountHero } from './steed.js';
import { adjustAttribute, currentAttribute, exerciseAttribute } from './attrib.js';
import { extinguishHeroFormLight, heroHasNoLimbs, heroIsBreathless, heroIsGreenSlime, heroIsPolymorphed, heroIsUnchanging, heroSpecies, polymonHero, returnHeroToHumanForm, } from './polyself.js';
import { hurtleHero } from './hero_hurtle.js';
import { finishTeleportArrival } from './location_effects.js';
import { gotoLevel } from './level_change.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { refreshHeroSeeing } from './hero_seeing.js';
import { syncHeroInvisibility } from './hero_invisibility.js';
import { stopHeroOccupation } from './occupation.js';
import { finishHeroDeath } from './end.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_GROWTH_TARGET, MONSTER_LEVEL, MONSTER_NAME, PM_GREEN_SLIME, requireMonsterData, } from './monster_data.js';
import { canSpotMonster, displayColorName, newsym, randomDisplayMonsterName, see_monsters } from './display.js';
import { pline, plineWithContinuation } from './pline.js';
import { CANDLE_TYPES, LIGHT_TYPES, TIMED_LIGHT_TYPES, registerObjectLightSource } from './light.js';
import { eatingDangerousCorpse, openingTinMaySaveHero, spendHeroNutrition, vomitHero } from './eat.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { captureLevitationState, floatHeroDown, heroIsUnconscious, resolveImmediatePetrification, } from './trap.js';
import { runClaimedEggHatchTimer, finishEggHatchTimer } from './egg.js';
import { runClaimedFigurineTimer, finishFigurineTimer } from './figurine.js';
import { runClaimedGlobTimer, finishGlobTimer } from './glob.js';
import { meltIce } from './zap.js';
import { runClaimedObjectRotTimer, finishBuriedZombieTimer } from './mklev.js';
import { objectWeight } from './mkobj.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { carriedObjectOwner, deleteObject } from './shk.js';
import { possessiveName } from './hacklib.js';
import { getObjectLocation } from './zap.js';
import { artifactEmitsLight } from './artifacts.js';
import { cansee } from './vision.js';
import { heroIsSurroundedByRock } from './pray.js';
import { heroIsInDangerousRegion, visibleRegionLines } from './regions.js';
import { showDisclosureOverlay } from './windows.js';
import { surfaceName } from './terrain_name.js';
import { heroCannotVomit, nameToMonster } from './mondata.js';
import { reportHeroEncumbrance } from './encumbrance.js';
function petrificationMessage(turns, state) {
    if (turns === 5)
        return 'You are slowing down.';
    if (turns === 4) {
        return heroHasNoLimbs(state)
            ? 'Your extremities are stiffening.'
            : 'Your limbs are stiffening.';
    }
    if (turns === 3) {
        return heroHasNoLimbs(state)
            ? 'Your extremities have turned to stone.'
            : 'Your limbs have turned to stone.';
    }
    if (turns === 2)
        return 'You have turned to stone.';
    return turns === 1 ? 'You are a statue.' : null;
}
// C timeout.c:stoned_dialogue().
export async function petrificationDialogue({ state = game, publish = plineWithContinuation, } = {}) {
    const hero = state.u;
    const turns = hero.stonedTurns ?? 0;
    if (turns <= 0)
        return;
    const message = petrificationMessage(turns, state);
    if (message)
        await publish(message, { urgent: true });
    if (turns === 5) {
        removeHeroSpeed(state);
        if (state.multi > 0)
            endVoluntaryMultiTurn(state);
    }
    else if (turns === 4) {
        if (!openingTinMaySaveHero('stoned', state))
            await stopHeroOccupation(state, publish);
        if (state.multi > 0)
            endVoluntaryMultiTurn(state);
    }
    else if (turns === 3) {
        await stopHeroOccupation(state, publish);
        nomul(-3, state);
        state._helplessReason = 'getting stoned';
        state._helplessDoneMessage = 'You can move again.';
        if (!hero.usteed)
            await healHeroLegs(state, { cause: 'petrification', publish });
    }
    else if (turns === 2) {
        if (hero.deafTurns !== undefined && hero.deafTurns > 0 && hero.deafTurns < 5)
            hero.deafTurns = 5;
        cureHeroVomiting(state);
        clearHeroSliming(state);
    }
    await exerciseAttribute(A_DEX, false, state);
}
function vomitingMessage(state, nextTurns) {
    if (nextTurns === 14)
        return 'You are feeling mildly nauseated.';
    if (nextTurns === 11) {
        return propertyIsActive('confusion', state)
            ? 'You feel slightly more confused.' : 'You feel slightly confused.';
    }
    if (nextTurns === 8) {
        return propertyIsActive('stunned', state)
            ? "You can't think straight."
            : "You can't seem to think straight.";
    }
    if (nextTurns === 5)
        return 'You feel incredibly sick.';
    if (nextTurns === 2) {
        if (heroCannotVomit(state))
            return 'You gag uncontrollably.';
        return heroIsHallucinating(state)
            ? 'You are about to hurl!' : 'You are about to vomit.';
    }
    return null;
}
// C timeout.c:vomiting_dialogue().
export async function vomitingDialogue({ state = game, publish = pline, rollDice = d, } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    if (!heroIsVomiting(state))
        return { active: false, vomited: false };
    // Untimed nausea has no countdown stage; only timeout 1 triggers vomiting.
    const nextTurns = (hero.vomitingTurns ?? 0) - 1;
    if (nextTurns === 6) {
        await makeStunned((hero.stunnedTurns ?? 0) + rollDice(2, 4), { state, talk: false });
        // stop_occupation finishes an already swallowed last bite before
        // abandoning the meal, including that food's digestion effects.
        if (!openingTinMaySaveHero('vomiting', state))
            await stopHeroOccupation(state, publish);
        if (state.program_state.gameover)
            return { active: false, vomited: false, turns: nextTurns, died: true };
    }
    if (nextTurns === 6 || nextTurns === 9) {
        await makeConfused((hero.confusionTurns ?? 0) + rollDice(2, 4), { state, talk: false });
        if (state.multi > 0)
            endVoluntaryMultiTurn(state);
    }
    const message = vomitingMessage(state, nextTurns);
    if (message)
        await publish(message);
    let vomited = false;
    if (nextTurns === 0) {
        await stopHeroOccupation(state, publish);
        if (state.program_state.gameover)
            return { active: false, vomited: false, turns: nextTurns, died: true };
        if (!heroCannotVomit(state)) {
            await spendHeroNutrition(20, { state });
            if (state.program_state.gameover)
                return { active: false, vomited: false, turns: nextTurns, died: true };
            if (hero.uhs < FAINTING) {
                await publish(heroIsHallucinating(state)
                    ? 'You hurl chunks!' : 'You vomit!');
            }
        }
        await vomitHero({ state, publish });
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
export async function strangulationDialogue({ state = game, publish = plineWithContinuation, } = {}) {
    const hero = state.u;
    const turns = hero.strangledTurns || 0;
    if (turns <= 0)
        return;
    if (turns <= 5) {
        const index = 5 - turns;
        const constriction = CONSTRICTION_MESSAGES[index];
        const choking = CHOKING_MESSAGES[index];
        if (constriction === undefined || choking === undefined)
            throw new RangeError(`Invalid strangulation countdown: ${turns}`);
        if (heroIsBreathless(state) || rn2(50) === 0) {
            await publish(constriction.replace('%s', heroNeckName(state)), { urgent: true });
        }
        else {
            let message = choking;
            if (message.includes('%s'))
                message = message.replace('%s', displayColorName('blue', state));
            await publish(message, { urgent: true });
            await stopHeroOccupation(state, publish);
        }
    }
    await exerciseAttribute(A_STR, false, state);
}
function sicknessMessage(hero) {
    const turns = hero.sickTurns ?? 0;
    if (turns % 2 === 0)
        return null;
    const stage = Math.trunc(turns / 2);
    const noun = ((hero.sickType ?? 0) & SICK_NONVOMITABLE)
        ? 'illness' : 'sickness';
    if (stage === 3)
        return `Your ${noun} feels worse.`;
    if (stage === 2)
        return `Your ${noun} is severe.`;
    return stage === 1 ? "You are at Death's door." : null;
}
// C timeout.c:sickness_dialogue().
export async function sicknessDialogue({ state = game, publish = plineWithContinuation, } = {}) {
    if (!heroIsSick(state))
        return;
    let message = sicknessMessage(state.u);
    if (message === "You are at Death's door." && heroIsHallucinating(state)) {
        // C mhe() uses the core RNG for hallucinated pronouns.
        const invitation = ['He is', 'She is', 'It is', 'They are'][rn2(4)];
        if (!invitation)
            throw new Error('Sickness dialogue chose no pronoun');
        message += `  ${invitation} inviting you in.`;
    }
    if (message)
        await publish(message, { urgent: true });
    await exerciseAttribute(A_CON, false, state);
}
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
    const poolOrLava = isPoolOrLavaAt(hero.ux, hero.uy, state);
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
function slimeMessage(turns, state, randomMonsterName) {
    if (turns === 9) {
        return heroIsBlind(state)
            ? null : `You are turning a little ${displayColorName('green', state)}.`;
    }
    if (turns === 7) {
        return heroHasNoLimbs(state)
            ? 'Your extremities are getting oozy.'
            : 'Your limbs are getting oozy.';
    }
    if (turns === 5)
        return 'Your skin begins to peel away.';
    if (turns !== 3 && turns !== 1)
        return null;
    const hallucinating = heroIsHallucinating(state);
    const form = hallucinating ? randomMonsterName() : 'green slime';
    return turns === 3
        ? `You are turning into ${withIndefiniteArticle(form)}.`
        : `You have become ${withIndefiniteArticle(form)}.`;
}
function removeHeroSpeed(state) {
    setPropertyTimeout('fast', 0, state);
    removeIntrinsicProperty('fast', state);
}
function cancelHeroPetrification(state) {
    const hero = state.u;
    if (hero.stoned || (hero.stonedTurns ?? 0) > 0)
        state.context.botl = true;
    hero.stonedTurns = 0;
    hero.stoned = false;
    delete hero.stoneKiller;
    delete hero.stoneKillerFormat;
}
export async function slimeDialogue({ state = game, publish = plineWithContinuation, repaint = () => { }, randomMonsterName = randomDisplayMonsterName, } = {}) {
    const hero = state.u;
    const turns = hero.slimedTurns ?? 0;
    if (turns <= 0)
        return;
    if (turns === 1) {
        hero.m_ap_type = M_AP_MONSTER;
        hero.mappearance = PM_GREEN_SLIME;
        await repaint(hero.ux, hero.uy);
    }
    const message = slimeMessage(turns, state, randomMonsterName);
    if (message)
        await publish(message, { urgent: true });
    const stage = Math.trunc(turns / 2);
    if (stage === 3) {
        removeHeroSpeed(state);
        if (!openingTinMaySaveHero('slimed', state))
            await stopHeroOccupation(state, publish);
        if (state.multi > 0)
            endVoluntaryMultiTurn(state);
    }
    else if (stage === 2
        && hero.deafTurns !== undefined && hero.deafTurns > 0
        && hero.deafTurns < 5) {
        hero.deafTurns = 5;
    }
    else if (stage === 1) {
        cancelHeroPetrification(state);
    }
    await exerciseAttribute(A_DEX, false, state);
}
// C timeout.c:burn_away_slime(), through make_slimed(0, message).
export async function burnAwayHeroSlime({ state = game, publish = plineWithContinuation, } = {}) {
    if (!heroIsSliming(state))
        return false;
    state.context.botl = true;
    state.u.slimedTurns = 0;
    state.u.slimed = false;
    await publish('The slime that covers you is burned away!');
    clearHeroSliming(state);
    return true;
}
// C timeout.c:nh_timeout() runs the Slimed countdown out with a bare
// decrement, so the status line keeps "Slime" until something else
// requests a redraw.
export function dropHeroSliming(hero) {
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
export async function advanceHeroSliming({ state = game, publish = plineWithContinuation, transform, die, } = {}) {
    const hero = state.u;
    const turns = hero.slimedTurns ?? 0;
    if (turns <= 0)
        return { active: false, died: false };
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
        throw new TypeError('the final slime turn requires transform and death functions');
    }
    const vitals = state.mvitals?.[PM_GREEN_SLIME];
    if (!vitals)
        throw new Error('Slime transformation requires initialized monster vitals.');
    const originalFlags = vitals.mvflags;
    // Slime infection completes even after genocide. Life saving then
    // encounters the genocided body, as in C slimed_to_death().
    vitals.mvflags &= ~G_GENOD;
    // polymon() does not do polyself()'s light bookkeeping.
    extinguishHeroFormLight(state);
    try {
        await transform(PM_GREEN_SLIME);
    }
    finally {
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
    if (died)
        return { active: false, died: true, transformed: true };
    clearHeroSliming(state);
    const genocided = !!((state.mvitals?.[PM_GREEN_SLIME]?.mvflags ?? 0) & G_GENOD);
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
export async function wallPassageDialogue(state = game) {
    const turns = propertyTimeout('passesWalls', state);
    if (hasIntrinsicProperty('passesWalls', null, state)
        || hasWornProperty('passesWalls', state)
        || hasCarriedProperty('passesWalls', null, state)
        || hasInvokedProperty('passesWalls', state))
        return;
    if (turns === 5)
        await plineWithContinuation('You start to feel bloated.');
    else if (turns === 3)
        await plineWithContinuation('You are feeling rather flabby.');
}
// C timeout.c:region_dialogue().
export async function breathingDialogue(state = game) {
    const turns = propertyTimeout('magicalBreathing', state);
    if (turns !== 5 && turns !== 3)
        return;
    // C temporarily masks only the timed source to ask whether the warning
    // is still relevant to this body and the region it currently occupies.
    setPropertyTimeout('magicalBreathing', 0, state);
    let danger;
    try {
        danger = !heroIsBreathless(state) && heroIsInDangerousRegion(state);
    }
    finally {
        setPropertyTimeout('magicalBreathing', turns, state);
    }
    if (danger)
        await plineWithContinuation(turns === 5
            ? 'You seem to have some trouble breathing.' : 'The air here seems foul.');
}
// C timeout.c:done_timeout() ORs I_SPECIAL into a fatal intrinsic after its
// timer has counted down; the port keeps that condition's flag set at zero.
export function expiredFatally(active, turns) {
    return !!active && !turns;
}
// C timeout.c:nh_timeout(): luck creeps toward its baseline before the
// prayer invulnerability guard.
export function recoverTimedLuck(state = game) {
    let baseline = state.flags.moonphase === FULL_MOON ? 1 : 0;
    if (state.flags.friday13)
        baseline--;
    if (state.quest_status?.killed_leader)
        baseline -= 4;
    if (state.urole?.key === 'archeologist'
        && (state.uarmh ?? state.u.uarmh)?.otyp === FEDORA)
        baseline++;
    const hero = state.u;
    const luck = hero.uluck ?? 0;
    const interval = hero.uhave?.amulet || hero.ugangr ? 300 : 600;
    if (luck === baseline || state.moves % interval !== 0)
        return;
    // attrib.c:stone_luck(): count quantities, including luck artifacts.
    // Uncursed items count for possession but do not favor either timeout.
    let allStones = 0;
    let blessedAndCursed = 0;
    let luckstone = false;
    for (const object of state.inventory) {
        if (!confersLuck(object, state))
            continue;
        const quantity = object.quan;
        allStones += object.cursed ? -quantity : quantity;
        if (object.cursed)
            blessedAndCursed -= quantity;
        else if (object.blessed)
            blessedAndCursed += quantity;
        if (object.otyp === LUCKSTONE)
            luckstone = true;
    }
    const noStone = !luckstone && allStones === 0;
    if (luck > baseline && (noStone || blessedAndCursed < 0))
        hero.uluck = luck - 1;
    else if (luck < baseline && (noStone || blessedAndCursed > 0))
        hero.uluck = luck + 1;
}
// C timeout.c:nh_timeout(): the polymorph, creamed, and galloping counters
// between the dialogues and the property loop.
export async function advanceBodyTimeouts(state = game) {
    const hero = state.u;
    if (hero.mtimedone !== undefined && hero.mtimedone > 0 && --hero.mtimedone === 0) {
        if (hero.umonnum === undefined)
            throw new Error('Timed polymorph has no species');
        if (heroIsUnchanging(state)) {
            hero.mtimedone = rnd(100 * requireMonsterData(MONSTER_LEVEL, hero.umonnum) + 1);
        }
        else if (isWereMonster({ mnum: hero.umonnum })) {
            await revertHeroWereForm({ state });
        }
        else {
            await returnHeroToHumanForm(state);
        }
    }
    if ((hero.ucreamed ?? 0) > 0)
        hero.ucreamed = (hero.ucreamed ?? 0) - 1;
}
// C timeout.c:nh_timeout(): the steed's gallop counter.
export async function advanceGallopingTimeout(state = game) {
    const hero = state.u;
    if ((hero.ugallop ?? 0) <= 0)
        return;
    hero.ugallop = (hero.ugallop ?? 0) - 1;
    if (hero.ugallop === 0 && hero.usteed)
        await plineWithContinuation(`${monsterName(hero.usteed, { state, capitalized: true })} stops galloping.`);
}
// C timeout.c decrements every intrinsic timeout in prop.h order. These
// properties have no dedicated recovery action; their source projection still
// needs refreshing when the timed source ends.
function advanceSimplePropertyTimeouts(properties, state) {
    for (const property of properties)
        advancePropertyTimeout(property, state);
}
function advancePropertyTimeout(property, state) {
    const remaining = propertyTimeout(property, state);
    if (remaining <= 0)
        return false;
    setPropertyTimeout(property, remaining - 1, state);
    return remaining === 1;
}
// C timeout.c:784-793 case SLEEPY.
async function advanceSleepinessTimeout(state) {
    if (!advancePropertyTimeout('sleepy', state))
        return;
    if (heroIsUnconscious(state) || state.u.sleepResistance) {
        setPropertyTimeout('sleepy', rnd(100), state);
    }
    else if (propertyIsActive('sleepy', state)) {
        await plineWithContinuation('You fall asleep.');
        const duration = rnd(20);
        await putHeroToSleep(duration, { state });
        setPropertyTimeout('sleepy', duration + rnd(100), state);
    }
}
// C timeout.c:902-931 case FUMBLING: the noise and follow-up counts after
// slip_or_trip() has published its own message.
async function finishFumblingTimeout(fumbled, publish) {
    const game = requireInitializedGame();
    if (fumbled) {
        nomul(-2);
        game._helplessDoneMessage = '';
        game._helplessReason = 'fumbling';
        if (invWeight(game) > -500) {
            if (!heroIsDeaf(game))
                await publish('You make a lot of noise!');
            await wakeMonstersNearWithMessages(game.u.ux, game.u.uy, game.u.ulevel * 20, game, publish);
        }
    }
    game.u.fumblingFromIce = false;
    if (game.u?.fumblingFromArmor || game.u.fumblingIntrinsic || propertyIsActive('fumbling', game))
        game.u.fumblingTurns = (game.u.fumblingTurns ?? 0) + rnd(20);
    game.u.fumbling = !!(game.u?.fumblingFromArmor
        || game.u.fumblingIntrinsic
        || propertyIsActive('fumbling', game)
        || (game.u.fumblingTurns !== undefined && game.u.fumblingTurns > 0));
    // C timeout.c: a decor message deferred past the trip catches up here.
    if (game.iflags.deferDecor)
        await deferredDecor(false);
}
export async function advanceHeroVomiting({ state = game, publish = plineWithContinuation, } = {}) {
    const hero = state.u;
    const turns = hero.vomitingTurns ?? 0;
    if (turns <= 0)
        return { active: heroIsVomiting(state), turns: 0 };
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
export async function advanceHeroSickness({ state = game, publish = pline, die = finishHeroDeath, random = rn2, } = {}) {
    const hero = state.u;
    if (!heroIsSick(state))
        return { active: false, died: false };
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
        if (change.changed && state._moveloopStarted)
            await reportHeroEncumbrance(state);
        return { active: false, died: false, recovered: true, turns: 0 };
    }
    await publish('You die from your illness.', { urgent: true });
    let killer = hero.sickCause || 'illness';
    const species = nameToMonster(killer);
    const personal = species >= 0 && !!((MONSTER_FLAGS2[species] ?? 0) & 0x00080000);
    const unique = species >= 0 && !!((MONSTER_GENO[species] ?? 0) & 0x1000);
    // nh_timeout() resolves personal and unique monster names when the
    // delayed illness becomes fatal, before formatkiller() adds an article.
    if (unique && !personal)
        killer = definiteName(killer);
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
export async function advanceHeroPetrification({ state = game, die = finishHeroDeath, } = {}) {
    const hero = state.u;
    const turns = hero.stonedTurns ?? 0;
    if (turns <= 0)
        return { active: false, died: false };
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
function petrificationDeathCause(state) {
    const name = state.u.stoneKiller;
    if (!name)
        return 'killed by petrification';
    const format = state.u.stoneKillerFormat;
    if (format === undefined)
        throw new Error('Petrification requires its delayed killer format.');
    if (format === NO_KILLER_PREFIX)
        return name;
    return `petrified by ${format === KILLED_BY_AN ? withIndefiniteArticle(name) : name}`;
}
export async function advanceHeroStrangulation({ state = game, publish = plineWithContinuation, die = finishHeroDeath, } = {}) {
    const hero = state.u;
    const turns = hero.strangledTurns ?? 0;
    if (turns <= 0)
        return { died: false };
    hero.strangledTurns = turns - 1;
    if (hero.strangledTurns > 0)
        return { died: false };
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
export async function finishWallPassageTimeout(state = game) {
    if (propertyIsActive('passesWalls', state))
        return;
    await plineWithContinuation(heroIsSurroundedByRock(state)
        ? formatFeltMessage('hemmed in again.', state)
        : `You're back to your ${heroIsPolymorphed(state) ? 'unusual' : 'normal'} self again.`);
}
export async function finishBreathingTimeout(state = game) {
    if (!heroIsBreathless(state) && heroIsInDangerousRegion(state))
        await plineWithContinuation(state.u.poisonResistance
            ? 'You cough.' : 'You cough and spit blood!');
}
// C timeout.c:588-948 nh_timeout().
// C timeout.c:sleep_dialogue(): the "You yawn." at four turns of drowsiness.
export async function nhTimeout() {
    const game = requireInitializedGame();
    // C timeout.c:595-620: luck drifts toward its calendar baseline every
    // 600 turns (300 while carrying the Amulet or angering a god).
    recoverTimedLuck(game);
    // C timeout.c:621-622: prayer's u.uinvulnerable returns before the
    // dialogues, the countdown, and run_timers().
    if (game.u.invulnerable)
        return;
    // C timeout.c:623-640: the fatal-condition dialogues.
    if (heroIsPetrifying(game)) {
        await petrificationDialogue({
            state: game,
            publish: plineWithContinuation,
        });
        if (game.program_state?.gameover)
            return;
    }
    if (heroIsSliming(game)) {
        await slimeDialogue({
            state: game,
            publish: plineWithContinuation,
            repaint: newsym,
            randomMonsterName: randomDisplayMonsterName,
        });
        if (game.program_state?.gameover)
            return;
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
        if (game.program_state?.gameover)
            return;
    }
    if (heroIsSick(game)) {
        await sicknessDialogue({
            state: game,
            publish: plineWithContinuation,
        });
        if (game.program_state?.gameover)
            return;
    }
    await levitationDialogue(game);
    await wallPassageDialogue(game);
    await breathingDialogue(game);
    if (propertyTimeout('sleepy', game) === 4)
        await plineWithContinuation('You yawn.');
    // C timeout.c:641-667: body counters between the dialogues and the
    // property loop.
    await advanceBodyTimeouts(game);
    if (game.program_state.gameover)
        return;
    await advanceSpellProtection(game);
    await advanceGallopingTimeout(game);
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
    await advanceCorpseResistanceTimeouts(game);
    if (game.program_state?.gameover)
        return;
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
            if (!propertyIsActive('stunned', game))
                await stopHeroOccupation(game);
        }
        else
            game.u.stunnedTurns--;
    }
    // C timeout.c:730-736 case CONFUSION.
    if (game.u.confusionTurns !== undefined && game.u.confusionTurns > 0) {
        if (game.u.confusionTurns === 1) {
            await makeConfused(0);
            await stopHeroOccupation(game);
        }
        else
            game.u.confusionTurns--;
    }
    // C timeout.c:743-758 case BLINDED: sample Blind after the decrement,
    // then restore one tick for make_blinded()'s recovery message.
    if (game.u.blindTurns !== undefined && game.u.blindTurns > 0) {
        game.u.blindTurns--;
        if (game.u.blindTurns === 0) {
            const wasBlind = heroIsBlind(game);
            game.u.blindTurns = 1;
            await makeBlinded(0);
            if (wasBlind && !heroIsBlind(game))
                await stopHeroOccupation(game);
        }
    }
    // C timeout.c:752-758 case DEAF.
    if (game.u.deafTurns !== undefined && game.u.deafTurns > 0) {
        if (game.u.deafTurns === 1) {
            await makeDeaf(0);
            if (!heroIsDeaf(game))
                await stopHeroOccupation(game);
        }
        else
            game.u.deafTurns--;
    }
    // C timeout.c:692-724 case SICK, 674-685 case STONED, 890-901 case
    // STRANGLED, 689-691 case VOMITING.
    await advanceHeroSickness({ publish: plineWithContinuation });
    if (game.program_state.gameover)
        return;
    await advanceHeroPetrification();
    if (game.program_state.gameover)
        return;
    await advanceHeroStrangulation();
    if (game.program_state.gameover)
        return;
    await advanceHeroVomiting();
    // C timeout.c:935-937 case GLIB.
    if (advancePropertyTimeout('glib', game))
        setSlipperyHands(0, game);
    // C timeout.c:686-688 case SLIMED: slimed_to_death().
    await advanceHeroSliming({ transform: polymonHero, die: finishHeroDeath });
    if (game.program_state.gameover)
        return;
    // C timeout.c:778-783 case HALLUC, 24 no case: HALLUC_RES.
    if (game.u.hallucinationTurns !== undefined && game.u.hallucinationTurns > 0) {
        if (game.u.hallucinationTurns === 1) {
            await makeHallucinated(0);
            if (!heroIsHallucinating(game))
                await stopHeroOccupation(game);
        }
        else
            game.u.hallucinationTurns--;
    }
    advancePropertyTimeout('hallucinationResistance', game);
    // C timeout.c:902-931 case FUMBLING: fumbling messages only fire when a
    // move took place.
    if (game.u.fumblingTurns !== undefined && game.u.fumblingTurns > 0) {
        game.u.fumblingTurns--;
        if (game.u.fumblingTurns === 0) {
            const levitating = !!(game.u?.levitating
                || game.u?.levitation || game.levitating);
            const flying = !!(game.u?.flying || game.flying);
            if (game.u?.umoved && !levitating && !flying) {
                await slipOrTrip(plineWithContinuation);
                if (game.program_state.gameover)
                    return;
                await finishFumblingTimeout(true, plineWithContinuation);
            }
            else {
                await finishFumblingTimeout(false, plineWithContinuation);
            }
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
    await advanceSleepinessTimeout(game);
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
        if (game.context.warntype)
            game.context.warntype.speciesidx = -1;
        if (species !== undefined && species >= 0) {
            const name = MONSTER_NAME[species];
            if (name)
                await plineWithContinuation(`You are no longer warned about ${makePlural(name)}.`);
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
    await advanceLevitationTimeout(game);
    if (game.program_state?.gameover)
        return;
    await advanceFlyingTimeout(game);
    if (game.program_state?.gameover)
        return;
    // C timeout.c:853-857 case WWALKING, 51 no case: SWIMMING,
    // 883-889 case MAGICAL_BREATHING, 874-882 case PASSES_WALLS,
    // 54 no case: SLOW_DIGESTION.
    if (advancePropertyTimeout('waterWalking', game)
        && !propertyIsActive('waterWalking', game))
        await plineWithContinuation('Your temporary ability to walk on liquid has ended.');
    advancePropertyTimeout('swimming', game);
    if (advancePropertyTimeout('magicalBreathing', game))
        await finishBreathingTimeout(game);
    if (advancePropertyTimeout('passesWalls', game))
        await finishWallPassageTimeout(game);
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
export async function putHeroToSleep(turns, { state = game, doneMessage = 'You wake up.', publish = plineWithContinuation, } = {}) {
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
export function learnEggType(mnum, state) {
    const adult = MONSTER_GROWTH_TARGET[mnum] ?? mnum;
    if (!Array.isArray(state.mvitals))
        state.mvitals = [];
    const vital = state.mvitals[adult]
        || (state.mvitals[adult] = { mvflags: 0, born: 0, died: 0 });
    vital.mvflags = (vital.mvflags ?? 0) | MV_KNOWS_EGG;
}
const OBJECT_TIMER_KINDS = new Set(Object.values(OBJECT_TIMER_KIND));
function timersFor(object) {
    if (!object)
        return [];
    if (!Array.isArray(object.objectTimers))
        object.objectTimers = [];
    object.timed = object.objectTimers.length;
    return object.objectTimers;
}
function levelTimersFor(state = game) {
    if (!state.level)
        return [];
    if (!Array.isArray(state.level.levelTimers))
        state.level.levelTimers = [];
    return state.level.levelTimers;
}
function allocateTimerId(state = game) {
    const prior = state._nextObjectTimerId ?? 0;
    const id = prior + 1;
    state._nextObjectTimerId = id;
    return id;
}
function nextTimerOrder(state) {
    state._timerSerial = (state._timerSerial ?? 0) + 1;
    return state._timerSerial;
}
export function scheduleObjectTimer(object, kind, deadline, state = game) {
    if (!object || !OBJECT_TIMER_KINDS.has(kind) || !Number.isFinite(deadline))
        return null;
    const timers = timersFor(object);
    if (timers.some(timer => timer.kind === kind))
        return null;
    const timer = { kind, deadline, id: allocateTimerId(state), order: nextTimerOrder(state) };
    timers.push(timer);
    object.timed = timers.length;
    return timer;
}
export function scheduleLevelTimer(x, y, kind, deadline, state = game) {
    if (!state.level || kind !== LEVEL_TIMER_KIND.MELT_ICE_AWAY
        || !Number.isInteger(x) || !Number.isInteger(y)
        || !Number.isFinite(deadline))
        return null;
    const timers = levelTimersFor(state);
    if (timers.some(timer => timer.x === x && timer.y === y && timer.kind === kind))
        return null;
    const timer = {
        kind, deadline, id: allocateTimerId(state), order: nextTimerOrder(state), x, y,
    };
    timers.push(timer);
    return timer;
}
// C timeout.c:spot_stop_timers().
// C timeout.c:remove_timer(): the splice that pulls the matching timers
// out of the level's list.
export function stopLevelTimer(x, y, kind, state = game) {
    const timers = levelTimersFor(state);
    const removed = [];
    for (let index = timers.length - 1; index >= 0; index--) {
        const timer = timers[index];
        if (!timer)
            throw new Error(`Missing level timer at index ${index}`);
        if (timer.x !== x || timer.y !== y || timer.kind !== kind)
            continue;
        removed.unshift(...timers.splice(index, 1));
    }
    return removed;
}
// C timeout.c:stop_timer(), the object variant; C timeout.c:remove_timer():
// the find-and-splice that pulls one timer out of its object's list.
export function stopObjectTimer(object, kind) {
    if (!object)
        return null;
    const timers = timersFor(object);
    const index = timers.findIndex(timer => timer.kind === kind);
    if (index < 0)
        return null;
    const [timer] = timers.splice(index, 1);
    if (!timer)
        throw new Error(`Missing object timer at index ${index}`);
    object.timed = timers.length;
    return timer;
}
export function stopAllObjectTimers(object) {
    if (!object)
        return [];
    const timers = timersFor(object).splice(0);
    object.timed = 0;
    return timers;
}
export function stopObjectTimers(object, state) {
    const stoppedTimers = stopAllObjectTimers(object);
    const burn = stoppedTimers.find(timer => timer.kind === OBJECT_TIMER_KIND.BURN_OBJECT);
    if (burn)
        cleanupObjectBurn(object, burn.deadline, state);
}
// The port's whole-object graph: every list that C shk.c:find_oid()
// searches by o_id, walked once so callers can inline their o_on() scan.
export function objectsInTimerGraph(state = game) {
    const objects = [];
    const seen = new Set();
    const visit = (object) => {
        if (!object || seen.has(object))
            return;
        seen.add(object);
        objects.push(object);
        for (const content of object.contents || [])
            visit(content);
    };
    for (const column of state.level?.objects || [])
        for (const pile of column || [])
            for (const object of pile || [])
                visit(object);
    for (const object of state.level?.buriedObjects || [])
        visit(object);
    for (const object of state.inventory || [])
        visit(object);
    for (const object of state._tutorialState?.inventory || [])
        visit(object);
    for (const reference of state._luaObjectRefs || [])
        visit(reference.deref());
    for (const object of state.migratingObjects || [])
        visit(object);
    const monsters = (state.level?.monsters ?? []).concat(state._migratingMonsters ?? []);
    for (const monster of monsters) {
        for (const object of monster.minvent || [])
            visit(object);
        for (const object of monster.inventory || [])
            visit(object);
    }
    return objects;
}
function allowedKind(kind, allowedKinds) {
    return !allowedKinds || allowedKinds.has(kind);
}
function precedes(left, right) {
    return !right || left.timer.deadline < right.timer.deadline
        || (left.timer.deadline === right.timer.deadline
            && left.timer.order > right.timer.order);
}
export function peekNextDueObjectTimer(state = game, currentTurn = state.moves ?? 0, allowedKinds = null) {
    let next = null;
    for (const object of objectsInTimerGraph(state)) {
        for (const timer of timersFor(object)) {
            if (timer.deadline > currentTurn
                || !allowedKind(timer.kind, allowedKinds))
                continue;
            // timeout.c:insert_timer() inserts a new timer before the first
            // existing timer with an equal deadline.  Equal-time callbacks
            // therefore execute in descending insertion order. Restoring
            // reinserts timers without changing their diagnostic IDs.
            const candidate = { object, timer };
            if (precedes(candidate, next))
                next = candidate;
        }
    }
    for (const timer of levelTimersFor(state)) {
        if (timer.deadline > currentTurn
            || !allowedKind(timer.kind, allowedKinds))
            continue;
        const candidate = {
            object: null,
            position: { x: timer.x, y: timer.y },
            timer,
        };
        if (precedes(candidate, next))
            next = candidate;
    }
    return next;
}
export function claimNextDueObjectTimer(state = game, currentTurn = state.moves ?? 0, allowedKinds = null) {
    const next = peekNextDueObjectTimer(state, currentTurn, allowedKinds);
    if (!next)
        return null;
    if (next.object) {
        const timers = timersFor(next.object);
        const index = timers.indexOf(next.timer);
        if (index >= 0)
            timers.splice(index, 1);
        next.object.timed = timers.length;
    }
    else {
        const timers = levelTimersFor(state);
        const index = timers.indexOf(next.timer);
        if (index >= 0)
            timers.splice(index, 1);
    }
    return next;
}
export function objectTimers(object) {
    return timersFor(object).map(timer => ({ ...timer }));
}
export function copyObjectTimers(source, destination, state = game) {
    // C obj_split_timers() walks the queue in expiry order, including its
    // newest-first order for ties, before assigning the copied timer IDs.
    const timers = objectTimers(source).sort((left, right) => left.deadline - right.deadline || right.order - left.order);
    for (const timer of timers) {
        scheduleObjectTimer(destination, timer.kind, timer.deadline, state);
    }
    return objectTimers(destination);
}
export function levelTimers(state = game) {
    return levelTimersFor(state).map(timer => ({ ...timer }));
}
// C timeout.c: the timer queue holds object and level timers in one
// deadline-ordered list; insert_timer() places a new entry before existing
// equal-deadline entries, so ties run most recently inserted first.
export function queuedTimers(state = game) {
    const queued = [];
    for (const object of objectsInTimerGraph(state))
        for (const timer of timersFor(object))
            queued.push({ object, timer: { ...timer } });
    for (const timer of levelTimersFor(state))
        queued.push({ position: { x: timer.x, y: timer.y }, timer: { ...timer } });
    return queued.sort((left, right) => left.timer.deadline - right.timer.deadline || right.timer.order - left.timer.order);
}
// C timeout.c:obj_is_local(). Contents follow their outermost owner;
// objects carried by migrating monsters belong to the global batch.
function objectTimerIsGlobal(object, state) {
    let outer = object;
    while (outer.where === 'contained' && outer.container)
        outer = outer.container;
    if (outer.where === 'inventory' || outer.where === 'migrating')
        return true;
    return outer.where === 'minvent' && !!outer.ocarry
        && !!state._migratingMonsters?.includes(outer.ocarry);
}
// C timeout.c:obj_is_local(): a light is global when its outermost owner is
// the hero or a migrating carrier, and level-local otherwise.
export function lightObjectIsGlobal(object) {
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
function restoreTimerBatch(timers, state) {
    const savedOrder = [...timers].sort((left, right) => left.deadline - right.deadline || right.order - left.order);
    for (const timer of savedOrder)
        timer.order = nextTimerOrder(state);
}
export function restoreLevelTimers(state = game) {
    const local = objectsInTimerGraph(state).filter(object => !objectTimerIsGlobal(object, state));
    restoreTimerBatch([
        ...local.flatMap(object => timersFor(object)), ...levelTimersFor(state),
    ], state);
}
export function restoreSavedTimers(state = game) {
    const global = objectsInTimerGraph(state).filter(object => objectTimerIsGlobal(object, state));
    restoreTimerBatch(global.flatMap(object => timersFor(object)), state);
    // dorecover() reloads the current level after the global state, placing
    // its timers ahead of equal-time global timers.
    restoreLevelTimers(state);
}
const timedResistances = ['acidResistance', 'stoneResistance'];
// C timeout.c:nh_timeout().
// C timeout.c:ACID_RES/STONE_RES. Called in property order, after shock
// resistance and before the later status timeouts.
export async function advanceCorpseResistanceTimeouts(state = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    for (const property of timedResistances) {
        const timeout = `${property}Turns`;
        const remaining = state.u[timeout] ?? 0;
        if (!(remaining > 0))
            continue;
        state.u[timeout] = remaining - 1;
        if (state.u[timeout] > 0)
            continue;
        refreshProperty(property, state);
        if (state.u[property])
            continue;
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
            if (state.program_state.gameover)
                return;
        }
    }
}
// C timeout.c:nh_timeout().
async function touchWieldedCorpseAfterResistanceExpires(state) {
    if (state.uarmg || state.u.uarmg)
        return;
    const weapons = [state.uwep || state.u.uwep];
    if (state.u.twoweap)
        weapons.push(state.uswapwep || state.u.uswapwep);
    for (const object of weapons) {
        if (object?.otyp !== CORPSE || object.corpsenm === undefined || !touchPetrifies(object.corpsenm)
            || state.u.stoneResistance)
            continue;
        await plineWithContinuation(`You are wielding ${corpseName(object, { includeArticle: true })} in your bare ${makePlural(heroHandName(state))}.`);
        const result = await resolveImmediatePetrification({
            state, killer: `resistance timing out while wielding ${killerObjectName(object, state)}`,
        });
        if (result.died)
            return;
        if (!state.u.stoneResistance)
            // C wielding_corpse() unwields via remove_worn_item(obj, FALSE).
            await removeWornHeroItem(object, state, { unchainBall: false });
    }
}
// C timeout.c:slip_or_trip().  Fumbling arrival message, ice slides, and
// the pet-loss dismount, all after the fumbling source's timeout fires.
export async function slipOrTrip(publish = plineWithContinuation) {
    const hero = game.u;
    const steed = hero.usteed;
    const pile = game.level?.objects[hero.ux]?.[hero.uy] ?? [];
    const top = !steed && !(isPoolAt(hero.ux, hero.uy) && !hero.uinwater) ? pile[0] : undefined;
    const hallucinating = heroIsHallucinating(game);
    if (top) {
        let what;
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
        }
        else if (!rn2(10 + currentAttribute(A_DEX, game))) {
            if (heroSpecies(game) !== MONSTER_NAME.indexOf('grid bug')) {
                const directions = [
                    [-1, 0], [0, -1], [1, 0], [0, 1], [-1, -1], [1, -1], [1, 1], [-1, 1],
                ];
                const direction = directions[rn2(directions.length)];
                if (!direction)
                    throw new Error('Ice slip chose no direction');
                [hero.dx, hero.dy] = direction;
            }
            const dx = hero.dx ?? 0, dy = hero.dy ?? 0;
            if (hero.ux + dx !== hero.ux0 || hero.uy + dy !== hero.uy0)
                await hurtleHero(dx, dy, 1, {
                    verbose: false, finishTeleport: finishTeleportArrival, gotoLevel,
                    finishMonsterDeath: (monster, death) => finishHeroMonsterKill(monster, monster.mx, monster.my, {
                        ...death, showKillMessage: false, recordConduct: false, publish,
                    }),
                });
        }
        return;
    }
    if (steed && saddle?.cursed)
        return;
    const feet = makePlural(heroFootName(game));
    const messages = steed ? [
        'You slide to one side of the saddle.', `Your ${feet} slip out of the stirrups.`,
        'You let go of the reins.', 'You bang into the saddle-horn.',
    ] : [
        'You stumble.', `You trip over your own ${hallucinating ? 'elbow' : feet}.`,
        `You slip ${hallucinating ? 'on a banana peel' : 'and nearly fall'}.`, 'You flounder.',
    ];
    const message = messages[rn2(4)];
    if (!message)
        throw new Error('Fumbling chose no message');
    await publish(message);
    if (steed)
        await dismountHero(DISMOUNT_FELL, { announce: publish });
}
// C timeout.c:see_lamp_flicker().
// C timeout.c:lantern_message().
async function announceLampBurn(object, threshold, visible, byTouch, state, owner) {
    const floor = object.where === 'floor';
    const lantern = object.otyp === BRASS_LANTERN;
    if (threshold === 0) {
        if (visible || byTouch)
            await plineWithContinuation(lantern
                ? floor ? formatSeenMessage('a lantern run out of power.', state) : `${owner} lantern has run out of power.`
                : floor ? formatSeenMessage(`${withIndefiniteArticle(objectName(object, state))} go out.`, state) : `${burnName(object, state)} has gone out.`);
        return;
    }
    if (!visible || ![150, 100, 50, 25].includes(threshold))
        return;
    if (lantern) {
        await plineWithContinuation(floor ? formatSeenMessage('a lantern getting dim.', state)
            : object.where === 'inventory' ? 'Your lantern is getting dim.'
                : `${burnOwner(object, state)} lantern is getting dim.`);
        if (object.where === 'inventory' && heroIsHallucinating(state))
            await plineWithContinuation('Batteries have not been invented yet.');
    }
    else if (threshold === 25)
        await plineWithContinuation(floor
            ? formatSeenMessage(`${withIndefiniteArticle(objectName(object, state))} about to go out.`, state)
            : `${burnName(object, state)} seems about to go out.`);
    else
        await plineWithContinuation(floor
            ? formatSeenMessage(`${withIndefiniteArticle(objectName(object, state))} flicker${threshold === 50 ? ' considerably' : ''}.`, state)
            : `${burnName(object, state)} flickers${threshold === 50 ? ' considerably' : ''}.`);
}
async function announceCandleBurn(object, threshold, visible, byTouch, state, ownership) {
    const menorah = object.otyp === CANDELABRUM_OF_INVOCATION;
    const many = menorah ? object.spe > 1 : (object.quan ?? object.quantity ?? 1) > 1;
    const floor = object.where === 'floor';
    const candle = `${menorah ? "candelabrum's " : ''}candle`;
    const owner = floor ? formatSeenMessage(`${menorah ? 'a ' : many ? 'some ' : 'a '}`, state) : `${ownership} `;
    if (threshold === 75 && visible) {
        await plineWithContinuation(`${owner}${candle}${many ? 's' : ''}${floor ? '' : many ? ' are' : ' is'} getting short.`);
    }
    else if (threshold === 15 && visible) {
        await plineWithContinuation(`${owner}${candle}${many ? "s'" : "'s"} flame${many ? 's' : ''} flicker${floor || many ? '' : 's'} low!`);
    }
    else if (threshold === 0 && (visible || byTouch)) {
        if (menorah)
            await plineWithContinuation(floor
                ? formatSeenMessage(`a candelabrum's flame${many ? 's' : ''} die.`, state)
                : `${ownership} candelabrum's flame${many ? 's die' : ' dies'}.`);
        else {
            const name = objectName(object, state);
            await plineWithContinuation(floor
                ? formatSeenMessage(`${many ? `some ${makePlural(name)}` : withIndefiniteArticle(name)} consumed!`, state)
                : `${burnName(object, state)} ${many ? 'are' : 'is'} consumed!`);
            if (heroIsHallucinating(state))
                await plineWithContinuation(many ? 'They shriek!' : 'It shrieks!');
            else if (!heroIsBlind(state))
                await plineWithContinuation(many ? 'Their flames die.' : 'Its flame dies.');
        }
    }
}
// C timeout.c:burn_object(). The claimed timer is already removed. Messages
// may pause before expiry removes equipment or bills; a late level timer
// catches up silently without replaying warnings from the absent hero.
export async function runClaimedObjectBurnTimer(claimed, state = game, currentTurn = state.moves ?? 0) {
    const object = claimed?.object;
    const timeout = claimed?.timer?.deadline;
    if (!object || !TIMED_LIGHT_TYPES.has(object.otyp) || !object.lamplit
        || typeof timeout !== 'number' || !Number.isFinite(timeout))
        return null;
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
        if (visible)
            await plineWithContinuation(object.where === 'floor'
                ? formatSeenMessage('a burning potion of oil go out.', state) : `${owner} potion of oil has burnt away.`);
    }
    else if (CANDLE_TYPES.has(object.otyp))
        await announceCandleBurn(object, threshold, visible, byTouch, state, owner);
    else
        await announceLampBurn(object, threshold, visible, byTouch, state, owner);
    const destroyed = threshold === 0 || object.otyp === POT_OIL
        ? await finishBurnedObject(object, state) : false;
    if (!destroyed && threshold > 0)
        beginObjectBurn(object, state, currentTurn);
    if (visible && location && threshold === 0
        && (object.otyp === POT_OIL || object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE))
        await newsym(location.x, location.y);
    return { object, threshold, overdue: false, destroyed };
}
function burnOwner(object, state) {
    if (object.where === 'inventory') {
        const owner = carriedObjectOwner(object, state);
        return owner.charAt(0).toUpperCase() + owner.slice(1);
    }
    const carrier = object.ocarry || requireGameLevel(state).monsters.find(monster => (monster.minvent || monster.inventory || []).includes(object));
    // C shk.c:mon_owns(): s_suffix(y_monnam(obj->ocarry)), so a pet's item
    // reads "Your saddled pony's".
    return carrier ? possessiveName(monsterName(carrier, { article: 'your', capitalized: true, state })) : 'The';
}
function burnName(object, state) {
    const count = object.quan ?? object.quantity ?? 1;
    const name = objectName(object, state);
    return `${burnOwner(object, state)} ${count > 1 ? makePlural(name) : name}`;
}
async function finishBurnedObject(object, state, { overdue = false } = {}) {
    extinguishTimedLight(object, state);
    if (object.otyp === CANDELABRUM_OF_INVOCATION) {
        object.spe = 0;
        object.owt = objectWeight(object);
        return false;
    }
    if (object.otyp !== POT_OIL && object.otyp !== TALLOW_CANDLE && object.otyp !== WAX_CANDLE)
        return false;
    const floor = object.where === 'floor' && { x: object.ox, y: object.oy };
    if (!overdue && object.where === 'inventory')
        await useUpInventoryStack(object, state);
    else {
        if (object.where === 'migrating')
            object.owornmask = 0;
        await deleteObject(object, state);
    }
    if (floor && (overdue || object.otyp !== POT_OIL))
        await maybeUnhideAt(floor.x, floor.y, state);
    return true;
}
function extinguishTimedLight(object, state) {
    object.lamplit = false;
    delete object._litSeq;
    stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    state.vision_full_recalc = 1;
}
function lampBurnTurns(age) {
    if (age > 150)
        return age - 150;
    if (age > 100)
        return age - 100;
    if (age > 50)
        return age - 50;
    if (age > 25)
        return age - 25;
    return age;
}
function candleBurnTurns(age) {
    if (age > 75)
        return age - 75;
    if (age > 15)
        return age - 15;
    return age;
}
function objectBurnTurns(object) {
    if (object.otyp === POT_OIL) {
        const age = object.age ?? 0;
        return object.odiluted ? Math.trunc((3 * age + 2) / 4) : age;
    }
    if (CANDLE_TYPES.has(object.otyp))
        return candleBurnTurns(object.age ?? 0);
    return lampBurnTurns(object.age ?? 0);
}
// C timeout.c:begin_burn() stores only the fuel remaining after the next warning
// breakpoint; the timer owns the intervening turns.  Keeping both fields is
// what lets save/restore and an overdue callback reconstruct source state.
export function beginObjectBurn(object, state = game, currentTurn = state.moves ?? 0) {
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
        if ((object.spe ?? 0) <= 0)
            return false;
        object.lamplit = true;
        if (!alreadyLit) {
            registerObjectLightSource(object, state);
            state.vision_full_recalc = 1;
        }
        return true;
    }
    if (object.otyp === CANDELABRUM_OF_INVOCATION
        && (object.spe ?? 0) <= 0)
        return false;
    if ((object.age ?? 0) <= 0)
        return false;
    const turns = objectBurnTurns(object);
    const timer = scheduleObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT, currentTurn + turns, state);
    object.lamplit = !!timer;
    if (!timer)
        return false;
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
export function endObjectBurn(object, state = game, currentTurn = state.moves ?? 0) {
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
    if (!timer || !Number.isFinite(timer.deadline))
        return false;
    return cleanupObjectBurn(object, timer.deadline, state, currentTurn);
}
// C timeout.c:cleanup_burn(), also called when Lua stops a burning object's timer.
export function cleanupObjectBurn(object, deadline, state = game, currentTurn = state.moves ?? 0) {
    if (!object.lamplit)
        return false;
    object.age = (object.age ?? 0) + deadline - currentTurn;
    object.lamplit = false;
    delete object._litSeq;
    state.vision_full_recalc = 1;
    return true;
}
const DIRECTIONS = [
    [-1, -1, 'y'], [0, -1, 'k'], [1, -1, 'u'], [-1, 0, 'h'],
    [1, 0, 'l'], [-1, 1, 'b'], [0, 1, 'j'], [1, 1, 'n'],
];
// C timeout.c:do_storms(), after ambient sounds and before hunger.
export async function doStorms(state = game) {
    requirePlayingGame(state);
    const level = state.level;
    if (!level.flags.stormy || rn2(8) !== 0)
        return;
    for (let strike = rnd(64); strike <= 64; strike *= 2) {
        let count = 0;
        let x, y;
        do {
            x = rnd(COLNO - 1);
            y = rn2(ROWNO);
        } while (++count < 100 && level.requireAt(x, y).typ !== CLOUD);
        if (count >= 100)
            continue;
        const dx = rn2(3) - 1, dy = rn2(3) - 1;
        if (dx === 0 && dy === 0)
            continue;
        const direction = DIRECTIONS.find(([xdir, ydir]) => xdir === dx && ydir === dy)?.[2];
        if (!direction)
            throw new Error(`Storm chose invalid direction ${dx},${dy}`);
        await castMonsterSpellRay(direction, x, y, [AT_MAGC, AD_ELEC, 8, 6], { state });
        if (state.program_state.gameover)
            return;
    }
    if (level.requireAt(state.u.ux, state.u.uy).typ !== CLOUD) {
        const message = formatHeardMessage('a rumbling noise.', state);
        if (message)
            await plineWithContinuation(message);
        return;
    }
    await plineWithContinuation('Kaboom!!!  Boom!!  Boom!!');
    setPropertyTimeout('deaf', propertyTimeout('deaf', state) + rn1(20, 30), state);
    state.context.botl = true;
    if (state.u.invulnerable)
        return;
    await stopHeroOccupation(state);
    nomul(-3, state);
    state._helplessReason = 'hiding from thunderstorm';
    delete state._helplessDoneMessage;
}
// timeout.c:propertynames[], C order. Hallucination resistance is listed
// here (unlike the #wizintrinsic table, which omits Grayswandir's property).
const PROPERTY_NAMES = [
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
const WIZINTRINSIC_ONLY_INDEX = PROPERTY_NAMES.findIndex(entry => entry.property === 'coldResistance');
const TIMER_FUNC_NAMES = {
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
// timeout.c:print_queue(). C shows fmt_ptr() of the timer argument: the
// packed (x << 16 | y) spot coordinate for level timers and the object
// address for object timers. Object addresses belong to the native heap, so
// the port shows the object's stable id in the same 0x-prefixed shape.
function timerQueueLines(state) {
    const timers = queuedTimers(state);
    if (!timers.length)
        return [' <empty>'];
    const rows = ['timeout  id   kind   call'];
    for (const entry of timers) {
        const funcName = TIMER_FUNC_NAMES[entry.timer.kind];
        if (!funcName)
            throw new Error(`No timer callback name for ${entry.timer.kind}`);
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
function timedPropertyLines(state) {
    const timed = PROPERTY_NAMES
        .map((entry, index) => ({ ...entry, index, timeout: propertyTimeout(entry.property, state) }))
        .filter(entry => entry.timeout > 0);
    if (!timed.length)
        return ['No timed properties.'];
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
export async function wizTimeoutQueue() {
    const state = requireInitializedGame();
    const lines = [
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
export async function runDueTimers() {
    while (!game.program_state?.gameover) {
        const timer = claimNextDueObjectTimer(game, game.moves);
        if (!timer)
            return;
        await runObjectTimer(timer, game.moves);
    }
}
// The caller has removed this timer from the queue. Its callback may add or
// cancel timers, so the next due timer must be selected after it finishes.
export async function runObjectTimer(claimed, currentTurn) {
    if (claimed.object === null) {
        const wasMonsterMoving = game.context.mon_moving;
        game.context.mon_moving = true;
        try {
            const { x, y } = claimed.position;
            return await meltIce(x, y, { message: 'Some ice melts away.' });
        }
        finally {
            game.context.mon_moving = wasMonsterMoving;
        }
    }
    const kind = claimed.timer.kind;
    if (kind === OBJECT_TIMER_KIND.BURN_OBJECT)
        return runClaimedObjectBurnTimer(claimed, game, currentTurn);
    if (kind === OBJECT_TIMER_KIND.HATCH_EGG) {
        const event = await runClaimedEggHatchTimer(claimed, game, currentTurn);
        if (event?.message)
            await plineWithContinuation(event.message);
        if (event?.followupMessage)
            await plineWithContinuation(event.followupMessage);
        return finishEggHatchTimer(event, game, currentTurn);
    }
    if (kind === OBJECT_TIMER_KIND.SHRINK_GLOB) {
        const event = await runClaimedGlobTimer(claimed, game, currentTurn);
        if (event?.message)
            await plineWithContinuation(event.message);
        return finishGlobTimer(event, game, currentTurn);
    }
    if (kind === OBJECT_TIMER_KIND.FIG_TRANSFORM) {
        const event = await runClaimedFigurineTimer(claimed, game, currentTurn);
        for (const message of event?.waterMessages || [])
            await plineWithContinuation(message);
        if (event?.message)
            await plineWithContinuation(event.message);
        return await finishFigurineTimer(event, game);
    }
    if (kind === OBJECT_TIMER_KIND.REVIVE_MON || kind === OBJECT_TIMER_KIND.ZOMBIFY_MON) {
        const event = await runClaimedCorpseRevivalTimer(claimed, game, currentTurn);
        for (const message of event?.messages || [])
            await plineWithContinuation(message);
        if (event?.buried)
            await announceBuriedRevival(event);
        return await finishBuriedZombieTimer(event, game);
    }
    const event = await runClaimedObjectRotTimer(claimed, game);
    if (kind === OBJECT_TIMER_KIND.ROT_ORGANIC && event && 'where' in event && event.where === 'floor')
        await newsym(event.x, event.y);
    return event;
}
async function announceBuriedRevival(event) {
    if (event.kind !== 'revived' || !event.monster)
        return;
    const { monster, trap } = event;
    if (cansee(monster.mx, monster.my)) {
        let subject = 'Something';
        if (canSpotMonster(monster))
            subject = monsterName(monster, { article: 'a', capitalized: true });
        if (trap)
            trap.tseen = true;
        await plineWithContinuation(`${subject} claws itself out of the ground!`);
        await newsym(monster.mx, monster.my);
    }
    else {
        const dx = monster.mx - game.u.ux;
        const dy = monster.my - game.u.uy;
        if (!(game.u.deaf || game.deaf) && dx * dx + dy * dy < 25)
            await plineWithContinuation('You hear scratching noises.');
    }
}
//# sourceMappingURL=timeout.js.map