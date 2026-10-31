// C timeout.c:nh_timeout() — the once-per-turn countdown allmain.c calls
// between glibr() and run_regions(). Luck creeps toward its baseline, the
// fatal-condition dialogues warn, every timed intrinsic counts down in the
// prop.h enum order with its expiry effect at the point C prints it, and
// run_timers() fires due object timers last.
import { runDueTimers } from './timer_effects.js';
import { recoverTimedLuck } from './timeout_luck.js';
import { advanceBodyTimeouts, advanceGallopingTimeout } from './timeout_body.js';
import { breathingDialogue, wallPassageDialogue, finishBreathingTimeout, finishWallPassageTimeout, } from './timeout_warnings.js';
import { levitationDialogue, advanceLevitationTimeout, advanceFlyingTimeout, } from './levitation_timeout.js';
import { slipOrTrip } from './fumbling.js';
import { invWeight } from './weight.js';
import { formatFeltMessage } from './hero_speech.js';
import { makeBlinded } from './sight_change.js';
import { makeConfused, makeHallucinated, makeStunned } from './hero_mental_status.js';
import { makeDeaf } from './hero_hearing.js';
import { advanceSpellProtection } from './spell_misc_effects.js';
import { advanceDisplacementTimeout } from './hero_displacement.js';
import { advanceCorpseResistanceTimeouts } from './corpse_intrinsics.js';
import { requireInitializedGame } from './gstate.js';
import { nomul } from './command_state.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { deferredDecor } from './dungeon_feature.js';
import { rnd } from './rng.js';
import { propertyIsActive, propertyIsBlocked, propertyTimeout, refreshProperty, setPropertyTimeout, } from './properties.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { setSlipperyHands } from './towel.js';
import { healHeroLegs } from './hero_legs.js';
import { heroIsUnconscious, putHeroToSleep } from './hero_sleep.js';
import { advanceHeroSickness, advanceHeroVomiting, heroIsSick, heroIsVomiting, sicknessDialogue, vomitingDialogue, } from './hero_illness.js';
import { advanceHeroSliming, heroIsSliming, slimeDialogue } from './slime.js';
import { advanceHeroPetrification, heroIsPetrifying, petrificationDialogue } from './stoning.js';
import { advanceHeroStrangulation, strangulationDialogue } from './hero_strangulation.js';
import { refreshHeroSeeing } from './hero_seeing.js';
import { syncHeroInvisibility } from './hero_invisibility.js';
import { restartMonsterShapechanging } from './monster_polymorph.js';
import { stopHeroOccupation } from './occupation.js';
import { polymonHero } from './polyself.js';
import { finishHeroDeath } from './end.js';
import { MONSTER_NAME } from './monster_data.js';
import { makePlural } from './object_grammar.js';
import { newsym, randomDisplayMonsterName, see_monsters } from './display.js';
import { plineWithContinuation } from './pline.js';
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
// C timeout.c:588-948 nh_timeout().
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
//# sourceMappingURL=timeout.js.map