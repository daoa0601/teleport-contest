// pray.c owner: prayer trouble detection and repair, divine wrath and gifts,
// altar sacrifice, the #turn command, and the god-name helpers
// (align_gname, halu_gname, align_gtitle).  Folded from prayer_trouble/
// divine_wrath/divine_gifts/sacrifice/alignment/turn_undead (pure move, no
// behavior change).
import { RANDOM_CLASS, WEAPON_CLASS, AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SPBOOK_CLASS, GEM_CLASS, } from './objclass.js';
import { objectSkill, AMULET_OF_STRANGULATION, AMULET_OF_UNCHANGING, AMULET_OF_YENDOR, BOULDER, CORPSE, FAKE_AMULET_OF_YENDOR, FUMBLE_BOOTS, GAUNTLETS_OF_FUMBLING, HELM_OF_OPPOSITE_ALIGNMENT, LEVITATION_BOOTS, LONG_SWORD, LOADSTONE, MAGIC_MARKER, OBJECT_NAMES, OBJECT_SPELL_CATEGORY, SPE_BLANK_PAPER, STATUE, getObjectClassBounds, } from './object_data.js';
import { recordAchievement } from './insight.js';
import { OBJ_NAME } from './object_data.js';
import { ringRemovalObstacle, disintegrateWornArmor, simpleArmorName, clearHeroStrangulation, heroIsStrangled } from './do_wear.js';
import { artifactById, artifactByName, artifactExistCount, mk_artifact, discoverArtifact, findArtifact, nameArtifact, setArtifactOrigin } from './artifact.js';
import { adjustAttribute, adjustHeroAlignment, attributeChangeMessage, changeHeroAlignment, changeHeroLuck, exerciseAttribute, setHeroMaxHitPoints } from './attrib.js';
import { heroIsPunished } from './ball.js';
import { monsterResistsEffect, reviveCorpseForHero } from './zap.js';
import { reviveCorpseImmediately } from './do.js';
import { ACH_TUNE, A_CON, A_NONE, A_STR, A_WIS, ALTAR, AM_SANCTUM, AM_SHRINE, Align2amask, Amask2align, BOLT_LIM, DISSOLVED, EXT_ENCUMBER, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_NONINVENT, GETOBJ_EXCLUDE_SELECTABLE, GETOBJ_SUGGEST, HUNGRY, HVY_ENCUMBER, IS_OBSTRUCTED, Is_astralevel, LUCKMAX, LUCKMIN, Luck, M_SEEN_DISINT, M_SEEN_ELEC, M_SEEN_REFL, MAXULEV, MM_NOMSG, P_BROAD_SWORD, P_LONG_SWORD, PARANOID_CONFIRM, PARANOID_PRAY, PLNMSG_OBJ_GLOWS, ROOM, SCORR, SDOOR, STRAT_APPEARMSG, TT_BURIEDBALL, TT_LAVA, Upolyd, W_SADDLE, WEAK, STOMACH, EYE, FOOT, LL_ARTIFACT, LL_CONDUCT, LL_DIVINEGIFT, LL_SPOILER, } from './const.js';
import { isok, paranoidQuery } from './cmd.js';
import { encumber_msg } from './pickup.js';
import { finishHeroDeath, finishLivingGame } from './end.js';
import { gainExperienceLevel, loseHeroExperience } from './exper.js';
import { landFloorObject } from './floor_effects.js';
import { floorObjectDescription, chooseInventoryObject, confersLuck, consumeInventoryItem, inventoryItemDescription, feelPetrifyingCorpse } from './invent.js';
import { heroCanReachFloor, heroHasFreeHand } from './engrave.js';
import { useUpFloorObject } from './invent.js';
import { game, requireInitializedGame, requireLiveGame, requirePlayingGame } from './gstate.js';
import { nomul, loseHeroHp, nearCapacity } from './hack.js';
import { AT_ENGL, AD_BLND } from './monster_attack_types.js';
import { objectLightRadius } from './light.js';
import { angerTemplePriest } from './priest.js';
import { makeConfused, makeHallucinated, makeStunned, makeBlinded, cureHeroSickness, heroIsSick, clearHeroSliming, heroIsSliming } from './potion.js';
import { healHeroLegs } from './do.js';
import { resetUtrap, announceTerrainRescue, animateStatue } from './trap.js';
import { currentHungerState, init_uhunger } from './eat.js';
import { demonLord, summonMinion } from './minion.js';
import { setMonsterMalign } from './makemon.js';
import { makemonNear } from './mklev.js';
import { mkobj, mksobj, blessObjectState, curseObject, uncurseObjectState, objectQuantity, placeCreatedObject, adjustObjectLightAfterBlessing } from './mkobj.js';
import { MONSTER_ALIGNMENT, MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_DIFFICULTY, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { displayColorName, monsterName } from './do_name.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance, monsterHasDisintegrationResistance, monsterHasShockResistance, your_race, monsterIsDemon, monsterIsHuman, monsterIsUndead, monsterIsUnicorn, monsterIsVampireShifter, monsterThrowsRocks, heroResistsStoning, touchPetrifies, eyecount, heroCanChant, } from './mondata.js';
import { wakeMonstersNearWithMessages, finishHeroMonsterKill, isRider } from './mon.js';
import { makeMonsterFlee } from './monmove.js';
import { makePlural, withIndefiniteArticle, rndClass, objectName, observeObjectForNaming, ownedObjectAction, ownedObjectName, simpleObjectNameWithArticle } from './objnam.js';
import { isWeaponTool, isBimanualObject } from './object_properties.js';
import { learnObjectType, observeObject, recordObjectEncounter } from './o_init.js';
import { deleteObject } from './shk.js';
import { heroHasNoHands, heroIsUnchanging, heroFormHidesUnderObjects, returnHeroToHumanForm, body_part, mbodypart, heroSpecies } from './polyself.js';
import { grantIntrinsicProperty, hasIntrinsicProperty, hasPermanentIntrinsicProperty, propertyIsActive, refreshProperty, wornObjectGrantsProperty } from './properties.js';
import { punishHero, unpunishHero } from './read.js';
import { promptYesNo, promptYesNoQuit } from './query.js';
import { heroIsInDangerousRegion, rescueHeroFromRegion } from './region.js';
import { discoverHeroReflectionSource, ureflects, heroReflectsRay } from './muse.js';
import { nativeRoleAt, roles } from './role.js';
import { d, rn1, rn2, rn2Display, rnl, rnd, rnz } from './rng.js';
import { blindfolded, heroIsBlind, heroIsBlinded, heroIsDeaf, heroIsHallucinating, permanentBlind, setHeroBlindnessTurns, syncDeafness } from './senses.js';
import { addHeroWeaponSkillSlots, ensureHeroSkills, SKILL_NAMES, unrestrictHeroSkill } from './weapon.js';
import { castSpell, forceLearnSpell, knownSpell } from './spell.js';
import { clearHeroPetrification, heroIsPetrifying } from './stoning.js';
import { addObjectToMonsterInventory } from './steal.js';
import { attrcurse, rndcurse } from './throne.js';
import { safe_teleds } from './teleport.js';
import { cansee, couldsee } from './vision.js';
import { flushPendingTopline } from './topl.js';
import { newsym, see_monsters, shieldeff } from './display.js';
import { isWeldedPrimary, willWeld } from './wield.js';
import { purifyHeroLycanthropy } from './were.js';
import { aggravateMonsters } from './wizard.js';
import { isPoolOrLavaAt } from './dbridge.js';
import { formatFeltMessage, pline as printLine, plineWithContinuation as pline, publishHeardMessage, recordGameLogEvent, } from './pline.js';
import { freeHeroFromBuriedBall } from './dig.js';
// ---------------------------------------------------------------------------
// Prayer decisions and the three-turn prayer occupation (pray)
// ---------------------------------------------------------------------------
const POT_WATER = OBJECT_NAMES.indexOf('water');
const STRIDENT = 4;
// C pray.c:altar_wrath().
export async function altarWrath(x, y, state = game) {
    requirePlayingGame(state);
    const altarAlignment = Amask2align(state.level?.at(x, y)?.flags ?? 0);
    const heroAlignment = state.u?.ualign?.type ?? 0;
    const alignmentRecord = state.u?.ualign?.record ?? 0;
    const deity = deityName(altarAlignment, state);
    if (heroAlignment === altarAlignment && alignmentRecord > -rn2(4)) {
        await godVoice(altarAlignment, 'How darest thou desecrate my altar!', state);
        const change = adjustAttribute(A_WIS, -1, state);
        const message = attributeChangeMessage(A_WIS, change, state);
        if (message)
            await pline(message);
        state.u.ualign.record = alignmentRecord - 1;
        return;
    }
    await pline(heroIsDeaf(state)
        ? `Despite your deafness, you seem to hear ${deity} say:`
        : `A voice (could it be ${deity}?) whispers:`);
    await pline('"Thou shalt pay, infidel!"');
    // C pray.c:2670 altar_wrath() reads Luck (u.uluck + u.moreluck) but
    // change_luck() adjusts u.uluck only.
    const luck = Luck(state.u);
    if (luck > -5 && rn2(luck + 6))
        state.u.uluck = Math.max(LUCKMIN, (state.u.uluck ?? 0) - (rn2(20) ? 1 : 2));
}
// C pray.c:dopray().
export async function dopray() {
    const game = requireInitializedGame();
    game.context.move = 0;
    const bits = game.flags.paranoia_bits ?? PARANOID_PRAY;
    if (bits & PARANOID_PRAY) {
        const confirmed = await paranoidQuery(!!(bits & PARANOID_CONFIRM), 'Are you sure you want to pray?', bits);
        if (!confirmed)
            return;
    }
    const hero = game.u;
    const conduct = hero.uconduct;
    if (!conduct.gnostic)
        recordGameLogEvent('rejected atheism with a prayer', { flags: LL_CONDUCT });
    conduct.gnostic = (conduct.gnostic || 0) + 1;
    const altar = currentAltar();
    const alignment = altar ? Amask2align(altar.flags) : hero.ualign.type;
    const trouble = worstPrayerTrouble();
    // The pinned can_pray() rejects a demon unless the deity is neutral,
    // despite its comment describing the opposite restriction.
    if (demonRejectsPrayer(alignment)) {
        await pline(`The very idea of praying to a ${alignment ? 'lawful' : 'neutral'} god is repugnant to you.`);
        return;
    }
    await pline(`You begin praying to ${deityName(alignment)}.`);
    let outcome = prayerOutcome(alignment, trouble);
    if (game.flags.debug && !['moloch', 'undead'].includes(outcome)) {
        await flushPendingTopline();
        if (await promptYesNo('Force the gods to be pleased?', 'n', !((game.flags.paranoia_bits ?? 0) & PARANOID_PRAY)) === 'y') {
            hero.ublesscnt = 0;
            hero.uluck = Math.max(0, hero.uluck || 0);
            hero.ualign.record = Math.max(1, hero.ualign.record);
            hero.ugangr = 0;
            if (outcome === 'too-soon' || outcome === 'angry')
                outcome = 'pleased';
        }
    }
    game._prayerAlignment = alignment;
    game._prayerTrouble = trouble;
    game._prayerOutcome = outcome;
    nomul(-3);
    game._helplessReason = 'praying';
    game._helplessDoneMessage = 'You finish your prayer.';
    // C has one afternmv callback; prayer_done replaces pending dressing.
    game._afterMove = { kind: 'finish-prayer' };
    if (outcome === 'pleased' && !inHell()) {
        if (!heroIsBlind(game))
            await pline('You are surrounded by a shimmering light.');
        hero.invulnerable = true;
    }
    game.context.move = 1;
}
// C pray.c:can_pray(): the silent praying=FALSE decision.
// C can_pray(FALSE) uses the same trouble, timeout, and deity decision as #pray.
export function canPraySafely() {
    const game = requireInitializedGame();
    const altar = currentAltar();
    const alignment = altar ? Amask2align(altar.flags) : game.u.ualign.type;
    const trouble = worstPrayerTrouble();
    if (demonRejectsPrayer(alignment))
        return false;
    return prayerOutcome(alignment, trouble) === 'pleased' && !inHell();
}
// Part of C pray.c:can_pray(): the demon repugnance test.
function demonRejectsPrayer(alignment) {
    const game = requireInitializedGame();
    return monsterIsDemon(game.u.umonnum) && alignment !== 0;
}
// Part of C pray.c:can_pray(): the p_type outcome computation.
function prayerOutcome(alignment, trouble) {
    const game = requireInitializedGame();
    const hero = game.u;
    let record = hero.ualign.record;
    if (hero.ualign.type && hero.ualign.type === -alignment)
        record = -record;
    else if (hero.ualign.type !== alignment)
        record = Math.trunc(record / 2);
    let outcome;
    if (alignment === A_NONE)
        outcome = 'moloch';
    else if ((hero.ublesscnt || 0) > (trouble > 0 ? 200 : trouble < 0 ? 100 : 0))
        outcome = 'too-soon';
    else if (Luck(game.u) < 0 || hero.ugangr || record < 0)
        outcome = 'angry';
    else
        outcome = currentAltar() && hero.ualign.type !== alignment ? 'other-god' : 'pleased';
    if (monsterIsUndead(hero.umonnum) && !inHell()
        && (alignment === 1 || alignment === 0 && !rn2(10)))
        outcome = 'undead';
    return outcome;
}
// C pray.c:prayer_done().
export async function finishPrayerOccupation(state = game) {
    requirePlayingGame(state);
    const alignment = state._prayerAlignment;
    const outcome = state._prayerOutcome;
    if (alignment === undefined || outcome === undefined)
        throw new Error('Prayer completion requires its retained alignment and outcome');
    state.u.invulnerable = false;
    try {
        if (outcome === 'moloch') {
            await pline(`You ${heroIsDeaf(state) ? 'intuit' : 'hear'} diabolical laughter all around you...`);
            await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, state.u.ulevel * 20, state);
            adjustHeroAlignment(-2, state);
            await exerciseAttribute(A_WIS, false, state);
            if (!inHell()) {
                await pline('Nothing else happens.');
                return { outcome };
            }
        }
        else if (outcome === 'undead') {
            await godVoice(alignment, alignment === 1
                ? 'Vile creature, thou durst call upon me?' : 'Walk no more, perversion of nature!');
            await pline(formatFeltMessage('like you are falling apart.', state));
            await returnHeroToHumanForm(state);
            if (!state.program_state.gameover)
                await loseHeroHp(rnd(20), 'residual undead turning effect', { state });
            await exerciseAttribute(A_CON, false, state);
            return { outcome };
        }
        if (inHell()) {
            await pline(`Since you are in Gehennom, ${deityName(alignment)} can't help you.`);
            if (state.u.ualign.record <= 0 || rnl(state.u.ualign.record))
                await angryGods(state.u.ualign.type, state);
            return { outcome: 'hell' };
        }
        if (outcome === 'too-soon' || outcome === 'angry') {
            if (currentAltar() && state.u.ualign.type !== alignment)
                await changeAltarWater(false);
            if (outcome === 'too-soon')
                await punishEarlyPrayer();
            else
                await angryGods(state.u.ualign.type, state);
        }
        else if (outcome === 'other-god') {
            if (await changeAltarWater(false))
                await punishEarlyPrayer();
            else
                await pleaseGod(alignment);
        }
        else {
            if (currentAltar()) {
                await reviveAltarPet();
                await changeAltarWater(true);
            }
            await pleaseGod(alignment);
        }
        return { outcome };
    }
    finally {
        delete state._prayerOutcome;
        delete state._prayerAlignment;
        delete state._prayerTrouble;
    }
}
// Part of C pray.c:prayer_done(): the too-soon punishment (blesscnt,
// luck, gods_upset).
async function punishEarlyPrayer() {
    const game = requireInitializedGame();
    game.u.ublesscnt = (game.u.ublesscnt || 0) + rnz(250);
    game.u.uluck = Math.max(LUCKMIN, (game.u.uluck || 0) - 3);
    await godsUpset(game.u.ualign.type);
}
// C pray.c:pleased().
async function pleaseGod(alignment) {
    const game = requireInitializedGame();
    const hero = game.u;
    let trouble = worstPrayerTrouble();
    const hallucinating = heroIsHallucinating(game);
    const mood = hero.ualign.record >= 14 ? (hallucinating ? 'pleased as punch' : 'well-pleased')
        : hero.ualign.record >= STRIDENT ? (hallucinating ? 'ticklish' : 'pleased')
            : hallucinating ? 'full' : 'satisfied';
    await pline(formatFeltMessage(`that ${deityName(alignment)} is ${mood}.`));
    if (currentAltar() && game._prayerAlignment !== hero.ualign.type) {
        adjustHeroAlignment(-1);
        return;
    }
    if (hero.ualign.record < 2 && trouble <= 0)
        adjustHeroAlignment(1);
    let favor = !trouble && hero.ualign.record >= 14 && game._prayerTrouble === 0;
    if (trouble || hero.ualign.record < 14) {
        const altar = currentAltar();
        let action = rn1(Math.max(Luck(game.u), -1) + (altar ? 3 + Number(!!(altar.flags & AM_SHRINE)) : 2), 1);
        if (!altar)
            action = Math.min(action, 3);
        if (hero.ualign.record < STRIDENT)
            action = hero.ualign.record > 0 || !rnl(2) ? 1 : 0;
        action = Math.min(action, 5);
        if (action >= 4) {
            favor = action === 5;
            do {
                await fixPrayerTrouble(trouble);
                if (game.program_state.gameover)
                    return;
                trouble = worstPrayerTrouble();
            } while (trouble);
        }
        else if (action >= 2) {
            if (action === 3)
                await fixPrayerTrouble(trouble);
            let count = 0;
            while ((trouble = worstPrayerTrouble()) > 0 && ++count < 10) {
                await fixPrayerTrouble(trouble);
                if (game.program_state.gameover)
                    return;
            }
        }
        else if (action === 1 && trouble > 0) {
            await fixPrayerTrouble(trouble);
        }
    }
    if (game.program_state.gameover)
        return;
    if (favor)
        await grantPrayerFavor(rn2((Luck(game.u) + 6) >> 1), alignment);
    hero.ublesscnt = rnz(350);
    const extra = Number(!!hero.uevent?.udemigod) + Number(!!hero.uevent?.uhand_of_elbereth);
    if (extra)
        hero.ublesscnt += extra * rnz(1000);
    if (game.moves > 100000)
        hero.ublesscnt += Math.min(Math.trunc((game.moves - 100000) / 100), 32767 - hero.ublesscnt);
}
// C pray.c:water_prayer().
async function changeAltarWater(bless) {
    const game = requireInitializedGame();
    const hero = game.u;
    let changed = 0;
    let other = false;
    const known = !heroIsBlind(game) && !heroIsHallucinating(game);
    for (const object of game.level.objects[hero.ux]?.[hero.uy] || []) {
        if (object.otyp === POT_WATER && !(bless ? object.blessed : object.cursed)) {
            if (bless)
                blessObjectState(object);
            else
                await curseObject(object);
            object.bknown = known;
            changed += object.quan;
        }
        else if (object.oclass === POTION_CLASS)
            other = true;
    }
    if (!heroIsBlind(game) && changed) {
        const subject = other ? (changed > 1 ? 'Some of the' : 'One of the') : 'The';
        await pline(`${subject} potion${other || changed > 1 ? 's' : ''} on the altar glow${changed > 1 ? '' : 's'} ${displayColorName(bless ? 'light blue' : 'black')} for a moment.`);
    }
    return changed > 0;
}
// C pray.c:pray_revive().
async function reviveAltarPet() {
    const game = requireInitializedGame();
    const hero = game.u;
    const object = (game.level.objects[hero.ux]?.[hero.uy] || []).find(object => [CORPSE, STATUE].includes(object.otyp)
        && object.oextra?.omonst?.mtame && !object.oextra.omonst.isminion);
    if (!object)
        return;
    if (object.otyp === CORPSE)
        await reviveCorpseForHero(object);
    else
        await animateStatue(object, hero.ux, hero.uy, { magic: true });
}
// C pray.c:on_altar().
function currentAltar() {
    const game = requireInitializedGame();
    const location = game.level.requireAt(game.u.ux, game.u.uy);
    return location.typ === ALTAR ? location : null;
}
// C dungeon.h:In_hell().
function inHell(state = game) {
    const dnum = state.u?.uz?.dnum ?? -1;
    return !!state.dungeons?.[dnum]?.flags?.hellish;
}
// C pray.c's maybe_turn_mon_iter() class ladder: the xlev bonus each monster
// class adds over the base of 6 (lichs are intentionally tougher than
// zombies).
const TURN_LEVEL_BY_CLASS = new Map([
    [52, 6], // zombie
    [39, 8], // mummy
    [49, 10], // wraith
    [48, 12], // vampire
    [54, 14], // ghost
    [38, 16], // lich
]);
// C pray.c:maybe_turn_mon_iter(). One #turn target: couldsee() and the
// squared mdistu() range gate it, then the class ladder decides destruction,
// peacefulness, or flight. Returns false when the hero dies mid-scan, which
// C never needs because killed() ends the game instead.
async function maybeTurnMonsterIter(monster, state, options, scan) {
    const { finishMonsterKill, random } = options;
    const heroLevel = state.u?.ulevel ?? 1;
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0)
        return true;
    const dx = (monster.mx ?? 0) - (state.u?.ux ?? 0);
    const dy = (monster.my ?? 0) - (state.u?.uy ?? 0);
    if (!couldsee(monster.mx, monster.my)
        || dx * dx + dy * dy > scan.rangeSquared
        || monster.mpeaceful
        || !(monsterIsUndead(monster.mnum)
            || monsterIsVampireShifter(monster)
            || (heroLevel > MAXULEV / 2 && monsterIsDemon(monster.mnum))))
        return true;
    monster.msleeping = 0;
    if (state.u.confused || (state.u.confusionTurns ?? 0) > 0) {
        if (!scan.falterMessagesShown) {
            await pline('Unfortunately, your voice falters.');
            scan.falterMessagesShown = 1;
        }
        monster.mflee = 0;
        monster.mfrozen = 0;
        monster.mcanmove = 1;
        return true;
    }
    if (monsterResistsEffect(monster, heroLevel, random)) {
        await shieldeff(monster.mx, monster.my, state);
        if (cansee(monster.mx, monster.my))
            await pline(`${monsterName(monster, { state, capitalized: true })} resists!`);
        return true;
    }
    const requiredLevel = TURN_LEVEL_BY_CLASS.get(MONSTER_SYMBOL[monster.mnum] ?? -1);
    if (requiredLevel != null && heroLevel >= requiredLevel
        && !monsterResistsEffect(monster, heroLevel, random)) {
        if ((state.u?.ualign?.type ?? 0) < 0) {
            monster.mpeaceful = 1;
            setMonsterMalign(monster, state);
        }
        else { /* damn them */
            await finishMonsterKill(monster, monster.mx, monster.my);
        }
        return true;
    }
    const flight = await makeMonsterFlee(monster, { state, random });
    return !flight.heroDied;
}
// C pray.c:doturn().
export async function doturn(state = game, { finishMonsterKill = finishHeroMonsterKill, random = rn2, } = {}) {
    requirePlayingGame(state);
    /* Knights & Priest(esse)s only please */
    const role = state.urole?.key;
    if (role !== 'priest' && role !== 'knight') {
        /* Try to use the "turn undead" spell. */
        const spell = (state.spells || []).find(known => known.name === 'turn undead');
        if (!spell) {
            await printLine("You don't know how to turn undead!");
            state.context.move = 0;
            return;
        }
        await castSpell(spell.otyp);
        return;
    }
    if (!state.u.uconduct)
        state.u.uconduct = {};
    const priorCalls = state.u.uconduct.gnostic ?? 0;
    state.u.uconduct.gnostic = priorCalls + 1;
    if (!priorCalls)
        recordGameLogEvent('rejected atheism by turning undead', { state, flags: LL_CONDUCT });
    const deity = hallucinatedDeityName(state.u.ualign.type, state);
    /* [What about needing free hands (does #turn involve any gesturing)?] */
    if (!heroCanChant(state)) {
        /* "evilness": "demons and undead" is too verbose and too precise */
        const strangled = state.u?.strangled
            || (state.u?.strangledTurns ?? 0) > 0;
        const ability = strangled ? 'not able to call' : 'incapable of calling';
        await pline(`You are ${ability} upon ${deity} to turn aside evilness.`);
        /* conduct tracking is not supposed to affect play but we make an
           exception here: use a move if this is the first time agnostic
           conduct has been broken */
        state.context.move = priorCalls === 0 ? 1 : 0;
        return;
    }
    const alignment = state.u?.ualign?.type ?? 0;
    if ((alignment >= 0
        && (monsterIsDemon(state.u.umonnum)
            || monsterIsUndead(state.u.umonnum)
            || monsterIsVampireShifter({ mnum: state.u.umonnum, cham: state.u.mcham ?? -1 })))
        || (state.u?.ugangr ?? 0) > 6) { /* "Die, mortal!" */
        await pline(`For some reason, ${deity} seems to ignore you.`);
        await aggravateMonsters(state, random);
        await exerciseAttribute(A_WIS, false, state);
        state.context.move = 1;
        return;
    }
    if (inHell(state)) {
        /* not actually calling upon Moloch but use alternate phrasing
           anyway if hallucinatory feedback says it's him */
        await pline(`Since you are in Gehennom, ${deity} ${deity === 'Moloch' ? "won't" : "can't"} help you.`);
        await aggravateMonsters(state, random);
        state.context.move = 1;
        return;
    }
    await pline(`Calling upon ${deity}, you chant an arcane formula.`);
    await exerciseAttribute(A_WIS, true, state);
    /* C pray.c: turn_undead_range = BOLT_LIM + ulevel/5, then squared
       (8 to 14). iter_mons() walks fmon newest first, so the stored
       oldest-first monster list is reversed. */
    const range = BOLT_LIM + Math.trunc((state.u?.ulevel ?? 1) / 5);
    const scan = { rangeSquared: range * range, falterMessagesShown: 0 };
    for (const monster of Array.from(state.level?.monsters || []).reverse()) {
        if (!await maybeTurnMonsterIter(monster, state, { finishMonsterKill, random }, scan))
            return;
    }
    /* Paralysis duration probably ought to be based on the strength of
       turned creatures rather than on turner's level. -5 .. -1 */
    nomul(-Math.max(1, 5 - Math.trunc(((state.u?.ulevel ?? 1) - 1) / 6)), state);
    state._helplessReason = 'trying to turn the monsters';
    state._helplessDoneMessage = 'You can move again.';
    state.context.move = 1;
}
// ---------------------------------------------------------------------------
// God names (align_gname, halu_gname, align_gtitle)
// ---------------------------------------------------------------------------
// C pray.c:align_gname(). Role data stores god names without role.c's '_'
// goddess marker; goddessAlignments records which alignments had one.
export function deityName(alignment, state = game) {
    if (alignment === A_NONE)
        return 'Moloch';
    const key = alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
    return state.urole?.gods?.[key] || 'your god';
}
// pray.c hallu_gods[]: the hallucination pantheon.
const HALLUCINATED_GODS = [
    'the Flying Spaghetti Monster', 'Eris', 'the Martians', 'Xom',
    'AnDoR dRaKoN', 'the Central Bank of Yendor', 'Tooth Fairy', 'Om',
    'Yawgmoth', 'Morgoth', 'Cthulhu', 'the Ori', 'destiny',
    'your Friend the Computer',
];
// C pray.c:halu_gname(). Both selection steps use the display RNG.
export function hallucinatedDeityName(alignment, state = game, hallucinating = heroIsHallucinating(state)) {
    requireLiveGame(state);
    if (!hallucinating)
        return deityName(alignment, state);
    if (!state.urole)
        throw new Error('Hallucinated deity names require a selected hero role');
    let gods;
    do {
        const role = nativeRoleAt(rn2Display(roles.length));
        if (!role)
            throw new Error('No hallucinated deity role was selected');
        // role_init() copies borrowed gods into urole. halu_gname() reads
        // the unchanged roles[] table, so Priest remains a rejected choice.
        gods = role.gods;
    } while (!gods?.lawful);
    const choice = rn2Display(9);
    const name = choice < 2 ? gods.lawful
        : choice < 4 ? gods.neutral
            : choice < 6 ? gods.chaotic
                : choice < 8 ? HALLUCINATED_GODS[rn2Display(HALLUCINATED_GODS.length)]
                    : 'Moloch';
    if (name === undefined)
        throw new Error('No hallucinated deity name was selected');
    return name.replace(/^_/, '');
}
// C pray.c:align_gtitle(). goddessAlignments preserves role.c's '_' marker.
export function godTitleOf(alignment, g) {
    return g.urole?.goddessAlignments?.includes(alignment) ? 'goddess' : 'god';
}
// ---------------------------------------------------------------------------
// Trouble detection and repair (prayer_trouble)
// ---------------------------------------------------------------------------
const attributeIndices = [0, 1, 2, 3, 4, 5];
// Positive values are urgent. The order below follows in_trouble().
export const Trouble = {
    STONED: 14, SLIMED: 13, STRANGLED: 12, LAVA: 11, SICK: 10,
    STARVING: 9, REGION: 8, HIT: 7, LYCANTHROPE: 6, COLLAPSING: 5,
    WALL: 4, LEVITATION: 3, HANDS: 2, BLINDFOLD: 1,
    PUNISHED: -1, FUMBLING: -2, CURSED_ITEM: -3, SADDLE: -4, BLIND: -5,
    POISONED: -6, LEGS: -7, HUNGRY: -8, STUNNED: -9, CONFUSED: -10,
    HALLUCINATING: -11,
};
const RIN_LEVITATION = OBJECT_NAMES.indexOf('levitation');
const RIN_SUSTAIN_ABILITY = OBJECT_NAMES.indexOf('sustain ability');
// C pray.c:in_trouble().
// Also C do_wear.c:unchanger(): inlined here as the cursed amulet-of-
// unchanging test (the fix-trouble HANDS case below repeats it).
export function worstPrayerTrouble(state = game) {
    requirePlayingGame(state);
    const hero = state.u;
    if (heroIsPetrifying(state))
        return Trouble.STONED;
    if (heroIsSliming(state))
        return Trouble.SLIMED;
    if (heroIsStrangled(state))
        return Trouble.STRANGLED;
    if (hero.utrap && hero.utraptype === TT_LAVA)
        return Trouble.LAVA;
    if (heroIsSick(state))
        return Trouble.SICK;
    const hunger = currentHungerState(state);
    if (hunger >= WEAK)
        return Trouble.STARVING;
    if (heroIsInDangerousRegion(state))
        return Trouble.REGION;
    if ((!Upolyd(hero) || heroIsUnchanging(state)) && criticallyLowHp(false, state))
        return Trouble.HIT;
    if (Number.isInteger(hero.ulycn) && hero.ulycn >= 0)
        return Trouble.LYCANTHROPE;
    if (nearCapacity(state) >= EXT_ENCUMBER
        && hero.amax.a[A_STR] - hero.acurr.a[A_STR] > 3)
        return Trouble.COLLAPSING;
    if (heroIsSurroundedByRock(state))
        return Trouble.WALL;
    if (cursedType(state.uarmf, LEVITATION_BOOTS)
        || ringRemovalObstacle(state.uleft, RIN_LEVITATION, state)
        || ringRemovalObstacle(state.uright, RIN_LEVITATION, state))
        return Trouble.LEVITATION;
    if (heroHasNoHands(state) || !heroHasFreeHand(state)) {
        if (isWeldedPrimary(state.uwep, state))
            return Trouble.HANDS;
        if (Upolyd(hero) && heroHasNoHands(state)
            && (!heroIsUnchanging(state)
                || cursedType(state.uamul, AMULET_OF_UNCHANGING)))
            return Trouble.HANDS;
    }
    if (blindfolded(state) && state.ublindf?.cursed)
        return Trouble.BLINDFOLD;
    if (state.uball || hero.utrap && hero.utraptype === TT_BURIEDBALL)
        return Trouble.PUNISHED;
    if (cursedType(state.uarmg, GAUNTLETS_OF_FUMBLING)
        || cursedType(state.uarmf, FUMBLE_BOOTS))
        return Trouble.FUMBLING;
    if (worstCursedItem(state))
        return Trouble.CURSED_ITEM;
    if (saddle(state)?.cursed)
        return Trouble.SADDLE;
    const swallower = hero.ustuck;
    if (hero.uswallow && !swallower)
        throw new Error('A swallowed hero has no swallowing monster');
    const blindingSwallower = hero.uswallow && swallower && (MONSTER_ATTACKS[swallower.mnum] || [])
        .some(([attack, damage]) => attack === AT_ENGL && damage === AD_BLND);
    if ((hero.blindTurns ?? 0) > 1 && !permanentBlind(state)
        && !hasIntrinsicProperty('blinded', null, state) && !blindingSwallower
        || (hero.deafTurns ?? 0) > 1)
        return Trouble.BLIND;
    if (attributeIndices.some(index => hero.acurr.a[index] < hero.amax.a[index]))
        return Trouble.POISONED;
    if ((hero._woundedLegTurns ?? 0) > 0 && !hero.usteed)
        return Trouble.LEGS;
    if (hunger >= HUNGRY)
        return Trouble.HUNGRY;
    if ((hero.stunnedTurns ?? 0) > 0)
        return Trouble.STUNNED;
    if ((hero.confusionTurns ?? 0) > 0)
        return Trouble.CONFUSED;
    if ((hero.hallucinationTurns ?? 0) > 0)
        return Trouble.HALLUCINATING;
    return 0;
}
// C pray.c:critically_low_hp().
export function criticallyLowHp(onlyIfInjured = false, state = game) {
    requirePlayingGame(state);
    const hero = state.u;
    const hp = Upolyd(hero) ? hero.mh : hero.uhp;
    let maximum = Upolyd(hero) ? hero.mhmax : hero.uhpmax;
    if (onlyIfInjured && hp >= maximum)
        return false;
    maximum = Math.min(maximum, 15 * hero.ulevel);
    const level = hero.ulevel;
    const divisor = level <= 5 ? 5 : level <= 13 ? 6 : level <= 21 ? 7 : level <= 29 ? 8 : 9;
    return hp <= 5 || hp * divisor <= maximum;
}
// C pray.c:worst_cursed_item().
export function worstCursedItem(state = game) {
    requirePlayingGame(state);
    if (nearCapacity(state) >= HVY_ENCUMBER) {
        const stone = state.inventory.find(object => cursedType(object, LOADSTONE));
        if (stone)
            return stone;
    }
    const weapon = state.uwep;
    const welded = weapon && isWeldedPrimary(weapon, state) ? weapon : null;
    if (welded && (state.uright || isBimanualObject(welded)))
        return welded;
    for (const slot of ['uarmg', 'uarms', 'uarmc', 'uarm', 'uarmh', 'uarmf',
        'uarmu', 'uamul', 'uleft', 'uright', 'ublindf']) {
        const object = state[slot];
        if (object?.cursed && !(slot === 'uarmh' && object.otyp === HELM_OF_OPPOSITE_ALIGNMENT))
            return object;
    }
    if (welded)
        return welded;
    if (state.u.twoweap && state.uswapwep?.cursed)
        return state.uswapwep;
    return state.inventory.find(object => object.cursed
        && (object.otyp === LOADSTONE || confersLuck(object, state))) || null;
}
// C pray.c:stuck_in_wall().
export function heroIsSurroundedByRock(state = game) {
    requirePlayingGame(state);
    if (state.u.passesWalls)
        return false;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (!dx && !dy)
                continue;
            const x = state.u.ux + dx, y = state.u.uy + dy;
            if (!isok(x, y))
                continue;
            const type = state.level.requireAt(x, y).typ;
            if (IS_OBSTRUCTED(type) && type !== SDOOR && type !== SCORR)
                continue;
            if (blockedByBoulders(dx, dy, state)
                && !monsterThrowsRocks(state.u.umonnum))
                continue;
            return false;
        }
    }
    return true;
}
// C pray.c:blocked_boulder().
function blockedByBoulders(dx, dy, state) {
    const hero = state.u;
    const bouldersAt = (x, y) => (state.level.objects[x]?.[y] || [])
        .filter(object => object.otyp === BOULDER)
        .reduce((count, object) => count + object.quan, 0);
    const count = bouldersAt(hero.ux + dx, hero.uy + dy);
    if (!count)
        return false;
    const x = hero.ux + 2 * dx, y = hero.uy + 2 * dy;
    const type = isok(x, y) ? state.level.requireAt(x, y).typ : null;
    if (count > 1 && !(count === 2 && type !== null && isPoolOrLavaAt(x, y, state)))
        return true;
    if (dx && dy && state.level.flags.sokoban_rules)
        return true;
    return type === null || IS_OBSTRUCTED(type) || bouldersAt(x, y) > 0;
}
// Part of C pray.c:worst_cursed_item(): the cursed-type test.
function cursedType(object, type) {
    return object?.otyp === type && !!object.cursed;
}
// Part of C pray.c:in_trouble(): the cursed saddle read.
function saddle(state) {
    return state.u.usteed?.minvent?.find(object => (object.owornmask ?? 0) & W_SADDLE);
}
// C pray.c:fix_curse_trouble().
export async function uncursePrayerObject(object, label = null, state = game) {
    requirePlayingGame(state);
    if (object === state.uarmg && (state.u.glibTurns ?? 0) > 0) {
        state.u.glibTurns = 0;
        refreshProperty('glib', state);
        await pline(`Your ${simpleArmorName(object, 'uarmg', state)} are no longer slippery.`);
        if (!object.cursed)
            return;
    }
    const blindfoldOnly = object === state.ublindf && blindfolded(state)
        && !heroIsBlinded(state);
    if (!heroIsBlind(state) || blindfoldOnly) {
        const subject = label || ownedObjectAction(object, 'softly glow', state);
        await pline(`${subject} ${displayColorName('amber')}.`);
        state._lastPlineKind = PLNMSG_OBJ_GLOWS;
        object.bknown = !heroIsHallucinating(state);
    }
    const oldLight = objectLightRadius(object, state);
    uncurseObjectState(object, state);
    await adjustObjectLightAfterBlessing(object, oldLight, state);
}
// C pray.c:fix_worst_trouble().
export async function fixPrayerTrouble(trouble, state = game) {
    requirePlayingGame(state);
    const hero = state.u;
    let object;
    switch (trouble) {
        case 0: return;
        case Trouble.STONED:
            clearHeroPetrification(state);
            await pline('You feel more limber.');
            return;
        case Trouble.SLIMED:
            clearHeroSliming(state);
            await pline('The slime disappears.');
            return;
        case Trouble.STRANGLED:
            if (state.uamul?.otyp === AMULET_OF_STRANGULATION) {
                await pline('Your amulet vanishes!');
                await consumeInventoryItem(state.uamul, state);
            }
            await pline('You can breathe again.');
            clearHeroStrangulation(state);
            return;
        case Trouble.LAVA:
            if (!await safe_teleds())
                await resetUtrap(true, state);
            await announceTerrainRescue(DISSOLVED, state);
            return;
        case Trouble.STARVING:
        case Trouble.HUNGRY:
            await pline(`Your ${body_part(STOMACH, state)} feels content.`);
            await init_uhunger(state, pline);
            state.context.botl = true;
            return;
        case Trouble.SICK:
            await pline(formatFeltMessage('better.', state));
            cureHeroSickness(state);
            return;
        case Trouble.REGION:
            await rescueHeroFromRegion(state);
            return;
        case Trouble.HIT:
            await pline(formatFeltMessage('much better.', state));
            if (Upolyd(hero)) {
                setHeroMaxHitPoints(Math.max(hero.mhmax + rnd(5), 6), false, state);
                hero.mh = hero.mhmax;
            }
            let maximum = hero.uhpmax;
            if (maximum < hero.ulevel * 5 + 11)
                maximum += rnd(5);
            setHeroMaxHitPoints(Math.max(maximum, 6), true, state);
            hero.uhp = hero.uhpmax;
            state.context.botl = true;
            return;
        case Trouble.COLLAPSING:
            await pline(formatFeltMessage(`${hero.amax.a[A_STR] - hero.acurr.a[A_STR] > 6 ? 'much ' : ''}stronger.`, state));
            hero.acurr.a[A_STR] = hero.amax.a[A_STR];
            state.context.botl = true;
            object = ringRemovalObstacle(state.uleft, RIN_SUSTAIN_ABILITY, state)
                || ringRemovalObstacle(state.uright, RIN_SUSTAIN_ABILITY, state);
            if (object)
                await uncursePrayerObject(requirePrayerObject(object), ringGlow(object, state), state);
            return;
        case Trouble.WALL:
            if (await safe_teleds())
                await pline('Your surroundings change.');
            else {
                hero.passesWallsTurns = d(4, 4) + 4;
                refreshProperty('passesWalls', state);
                await pline(formatFeltMessage('much slimmer.', state));
            }
            return;
        case Trouble.LEVITATION:
            object = cursedType(state.uarmf, LEVITATION_BOOTS) ? state.uarmf
                : ringRemovalObstacle(state.uleft, RIN_LEVITATION, state)
                    || ringRemovalObstacle(state.uright, RIN_LEVITATION, state);
            await uncursePrayerObject(requirePrayerObject(object), ringGlow(object, state), state);
            return;
        case Trouble.HANDS:
            if (isWeldedPrimary(state.uwep, state))
                await uncursePrayerObject(requirePrayerObject(state.uwep), null, state);
            else if (heroIsUnchanging(state))
                await uncursePrayerObject(requirePrayerObject(state.uamul), null, state);
            else {
                await pline('Your shape becomes uncertain.');
                await returnHeroToHumanForm(state);
            }
            return;
        case Trouble.BLINDFOLD:
            await uncursePrayerObject(requirePrayerObject(state.ublindf), null, state);
            return;
        case Trouble.LYCANTHROPE:
            await purifyHeroLycanthropy({ state });
            return;
        case Trouble.PUNISHED:
            await pline('Your chain disappears.');
            if (hero.utrap && hero.utraptype === TT_BURIEDBALL)
                await freeHeroFromBuriedBall(state);
            else
                await unpunishHero(state);
            return;
        case Trouble.FUMBLING:
            object = cursedType(state.uarmg, GAUNTLETS_OF_FUMBLING) ? state.uarmg : state.uarmf;
            await uncursePrayerObject(requirePrayerObject(object), null, state);
            return;
        case Trouble.CURSED_ITEM:
            object = worstCursedItem(state);
            await uncursePrayerObject(requirePrayerObject(object), ringGlow(object, state), state);
            return;
        case Trouble.POISONED: {
            await pline(heroIsHallucinating(state) ? "There's a tiger in your tank." : formatFeltMessage('in good health again.', state));
            for (const index of attributeIndices)
                hero.acurr.a[index] = Math.max(hero.acurr.a[index], hero.amax.a[index]);
            state.context.botl = true;
            await encumber_msg(state, pline);
            return;
        }
        case Trouble.BLIND: {
            let message = '';
            // C tests Blinded (any non-blocked blindness, not just its timeout)
            // when reporting that the eyes recover alongside cured deafness.
            if (heroIsBlinded(state)) {
                state.context.botl = true;
                const singleEye = eyecount(heroSpecies(state)) === 1;
                const eyes = singleEye ? body_part(EYE, state) : makePlural(body_part(EYE, state));
                message = `Your ${eyes} feel${singleEye ? 's' : ''} better`;
                hero.ucreamed = 0;
                await makeBlinded(0, { state, talk: false });
            }
            if ((hero.deafTurns ?? 0) > 0) {
                state.context.botl = true;
                hero.deafTurns = 0;
                syncDeafness(state);
                if (!heroIsDeaf(state))
                    message += message ? ' and you can hear again' : 'You can hear again';
            }
            if (message)
                await pline(`${message}.`);
            return;
        }
        case Trouble.LEGS:
            await healHeroLegs(state, { publish: pline });
            return;
        case Trouble.STUNNED:
            await makeStunned(0, { state, publish: pline });
            return;
        case Trouble.CONFUSED:
            await makeConfused(0, { state, publish: pline });
            return;
        case Trouble.HALLUCINATING:
            await pline('Looks like you are back in Kansas.');
            await makeHallucinated(0, { state, talk: false, publish: pline });
            return;
        case Trouble.SADDLE:
            object = requirePrayerObject(saddle(state));
            if (!heroIsBlind(state)) {
                await pline(`${ownedObjectAction(object, 'softly glow', state)} ${displayColorName('amber')}.`);
                state._lastPlineKind = PLNMSG_OBJ_GLOWS;
                object.bknown = true;
            }
            uncurseObjectState(object, state);
    }
}
// Part of C pray.c:fix_curse_trouble(): the left/right ring glow lines.
function ringGlow(object, state) {
    return object === state.uleft ? 'Your left ring softly glows'
        : object === state.uright ? 'Your right ring softly glows' : null;
}
// Port only: asserts a prayer trouble selected an affected object.
function requirePrayerObject(object) {
    if (!object)
        throw new Error('Prayer selected an item trouble without an affected object');
    return object;
}
// ---------------------------------------------------------------------------
// Divine retaliation (divine_wrath)
// ---------------------------------------------------------------------------
const GOD_VOICES = ['booms out', 'thunders', 'rings out', 'booms'];
const S_HUMAN = 53;
const DISINTEGRATION_ARMOR = [
    'uarms', 'uarmc', 'uarm', 'uarmu',
];
// C pray.c:godvoice().
export async function godVoice(alignment, words = null, state = game) {
    const voice = GOD_VOICES[rn2(GOD_VOICES.length)];
    if (voice === undefined)
        throw new Error('No divine voice was selected');
    const speech = words === null ? '' : `"${words}"`;
    await pline(`The voice of ${deityName(alignment, state)} ${voice}: ${speech}`);
}
// Part of C pray.c:angrygods(): the maxanger computation and clamp.
export function angryGodMaximum({ responseAlignment, heroAlignment, alignmentRecord = 0, anger = 0, luck = 0, }) {
    let maximum;
    if (responseAlignment !== heroAlignment) {
        maximum = Math.trunc(alignmentRecord / 2)
            + (luck > 0 ? Math.trunc(-luck / 3) : -luck);
    }
    else {
        maximum = 3 * anger
            + (luck > 0 || alignmentRecord >= 4 ? Math.trunc(-luck / 3) : -luck);
    }
    return Math.max(1, Math.min(15, maximum));
}
// C pray.c:gods_upset().
export async function godsUpset(alignment, state = game) {
    requirePlayingGame(state);
    const anger = state.u.ugangr ?? 0;
    if (alignment === state.u.ualign.type)
        state.u.ugangr = anger + 1;
    else if (anger > 0)
        state.u.ugangr = anger - 1;
    await angryGods(alignment, state);
}
// C pray.c:desecrate_altar().
export async function desecrateAltar(highAltar, alignment, state = game) {
    requirePlayingGame(state);
    if (alignment === state.u.ualign.type) {
        adjustHeroAlignment(-20, state);
        state.u.ugangr = (state.u.ugangr || 0) + 5;
    }
    await pline(formatFeltMessage('the air around you grow charged...', state));
    await pline(`Suddenly, you realize that ${deityName(alignment, state)} has noticed you...`);
    await godVoice(alignment, `So, mortal!  You dare desecrate my ${highAltar ? 'High Temple' : 'altar'}!`, state);
    await godZapsHero(alignment, state);
}
// C pray.c:angrygods()
// Also C pray.c:gods_angry(): the fixed godVoice message is inlined here
export async function angryGods(alignment, state = game) {
    requirePlayingGame(state);
    const hero = state.u;
    if (state.dungeons?.[hero.uz.dnum]?.flags?.hellish)
        alignment = A_NONE;
    hero.ublessed = 0;
    const maximum = angryGodMaximum({
        responseAlignment: alignment,
        heroAlignment: hero.ualign.type,
        alignmentRecord: hero.ualign.record,
        anger: hero.ugangr ?? 0,
        luck: Luck(hero),
    });
    const outcome = rn2(maximum);
    const mortal = MONSTER_SYMBOL[hero.umonnum] === S_HUMAN ? 'mortal' : 'creature';
    switch (outcome) {
        case 0:
        case 1: {
            const mood = heroIsHallucinating(state) ? 'bummed' : 'displeased';
            await pline(formatFeltMessage(`that ${deityName(alignment, state)} is ${mood}.`, state));
            break;
        }
        case 2:
        case 3: {
            await godVoice(alignment, null, state);
            const accusation = hero.ualign.record < 0 && alignment === hero.ualign.type
                ? 'hast strayed from the path' : 'art arrogant';
            await pline(`"Thou ${accusation}, ${mortal}."`);
            await pline('"Thou must relearn thy lessons!"');
            const change = adjustAttribute(A_WIS, -1, state);
            const message = attributeChangeMessage(A_WIS, change, state);
            if (message)
                await pline(message);
            if (await loseHeroExperience(null, { state }))
                return;
            break;
        }
        case 6:
            if (!heroIsPunished(state)) {
                await godVoice(alignment, 'Thou hast angered me.', state);
                await punishHero(null, state);
                break;
            }
            // An already-punished hero receives a curse instead.
            await curseHero(alignment, state);
            break;
        case 4:
        case 5:
            await curseHero(alignment, state);
            break;
        case 7:
        case 8: {
            await godVoice(alignment, null, state);
            const location = state.level.requireAt(hero.ux, hero.uy);
            const scorn = location.typ === ALTAR && Amask2align(location.flags) !== alignment;
            await pline(`"Thou durst ${scorn ? 'scorn' : 'call upon'} me?"`);
            await pline(`"Then die, ${mortal}!"`);
            await summonMinion(alignment);
            break;
        }
        default:
            await godVoice(alignment, 'Thou hast angered me.', state);
            await godZapsHero(alignment, state);
    }
    if (!state.program_state.gameover)
        hero.ublesscnt = Math.max(hero.ublesscnt || 0, rnz(300));
}
// Part of C pray.c:angrygods() (the citation owner is angryGods()
// above): the godVoice + glow + curse tail, with C pray.c:gods_angry()'s
// fixed message inlined.
async function curseHero(alignment, state) {
    await godVoice(alignment, 'Thou hast angered me.', state);
    if (!heroIsBlind(state) && !state.u.antimagic) {
        const color = displayColorName('black', state);
        const glow = withIndefiniteArticle(color);
        await pline(`${glow.charAt(0).toUpperCase()}${glow.slice(1)} glow surrounds you.`);
    }
    if (rn2(2) || !await attrcurse())
        await rndcurse();
}
// C pray.c:fry_by_god().
export async function fryByGod(alignment, disintegration = false, state = game) {
    await pline(disintegration
        ? 'You disintegrate into a pile of dust!' : 'You fry to a crisp!');
    return finishHeroDeath({
        killer: `the wrath of ${deityName(alignment, state)}`,
        deathLineShown: true,
    });
}
// C pray.c:god_zaps_you().
export async function godZapsHero(alignment, state = game) {
    requirePlayingGame(state);
    const hero = state.u;
    if (hero.uswallow) {
        await pline('Suddenly a bolt of lightning comes down at you from the heavens!');
        await strikeSwallower(false, state);
    }
    else {
        await pline('Suddenly, a bolt of lightning strikes you!');
        if (heroReflectsRay(state)) {
            await shieldeff(hero.ux, hero.uy, state);
            if (heroIsBlind(state))
                await pline("For some reason you're unaffected.");
            else {
                const reflection = ureflects(state);
                if (reflection) {
                    await pline(`It reflects from your ${reflection.noun}.`);
                    discoverHeroReflectionSource(reflection, state);
                }
            }
            monstersObserveHeroResistance(M_SEEN_REFL, state);
        }
        else if (hero.shockResistance || propertyIsActive('shockResistance', state)) {
            await shieldeff(hero.ux, hero.uy, state);
            await pline('It seems not to affect you.');
            monstersObserveHeroResistance(M_SEEN_ELEC, state);
            monstersForgetHeroResistance(M_SEEN_REFL, state);
        }
        else {
            if (await fryByGod(alignment, false, state))
                return;
            monstersForgetHeroResistance(M_SEEN_REFL | M_SEEN_ELEC, state);
        }
    }
    if (state.program_state.gameover)
        return;
    await pline(`${deityName(alignment, state)} is not deterred...`);
    if (hero.uswallow) {
        await strikeSwallower(true, state);
        return;
    }
    await pline('A wide-angle disintegration beam hits you!');
    for (const slot of DISINTEGRATION_ARMOR) {
        const armor = state[slot] || hero[slot];
        if (!armor)
            continue;
        const cloak = state.uarmc || hero.uarmc;
        const suit = state.uarm || hero.uarm;
        if (slot === 'uarm' && cloak || slot === 'uarmu' && (suit || cloak))
            continue;
        const protectedArmor = wornObjectGrantsProperty(armor, 'reflection', state)
            || wornObjectGrantsProperty(armor, 'disintegrationResistance', state);
        if (slot !== 'uarmu' && protectedArmor)
            continue;
        await disintegrateWornArmor(armor, { state });
        if (state.program_state.gameover)
            return;
    }
    if (hero.disintegrationResistance || propertyIsActive('disintegrationResistance', state)) {
        await pline('You bask in its black glow for a minute...');
        await godVoice(alignment, 'I believe it not!', state);
        monstersObserveHeroResistance(M_SEEN_DISINT, state);
    }
    else {
        if (await fryByGod(alignment, true, state))
            return;
        monstersForgetHeroResistance(M_SEEN_DISINT, state);
    }
    const sanctum = state.sanctum_level;
    const highTemple = Is_astralevel(hero.uz)
        || sanctum && sanctum.dnum === hero.uz.dnum && sanctum.dlevel === hero.uz.dlevel;
    if (highTemple) {
        await pline('"Thou cannot escape my wrath, mortal!"');
        for (let count = 0; count < 3; count++)
            await summonMinion(alignment);
        await pline(`"Destroy ${state.flags.female ? 'her' : 'him'}, my servants!"`);
    }
}
// Part of C pray.c:god_zaps_you(): the swallowed-hero strikes on the
// swallower.
async function strikeSwallower(disintegration, state) {
    const monster = state.u.ustuck;
    if (!monster)
        throw new Error('Divine lightning requires the swallowing monster');
    await pline(disintegration
        ? `A wide-angle disintegration beam aimed at you hits ${monsterName(monster, { state })}!`
        : `It strikes ${monsterName(monster, { state })}!`);
    const resisted = disintegration
        ? monsterHasDisintegrationResistance(monster) : monsterHasShockResistance(monster);
    if (resisted) {
        await pline(`${monsterName(monster, { state, capitalized: true })} seems unaffected.`);
        return;
    }
    const fate = disintegration ? 'disintegrates into a pile of dust' : 'fries to a crisp';
    await pline(`${monsterName(monster, { state, capitalized: true })} ${fate}!`);
    await finishHeroMonsterKill(monster, monster.mx, monster.my, {
        showKillMessage: false, recordConduct: false, noCorpse: disintegration,
    });
}
// ---------------------------------------------------------------------------
// Divine gifts and crowning (divine_gifts)
// ---------------------------------------------------------------------------
const RUNESWORD = OBJECT_NAMES.indexOf('runesword');
const SPE_FINGER_OF_DEATH = OBJECT_NAMES.indexOf('finger of death');
const SPE_RESTORE_ABILITY = OBJECT_NAMES.indexOf('restore ability');
const DIVINE_PROPERTIES = ['telepathy', 'fast', 'stealth'];
const CROWNING_PROPERTIES = [
    'seeInvisible', 'fireResistance', 'coldResistance', 'shockResistance',
    'sleepResistance', 'poisonResistance',
];
// Part of C pray.c:pleased(): the gratuitous-favor dispatch.
export async function grantPrayerFavor(choice, alignment) {
    requirePlayingGame(game);
    switch (choice) {
        case 1:
            await blessWieldedWeapon();
            return;
        case 3:
            if (await revealCastleTune(alignment))
                return;
            // Once the tune is known, this favor becomes healing.
            await restoreHeroVigor();
            return;
        case 2:
            await restoreHeroVigor();
            return;
        case 4:
            await uncurseInventory();
            return;
        case 5:
            await grantDivineProperty();
            return;
        case 7:
        case 8:
            if (game.u.ualign.record >= 20 && !game.u.uevent?.uhand_of_elbereth) {
                await crownHero();
                return;
            }
            // A hero cannot be crowned twice.
            await giveSpell();
            return;
        case 6: await giveSpell();
    }
}
// Part of C pray.c:pleased(): the bless-wielded-weapon favor.
async function blessWieldedWeapon() {
    requirePlayingGame(game);
    const weapon = game.uwep;
    if (!weapon || !(willWeld(weapon) || isWeapon(weapon)))
        return;
    const damaged = weapon.oeroded || weapon.oeroded2;
    const repair = damaged ? ` and ${weapon.quan > 1 ? 'are' : 'is'} now as good as new` : '';
    const changed = weapon.cursed || !weapon.blessed;
    if (weapon.cursed) {
        await pline(heroIsBlind(game)
            ? formatFeltMessage(`the power of ${deityName(game.u.ualign.type)} over ${ownedObjectName(weapon, game, { capitalized: false })}.`)
            : `${ownedObjectAction(weapon, 'softly glow')} ${displayColorName('amber')}${repair}.`);
        if (!heroIsBlind(game))
            game._lastPlineKind = PLNMSG_OBJ_GLOWS;
        const oldLight = objectLightRadius(weapon);
        uncurseObjectState(weapon);
        await adjustObjectLightAfterBlessing(weapon, oldLight);
        weapon.bknown = true;
    }
    else if (!weapon.blessed) {
        const color = heroIsBlind(game) ? null : displayColorName('light blue');
        await pline(color === null
            ? formatFeltMessage(`the blessing of ${deityName(game.u.ualign.type)} over ${ownedObjectName(weapon, game, { capitalized: false })}.`)
            : `${ownedObjectAction(weapon, 'softly glow')} with ${withIndefiniteArticle(color)} aura${repair}.`);
        if (color !== null)
            game._lastPlineKind = PLNMSG_OBJ_GLOWS;
        const oldLight = objectLightRadius(weapon);
        blessObjectState(weapon);
        await adjustObjectLightAfterBlessing(weapon, oldLight);
        weapon.bknown = true;
    }
    if (damaged) {
        weapon.oeroded = weapon.oeroded2 = 0;
        if (!changed)
            await pline(`${ownedObjectAction(weapon, heroIsBlind(game) ? 'feel' : 'look')} as good as new!`);
    }
}
// Part of C pray.c:pleased(): the full-healing favor.
async function restoreHeroVigor() {
    requirePlayingGame(game);
    const hero = game.u;
    if (!heroIsBlind(game)) {
        const color = displayColorName('golden');
        await pline(`You are surrounded by ${withIndefiniteArticle(color)} glow.`);
    }
    if (hero.ulevel < hero.ulevelmax) {
        hero.ulevelmax--;
        await gainExperienceLevel();
    }
    else {
        hero.uhpmax += 5;
        hero.uhppeak = Math.max(hero.uhppeak || 0, hero.uhpmax);
        if (Upolyd(hero))
            hero.mhmax += 5;
    }
    hero.uhp = hero.uhpmax;
    if (Upolyd(hero))
        hero.mh = hero.mhmax;
    if (hero.acurr.a[A_STR] < hero.amax.a[A_STR]) {
        hero.acurr.a[A_STR] = hero.amax.a[A_STR];
        game.context.botl = true;
        await encumber_msg(game, pline);
    }
    if (hero.uhunger < 900)
        await init_uhunger(game, pline);
    hero.uluck = Math.max(0, hero.uluck || 0);
    hero.ucreamed = 0;
    const { regainedSight } = setHeroBlindnessTurns(0);
    if (regainedSight)
        await pline('You can see again.');
    game.context.botl = true;
}
// Part of C pray.c:pleased(): the castle-tune favor.
async function revealCastleTune(alignment) {
    requirePlayingGame(game);
    const event = game.u.uevent ||= {};
    if (event.uopened_dbridge || event.gehennom_entered || (event.uheard_tune ?? 0) >= 2)
        return false;
    if (!event.uheard_tune) {
        await godVoice(alignment);
        await pline(`"Hark, ${monsterIsHuman(game.u.umonnum) ? 'mortal' : 'creature'}!"`);
        await pline('"To enter the castle, thou must play the right tune!"');
    }
    else {
        await publishHeardMessage('a divine music...', pline);
        await pline(`It sounds like:  "${game.castleTune}".`);
        recordAchievement(game, ACH_TUNE);
    }
    event.uheard_tune = (event.uheard_tune || 0) + 1;
    return true;
}
// Part of C pray.c:pleased(): the uncurse-inventory favor.
async function uncurseInventory() {
    requirePlayingGame(game);
    const blind = heroIsBlind(game);
    if (blind)
        await pline(formatFeltMessage(`the power of ${deityName(game.u.ualign.type)}.`));
    else {
        const color = displayColorName('light blue');
        await pline(`You are surrounded by ${withIndefiniteArticle(color)} aura.`);
    }
    for (const object of game.inventory) {
        if (!object.cursed || object === game.uarmh && object.otyp === HELM_OF_OPPOSITE_ALIGNMENT)
            continue;
        if (!blind) {
            await pline(`${ownedObjectAction(object, 'softly glow')} ${displayColorName('amber')}.`);
            game._lastPlineKind = PLNMSG_OBJ_GLOWS;
            object.bknown = true;
        }
        const oldLight = objectLightRadius(object);
        uncurseObjectState(object);
        await adjustObjectLightAfterBlessing(object, oldLight);
    }
}
// Part of C pray.c:pleased(): the intrinsic-gift favor.
async function grantDivineProperty() {
    requirePlayingGame(game);
    await godVoice(game.u.ualign.type, 'Thou hast pleased me with thy progress,');
    const gift = DIVINE_PROPERTIES.find(property => !hasPermanentIntrinsicProperty(property));
    let name;
    if (gift) {
        grantIntrinsicProperty(gift, 'outside');
        name = { telepathy: 'Telepathy', fast: 'Speed', stealth: 'Stealth' }[gift];
        if (gift === 'telepathy' && heroIsBlind(game))
            await see_monsters();
    }
    else {
        if (!hasPermanentIntrinsicProperty('protection')) {
            grantIntrinsicProperty('protection', 'outside');
            if (!game.u.ublessed)
                game.u.ublessed = rn1(3, 2);
        }
        else
            game.u.ublessed = (game.u.ublessed || 0) + 1;
        game._armorClassDirty = true;
        name = 'my protection';
    }
    await pline(`"and thus I grant thee the gift of ${name}!"`);
    await pline('"Use it wisely in my name!"');
}
// C pray.c:at_your_feet().
export async function announceDivineGift(description) {
    requirePlayingGame(game);
    if (heroIsBlind(game))
        description = 'Something';
    description = description.charAt(0).toUpperCase() + description.slice(1);
    if (game.u.uswallow) {
        const monster = game.u.ustuck;
        if (!monster)
            throw new Error('A swallowed hero must have a swallowing monster');
        const name = monsterName(monster);
        const owner = /s$/.test(name) ? `${name}'` : `${name}'s`;
        const stomach = mbodypart(monster.mnum, STOMACH);
        await pline(`${description} drops into ${owner} ${stomach}.`);
    }
    else {
        await pline(`${description} ${heroIsBlind(game) ? 'lands' : 'appears'} ${game.u.levitating ? 'beneath' : 'at'} your ${makePlural(body_part(FOOT))}!`);
    }
}
// Part of C pray.c:gcrownu(): the at-your-feet gift placement.
async function dropGift(object, description) {
    await announceDivineGift(description);
    if (game.u.uswallow) {
        const monster = game.u.ustuck;
        if (!monster)
            throw new Error('A swallowed hero must have a swallowing monster');
        await addObjectToMonsterInventory(monster, object);
    }
    else
        await landFloorObject(object, game.u.ux, game.u.uy);
}
// C pray.c:give_spell().
async function giveSpell() {
    requirePlayingGame(game);
    const book = await mkobj(-SPBOOK_CLASS, true);
    const skills = ensureHeroSkills(game);
    if (!skills)
        throw new Error('Divine spell gifts require initialized hero skills');
    let tries = game.u.ulevel + 1;
    while (--tries > 0) {
        if (book.otyp === SPE_BLANK_PAPER) {
            if (!game._knownObjectTypes?.has(book.otyp)
                || game.inventory.some(object => object.otyp === MAGIC_MARKER))
                break;
        }
        else {
            const skill = SKILL_NAMES.indexOf(`${OBJECT_SPELL_CATEGORY[book.otyp]} spells`);
            if (['unknown', 'forgotten'].includes(knownSpell(book.otyp)) && (skills[skill]?.skill ?? 0) > 0)
                break;
        }
        book.otyp = rndClass(getObjectClassBounds(SPBOOK_CLASS).first, SPE_BLANK_PAPER);
    }
    let knowledge;
    if (book.otyp !== SPE_BLANK_PAPER && !rn2(4)
        && (knowledge = knownSpell(book.otyp)) !== 'fresh') {
        const letter = forceLearnSpell(book.otyp);
        if (letter) {
            await pline(knowledge === 'unknown'
                ? `Divine knowledge of ${OBJ_NAME(book.otyp)} fills your mind!  Spell '${letter}'.`
                : `Your knowledge of spell '${letter}' - ${OBJ_NAME(book.otyp)} is ${knowledge === 'forgotten' ? 'restored' : 'refreshed'}.`);
        }
        await deleteObject(book);
    }
    else {
        book.dknown = true;
        recordObjectEncounter(book.otyp);
        if (book.otyp === SPE_BLANK_PAPER || !rn2(100))
            learnObjectType(book.otyp);
        blessObjectState(book);
        const name = simpleObjectNameWithArticle(book);
        await announceDivineGift(name.charAt(0).toUpperCase() + name.slice(1));
        placeCreatedObject(book, game.u.ux, game.u.uy);
        await newsym(game.u.ux, game.u.uy);
    }
}
// C pray.c:gcrownu().
async function crownHero() {
    requirePlayingGame(game);
    const hero = game.u;
    for (const property of CROWNING_PROPERTIES)
        grantIntrinsicProperty(property, 'outside');
    await godVoice(hero.ualign.type);
    const heldArtifact = artifactById(game.uwep?.oartifact)?.name;
    let classGift = null;
    if (game.urole.key === 'wizard' && heldArtifact !== 'Vorpal Blade' && heldArtifact !== 'Stormbringer'
        && !game.inventory.some(object => object.otyp === SPE_FINGER_OF_DEATH))
        classGift = SPE_FINGER_OF_DEATH;
    else if (game.urole.key === 'monk' && !game.uwep?.oartifact
        && !game.inventory.some(object => object.otyp === SPE_RESTORE_ABILITY))
        classGift = SPE_RESTORE_ABILITY;
    let object = isWeapon(game.uwep) ? game.uwep : null;
    const artifact = artifactByName(hero.ualign.type > 0 ? 'Excalibur'
        : hero.ualign.type < 0 ? 'Stormbringer' : 'Vorpal Blade');
    if (!artifact)
        throw new Error('The crowning artifact must be present in the artifact definitions');
    const existing = game._artifactExists?.has(artifact.id);
    const held = heldArtifact === artifact.name;
    const event = hero.uevent ||= {};
    event.uhand_of_elbereth = hero.ualign.type > 0 ? 1 : hero.ualign.type < 0 ? 3 : 2;
    const deity = deityName(hero.ualign.type);
    if (hero.ualign.type > 0) {
        await pline('"I crown thee...  The Hand of Elbereth!"');
        recordGameLogEvent(`was crowned "The Hand of Elbereth" by ${deity}`, { flags: LL_DIVINEGIFT });
    }
    else if (hero.ualign.type === 0) {
        await pline('"Thou shalt be my Envoy of Balance!"');
        recordGameLogEvent(`became ${deity}${deity.endsWith('s') ? "'" : "'s"} Envoy of Balance`, { flags: LL_DIVINEGIFT });
    }
    else {
        const action = (existing && !held) || classGift ? 'take lives' : 'steal souls';
        await pline(`"Thou art chosen to ${action} for My Glory!"`);
        recordGameLogEvent(`was chosen to ${action} for the Glory of ${deity}`, { flags: LL_DIVINEGIFT });
    }
    if (classGift) {
        object = await mksobj(classGift, true, false);
        blessObjectState(object);
        object.bknown = object.dknown = true;
        recordObjectEncounter(object.otyp);
        const name = simpleObjectNameWithArticle(object);
        await dropGift(object, name.charAt(0).toUpperCase() + name.slice(1));
        hero.ugifts = (hero.ugifts || 0) + 1;
        recordGameLogEvent(`was bestowed with spellbook of ${OBJ_NAME(classGift)}`, { flags: LL_DIVINEGIFT | LL_ARTIFACT | LL_SPOILER });
        if (knownSpell(classGift) !== 'unknown' && isWeapon(game.uwep))
            object = game.uwep;
    }
    if (hero.ualign.type > 0) {
        if (!classGift && object?.otyp === LONG_SWORD && !object.oartifact) {
            if (!heroIsBlind(game))
                await pline('Your sword shines brightly for a moment.');
            const before = objectName(object);
            if (nameArtifact(object, artifact, { origin: 'gift', knownOrigin: true })) {
                hero.ugifts = (hero.ugifts || 0) + 1;
                recordGameLogEvent(`had ${game.flags.female ? 'her' : 'his'} wielded ${before} transformed into ${artifact.name}`, { flags: LL_DIVINEGIFT | LL_ARTIFACT });
            }
        }
    }
    else {
        const blackSword = hero.ualign.type < 0 ? `${displayColorName('black')} sword` : null;
        if (!classGift && object && held) {
            if (hero.ualign.type === 0) {
                if (!heroIsBlind(game))
                    observeObject(object);
                findArtifact(object);
                await pline(`Your ${objectName(object)} goes snicker-snack!`);
            }
            else {
                await pline(`Your ${blackSword} hums ominously!`);
            }
            observeObject(object);
        }
        else if (!classGift && !existing) {
            object = await mksobj(hero.ualign.type < 0 ? RUNESWORD : LONG_SWORD, false, false);
            nameArtifact(object, artifact, { origin: 'gift', knownOrigin: true });
            object.spe = 1;
            await dropGift(object, blackSword ? withIndefiniteArticle(blackSword) : 'A sword');
            hero.ugifts = (hero.ugifts || 0) + 1;
            recordGameLogEvent(`was bestowed with ${artifact.name}`, { flags: LL_DIVINEGIFT | LL_ARTIFACT });
        }
    }
    unrestrictHeroSkill(hero.ualign.type < 0 ? P_BROAD_SWORD : P_LONG_SWORD);
    if (object?.oartifact === artifact.id)
        discoverArtifact(artifact.id);
    if (isWeapon(object)) {
        const oldLight = objectLightRadius(object);
        blessObjectState(object);
        await adjustObjectLightAfterBlessing(object, oldLight);
        object.oeroded = object.oeroded2 = 0;
        object.oerodeproof = object.bknown = object.rknown = true;
        object.spe = Math.max(1, object.spe);
        unrestrictHeroSkill(Math.abs(objectSkill(object.otyp)));
    }
    else if (!classGift)
        await pline(formatFeltMessage('unworthy.'));
    await addHeroWeaponSkillSlots(1);
}
// Part of C pray.c:pleased(), gcrownu(): the weapon-or-weptool test.
function isWeapon(object) {
    return !!object && (object.oclass === WEAPON_CLASS
        || isWeaponTool(object));
}
// ---------------------------------------------------------------------------
// Altar sacrifice (sacrifice)
// ---------------------------------------------------------------------------
const PM_ACID_BLOB = MONSTER_NAME.indexOf('acid blob');
const PM_WRAITH = MONSTER_NAME.indexOf('wraith');
const MAX_VALUE = 24;
// Port only: asserts a corpse offering carries its species and age.
function requireCorpseOffering(object) {
    if (object.otyp !== CORPSE || object.corpsenm === undefined || object.age === undefined)
        throw new Error('A corpse offering requires its species and creation time.');
}
// C pray.c:dosacrifice().
export async function dosacrifice() {
    const game = requireInitializedGame();
    game.context.move = 0;
    const hero = game.u;
    const altar = game.level.requireAt(hero.ux, hero.uy);
    if (altar.typ !== ALTAR || hero.uswallow) {
        await pline(`You are not ${hero.levitating || hero.flying ? 'over' : 'on'} an altar.`);
        return;
    }
    if (propertyIsActive('confusion') || propertyIsActive('stunned')) {
        await pline('You are too impaired to perform the rite.');
        return;
    }
    const offering = await chooseOffering();
    if (!offering)
        return;
    game.context.move = 1;
    const alignment = Amask2align(altar.flags);
    const highAltar = !!(altar.flags & AM_SANCTUM);
    if (offering.otyp === AMULET_OF_YENDOR) {
        if (highAltar)
            await offerAmulet(offering, alignment);
        else
            await offerAmuletTooSoon(alignment);
    }
    else if (offering.otyp === FAKE_AMULET_OF_YENDOR) {
        await offerFakeAmulet(offering, highAltar, alignment);
    }
    else if (offering.otyp === CORPSE) {
        await offerCorpse(offering, highAltar, alignment);
    }
    else {
        await pline('Nothing happens.');
    }
    // dosacrifice() returns ECMD_TIME even after savelife() clears move.
    game.context.move = 1;
}
// Part of C pray.c:dosacrifice(): its sacrifice chooser; also inlines
// C eat.c:offer_ok() as the chooser callback at the end (corpses, and
// amulets of Yendor only; astral downplays the mismatch).
async function chooseOffering() {
    const game = requireInitializedGame();
    const hero = game.u;
    let declinedFloor = false;
    if (!game.iflags.menu_requested && heroCanReachFloor(game, { checkPit: true })) {
        const corpses = (game.level.objects?.[hero.ux]?.[hero.uy] || [])
            .filter(object => object.otyp === CORPSE);
        for (const corpse of corpses) {
            if (heroIsBlind(game) && !(game.uarmg || hero.uarmg)
                && !heroResistsStoning() && touchPetrifies(corpse.corpsenm)) {
                await feelPetrifyingCorpse(corpse);
                return null;
            }
            const single = objectQuantity(corpse) === 1;
            observeObjectForNaming(corpse);
            const answer = await promptYesNoQuit(`There ${single ? 'is' : 'are'} ${await floorObjectDescription(corpse)} here; sacrifice ${single ? 'it' : 'one'}?`, 'n');
            if (answer === 'y')
                return corpse;
            if (answer === 'q')
                return null;
            declinedFloor = true;
        }
    }
    const astral = Is_astralevel(hero.uz);
    const object = await chooseInventoryObject('sacrifice', object => {
        if (object.oclass !== FOOD_CLASS && object.oclass !== AMULET_CLASS)
            return GETOBJ_EXCLUDE;
        if (![CORPSE, AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR].includes(object.otyp))
            return GETOBJ_EXCLUDE_SELECTABLE;
        return astral !== (object.oclass === AMULET_CLASS) ? GETOBJ_DOWNPLAY : GETOBJ_SUGGEST;
    }, { hands: declinedFloor ? GETOBJ_EXCLUDE_NONINVENT : GETOBJ_EXCLUDE });
    if (object && object.oclass !== AMULET_CLASS && object.otyp !== CORPSE) {
        await pline("You can't sacrifice that!");
        return null;
    }
    return object;
}
// C pray.c:offer_corpse().
async function offerCorpse(corpse, highAltar, alignment) {
    const game = requireInitializedGame();
    requireCorpseOffering(corpse);
    const hero = game.u;
    const conduct = hero.uconduct ||= {};
    if (!conduct.gnostic)
        recordGameLogEvent(`rejected atheism by offering ${await inventoryItemDescription(corpse)} on an altar of ${deityName(alignment)}`, { flags: LL_CONDUCT });
    conduct.gnostic = (conduct.gnostic || 0) + 1;
    await feelPetrifyingCorpse(corpse, { forceTouch: true });
    if (game.program_state.gameover)
        return;
    if (isRider(corpse.corpsenm)) {
        await pline('At your touch, the corpse suddenly moves...');
        const revival = await reviveCorpseImmediately(corpse);
        for (const message of revival?.messages ?? [])
            await pline(message);
        await exerciseAttribute(A_WIS, false);
        return;
    }
    if (your_race(corpse.corpsenm)) {
        await offerOwnRace(corpse, highAltar, alignment);
        return;
    }
    if (corpse.oextra?.omonst?.mtame) {
        await pline('So this is how you repay loyalty?');
        adjustHeroAlignment(-3);
        grantIntrinsicProperty('aggravateMonster', 'outside');
        await rejectOffering(highAltar, alignment);
        return;
    }
    const value = await offeringValue(corpse, alignment);
    if (value === 0) {
        await pline('Nothing happens.');
        return;
    }
    if (value < 0) {
        await rejectOffering(highAltar, alignment);
        return;
    }
    if (alignment !== hero.ualign.type) {
        if (highAltar)
            await desecrateAltar(true, alignment);
        else
            await offerToAnotherGod(corpse, alignment);
        return;
    }
    await consumeOffering(corpse);
    await rewardOffering(value);
}
// C pray.c:eval_offering()
// Also C pray.c:sacrifice_value(): corpse freshness and nutrition are inlined here
async function offeringValue(corpse, alignment) {
    const game = requireInitializedGame();
    const age = corpse.on_ice ? corpse.age + Math.trunc((game.moves - corpse.age) / 2) : corpse.age;
    if (corpse.corpsenm !== PM_ACID_BLOB && game.moves > age + 50)
        return 0;
    const difficulty = MONSTER_DIFFICULTY[corpse.corpsenm];
    if (difficulty === undefined)
        throw new RangeError(`Unknown sacrifice species ${corpse.corpsenm}`);
    let value = difficulty + 1;
    if (corpse.oeaten) {
        const body = MONSTER_BODY_META[corpse.corpsenm];
        if (!body)
            throw new RangeError(`Unknown corpse body ${corpse.corpsenm}`);
        const nutrition = body[1];
        value = Math.max(1, nutrition
            ? Math.trunc(value * Math.min(corpse.oeaten, nutrition) / nutrition) : 0);
    }
    const hero = game.u;
    if (monsterIsUndead(corpse.corpsenm)) {
        if (hero.ualign.type !== -1 || corpse.corpsenm === PM_WRAITH && hero.uconduct?.unvegetarian)
            value++;
    }
    else if (monsterIsUnicorn(corpse.corpsenm)) {
        const unicornAlignment = Math.sign(MONSTER_ALIGNMENT[corpse.corpsenm] ?? 0);
        if (unicornAlignment === alignment) {
            const insult = alignment < 0 ? 'chaos' : alignment > 0 ? 'law' : 'balance';
            await pline(`Such an action is an insult to ${insult}!`);
            adjustAttribute(A_WIS, -1);
            return -1;
        }
        if (hero.ualign.type === alignment) {
            const name = alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
            await pline(formatFeltMessage(hero.ualign.record < alignmentLimit() ? `appropriately ${name}.` : 'you are thoroughly on the right path.'));
            adjustHeroAlignment(5);
            value += 3;
        }
        else if (unicornAlignment === hero.ualign.type) {
            hero.ualign.record = -1;
            value = 1;
        }
        else
            value += 3;
    }
    return value;
}
// C pray.c:consume_offering().
async function consumeOffering(object) {
    const game = requireInitializedGame();
    if (heroIsHallucinating(game)) {
        const messages = [
            'Your sacrifice sprouts wings and a propeller and roars away!',
            'Your sacrifice puffs up, swelling bigger and bigger, and pops!',
            'Your sacrifice collapses into a cloud of dancing particles and fades away!',
        ];
        const message = messages[rn2(messages.length)];
        if (message === undefined)
            throw new Error('Sacrifice message RNG selected an invalid entry.');
        await pline(message);
    }
    else if (heroIsBlind(game) && game.u.ualign.type === 1) {
        await pline('Your sacrifice disappears!');
    }
    else {
        const effect = game.u.ualign.type === 1 ? 'flash of light'
            : game.u.ualign.type === 0 ? 'plume of smoke' : 'burst of flame';
        await pline(`Your sacrifice is consumed in a ${effect}!`);
    }
    await useOffering(object);
    await exerciseAttribute(A_WIS, true);
}
// C pray.c: carried offerings go through useup(), floor ones useupf(..., 1).
async function useOffering(object) {
    const game = requireInitializedGame();
    if (game.inventory.includes(object)) {
        await consumeInventoryItem(object);
    }
    else {
        await useUpFloorObject(object, 1, { state: game });
        if (game.u.uundetected && heroFormHidesUnderObjects()
            && !game.level.objects?.[game.u.ux]?.[game.u.uy]?.length)
            game.u.uundetected = false;
        await newsym(game.u.ux, game.u.uy);
    }
}
// C pray.c:offer_negative_valued().
async function rejectOffering(highAltar, alignment) {
    const game = requireInitializedGame();
    if (highAltar && alignment !== game.u.ualign.type)
        await desecrateAltar(true, alignment);
    else
        await godsUpset(alignment);
}
// C pray.c:offer_different_alignment_altar().
async function offerToAnotherGod(corpse, alignment) {
    const game = requireInitializedGame();
    const hero = game.u;
    if (hero.ualign.record < 0 || alignment === A_NONE && inHell()) {
        const original = hero.ualignbase?.[1] ?? hero.ualign.type;
        const current = hero.ualignbase?.[0] ?? hero.ualign.type;
        if (current === original && alignment !== A_NONE) {
            await pline(`You have a strong feeling that ${deityName(hero.ualign.type)} is angry...`);
            await consumeOffering(corpse);
            await pline(`${deityName(alignment)} accepts your allegiance.`);
            if (alignment !== -1 && alignment !== 0 && alignment !== 1)
                throw new Error(`Cannot convert to altar alignment ${alignment}`);
            await changeHeroAlignment(alignment, 'convert');
            if (game.program_state.gameover)
                return;
            changeHeroLuck(-3);
            hero.ublesscnt = (hero.ublesscnt || 0) + 300;
        }
        else {
            hero.ugangr = (hero.ugangr || 0) + 3;
            adjustHeroAlignment(-5);
            await pline(`${deityName(alignment)} rejects your sacrifice!`);
            await godVoice(alignment, 'Suffer, infidel!');
            changeHeroLuck(-5);
            adjustAttribute(A_WIS, -2);
            if (!inHell())
                await angryGods(hero.ualign.type);
        }
        return;
    }
    await consumeOffering(corpse);
    await pline(`You sense a conflict between ${deityName(hero.ualign.type)} and ${deityName(alignment)}.`);
    if (rn2(8 + hero.ulevel) > 5) {
        await pline(formatFeltMessage(`the power of ${deityName(hero.ualign.type)} increase.`));
        await exerciseAttribute(A_WIS, true);
        changeHeroLuck(1);
        const altar = game.level.requireAt(hero.ux, hero.uy);
        altar.flags = Align2amask(hero.ualign.type) | (altar.flags & AM_SHRINE);
        await newsym(hero.ux, hero.uy);
        if (!heroIsBlind(game)) {
            const color = hero.ualign.type > 0 ? 'white' : hero.ualign.type < 0 ? 'black' : 'gray';
            await pline(`The altar glows ${displayColorName(color)}.`);
        }
        if (rnl(hero.ulevel) > 6 && hero.ualign.record > 0
            && rnd(hero.ualign.record) > Math.trunc(3 * alignmentLimit() / 4))
            await summonMinion(alignment, true);
        await angerTemplePriest(game, true);
    }
    else {
        await pline(`Unluckily, you feel the power of ${deityName(hero.ualign.type)} decrease.`);
        changeHeroLuck(-1);
        await exerciseAttribute(A_WIS, false);
        if (rnl(hero.ulevel) > 6 && hero.ualign.record > 0
            && rnd(hero.ualign.record) > Math.trunc(7 * alignmentLimit() / 8))
            await summonMinion(alignment, true);
    }
}
// C pray.c:sacrifice_your_race().
async function offerOwnRace(corpse, highAltar, alignment) {
    const game = requireInitializedGame();
    const hero = game.u;
    if (monsterIsDemon(hero.umonnum)) {
        await pline('You find the idea very satisfying.');
        await exerciseAttribute(A_WIS, true);
    }
    else if (hero.ualign.type !== -1) {
        await pline("You'll regret this infamous offense!");
        await exerciseAttribute(A_WIS, false);
    }
    if (highAltar && (alignment !== -1 || hero.ualign.type !== -1)) {
        await desecrateAltar(true, alignment);
        return;
    }
    const altar = game.level.requireAt(hero.ux, hero.uy);
    if (alignment !== -1 && alignment !== A_NONE) {
        await pline(`The altar is stained with ${game.urace.adj} blood.`);
        altar.flags = Align2amask(-1);
        await newsym(hero.ux, hero.uy);
        await angerTemplePriest();
    }
    else {
        let failure;
        if (alignment === -1 && hero.ualign.type !== -1) {
            const color = displayColorName('black');
            await pline(`The blood floods the altar, which vanishes in ${withIndefiniteArticle(color)} cloud!`);
            altar.typ = ROOM;
            altar.flags = 0;
            await newsym(hero.ux, hero.uy);
            await angerTemplePriest();
            failure = 'The cloud dissipates.';
        }
        else {
            await pline('The blood covers the altar!');
            changeHeroLuck(alignment === A_NONE ? -2 : 2);
            failure = 'The blood coagulates.';
        }
        const type = demonLord(alignment);
        const demon = type == null ? null : await makemonNear(type, hero.ux, hero.uy, MM_NOMSG);
        if (demon && type !== null) {
            const name = monsterName(demon, { article: 'a' });
            if (name !== 'it')
                demon.mstrategy = (demon.mstrategy ?? 0) & ~STRAT_APPEARMSG;
            await pline(`You have summoned ${name === 'it' ? 'something dreadful' : name}!`);
            if (Math.sign(hero.ualign.type) === Math.sign(MONSTER_ALIGNMENT[type] ?? 0))
                demon.mpeaceful = true;
            await pline('You are terrified, and unable to move.');
            nomul(-3);
            game._helplessReason = 'being terrified of a demon';
            game._helplessDoneMessage = null;
        }
        else
            await pline(failure);
    }
    if (hero.ualign.type !== -1) {
        adjustHeroAlignment(-5);
        hero.ugangr = (hero.ugangr || 0) + 3;
        adjustAttribute(A_WIS, -1);
        if (!inHell())
            await angryGods(hero.ualign.type);
        if (game.program_state.gameover)
            return;
        changeHeroLuck(-5);
    }
    else
        adjustHeroAlignment(5);
    await useOffering(corpse);
}
// Part of C pray.c:offer_corpse(): the offering-value reward dispatch.
async function rewardOffering(value) {
    const game = requireInitializedGame();
    const hero = game.u;
    const hallucinating = heroIsHallucinating(game);
    if ((hero.ugangr ?? 0) > 0) {
        const previous = hero.ugangr ?? 0;
        hero.ugangr = Math.max(0, previous - Math.trunc(value * (hero.ualign.type === -1 ? 2 : 3) / MAX_VALUE));
        if (hero.ugangr === previous) {
            await pline(hallucinating ? 'The gods seem tall.' : 'You have a feeling of inadequacy.');
        }
        else {
            const mood = hero.ugangr ? (hallucinating ? 'groovy' : 'slightly mollified')
                : (hallucinating ? 'cosmic (not a new fact)' : 'mollified');
            await pline(`${deityName(hero.ualign.type)} seems ${mood}.`);
            if ((hero.uluck ?? 0) < 0) {
                if (hero.ugangr)
                    changeHeroLuck(1);
                else
                    hero.uluck = 0;
            }
        }
    }
    else if (hero.ualign.record < 0) {
        adjustHeroAlignment(Math.min(value, MAX_VALUE, -hero.ualign.record));
        await pline(formatFeltMessage('partially absolved.'));
    }
    else if (hero.ublesscnt > 0) {
        const previous = hero.ublesscnt;
        hero.ublesscnt = Math.max(0, previous - Math.trunc(value * (hero.ualign.type === -1 ? 500 : 300) / MAX_VALUE));
        if (hero.ublesscnt !== previous) {
            await pline(hero.ublesscnt
                ? (hallucinating ? 'You realize that the gods are not like you and I.' : 'You have a hopeful feeling.')
                : (hallucinating ? 'Overall, there is a smell of fried onions.' : 'You have a feeling of reconciliation.'));
            if ((hero.uluck ?? 0) < 0) {
                if (hero.ublesscnt)
                    changeHeroLuck(1);
                else
                    hero.uluck = 0;
            }
        }
    }
    else {
        if (await bestowArtifact(value))
            return;
        const previous = hero.uluck || 0;
        const increase = Math.min(Math.trunc(value * LUCKMAX / (MAX_VALUE * 2)), Math.max(0, value - previous));
        changeHeroLuck(increase);
        hero.uluck = Math.max(0, hero.uluck ?? 0);
        if (hero.uluck !== previous) {
            const feet = makePlural(body_part(FOOT));
            await pline(heroIsBlind(game)
                ? `You think something brushed your ${body_part(FOOT)}.`
                : hallucinating ? `You see crabgrass at your ${feet}.  A funny thing in a dungeon.`
                    : `You glimpse a four-leaf clover at your ${feet}.`);
        }
    }
}
// C pray.c:bestow_artifact().
async function bestowArtifact(value) {
    const game = requireInitializedGame();
    const hero = game.u;
    if (hero.ulevel <= 2 || (hero.uluck ?? 0) < 0)
        return false;
    const count = artifactExistCount();
    const selected = game.flags.debug
        ? await promptYesNo('Gift an artifact?') === 'y'
        : rn2(6 + 2 * (hero.ugifts || 0) * count) === 0;
    if (!selected)
        return false;
    const object = await mk_artifact({ object: null, alignment: hero.ualign.type }, value, true);
    if (!object)
        return false;
    if (object.oartifact === undefined)
        throw new Error('An artifact gift requires an artifact id.');
    setArtifactOrigin(object, 'gift', { knownOrigin: true });
    const artifact = artifactById(object.oartifact);
    if (!artifact)
        throw new Error('An artifact gift must have a registered artifact identity.');
    if (object.spe === undefined)
        throw new Error('An artifact gift must have an enchantment value.');
    object.spe = Math.max(0, object.spe);
    if (object.cursed)
        uncurseObjectState(object);
    object.oerodeproof = true;
    const blind = heroIsBlind(game);
    const hallucinating = heroIsHallucinating(game);
    let noun = hallucinating ? 'a doodad' : blind ? 'an object' : simpleObjectNameWithArticle(object);
    if (!blind)
        noun += ` named ${artifact.name.replace(/^The /, '')}`;
    await announceDivineGift(noun);
    await landFloorObject(object, hero.ux, hero.uy);
    await godVoice(hero.ualign.type, 'Use my gift wisely!');
    hero.ugifts = (hero.ugifts || 0) + 1;
    hero.ublesscnt = rnz(300 + 50 * count);
    await exerciseAttribute(A_WIS, true);
    recordGameLogEvent(`was bestowed with ${artifact.name} by ${deityName(hero.ualign.type)}`, { flags: LL_DIVINEGIFT | LL_ARTIFACT });
    const skillType = [WEAPON_CLASS, TOOL_CLASS, GEM_CLASS].includes(object.oclass ?? RANDOM_CLASS)
        ? Math.abs(objectSkill(object.otyp)) : 0;
    unrestrictHeroSkill(skillType);
    if (!hallucinating && !blind) {
        object.dknown = true;
        recordObjectEncounter(object.otyp);
        learnObjectType(object.otyp);
        discoverArtifact(artifact.id);
    }
    return true;
}
// C pray.c:offer_too_soon().
async function offerAmuletTooSoon(alignment) {
    const game = requireInitializedGame();
    if (alignment === A_NONE && inHell())
        await godsUpset(A_NONE);
    else
        await pline(formatFeltMessage(`${heroIsHallucinating(game) ? 'homesick'
            : alignment === game.u.ualign.type ? 'an urge to return to the surface' : 'ashamed'}.`));
}
// C pray.c:offer_fake_amulet().
async function offerFakeAmulet(amulet, highAltar, alignment) {
    const game = requireInitializedGame();
    if (!highAltar && !amulet.known) {
        await offerAmuletTooSoon(alignment);
        return;
    }
    await publishHeardMessage('a nearby thunderclap.', pline);
    if (!amulet.known) {
        await pline(`You realize you have made a ${heroIsHallucinating(game) ? 'boo-boo' : 'mistake'}.`);
        amulet.known = true;
        changeHeroLuck(-1);
    }
    else {
        if (heroIsDeaf(game))
            await pline('Oh, no.');
        changeHeroLuck(-3);
        adjustHeroAlignment(-1);
        game.u.ugangr = (game.u.ugangr || 0) + 3;
        await rejectOffering(highAltar, alignment);
    }
}
// C pray.c:offer_real_amulet()
// Also C pray.c:a_gname(): inlined here using the caller's altar alignment
async function offerAmulet(amulet, alignment) {
    const game = requireInitializedGame();
    const hero = game.u;
    await useOffering(amulet);
    await pline(`You offer the Amulet of Yendor to ${deityName(alignment)}...`);
    if (alignment === A_NONE) {
        hero.ualign.record = Math.min(hero.ualign.record, -99);
        await pline('An invisible choir chants, and you are bathed in darkness...');
        await pline(`Moloch shrugs and retains dominion over ${deityName(hero.ualign.type)},`);
        await pline('then mercilessly snuffs out your life.');
        if (await finishHeroDeath({
            killer: "Moloch's indifference", deathCause: "killed by Moloch's indifference",
            deathLineShown: true,
        }))
            return;
        await pline('Moloch snarls and tries again...');
        if (await fryByGod(A_NONE, true))
            return;
        await pline(`A cloud of ${displayColorName('black')} smoke surrounds you...`);
        await finishLivingGame('escaped');
    }
    else if (alignment !== hero.ualign.type) {
        adjustHeroAlignment(-99);
        await pline(`${deityName(alignment)} accepts your gift, and gains dominion over ${deityName(hero.ualign.type)}...`);
        await pline(`${deityName(hero.ualign.type)} is enraged...`);
        await pline(`Fortunately, ${deityName(alignment)} permits you to live...`);
        await pline(`A cloud of ${displayColorName('orange')} smoke surrounds you...`);
        await finishLivingGame('escaped');
    }
    else {
        (hero.uevent ||= {}).ascended = 1;
        adjustHeroAlignment(10);
        await pline('An invisible choir sings, and you are bathed in radiance...');
        await godVoice(alignment, 'Mortal, thou hast done well!');
        await pline('"In return for thy service, I grant thee the gift of Immortality!"');
        await pline(`You ascend to the status of ${game.flags.female ? 'Demigoddess' : 'Demigod'}...`);
        await finishLivingGame('ascended');
    }
}
// C align.h:ALIGNLIM().
function alignmentLimit() {
    return 10 + Math.trunc(game.moves / 200);
}
//# sourceMappingURL=pray.js.map