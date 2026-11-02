// pray.c owner: prayer trouble detection and repair, divine wrath and gifts,
// and altar sacrifice.  Folded from prayer_trouble/divine_wrath/divine_gifts/
// sacrifice (pure move, no behavior change).
import { recordAchievement } from './achievements.js';
import { adjustHeroAlignment, convertHeroAlignment, deityName } from './alignment.js';
import { ringRemovalObstacle } from './accessory.js';
import {
    artifactById, artifactByName, artifactExistCount, createArtifactGift,
    discoverArtifact, findArtifact, nameArtifact, setArtifactOrigin,
} from './artifacts.js';
import { disintegrateWornArmor, simpleArmorName } from './armor.js';
import type { AttributeIndex } from './attrib.js';
import {
    adjustAttribute, attributeChangeMessage,
    exerciseAttribute,
} from './attrib.js';
import { heroFootName, heroEyeCount, heroEyeName, heroStomachName, monsterStomachName } from './body_parts.js';
import { heroIsPunished } from './ball.js';
import { isRider } from './corpse_species.js';
import { reviveCorpseForHero, reviveCorpseImmediately } from './corpse_revival.js';
import {
    ACH_TUNE, A_CON, A_NONE, A_STR, A_WIS, ALTAR, AM_SANCTUM, AM_SHRINE,
    Align2amask, Amask2align, DISSOLVED, EXT_ENCUMBER, GETOBJ_DOWNPLAY,
    GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_NONINVENT, GETOBJ_EXCLUDE_SELECTABLE,
    GETOBJ_SUGGEST, HUNGRY, HVY_ENCUMBER, IS_OBSTRUCTED, Is_astralevel,
    LUCKMAX, LUCKMIN, M_SEEN_DISINT, M_SEEN_ELEC, M_SEEN_REFL, MM_NOMSG,
    P_BROAD_SWORD, P_LONG_SWORD, PARANOID_CONFIRM, PARANOID_PRAY,
    PLNMSG_OBJ_GLOWS, ROOM, SCORR, SDOOR, STRAT_APPEARMSG, TT_BURIEDBALL,
    TT_LAVA, Upolyd, W_SADDLE, WEAK, isok,
} from './const.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { finishHeroDeath, finishLivingGame } from './end.js';
import { gainExperienceLevel, loseHeroExperience } from './exper.js';
import { landFloorObject } from './floor_effects.js';
import { floorObjectDescription } from './floor_object_display.js';
import { heroCanReachFloor } from './floor_reach.js';
import { useUpFloorObject } from './floor_consumption.js';
import { placeCreatedObject } from './floor_object.js';
import { LL_ARTIFACT, LL_CONDUCT, LL_DIVINEGIFT, LL_SPOILER, recordGameLogEvent } from './gamelog.js';
import {
    game, requireInitializedGame, requirePlayingGame,
} from './gstate.js';
import { announceTerrainRescue, nomul } from './hack.js';
import { AT_ENGL, AD_BLND } from './monster_attack_types.js';
import { adjustObjectLightAfterBlessing, objectLightRadius } from './light.js';
import { angerTemplePriest } from './priest.js';
import {
    makeConfused, makeHallucinated, makeStunned,
} from './hero_mental_status.js';
import { loseHeroHp } from './hero_damage.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { cureHeroSickness, heroIsSick } from './hero_illness.js';
import { healHeroLegs } from './hero_legs.js';
import { confersLuck } from './hero_inventory.js';
import { clearHeroStrangulation, heroIsStrangled } from './hero_strangulation.js';
import { clearHeroTrap, freeHeroFromBuriedBall } from './hero_traps.js';
import {
    currentHungerState, restoreHeroNutrition,
} from './hunger.js';
import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import {
    consumeInventoryItem, inventoryItemDescription,
} from './invent.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { demonLord, summonMinion } from './minion.js';
import { makemonNear } from './mklev.js';
import {
    mkobj, mksobj, blessObjectState, curseObject, uncurseObjectState,
} from './mkobj.js';
import {
    MONSTER_ALIGNMENT, MONSTER_ATTACKS, MONSTER_BODY_META,
    MONSTER_DIFFICULTY, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL,
    monsterIsUnicorn, requireMonsterData,
} from './monster_data.js';
import { monsterName } from './do_name.js';
import {
    monstersForgetHeroResistance, monstersObserveHeroResistance,
    monsterHasDisintegrationResistance, monsterHasShockResistance,
} from './mondata.js';
import { wakeMonstersNearWithMessages } from './mon.js';
import {
    AMULET_OF_STRANGULATION, AMULET_OF_UNCHANGING, AMULET_OF_YENDOR,
    BOULDER, CORPSE, FAKE_AMULET_OF_YENDOR, FUMBLE_BOOTS,
    GAUNTLETS_OF_FUMBLING, HELM_OF_OPPOSITE_ALIGNMENT, LEVITATION_BOOTS,
    LONG_SWORD, LOADSTONE, MAGIC_MARKER, OBJECT_NAMES, OBJECT_SPELL_CATEGORY,
    OBJECT_SUBTYPE, SPE_BLANK_PAPER, STATUE, getObjectClassBounds,
    requireObjectData,
} from './object_data.js';
import type { GameObject } from './object_types.js';
import { makePlural, withIndefiniteArticle } from './objnam.js';
import { isBimanualObject } from './object_properties.js';
import {
    learnObjectType, observeObject, recordObjectEncounter,
} from './o_init.js';
import {
    rndClass, objectName, observeObjectForNaming, ownedObjectAction,
    ownedObjectName, simpleObjectNameWithArticle,
} from './objnam.js';
import { objectQuantity } from './mkobj.js';
import { deleteObject } from './shk.js';
import {
    heroHasNoHands, heroIsUnchanging, heroFormHidesUnderObjects,
    returnHeroToHumanForm,
} from './polyself.js';
import type { PropertyName } from './property_types.js';
import {
    grantIntrinsicProperty, hasIntrinsicProperty,
    hasPermanentIntrinsicProperty, propertyIsActive, refreshProperty,
    wornObjectGrantsProperty,
} from './properties.js';
import { punishHero, unpunishHero } from './punishment.js';
import { paranoidQuery, promptYesNo, promptYesNoQuit } from './query.js';
import { heroIsInDangerousRegion, rescueHeroFromRegion } from './regions.js';
import {
    discoverHeroReflectionSource, heroReflectionSource, heroReflectsRay,
} from './ray.js';
import { d, rn1, rn2, rnl, rnd, rnz } from './rng.js';
import {
    blindfolded, heroIsBlind, heroIsBlinded, heroIsDeaf, heroIsHallucinating,
    permanentBlind, setHeroBlindnessTurns, syncDeafness,
} from './senses.js';
import { makeBlinded } from './sight_change.js';
import {
    adjustWeaponSkillSlots, ensureHeroSkills, SKILL_NAMES, unrestrictHeroSkill,
} from './skills.js';
import { clearHeroSliming, heroIsSliming } from './slime.js';
import { castSpell, forceLearnSpell, knownSpell } from './spell.js';
import {
    clearHeroPetrification, feelPetrifyingCorpse, heroIsPetrifying,
    heroResistsStoning, touchPetrifies,
} from './stoning.js';
import { animateStatue } from './statue_trap.js';
import { addObjectToMonsterInventory } from './steal.js';
import { attrcurse, rndcurse } from './throne.js';
import { teleportHeroSafely } from './teleport.js';
import { turnUndeadByCallingOnDeity } from './turn_undead.js';
import { flushPendingTopline } from './tty_topline.js';
import {
    displayColorName, docrt, newsym, see_monsters, shieldeff,
} from './display.js';
import { heroHasFreeHand } from './engrave.js';
import { isWeldedPrimary, willWeld } from './wield.js';
import { nearCapacity } from './weight.js';
import { purifyHeroLycanthropy } from './were.js';
import { isPoolOrLavaAt } from './terrain_properties.js';
import type { GameState, PlayingGameState, PrayerOutcome } from './game_state.js';
import { pline as printLine } from './pline.js';
import { plineWithContinuation as pline } from './pline.js';

// ---------------------------------------------------------------------------
// Prayer decisions and the three-turn prayer occupation (pray)
// ---------------------------------------------------------------------------

const POT_WATER = OBJECT_NAMES.indexOf('water');
const M2_DEMON = 0x00000100;
const M2_UNDEAD = 0x00000002;

const STRIDENT = 4;
export async function altarWrath(x: number, y: number, state: GameState = game) {
    requirePlayingGame(state);
    const altarAlignment = Amask2align(state.level?.at(x, y)?.flags ?? 0);
    const heroAlignment = state.u?.ualign?.type ?? 0;
    const alignmentRecord = state.u?.ualign?.record ?? 0;
    const deity = deityName(altarAlignment, state);

    if (heroAlignment === altarAlignment && alignmentRecord > -rn2(4)) {
        await godVoice(altarAlignment, 'How darest thou desecrate my altar!', state);
        const change = adjustAttribute(A_WIS, -1, state);
        const message = attributeChangeMessage(A_WIS, change, state);
        if (message) await pline(message);
        state.u.ualign.record = alignmentRecord - 1;
        return;
    }

    await pline(heroIsDeaf(state)
        ? `Despite your deafness, you seem to hear ${deity} say:`
        : `A voice (could it be ${deity}?) whispers:`);
    await pline('"Thou shalt pay, infidel!"');
    const baseLuck = state.u.uluck ?? 0;
    const luck = baseLuck + (state.u.moreluck ?? 0);
    if (luck > -5 && rn2(luck + 6))
        state.u.uluck = Math.max(LUCKMIN, baseLuck - (rn2(20) ? 1 : 2));
}


export async function dopray() {
    const game = requireInitializedGame();
    game.context.move = 0;
    const bits = game.flags.paranoia_bits ?? PARANOID_PRAY;
    if (bits & PARANOID_PRAY) {
        const confirmed = await paranoidQuery(
            !!(bits & PARANOID_CONFIRM), 'Are you sure you want to pray?', bits,
        );
        if (!confirmed) return;
    }
    const hero = game.u;
    const conduct = hero.uconduct;
    if (!conduct.gnostic) recordGameLogEvent('rejected atheism with a prayer', { flags: LL_CONDUCT });
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
            if (outcome === 'too-soon' || outcome === 'angry') outcome = 'pleased';
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
        if (!heroIsBlind(game)) await pline('You are surrounded by a shimmering light.');
        hero.invulnerable = true;
    }
    game.context.move = 1;
}

// C can_pray(FALSE) uses the same trouble, timeout, and deity decision as #pray.
export function canPraySafely(): boolean {
    const game = requireInitializedGame();
    const altar = currentAltar();
    const alignment = altar ? Amask2align(altar.flags) : game.u.ualign.type;
    const trouble = worstPrayerTrouble();
    if (demonRejectsPrayer(alignment)) return false;
    return prayerOutcome(alignment, trouble) === 'pleased' && !inHell();
}

function demonRejectsPrayer(alignment: number): boolean {
    const game = requireInitializedGame();
    return !!(requireMonsterData(MONSTER_FLAGS2, game.u.umonnum) & M2_DEMON) && alignment !== 0;
}

function prayerOutcome(alignment: number, trouble: PrayerTrouble): PrayerOutcome {
    const game = requireInitializedGame();
    const hero = game.u;
    let record = hero.ualign.record;
    if (hero.ualign.type && hero.ualign.type === -alignment) record = -record;
    else if (hero.ualign.type !== alignment) record = Math.trunc(record / 2);
    let outcome: PrayerOutcome;
    if (alignment === A_NONE) outcome = 'moloch';
    else if ((hero.ublesscnt || 0) > (trouble > 0 ? 200 : trouble < 0 ? 100 : 0))
        outcome = 'too-soon';
    else if (luck() < 0 || hero.ugangr || record < 0) outcome = 'angry';
    else outcome = currentAltar() && hero.ualign.type !== alignment ? 'other-god' : 'pleased';
    if (requireMonsterData(MONSTER_FLAGS2, hero.umonnum) & M2_UNDEAD && !inHell()
        && (alignment === 1 || alignment === 0 && !rn2(10))) outcome = 'undead';
    return outcome;
}

// C pray.c:prayer_done().
export async function finishPrayerOccupation(state: GameState = game) {
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
        } else if (outcome === 'undead') {
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
            if (currentAltar() && state.u.ualign.type !== alignment) await changeAltarWater(false);
            if (outcome === 'too-soon') await punishEarlyPrayer();
            else await angryGods(state.u.ualign.type, state);
        } else if (outcome === 'other-god') {
            if (await changeAltarWater(false)) await punishEarlyPrayer();
            else await pleaseGod(alignment);
        } else {
            if (currentAltar()) {
                await reviveAltarPet();
                await changeAltarWater(true);
            }
            await pleaseGod(alignment);
        }
        return { outcome };
    } finally {
        delete state._prayerOutcome;
        delete state._prayerAlignment;
        delete state._prayerTrouble;
    }
}

async function punishEarlyPrayer() {
    const game = requireInitializedGame();
    game.u.ublesscnt = (game.u.ublesscnt || 0) + rnz(250);
    game.u.uluck = Math.max(LUCKMIN, (game.u.uluck || 0) - 3);
    await godsUpset(game.u.ualign.type);
}

// C pray.c:pleased().
async function pleaseGod(alignment: number) {
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
    if (hero.ualign.record < 2 && trouble <= 0) adjustHeroAlignment(1);
    let favor = !trouble && hero.ualign.record >= 14 && game._prayerTrouble === 0;
    if (trouble || hero.ualign.record < 14) {
        const altar = currentAltar();
        let action = rn1(Math.max(luck(), -1) + (altar ? 3 + Number(!!(altar.flags & AM_SHRINE)) : 2), 1);
        if (!altar) action = Math.min(action, 3);
        if (hero.ualign.record < STRIDENT) action = hero.ualign.record > 0 || !rnl(2) ? 1 : 0;
        action = Math.min(action, 5);
        if (action >= 4) {
            favor = action === 5;
            do {
                await fixPrayerTrouble(trouble);
                if (game.program_state.gameover) return;
                trouble = worstPrayerTrouble();
            } while (trouble);
        } else if (action >= 2) {
            if (action === 3) await fixPrayerTrouble(trouble);
            let count = 0;
            while ((trouble = worstPrayerTrouble()) > 0 && ++count < 10) {
                await fixPrayerTrouble(trouble);
                if (game.program_state.gameover) return;
            }
        } else if (action === 1 && trouble > 0) {
            await fixPrayerTrouble(trouble);
        }
    }
    if (game.program_state.gameover) return;
    if (favor) await grantPrayerFavor(rn2((luck() + 6) >> 1), alignment);
    hero.ublesscnt = rnz(350);
    const extra = Number(!!hero.uevent?.udemigod) + Number(!!hero.uevent?.uhand_of_elbereth);
    if (extra) hero.ublesscnt += extra * rnz(1000);
    if (game.moves > 100000)
        hero.ublesscnt += Math.min(Math.trunc((game.moves - 100000) / 100), 32767 - hero.ublesscnt);
}

// C pray.c:water_prayer().
async function changeAltarWater(bless: boolean) {
    const game = requireInitializedGame();
    const hero = game.u;
    let changed = 0;
    let other = false;
    const known = !heroIsBlind(game) && !heroIsHallucinating(game);
    for (const object of game.level.objects[hero.ux]?.[hero.uy] || []) {
        if (object.otyp === POT_WATER && !(bless ? object.blessed : object.cursed)) {
            if (bless) blessObjectState(object);
            else await curseObject(object);
            object.bknown = known;
            changed += object.quan;
        } else if (object.oclass === 8) other = true;
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
    const object = (game.level.objects[hero.ux]?.[hero.uy] || []).find(object =>
        [CORPSE, STATUE].includes(object.otyp)
        && object.oextra?.omonst?.mtame && !object.oextra.omonst.isminion);
    if (!object) return;
    if (object.otyp === CORPSE) await reviveCorpseForHero(object);
    else await animateStatue(object, hero.ux, hero.uy, { magic: true });
}

function currentAltar() {
    const game = requireInitializedGame();
    const location = game.level.requireAt(game.u.ux, game.u.uy);
    return location.typ === ALTAR ? location : null;
}

function inHell() {
    const game = requireInitializedGame();
    return !!game.dungeons?.[game.u.uz.dnum]?.flags?.hellish;
}

function luck() {
    return (game.u.uluck || 0) + (game.u.moreluck || 0);
}

// C ref: pray.c:doturn().
export async function doturn() {
    const role = game.urole?.key;
    if (role !== 'priest' && role !== 'knight') {
        const spell = (game.spells || []).find(known =>
            known.name === 'turn undead');
        if (!spell) {
            await printLine("You don't know how to turn undead!");
            game.context.move = 0;
            return;
        }
        await castSpell(spell.otyp);
        return;
    }

    await turnUndeadByCallingOnDeity(game);
}

// ---------------------------------------------------------------------------
// Trouble detection and repair (prayer_trouble)
// ---------------------------------------------------------------------------

const attributeIndices: readonly AttributeIndex[] = [0, 1, 2, 3, 4, 5];

// Positive values are urgent. The order below follows in_trouble().
export const Trouble = {
    STONED: 14, SLIMED: 13, STRANGLED: 12, LAVA: 11, SICK: 10,
    STARVING: 9, REGION: 8, HIT: 7, LYCANTHROPE: 6, COLLAPSING: 5,
    WALL: 4, LEVITATION: 3, HANDS: 2, BLINDFOLD: 1,
    PUNISHED: -1, FUMBLING: -2, CURSED_ITEM: -3, SADDLE: -4, BLIND: -5,
    POISONED: -6, LEGS: -7, HUNGRY: -8, STUNNED: -9, CONFUSED: -10,
    HALLUCINATING: -11,
} as const;
export type PrayerTrouble = typeof Trouble[keyof typeof Trouble] | 0;
const RIN_LEVITATION = OBJECT_NAMES.indexOf('levitation');
const RIN_SUSTAIN_ABILITY = OBJECT_NAMES.indexOf('sustain ability');
const M2_ROCKTHROW = 0x08000000;

// C pray.c:in_trouble().
export function worstPrayerTrouble(state: GameState = game): PrayerTrouble {
    requirePlayingGame(state);
    const hero = state.u;
    if (heroIsPetrifying(state)) return Trouble.STONED;
    if (heroIsSliming(state)) return Trouble.SLIMED;
    if (heroIsStrangled(state)) return Trouble.STRANGLED;
    if (hero.utrap && hero.utraptype === TT_LAVA) return Trouble.LAVA;
    if (heroIsSick(state)) return Trouble.SICK;
    const hunger = currentHungerState(state);
    if (hunger >= WEAK) return Trouble.STARVING;
    if (heroIsInDangerousRegion(state)) return Trouble.REGION;
    if ((!Upolyd(hero) || heroIsUnchanging(state)) && criticallyLowHp(false, state))
        return Trouble.HIT;
    if (Number.isInteger(hero.ulycn) && hero.ulycn >= 0) return Trouble.LYCANTHROPE;
    if (nearCapacity(state) >= EXT_ENCUMBER
        && hero.amax.a[A_STR] - hero.acurr.a[A_STR] > 3) return Trouble.COLLAPSING;
    if (heroIsSurroundedByRock(state)) return Trouble.WALL;
    if (cursedType(state.uarmf, LEVITATION_BOOTS)
        || ringRemovalObstacle(state.uleft, RIN_LEVITATION, state)
        || ringRemovalObstacle(state.uright, RIN_LEVITATION, state)) return Trouble.LEVITATION;
    if (heroHasNoHands(state) || !heroHasFreeHand(state)) {
        if (isWeldedPrimary(state.uwep, state)) return Trouble.HANDS;
        if (Upolyd(hero) && heroHasNoHands(state)
            && (!heroIsUnchanging(state)
                || cursedType(state.uamul, AMULET_OF_UNCHANGING))) return Trouble.HANDS;
    }
    if (blindfolded(state) && state.ublindf?.cursed) return Trouble.BLINDFOLD;
    if (state.uball || hero.utrap && hero.utraptype === TT_BURIEDBALL) return Trouble.PUNISHED;
    if (cursedType(state.uarmg, GAUNTLETS_OF_FUMBLING)
        || cursedType(state.uarmf, FUMBLE_BOOTS)) return Trouble.FUMBLING;
    if (worstCursedItem(state)) return Trouble.CURSED_ITEM;
    if (saddle(state)?.cursed) return Trouble.SADDLE;
    const swallower = hero.ustuck;
    if (hero.uswallow && !swallower) throw new Error('A swallowed hero has no swallowing monster');
    const blindingSwallower = hero.uswallow && swallower && (MONSTER_ATTACKS[swallower.mnum] || [])
        .some(([attack, damage]) => attack === AT_ENGL && damage === AD_BLND);
    if ((hero.blindTurns ?? 0) > 1 && !permanentBlind(state)
        && !hasIntrinsicProperty('blinded', null, state) && !blindingSwallower
        || (hero.deafTurns ?? 0) > 1) return Trouble.BLIND;
    if (attributeIndices.some(index => hero.acurr.a[index] < hero.amax.a[index])) return Trouble.POISONED;
    if ((hero._woundedLegTurns ?? 0) > 0 && !hero.usteed) return Trouble.LEGS;
    if (hunger >= HUNGRY) return Trouble.HUNGRY;
    if ((hero.stunnedTurns ?? 0) > 0) return Trouble.STUNNED;
    if ((hero.confusionTurns ?? 0) > 0) return Trouble.CONFUSED;
    if ((hero.hallucinationTurns ?? 0) > 0) return Trouble.HALLUCINATING;
    return 0;
}

export function criticallyLowHp(onlyIfInjured = false, state: GameState = game) {
    requirePlayingGame(state);
    const hero = state.u;
    const hp = Upolyd(hero) ? hero.mh : hero.uhp;
    let maximum = Upolyd(hero) ? hero.mhmax : hero.uhpmax;
    if (onlyIfInjured && hp >= maximum) return false;
    maximum = Math.min(maximum, 15 * hero.ulevel);
    const level = hero.ulevel;
    const divisor = level <= 5 ? 5 : level <= 13 ? 6 : level <= 21 ? 7 : level <= 29 ? 8 : 9;
    return hp <= 5 || hp * divisor <= maximum;
}

export function worstCursedItem(state: GameState = game): GameObject | null {
    requirePlayingGame(state);
    if (nearCapacity(state) >= HVY_ENCUMBER) {
        const stone = state.inventory.find(object => cursedType(object, LOADSTONE));
        if (stone) return stone;
    }
    const weapon = state.uwep;
    const welded = weapon && isWeldedPrimary(weapon, state) ? weapon : null;
    if (welded && (state.uright || isBimanualObject(welded))) return welded;
    for (const slot of ['uarmg', 'uarms', 'uarmc', 'uarm', 'uarmh', 'uarmf',
        'uarmu', 'uamul', 'uleft', 'uright', 'ublindf'] as const) {
        const object = state[slot];
        if (object?.cursed && !(slot === 'uarmh' && object.otyp === HELM_OF_OPPOSITE_ALIGNMENT))
            return object;
    }
    if (welded) return welded;
    if (state.u.twoweap && state.uswapwep?.cursed) return state.uswapwep;
    return state.inventory.find(object => object.cursed
        && (object.otyp === LOADSTONE || confersLuck(object, state))) || null;
}

// C pray.c:stuck_in_wall().
export function heroIsSurroundedByRock(state: GameState = game) {
    requirePlayingGame(state);
    if (state.u.passesWalls) return false;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (!dx && !dy) continue;
            const x = state.u.ux + dx, y = state.u.uy + dy;
            if (!isok(x, y)) continue;
            const type = state.level.requireAt(x, y).typ;
            if (IS_OBSTRUCTED(type) && type !== SDOOR && type !== SCORR) continue;
            if (blockedByBoulders(dx, dy, state)
                && !(requireMonsterData(MONSTER_FLAGS2, state.u.umonnum) & M2_ROCKTHROW)) continue;
            return false;
        }
    }
    return true;
}

// C pray.c:blocked_boulder().
function blockedByBoulders(dx: number, dy: number, state: PlayingGameState) {
    const hero = state.u;
    const bouldersAt = (x: number, y: number) => (state.level.objects[x]?.[y] || [])
        .filter(object => object.otyp === BOULDER)
        .reduce((count, object) => count + object.quan, 0);
    const count = bouldersAt(hero.ux + dx, hero.uy + dy);
    if (!count) return false;
    const x = hero.ux + 2 * dx, y = hero.uy + 2 * dy;
    const type = isok(x, y) ? state.level.requireAt(x, y).typ : null;
    if (count > 1 && !(count === 2 && type !== null && isPoolOrLavaAt(x, y, state))) return true;
    if (dx && dy && state.level.flags.sokoban_rules) return true;
    return type === null || IS_OBSTRUCTED(type) || bouldersAt(x, y) > 0;
}

function cursedType(object: GameObject | null | undefined, type: number): boolean {
    return object?.otyp === type && !!object.cursed;
}

function saddle(state: GameState) {
    return state.u.usteed?.minvent?.find(object => (object.owornmask ?? 0) & W_SADDLE);
}

// C pray.c:fix_curse_trouble().
export async function uncursePrayerObject(object: GameObject, label: string | null = null, state: GameState = game) {
    requirePlayingGame(state);
    if (object === state.uarmg && (state.u.glibTurns ?? 0) > 0) {
        state.u.glibTurns = 0;
        refreshProperty('glib', state);
        await pline(`Your ${simpleArmorName(object, 'uarmg', state)} are no longer slippery.`);
        if (!object.cursed) return;
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
export async function fixPrayerTrouble(trouble: PrayerTrouble, state: GameState = game) {
    requirePlayingGame(state);
    const hero = state.u;
    let object: GameObject | null | undefined;
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
        if (!await teleportHeroSafely()) clearHeroTrap(state);
        await announceTerrainRescue(DISSOLVED, state);
        return;
    case Trouble.STARVING:
    case Trouble.HUNGRY:
        await pline(`Your ${heroStomachName(state)} feels content.`);
        await restoreHeroNutrition(state, pline);
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
            hero.mhmax = Math.max(6, hero.mhmax + rnd(5));
            hero.mh = hero.mhmax;
        }
        if (hero.uhpmax < hero.ulevel * 5 + 11) hero.uhpmax += rnd(5);
        hero.uhpmax = Math.max(6, hero.uhpmax);
        hero.uhppeak = Math.max(hero.uhppeak || 0, hero.uhpmax);
        hero.uhp = hero.uhpmax;
        state.context.botl = true;
        return;
    case Trouble.COLLAPSING:
        await pline(formatFeltMessage(`${hero.amax.a[A_STR] - hero.acurr.a[A_STR] > 6 ? 'much ' : ''}stronger.`, state));
        hero.acurr.a[A_STR] = hero.amax.a[A_STR];
        state.context.botl = true;
        object = ringRemovalObstacle(state.uleft, RIN_SUSTAIN_ABILITY, state)
            || ringRemovalObstacle(state.uright, RIN_SUSTAIN_ABILITY, state);
        if (object) await uncursePrayerObject(requirePrayerObject(object), ringGlow(object, state), state);
        return;
    case Trouble.WALL:
        if (await teleportHeroSafely()) await pline('Your surroundings change.');
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
        if (isWeldedPrimary(state.uwep, state)) await uncursePrayerObject(requirePrayerObject(state.uwep), null, state);
        else if (heroIsUnchanging(state)) await uncursePrayerObject(requirePrayerObject(state.uamul), null, state);
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
        if (hero.utrap && hero.utraptype === TT_BURIEDBALL) await freeHeroFromBuriedBall(state);
        else await unpunishHero(state);
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
        await reportHeroEncumbrance(state, pline);
        return;
    }
    case Trouble.BLIND: {
        let message = '';
        // C tests Blinded (any non-blocked blindness, not just its timeout)
        // when reporting that the eyes recover alongside cured deafness.
        if (heroIsBlinded(state)) {
            state.context.botl = true;
            const singleEye = heroEyeCount(state) === 1;
            const eyes = singleEye ? heroEyeName(state) : makePlural(heroEyeName(state));
            message = `Your ${eyes} feel${singleEye ? 's' : ''} better`;
            hero.ucreamed = 0;
            await makeBlinded(0, { state, talk: false });
        }
        if ((hero.deafTurns ?? 0) > 0) {
            state.context.botl = true;
            hero.deafTurns = 0;
            syncDeafness(state);
            if (!heroIsDeaf(state)) message += message ? ' and you can hear again' : 'You can hear again';
        }
        if (message) await pline(`${message}.`);
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

function ringGlow(object: GameObject | null | undefined, state: GameState) {
    return object === state.uleft ? 'Your left ring softly glows'
        : object === state.uright ? 'Your right ring softly glows' : null;
}

function requirePrayerObject(object: GameObject | null | undefined): GameObject {
    if (!object) throw new Error('Prayer selected an item trouble without an affected object');
    return object;
}

// ---------------------------------------------------------------------------
// Divine retaliation (divine_wrath)
// ---------------------------------------------------------------------------

const GOD_VOICES = ['booms out', 'thunders', 'rings out', 'booms'];
const S_HUMAN = 53;
const DISINTEGRATION_ARMOR: readonly ('uarms' | 'uarmc' | 'uarm' | 'uarmu')[] = [
    'uarms', 'uarmc', 'uarm', 'uarmu',
];

export async function godVoice(
    alignment: number, words: string | null = null, state: GameState = game,
): Promise<void> {
    const voice = GOD_VOICES[rn2(GOD_VOICES.length)];
    if (voice === undefined) throw new Error('No divine voice was selected');
    const speech = words === null ? '' : `"${words}"`;
    await pline(`The voice of ${deityName(alignment, state)} ${voice}: ${speech}`);
}

export interface DivineAnger {
    responseAlignment: number;
    heroAlignment: number;
    alignmentRecord?: number;
    anger?: number;
    luck?: number;
}

export function angryGodMaximum({
    responseAlignment, heroAlignment, alignmentRecord = 0, anger = 0, luck = 0,
}: DivineAnger): number {
    let maximum;
    if (responseAlignment !== heroAlignment) {
        maximum = Math.trunc(alignmentRecord / 2)
            + (luck > 0 ? Math.trunc(-luck / 3) : -luck);
    } else {
        maximum = 3 * anger
            + (luck > 0 || alignmentRecord >= 4 ? Math.trunc(-luck / 3) : -luck);
    }
    return Math.max(1, Math.min(15, maximum));
}

export async function godsUpset(alignment: number, state: GameState = game): Promise<void> {
    requirePlayingGame(state);
    const anger = state.u.ugangr ?? 0;
    if (alignment === state.u.ualign.type)
        state.u.ugangr = anger + 1;
    else if (anger > 0) state.u.ugangr = anger - 1;
    await angryGods(alignment, state);
}

export async function desecrateAltar(
    highAltar: boolean, alignment: number, state: GameState = game,
): Promise<void> {
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

export async function angryGods(alignment: number, state: GameState = game): Promise<void> {
    requirePlayingGame(state);
    const hero = state.u;
    if (state.dungeons?.[hero.uz.dnum]?.flags?.hellish) alignment = A_NONE;
    hero.ublessed = 0;
    const maximum = angryGodMaximum({
        responseAlignment: alignment,
        heroAlignment: hero.ualign.type,
        alignmentRecord: hero.ualign.record,
        anger: hero.ugangr ?? 0,
        luck: (hero.uluck || 0) + (hero.moreluck || 0),
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
        if (message) await pline(message);
        if (await loseHeroExperience(null, { state })) return;
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

async function curseHero(alignment: number, state: PlayingGameState): Promise<void> {
    await godVoice(alignment, 'Thou hast angered me.', state);
    if (!heroIsBlind(state) && !state.u.antimagic) {
        const color = displayColorName('black', state);
        const glow = withIndefiniteArticle(color);
        await pline(`${glow.charAt(0).toUpperCase()}${glow.slice(1)} glow surrounds you.`);
    }
    if (rn2(2) || !await attrcurse()) await rndcurse();
}

export async function fryByGod(
    alignment: number, disintegration = false, state: GameState = game,
): Promise<boolean> {
    await pline(disintegration
        ? 'You disintegrate into a pile of dust!' : 'You fry to a crisp!');
    return finishHeroDeath({
        killer: `the wrath of ${deityName(alignment, state)}`,
        deathLineShown: true,
    });
}

export async function godZapsHero(alignment: number, state: GameState = game): Promise<void> {
    requirePlayingGame(state);
    const hero = state.u;
    if (hero.uswallow) {
        await pline('Suddenly a bolt of lightning comes down at you from the heavens!');
        await strikeSwallower(false, state);
    } else {
        await pline('Suddenly, a bolt of lightning strikes you!');
        if (heroReflectsRay(state)) {
            await shieldeff(hero.ux, hero.uy, state);
            if (heroIsBlind(state)) await pline("For some reason you're unaffected.");
            else {
                const reflection = heroReflectionSource(state);
                if (reflection) {
                    await pline(`It reflects from your ${reflection.noun}.`);
                    discoverHeroReflectionSource(reflection, state);
                }
            }
            monstersObserveHeroResistance(M_SEEN_REFL, state);
        } else if (hero.shockResistance || propertyIsActive('shockResistance', state)) {
            await shieldeff(hero.ux, hero.uy, state);
            await pline('It seems not to affect you.');
            monstersObserveHeroResistance(M_SEEN_ELEC, state);
            monstersForgetHeroResistance(M_SEEN_REFL, state);
        } else {
            if (await fryByGod(alignment, false, state)) return;
            monstersForgetHeroResistance(M_SEEN_REFL | M_SEEN_ELEC, state);
        }
    }
    if (state.program_state.gameover) return;
    await pline(`${deityName(alignment, state)} is not deterred...`);
    if (hero.uswallow) {
        await strikeSwallower(true, state);
        return;
    }
    await pline('A wide-angle disintegration beam hits you!');
    for (const slot of DISINTEGRATION_ARMOR) {
        const armor = state[slot] || hero[slot];
        if (!armor) continue;
        const cloak = state.uarmc || hero.uarmc;
        const suit = state.uarm || hero.uarm;
        if (slot === 'uarm' && cloak || slot === 'uarmu' && (suit || cloak)) continue;
        const protectedArmor = wornObjectGrantsProperty(armor, 'reflection', state)
            || wornObjectGrantsProperty(armor, 'disintegrationResistance', state);
        if (slot !== 'uarmu' && protectedArmor) continue;
        await disintegrateWornArmor(armor, { state });
        if (state.program_state.gameover) return;
    }
    if (hero.disintegrationResistance || propertyIsActive('disintegrationResistance', state)) {
        await pline('You bask in its black glow for a minute...');
        await godVoice(alignment, 'I believe it not!', state);
        monstersObserveHeroResistance(M_SEEN_DISINT, state);
    } else {
        if (await fryByGod(alignment, true, state)) return;
        monstersForgetHeroResistance(M_SEEN_DISINT, state);
    }
    const sanctum = state.sanctum_level;
    const highTemple = Is_astralevel(hero.uz)
        || sanctum && sanctum.dnum === hero.uz.dnum && sanctum.dlevel === hero.uz.dlevel;
    if (highTemple) {
        await pline('"Thou cannot escape my wrath, mortal!"');
        for (let count = 0; count < 3; count++) await summonMinion(alignment);
        await pline(`"Destroy ${state.flags.female ? 'her' : 'him'}, my servants!"`);
    }
}

async function strikeSwallower(disintegration: boolean, state: PlayingGameState): Promise<void> {
    const monster = state.u.ustuck;
    if (!monster) throw new Error('Divine lightning requires the swallowing monster');
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

const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const SPBOOK_CLASS = 10;
const RUNESWORD = OBJECT_NAMES.indexOf('runesword');
const SPE_FINGER_OF_DEATH = OBJECT_NAMES.indexOf('finger of death');
const SPE_RESTORE_ABILITY = OBJECT_NAMES.indexOf('restore ability');
const DIVINE_PROPERTIES = ['telepathy', 'fast', 'stealth'] satisfies PropertyName[];
const CROWNING_PROPERTIES: readonly PropertyName[] = [
    'seeInvisible', 'fireResistance', 'coldResistance', 'shockResistance',
    'sleepResistance', 'poisonResistance',
];

export async function grantPrayerFavor(choice: number, alignment: number): Promise<void> {
    requirePlayingGame(game);
    switch (choice) {
    case 1: await blessWieldedWeapon(); return;
    case 3:
        if (await revealCastleTune(alignment)) return;
        // Once the tune is known, this favor becomes healing.
        await restoreHeroVigor();
        return;
    case 2: await restoreHeroVigor(); return;
    case 4: await uncurseInventory(); return;
    case 5: await grantDivineProperty(); return;
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

async function blessWieldedWeapon(): Promise<void> {
    requirePlayingGame(game);
    const weapon = game.uwep;
    if (!weapon || !(willWeld(weapon) || isWeapon(weapon))) return;
    const damaged = weapon.oeroded || weapon.oeroded2;
    const repair = damaged ? ` and ${weapon.quan > 1 ? 'are' : 'is'} now as good as new` : '';
    const changed = weapon.cursed || !weapon.blessed;
    if (weapon.cursed) {
        await pline(heroIsBlind(game)
            ? formatFeltMessage(`the power of ${deityName(game.u.ualign.type)} over ${ownedObjectName(weapon, game, { capitalized: false })}.`)
            : `${ownedObjectAction(weapon, 'softly glow')} ${displayColorName('amber')}${repair}.`);
        if (!heroIsBlind(game)) game._lastPlineKind = PLNMSG_OBJ_GLOWS;
        const oldLight = objectLightRadius(weapon);
        uncurseObjectState(weapon);
        await adjustObjectLightAfterBlessing(weapon, oldLight);
        weapon.bknown = true;
    } else if (!weapon.blessed) {
        const color = heroIsBlind(game) ? null : displayColorName('light blue');
        await pline(color === null
            ? formatFeltMessage(`the blessing of ${deityName(game.u.ualign.type)} over ${ownedObjectName(weapon, game, { capitalized: false })}.`)
            : `${ownedObjectAction(weapon, 'softly glow')} with ${withIndefiniteArticle(color)} aura${repair}.`);
        if (color !== null) game._lastPlineKind = PLNMSG_OBJ_GLOWS;
        const oldLight = objectLightRadius(weapon);
        blessObjectState(weapon);
        await adjustObjectLightAfterBlessing(weapon, oldLight);
        weapon.bknown = true;
    }
    if (damaged) {
        weapon.oeroded = weapon.oeroded2 = 0;
        if (!changed) await pline(`${ownedObjectAction(weapon, heroIsBlind(game) ? 'feel' : 'look')} as good as new!`);
    }
}

async function restoreHeroVigor(): Promise<void> {
    requirePlayingGame(game);
    const hero = game.u;
    if (!heroIsBlind(game)) {
        const color = displayColorName('golden');
        await pline(`You are surrounded by ${withIndefiniteArticle(color)} glow.`);
    }
    if (hero.ulevel < hero.ulevelmax) {
        hero.ulevelmax--;
        await gainExperienceLevel();
    } else {
        hero.uhpmax += 5;
        hero.uhppeak = Math.max(hero.uhppeak || 0, hero.uhpmax);
        if (Upolyd(hero)) hero.mhmax += 5;
    }
    hero.uhp = hero.uhpmax;
    if (Upolyd(hero)) hero.mh = hero.mhmax;
    if (hero.acurr.a[A_STR] < hero.amax.a[A_STR]) {
        hero.acurr.a[A_STR] = hero.amax.a[A_STR];
        game.context.botl = true;
        await reportHeroEncumbrance(game, pline);
    }
    if (hero.uhunger < 900) await restoreHeroNutrition(game, pline);
    hero.uluck = Math.max(0, hero.uluck || 0);
    hero.ucreamed = 0;
    const { regainedSight } = setHeroBlindnessTurns(0);
    if (regainedSight) await pline('You can see again.');
    game.context.botl = true;
}

async function revealCastleTune(alignment: number): Promise<boolean> {
    requirePlayingGame(game);
    const event = game.u.uevent ||= {};
    if (event.uopened_dbridge || event.gehennom_entered || (event.uheard_tune ?? 0) >= 2) return false;
    if (!event.uheard_tune) {
        await godVoice(alignment);
        await pline(`"Hark, ${requireMonsterData(MONSTER_FLAGS2, game.u.umonnum) & 0x08 ? 'mortal' : 'creature'}!"`);
        await pline('"To enter the castle, thou must play the right tune!"');
    } else {
        await publishHeardMessage('a divine music...', pline);
        await pline(`It sounds like:  "${game.castleTune}".`);
        recordAchievement(game, ACH_TUNE);
    }
    event.uheard_tune = (event.uheard_tune || 0) + 1;
    return true;
}

async function uncurseInventory(): Promise<void> {
    requirePlayingGame(game);
    const blind = heroIsBlind(game);
    if (blind) await pline(formatFeltMessage(`the power of ${deityName(game.u.ualign.type)}.`));
    else {
        const color = displayColorName('light blue');
        await pline(`You are surrounded by ${withIndefiniteArticle(color)} aura.`);
    }
    for (const object of game.inventory) {
        if (!object.cursed || object === game.uarmh && object.otyp === HELM_OF_OPPOSITE_ALIGNMENT) continue;
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

async function grantDivineProperty(): Promise<void> {
    requirePlayingGame(game);
    await godVoice(game.u.ualign.type, 'Thou hast pleased me with thy progress,');
    const gift = DIVINE_PROPERTIES.find(property => !hasPermanentIntrinsicProperty(property));
    let name: string;
    if (gift) {
        grantIntrinsicProperty(gift, 'outside');
        name = { telepathy: 'Telepathy', fast: 'Speed', stealth: 'Stealth' }[gift];
        if (gift === 'telepathy' && heroIsBlind(game)) await see_monsters();
    } else {
        if (!hasPermanentIntrinsicProperty('protection')) {
            grantIntrinsicProperty('protection', 'outside');
            if (!game.u.ublessed) game.u.ublessed = rn1(3, 2);
        } else game.u.ublessed = (game.u.ublessed || 0) + 1;
        game._armorClassDirty = true;
        name = 'my protection';
    }
    await pline(`"and thus I grant thee the gift of ${name}!"`);
    await pline('"Use it wisely in my name!"');
}

// C pray.c:at_your_feet().
export async function announceDivineGift(description: string): Promise<void> {
    requirePlayingGame(game);
    if (heroIsBlind(game)) description = 'Something';
    description = description.charAt(0).toUpperCase() + description.slice(1);
    if (game.u.uswallow) {
        const monster = game.u.ustuck;
        if (!monster) throw new Error('A swallowed hero must have a swallowing monster');
        const name = monsterName(monster);
        const owner = /s$/.test(name) ? `${name}'` : `${name}'s`;
        const stomach = monsterStomachName(monster.mnum);
        await pline(`${description} drops into ${owner} ${stomach}.`);
    } else {
        await pline(`${description} ${heroIsBlind(game) ? 'lands' : 'appears'} ${game.u.levitating ? 'beneath' : 'at'} your ${makePlural(heroFootName())}!`);
    }
}

async function dropGift(object: GameObject, description: string): Promise<void> {
    await announceDivineGift(description);
    if (game.u.uswallow) {
        const monster = game.u.ustuck;
        if (!monster) throw new Error('A swallowed hero must have a swallowing monster');
        await addObjectToMonsterInventory(monster, object);
    } else await landFloorObject(object, game.u.ux, game.u.uy);
}

async function giveSpell(): Promise<void> {
    requirePlayingGame(game);
    const book = await mkobj(-SPBOOK_CLASS, true);
    const skills = ensureHeroSkills(game);
    if (!skills) throw new Error('Divine spell gifts require initialized hero skills');
    let tries = game.u.ulevel + 1;
    while (--tries > 0) {
        if (book.otyp === SPE_BLANK_PAPER) {
            if (!game._knownObjectTypes?.has(book.otyp)
                || game.inventory.some(object => object.otyp === MAGIC_MARKER)) break;
        } else {
            const skill = SKILL_NAMES.indexOf(`${OBJECT_SPELL_CATEGORY[book.otyp]} spells`);
            if (['unknown', 'forgotten'].includes(knownSpell(book.otyp)) && (skills[skill]?.skill ?? 0) > 0) break;
        }
        book.otyp = rndClass(getObjectClassBounds(SPBOOK_CLASS).first, SPE_BLANK_PAPER);
    }
    let knowledge: ReturnType<typeof knownSpell>;
    if (book.otyp !== SPE_BLANK_PAPER && !rn2(4)
        && (knowledge = knownSpell(book.otyp)) !== 'fresh') {
        const letter = forceLearnSpell(book.otyp);
        if (letter) {
            await pline(knowledge === 'unknown'
                ? `Divine knowledge of ${OBJECT_NAMES[book.otyp]} fills your mind!  Spell '${letter}'.`
                : `Your knowledge of spell '${letter}' - ${OBJECT_NAMES[book.otyp]} is ${knowledge === 'forgotten' ? 'restored' : 'refreshed'}.`);
        }
        await deleteObject(book);
    } else {
        book.dknown = true;
        recordObjectEncounter(book.otyp);
        if (book.otyp === SPE_BLANK_PAPER || !rn2(100)) learnObjectType(book.otyp);
        blessObjectState(book);
        const name = simpleObjectNameWithArticle(book);
        await announceDivineGift(name.charAt(0).toUpperCase() + name.slice(1));
        placeCreatedObject(book, game.u.ux, game.u.uy);
        await newsym(game.u.ux, game.u.uy);
    }
}

// C pray.c:gcrownu().
async function crownHero(): Promise<void> {
    requirePlayingGame(game);
    const hero = game.u;
    for (const property of CROWNING_PROPERTIES) grantIntrinsicProperty(property, 'outside');
    await godVoice(hero.ualign.type);
    const heldArtifact = artifactById(game.uwep?.oartifact)?.name;
    let classGift: number | null = null;
    if (game.urole.key === 'wizard' && heldArtifact !== 'Vorpal Blade' && heldArtifact !== 'Stormbringer'
        && !game.inventory.some(object => object.otyp === SPE_FINGER_OF_DEATH)) classGift = SPE_FINGER_OF_DEATH;
    else if (game.urole.key === 'monk' && !game.uwep?.oartifact
        && !game.inventory.some(object => object.otyp === SPE_RESTORE_ABILITY)) classGift = SPE_RESTORE_ABILITY;
    let object = isWeapon(game.uwep) ? game.uwep : null;
    const artifact = artifactByName(hero.ualign.type > 0 ? 'Excalibur'
        : hero.ualign.type < 0 ? 'Stormbringer' : 'Vorpal Blade');
    if (!artifact) throw new Error('The crowning artifact must be present in the artifact definitions');
    const existing = game._artifactExists?.has(artifact.id);
    const held = heldArtifact === artifact.name;
    const event = hero.uevent ||= {};
    event.uhand_of_elbereth = hero.ualign.type > 0 ? 1 : hero.ualign.type < 0 ? 3 : 2;
    const deity = deityName(hero.ualign.type);
    if (hero.ualign.type > 0) {
        await pline('"I crown thee...  The Hand of Elbereth!"');
        recordGameLogEvent(`was crowned "The Hand of Elbereth" by ${deity}`, { flags: LL_DIVINEGIFT });
    } else if (hero.ualign.type === 0) {
        await pline('"Thou shalt be my Envoy of Balance!"');
        recordGameLogEvent(`became ${deity}${deity.endsWith('s') ? "'" : "'s"} Envoy of Balance`, { flags: LL_DIVINEGIFT });
    } else {
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
        recordGameLogEvent(`was bestowed with spellbook of ${OBJECT_NAMES[classGift]}`, { flags: LL_DIVINEGIFT | LL_ARTIFACT | LL_SPOILER });
        if (knownSpell(classGift) !== 'unknown' && isWeapon(game.uwep)) object = game.uwep;
    }
    if (hero.ualign.type > 0) {
        if (!classGift && object?.otyp === LONG_SWORD && !object.oartifact) {
            if (!heroIsBlind(game)) await pline('Your sword shines brightly for a moment.');
            const before = objectName(object);
            if (nameArtifact(object, artifact, { origin: 'gift', knownOrigin: true })) {
                hero.ugifts = (hero.ugifts || 0) + 1;
                recordGameLogEvent(`had ${game.flags.female ? 'her' : 'his'} wielded ${before} transformed into ${artifact.name}`, { flags: LL_DIVINEGIFT | LL_ARTIFACT });
            }
        }
    } else {
        const blackSword = hero.ualign.type < 0 ? `${displayColorName('black')} sword` : null;
        if (!classGift && object && held) {
            if (hero.ualign.type === 0) {
                if (!heroIsBlind(game)) observeObject(object);
                findArtifact(object);
                await pline(`Your ${objectName(object)} goes snicker-snack!`);
            } else {
                await pline(`Your ${blackSword} hums ominously!`);
            }
            observeObject(object);
        } else if (!classGift && !existing) {
            object = await mksobj(hero.ualign.type < 0 ? RUNESWORD : LONG_SWORD, false, false);
            nameArtifact(object, artifact, { origin: 'gift', knownOrigin: true });
            object.spe = 1;
            await dropGift(object, blackSword ? withIndefiniteArticle(blackSword) : 'A sword');
            hero.ugifts = (hero.ugifts || 0) + 1;
            recordGameLogEvent(`was bestowed with ${artifact.name}`, { flags: LL_DIVINEGIFT | LL_ARTIFACT });
        }
    }
    unrestrictHeroSkill(hero.ualign.type < 0 ? P_BROAD_SWORD : P_LONG_SWORD);
    if (object?.oartifact === artifact.id) discoverArtifact(artifact.id);
    if (isWeapon(object)) {
        const oldLight = objectLightRadius(object);
        blessObjectState(object);
        await adjustObjectLightAfterBlessing(object, oldLight);
        object.oeroded = object.oeroded2 = 0;
        object.oerodeproof = object.bknown = object.rknown = true;
        object.spe = Math.max(1, object.spe);
        unrestrictHeroSkill(Math.abs(requireObjectData(OBJECT_SUBTYPE, object.otyp)));
    } else if (!classGift) await pline(formatFeltMessage('unworthy.'));
    await adjustWeaponSkillSlots(1);
}

function isWeapon(object: GameObject | null | undefined): object is GameObject {
    return !!object && (object.oclass === WEAPON_CLASS
        || object.oclass === TOOL_CLASS && requireObjectData(OBJECT_SUBTYPE, object.otyp) !== 0);
}

// ---------------------------------------------------------------------------
// Altar sacrifice (sacrifice)
// ---------------------------------------------------------------------------

const AMULET_CLASS = 5;
const FOOD_CLASS = 7;
const PM_ACID_BLOB = MONSTER_NAME.indexOf('acid blob');
const PM_WRAITH = MONSTER_NAME.indexOf('wraith');
const MAX_VALUE = 24;

interface CorpseOffering extends GameObject {
    corpsenm: number;
    age: number;
}

function requireCorpseOffering(object: GameObject): asserts object is CorpseOffering {
    if (object.otyp !== CORPSE || object.corpsenm === undefined || object.age === undefined)
        throw new Error('A corpse offering requires its species and creation time.');
}

export async function dosacrifice(): Promise<void> {
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
    if (!offering) return;
    game.context.move = 1;
    const alignment = Amask2align(altar.flags);
    const highAltar = !!(altar.flags & AM_SANCTUM);
    if (offering.otyp === AMULET_OF_YENDOR) {
        if (highAltar) await offerAmulet(offering, alignment);
        else await offerAmuletTooSoon(alignment);
    } else if (offering.otyp === FAKE_AMULET_OF_YENDOR) {
        await offerFakeAmulet(offering, highAltar, alignment);
    } else if (offering.otyp === CORPSE) {
        await offerCorpse(offering, highAltar, alignment);
    } else {
        await pline('Nothing happens.');
    }
    // dosacrifice() returns ECMD_TIME even after savelife() clears move.
    game.context.move = 1;
}

async function chooseOffering(): Promise<GameObject | null> {
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
            const answer = await promptYesNoQuit(
                `There ${single ? 'is' : 'are'} ${await floorObjectDescription(corpse)} here; sacrifice ${single ? 'it' : 'one'}?`,
                'n',
            );
            if (answer === 'y') return corpse;
            if (answer === 'q') return null;
            declinedFloor = true;
        }
    }
    const astral = Is_astralevel(hero.uz);
    const object = await chooseInventoryObject('sacrifice', object => {
        if (object.oclass !== FOOD_CLASS && object.oclass !== AMULET_CLASS) return GETOBJ_EXCLUDE;
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

async function offerCorpse(corpse: GameObject, highAltar: boolean, alignment: number): Promise<void> {
    const game = requireInitializedGame();
    requireCorpseOffering(corpse);
    const hero = game.u;
    const conduct = hero.uconduct ||= {};
    if (!conduct.gnostic)
        recordGameLogEvent(`rejected atheism by offering ${await inventoryItemDescription(corpse)} on an altar of ${deityName(alignment)}`, { flags: LL_CONDUCT });
    conduct.gnostic = (conduct.gnostic || 0) + 1;
    await feelPetrifyingCorpse(corpse, { forceTouch: true });
    if (game.program_state.gameover) return;
    if (isRider(corpse.corpsenm)) {
        await pline('At your touch, the corpse suddenly moves...');
        const revival = await reviveCorpseImmediately(corpse);
        for (const message of revival?.messages ?? []) await pline(message);
        await exerciseAttribute(A_WIS, false);
        return;
    }
    if ((MONSTER_FLAGS2[corpse.corpsenm] ?? 0) & game.urace.selfmask) {
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
        if (highAltar) await desecrateAltar(true, alignment);
        else await offerToAnotherGod(corpse, alignment);
        return;
    }
    await consumeOffering(corpse);
    await rewardOffering(value);
}

async function offeringValue(corpse: CorpseOffering, alignment: number): Promise<number> {
    const game = requireInitializedGame();
    const age = corpse.on_ice ? corpse.age + Math.trunc((game.moves - corpse.age) / 2) : corpse.age;
    if (corpse.corpsenm !== PM_ACID_BLOB && game.moves > age + 50) return 0;
    const difficulty = MONSTER_DIFFICULTY[corpse.corpsenm];
    if (difficulty === undefined) throw new RangeError(`Unknown sacrifice species ${corpse.corpsenm}`);
    let value = difficulty + 1;
    if (corpse.oeaten) {
        const body = MONSTER_BODY_META[corpse.corpsenm];
        if (!body) throw new RangeError(`Unknown corpse body ${corpse.corpsenm}`);
        const nutrition = body[1];
        value = Math.max(1, nutrition
            ? Math.trunc(value * Math.min(corpse.oeaten, nutrition) / nutrition) : 0);
    }
    const hero = game.u;
    if ((MONSTER_FLAGS2[corpse.corpsenm] ?? 0) & M2_UNDEAD) {
        if (hero.ualign.type !== -1 || corpse.corpsenm === PM_WRAITH && hero.uconduct?.unvegetarian)
            value++;
    } else if (monsterIsUnicorn(corpse.corpsenm)) {
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
        } else if (unicornAlignment === hero.ualign.type) {
            hero.ualign.record = -1;
            value = 1;
        } else value += 3;
    }
    return value;
}

async function consumeOffering(object: GameObject): Promise<void> {
    const game = requireInitializedGame();
    if (heroIsHallucinating(game)) {
        const messages = [
            'Your sacrifice sprouts wings and a propeller and roars away!',
            'Your sacrifice puffs up, swelling bigger and bigger, and pops!',
            'Your sacrifice collapses into a cloud of dancing particles and fades away!',
        ];
        const message = messages[rn2(messages.length)];
        if (message === undefined) throw new Error('Sacrifice message RNG selected an invalid entry.');
        await pline(message);
    } else if (heroIsBlind(game) && game.u.ualign.type === 1) {
        await pline('Your sacrifice disappears!');
    } else {
        const effect = game.u.ualign.type === 1 ? 'flash of light'
            : game.u.ualign.type === 0 ? 'plume of smoke' : 'burst of flame';
        await pline(`Your sacrifice is consumed in a ${effect}!`);
    }
    await useOffering(object);
    await exerciseAttribute(A_WIS, true);
}

// C pray.c: carried offerings go through useup(), floor ones useupf(..., 1).
async function useOffering(object: GameObject): Promise<void> {
    const game = requireInitializedGame();
    if (game.inventory.includes(object)) {
        await consumeInventoryItem(object);
    } else {
        await useUpFloorObject(object, 1, { state: game });
        if (game.u.uundetected && heroFormHidesUnderObjects()
            && !game.level.objects?.[game.u.ux]?.[game.u.uy]?.length)
            game.u.uundetected = false;
        await newsym(game.u.ux, game.u.uy);
    }
}

async function rejectOffering(highAltar: boolean, alignment: number): Promise<void> {
    const game = requireInitializedGame();
    if (highAltar && alignment !== game.u.ualign.type) await desecrateAltar(true, alignment);
    else await godsUpset(alignment);
}

async function offerToAnotherGod(corpse: CorpseOffering, alignment: number): Promise<void> {
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
            await convertHeroAlignment(alignment);
            if (game.program_state.gameover) return;
            changeLuck(-3);
            hero.ublesscnt = (hero.ublesscnt || 0) + 300;
        } else {
            hero.ugangr = (hero.ugangr || 0) + 3;
            adjustHeroAlignment(-5);
            await pline(`${deityName(alignment)} rejects your sacrifice!`);
            await godVoice(alignment, 'Suffer, infidel!');
            changeLuck(-5);
            adjustAttribute(A_WIS, -2);
            if (!inHell()) await angryGods(hero.ualign.type);
        }
        return;
    }
    await consumeOffering(corpse);
    await pline(`You sense a conflict between ${deityName(hero.ualign.type)} and ${deityName(alignment)}.`);
    if (rn2(8 + hero.ulevel) > 5) {
        await pline(formatFeltMessage(`the power of ${deityName(hero.ualign.type)} increase.`));
        await exerciseAttribute(A_WIS, true);
        changeLuck(1);
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
    } else {
        await pline(`Unluckily, you feel the power of ${deityName(hero.ualign.type)} decrease.`);
        changeLuck(-1);
        await exerciseAttribute(A_WIS, false);
        if (rnl(hero.ulevel) > 6 && hero.ualign.record > 0
            && rnd(hero.ualign.record) > Math.trunc(7 * alignmentLimit() / 8))
            await summonMinion(alignment, true);
    }
}

async function offerOwnRace(corpse: CorpseOffering, highAltar: boolean, alignment: number): Promise<void> {
    const game = requireInitializedGame();
    const hero = game.u;
    if ((MONSTER_FLAGS2[hero.umonnum] ?? 0) & M2_DEMON) {
        await pline('You find the idea very satisfying.');
        await exerciseAttribute(A_WIS, true);
    } else if (hero.ualign.type !== -1) {
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
    } else {
        let failure;
        if (alignment === -1 && hero.ualign.type !== -1) {
            const color = displayColorName('black');
            await pline(`The blood floods the altar, which vanishes in ${withIndefiniteArticle(color)} cloud!`);
            altar.typ = ROOM;
            altar.flags = 0;
            await newsym(hero.ux, hero.uy);
            await angerTemplePriest();
            failure = 'The cloud dissipates.';
        } else {
            await pline('The blood covers the altar!');
            changeLuck(alignment === A_NONE ? -2 : 2);
            failure = 'The blood coagulates.';
        }
        const type = demonLord(alignment);
        const demon = type == null ? null : await makemonNear(type, hero.ux, hero.uy, MM_NOMSG);
        if (demon && type !== null) {
            const name = monsterName(demon, { article: 'a' });
            if (name !== 'it') demon.mstrategy = (demon.mstrategy ?? 0) & ~STRAT_APPEARMSG;
            await pline(`You have summoned ${name === 'it' ? 'something dreadful' : name}!`);
            if (Math.sign(hero.ualign.type) === Math.sign(MONSTER_ALIGNMENT[type] ?? 0)) demon.mpeaceful = true;
            await pline('You are terrified, and unable to move.');
            nomul(-3);
            game._helplessReason = 'being terrified of a demon';
            game._helplessDoneMessage = null;
        } else await pline(failure);
    }
    if (hero.ualign.type !== -1) {
        adjustHeroAlignment(-5);
        hero.ugangr = (hero.ugangr || 0) + 3;
        adjustAttribute(A_WIS, -1);
        if (!inHell()) await angryGods(hero.ualign.type);
        if (game.program_state.gameover) return;
        changeLuck(-5);
    } else adjustHeroAlignment(5);
    await useOffering(corpse);
}

async function rewardOffering(value: number): Promise<void> {
    const game = requireInitializedGame();
    const hero = game.u;
    const hallucinating = heroIsHallucinating(game);
    if ((hero.ugangr ?? 0) > 0) {
        const previous = hero.ugangr ?? 0;
        hero.ugangr = Math.max(0, previous - Math.trunc(value * (hero.ualign.type === -1 ? 2 : 3) / MAX_VALUE));
        if (hero.ugangr === previous) {
            await pline(hallucinating ? 'The gods seem tall.' : 'You have a feeling of inadequacy.');
        } else {
            const mood = hero.ugangr ? (hallucinating ? 'groovy' : 'slightly mollified')
                : (hallucinating ? 'cosmic (not a new fact)' : 'mollified');
            await pline(`${deityName(hero.ualign.type)} seems ${mood}.`);
            if ((hero.uluck ?? 0) < 0) {
                if (hero.ugangr) changeLuck(1);
                else hero.uluck = 0;
            }
        }
    } else if (hero.ualign.record < 0) {
        adjustHeroAlignment(Math.min(value, MAX_VALUE, -hero.ualign.record));
        await pline(formatFeltMessage('partially absolved.'));
    } else if (hero.ublesscnt > 0) {
        const previous = hero.ublesscnt;
        hero.ublesscnt = Math.max(0, previous - Math.trunc(value * (hero.ualign.type === -1 ? 500 : 300) / MAX_VALUE));
        if (hero.ublesscnt !== previous) {
            await pline(hero.ublesscnt
                ? (hallucinating ? 'You realize that the gods are not like you and I.' : 'You have a hopeful feeling.')
                : (hallucinating ? 'Overall, there is a smell of fried onions.' : 'You have a feeling of reconciliation.'));
            if ((hero.uluck ?? 0) < 0) {
                if (hero.ublesscnt) changeLuck(1);
                else hero.uluck = 0;
            }
        }
    } else {
        if (await bestowArtifact(value)) return;
        const previous = hero.uluck || 0;
        const increase = Math.min(Math.trunc(value * LUCKMAX / (MAX_VALUE * 2)), Math.max(0, value - previous));
        changeLuck(increase);
        hero.uluck = Math.max(0, hero.uluck ?? 0);
        if (hero.uluck !== previous) {
            const feet = makePlural(heroFootName());
            await pline(heroIsBlind(game)
                ? `You think something brushed your ${heroFootName()}.`
                : hallucinating ? `You see crabgrass at your ${feet}.  A funny thing in a dungeon.`
                    : `You glimpse a four-leaf clover at your ${feet}.`);
        }
    }
}

async function bestowArtifact(value: number): Promise<boolean> {
    const game = requireInitializedGame();
    const hero = game.u;
    if (hero.ulevel <= 2 || (hero.uluck ?? 0) < 0) return false;
    const count = artifactExistCount();
    const selected = game.flags.debug
        ? await promptYesNo('Gift an artifact?') === 'y'
        : rn2(6 + 2 * (hero.ugifts || 0) * count) === 0;
    if (!selected) return false;
    const object = await createArtifactGift(hero.ualign.type, value);
    if (!object) return false;
    if (object.oartifact === undefined) throw new Error('An artifact gift requires an artifact id.');
    setArtifactOrigin(object, 'gift', { knownOrigin: true });
    const artifact = artifactById(object.oartifact);
    if (!artifact) throw new Error('An artifact gift must have a registered artifact identity.');
    if (object.spe === undefined) throw new Error('An artifact gift must have an enchantment value.');
    object.spe = Math.max(0, object.spe);
    if (object.cursed) uncurseObjectState(object);
    object.oerodeproof = true;
    const blind = heroIsBlind(game);
    const hallucinating = heroIsHallucinating(game);
    let noun = hallucinating ? 'a doodad' : blind ? 'an object' : simpleObjectNameWithArticle(object);
    if (!blind) noun += ` named ${artifact.name.replace(/^The /, '')}`;
    await announceDivineGift(noun);
    await landFloorObject(object, hero.ux, hero.uy);
    await godVoice(hero.ualign.type, 'Use my gift wisely!');
    hero.ugifts = (hero.ugifts || 0) + 1;
    hero.ublesscnt = rnz(300 + 50 * count);
    await exerciseAttribute(A_WIS, true);
    recordGameLogEvent(`was bestowed with ${artifact.name} by ${deityName(hero.ualign.type)}`, { flags: LL_DIVINEGIFT | LL_ARTIFACT });
    const skillType = [2, 6, 13].includes(object.oclass ?? 0)
        ? Math.abs(OBJECT_SUBTYPE[object.otyp] ?? 0) : 0;
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
async function offerAmuletTooSoon(alignment: number): Promise<void> {
    const game = requireInitializedGame();
    if (alignment === A_NONE && inHell()) await godsUpset(A_NONE);
    else await pline(formatFeltMessage(`${heroIsHallucinating(game) ? 'homesick'
        : alignment === game.u.ualign.type ? 'an urge to return to the surface' : 'ashamed'}.`));
}

async function offerFakeAmulet(amulet: GameObject, highAltar: boolean, alignment: number): Promise<void> {
    const game = requireInitializedGame();
    if (!highAltar && !amulet.known) {
        await offerAmuletTooSoon(alignment);
        return;
    }
    await publishHeardMessage('a nearby thunderclap.', pline);
    if (!amulet.known) {
        await pline(`You realize you have made a ${heroIsHallucinating(game) ? 'boo-boo' : 'mistake'}.`);
        amulet.known = true;
        changeLuck(-1);
    } else {
        if (heroIsDeaf(game)) await pline('Oh, no.');
        changeLuck(-3);
        adjustHeroAlignment(-1);
        game.u.ugangr = (game.u.ugangr || 0) + 3;
        await rejectOffering(highAltar, alignment);
    }
}

async function offerAmulet(amulet: GameObject, alignment: number): Promise<void> {
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
        })) return;
        await pline('Moloch snarls and tries again...');
        if (await fryByGod(A_NONE, true)) return;
        await pline(`A cloud of ${displayColorName('black')} smoke surrounds you...`);
        await finishLivingGame('escaped');
    } else if (alignment !== hero.ualign.type) {
        adjustHeroAlignment(-99);
        await pline(`${deityName(alignment)} accepts your gift, and gains dominion over ${deityName(hero.ualign.type)}...`);
        await pline(`${deityName(hero.ualign.type)} is enraged...`);
        await pline(`Fortunately, ${deityName(alignment)} permits you to live...`);
        await pline(`A cloud of ${displayColorName('orange')} smoke surrounds you...`);
        await finishLivingGame('escaped');
    } else {
        (hero.uevent ||= {}).ascended = 1;
        adjustHeroAlignment(10);
        await pline('An invisible choir sings, and you are bathed in radiance...');
        await godVoice(alignment, 'Mortal, thou hast done well!');
        await pline('"In return for thy service, I grant thee the gift of Immortality!"');
        await pline(`You ascend to the status of ${game.flags.female ? 'Demigoddess' : 'Demigod'}...`);
        await finishLivingGame('ascended');
    }
}

function alignmentLimit() {
    return 10 + Math.trunc(game.moves / 200);
}

function changeLuck(amount: number): void {
    game.u.uluck = Math.max(LUCKMIN, Math.min(LUCKMAX, (game.u.uluck || 0) + amount));
}

