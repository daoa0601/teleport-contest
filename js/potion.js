// potion.js — the potion.c owner: the quaff effect switch (peffects() and its
// peffect_* helpers), bottle occupants (ghost_from_bottle(),
// djinni_from_bottle(), mongrantswish()), thrown-potion impact and vapor
// (bottlename(), H2Opotion_dip(), potionhit(), potionbreathe()), dipping and
// mixing (dodip(), dip_into(), potion_dip(), mixtype(), hold_potion(), poof(),
// dip_potion_explosion()), and split_mon().  The drink transaction itself
// (dodrink()/dopotion()) lives in quaff.ts; the hero's own potion impact
// (potionhit(mon == &youmonst)) in hero_potion_hit.ts; spell reuse of the
// effect switch in spell_potion_effects.ts; the dothrow.c throwit() flight in
// dothrow.ts; inaccessible_equipment()'s covering test in
// equipment_selection.ts.
import { armorSlotFor, heroHasFreeAction } from './armor.js';
import { adjustAttribute, attributeChangeMessage, currentAttribute, exerciseAttribute, restoreHeroBaseAttributes } from './attrib.js';
import { heroEyeCount, heroEyeName, heroFaceName, heroFootName, heroHandName } from './body_parts.js';
import { commandResultCancelled, commandResultFailed, setMulti } from './cmd.js';
import { nomul } from './hack.js';
import { A_CON, A_DEX, A_INT, A_MAX, A_STR, A_WIS, BOLT_LIM, COLNO, EXPL_FIERY, FOUNTAIN, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_INACCESS, GETOBJ_EXCLUDE_NONINVENT, GETOBJ_SUGGEST, G_GONE, Is_airlevel, Is_waterlevel, MM_NOMSG, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, M_SEEN_SLEEP, PLNMSG_OBJ_GLOWS, POLY_CONTROLLED, POLY_LOW_CTRL, POLY_NOFLAGS, ROWNO, SINK, STRAT_WAITFORU, TIMEOUT, Upolyd, WEAK } from './const.js';
import { impossible } from './diagnostics.js';
import { fingersOrGloves, washHands } from './dip_water.js';
import { canSeeMonster, canSpotMonster, displayColorName, displayLiquidName, map_invisible, newsym, randomDisplayMonsterName, see_monsters, shieldeff, show_glyph_cell, unmap_invisible } from './display.js';
import { monsterName } from './do_name.js';
import { tameMonster } from './dog.js';
import { canHeroRiseUp, levelAtDepth } from './dungeon.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { gainExperienceLevel, randomExperience } from './exper.js';
import { explode } from './explosion.js';
import { coveringEquipment, reportCoveredEquipment } from './equipment_selection.js';
import { fireDamageObject } from './fire_damage.js';
import { explodeLitOilPotion } from './fire_explosion.js';
import { heroCanReachFloor } from './floor_reach.js';
import { dipFountain } from './fountain.js';
import { fruitName } from './fruit.js';
import { LL_CONDUCT, recordGameLogEvent } from './gamelog.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { depth, dist2, ledgerNo, possessiveName } from './hacklib.js';
import { loseHeroHp } from './hero_damage.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { healHero } from './hero_healing.js';
import { makeDeaf } from './hero_hearing.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { hurtleHero } from './hero_hurtle.js';
import { cureHeroSicknessWithMessages, heroIsSick, heroIsVomiting } from './hero_illness.js';
import { freeInventoryObject, useUpInventoryStack } from './hero_inventory.js';
import { applyPotionLikeInvisibility, hasInternalInvisibility, heroIsInvisible } from './hero_invisibility.js';
import { healHeroLegs } from './hero_legs.js';
import { makeConfused, makeHallucinated } from './hero_mental_status.js';
import { reportHeroThrownMiss } from './hero_physical_messages.js';
import { grantHeroSeeInvisible } from './hero_seeing.js';
import { heroIsUnaware, putHeroToSleep } from './hero_sleep.js';
import { heroFormSticks } from './hero_species.js';
import { formatFeltMessage } from './hero_speech.js';
import { speedUpHero } from './hero_speed.js';
import { heroIsStrangled } from './hero_strangulation.js';
import { updateHeroHunger } from './hunger.js';
import { peekCommandResponse } from './input.js';
import { doEnlightenmentEffect, showEnlightenment } from './insight.js';
import { consumeInventoryItem, inventoryItemDescription } from './invent.js';
import { chooseInventoryObject, getobj } from './inventory_prompt.js';
import { gotoLevel } from './level_change.js';
import { floatingAbove } from './levitation_commands.js';
import { applyLevitationPotion } from './levitation_potion.js';
import { pickupBurden } from './lift_object.js';
import { adjustObjectLightAfterBlessing, objectLightRadius } from './light.js';
import { detectMonsters, detectObjects } from './detect.js';
import { cloneMonster, setMonsterMalign } from './makemon.js';
import { putMonsterToSleep } from './mhitm.js';
import { makemonNear } from './mklev.js';
import { mkobj, blessObjectState, curseObject, curseObjectState, unblessObjectState, uncurseObjectState, unlinkObject } from './mkobj.js';
import { finishMonsterKilled, removeMonsterFromGame, removeWishGrantingMonster, revealMonsterAppearance, wakeMonstersNearWithMessages } from './mon.js';
import { monsterHasAcidResistance, monsterHasPoisonResistance, monstersForgetHeroResistance, monstersObserveHeroResistance } from './mondata.js';
import { AD_ACID, AD_DISE, AD_PEST } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_MAGIC_RESISTANCE, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SOUND, MONSTER_SYMBOL, monsterHatesBlessings, monsterIsHuman, monsterIsPlayerMonster } from './monster_data.js';
import { tryCallObjectType } from './object_call.js';
import { ALCHEMY_SMOCK, CORPSE, LENSES, MAGIC_LAMP, OBJECT_DESCRIPTIONS, OBJECT_MAGIC, OBJECT_NAMES, OIL_LAMP, POT_ACID, POT_BLINDNESS, POT_BOOZE, POT_CONFUSION, POT_ENLIGHTENMENT, POT_EXTRA_HEALING, POT_FRUIT_JUICE, POT_FULL_HEALING, POT_GAIN_ABILITY, POT_GAIN_ENERGY, POT_GAIN_LEVEL, POT_HALLUCINATION, POT_HEALING, POT_INVISIBILITY, POT_LEVITATION, POT_MONSTER_DETECTION, POT_OBJECT_DETECTION, POT_OIL, POT_PARALYSIS, POT_POLYMORPH, POT_RESTORE_ABILITY, POT_SEE_INVISIBLE, POT_SICKNESS, POT_SLEEPING, POT_SPEED, POT_WATER, SPE_DETECT_MONSTERS, SPE_DETECT_TREASURE, SPE_HASTE_SELF, SPE_INVISIBILITY, SPE_LEVITATION, SPE_RESTORE_ABILITY, TOWEL, UNICORN_HORN } from './object_data.js';
import { objectDescription } from './object_description.js';
import { hitFloorWithObject } from './object_drop.js';
import { makePlural, verbForSubject, withIndefiniteArticle } from './object_grammar.js';
import { learnObjectType, observeObject, recordObjectEncounter, recordObjectKnowledge } from './object_knowledge.js';
import { isLauncherAmmunition, isPermanentlyPoisonedObject, isPoisonableObject, isWeaponTool } from './object_properties.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { definiteName, definiteObjectAction, objectAction, objectCombatName, objectName, objectNameIsPlural, objectQuestion, observeObjectForNaming, ownedObjectAction, ownedObjectName, simpleObjectName } from './objnam.js';
import { plineWithContinuation, plineWithContinuation as pline } from './pline.js';
import { poisonAttributeMessage } from './poison.js';
import { heroHasProtectionFromShapeChangers, heroIsPolymorphed, heroIsUnchanging, polymorphHero } from './polyself.js';
import { grantIntrinsicProperty, hasIntrinsicProperty, hasPermanentIntrinsicProperty, hasWornProperty, propertyIsActive, setPropertyTimeout } from './properties.js';
import { promptYesNo } from './query.js';
import { d, rn1, rn2, rnd, rnl } from './rng.js';
import { blindfolded, blindnessBlocked, heroDetectsMonsters, heroIsBlind, heroIsBlinded, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { chargeAlteredUnpaidObject, chargeUnpaidObjectAsDebt, chargeUnpaidUsage, objectOwnershipPrefix, objectTypeKnown, updateUnpaidObjectPrice, deleteObject } from './shk.js';
import { makeBlinded } from './sight_change.js';
import { dipSink } from './sink_dipping.js';
import { burnAwayHeroSlime, heroIsFlaming, heroIsSliming } from './slime.js';
import { monsterAtPosition, monsterSaddle } from './steed.js';
import { fixHeroPetrification, heroIsPetrifying } from './stoning.js';
import { ceilingName, surfaceName, waterbodyName } from './terrain_name.js';
import { isPoolAt } from './terrain_properties.js';
import { applyLowStaminaThrow, applyThrowSlip } from './throw_state.js';
import { offerThrownFood } from './thrown_food.js';
import { detachThrownUnit, finishHeroThrownObjectLanding, flyHeroThrownObject, heroThrowTrajectory, prepareHeroThrownTarget } from './thrown_object.js';
import { tossObjectUp } from './toss_up.js';
import { waterDamageObject, erodeObject, objectIsVulnerableToErosion } from './trap.js';
import { flushPendingTopline } from './tty_topline.js';
import { dropCursedSecondaryWeapon } from './two_weapon.js';
import { cansee } from './vision.js';
import { nearCapacity } from './weight.js';
import { applyHeroWaterVaporChange, applyHeroWereChange, purifyHeroLycanthropy, revertHeroWereForm, setHeroLycanthropy, transformWereMonster } from './were.js';
import { makeWish } from './wish.js';
import { aggravateMonsters } from './wizard.js';
import { redrawMonsterWormSegments } from './worm.js';
import { adjustMonsterSpeed, monsterSpeedMessage, setMonsterPermanentInvisibility } from './worn.js';
import { polymorphMonsterFromMagic, obj_unpolyable, poly_obj } from './zap.js';
// ---- ghost_from_bottle() and the dopotion() occupant check (C potion.c:481, 617-644) ----
const PM_GHOST = MONSTER_NAME.indexOf('ghost');
const PM_DJINNI = MONSTER_NAME.indexOf('djinni');
// C potion.c:ghost_from_bottle().
async function releaseGhost(state) {
    const monster = await makemonNear(PM_GHOST, state.u.ux, state.u.uy, MM_NOMSG);
    if (!monster) {
        await pline('This bottle turns out to be empty.');
        return;
    }
    if (heroIsBlind(state)) {
        await pline('As you open the bottle, something emerges.');
        return;
    }
    const name = heroIsHallucinating(state) ? randomDisplayMonsterName() : 'ghost';
    await pline(`As you open the bottle, an enormous ${name} emerges!`);
    if (state.flags.verbose)
        await pline('You are frightened to death, and unable to move.');
    nomul(-3, state);
    state._helplessReason = 'being frightened to death';
    state._helplessDoneMessage = 'You regain your composure.';
}
export async function releasePotionOccupant(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const appearance = state.objectDescriptions?.[source.otyp]
        ?? OBJECT_DESCRIPTIONS[source.otyp];
    const species = appearance === 'milky' ? PM_GHOST
        : appearance === 'smoky' ? PM_DJINNI : null;
    if (species === null || ((state.mvitals?.[species]?.mvflags ?? 0) & G_GONE)
        || rn2(13 + 2 * (state.mvitals?.[species]?.born ?? 0)))
        return { released: false, heroDied: false };
    if (species === PM_GHOST)
        await releaseGhost(state);
    else
        await releaseDjinni(source, state);
    return { released: true, heroDied: !!state.program_state?.gameover };
}
// ---- peffect_* helpers (C potion.c:646-1332) ----
async function restoreAbility(source, state) {
    if (source.cursed) {
        await pline('Ulch!  This makes you feel mediocre!');
        return;
    }
    const feeling = !source.blessed ? 'good' : restorationLeavesTrouble(state) ? 'better' : 'great';
    await pline(`Wow!  This makes you feel ${feeling}!`);
    restoreHeroBaseAttributes({ all: !!source.blessed, state });
    if (source.otyp === POT_RESTORE_ABILITY) {
        while (state.u.ulevel < state.u.ulevelmax) {
            await gainExperienceLevel({ state });
            if (!source.blessed)
                break;
        }
    }
}
// C apply.c:unfixable_trouble_count(FALSE). Restoration does not treat these
// ailments or temporary attribute penalties; they only change its feedback.
function restorationLeavesTrouble(state) {
    const hero = state.u;
    return heroIsPetrifying(state) || heroIsSliming(state) || heroIsStrangled(state)
        || hero.atemp.a[A_DEX] < 0 && (hero._woundedLegTurns ?? 0) > 0
        || hero.atemp.a[A_STR] < 0 && hero.uhs >= WEAK
        || heroIsSick(state) || propertyIsActive('stunned', state)
        || (hero.confusionTurns ?? 0) > 0 || heroIsHallucinating(state)
        || heroIsVomiting(state) || heroIsDeaf(state);
}
// C potion.c:peffect_hallucination().
async function hallucinationEffect(source, state) {
    if (state.u.hallucinationResistance
        || propertyIsActive('hallucinationResistance', state))
        return true;
    const nothing = heroIsHallucinating(state);
    await makeHallucinated((state.u.hallucinationTurns || 0)
        + rn1(200, 600 - 300 * blessing(source)), { state });
    if (source.blessed && !rn2(3) || !source.cursed && !rn2(6)) {
        await pline('You perceive yourself...');
        await flushPendingTopline();
        await showEnlightenment({ basic: false, magic: true });
        await pline('Your awareness re-normalizes.');
        await exerciseAttribute(A_WIS, true, state);
    }
    return nothing;
}
function halfPhysical(amount, state) {
    return state.u.halfPhysicalDamage
        ? Math.ceil(amount / 2) : amount;
}
async function drinkWater(source, state) {
    const hero = state.u;
    if (!source.blessed && !source.cursed) {
        await plineWithContinuation(`This tastes like ${displayLiquidName('water', state)}.`);
        hero.uhunger += rnd(10);
        await updateHeroHunger(false, { state });
        return !!state.program_state.gameover;
    }
    const hostileBody = monsterHatesBlessings({
        mnum: hero.umonnum,
        ...(hero.mcham === undefined ? {} : { cham: hero.mcham }),
    });
    if (hostileBody || hero.ualign.type === -1) {
        if (source.blessed) {
            await plineWithContinuation(`This burns like ${displayLiquidName('acid', state)}!`);
            await exerciseAttribute(A_CON, false, state);
            if (hero.ulycn >= 0) {
                const wereName = MONSTER_NAME[hero.ulycn];
                if (wereName === undefined)
                    throw new Error(`Unknown lycanthrope species ${hero.ulycn}`);
                await plineWithContinuation(`Your affinity to ${makePlural(wereName)} disappears!`);
                if (hero.umonnum === hero.ulycn)
                    await revertHeroWereForm({ state });
                if (state.program_state.gameover)
                    return true;
                setHeroLycanthropy(-1, state);
            }
            return loseHeroHp(halfPhysical(d(2, 6), state), 'potion of holy water', { state });
        }
        await plineWithContinuation(formatFeltMessage('quite proud of yourself.', state));
        await healHero(d(2, 6), 0, { state });
        if (hero.ulycn >= 0 && !heroIsPolymorphed(state))
            await applyHeroWereChange({ state });
        if (state.program_state.gameover)
            return true;
        await exerciseAttribute(A_CON, true, state);
        return !!state.program_state.gameover;
    }
    if (source.blessed) {
        await plineWithContinuation(formatFeltMessage('full of awe.', state));
        await cureHeroSicknessWithMessages(state);
        await exerciseAttribute(A_WIS, true, state);
        await exerciseAttribute(A_CON, true, state);
        if (hero.ulycn >= 0)
            await purifyHeroLycanthropy({ state });
    }
    else {
        if (hero.ualign.type === 1) {
            await plineWithContinuation(`This burns like ${displayLiquidName('acid', state)}!`);
            if (await loseHeroHp(halfPhysical(d(2, 6), state), 'potion of unholy water', { state }))
                return true;
        }
        else
            await plineWithContinuation(formatFeltMessage('full of dread.', state));
        if (hero.ulycn >= 0 && !heroIsPolymorphed(state))
            await applyHeroWereChange({ state });
        if (state.program_state.gameover)
            return true;
        await exerciseAttribute(A_CON, false, state);
    }
    return !!state.program_state.gameover;
}
function blessing(source) {
    return source.blessed ? 1 : source.cursed ? -1 : 0;
}
// C potion.c:peffect_booze().
async function boozeEffect(source, state) {
    const dilution = source.odiluted ? 'watered down ' : '';
    const taste = heroIsHallucinating(state) ? 'dandelion wine' : 'liquid fire';
    await pline(`Ooph!  This tastes like ${dilution}${taste}!`);
    if (!source.blessed) {
        await makeConfused((state.u.confusionTurns || 0)
            + d(2 + (state.u.uhs || 0), 8), { state, talk: false });
    }
    if (!source.odiluted)
        await healHero(1, 0, { state });
    // peffect_booze adds nutrition directly; it does not call lesshungry's
    // fullness/choking checks, even when drunk on a full stomach.
    state.u.uhunger = (state.u.uhunger ?? 900) + 10 * (2 + blessing(source));
    await updateHeroHunger(false, { state });
    await exerciseAttribute(A_WIS, false, state);
    if (source.cursed) {
        await pline('You pass out.');
        setMulti(-rnd(15), state);
        state._helplessDoneMessage = 'You awake with a headache.';
    }
}
// C potion.c:peffect_see_invisible().
async function seeInvisible(source, state) {
    // C msg = Invisible && !Blind; Invisible is Invis && !See_invisible
    // (youprop.h), so an invisible hero who already sees invisible is
    // not told they can see through themselves.
    const wasInvisible = heroIsInvisible(state) && !propertyIsActive('seeInvisible', state)
        && !heroIsBlind(state);
    const permanenceChance = 10 - (hasInternalInvisibility(state) ? 3 : 0)
        - (hasIntrinsicProperty('seeInvisible', null, state) || (state.u.seeInvisibleTurns ?? 0) > 0 ? 6 : 0);
    const fruit = fruitName(true, state);
    const diluted = source.odiluted;
    await pline(source.cursed ? `Yecch!  This tastes ${heroIsHallucinating(state) ? 'overripe' : 'rotten'}.`
        : heroIsHallucinating(state) ? `This tastes like 10% real ${diluted ? 'reconstituted ' : ''}${fruit} all-natural beverage.`
            : `This tastes like ${diluted ? 'reconstituted ' : ''}${fruit}.`);
    if (source.otyp === POT_FRUIT_JUICE) {
        state.u.uhunger += (diluted ? 5 : 10) * (2 + (source.blessed ? 1 : source.cursed ? -1 : 0));
        await updateHeroHunger(false, { state });
        return 1;
    }
    if (!source.cursed)
        await makeBlinded(0, { state });
    const permanent = !!source.blessed && !rn2(permanenceChance);
    await grantHeroSeeInvisible({ permanent, duration: permanent ? 0 : rn1(100, 750), state });
    if (wasInvisible && !heroIsBlind(state)) {
        await pline('You can see through yourself, but you are visible!');
        return 0;
    }
    return 1;
}
// C potion.c:peffect_paralysis().
async function paralysisEffect(source, state) {
    if (heroHasFreeAction(state)) {
        await pline('You stiffen momentarily.');
        return;
    }
    if (propertyIsActive('levitation', state) || Is_airlevel(state.u.uz)
        || Is_waterlevel(state.u.uz)) {
        await pline('You are motionlessly suspended.');
    }
    else if (state.u.usteed) {
        await pline('You are frozen in place!');
    }
    else {
        await pline(`Your ${makePlural(heroFootName(state))} are frozen to the ${surfaceName(state.u.ux, state.u.uy, state)}!`);
    }
    const turns = rn1(10, 25 - 12 * blessing(source));
    nomul(-turns, state);
    state._helplessReason = 'frozen by a potion';
    state._helplessDoneMessage = 'You can move again.';
    await exerciseAttribute(A_DEX, false, state);
}
// C potion.c:peffect_sleeping().
async function sleepingEffect(source, state) {
    if (state.u.sleepResistance
        || propertyIsActive('sleepResistance', state) || heroHasFreeAction(state)) {
        monstersObserveHeroResistance(M_SEEN_SLEEP, state);
        await pline('You yawn.');
    }
    else {
        await pline('You suddenly fall asleep!');
        monstersForgetHeroResistance(M_SEEN_SLEEP, state);
        await putHeroToSleep(rn1(10, 25 - 12 * blessing(source)), { state });
    }
}
// C potion.c:peffect_monster_detection().
async function monsterDetection(source, state) {
    let unknown = 0, nothing = false;
    if (source.blessed) {
        const hero = state.u;
        nothing = heroDetectsMonsters(state);
        unknown++;
        const timeout = hero.monsterDetectionTurns || 0;
        hero.monsterDetectionTurns = Math.min(TIMEOUT, timeout + (timeout >= 300 ? 1 : source.oclass === 10 ? rn1(40, 21) : rn2(100) + 100));
        let found = false;
        for (let x = 1; x < COLNO; x++)
            for (let y = 0; y < ROWNO; y++) {
                await unmap_invisible(x, y);
                if (monsterAtPosition(state.level, x, y))
                    found = true;
            }
        if (found)
            unknown = 0;
        if (!hero.uswallow && !hero.uinwater && !state.underwater) {
            await see_monsters();
            if (!found)
                await pline(formatFeltMessage('lonely.', state));
            return { result: 0, unknown, nothing };
        }
    }
    const detection = await detectMonsters(source, { state });
    if (!detection.result)
        await exerciseAttribute(A_WIS, true, state);
    return { result: detection.result, unknown, nothing };
}
// C potion.c:peffect_sickness().
async function drinkSickness(source, state) {
    const hero = state.u;
    await plineWithContinuation('Yecch!  This stuff tastes like poison.');
    const healer = state.urole.key === 'healer';
    if (source.blessed) {
        await plineWithContinuation(`(But in fact it was mildly stale ${fruitName(true, state)}.)`);
        if (!healer && await loseHeroHp(1, 'mildly contaminated potion', { state }))
            return true;
    }
    else {
        const resisted = propertyIsActive('poisonResistance', state);
        if (resisted)
            await plineWithContinuation(`(But in fact it was biologically contaminated ${fruitName(true, state)}.)`);
        if (healer)
            await plineWithContinuation('Fortunately, you have been immunized.');
        else {
            const attribute = rn2(A_MAX);
            const contaminant = `${resisted ? 'mildly ' : ''}contaminated ${source.fromsink ? 'tap water' : 'potion'}`;
            if (!hero.fixedAbilities && !propertyIsActive('sustainAbility', state)) {
                await plineWithContinuation(poisonAttributeMessage(attribute, state, false));
                const change = adjustAttribute(attribute, resisted ? -1 : -rn1(4, 3), state);
                if (change.changed && state._moveloopStarted
                    && (attribute === A_STR || attribute === A_CON))
                    await reportHeroEncumbrance(state);
            }
            const damage = resisted ? 1 + rn2(2) : rnd(10) + 5 * Number(!!source.cursed);
            if (await loseHeroHp(damage, contaminant, {
                state,
                deathCause: source.fromsink ? `killed by ${contaminant}` : null,
            }))
                return true;
            await exerciseAttribute(A_CON, false, state);
        }
    }
    if (heroIsHallucinating(state)) {
        await plineWithContinuation('You are shocked back to your senses!');
        await makeHallucinated(0, { state, talk: false });
    }
    return !!state.program_state.gameover;
}
// msgflg -1 suppresses failed attempts but still reports successful changes.
async function increaseAttribute(attribute, reportFailure, state) {
    const change = adjustAttribute(attribute, 1, state);
    if (change.changed || reportFailure
        && (change.blockedByDunceCap || state.flags.verbose)) {
        const message = attributeChangeMessage(attribute, change, state);
        if (message)
            await pline(message);
    }
    if (change.changed && state._moveloopStarted
        && (attribute === A_STR || attribute === A_CON)) {
        await reportHeroEncumbrance(state);
    }
    return change;
}
async function drinkGainLevel(source, state) {
    if (!source.cursed) {
        await gainExperienceLevel({ state });
        if (source.blessed)
            state.u.uexp = randomExperience({ gaining: true, state });
        return;
    }
    const hero = state.u;
    const firstLevel = ledgerNo(hero.uz) === 1;
    if (!(firstLevel ? hero.uhave.amulet : canHeroRiseUp(hero.ux, hero.uy, { state }))) {
        await plineWithContinuation('You have an uneasy feeling.');
        return;
    }
    const destination = firstLevel ? state.earth_level : levelAtDepth(depth(hero.uz) - 1, { state });
    if (!destination)
        throw new Error('Gain-level potion requires its destination level.');
    if (destination.dnum === hero.uz.dnum && destination.dlevel === hero.uz.dlevel) {
        await plineWithContinuation('It tasted bad.');
        return;
    }
    await plineWithContinuation(`You rise up, through the ${ceilingName(hero.ux, hero.uy, state)}!`);
    await gotoLevel(destination);
}
// C potion.c:peffect_oil().
async function drinkOil(source, state) {
    let good = false;
    if (source.lamplit) {
        if (heroIsFlaming(state)) {
            await plineWithContinuation('Ahh, a refreshing drink.');
            good = true;
        }
        else {
            await plineWithContinuation(`You burn your ${heroFaceName(state)}.`);
            const vulnerable = !propertyIsActive('fireResistance', state)
                || propertyIsActive('coldResistance', state);
            const killer = 'quaffing a burning potion of oil';
            if (await loseHeroHp(d(vulnerable ? 4 : 2, 4), killer, {
                state, deathCause: `killed by ${killer}`,
            }))
                return true;
        }
        await burnAwayHeroSlime({ state });
    }
    else
        await plineWithContinuation(source.cursed ? 'This tastes like castor oil.' : 'That was smooth!');
    await exerciseAttribute(A_WIS, good, state);
    return !!state.program_state.gameover;
}
async function drinkAcid(source, state) {
    if (propertyIsActive('acidResistance', state))
        await plineWithContinuation(`This tastes ${heroIsHallucinating(state) ? 'tangy' : 'sour'}.`);
    else {
        await plineWithContinuation(`This burns${source.blessed ? ' a little' : source.cursed ? ' a lot' : ' like acid'}!`);
        const damage = halfPhysical(d(source.cursed ? 2 : 1, source.blessed ? 4 : 8), state);
        if (await loseHeroHp(damage, 'potion of acid', { state }))
            return true;
        await exerciseAttribute(A_CON, false, state);
    }
    await fixHeroPetrification({ state });
    return !!state.program_state.gameover;
}
// C potion.c:peffect_polymorph().
async function drinkPolymorph(source, state) {
    await plineWithContinuation(formatFeltMessage(`a little ${heroIsHallucinating(state) ? 'normal' : 'strange'}.`, state));
    if (heroIsUnchanging(state))
        return false;
    const controlled = source.blessed && !heroIsPolymorphed(state);
    const result = await polymorphHero(controlled ? POLY_CONTROLLED | POLY_LOW_CTRL : POLY_NOFLAGS);
    if (controlled && state.u.mtimedone && heroIsPolymorphed(state))
        state.u.mtimedone = Math.min(state.u.mtimedone, rn2(15) + 10);
    return !!result?.died || !!state.program_state.gameover;
}
// ---- peffects() (C potion.c:1333) ----
// C potion.c:peffect_water().
// C potion.c:peffect_acid().
// C potion.c:peffect_gain_level().
export async function applyPotionBodyEffect(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    let unknown = 0;
    let heroDied = false;
    switch (source.otyp) {
        case POT_WATER:
            unknown = Number(!!(source.blessed || source.cursed));
            heroDied = await drinkWater(source, state);
            break;
        case POT_SICKNESS:
            heroDied = await drinkSickness(source, state);
            break;
        case POT_OIL:
            heroDied = await drinkOil(source, state);
            break;
        case POT_ACID:
            unknown = 1;
            heroDied = await drinkAcid(source, state);
            break;
        case POT_POLYMORPH:
            heroDied = await drinkPolymorph(source, state);
            break;
        case POT_GAIN_LEVEL:
            unknown = Number(!!source.cursed);
            await drinkGainLevel(source, state);
            heroDied = !!state.program_state.gameover;
            break;
        default:
            return { handled: false, unknown: 0, nothing: false, heroDied: false };
    }
    return { handled: true, unknown, nothing: false, heroDied };
}
// C potion.c:peffect_enlightenment().
// C potion.c:peffect_confusion().
// C potion.c:peffect_gain_ability().
// C potion.c:peffect_blindness().
export async function applyPotionMentalEffect(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    let unknown = 0;
    let nothing = false;
    switch (source.otyp) {
        case POT_HALLUCINATION:
            nothing = await hallucinationEffect(source, state);
            break;
        case POT_BOOZE:
            unknown = 1;
            await boozeEffect(source, state);
            break;
        case POT_ENLIGHTENMENT:
            if (source.cursed) {
                unknown = 1;
                await pline('You have an uneasy feeling...');
                await exerciseAttribute(A_WIS, false, state);
            }
            else {
                if (source.blessed) {
                    await increaseAttribute(A_INT, true, state);
                    await increaseAttribute(A_WIS, true, state);
                }
                await doEnlightenmentEffect();
            }
            break;
        case POT_PARALYSIS:
            await paralysisEffect(source, state);
            break;
        case POT_SLEEPING:
            await sleepingEffect(source, state);
            break;
        case POT_CONFUSION:
            if ((state.u.confusionTurns ?? 0) > 0) {
                nothing = true;
            }
            else if (heroIsHallucinating(state)) {
                await pline('What a trippy feeling!');
                unknown = 1;
            }
            else {
                await pline('Huh, What?  Where am I?');
            }
            await makeConfused((state.u.confusionTurns || 0)
                + rn1(7, 16 - 8 * blessing(source)), { state, talk: false });
            break;
        case POT_GAIN_ABILITY:
            if (source.cursed) {
                await pline('Ulch!  That potion tasted foul!');
                unknown = 1;
            }
            else if (state.u.fixedAbilities
                || propertyIsActive('sustainAbility', state)) {
                nothing = true;
            }
            else {
                for (let attempt = 0; attempt < A_MAX; attempt++) {
                    const attribute = source.blessed ? attempt : rn2(A_MAX);
                    const change = await increaseAttribute(attribute, !!source.blessed || attempt === A_MAX - 1, state);
                    if (change.changed && !source.blessed)
                        break;
                }
            }
            break;
        case POT_BLINDNESS: {
            const blind = heroIsBlind(state);
            nothing = blind || blindnessBlocked(state)
                && (!!state.u.permaBlind || !!state.u.blindTurns || hasIntrinsicProperty('blinded', null, state)
                    || hasWornProperty('blinded', state));
            await makeBlinded((state.u.blindTurns || 0)
                + rn1(200, 250 - 125 * blessing(source)), { state, talk: !blind });
            break;
        }
        default:
            return { handled: false, unknown: 0, nothing: false, heroDied: false };
    }
    return { handled: true, unknown, nothing, heroDied: !!state.program_state.gameover };
}
// C potion.c:peffect_speed().
// C potion.c:peffect_invisibility().
// C potion.c:peffect_object_detection().
// C potion.c:peffect_healing().
// C potion.c:peffect_extra_healing().
// C potion.c:peffect_full_healing().
// C potion.c:peffect_gain_energy().
export async function applyPotionEffect(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    let result = -1;
    let unknown = 0, nothing = false;
    const blessing = source.blessed ? 1 : source.cursed ? -1 : 0;
    switch (source.otyp) {
        case POT_RESTORE_ABILITY:
        case SPE_RESTORE_ABILITY:
            unknown++;
            await restoreAbility(source, state);
            break;
        case POT_FRUIT_JUICE:
        case POT_SEE_INVISIBLE:
            unknown = await seeInvisible(source, state);
            break;
        case POT_SPEED:
        case SPE_HASTE_SELF:
            if (source.otyp === POT_SPEED && (state.u._woundedLegTurns ?? 0) > 0
                && !source.cursed && !state.u.usteed) {
                await healHeroLegs(state);
                unknown++;
            }
            else {
                await speedUpHero(rn1(10, 100 + 60 * blessing), state);
                if (source.otyp === POT_SPEED && !source.cursed
                    && !hasPermanentIntrinsicProperty('fast', state)) {
                    await pline('Your quickness feels very natural.');
                    grantIntrinsicProperty('fast', 'outside', state);
                }
            }
            break;
        case POT_MONSTER_DETECTION:
        case SPE_DETECT_MONSTERS: {
            const effect = await monsterDetection(source, state);
            ({ unknown, nothing } = effect);
            if (effect.result)
                result = 1;
            break;
        }
        case POT_OBJECT_DETECTION:
        case SPE_DETECT_TREASURE: {
            const detected = await detectObjects(source, { state });
            if (detected.result)
                result = 1;
            else
                await exerciseAttribute(A_WIS, true, state);
            break;
        }
        case POT_INVISIBILITY:
        case SPE_INVISIBILITY: {
            const effect = await applyPotionLikeInvisibility({ state,
                spell: source.otyp === SPE_INVISIBILITY,
                blessed: !!source.blessed, cursed: !!source.cursed });
            nothing = !effect.showedInvisibility && !effect.blocked;
            if (effect.aggravates)
                aggravateMonsters(state);
            break;
        }
        case POT_LEVITATION:
        case SPE_LEVITATION: {
            const effect = await applyLevitationPotion(source, { state });
            nothing = effect.nothingHappened;
            break;
        }
        case POT_HEALING:
            await pline(formatFeltMessage('better.', state));
            await healHero(8 + d(4 + 2 * blessing, 4), source.cursed ? 0 : 1, { state, cureSickness: !!source.blessed, cureBlindness: !source.cursed });
            await exerciseAttribute(A_CON, true, state);
            break;
        case POT_EXTRA_HEALING:
            await pline(formatFeltMessage('much better.', state));
            await healHero(16 + d(4 + 2 * blessing, 8), source.blessed ? 5 : source.cursed ? 0 : 2, { state, cureSickness: !source.cursed, cureBlindness: true });
            await makeHallucinated(0, { state });
            await exerciseAttribute(A_CON, true, state);
            await exerciseAttribute(A_STR, true, state);
            if (source.blessed && !state.u.usteed)
                await healHeroLegs(state);
            break;
        case POT_FULL_HEALING:
            await pline(formatFeltMessage('completely healed.', state));
            await healHero(400, 4 + 4 * blessing, { state, cureSickness: !source.cursed, cureBlindness: true });
            if (source.blessed && state.u.ulevel < state.u.ulevelmax) {
                state.u.ulevelmax--;
                await gainExperienceLevel({ state });
            }
            await makeHallucinated(0, { state });
            await exerciseAttribute(A_STR, true, state);
            await exerciseAttribute(A_CON, true, state);
            if (source.blessed || (!source.cursed && !state.u.usteed))
                await healHeroLegs(state);
            break;
        case POT_GAIN_ENERGY: {
            await pline(source.cursed ? formatFeltMessage('lackluster.', state) : 'Magical energies course through your body.');
            const amount = d(source.blessed ? 3 : source.cursed ? 1 : 2, 6) * (source.cursed ? -1 : 1);
            state.u.uenmax = Math.max(0, (state.u.uenmax || 0) + amount);
            state.u.uenpeak = Math.max(state.u.uenpeak || 0, state.u.uenmax);
            state.u.uen = Math.max(0, Math.min(state.u.uenmax, (state.u.uen || 0) + 3 * amount));
            state.context.botl = true;
            await exerciseAttribute(A_WIS, true, state);
            break;
        }
        default: {
            let effect = await applyPotionBodyEffect(source, { state });
            if (!effect.handled)
                effect = await applyPotionMentalEffect(source, { state });
            if (!effect.handled)
                throw new Error(`Unsupported potion effect ${source.otyp}`);
            unknown = effect.unknown || 0;
            nothing = !!effect.nothing;
        }
    }
    return { result, unknown, nothing, heroDied: !!state.program_state.gameover };
}
// ---- bottlename() (C potion.c:1488) ----
const ORDINARY_BOTTLE_NAMES = [
    'bottle', 'phial', 'flagon', 'carafe', 'flask', 'jar', 'vial',
];
const HALLUCINATED_BOTTLE_NAMES = [
    'jug', 'pitcher', 'barrel', 'tin', 'bag', 'box', 'glass', 'beaker',
    'tumbler', 'vase', 'flowerpot', 'pan', 'thingy', 'mug', 'teacup',
    'teapot', 'keg', 'bucket', 'thermos', 'amphora', 'wineskin', 'parcel',
    'bowl', 'ampoule',
];
// potion.c:bottlename() is shared by hero- and monster-thrown impacts.  The
// selector callback lets source-turn planners retain their own RNG ledger.
export function randomBottleName(state = game, select = rn2) {
    const names = heroIsHallucinating(state)
        ? HALLUCINATED_BOTTLE_NAMES : ORDINARY_BOTTLE_NAMES;
    const name = names[select(names.length)];
    if (name === undefined)
        throw new Error('Bottle name selection was outside its range.');
    return name;
}
export function potionImpactObjectName(potion, state = game) {
    return objectCombatName(potion, { state, includeCorpseSpecies: false });
}
// ---- H2Opotion_dip() (C potion.c:1498) ----
async function dipInWater(object, potion) {
    let action = null;
    let color = '';
    if (potion.blessed && object.cursed) {
        action = 'uncurse';
        color = 'amber';
    }
    else if (potion.blessed && !object.blessed) {
        action = 'bless';
        color = 'light blue';
    }
    else if (potion.cursed && object.blessed) {
        action = 'unbless';
        color = 'brown';
    }
    else if (potion.cursed && !object.cursed) {
        action = 'curse';
        color = 'black';
    }
    if (!potion.blessed && !potion.cursed) {
        let mentionedWater = false;
        const result = await waterDamageObject(object, [], game, {
            force: true, publish: pline, mentionWater: () => { mentionedWater = true; },
        });
        if (mentionedWater)
            learnObjectType(POT_WATER);
        return result !== 'nothing';
    }
    if (!action)
        return false;
    const seen = !heroIsBlind() || object === game.ublindf && blindfolded() && !heroIsBlinded();
    if (seen) {
        const glow = displayColorName(color);
        const suffix = action === 'bless' || action === 'curse'
            ? `with ${withIndefiniteArticle(glow)} aura` : glow;
        await pline(`${ownedObjectAction(object, 'glow')} ${suffix}.`);
        game._lastPlineKind = PLNMSG_OBJ_GLOWS;
        object.bknown = !heroIsHallucinating();
    }
    else if (!potion.bknown || !potion.dknown)
        object.bknown = false;
    if (object.unpaid && object.otyp === POT_WATER) {
        if (action === 'bless' || action === 'curse')
            updateUnpaidObjectPrice(object);
        else
            await chargeAlteredUnpaidObject(object, action);
    }
    if (action === 'curse') {
        await curseObject(object);
        await dropCursedSecondaryWeapon(object);
    }
    else {
        const oldRadius = objectLightRadius(object);
        if (action === 'bless')
            blessObjectState(object);
        else if (action === 'uncurse')
            uncurseObjectState(object);
        else
            unblessObjectState(object);
        if (object.lamplit)
            await adjustObjectLightAfterBlessing(object, oldRadius);
    }
    return true;
}
const PM_PESTILENCE = 312;
const PM_GREMLIN = 40;
const PM_IRON_GOLEM = 259;
const M1_BREATHLESS = 0x00000400;
const M1_NOEYES = 0x00001000;
const M1_NOHEAD = 0x00008000;
const M2_WERE = 0x00000004;
const MR_SLEEP = 0x04;
const S_MIMIC = 13;
export const INERT_MONSTER_POTION_TYPES = new Set([
    POT_GAIN_LEVEL,
    POT_ENLIGHTENMENT,
    POT_SEE_INVISIBLE,
    POT_GAIN_ENERGY,
    POT_LEVITATION,
    POT_FRUIT_JUICE,
    POT_HALLUCINATION,
    POT_MONSTER_DETECTION,
    POT_OBJECT_DETECTION,
]);
export const HEALING_MONSTER_POTION_TYPES = new Set([
    POT_GAIN_ABILITY,
    POT_RESTORE_ABILITY,
    POT_HEALING,
    POT_EXTRA_HEALING,
    POT_FULL_HEALING,
]);
export const SUPPORTED_MONSTER_POTION_TYPES = new Set([
    ...INERT_MONSTER_POTION_TYPES,
    ...HEALING_MONSTER_POTION_TYPES,
    POT_SICKNESS,
    POT_CONFUSION,
    POT_BOOZE,
    POT_PARALYSIS,
    POT_SLEEPING,
    POT_SPEED,
    POT_BLINDNESS,
    POT_INVISIBILITY,
    POT_WATER,
    POT_ACID,
    POT_OIL,
    POT_POLYMORPH,
]);
const ABILITY_POTION_TYPES = new Set([
    POT_GAIN_ABILITY, POT_RESTORE_ABILITY,
]);
const HEALING_POTION_TYPES = new Set([
    POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING,
]);
const CONFUSION_POTION_TYPES = new Set([POT_CONFUSION, POT_BOOZE]);
const HELPLESS_POTION_TYPES = new Set([POT_PARALYSIS, POT_SLEEPING]);
function sentenceSubject(monster) {
    const subject = monsterName(monster);
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)}`;
}
function potionHitsSaddle(monster, potion) {
    const saddle = monsterSaddle(monster);
    if (!saddle)
        return null;
    if (rn2(10) === 0)
        return saddle;
    if (potion.otyp !== POT_WATER)
        return null;
    // Keep potion.c's short-circuit order. Neutral water still consumes both
    // luck rolls before it reaches the final one-in-three chance.
    if (rnl(10) > 7 && potion.cursed)
        return saddle;
    if (rnl(10) < 4 && potion.blessed)
        return saddle;
    return rn2(3) === 0 ? saddle : null;
}
function saddleOwnerPhrase(monster, state) {
    const phrase = possessiveName(monsterName(monster, { state, suppressIt: true, suppressSaddle: true }));
    return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}`;
}
async function applyPotionToSaddle({ state, monster, saddle, potion, targetVisible, targetSpotted, publish, }) {
    const seen = !heroIsBlind(state) && targetVisible && targetSpotted;
    const owner = saddleOwnerPhrase(monster, state);
    const glowingSaddle = potion.otyp === POT_WATER
        ? `${owner} ${objectAction(saddle, 'glow', state)}` : '';
    let change = null;
    if (potion.otyp === POT_WATER && potion.blessed) {
        if (saddle.cursed) {
            change = { apply: () => uncurseObjectState(saddle), color: 'amber', aura: false };
        }
        else if (!saddle.blessed) {
            change = { apply: () => blessObjectState(saddle), color: 'light blue', aura: true };
        }
    }
    else if (potion.otyp === POT_WATER && potion.cursed) {
        if (saddle.blessed) {
            change = { apply: () => unblessObjectState(saddle), color: 'brown', aura: false };
        }
        else if (!saddle.cursed) {
            change = { apply: () => curseObjectState(saddle), color: 'black', aura: true };
        }
    }
    if (!change) {
        if (seen)
            await publish(`${owner} ${objectAction(saddle, 'get', state)} wet.`);
        return;
    }
    if (seen) {
        const color = displayColorName(change.color, state);
        const glow = change.aura ? `with ${withIndefiniteArticle(color)} aura` : color;
        await publish(`${glowingSaddle} ${glow}.`);
        state._lastPlineKind = PLNMSG_OBJ_GLOWS;
        saddle.bknown = !heroIsHallucinating(state);
    }
    else if (!potion.bknown || !potion.dknown) {
        saddle.bknown = false;
    }
    change.apply();
}
function healingCuresBlindness(potion) {
    if (potion.otyp === POT_FULL_HEALING)
        return true;
    if (potion.otyp === POT_EXTRA_HEALING)
        return !potion.cursed;
    return potion.otyp === POT_HEALING && !!potion.blessed;
}
function sicknessCannotHarmMonster(monster) {
    return monsterHasPoisonResistance(monster)
        || MONSTER_ATTACKS[monster?.mnum]?.some(attack => attack[1] === AD_DISE || attack[1] === AD_PEST);
}
// zap.c:resist() uses potion attack level 6 and the target's runtime level.
// NOTELL suppresses shield presentation but the resistance draw still occurs.
function monsterResistsPotion(monster, state = game) {
    const mnum = monster?.mnum;
    let defenseLevel = monster?.m_lev
        ?? MONSTER_LEVEL[mnum] ?? 1;
    if (defenseLevel < 1)
        defenseLevel = monsterIsPlayerMonster(mnum)
            ? state.u?.ulevel ?? 1 : 1;
    defenseLevel = Math.max(1, Math.min(50, defenseLevel));
    const resistanceRange = 100 + 6 - defenseLevel;
    return rn2(resistanceRange)
        < (MONSTER_MAGIC_RESISTANCE[mnum] ?? 0);
}
function monsterHasSleepDefense(monster) {
    const resistanceBits = (MONSTER_RESISTS[monster?.mnum] ?? 0)
        | (monster?.mextrinsics ?? 0) | (monster?.mintrinsics ?? 0);
    return !!(resistanceBits & MR_SLEEP)
        || !!monster?.defendedSleep;
}
function monsterIsWere(monster) {
    return !!((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_WERE);
}
// potion.c:potionhit() shares this exact pain/wake transaction between holy
// water and acid.  Silence selects writhing and suppresses wake_nearto(); an
// audible species wakes the level-scaled radius before any damage die.
// Monnam() also names sensed monsters and the hero's engulfer without sight.
async function publishPotionPainAndWakeRadius({ monster, wakeNearby, effectName, publish = plineWithContinuation, }) {
    const silent = (MONSTER_SOUND[monster.mnum] ?? 0) === 0;
    await publish(`${sentenceSubject(monster)} ${silent ? 'writhes' : 'shrieks'} in pain!`);
    if (!silent) {
        if (!wakeNearby)
            throw new Error(`${effectName} wake-radius owner unavailable`);
        await wakeNearby(monster.mx, monster.my, (MONSTER_LEVEL[monster.mnum] ?? 0) * 10);
    }
}
function wereTransformationNoun(monster) {
    if (!monsterIsHuman(monster?.mnum))
        return 'human';
    if (monster.mnum === 261)
        return 'rat';
    if (monster.mnum === 262)
        return 'jackal';
    return 'wolf';
}
function monsterSurvivedPotion(monster) {
    return !monster.dead && (monster.mhp ?? 0) > 0;
}
async function applySupportedDirectEffect({ state, monster, potion, targetVisible, targetSpotted, wakeMonster: wakeAttackedTarget, publish, showShield, spotMonster, repaintMonster, rememberInvisible, wakeNearby, splitMonster: splitMonsterHit, transformWere, finishKill, heroCaused, }) {
    // Most effects inherit potionhit's your_fault flag. Invisibility has
    // its own anger rule; polymorph delegates its contact to bhitm().
    const wakeMonster = heroCaused || potion.otyp === POT_INVISIBILITY || potion.otyp === POT_POLYMORPH
        ? wakeAttackedTarget : (target) => { target.msleeping = 0; };
    if (potion.otyp === POT_POLYMORPH) {
        const result = await polymorphMonsterFromMagic(monster, {
            state,
            targetSpotted,
            wakeMonster,
            publish,
            showShield,
            finishDeath: finishKill,
        });
        return {
            angered: heroCaused,
            healed: 0,
            curedBlindness: false,
            ...result,
        };
    }
    if (potion.otyp === POT_OIL) {
        let explosionDamage = 0;
        if (potion.lamplit) {
            const explosion = await explodeLitOilPotion(potion, monster.mx, monster.my, {
                state,
                // explode() attributes damage by the active turn.
                heroCaused: !state.context.mon_moving,
                publish,
            });
            if (explosion.heroDied)
                return { heroDied: true };
            explosionDamage = explosion.damage;
        }
        const killed = !monsterSurvivedPotion(monster);
        if (!killed && (await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: 0,
            curedBlindness: false,
            explosionDamage,
            killed,
        };
    }
    if (potion.otyp === POT_ACID) {
        const acidResistant = monsterHasAcidResistance(monster);
        const resisted = !acidResistant
            && monsterResistsPotion(monster, state);
        let acidDamage = 0;
        let killed = false;
        if (!acidResistant && !resisted) {
            await publishPotionPainAndWakeRadius({
                monster,
                wakeNearby,
                effectName: 'acid',
                publish,
            });
            acidDamage = d(potion.cursed ? 2 : 1, potion.blessed ? 4 : 8);
            monster.mhp -= acidDamage;
            killed = monster.mhp <= 0;
            if (killed && heroCaused) {
                if (!finishKill)
                    throw new Error('acid fatality owner unavailable');
                const death = await finishKill(monster);
                if (death.heroDied)
                    return { heroDied: true };
                killed = death.killed;
            }
            else if (killed) {
                // C monkilled(mon, "", AD_ACID) when the hero did not throw it.
                const death = await finishMonsterKilled(monster, state, {
                    damageType: AD_ACID, publish,
                });
                if (death.heroDied)
                    return { heroDied: true };
                killed = !death.survived;
            }
        }
        if (!killed && (await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: 0,
            curedBlindness: false,
            acidResistant,
            resisted,
            acidDamage,
            killed,
        };
    }
    if (potion.otyp === POT_WATER) {
        const affectedByHoliness = monsterHatesBlessings(monster)
            || monsterIsWere(monster);
        let angered = heroCaused;
        let waterDamage = 0;
        let waterHealing = 0;
        let transformedWere = false;
        let splitClone = null;
        let killed = false;
        if (affectedByHoliness) {
            if (potion.blessed) {
                await publishPotionPainAndWakeRadius({
                    monster,
                    wakeNearby,
                    effectName: 'water',
                    publish,
                });
                waterDamage = d(2, 6);
                monster.mhp -= waterDamage;
                killed = monster.mhp <= 0;
                if (killed) {
                    if (!finishKill)
                        throw new Error('water fatality owner unavailable');
                    const death = await finishKill(monster);
                    if (death.heroDied)
                        return { heroDied: true };
                    killed = death.killed;
                }
                else if (monsterIsWere(monster)
                    && !monsterIsHuman(monster?.mnum)) {
                    if (!transformWere)
                        throw new Error('water were-transform owner unavailable');
                    if (targetSpotted && !heroIsHallucinating(state)) {
                        await publish(`${sentenceSubject(monster)} changes into a ${wereTransformationNoun(monster)}.`);
                    }
                    transformedWere = !!await transformWere(monster, state);
                }
            }
            else if (potion.cursed) {
                angered = false;
                if (targetSpotted)
                    await publish(`${sentenceSubject(monster)} looks healthier.`);
                waterHealing = d(2, 6);
                monster.mhp = Math.min(monster.mhpmax ?? monster.mhp, monster.mhp + waterHealing);
                if (monsterIsWere(monster) && monsterIsHuman(monster?.mnum)
                    && !heroHasProtectionFromShapeChangers(state)) {
                    if (!transformWere)
                        throw new Error('water were-transform owner unavailable');
                    if (targetSpotted && !heroIsHallucinating(state)) {
                        await publish(`${sentenceSubject(monster)} changes into a ${wereTransformationNoun(monster)}.`);
                    }
                    transformedWere = !!await transformWere(monster, state);
                }
            }
        }
        else if (monster.mnum === PM_GREMLIN) {
            angered = false;
            if (!splitMonsterHit)
                throw new Error('water gremlin-split owner unavailable');
            splitClone = await splitMonsterHit(monster, state);
        }
        else if (monster.mnum === PM_IRON_GOLEM) {
            if (targetSpotted)
                await publish(`${sentenceSubject(monster)} rusts.`);
            waterDamage = d(1, 6);
            monster.mhp -= waterDamage;
            killed = monster.mhp <= 0;
            if (killed) {
                if (!finishKill)
                    throw new Error('water fatality owner unavailable');
                const death = await finishKill(monster);
                if (death.heroDied)
                    return { heroDied: true };
                killed = death.killed;
            }
        }
        if (!killed) {
            if (angered) {
                if ((await wakeMonster?.(monster))?.heroDied)
                    return { heroDied: true };
            }
            else
                monster.msleeping = 0;
        }
        return {
            angered,
            healed: waterHealing,
            curedBlindness: false,
            waterDamage,
            waterHealing,
            transformedWere,
            splitClone,
            killed,
        };
    }
    if (potion.otyp === POT_INVISIBILITY) {
        const sawIt = !!spotMonster(monster);
        const cursedPotion = !!potion.cursed;
        const angered = !!monster.minvis && cursedPotion;
        setMonsterPermanentInvisibility(monster, !cursedPotion);
        if (!monster.invis_blkd) {
            await repaintMonster(monster);
            if (monster.wormno)
                await redrawMonsterWormSegments(monster);
        }
        const spottedAfter = !!spotMonster(monster);
        let invisibilityMessage = null;
        let rememberedInvisible = false;
        if (sawIt && !spottedAfter) {
            if (targetVisible) {
                await rememberInvisible(monster);
                rememberedInvisible = true;
            }
        }
        else if (sawIt && cursedPotion) {
            invisibilityMessage = `${sentenceSubject(monster)} briefly seems `
                + 'to be transparent.';
            await publish(invisibilityMessage);
        }
        else if (!sawIt && spottedAfter) {
            invisibilityMessage = `${sentenceSubject(monster)} appears!`;
            await publish(invisibilityMessage);
        }
        if (angered) {
            if ((await wakeMonster?.(monster))?.heroDied)
                return { heroDied: true };
        }
        else
            monster.msleeping = 0;
        return {
            angered,
            healed: 0,
            curedBlindness: false,
            sawIt,
            spottedAfter,
            rememberedInvisible,
            invisibilityMessage,
        };
    }
    if (potion.otyp === POT_PARALYSIS) {
        let paralyzed = false;
        let duration = 0;
        if (!!monster.mcanmove) {
            duration = rnd(25);
            monster.mcanmove = 0;
            monster.mfrozen = Math.min(duration, 127);
            monster.meating = 0;
            monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
            paralyzed = true;
        }
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: 0,
            curedBlindness: false,
            paralyzed,
            duration,
        };
    }
    if (potion.otyp === POT_SLEEPING) {
        const duration = rnd(12);
        const appearance = M_AP_TYPE(monster);
        if (!monster.msleeping && !monster.mfrozen && MONSTER_SYMBOL[monster.mnum] === S_MIMIC
            && (appearance === M_AP_FURNITURE || appearance === M_AP_OBJECT))
            await revealMonsterAppearance(monster);
        const inherentOrDefended = monsterHasSleepDefense(monster);
        const resisted = inherentOrDefended
            || monsterResistsPotion(monster, state);
        let slept = false;
        if (resisted) {
            await showShield?.(monster);
        }
        else if (await putMonsterToSleep(monster, duration)) {
            slept = true;
            await publish(`${sentenceSubject(monster)} falls asleep.`);
            if (monster === state.u?.ustuck && !state.u?.uswallow
                && !heroFormSticks(state)) {
                await publish(`${possessiveName(sentenceSubject(monster))} grip relaxes.`);
                // C potionhit() calls slept_monst(), which uses unstuck().
                await releaseHeroFromMonster(monster, { state, publish });
            }
        }
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: 0,
            curedBlindness: false,
            resisted,
            slept,
            duration,
        };
    }
    if (potion.otyp === POT_SPEED) {
        const speed = adjustMonsterSpeed(monster, 1);
        const speedMessage = targetSpotted
            ? monsterSpeedMessage(speed, sentenceSubject(monster))
            : null;
        if (speedMessage)
            await publish(speedMessage);
        monster.msleeping = 0;
        return {
            angered: false,
            healed: 0,
            curedBlindness: false,
            oldSpeed: speed.oldSpeed,
            speed: speed.speed,
            speedChanged: speed.changed,
            speedMessage,
        };
    }
    if (potion.otyp === POT_BLINDNESS) {
        const hasEyes = !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES);
        const permanentlyBlind = (monster.mcansee === 0
            || monster.mcansee === false) && !(monster.mblinded ?? 0);
        const before = monster.mblinded ?? 0;
        let resisted = false;
        let blinded = false;
        let blindnessDuration = 0;
        if (hasEyes && !permanentlyBlind) {
            const firstDuration = rn2(32);
            const secondDuration = rn2(32);
            resisted = monsterResistsPotion(monster, state);
            blindnessDuration = 64 + firstDuration
                + (resisted ? 0 : secondDuration);
            monster.mblinded = Math.min(127, before + blindnessDuration);
            monster.mcansee = 0;
            blinded = true;
        }
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: 0,
            curedBlindness: false,
            resisted,
            blinded,
            blindnessDuration,
            blindnessAdded: (monster.mblinded ?? before) - before,
        };
    }
    if (CONFUSION_POTION_TYPES.has(potion.otyp)) {
        const resisted = monsterResistsPotion(monster, state);
        if (!resisted)
            monster.mconf = 1;
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: 0,
            curedBlindness: false,
            resisted,
            confused: !resisted,
        };
    }
    if (potion.otyp === POT_SICKNESS && monster.mnum !== PM_PESTILENCE) {
        const oldHp = monster.mhp;
        if (sicknessCannotHarmMonster(monster)) {
            if (targetSpotted)
                await publish(`${sentenceSubject(monster)} looks unharmed.`);
        }
        else if (monster.mhp > 2) {
            monster.mhp = Math.trunc(monster.mhp / 2);
            if (targetSpotted)
                await publish(`${sentenceSubject(monster)} looks rather ill.`);
        }
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: monster.mhp - oldHp,
            curedBlindness: false,
        };
    }
    const healsMonster = HEALING_MONSTER_POTION_TYPES.has(potion.otyp)
        || (potion.otyp === POT_SICKNESS
            && monster.mnum === PM_PESTILENCE);
    if (!healsMonster) {
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return { angered: heroCaused, healed: 0, curedBlindness: false };
    }
    // Healing potions invert against Pestilence; gain/restore ability do not.
    if (monster.mnum === PM_PESTILENCE
        && HEALING_POTION_TYPES.has(potion.otyp)) {
        const oldHp = monster.mhp;
        if (monster.mhp > 2) {
            monster.mhp = Math.trunc(monster.mhp / 2);
            if (targetSpotted)
                await publish(`${sentenceSubject(monster)} looks rather ill.`);
        }
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return {
            angered: heroCaused,
            healed: monster.mhp - oldHp,
            curedBlindness: false,
        };
    }
    const oldHp = monster.mhp;
    if (monster.mhp < monster.mhpmax) {
        monster.mhp = monster.mhpmax;
        if (targetSpotted)
            await publish(`${sentenceSubject(monster)} looks sound and hale again.`);
    }
    let curedBlindness = false;
    if (healingCuresBlindness(potion) && !monster.mcansee) {
        monster.mcansee = 1;
        monster.mblinded = 0;
        curedBlindness = true;
        if (targetSpotted
            && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)) {
            await publish(`${sentenceSubject(monster)} can see again.`);
        }
    }
    monster.msleeping = 0;
    return {
        angered: false,
        healed: monster.mhp - oldHp,
        curedBlindness,
    };
}
export async function hitMonsterWithSupportedPotion({ state = game, monster, potion, wakeMonster = null, publish = plineWithContinuation, targetVisible = cansee(monster?.mx, monster?.my), targetSpotted = canSeeMonster(monster), spotMonster = target => canSpotMonster(target), repaintMonster = async (target) => await newsym(target.mx, target.my), rememberInvisible = async (target) => await map_invisible(target.mx, target.my), wakeNearby = null, splitMonster: splitMonsterHit = target => splitMonster(target, state, { publish }), transformWere = target => transformWereMonster(target, state), finishKill = null, showShield = target => shieldeff(target.mx, target.my, state), heroCaused = true, resolveVapor = false, distance = 0, target = { x: monster.mx, y: monster.my }, }) {
    if (!monster || !potion
        || !SUPPORTED_MONSTER_POTION_TYPES.has(potion.otyp))
        return null;
    const bottleName = randomBottleName(state);
    const saddle = potionHitsSaddle(monster, potion);
    const hasHead = !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOHEAD);
    let crashMessage = 'Crash!';
    if (targetVisible) {
        const name = monsterName(monster, { state });
        const onHead = target.x === monster.mx && target.y === monster.my;
        const impactTarget = saddle
            ? `${possessiveName(monsterName(monster, { state, suppressIt: true, suppressSaddle: true }))} saddle`
            : hasHead ? `${possessiveName(name)} ${onHead ? 'head' : 'body'}` : name;
        crashMessage = `The ${bottleName} crashes on ${impactTarget} and breaks into shards.`;
    }
    await publish(crashMessage);
    const impactRoll = rn2(5);
    const impactDamage = !saddle && impactRoll !== 0 && monster.mhp > 1
        ? 1 : 0;
    if (impactDamage)
        monster.mhp--;
    let evaporationMessage = null;
    if (targetVisible && potion.otyp !== POT_OIL && !saddle) {
        evaporationMessage = `${definiteObjectAction(potion, 'evaporate', state)}.`;
        await publish(evaporationMessage);
    }
    if (saddle) {
        await applyPotionToSaddle({
            state, monster, saddle, potion,
            targetVisible, targetSpotted, publish,
        });
    }
    const directEffect = saddle ? null : await applySupportedDirectEffect({
        state, monster, potion, targetVisible, targetSpotted, wakeMonster,
        publish,
        showShield,
        spotMonster,
        repaintMonster,
        rememberInvisible,
        wakeNearby,
        splitMonster: splitMonsterHit,
        transformWere,
        finishKill,
        heroCaused,
    });
    if (directEffect?.heroDied)
        return {
            heroDied: true, bottleName, crashMessage, evaporationMessage,
            impactDamage, directEffect,
        };
    let breathedVapor = false;
    let vaporEffect = null;
    if (resolveVapor) {
        breathedVapor = distance === 0;
        if (!breathedVapor && distance > 0 && distance < 3) {
            breathedVapor = rn2(Math.trunc((1 + currentAttribute(A_DEX, state)) / 2)) === 0;
        }
        if (breathedVapor) {
            vaporEffect = await applySupportedPotionVapor({
                state, potion, publish,
            });
            breathedVapor = vaporEffect.received;
        }
    }
    let typeCall = vaporEffect?.typeCall || null;
    if (!breathedVapor && targetVisible)
        typeCall = await tryCallObjectType(potion, state);
    await chargeUnpaidObjectAsDebt(potion, state, publish);
    await deleteObject(potion, state);
    return {
        bottleName,
        crashMessage,
        evaporationMessage,
        impactDamage,
        directEffect,
        breathedVapor,
        vaporEffect,
        typeCall,
    };
}
// ---- potionbreathe() (C potion.c:1932) ----
function healHeroOnePoint(state) {
    const hero = state.u;
    if (Upolyd(hero) && hero.mh < hero.mhmax) {
        hero.mh++;
        state.context.botl = true;
    }
    if (hero.uhp < hero.uhpmax) {
        hero.uhp++;
        state.context.botl = true;
    }
}
function restoreBaseAttributes(state, potion) {
    const base = state.u?.acurr?.a;
    const maximum = state.u?.amax?.a;
    const start = rn2(6);
    if (!Array.isArray(base) || !Array.isArray(maximum))
        return start;
    for (let offset = 0; offset < 6; offset++) {
        const index = (start + offset) % 6;
        if ((base[index] ?? 0) < (maximum[index] ?? 0)) {
            const current = base[index];
            if (current === undefined)
                throw new Error(`Missing hero attribute ${index}`);
            base[index] = current + 1;
            state.context.botl = true;
            if (!potion.blessed)
                break;
        }
    }
    return start;
}
export function heroPotionVaporProfile(state) {
    const mnum = Number.isInteger(state.u?.umonnum)
        ? state.u.umonnum
        : Number.isInteger(state.u?.umonster) ? state.u.umonster : null;
    const flags = typeof mnum === 'number' && Number.isInteger(mnum) ? MONSTER_FLAGS1[mnum] ?? 0 : 0;
    const breathless = !!(flags & M1_BREATHLESS);
    const hasEyes = !(flags & M1_NOEYES);
    return { breathless, hasEyes, canReceive: !breathless || hasEyes };
}
function heroHasVaporShield(state) {
    const eyewear = state.ublindf || state.u?.ublindf;
    return eyewear?.otyp === TOWEL && (eyewear.spe ?? 0) > 0;
}
async function installPotionHelplessness(state, duration, reason) {
    // nomul() keeps a longer involuntary delay. The caller still replaces
    // its reason and recovery message, even when nomul() returns early.
    nomul(-duration, state);
    state._helplessReason = reason;
    state._helplessDoneMessage = 'You can move again.';
    await exerciseAttribute(A_DEX, false, state);
}
function heroIsFast(state) {
    return !!(state.u?.fast || state.u?.veryFast
        || state.u?.veryFastFromArmor
        || (state.u?.veryFastTurns ?? 0) > 0);
}
function heroSeesInvisible(state) {
    const hero = state.u;
    return !!(hero.seeInvisible
        || (hero.seeInvisibleTurns ?? 0) > 0);
}
async function finishPotionVaporKnowledge(state, potion, identifiesType) {
    if (potion.dknown === false)
        return null;
    if (identifiesType) {
        if (!objectTypeKnown(potion, state)) {
            // makeknown()->discover_object(..., credit_hero=TRUE)
            await exerciseAttribute(A_WIS, true, state);
            recordObjectKnowledge(potion.otyp, state);
            recordObjectEncounter(potion.otyp, state);
        }
        return { identified: true, prompted: false };
    }
    return await tryCallObjectType(potion, state);
}
function cursedVaporEyeMessage(state) {
    const eye = heroEyeName(state);
    const eyes = heroEyeCount(state) === 1 ? eye : makePlural(eye);
    return `Your ${eyes} ${verbForSubject(eyes, 'sting')}!`;
}
// potionbreathe() is shared by monster contact and nearby floor breakage.
// Its final knowledge transaction either identifies an unambiguous effect or
// asks for a type-wide call name before the caller frees the potion identity.
// Potions without a vapor effect still reach that naming opportunity.
export async function applySupportedPotionVapor(options) {
    const potion = options.potion;
    const inUse = potion.in_use;
    potion.in_use = true;
    let effect;
    try {
        effect = await applyPotionVaporEffect(options);
    }
    finally {
        if (inUse === undefined)
            delete potion.in_use;
        else
            potion.in_use = inUse;
    }
    if (!effect.received)
        return effect;
    const typeCall = await finishPotionVaporKnowledge(options.state ?? game, potion, effect.identifiesType ?? false);
    return { ...effect, typeCall };
}
async function applyPotionVaporEffect({ state = game, potion, publish = plineWithContinuation, monsterCanSeeHero = null, }) {
    requirePlayingGame(state);
    const profile = heroPotionVaporProfile(state);
    if (!profile.canReceive)
        return { received: false };
    if (heroHasVaporShield(state)) {
        await publish('Some vapor passes harmlessly around you.');
        return { received: true, shielded: true };
    }
    let abilityStart = null;
    let confusionDuration = null;
    let helplessDuration = null;
    let speedDuration = null;
    let blindnessDuration = null;
    let invisibilityGlimpse = null;
    let waterEffect = null;
    let sightToggled = false;
    let resisted = false;
    let identifiesType = false;
    if (ABILITY_POTION_TYPES.has(potion.otyp)) {
        if (potion.cursed) {
            await publish(profile.breathless
                ? cursedVaporEyeMessage(state)
                : 'Ulch!  That potion smells terrible!');
        }
        else {
            abilityStart = restoreBaseAttributes(state, potion);
        }
    }
    else if (HEALING_POTION_TYPES.has(potion.otyp)) {
        const points = potion.otyp === POT_FULL_HEALING ? 3
            : potion.otyp === POT_EXTRA_HEALING ? 2 : 1;
        for (let point = 0; point < points; point++)
            healHeroOnePoint(state);
        if (healingCuresBlindness(potion)) {
            await makeBlinded(0, { state, talk: !state.u.ucreamed, publish });
            await makeDeaf(0, { state, publish });
        }
        await exerciseAttribute(A_CON, true, state);
    }
    else if (potion.otyp === POT_SICKNESS
        && state.urole?.key !== 'healer') {
        const hero = state.u;
        if (Upolyd(hero))
            hero.mh = (hero.mh ?? 0) <= 5 ? 1 : hero.mh - 5;
        else
            hero.uhp = (hero.uhp ?? 0) <= 5 ? 1 : hero.uhp - 5;
        state.context.botl = true;
        await exerciseAttribute(A_CON, false, state);
    }
    else if (potion.otyp === POT_HALLUCINATION) {
        await publish('You have a momentary vision.');
    }
    else if (CONFUSION_POTION_TYPES.has(potion.otyp)) {
        const hero = state.u;
        if ((hero.confusionTurns ?? 0) <= 0)
            await publish(formatFeltMessage('somewhat dizzy.', state));
        confusionDuration = rnd(5);
        await makeConfused((hero.confusionTurns ?? 0) + confusionDuration, {
            state, talk: false, publish,
        });
    }
    else if (HELPLESS_POTION_TYPES.has(potion.otyp)) {
        identifiesType = true;
        const freeAction = heroHasFreeAction(state);
        const sleepResistance = !!state.u.sleepResistance;
        const protectedFromEffect = freeAction
            || (potion.otyp === POT_SLEEPING && sleepResistance);
        if (protectedFromEffect) {
            resisted = true;
            await publish(potion.otyp === POT_PARALYSIS
                ? 'You stiffen momentarily.' : 'You yawn.');
            if (potion.otyp === POT_SLEEPING) {
                monstersObserveHeroResistance(M_SEEN_SLEEP, state, monsterCanSeeHero);
            }
        }
        else {
            await publish(potion.otyp === POT_PARALYSIS
                ? 'Something seems to be holding you.'
                : formatFeltMessage('rather tired.', state));
            helplessDuration = rnd(5);
            await installPotionHelplessness(state, helplessDuration, potion.otyp === POT_PARALYSIS
                ? 'frozen by a potion'
                : 'sleeping off a magical draught');
        }
    }
    else if (potion.otyp === POT_SPEED) {
        const hero = state.u;
        if (!heroIsFast(state))
            await publish('Your knees seem more flexible now.');
        speedDuration = rnd(5);
        hero.veryFastTurns = Math.min(TIMEOUT, Math.max(0, hero.veryFastTurns ?? 0) + speedDuration);
        hero.veryFast = true;
        await exerciseAttribute(A_DEX, true, state);
    }
    else if (potion.otyp === POT_BLINDNESS) {
        const hero = state.u;
        const wasBlind = heroIsBlind(state);
        const unaware = heroIsUnaware(state);
        identifiesType = !wasBlind && !unaware;
        if (!wasBlind && !unaware)
            await publish('It suddenly gets dark.');
        blindnessDuration = rnd(5);
        await makeBlinded((hero.blindTurns ?? 0) + blindnessDuration, {
            state, talk: false, publish,
        });
        const blindNow = heroIsBlind(state);
        sightToggled = wasBlind !== blindNow;
        if (!blindNow && !unaware)
            await publish('Your vision clears.');
    }
    else if (potion.otyp === POT_INVISIBILITY) {
        if (!heroIsBlind(state) && !heroIsInvisible(state)) {
            identifiesType = true;
            invisibilityGlimpse = heroSeesInvisible(state)
                ? 'transparent' : 'unseen';
            await publish(invisibilityGlimpse === 'transparent'
                ? 'For an instant you could see right through yourself!'
                : "For an instant you couldn't see yourself!");
        }
    }
    else if (potion.otyp === POT_WATER) {
        waterEffect = await applyHeroWaterVaporChange({
            state, potion, publish,
        });
    }
    else if ([POT_ACID, POT_POLYMORPH].includes(potion.otyp)) {
        await exerciseAttribute(A_CON, false, state);
    }
    else if (potion.otyp === POT_OIL) {
        // potionbreathe() has no oil case.
    }
    return {
        received: true,
        abilityStart,
        confusionDuration,
        helplessDuration,
        speedDuration,
        blindnessDuration,
        invisibilityGlimpse,
        waterEffect,
        sightToggled,
        resisted,
        identifiesType,
    };
}
// ---- mixtype() (C potion.c:2122) ----
const AMETHYST = OBJECT_NAMES.indexOf('amethyst');
function potionColor(potion) {
    return displayColorName(game.objectDescriptions?.[potion.otyp] ?? OBJECT_DESCRIPTIONS[potion.otyp]);
}
function mixtureType(first, second) {
    let left = first.otyp, right = second.otyp;
    if (first.oclass === 8 && [POT_GAIN_LEVEL, POT_GAIN_ENERGY, POT_HEALING, POT_EXTRA_HEALING,
        POT_FULL_HEALING, POT_ENLIGHTENMENT, POT_FRUIT_JUICE].includes(right)) {
        left = second.otyp;
        right = first.otyp;
    }
    switch (left) {
        case POT_HEALING:
            if (right === POT_SPEED)
                return POT_EXTRA_HEALING;
            // Healing also follows the higher-healing and horn recipes below.
            break;
        case POT_GAIN_LEVEL:
        case POT_GAIN_ENERGY:
            switch (right) {
                case POT_CONFUSION: return rn2(3) ? POT_BOOZE : POT_ENLIGHTENMENT;
                case POT_HEALING: return POT_EXTRA_HEALING;
                case POT_EXTRA_HEALING: return POT_FULL_HEALING;
                case POT_FULL_HEALING: return POT_GAIN_ABILITY;
                case POT_FRUIT_JUICE: return POT_SEE_INVISIBLE;
                case POT_BOOZE: return POT_HALLUCINATION;
                default: return null;
            }
        case POT_FRUIT_JUICE:
            switch (right) {
                case POT_SICKNESS: return POT_SICKNESS;
                case POT_ENLIGHTENMENT:
                case POT_SPEED: return POT_BOOZE;
                case POT_GAIN_LEVEL:
                case POT_GAIN_ENERGY: return POT_SEE_INVISIBLE;
                default: return null;
            }
        case POT_ENLIGHTENMENT:
            if (right === POT_LEVITATION)
                return rn2(3) ? POT_GAIN_LEVEL : null;
            if (right === POT_FRUIT_JUICE)
                return POT_BOOZE;
            if (right === POT_BOOZE)
                return POT_CONFUSION;
            return null;
        case AMETHYST: return right === POT_BOOZE ? POT_FRUIT_JUICE : null;
        case POT_EXTRA_HEALING:
        case POT_FULL_HEALING:
        case UNICORN_HORN: break;
        default: return null;
    }
    if (left !== UNICORN_HORN && (right === POT_GAIN_LEVEL || right === POT_GAIN_ENERGY)) {
        return left === POT_HEALING ? POT_EXTRA_HEALING
            : left === POT_EXTRA_HEALING ? POT_FULL_HEALING : POT_GAIN_ABILITY;
    }
    if (right === POT_SICKNESS)
        return POT_FRUIT_JUICE;
    return [POT_HALLUCINATION, POT_BLINDNESS, POT_CONFUSION].includes(right) ? POT_WATER : null;
}
// ---- dip_ok()/dip_hands_ok() (C potion.c:2214-2242) ----
// C dip_ok() downplays hands; dip_hands_ok() suggests them instead when
// slippery hands could be washed in the water source here.
async function chooseDipTarget(verb, floorWater = true) {
    requirePlayingGame(game);
    const location = game.level.requireAt(game.u.ux, game.u.uy);
    const atHere = floorWater && !game.iflags.menu_requested && (location.typ === FOUNTAIN
        || location.typ === SINK || isPoolAt(game.u.ux, game.u.uy));
    const handsSuggested = atHere && !!game.u.glibTurns && heroCanReachFloor(game);
    const selection = await getobj(verb, dipClassification, {
        forcePrompt: true, hands: handsSuggested ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY,
        handsText: `your ${makePlural(heroHandName())}`,
    });
    return selection.none ? 'hands' : selection.object;
}
function dipClassification(object) {
    if (object.oclass === 12)
        return GETOBJ_EXCLUDE;
    return coveringEquipment(object).length ? GETOBJ_EXCLUDE_INACCESS : GETOBJ_SUGGEST;
}
function potionClassification(object) {
    return object.oclass === 8 ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE;
}
// ---- hold_potion() (C potion.c:2243) ----
async function holdPotion(potion, dropPrefix) {
    const burden = game.flags.pickup_burden;
    game.flags.pickup_burden = Math.max(nearCapacity(game), pickupBurden(game));
    const description = await inventoryItemDescription(potion);
    unlinkObject(potion);
    try {
        await holdAnotherObject(potion, { dropMessage: `${dropPrefix} ${description}!` });
    }
    finally {
        if (burden === undefined)
            delete game.flags.pickup_burden;
        else
            game.flags.pickup_burden = burden;
    }
}
// ---- dodip()/dip_into() (C potion.c:2267-2406) ----
export async function dip({ fountain, }) {
    requirePlayingGame(game);
    const object = await chooseDipTarget('dip');
    if (!object) {
        game.context.move = 0;
        return 'cancelled';
    }
    if (object !== 'hands' && await reportCoveredEquipment(object)) {
        game.context.move = 0;
        return;
    }
    const location = game.level.requireAt(game.u.ux, game.u.uy);
    let declinedSource = false;
    const description = object === 'hands' ? `your ${makePlural(heroHandName())}` : await dipTargetDescription(object);
    const target = game.flags.verbose ? description : dipTargetPronoun(object);
    if (!game.iflags.menu_requested && heroCanReachFloor(game) && location.typ === FOUNTAIN) {
        if (await promptYesNo(`Dip ${target} into the fountain?`, 'n') === 'y') {
            if (object !== 'hands')
                object.pickup_prev = false;
            await fountain(object, location);
            game.context.move = 1;
            return;
        }
        declinedSource = true;
    }
    if (!game.iflags.menu_requested && heroCanReachFloor(game)
        && (location.typ === SINK || isPoolAt(game.u.ux, game.u.uy))) {
        const source = location.typ === SINK ? 'sink' : waterbodyName(game.u.ux, game.u.uy);
        if (await promptYesNo(`Dip ${target} into the ${source}?`, 'n') === 'y') {
            if (location.typ !== SINK && propertyIsActive('levitation')) {
                await floatingAbove(source);
                game.context.move = 1;
                return;
            }
            if (object !== 'hands')
                object.pickup_prev = false;
            if (location.typ === SINK)
                await dipSink(object);
            else if (object === 'hands' || object === game.uarmg)
                await washHands();
            else {
                if (object.otyp === POT_ACID)
                    object.in_use = true;
                const result = await waterDamageObject(object, [], game, { force: true, publish: pline });
                if (result !== 'destroyed' && object.in_use)
                    await consumeInventoryItem(object);
            }
            game.context.move = 1;
            return;
        }
        declinedSource = true;
    }
    // drink_ok() reports a declined floor source as GETOBJ_EXCLUDE_NONINVENT.
    const potion = await chooseInventoryObject(`dip ${target} into`, potionClassification, {
        hands: declinedSource ? GETOBJ_EXCLUDE_NONINVENT : GETOBJ_EXCLUDE,
    });
    if (!potion) {
        game.context.move = 0;
        return 'cancelled';
    }
    game.context.move = Number(await finishDip(object, potion));
}
function dipTargetPronoun(object) {
    if (object === 'hands')
        return 'them';
    const slot = object.oclass === 3 ? armorSlotFor(object.otyp) : null;
    return objectNameIsPlural(object) || object.otyp === LENSES
        || slot === 'uarmg' || slot === 'uarmf' ? 'them' : 'it';
}
// C potion.c:dodip() formats the item once with short_oname(doname,
// thesimpleoname), reserving its fixed worst-case prompt. The reserved text
// is "What do you want to dip into? [abdeghjkmnpqstvwyzBCEFHIKLNOQRTUWXZ#-#
// or ?*] " whose trailing blank and NUL leave 50 characters for the item.
const DIP_PROMPT_RESERVE = 77;
async function dipTargetDescription(object) {
    observeObjectForNaming(object);
    return await objectQuestion(object, {
        prefix: '', suffix: '', reserve: DIP_PROMPT_RESERVE,
        // objectQuestion() retries with the call name truncated to
        // "abcdefgh..." through this state; doname must format from it.
        format: async (item, state) => await objectDescription(item, { state }),
        shortFormat: (item, state) => definiteName(simpleObjectName(item, state), state),
    });
}
// C potion.c:dodip(): the command entry over the shared dip transaction.
export async function dodip() {
    if (await dip({ fountain: dipFountain }) === 'cancelled')
        commandResultCancelled();
}
export async function dipInto() {
    if (peekCommandResponse() === undefined) {
        // C potion.c:dip_into() refuses to run without the item-action
        // potion letter queued in CQ_CANNED. A ^A do-again replay pops
        // dip_into from CQ_REPEAT while CQ_CANNED is empty, so the
        // replayed dip can never proceed.
        await impossible('dip_into: where is potion?');
        commandResultFailed();
        game.context.move = 0;
        return;
    }
    const potion = await chooseInventoryObject('dip', potionClassification);
    if (!potion) {
        // potion.c:dip_into() returns ECMD_CANCEL when the potion getobj()
        // is declined.
        commandResultCancelled();
        game.context.move = 0;
        return;
    }
    const name = simpleObjectName(potion);
    const object = await chooseDipTarget(`dip into ${objectQuantity(potion) > 1 ? 'one of ' : ''}the ${name}`, false);
    if (!object || object !== 'hands' && await reportCoveredEquipment(object)) {
        // A declined dip target is ECMD_CANCEL; covered equipment keeps
        // potion.c's ECMD_OK.
        if (!object)
            commandResultCancelled();
        game.context.move = 0;
        return;
    }
    game.context.move = Number(await finishDip(object, potion));
}
// ---- poof()/dip_potion_explosion()/potion_dip() (C potion.c:2407-2795) ----
async function poof(potion) {
    if (potion.dknown)
        await tryCallObjectType(potion);
    await consumeInventoryItem(potion);
}
async function mixtureExplodes(object, damage) {
    if (!(object.cursed || object.otyp === POT_ACID || object.otyp === POT_OIL && object.lamplit
        || !rn2(game.uarmc?.otyp === ALCHEMY_SMOCK ? 30 : 10)))
        return false;
    object.in_use = true;
    await pline(`${heroIsDeaf() ? '' : 'BOOM!  '}They explode!`);
    await wakeMonstersNearWithMessages(game.u.ux, game.u.uy, (BOLT_LIM + 1) * (BOLT_LIM + 1));
    await exerciseAttribute(A_STR, false);
    if (heroPotionVaporProfile(game).canReceive)
        await applySupportedPotionVapor({ potion: object });
    await useUpInventoryStack(object);
    await loseHeroHp(damage, 'alchemic blast');
    return true;
}
export async function treatDippedObject(object, potion) {
    requirePlayingGame(game);
    if (object === potion && objectQuantity(potion) === 1) {
        await pline('That is a potion bottle, not a Klein bottle!');
        return false;
    }
    object.pickup_prev = false;
    potion.in_use = true;
    if (potion.otyp === POT_WATER) {
        if (await dipInWater(object, potion)) {
            await poof(potion);
            return true;
        }
    }
    else if (object.otyp === POT_POLYMORPH || potion.otyp === POT_POLYMORPH) {
        await dipInPolymorph(object, potion);
        return true;
    }
    else if (object.oclass === 8 && object.otyp !== potion.otyp) {
        await mixPotions(object, potion);
        return true;
    }
    if (potion.otyp === POT_ACID && object.otyp === CORPSE
        && object.corpsenm === MONSTER_NAME.indexOf('lichen')) {
        const color = heroIsBlind() ? 'wrinkled' : displayColorName(potion.odiluted ? 'orange' : 'red');
        await pline(`The ${objectCombatName(object)} ${objectNameIsPlural(object) ? 'turn' : 'turns'} ${color} around the edges.`);
        potion.in_use = false;
        if (potion.dknown)
            await tryCallObjectType(potion);
        return true;
    }
    if (potion.otyp === POT_WATER && object.otyp === TOWEL) {
        await pline('The towel soaks it up!');
        await poof(potion);
        return true;
    }
    if (isPoisonableObject(object)) {
        if (potion.otyp === POT_SICKNESS && !object.opoisoned) {
            const source = objectQuantity(potion) > 1 ? `One of the ${objectCombatName(potion)}`
                : `The ${objectCombatName(potion)}`;
            await pline(`${source} forms a coating on the ${objectCombatName(object)}.`);
            object.opoisoned = true;
            await poof(potion);
            return true;
        }
        if (object.opoisoned && !isPermanentlyPoisonedObject(object)
            && [POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING].includes(potion.otyp)) {
            await pline(`A coating wears off the ${objectCombatName(object)}.`);
            object.opoisoned = false;
            await poof(potion);
            return true;
        }
    }
    if (potion.otyp === POT_ACID) {
        const erosion = await erodeObject(object, 'corrosion', {
            displayName: objectCombatName(object),
        });
        if (erosion !== 'nothing') {
            await poof(potion);
            return true;
        }
    }
    if (potion.otyp === POT_OIL) {
        if (await dipInOil(object, potion))
            return true;
        if (object.otyp === OIL_LAMP || object.otyp === MAGIC_LAMP) {
            await fillLamp(object, potion);
            return true;
        }
    }
    potion.in_use = false;
    if (await neutralizePotion(object, potion))
        return true;
    await pline('Interesting...');
    return true;
}
async function dipInPolymorph(object, potion) {
    if (obj_unpolyable(object.otyp === POT_POLYMORPH ? potion : object)) {
        await pline('Nothing happens.');
        potion.in_use = false;
        return;
    }
    const conduct = game.u.uconduct ??= {};
    if (!conduct.polypiles)
        recordGameLogEvent(`polymorphed ${game.flags.female ? 'her' : 'his'} first item`, { flags: LL_CONDUCT });
    conduct.polypiles = (conduct.polypiles ?? 0) + 1;
    const oldType = object.otyp;
    const replacement = await poly_obj(object);
    if (!replacement) {
        learnObjectType(POT_POLYMORPH);
        return;
    }
    if (replacement.otyp !== oldType) {
        learnObjectType(POT_POLYMORPH);
        await consumeInventoryItem(potion);
        // C prinv() formats with doname(), whose xname() observes the
        // polymorphed item's new appearance before naming it.
        observeObjectForNaming(replacement);
        await pline(`${replacement.invlet} - ${await inventoryItemDescription(replacement)}.`);
    }
    else {
        await pline('Nothing seems to happen.');
        await poof(potion);
    }
}
async function finishDip(object, potion) {
    if (object !== 'hands')
        return treatDippedObject(object, potion);
    await pline(`You can't fit your ${heroHandName()} into the mouth of the bottle!`);
    return false;
}
export async function mixPotions(object, potion) {
    requirePlayingGame(game);
    const mixture = mixtureType(object, potion);
    const magic = mixture ? OBJECT_MAGIC[mixture]
        : OBJECT_MAGIC[object.otyp] || OBJECT_MAGIC[potion.otyp];
    const count = objectQuantity(object);
    let amount = count;
    if (count > (object.odiluted ? 2 : magic ? 3 : 7)) {
        amount = object.odiluted ? 2 : magic ? rnd(Math.min(count, 8) - 2) + 2 : rnd(count - 6) + 6;
    }
    let prefix = 'The';
    if (amount < count) {
        const split = splitObjectStack(object, amount);
        if (!split)
            throw new Error(`Cannot dip ${amount} bottles from a stack of ${count}`);
        object = split;
        prefix = `${amount} of the`;
    }
    await pline(`${prefix} ${simpleObjectName(object)} ${amount === 1 ? 'mixes' : 'mix'} with ${objectQuantity(potion) > 1 ? 'one of ' : ''}the ${simpleObjectName(potion)}...`);
    await consumeInventoryItem(potion);
    if (await mixtureExplodes(object, amount + rnd(9)))
        return;
    object.blessed = false;
    object.cursed = false;
    object.buc = 'uncursed';
    object.bknown = false;
    if (heroIsBlind() || heroIsHallucinating())
        object.dknown = false;
    if (mixture)
        object.otyp = mixture;
    else {
        switch (object.odiluted ? 1 : rnd(8)) {
            case 1:
                object.otyp = POT_WATER;
                break;
            case 2:
            case 3:
                object.otyp = POT_SICKNESS;
                break;
            case 4: {
                const randomPotion = await mkobj(8, false);
                object.otyp = randomPotion.otyp;
                if (object.otyp === POT_OIL)
                    object.age = randomPotion.age;
                await deleteObject(randomPotion);
                break;
            }
            default:
                await useUpInventoryStack(object);
                await pline(`The mixture ${heroIsBlind() ? '' : 'glows brightly and '}evaporates.`);
                return;
        }
    }
    object.odiluted = object.otyp !== POT_WATER;
    if (object.otyp === POT_WATER && !heroIsHallucinating())
        await pline(`The mixture bubbles${heroIsBlind() ? '' : ', then clears'}.`);
    else if (!heroIsBlind())
        await pline(`The mixture looks ${potionColor(object)}.`);
    await freeInventoryObject(object);
    await holdPotion(object, 'You drop');
}
export async function neutralizePotion(object, potion) {
    if (object.otyp !== UNICORN_HORN && object.otyp !== AMETHYST)
        return false;
    const mixture = mixtureType(object, potion);
    if (!mixture)
        return false;
    const oldType = potion.otyp;
    const oldKnown = !!potion.dknown;
    const oldColor = oldKnown ? `${potionColor(potion)} ` : '';
    const several = objectQuantity(potion) > 1;
    let single = potion;
    if (several) {
        const split = splitObjectStack(potion, 1);
        if (!split)
            throw new Error('Cannot separate the potion being neutralized');
        single = split;
    }
    await chargeAlteredUnpaidObject(single, 'neutralize');
    single.otyp = mixture;
    single.blessed = false;
    single.cursed = mixture === POT_WATER ? false : !!object.cursed;
    single.buc = single.cursed ? 'cursed' : 'uncursed';
    if (mixture === POT_WATER)
        single.odiluted = false;
    single.bknown = false;
    single.dknown = false;
    if (!heroIsBlind()) {
        if (!heroIsHallucinating())
            observeObject(single);
        const change = mixture === POT_WATER && single.dknown ? 'clears' : `turns ${potionColor(single)}`;
        await pline(`The ${oldColor}potion${several ? ' that you dipped into' : ''} ${change}.`);
        if (oldKnown) {
            // docall's temporary object describes the old liquid, whose
            // identity must remain available after the real bottle changes.
            await tryCallObjectType({ ...single, otyp: oldType, dknown: true });
        }
    }
    await holdPotion(single, 'You juggle and drop');
    return true;
}
async function dipInOil(object, potion) {
    let wisdom = false;
    if (potion.lamplit) {
        await fireDamageObject(object, { force: true, x: game.u.ux, y: game.u.uy, publish: pline });
    }
    else if (potion.cursed) {
        await pline(`The potion spills and covers your ${fingersOrGloves()} with oil.`);
        setPropertyTimeout('glib', (game.u.glibTurns ?? 0) + d(2, 10));
    }
    else if (object.oclass !== 2 && !isWeaponTool(object))
        return false;
    else if ((!objectIsVulnerableToErosion(object, 'rust') && !objectIsVulnerableToErosion(object, 'corrosion'))
        || isLauncherAmmunition(object) || !(object.oeroded || object.oeroded2)) {
        const verb = verbForSubject(objectNameIsPlural(object) ? 'they' : null, heroIsBlind() ? 'feel' : 'gleam');
        await pline(`${ownedObjectName(object)} ${verb} ${heroIsBlind() ? 'oily' : 'with an oily sheen'}.`);
    }
    else {
        const damage = object.oeroded && object.oeroded2 ? 'corroded and rusty'
            : object.oeroded ? 'rusty' : 'corroded';
        const verb = verbForSubject(objectNameIsPlural(object) ? 'they' : null, heroIsBlind() ? 'feel' : 'are');
        await pline(`${ownedObjectName(object)} ${verb} less ${damage}.`);
        object.oeroded = Math.max(0, (object.oeroded ?? 0) - 1);
        object.oeroded2 = Math.max(0, (object.oeroded2 ?? 0) - 1);
        wisdom = true;
    }
    await exerciseAttribute(A_WIS, wisdom);
    if (potion.dknown)
        learnObjectType(POT_OIL);
    await consumeInventoryItem(potion);
    return true;
}
async function fillLamp(lamp, potion) {
    if (lamp.lamplit || potion.lamplit) {
        await consumeInventoryItem(potion);
        await explode(game.u.ux, game.u.uy, 11, d(6, 6), 0, EXPL_FIERY);
        await exerciseAttribute(A_WIS, false);
        return;
    }
    if (lamp.otyp === MAGIC_LAMP && !lamp.spe) {
        lamp.otyp = OIL_LAMP;
        lamp.age = 0;
    }
    if (lamp.age > 1000) {
        await pline(`${ownedObjectAction(lamp, 'are')} full.`);
        potion.in_use = false;
    }
    else {
        await pline(`You fill ${ownedObjectName(lamp, game, { capitalized: false })} with oil.`);
        await chargeUnpaidUsage(potion);
        lamp.age = Math.min(1500, lamp.age + Math.trunc((potion.odiluted ? 3 : 4) * potion.age / 2));
        await consumeInventoryItem(potion);
        await exerciseAttribute(A_WIS, true);
    }
    if (potion.dknown)
        learnObjectType(POT_OIL);
    lamp.spe = 1;
}
// ---- mongrantswish()/djinni_from_bottle()/split_mon() (C potion.c:2796-2918) ----
export async function grantMonsterWish(monster, { state = game, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const { mx, my } = monster;
    const spentTime = state.context.move;
    const square = state.level.at(mx, my);
    const projection = square ? {
        ch: square.disp_ch ?? ' ', color: square.disp_color,
        decgfx: square.disp_decgfx, attr: square.disp_attr,
        glyph: square.disp_glyph ?? null,
    } : null;
    // Remove before wishing so an artifact-fatal wish cannot put the donor
    // in bones. Keep its last map projection visible until the prompt ends.
    await removeWishGrantingMonster(monster);
    if (state.program_state.gameover)
        return;
    if (projection)
        await show_glyph_cell(mx, my, projection.ch, projection.color, projection.decgfx, projection.attr, projection.glyph);
    try {
        await makeWish();
    }
    finally {
        state.context.move = spentTime;
        await newsym(mx, my);
    }
}
// C potion.c:djinni_from_bottle(), shared by smoky potions and rubbed lamps.
export async function releaseDjinni(source, state) {
    const monster = await makemonNear(PM_DJINNI, state.u.ux, state.u.uy, MM_NOMSG);
    if (!monster) {
        await pline('It turns out to be empty.');
        return;
    }
    if (heroIsBlind(state)) {
        await pline('You smell acrid fumes.');
        await pline('Something speaks.');
    }
    else {
        await pline(`In a cloud of smoke, ${monsterName(monster, { article: 'a', state })} emerges!`);
        await pline(`${monsterName(monster, { capitalized: true, state })} speaks.`);
    }
    let chance = rn2(5);
    if (source.blessed)
        chance = chance === 4 ? rnd(4) : 0;
    else if (source.cursed)
        chance = chance === 0 ? rn2(4) : 4;
    switch (chance) {
        case 0:
            await pline('"I am in your debt.  I will grant one wish!"');
            await grantMonsterWish(monster, { state });
            break;
        case 1:
            await pline('"Thank you for freeing me!"');
            await tameMonster(monster, null, { state });
            break;
        case 2:
            await pline('"You freed me!"');
            monster.mpeaceful = 1;
            setMonsterMalign(monster, state);
            break;
        case 3:
            await pline('"It is about time!"');
            if (canSpotMonster(monster))
                await pline(`${monsterName(monster, { capitalized: true, state })} vanishes.`);
            await removeMonsterFromGame(monster);
            break;
        default:
            await pline('"You disturbed me, fool!"');
            monster.mpeaceful = 0;
            setMonsterMalign(monster, state);
            break;
    }
}
// C potion.c:split_mon() for a monster.  The heat source is named before
// cloning, and a spotted monster announces the division.
export async function splitMonster(monster, state = game, { heatSource = null, publish = plineWithContinuation, ...options } = {}) {
    if (!monster)
        return null;
    const reason = heatSource === 'hero' ? ' from your heat'
        : heatSource ? ` from ${possessiveName(monsterName(heatSource, { state }))} heat` : '';
    const maximumHp = monster.mhpmax ?? monster.mhp ?? 0;
    if ((monster.mhp ?? 0) > maximumHp)
        monster.mhp = maximumHp;
    const clone = await cloneMonster(monster, state, options);
    if (!clone)
        return null;
    clone.mhpmax = Math.trunc(maximumHp / 2);
    monster.mhpmax = maximumHp - clone.mhpmax;
    if (canSpotMonster(monster))
        await publish(`${monsterName(monster, { state, capitalized: true })} multiplies${reason}!`);
    return clone;
}
// C potion.c:strange_feeling(). Detection already owns its result message;
// both paths finish through the same object naming and single-use boundary.
export async function strangeFeeling(source, text, { state = game, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const message = state.flags.beginner || !text
        ? `You have a ${heroIsHallucinating(state) ? 'normal' : 'strange'} feeling for a moment, then it passes.`
        : text;
    await plineWithContinuation(message);
    return finishStrangeFeeling(source, { state });
}
export async function finishStrangeFeeling(source, { state = game, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (source?.dknown)
        await tryCallObjectType(source, state);
    if (source)
        await consumeInventoryItem(source, state);
    return { known: false, consumed: !!source, heroDied: !!state.program_state.gameover };
}
//# sourceMappingURL=potion.js.map