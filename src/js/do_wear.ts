// do_wear.js — Wearing and removing armor and accessories.
// C refs: do_wear.c — dowear()/doputon()/accessory_or_armor_on(),
// armor_or_accessory_off(), dotakeoff()/doremring()/ia_dotakeoff(),
// takeoff_order/reset_remarm()/cancel_doff()/doffing(), equip_ok(),
// inaccessible_equipment()/count_worn_stuff(), stuck_ring(), Ring_on()/
// Ring_off()/Amulet_on()/Amulet_off(), learnring()/adjust_attrib(),
// Armor_on()/Armor_off()/Armor_gone(), the slot callbacks (Boots/Cloak/
// Helmet/Gloves/Shield/Shirt_on/off), set_wear(), donning()/doffing(),
// cancel_don()/stop_donning(), glibr(), some_armor(), find_ac(),
// hard_helmet(), adj_abon(), destroy_arm()/disintegrate_arm(),
// obj_erode_type(), and the Armor_off()/off_msg() completion shared with
// allmain.c.

import {
    ILLOBJ_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS,
    TOOL_CLASS, COIN_CLASS,
} from './objclass.js';
import {
    objectDelay, objectSkill, objectCharged, GRAY_DRAGON_SCALES, HELM_OF_OPPOSITE_ALIGNMENT, LENSES,
    MEAT_RING, AMULET_OF_GUARDING, ALCHEMY_SMOCK, CLOAK_OF_DISPLACEMENT, CLOAK_OF_PROTECTION,
    CORPSE, CORNUTHAUM, DUNCE_CAP, ELVEN_BOOTS, ELVEN_CLOAK, GAUNTLETS_OF_FUMBLING,
    GAUNTLETS_OF_POWER, MUMMY_WRAPPING, FEDORA, FUMBLE_BOOTS, LEVITATION_BOOTS, RIN_FREE_ACTION,
    RIN_PROTECTION, GRAY_DRAGON_SCALE_MAIL, YELLOW_DRAGON_SCALE_MAIL, YELLOW_DRAGON_SCALES,
    SHIELD_OF_DRAIN_RESISTANCE, SHIELD_OF_REFLECTION, OBJECT_DESCRIPTIONS, OBJECT_NAMES,
    OBJECT_PROPERTY, WATER_WALKING_BOOTS, AMULET_OF_CHANGE, AMULET_OF_RESTFUL_SLEEP,
    AMULET_OF_STRANGULATION, AMULET_OF_UNCHANGING, AKLYS, TOWEL, BLINDFOLD, BATTLE_AXE,
} from './object_data.js';
import { game, requireLiveGame } from './gstate.js';
import { pline, plineWithContinuation } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { commandResultCancelled, cmdq_clear, setMulti, paranoidQuery } from './cmd.js';
import type { ArmorCompletion } from './cmd.js';
import { nomul, applyHeroLocationEffects, heroCanSwim, applyHeroLiquidEffects } from './hack.js';
import { finishHeroHelplessness } from './allmain.js';
import type { GameObject } from './object_types.js';
import { monsterIsHumanoid, MONSTER_NAME, MONSTER_SIZE, monsterBreaksArmor, monsterHornCount, monsterIsCentaur, monsterIsSlithy, monsterSlipsArmor, monsterWrappingAllowed } from './monster_data.js';
import { CQ_CANNED, GETOBJ_SUGGEST, PARANOID_REMOVE, W_ACCESSORY, W_ARMOR, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_INACCESS, A_CHA, A_DEX, A_INT, A_WIS, LUCKMIN, LUCKMAX, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, A_CON, A_STR, Is_airlevel, Upolyd, W_AMUL, W_RING, W_RINGL, W_RINGR, W_TOOL, W_WEAPONS, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, P_LONG_SWORD, P_SHORT_SWORD, P_BROAD_SWORD, P_SABER, P_TWO_HANDED_SWORD, MENU_COMBINATION, MENU_FULL, MENU_ITEMFLAGS_SKIPINVERT, MENU_TRADITIONAL, SORTLOOT_INVLET } from './const.js';
import { isBimanualObject, isSword, isFlimsyObject, objectIsMetallic, objectIsCrackable, objectIsRustprone, objectIsCorrodeable } from './object_properties.js';
import { heroFingerName, heroHandName, heroNeckName, heroHeadName, heroFootName, heroLegName } from './body_parts.js';
import type { PlayingGameState, GameState } from './game_state.js';
import { recordRandom } from './monster_action_types.js';
import type { MonsterCallLog, RandomBelow } from './monster_action_types.js';
import { heroHasNoHead, heroSpecies, changeHeroSex, heroIsBreathless, heroPolyGender, heroHasNoHands, heroHasNoLimbs, heroIsVerySmall, heroFormClings, heroFormFlags, heroIsUnchanging, heroMonsterForm } from './polyself.js';
import { retouchHeroObject } from './hero_retouch.js';
import { learnObjectType, observeObject } from './o_init.js';
import { observeObjectForNaming, objectName, ownedObjectName, corpseName, killerObjectName, objectNameIsPlural, simpleObjectName, makePlural, withIndefiniteArticle, makeSingular, objectDescription, objectHasPersonalName, objectMonsterName } from './objnam.js';
import { inventoryItemDescription, consumeInventoryItem, selectInventoryObject, inventoryClassOrder, inventorySortMode, objectClassHeading, sortObjects } from './invent.js';
import { chooseInventoryObject, compactInventoryLetters } from './invent.js';
import type { InventoryClassification } from './invent.js';
import { isWeldedPrimary, setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from './wield.js';
import { setworn, bypassObjectList, clearBypasses, nextUnbypassedObject } from './worn.js';
import { setBallAndChainFelt } from './ball.js';
import { gulpBlindnessCheck } from './engulf_blindness.js';
import { getLine, promptYesNoAllQuit } from './query.js';
import { restoreMenuUnderlay, showMultiSelectWindow, snapshotMenuUnderlay } from './windows.js';
import type { MenuUnderlay, MultiSelectItem, MultiSelectSection } from './windows.js';
import { yn_function } from './cmd.js';
import { objectOwnershipPrefix, objectTypeKnown } from './shk.js';
import { formatFeltMessage } from './hero_speech.js';
import { heroDetectsMonsters, heroIsBlind, heroIsHallucinating, isEyesOfTheOverworld, syncBlindness } from './senses.js';
import { makeHallucinated, setSlipperyHands, showInvisibilityMessage, toggleBlindness } from './potion.js';
import { newsym, see_monsters, consumeHallucinatedMenuObjectGlyph, OBJECT_CLASS_SYMBOLS } from './display.js';
import { objectResistsDestruction } from './zap.js';
import { erodeObject, erosionMatters, objectIsVulnerableToErosion, resolveImmediatePetrification, captureLevitationState, floatHeroUp, floatHeroDown } from './trap.js';
import { stopHeroOccupation } from './occupation.js';
import { heroResistsStoning, selfTouchPetrifyingWeapons, touchPetrifies } from './stoning.js';
import { surfaceName } from './terrain_name.js';
import { isLavaAt, isPoolAt } from './dbridge.js';
import { levelHasCeiling, levelIsWaterLevel } from './dungeon.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { artifactEmitsLight, heroHasArtifactDefense, setWornArtifactProperties } from './artifacts.js';
import { beginObjectBurn, endObjectBurn } from './timeout.js';
import { equipmentLightDescription, equipmentLightMessage } from './light.js';
import { rn2, rnd } from './rng.js';
import type { PropertyName, WornPropertySlot } from './property_types.js';
import { changeHeroAlignmentFromHelmet } from './alignment.js';
import { currentAttribute, attributeIsAtLimit } from './attrib.js';
import type { AttributeIndex } from './attrib.js';
import { encumber_msg } from './pickup.js';
import { curseObjectState, objectIsFlammable, objectIsRottable } from './mkobj.js';
import { displayColorName, displayLiquidName, monsterName } from './do_name.js';
import { grantWornProperty, hasIntrinsicProperty, hasWornProperty, propertyIsActive, propertyIsBlocked, propertyTimeout, refreshMovementProperties, refreshProperty, removeWornProperty, setPropertyTimeout } from './properties.js';
import { monstersForgetHeroResistance, seenResistanceForProperty, heroResistsLifeDrain } from './mondata.js';
import { refreshInvisibleMonsters } from './hero_seeing.js';
import { tryCallObjectType, dropInventoryObjectAtHero } from './do.js';
import { LL_MINORAC, recordGameLogEvent } from './gamelog.js';
import { experienceRankIndex } from './exper.js';
import { clearHeroSliming, heroIsSliming } from './potion.js';
import { heroIsInDangerousRegion } from './regions.js';
import { heroCanBeStrangled } from './polyself.js';
import { canLetGo } from './do.js';
import { restartMonsterShapechanging, restoreNaturalMonsterShapes } from './mon.js';

import { weaponDescription } from './weapon.js';

export async function doputon(): Promise<void> {
    if (wearingFullEquipment()) {
        const prefix = monsterIsHumanoid(heroSpecies(game)) ? 'ring-' : '';
        await pline(`Your ${prefix}${makePlural(heroFingerName(game))} are full, and you're already wearing an amulet and ${game.ublindf?.otyp === LENSES ? 'some lenses' : 'a blindfold'}.`);
        game.context.move = 0;
        return;
    }
    const object = await chooseInventoryObject('put on', candidate => equipmentClassification(candidate, 'put on'));
    if (!object) {
        // do_wear.c:doputon() returns ECMD_CANCEL when getobj() is
        // declined; the rhack seam clears the queues after the command.
        commandResultCancelled();
        return;
    }
    if (object.oclass === ARMOR_CLASS) {
        await putOnArmorObject(object);
        return;
    }

    await putOnAccessoryObject(object);
}

// do_wear.c:accessory_or_armor_on() is shared by both W and P.  getobj()
// downplays the other command's class in its compact prompt but still accepts
// a directly typed inventory letter and routes it through this same owner.
async function putOnAccessoryObject(object: GameObject): Promise<void> {
    if (object.worn) {
        await pline('You are already wearing that!');
        game.context.move = 0;
        return;
    }

    if (isEyewear(object)) {
        if (!heroHasNoHead(game) && !game.ublindf && !game.u.ublindf) {
            const touch = await retouchHeroObject(object);
            if (touch.rejected || touch.died) {
                game.context.move = 1;
                return;
            }
        }
        const worn = await wearEyewear(object);
        game.context.move = worn ? 1 : 0;
        return;
    }

    if (object.oclass === AMULET_CLASS || object.class === 'Amulets') {
        if (game.uamul) {
            await pline('You are already wearing an amulet.');
            game.context.move = 0;
            return;
        }
        const touch = await retouchHeroObject(object);
        if (touch.rejected || touch.died) {
            game.context.move = 1;
            return;
        }
        await wearHeroAccessory(object, 'uamul', game);
        game.context.move = 1;
        return;
    }

    if ((object.oclass === RING_CLASS || object.class === 'Rings' || object.otyp === MEAT_RING)
        && heroHasNoLimbs(game)) {
        await pline('You cannot make the ring stick to your body.');
        game.context.move = 0;
        return;
    }

    if (game.uleft && game.uright) {
        const prefix = monsterIsHumanoid(heroSpecies(game)) ? 'ring-' : '';
        await pline(`There are no more ${prefix}${makePlural(heroFingerName(game))} to fill.`);
        game.context.move = 0;
        return;
    }

    let hand: 'left' | 'right';
    if (!game.uleft && !game.uright) {
        // C calls yn_function(qbuf, rightleftchars, '\0', TRUE): a queued
        // answer replays without prompting and any key outside "rl" is
        // replaced by the NUL default; a live question keeps asking until
        // 'r', 'l', or a quit key answers it, and only that final answer
        // is recorded into CQ_REPEAT for the next do-again.
        const { answer } = await yn_function(
            `Which ${monsterIsHumanoid(heroSpecies(game)) ? 'ring-' : ''}${heroFingerName(game)}, Right or Left?`,
            'rl', '', true, { menuable: true },
        );
        if (answer !== 'r' && answer !== 'l') {
            game.context.move = 0;
            return;
        }
        hand = answer === 'r' ? 'right' : 'left';
    } else {
        hand = game.uright ? 'left' : 'right';
    }

    const ringSlot = hand === 'right' ? 'uright' : 'uleft';
    const gloves = game.uarmg;
    if (gloves && (game.u.glib || (game.u.glibTurns ?? 0) > 0)) {
        await pline(`Your ${armorSimpleName(gloves)} are too slippery to remove, so you cannot put on the ring.`);
        game.context.move = 1;
        return;
    }
    if (gloves?.cursed) {
        const discovered = !gloves.bknown;
        gloves.bknown = true;
        await pline('You cannot remove your gloves to put on the ring.');
        game.context.move = discovered ? 1 : 0;
        return;
    }
    const weapon = game.uwep;
    const primary = game.u.rightHanded === false ? 'uleft' : 'uright';
    const discoveredWeld = !!weapon && !weapon.bknown;
    if (weapon && (ringSlot === primary || isBimanualObject(weapon))
        && isWeldedPrimary(weapon)) {
        const handName = isBimanualObject(weapon) ? makePlural(heroHandName(game)) : heroHandName(game);
        await pline(`You cannot free your weapon ${handName} to put on the ring.`);
        game.context.move = discoveredWeld ? 1 : 0;
        return;
    }
    const touch = await retouchHeroObject(object);
    if (touch.rejected || touch.died) {
        game.context.move = 1;
        return;
    }
    await wearHeroAccessory(object, ringSlot, game);
    // Sink effects can remove the ring inside Ring_on().
    if (game.uleft === object || game.uright === object) {
        observeObjectForNaming(object);
        await plineWithContinuation(`${object.invlet} - ${await inventoryItemDescription(object)}.`);
    }
    game.context.move = 1;
}

// C ref: objnam.c armor_simple_name() and category helpers.  Delayed armor
// nomovemsg deliberately uses a short category noun, not xname()/doname().

// C ref: do_wear.c Armor_off()/off_msg().  Delayed removal calls this from
// allmain only after negative multi has reached zero; zero-delay armor can use
// the same state owner immediately.
export async function finishArmorRemoval(
    object: GameObject, { silent = false }: { silent?: boolean } = {},
): Promise<string> {
    await removeHeroArmor(object, game, { deferArmorClass: true });
    if (silent || game.flags?.verbose === false) return '';
    return await armorOffMessage(object, game);
}

// C do_wear.c:dotakeoff()/doremring() share armor_or_accessory_off().
// T suggests armor and R suggests accessories; either accepts the other kind.
// C do_wear.c:ia_dotakeoff(): the item-action flag keeps the queued letter
// selectable even when a different accessible piece is the lone suggestion.
// C do_wear.c:count_worn_stuff(): the worn count and its single default
// item, with only the outermost torso layer counted.
export async function removeWornItem(action: 'remove' | 'take off', itemAction = false): Promise<void> {
    const worn = (game.inventory || []).filter(object => object.worn);
    if (!worn.length) {
        await pline(action === 'take off' && game.uskin
            ? `The dragon ${game.uskin.otyp >= GRAY_DRAGON_SCALES ? 'scales are' : 'scale mail is'} merged with your skin!`
            : action === 'remove' ? 'Not wearing any accessories or armor.'
                : 'Not wearing any armor or accessories.');
        game.context.move = 0;
        return;
    }

    let object: GameObject | null | undefined;
    let inventoryPrompt: string | null = null;
    const preferred = accessibleEquipment(action === 'remove');
    // C ia_dotakeoff() forces getobj() to consume the queued item letter,
    // even if another accessible piece is the only normal suggestion.
    if (preferred.length === 1 && !itemAction && !((game.flags.paranoia_bits ?? 0) & PARANOID_REMOVE)) {
        [object] = preferred;
    } else {
        const suggested = game.inventory.filter(candidate => equipmentClassification(candidate, action, itemAction) === GETOBJ_SUGGEST);
        const letters = compactInventoryLetters(suggested.map(candidate => candidate.invlet).join(''));
        inventoryPrompt = `What do you want to ${action}? [${letters ? `${letters} or ?*` : '*'}] `;
        object = await chooseInventoryObject(action, candidate => equipmentClassification(candidate, action, itemAction));
    }
    if (!object) {
        // do_wear.c:dotakeoff()/doremring() return ECMD_CANCEL when
        // getobj() is declined; the rhack seam clears the queues.
        commandResultCancelled();
        return;
    }

    if (!((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY))) {
        await pline('You are not wearing that.');
        game.context.move = 0;
        return;
    }

    const cloak = game.uarmc;
    const suit = game.uarm;
    if (object === game.uskin || object === suit && cloak
        || object === game.uarmu && (cloak || suit)) {
        const coverings = [cloak, object === game.uarmu ? suit : null]
            .filter(covering => covering != null).map(covering => armorSimpleName(covering));
        await pline(object === game.uskin ? "You can't take that off; it's embedded."
            : `You can't take that off without taking off your ${coverings.join(' and ')} first.`);
        game.context.move = 0;
        return;
    }

    resetBulkTakeoff();
    const slot = TAKEOFF_ORDER.find(candidate => takeoffSlotObject(candidate) === object);
    if (!slot || !await canSelectOff(object, slot)) {
        game.context.move = 0;
        return;
    }
    resetBulkTakeoff();

    if (object === game.ublindf) {
        game._pending_message = '';
        const removed = await removeEyewear(object);
        if (game.program_state.gameover) return;
        game.context.move = removed ? 1 : 0;
        return;
    }

    if (object === game.uamul || object === game.uleft
        || object === game.uright) {
        // C armor_or_accessory_off(): a ring's off_msg() runs while it is
        // still worn, so the report keeps the "(on {right|left} hand)"
        // suffix and precedes Ring_off()'s side effects such as a
        // levitation landing or the death it causes; Amulet_off() clears
        // the slot first and reports afterwards, without a suffix.
        const ring = object === game.uleft || object === game.uright;
        if (ring && game.flags?.verbose !== false) {
            await plineWithContinuation(await armorOffMessage(object, game));
        }
        await removeHeroAccessory(object, game);
        game.context.move = 1;
        return;
    }

    const delay = objectDelay(object.otyp);
    const isArmor = object.class === 'Armor' || object.oclass === ARMOR_CLASS;
    if (isArmor && delay > 0) {
        nomul(-delay);
        game._helplessReason = 'disrobing';
        game._helplessDoneMessage = `You finish taking off your ${armorSimpleName(object)}.`;
        game._afterMove = {
            kind: 'remove',
            object,
        };
        game.context.move = 1;
        return;
    }

    // do_wear.c:off_msg() is conditional on flags.verbose.  When disabled,
    // immediate zero-delay armor removal leaves getobj's selector as the
    // physical topline even though the timed state change has committed.
    game._pending_message = '';
    if (game.flags?.verbose === false && inventoryPrompt)
        game._retained_message = inventoryPrompt.trimEnd();
    const removalMessage = await finishArmorRemoval(object);
    if (removalMessage)
        await plineWithContinuation(removalMessage);
    game.context.move = 1;
}

// C do_wear.c:canwearobj(). Decisions precede contact and slot changes.
const MZ_SMALL = 1;

interface ArmorWearDecision { refusal: string | null; checkedWeldedWeapon: GameObject | null }

export function armorWearDecision(object: GameObject, state: GameState = game): ArmorWearDecision {
    const slot = armorSlotFor(object.otyp);
    const form = heroMonsterForm(state);
    const weapon = state.uwep ?? null;
    const torso = slot === 'uarm' || slot === 'uarmc' || slot === 'uarmu';
    let checkedWeldedWeapon: GameObject | null = null;
    const refuse = (refusal: string | null): ArmorWearDecision => ({ refusal, checkedWeldedWeapon });
    if (heroIsVerySmall(state) || heroHasNoHands(state))
        return refuse("You can't wear any armor in your current form.");
    if (torso && form !== null && (monsterBreaksArmor(form) || monsterSlipsArmor(form))
        && !(slot === 'uarmc' && (object.otyp === MUMMY_WRAPPING
            ? monsterWrappingAllowed(form) : MONSTER_SIZE[form] === MZ_SMALL))
        && !(MONSTER_NAME[form] === 'hobbit' && OBJECT_NAMES[object.otyp]?.startsWith('elven '))) {
        const noun = slot === 'uarm' ? 'suit' : slot === 'uarmu' ? 'shirt' : 'cloak';
        return refuse(`The ${noun} will not fit on your body.`);
    }
    if ((object.owornmask ?? 0) & W_ARMOR) return refuse('You are already wearing that!');
    if (isWeldedPrimary(weapon, state)) checkedWeldedWeapon = weapon;
    if (checkedWeldedWeapon && isBimanualObject(checkedWeldedWeapon)
        && (slot === 'uarm' || slot === 'uarmu'))
        return refuse(`You cannot do that while holding your ${isSword(checkedWeldedWeapon) ? 'sword' : 'weapon'}.`);
    if (!slot) return refuse("You can't wear that!");
    if (slot === 'uarm' && state.uarmc)
        return refuse(`You cannot wear armor over a ${armorSimpleName(state.uarmc, state)}.`);
    const worn = state[slot];
    // C do_wear.c:already_wearing(): "You are already wearing that!" for
    // re-worn armor, and the simple name of the occupied slot's piece.
    if (worn) {
        const name = slot === 'uarm' ? 'some armor'
            : slot === 'uarmg' ? 'gloves' : slot === 'uarmf' ? 'boots'
                : slot === 'uarms' ? 'a shield' : withIndefiniteArticle(armorSimpleName(worn, state));
        return refuse(`You are already wearing ${name}.`);
    }
    switch (slot) {
    case 'uarmh': {
        const horns = form === null ? 0 : monsterHornCount(form);
        if (horns && !isFlimsyObject(object, state))
            return refuse(`The ${armorSimpleName(object, state)} won't fit over your horn${horns === 1 ? '' : 's'}.`);
        break;
    }
    case 'uarms':
        if (weapon && isBimanualObject(weapon))
            return refuse(`You cannot wear a shield while wielding a two-handed ${isSword(weapon) ? 'sword' : weapon.otyp === BATTLE_AXE ? 'axe' : 'weapon'}.`);
        if (state.u.twoweap) return refuse('You cannot wear a shield while wielding two weapons.');
        break;
    case 'uarmf':
        if (form !== null && monsterIsSlithy(form)) return refuse('You have no feet...');
        if (form !== null && monsterIsCentaur(form)) return refuse('You have too many hooves to wear boots.');
        if (!state.u.utrap) break;
        if (state.u.utraptype === TT_BEARTRAP) return refuse(`Your ${heroFootName(state)} is trapped!`);
        if (state.u.utraptype === TT_INFLOOR || state.u.utraptype === TT_LAVA)
            return refuse(`Your ${makePlural(heroFootName(state))} are stuck in the ${surfaceName(state.u.ux, state.u.uy, state)}!`);
        if (state.u.utraptype === TT_BURIEDBALL)
            return refuse(`Your ${heroLegName(state)} is attached to the buried ball!`);
        break;
    case 'uarmg':
        if (isWeldedPrimary(weapon, state)) {
            checkedWeldedWeapon = weapon;
            return refuse(`You cannot wear gloves over your ${weapon && isSword(weapon) ? 'sword' : 'weapon'}.`);
        }
        if (state.u.glib || (state.u.glibTurns ?? 0) > 0)
            return refuse(`Your ${makePlural(heroFingerName(state))} are too slippery to pull on ${armorSimpleName(object, state)}.`);
        break;
    case 'uarmu':
        if (state.uarm || state.uarmc)
            return refuse(`You can't wear that over your ${state.uarmc ? armorSimpleName(state.uarmc, state) : 'armor'}.`);
        break;
    case 'uarm': break;
    case 'uarmc': break;
    }
    return refuse(null);
}

async function putOnArmorObject(object: GameObject): Promise<void> {
    if (object.worn) {
        await pline('You are already wearing that!');
        game.context.move = 0;
        return;
    }

    const decision = armorWearDecision(object);
    if (decision.checkedWeldedWeapon) decision.checkedWeldedWeapon.bknown = true;
    if (decision.refusal) {
        await pline(decision.refusal);
        game.context.move = 0;
        return;
    }
    if (object.otyp === HELM_OF_OPPOSITE_ALIGNMENT && game.u.uz?.dnum === game.quest_dnum) {
        await pline(game.u.ualignbase?.[0] === game.u.ualignbase?.[1]
            ? 'You narrowly avoid losing all chance at your goal.'
            : 'You are suddenly overcome with shame and change your mind.');
        game.u.ublessed = 0;
        learnObjectType(object.otyp, game);
        game.context.botl = true;
        game.context.move = 1;
        return;
    }
    const touch = await retouchHeroObject(object);
    if (touch.rejected || touch.died) {
        game.context.move = 1;
        return;
    }

    // C accessory_or_armor_on(): "if the armor is wielded, release it for
    // wearing (won't be welded even if cursed; that only happens for
    // weapons/weptools)" — via remove_worn_item().
    if ((object.owornmask ?? 0) & W_WEAPONS)
        await removeWornHeroItem(object, game, { unchainBall: false });
    await wearHeroArmor(object, game);
    // C do_wear.c installs the slot with setworn() now, but allmain.c does
    // not run find_ac() until the command's monster/global time has passed.
    // Mark that once-per-input boundary; identification and Armor_on()
    // extrinsics remain later afternmv effects.
    const delay = objectDelay(object.otyp);
    game._armorClassDirty = true;
    game._afterMove = { kind: 'wear', object };
    if (delay > 0) {
        nomul(-delay);
        game._helplessReason = 'dressing up';
        game._helplessDoneMessage = 'You finish your dressing maneuver.';
    } else {
        await finishHeroHelplessness('');
        object._armorApplied = true;
        const onMessage = await objectWearMessage(object);
        if (onMessage) await plineWithContinuation(onMessage);
    }
    // C accessory_or_armor_on() discards interrupted 'A' after armor wear.
    resetBulkTakeoff();
    game.context.move = 1;
}

// C refs: do_wear.c dowear(), accessory_or_armor_on(), and the negative
// `multi`/afternmv completion in allmain.c.  Armor is installed in its worn
// slot immediately, but its known state and completion message are delayed
// until the required elapsed-turn scheduler round has finished.
function classifyWearChoice(object: GameObject, action: 'wear' | 'put on') {
    const classification = equipmentClassification(object, action);
    // Native canwearobj() checks welded() even during getobj's silent fit
    // check. Keep that knowledge change at the command boundary.
    if (action === 'wear' && object.oclass === ARMOR_CLASS) {
        const decision = armorWearDecision(object);
        if (decision.checkedWeldedWeapon) decision.checkedWeldedWeapon.bknown = true;
    }
    return classification;
}

export async function dowear(): Promise<void> {
    // do_wear.c:dowear() owns this form-capability check before getobj().
    // W therefore rejects the whole transaction without exposing either
    // armor or cross-accepted accessory inventory letters.
    if (heroIsVerySmall(game) || heroHasNoHands(game)) {
        await pline("Don't even bother.");
        game.context.move = 0;
        return;
    }

    // wear_ok() downplays accessories but accepts them through the same
    // getobj transaction, including a queued inventory action.
    if (wearingFullEquipment()) {
        await pline('You are already wearing a full complement of armor.');
        game.context.move = 0;
        return;
    }
    const object = await chooseInventoryObject('wear', candidate => classifyWearChoice(candidate, 'wear'));
    if (!object) {
        // do_wear.c:dowear() returns ECMD_CANCEL when getobj() is
        // declined; the rhack seam clears the queues after the command.
        commandResultCancelled();
        return;
    }
    if (object.oclass === ARMOR_CLASS) await putOnArmorObject(object);
    else await putOnAccessoryObject(object);
}

// C do_wear.c:some_armor(). Torso priority is deterministic; each later
// occupied slot gets an independent one-in-four replacement opportunity.
// mhitu.c's disenchantment attack and steal.c's gold-less theft both pick
// their target through this pass.
export function selectHeroDisenchantmentTarget(
    state: PlayingGameState,
    random: RandomBelow,
    calls: MonsterCallLog,
) {
    let object = state?.uarmc || state?.uarm || state?.uarmu || null;
    for (const candidate of [state?.uarmh, state?.uarmg, state?.uarmf, state?.uarms]) {
        if (candidate && (!object || recordRandom(random, calls, 4) === 0)) {
            object = candidate;
        }
    }
    if (object) return object;
    const fallback = recordRandom(random, calls, 5);
    return (
        [
            null,
            state?.uright || state?.u?.uright,
            state?.uleft || state?.u?.uleft,
            state?.uamul || state?.u?.uamul,
            state?.ublindf || state?.u?.ublindf,
        ][fallback] || null
    );
}

// C donning()/doffing() inspect afternmv, not a separate armor timer.
export function pendingArmorAction(state: GameState = game): ArmorCompletion | null {
    const after = state._afterMove;
    return after?.kind === 'wear' || after?.kind === 'remove' ? after : null;
}

// C do_wear.c:takeoff_order, reset_remarm(), cancel_doff(), doffing().
export const TAKEOFF_ORDER = [
    'ublindf', 'uwep', 'uarms', 'uarmg', 'uleft', 'uright', 'uarmc',
    'uarmh', 'uamul', 'uarm', 'uarmu', 'uarmf', 'uswapwep', 'uquiver',
] as const;
export type TakeoffSlot = typeof TAKEOFF_ORDER[number];

export interface TakeoffContext {
    pending: TakeoffSlot[];
    current: TakeoffSlot | null;
    delay: number;
    text: 'disrobing' | 'disarming';
}

export function takeoffSlotObject(slot: TakeoffSlot, state: GameState = game): GameObject | null {
    return state[slot] || state.u[slot] || null;
}

// C do_wear.c:reset_remarm().
export function resetBulkTakeoff(state: GameState = game): void {
    delete state.context.takeoff;
}

// Slot replacement cancels work on that item, including an interrupted delay.
export function cancelSlotTakeoff(slot: TakeoffSlot, state: GameState = game): void {
    const progress = state.context.takeoff;
    if (!progress) return;
    progress.pending = progress.pending.filter(candidate => candidate !== slot);
    if (progress.current === slot) {
        progress.current = null;
        progress.delay = 0;
    }
}

export function isBeingTakenOff(object: GameObject, state: GameState = game): boolean {
    const slot = state.context.takeoff?.current;
    return !!slot && takeoffSlotObject(slot, state) === object;
}

// C do_wear.c:doddoremarm(): the #takeoffall command — resume an
// interrupted disrobing, refuse when nothing is worn, then collect the
// selection and start the occupation.
// set_occupation() is the _occupation assignment below; wearing_armor()
// is the TAKEOFF_ORDER scan that decides "not wearing anything".
export async function takeOffAll(): Promise<void> {
    game.context.move = 0;
    const progress = game.context.takeoff;
    if (progress && (progress.current || progress.pending.length)) {
        await plineWithContinuation(`You continue ${progress.text}.`);
        game._occupation = { key: 'takeoff', text: progress.text };
        return;
    }
    if (!TAKEOFF_ORDER.some(slot => takeoffSlotObject(slot))) {
        await plineWithContinuation('You are not wearing anything.');
        return;
    }
    const selected = new Set<TakeoffSlot>();
    await selectBulkTakeoff(async object => {
        const slot = TAKEOFF_ORDER.find(slot => takeoffSlotObject(slot) === object);
        if (slot && await canSelectOff(object, slot)) selected.add(slot);
    });
    if (!selected.size) return;
    const pending = TAKEOFF_ORDER.filter(slot => selected.has(slot));
    const text = pending.some(slot => !['uwep', 'uswapwep', 'uquiver'].includes(slot))
        ? 'disrobing' : 'disarming';
    game.context.takeoff = { pending, current: null, delay: 0, text };
    await continueBulkTakeoff();
}

// The initiating command schedules work; each later callback completes one
// working turn. Even zero-delay armor requires one such turn in native 'A'.
// C do_wear.c:take_off(): the 'A' occupation body — finish the current
// piece after its delay, walk takeoff_order for the next one (covering
// cloaks and suits over a shirt costs extra), and announce "You finish
// disrobing." when the mask empties.
// do_takeoff() is removeSelectedSlot(); set_occupation() is the
// _occupation assignment at the end of each round.
export async function continueBulkTakeoff(state: GameState = game): Promise<boolean> {
    const progress = state.context.takeoff;
    if (!progress) return false;
    if (progress.current) {
        if (progress.delay > 0) {
            progress.delay--;
            return true;
        }
        const slot = progress.current;
        await removeSelectedSlot(slot, state);
        progress.pending = progress.pending.filter(candidate => candidate !== slot);
        progress.current = null;
        if (state.program_state.gameover) return false;
    }
    const slot = progress.pending[0];
    progress.delay = 0;
    if (!slot) {
        await plineWithContinuation(`You finish ${progress.text}.`);
        resetBulkTakeoff(state);
        return false;
    }
    progress.current = slot;
    progress.delay = Math.max(0, removalDelay(slot, state) - 1);
    state._occupation = { key: 'takeoff', text: progress.text };
    return true;
}

function removalDelay(slot: TakeoffSlot, state: GameState): number {
    const object = takeoffSlotObject(slot, state);
    const armor = ['uarm', 'uarmc', 'uarmh', 'uarmg', 'uarms', 'uarmu', 'uarmf'].includes(slot);
    let delay = armor && object ? objectDelay(object.otyp) : 1;
    const cloak = takeoffSlotObject('uarmc', state);
    const suit = takeoffSlotObject('uarm', state);
    if ((slot === 'uarm' || slot === 'uarmu') && cloak)
        delay += 2 * objectDelay(cloak.otyp) + 1;
    if (slot === 'uarmu' && suit) delay += 2 * objectDelay(suit.otyp);
    return delay;
}

async function removeSelectedSlot(slot: TakeoffSlot, state: GameState): Promise<void> {
    const object = takeoffSlotObject(slot, state);
    if (!object) return;
    if (slot === 'uswapwep') {
        const twoweap = state.u.twoweap;
        await setSecondaryWeapon(null, state);
        await plineWithContinuation(twoweap ? 'You are no longer wielding two weapons at once.'
            : 'You no longer have a second weapon readied.');
        return;
    }
    if (slot === 'uquiver') {
        await setQuiverObject(null, state);
        await plineWithContinuation('You no longer have ammunition readied.');
        return;
    }
    if (await unremovableCurse(object, slot, state)) {
        if (slot !== 'uwep' && slot !== 'ublindf') await offMessage(object, state);
        return;
    }
    if (slot === 'uwep') {
        const twoweap = state.u.twoweap;
        await setPrimaryWeapon(null, state);
        const hands = takeoffSlotObject('uarmg', state) ? 'empty handed'
            : monsterIsHumanoid(heroSpecies(state)) ? 'bare handed' : 'not wielding anything';
        await plineWithContinuation(twoweap ? 'You are no longer wielding either weapon.' : `You are ${hands}.`);
    } else if (slot === 'ublindf') {
        await removeEyewear(object, { state });
    } else if (slot === 'uamul') {
        await removeHeroAccessory(object, state);
        // Native Amulet_off() supplies its own off_msg(); take_off() also
        // prints the returned object's off_msg(), including this second one.
        if (!state.program_state.gameover) await offMessage(object, state);
    } else if (slot === 'uleft' || slot === 'uright') {
        await removeHeroAccessory(object, state);
        if (!state.program_state.gameover) await offMessage(object, state);
    } else {
        // Native armor-off functions leave AC for allmain.c:find_ac(),
        // after the removal messages and the elapsed monster turns.
        await removeHeroArmor(object, state, { deferArmorClass: true });
        if (!state.program_state.gameover) {
            await offMessage(object, state);
        }
    }
}

async function offMessage(object: GameObject, state: GameState): Promise<void> {
    const message = await armorOffMessage(object, state);
    if (message) await plineWithContinuation(message);
}

// C do_wear.c:select_off(); invent.c:carrying_stoning_corpse() is the
// petrifying-corpse check that guards taking gloves off.
// C do_wear.c:better_not_take_that_off(): the paranoid confirmation before
// taking off gloves while carrying a corpse that could turn the bearer to
// stone.
export async function canSelectOff(object: GameObject, slot: TakeoffSlot): Promise<boolean> {
    const weapon = takeoffSlotObject('uwep');
    const gloves = takeoffSlotObject('uarmg');
    const cloak = takeoffSlotObject('uarmc');
    const suit = takeoffSlotObject('uarm');
    const slippery = !!game.u.glib || (game.u.glibTurns ?? 0) > 0;
    if (slot === 'uleft' || slot === 'uright') {
        if (heroHasNoLimbs(game)) {
            await plineWithContinuation('The ring is stuck.');
            return false;
        }
        const welded = checkWeldedWeapon(weapon);
        const primary = game.u.rightHanded === false ? 'uleft' : 'uright';
        if (welded && (slot === primary || isBimanualObject(weapon))) {
            await plineWithContinuation(`You cannot free a weapon ${heroHandName(game)} to remove the ring.`);
            return false;
        }
        if (gloves && (gloves.cursed || slippery)) {
            await plineWithContinuation(`You cannot take off your ${slippery ? 'slippery ' : ''}${armorSimpleName(gloves)} to remove the ring.`);
            if (!slippery) gloves.bknown = true;
            return false;
        }
    }
    if (slot === 'uarmg') {
        if (checkWeldedWeapon(weapon)) {
            await plineWithContinuation(`You are unable to take off your gloves while wielding that ${weaponNoun(weapon) === 'sword' ? 'sword' : 'weapon'}.`);
            return false;
        }
        if (slippery) {
            await plineWithContinuation(`${object.unpaid ? 'The' : 'Your'} ${armorSimpleName(object)} are too slippery to take off.`);
            return false;
        }
        if (await betterNotTakeThatOff(object)) return false;
    }
    if (slot === 'uarmf' && game.u.utrap) {
        if (game.u.utraptype === TT_BEARTRAP) {
            await plineWithContinuation(`The bear trap prevents you from pulling your ${heroFootName(game)} out.`);
            return false;
        }
        if (game.u.utraptype === TT_INFLOOR) {
            await plineWithContinuation(`You are stuck in the ${surfaceName(game.u.ux, game.u.uy)}, and cannot pull your ${makePlural(heroFootName(game))} out.`);
            return false;
        }
    }
    if (slot === 'uarm' || slot === 'uarmu') {
        const obstacle = cloak?.cursed ? cloak : slot === 'uarmu' && suit?.cursed ? suit
            : checkWeldedWeapon(weapon) && isBimanualObject(weapon) ? weapon : null;
        if (obstacle) {
            const action = obstacle === cloak ? `remove your ${armorSimpleName(obstacle)}`
                : obstacle === suit ? 'remove your suit' : `release your ${weaponNoun(obstacle)}`;
            await plineWithContinuation(`You cannot ${action} to take off the ${objectName(object)}.`);
            obstacle.bknown = true;
            return false;
        }
    }
    if (slot === 'uquiver' || slot === 'uswapwep' && !game.u.twoweap) return true;
    return !await unremovableCurse(object, slot, game);
}

// C do_wear.c:better_not_take_that_off().  Gloves are the only barrier
// between the hero and a carried stoning corpse, so taking them off asks
// for confirmation; refusing leaves the gloves on.
async function betterNotTakeThatOff(object: GameObject, state: GameState = game): Promise<boolean> {
    // C invent.c:carrying_stoning_corpse(): the first inventory corpse that
    // petrifies on touch.
    const corpse = state.inventory.find(candidate =>
        candidate.otyp === CORPSE && touchPetrifies(candidate.corpsenm));
    if (!corpse) return false;
    // C pickup.c:u_safe_from_fatal_corpse(corpse, st_corpse | st_petrifies):
    // both tests already hold of carrying_stoning_corpse(), so this corpse
    // is never safe to touch bare-handed.  Stone resistance is deliberately
    // not factored in: losing it later, without the gloves on, could prove
    // dangerous.
    if (corpse.otyp !== CORPSE || !touchPetrifies(corpse.corpsenm)) return false;
    return !await paranoidQuery(true,
        `Take off your ${armorSimpleName(object)} despite carrying a dead ${objectMonsterName(corpse)}?`);
}

function weaponNoun(object: GameObject | null): string {
    const skill = object ? objectSkill(object.otyp) : undefined;
    return skill !== undefined && [P_SHORT_SWORD, P_BROAD_SWORD, P_LONG_SWORD, P_TWO_HANDED_SWORD, P_SABER].includes(skill)
        ? 'sword' : object?.otyp === BATTLE_AXE ? 'axe' : 'weapon';
}

// C welded() reveals the curse even when the weapon does not block removal.
function checkWeldedWeapon(object: GameObject | null, state: GameState = game): boolean {
    if (!object || !isWeldedPrimary(object, state)) return false;
    object.bknown = true;
    return true;
}

// C do_wear.c:cursed(): a welded weapon or cursed worn item refuses to
// come off, with the slippery-fingers variant, and reveals its BUC.
// fingers_or_gloves() is the pluralized finger name in the slippery
// refusal.
async function unremovableCurse(object: GameObject, slot: TakeoffSlot, state: GameState): Promise<boolean> {
    if (!(slot === 'uwep' ? checkWeldedWeapon(object, state) : object.cursed)) return false;
    const slippery = !!state.u.glib || (state.u.glibTurns ?? 0) > 0;
    const gloves = takeoffSlotObject('uarmg', state);
    if (slippery && object.bknown && (gloves ? slot === 'uwep' : ['uwep', 'uleft', 'uright'].includes(slot))) {
        const fingers = gloves ? armorSimpleName(gloves, state) : makePlural(heroFingerName(state));
        await plineWithContinuation(`Despite your slippery ${fingers}, you can't.`);
    } else {
        const plural = slot === 'uarmf' || slot === 'uarmg' || object.otyp === LENSES || object.quan > 1;
        await plineWithContinuation(`You can't.  ${plural ? 'They are' : 'It is'} cursed.`);
    }
    object.bknown = true;
    return true;
}

type Category = number | 'all' | 'u' | 'B' | 'C' | 'U' | 'X' | 'P';
type BucCategory = 'B' | 'C' | 'U' | 'X';
type SelectOff = (object: GameObject) => Promise<void>;


// C do_wear.c:menu_remarm(): the category and object pick lists for 'A',
// including the combination-style class prompt and the BUC category
// filter from pickup.c:query_category()/allow_category().
export async function selectBulkTakeoff(selectOff: SelectOff): Promise<void> {
    const style = game.flags.menu_style ?? MENU_FULL;
    let categories: Category[] = ['all'];
    if (style === MENU_TRADITIONAL || style === MENU_COMBINATION) {
        const choice = await traditionalCategories(style === MENU_COMBINATION, selectOff);
        if (choice === null) return;
        categories = choice;
        if (style === MENU_COMBINATION && !categories.length) return;
    } else if (style === MENU_FULL) {
        categories = await categoryMenu();
        if (!categories.length) return;
    }
    const worn = wornInventory().filter(object => matchesCategories(object, categories));
    if (!worn.length) {
        if (style !== MENU_COMBINATION)
            await plineWithContinuation('There is nothing else you can remove or unwield.');
        return;
    }
    const sorted = sortObjects(worn, { mode: inventorySortMode() });
    const sections: MultiSelectSection<GameObject>[] = [];
    for (const oclass of inventoryClassOrder()) {
        const objects = sorted.filter(object => object.oclass === oclass);
        if (!objects.length) continue;
        const items = [];
        for (const object of objects) {
            observeObjectForNaming(object);
            consumeHallucinatedMenuObjectGlyph(object);
            items.push({
                key: object.invlet ?? '#',
                groupAccelerator: OBJECT_CLASS_SYMBOLS[object.oclass] ?? '',
                text: await objectDescription(object, { withPrice: true }),
                value: object,
            });
        }
        sections.push({ heading: objectClassHeading(oclass), items });
    }
    const underlay = snapshotMenuUnderlay();
    const selected = await showMultiSelectWindow({
        title: 'What do you want to take off?', sections, returnCounts: true,
    });
    restoreMap(underlay);
    for (const selection of selected) await selectOff(selection.value);
}

function wornInventory(): GameObject[] {
    return game.inventory.filter(object => TAKEOFF_ORDER.some(slot => takeoffSlotObject(slot) === object));
}

function bucCategory(object: GameObject): BucCategory {
    if (object.oclass === COIN_CLASS) return game.flags.goldX ? 'X' : 'U';
    return !object.bknown ? 'X' : object.blessed ? 'B' : object.cursed ? 'C' : 'U';
}

function wornBucCategories(worn: readonly GameObject[]): Set<BucCategory> {
    // Native count_buc() grants priest knowledge before applying is_worn().
    if (game.urole?.key === 'priest')
        for (const object of game.inventory) object.bknown = object.oclass !== COIN_CLASS;
    return new Set(worn.map(bucCategory));
}

function hasUnpaid(object: GameObject): boolean {
    return !!object.unpaid || (object.contents || []).some(hasUnpaid);
}

function matchesCategories(object: GameObject, categories: readonly Category[]): boolean {
    const classes = categories.filter(category => typeof category === 'number');
    const statuses = categories.filter(category => category === 'B' || category === 'C' || category === 'U' || category === 'X');
    // C menu_remarm(): P alone does not disable the all-worn menu.
    const filters = categories.includes('u') || statuses.length > 0;
    if (categories.includes('all') && !filters) return true;
    if (object.oclass === COIN_CLASS && classes.length > 0) return classes.includes(COIN_CLASS);
    return (!classes.length || classes.includes(object.oclass))
        && (!categories.includes('u') || hasUnpaid(object))
        && (!statuses.length || statuses.includes(bucCategory(object)))
        && (!categories.includes('P') || !!object.pickup_prev);
}

async function categoryMenu(): Promise<Category[]> {
    const worn = wornInventory();
    const classes = inventoryClassOrder().filter(oclass => worn.some(object => object.oclass === oclass));
    const statuses = wornBucCategories(worn);
    const unpaid = game.inventory.some(hasUnpaid);
    if (classes.length === 1 && !unpaid && statuses.size <= 1) {
        const only = classes[0];
        return only === undefined ? [] : [only];
    }
    const items: MultiSelectItem<Category>[] = [];
    let letter = 97;
    if (classes.length > 1) {
        items.push({
            key: 'a', text: 'All worn and wielded types', value: 'all',
            itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
        });
        letter++;
    }
    for (const oclass of classes) items.push({
        key: String.fromCharCode(letter++), groupAccelerator: OBJECT_CLASS_SYMBOLS[oclass] ?? '',
        text: objectClassHeading(oclass), value: oclass,
    });
    if (unpaid || statuses.size) items.push({ text: '', selectable: false });
    if (unpaid) items.push({
        key: 'u', text: 'Unpaid items', value: 'u', itemFlags: MENU_ITEMFLAGS_SKIPINVERT,
    });
    for (const status of ['B', 'C', 'U', 'X'] as const) {
        if (statuses.has(status)) items.push({
            key: status, value: status, itemFlags: MENU_ITEMFLAGS_SKIPINVERT, text: status === 'X'
                ? 'Items of unknown Bless/Curse status'
                : `Items known to be ${status === 'B' ? 'Blessed' : status === 'C' ? 'Cursed' : 'Uncursed'}`,
        });
    }
    const underlay = snapshotMenuUnderlay();
    const selected = await showMultiSelectWindow({
        title: 'What type of things do you want to take off?',
        sections: [{ items }], omitHeadings: true,
    });
    restoreMap(underlay);
    return selected;
}

async function traditionalCategories(combo: boolean, selectOff: SelectOff): Promise<Category[] | null> {
    const worn = wornInventory();
    const classes = [...new Set(worn.map(object => object.oclass))];
    const statuses = wornBucCategories(worn);
    const promptClasses = classes.map(oclass => OBJECT_CLASS_SYMBOLS[oclass]).join('');
    const unpaid = game.inventory.some(hasUnpaid);
    const picked = game.inventory.some(object => object.pickup_prev);
    const extras = `${unpaid ? 'u' : ''}${statuses.has('B') ? 'B' : ''}${statuses.has('U') ? 'U' : ''}`
        + `${statuses.has('C') ? 'C' : ''}${statuses.has('X') ? 'X' : ''}${picked ? 'P' : ''}ai${combo ? '' : 'm'}`;
    let response: string | null;
    for (;;) {
        response = await getLine(`What kinds of thing do you want to take off? [${promptClasses} ${extras}]`,
            (_character, key) => key >= 32 && key < 127);
        if (response === null) return null;
        if (!response.includes('i')) break;
        const underlay = snapshotMenuUnderlay();
        const inventory = await selectInventoryObject({ letters: worn.map(object => object.invlet).join('') });
        restoreMap(underlay);
        if (inventory.key === 27) return null;
    }
    const categories: Category[] = [];
    const classChoices: number[] = [];
    let requireUnpaid = false;
    const all = response.includes('a');
    const menu = response.includes('m');
    for (const character of response) {
        if (' aiAm'.includes(character)) continue;
        if (character === 'u' || character === 'B' || character === 'C'
            || character === 'U' || character === 'X' || character === 'P') {
            // C ggetobj(): the last status selector chooses ckfn. askchain()
            // runs that predicate before allow_category()'s coin exception.
            requireUnpaid = character === 'u';
            categories.push(character);
            continue;
        }
        const oclass = OBJECT_CLASS_SYMBOLS.indexOf(character);
        if (oclass < ILLOBJ_CLASS) {
            await plineWithContinuation(`You don't have any ${character}'s.`);
            continue;
        }
        const weaponSlots = (['uwep', 'uswapwep', 'uquiver'] as const).map(slot => takeoffSlotObject(slot));
        const slottedClass = weaponSlots.some(object => object?.oclass === oclass);
        if (!slottedClass && ![WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS, TOOL_CLASS].includes(oclass)) {
            await plineWithContinuation('Not applicable.');
            return null;
        }
        const hasCategory = oclass === WEAPON_CLASS
            ? weaponSlots.some(object => object !== null) : classes.includes(oclass);
        if (!slottedClass && !hasCategory) {
            await plineWithContinuation(oclass === WEAPON_CLASS ? 'You are not wielding anything.'
                : oclass === ARMOR_CLASS ? 'You are not wearing any armor.'
                    : oclass === RING_CLASS ? 'You are not wearing rings.'
                        : oclass === AMULET_CLASS ? 'You are not wearing an amulet.'
                            : 'You are not wearing a blindfold.');
            return null;
        }
        if (!classChoices.includes(oclass)) {
            classChoices.push(oclass);
            categories.push(oclass);
        }
    }
    if (menu) return all ? ['all', ...categories] : categories.length ? categories : ['all'];
    if (combo && !all) return categories;
    let acceptAll = all;
    let questioned = false;
    const sorted = sortObjects(game.inventory, { mode: SORTLOOT_INVLET });
    const passes = classChoices.length ? classChoices : [null];
    try {
        for (const oclass of passes) {
            bypassObjectList(game.inventory, false);
            let object;
            let index = -1;
            while ((object = nextUnbypassedObject(game.inventory, game, sorted))) {
                index++;
                if (!worn.includes(object) || (oclass !== null && object.oclass !== oclass)
                    || (requireUnpaid && !hasUnpaid(object))
                    || !matchesCategories(object, categories)) continue;
                questioned = true;
                observeObjectForNaming(object);
                const position = index - (sorted[0]?.oclass === COIN_CLASS ? 1 : 0);
                const letter = game.flags.fixinv !== false ? object.invlet
                    : object.oclass === COIN_CLASS ? '$' : 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(position) || '#';
                const answer = acceptAll ? 'y' : await promptYesNoAllQuit(
                    `${letter} - ${await inventoryItemDescription(object)}?`, 'n');
                if (answer === 'q') return null;
                if (answer === 'n') continue;
                if (answer === 'a') acceptAll = true;
                await selectOff(object);
            }
        }
    } finally {
        clearBypasses();
    }
    if (!questioned) await plineWithContinuation('No applicable objects.');
    return null;
}

function restoreMap(underlay: MenuUnderlay | null): void {
    game._pending_message = '';
    game._retained_message = '';
    restoreMenuUnderlay(underlay);
}

// C do_wear.c:equip_ok(), inaccessible_equipment(), count_worn_stuff().
type EquipmentAction = 'wear' | 'put on' | 'take off' | 'remove';

// C do_wear.c:equip_ok().
// C do_wear.c:puton_ok().
// C do_wear.c:remove_ok().
// C do_wear.c:wear_ok().
// C do_wear.c:takeoff_ok().
// C invent.c:taking_off(): the 'T' and 'R' phrasings both mean removing.
export function equipmentClassification(
    object: GameObject, action: EquipmentAction, itemAction = false, state: GameState = game,
): InventoryClassification {
    const removing = action === 'take off' || action === 'remove';
    const accessory = action === 'put on' || action === 'remove';
    const worn = !!((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY));
    if (removing !== worn) return GETOBJ_EXCLUDE_INACCESS;
    if (![ARMOR_CLASS, RING_CLASS, AMULET_CLASS].includes(object.oclass) && !isEyewear(object) && object.otyp !== MEAT_RING)
        return GETOBJ_EXCLUDE;
    if (accessory !== (object.oclass !== ARMOR_CLASS)) return GETOBJ_DOWNPLAY;
    if (object.oclass === ARMOR_CLASS && !removing && armorWearDecision(object, state).refusal)
        return GETOBJ_DOWNPLAY;
    if (removing && !itemAction && equipmentIsCovered(object, object.oclass === RING_CLASS, state))
        return GETOBJ_EXCLUDE_INACCESS;
    return GETOBJ_SUGGEST;
}

function equipmentIsCovered(object: GameObject, knownCursedOnly: boolean, state: GameState): boolean {
    const blocks = (covering: GameObject | null | undefined) => !!covering
        && (!knownCursedOnly || !!covering.cursed && !!covering.bknown);
    if (object === state.uarm) return blocks(state.uarmc);
    if (object === state.uarmu) return blocks(state.uarmc) || blocks(state.uarm);
    if (object === state.uleft || object === state.uright) return blocks(state.uarmg);
    return false;
}

// C do_wear.c:inaccessible_equipment(..., FALSE).
export function coveringEquipment(object: GameObject): GameObject[] {
    if (!object.owornmask) return [];
    const { uarm, uarmc, uarmu, uarmg, uleft, uright } = game;
    if (object === uarm) return uarmc ? [uarmc] : [];
    if (object === uarmu) return [uarmc, uarm].filter(item => item != null);
    if (object === uleft || object === uright) return uarmg ? [uarmg] : [];
    return [];
}

export async function reportCoveredEquipment(object: GameObject): Promise<boolean> {
    const covering = coveringEquipment(object);
    const first = covering[0];
    if (!first) return false;
    const second = covering[1];
    const sameOwner = second !== undefined
        && objectOwnershipPrefix(first, game, { capitalized: false })
            === objectOwnershipPrefix(second, game, { capitalized: false });
    const name = covering.map((item, index) => {
        return index > 0 && sameOwner ? objectName(item)
            : ownedObjectName(item, game, { capitalized: false });
    }).join(' and ');
    await plineWithContinuation(`You need to take off ${name} to dip ${ownedObjectName(object, game, { capitalized: false })}.`);
    return true;
}

export function accessibleEquipment(accessory: boolean, state: GameState = game): GameObject[] {
    const objects = accessory
        ? [state.uleft, state.uright, state.uamul, state.ublindf]
        : [state.uarmh, state.uarms, state.uarmg, state.uarmf,
            state.uarmc || state.uarm || state.uarmu];
    return objects.filter((object): object is GameObject => object != null);
}

export function wearingFullEquipment(state: GameState = game): boolean {
    return !!(state.uarm && state.uarmu && state.uarmc && state.uarmh
        && state.uarms && state.uarmg && state.uarmf && state.uleft
        && state.uright && state.uamul && state.ublindf);
}

// armor.js — Hero armor-class projection.
// C refs: do_wear.c find_ac() and hack.h ARM_BONUS().
interface ArmorRemovalOptions {
    cancelledDon?: boolean;
    deferArmorClass?: boolean;
    // Armor_off() is voluntary; polymorph uses Armor_gone().
    voluntary?: boolean;
    // Removing embedded dragon skin bypasses setworn()'s slot loop, so it
    // never notifies monsters which remember the hero's resistances.
    embeddedSkin?: boolean;
}
interface ArmorOnOptions { initialDon?: boolean }
interface ArmorDestructionOptions { state?: GameState; publish?: MessagePublisher }
export interface ArmorErosionDescription {
    field: 'oeroded' | 'oeroded2';
    action: 'smoulder' | 'rust' | 'crack' | 'rot' | 'corrode';
}

type ArmorBonusSource = Pick<GameObject, 'otyp'>
    & Partial<Pick<GameObject, 'spe' | 'enchantment' | 'oeroded' | 'oeroded2'>>;

// objects[].a_ac is `10 - ac` for every ARMOR()/HELM()/CLOAK()/SHIELD()/
// GLOVES()/BOOTS() entry in the pinned objects.h. Armor occupies IDs 89..172.
// Keeping the complete table here makes equipment transactions consume object
// identity rather than role-specific or command-specific AC guesses.
export const OBJECT_ARMOR_BONUS = Object.freeze([
    // 89..100: helmets
    1, 1, 2, 0, 0, 0, 1, 1, 1, 1, 1, 1,
    // 101..110: dragon scale mail; 111..120: dragon scales
    9, 9, 9, 9, 9, 9, 9, 9, 9, 9,
    3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    // 121..135: ordinary suits
    7, 7, 6, 6, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1,
    // 136..137: shirts
    0, 0,
    // 138..149: cloaks
    0, 1, 0, 0, 1, 2, 1, 1, 3, 1, 1, 1,
    // 150..158: shields
    1, 1, 1, 2, 1, 1, 2, 2, 2,
    // 159..162: gloves
    1, 1, 1, 1,
    // 163..172: boots
    1, 2, 2, 1, 1, 1, 1, 1, 1, 1,
]);

const ARMOR_FIRST = 89;
const ARMOR_LAST = 172;
const ARMOR_SLOTS = Object.freeze([
    'uarm', 'uarmc', 'uarmh', 'uarmf', 'uarms', 'uarmg', 'uarmu',
] as const);
const ARMOR_MASKS = Object.freeze({
    uarm: W_ARM,
    uarmc: W_ARMC,
    uarmh: W_ARMH,
    uarms: W_ARMS,
    uarmg: W_ARMG,
    uarmf: W_ARMF,
    uarmu: W_ARMU,
});
export type ArmorSlot = keyof typeof ARMOR_MASKS;

const AC_MAX = 99;
const SPEED_BOOTS = 166;
const CLOAK_OF_INVISIBILITY = OBJECT_NAMES.indexOf('cloak of invisibility');
const HELM_OF_CAUTION = OBJECT_NAMES.indexOf('helm of caution');
const HELM_OF_TELEPATHY = OBJECT_NAMES.indexOf('helm of telepathy');
const OILSKIN_CLOAK = OBJECT_NAMES.indexOf('oilskin cloak');
const GAUNTLETS_OF_DEXTERITY = OBJECT_NAMES.indexOf('gauntlets of dexterity');
const HELM_OF_BRILLIANCE = OBJECT_NAMES.indexOf('helm of brilliance');

export function heroIsDisplaced(state: GameState = game) {
    const cloak = state?.uarmc || state?.u?.uarmc;
    return cloak?.otyp === CLOAK_OF_DISPLACEMENT
        || !!state?.displaced
        || !!state?.u?.displaced
        || (state?.u?.displacedTurns ?? 0) > 0;
}

// C youprop.h:Drain_resistance includes both intrinsic sources and the shield
// currently installed by setworn().
export function heroHasDrainResistance(state: GameState = game) {
    const hero = state.u;
    const shield = state?.uarms || hero.uarms;
    return !!(hero.drainResistance
        || shield?.otyp === SHIELD_OF_DRAIN_RESISTANCE
        || heroResistsLifeDrain(state)
        || heroHasArtifactDefense('life-drain', state));
}

// C youprop.h:Free_action includes the oc_oprop installed by either worn ring.
// Derive ring ownership from the live slots for the same lifecycle reason as
// shield-based drain resistance: taking the accessory off must remove the
// effect without an independently maintained boolean.
export function heroHasFreeAction(state: GameState = game) {
    const hero = state.u;
    const left = state?.uleft || hero.uleft;
    const right = state?.uright || hero.uright;
    return !!(hero.freeAction
        || left?.otyp === RIN_FREE_ACTION
        || right?.otyp === RIN_FREE_ACTION);
}

export function heroHasWaterWalking(state: GameState = game) {
    const hero = state.u;
    const boots = state?.uarmf || hero.uarmf;
    return !!(hero.waterWalking
        || boots?.otyp === WATER_WALKING_BOOTS);
}

export function heroKnowsWaterWalking(state: GameState = game) {
    const hero = state.u;
    const boots = state?.uarmf || hero.uarmf;
    const typeKnown = boots && objectTypeKnown(boots, state);
    return !hero.usteed && boots?.otyp === WATER_WALKING_BOOTS && !!typeKnown;
}

export function heroKnowsLavaWalking(state: GameState = game) {
    if (!heroKnowsWaterWalking(state)) return false;
    const hero = state.u;
    const boots = state?.uarmf || hero.uarmf;
    const fireResistant = hero.fireResistance;
    return !!fireResistant && !!boots?.oerodeproof && !!boots.rknown;
}

// do_wear.c's *_on() callbacks distinguish the physical worn property from
// the observable feedback which identifies the shuffled object type.
export function armorOnIdentifiesType(object: GameObject | null | undefined, effectMessages: readonly string[] = []) {
    if (object?.otyp === GAUNTLETS_OF_POWER) return true;
    if (object?.otyp === CLOAK_OF_DISPLACEMENT)
        return effectMessages.length > 0;
    if (object?.otyp === SPEED_BOOTS)
        return effectMessages.length > 0;
    return false;
}

// C objects.h armor macros encode the worn slot by contiguous object ranges.
// Keep that classification beside the AC table so startup, wear commands,
// and recalculation do not maintain independent type lists.
export function armorSlotFor(otyp: number | undefined): ArmorSlot | null {
    if (otyp === undefined) return null;
    if (otyp >= 89 && otyp <= 100) return 'uarmh';
    if (otyp >= 101 && otyp <= 135) return 'uarm';
    if (otyp >= 136 && otyp <= 137) return 'uarmu';
    if (otyp >= 138 && otyp <= 149) return 'uarmc';
    if (otyp >= 150 && otyp <= 158) return 'uarms';
    if (otyp >= 159 && otyp <= 162) return 'uarmg';
    if (otyp >= 163 && otyp <= 172) return 'uarmf';
    return null;
}

export function applyWornArmorProperty(object: GameObject, state: GameState = game) {
    const slot = armorSlotFor(object?.otyp);
    const property = OBJECT_PROPERTY[object?.otyp];
    if (slot) setWornArtifactProperties(object, slot, true, state);
    if (!slot || !property) return null;
    grantWornProperty(property, object, slot, state);
    return property;
}

// Armor-slot installation.  The Type_on() callbacks run later (afternmv in
// C); this step is the setworn() call that accessory_or_armor_on() and the
// polymorph paths perform, plus the pre-captures Armor_on() needs.
export async function wearHeroArmor(
    object: GameObject, state: GameState = game,
): Promise<ArmorSlot | null> {
    const slot = armorSlotFor(object?.otyp);
    if (!slot) return null;
    const hero = state.u;
    // setworn() installs physical properties immediately.  The later *_on()
    // callback needs the sources that existed before that installation.
    if (object.otyp === LEVITATION_BOOTS)
        object._levitationBeforeWear = captureLevitationState(state);
    if (object.otyp === WATER_WALKING_BOOTS)
        object._waterWalkingWasInWater = !!state.u.uinwater;
    if (object.otyp === CLOAK_OF_DISPLACEMENT)
        object._displacementWasActive = heroIsDisplaced(state);
    if (object.otyp === SPEED_BOOTS) {
        object._grantsVeryFastFromArmor = true;
        hero.veryFastFromArmor = true;
        hero.veryFast = true;
    }
    await setworn(object, ARMOR_MASKS[slot], state);
    return slot;
}

// C do_wear.c:Helmet_off(): fedora luck, cornuthaum charisma, and opposite
// alignment run before the slot is cleared; telepathy/caution clears the
// slot first and only then refreshes see_monsters() (do_wear.c:544-547).
// C do_wear.c:Gloves_off(): gauntlets of power are identified, encumbrance
// is re-reported, glib is cured, and a bare-handed petrifying corpse
// wield is resolved.
export async function removeHeroArmor(object: GameObject, state: GameState = game, options: ArmorRemovalOptions = {}) {
    const slot = armorSlotFor(object.otyp);
    if (!slot || equippedObject(state, slot) !== object) return false;
    if (object.otyp === LEVITATION_BOOTS || object.otyp === WATER_WALKING_BOOTS)
        requireLiveGame(state);
    const previousLevitation = captureLevitationState(state);
    const pending = pendingArmorAction(state);
    const cancelledDon = options.cancelledDon
        ?? (pending?.kind === 'wear' && pending.object === object);
    const losingGloves = equippedObject(state, 'uarmg') === object;
    if (pending?.object === object) {
        cancelDonning(state);
    }
    // C attrib.c:change_luck(-1): the fedora's luck refund at its bounds.
    if (object?.otyp === FEDORA && state.urole?.key === 'archeologist')
        state.u.uluck = Math.max(LUCKMIN, (state.u.uluck ?? 0) - 1);
    if (object.otyp === CORNUTHAUM && !cancelledDon) {
        state.u.abon ??= { a: [0, 0, 0, 0, 0, 0] };
        state.u.abon.a[A_CHA] += state.urole?.key === 'wizard' ? -1 : 1;
        state.context.botl = true;
    }
    if (object.otyp === HELM_OF_OPPOSITE_ALIGNMENT) {
        const alignment = state.u.ualignbase?.[0];
        if (alignment === undefined) throw new Error('Helmet removal requires the hero base alignment');
        await changeHeroAlignmentFromHelmet(alignment, false, state);
        if (state.program_state.gameover) return false;
    }
    const removed = await clearHeroArmor(object, state, { ...options, cancelledDon });
    if (removed && (object.otyp === HELM_OF_TELEPATHY || object.otyp === HELM_OF_CAUTION))
        await see_monsters();
    if (removed) {
        if (!cancelledDon) await announceDisplacementLoss(object, state);
        await applyCloakOffEffects(object, state);
        if (object.otyp === SPEED_BOOTS && !state.u.veryFast && !cancelledDon) {
            learnObjectType(object.otyp, state);
            await plineWithContinuation(formatFeltMessage(`yourself slow down${state.u.fast ? ' a bit' : ''}.`, state));
        }
        // Armor_off() clears cancelled_don before dragon handling, so an
        // interrupted blue suit still reports its speed loss.
        if (dragonArmorColor(object) === 'blue' && !state.u.veryFast)
            await plineWithContinuation('You slow down.');
        if (!cancelledDon && (object.otyp === ELVEN_CLOAK || object.otyp === ELVEN_BOOTS))
            await toggleArmorStealth(object, false, state);
    }
    if (losingGloves) {
        if (object.otyp === GAUNTLETS_OF_POWER) learnObjectType(object.otyp, state);
        await encumber_msg(state);
        // C Gloves_off() cures only existing Glib; make_glib(0) without it
        // would mark the status line.
        if (state.u.glib) setSlipperyHands(0, state);
        await losePetrificationProtection(object, state, !state.context.mon_moving && !object.in_use);
        if (state.program_state?.gameover) return removed;
    }
    if (removed && dragonArmorColor(object) === 'yellow') {
        await losePetrificationProtection(object, state, options.voluntary ?? true);
        if (state.program_state.gameover) return removed;
    }
    // C Boots_off(): identify before spoteffects(), which can kill the hero.
    if (removed && object.otyp === WATER_WALKING_BOOTS
        && (isPoolAt(state.u.ux, state.u.uy, state) || isLavaAt(state.u.ux, state.u.uy, state))
        && !propertyIsActive('levitation', state) && !propertyIsActive('flying', state)
        && !(heroFormClings(state) && levelHasCeiling(state))
        && !cancelledDon && !state.iflags.in_lava_effects) {
        learnObjectType(object.otyp, state);
        await applyHeroLocationEffects();
    }
    if (removed && object.otyp === LEVITATION_BOOTS) {
        const remaining = captureLevitationState(state);
        if (!remaining.hasSource && !previousLevitation.blockedByTerrain
            && !cancelledDon) {
            if (!state.iflags?.in_lava_effects)
                await floatHeroDown(0, 0, state, previousLevitation);
            learnObjectType(object.otyp, state);
        } else refreshMovementProperties(state);
        delete object._levitationBeforeWear;
    }
    return removed;
}

// C Cloak_off(): toggle_displacement() runs after the cloak's source is removed.
async function announceDisplacementLoss(object: GameObject, state: GameState = game): Promise<void> {
    if (object.otyp !== CLOAK_OF_DISPLACEMENT) return;
    const hero = state.u;
    if (propertyIsActive('displaced', state)
        || hero.displacedIntrinsic || hero.intrinsicDisplacement
        || hero.displacementBlocked || hero.displacedBlocked) return;
    if (!canObserveDisplacement(state)) return;
    learnObjectType(object.otyp, state);
    await plineWithContinuation(formatFeltMessage('that monsters no longer have difficulty pinpointing your location.', state));
}

// C wielding_corpse(): losing gloves or yellow dragon armor can expose a
// petrifying weapon. Resolve life saving before the removal continues.
async function losePetrificationProtection(armor: GameObject, state: GameState, voluntary: boolean) {
    if (equippedObject(state, 'uarmg')) return;
    const armorSlot = armorSlotFor(armor.otyp);
    if (!armorSlot) return;
    const slots: readonly ('uwep' | 'uswapwep')[] = state.u.twoweap
        ? ['uwep', 'uswapwep'] : ['uwep'];
    for (const slot of slots) {
        const weapon = equippedObject(state, slot);
        if (weapon?.otyp !== CORPSE || !touchPetrifies(weapon.corpsenm)
            || heroResistsStoning(state)) continue;
        await plineWithContinuation(`You ${armorSlot === 'uarmg' ? 'now wield' : 'are wielding'} ${corpseName(weapon, { includeArticle: true })} `
            + `in your bare ${makePlural(heroHandName(state))}.`);
        const protectionName = armorSlot === 'uarmg' ? simpleArmorName(armor, armorSlot, state)
            : simpleObjectName(armor, state).replace('set of ', '');
        const killer = `${voluntary ? 'removing' : 'losing'} ${protectionName} `
            + `while wielding ${killerObjectName(weapon, state)}`;
        const result = await resolveImmediatePetrification({ killer, state });
        if (result.died) return;
        if (!heroResistsStoning(state))
            // C wielding_corpse() unwields via remove_worn_item(obj, FALSE).
            await removeWornHeroItem(weapon, state, { unchainBall: false });
    }
}

// Slot/source removal without the Boots_off() transition.
// C do_wear.c:Armor_gone(): the destroyed-armor path — setnotworn() rather
// than setworn(0), the artifact-light stop message, and dragon handling
// with on_purpose FALSE.
// C do_wear.c:Shield_off().
// C do_wear.c:Shirt_off().
export async function clearHeroArmor(object: GameObject, state: GameState = game, {
    cancelledDon = pendingArmorAction(state)?.kind === 'wear'
        && pendingArmorAction(state)?.object === object,
    deferArmorClass = false,
    embeddedSkin = false,
}: ArmorRemovalOptions = {}) {
    const slot = armorSlotFor(object?.otyp);
    if (!slot) return false;
    if (equippedObject(state, slot) === object) cancelSlotTakeoff(slot, state);
    if (equippedObject(state, slot) === object && !cancelledDon)
        adjustArmorAttributeBonus(object, -objectEnchantment(object), state);
    const wasShining = object.lamplit && artifactEmitsLight(object);
    if (embeddedSkin) {
        // C polyself.c:skinback() unwrites the save/restore hack directly
        // (uarm = uskin; uskin = 0; owornmask &= ~I_SPECIAL): no setworn().
        if (state[slot] === object) state[slot] = null;
        if (state.u?.[slot] === object) state.u[slot] = null;
        object.worn = false;
        object.wornSlot = null;
        object.owornmask = (object.owornmask ?? 0) & ~ARMOR_MASKS[slot];
    } else {
        // C do_wear.c Armor_off()/Boots_off()/... clear the slot through
        // setworn((struct obj *) 0, mask), cancel_doff() included.
        await setworn(null, ARMOR_MASKS[slot], state);
    }
    if (wasShining && !artifactEmitsLight(object)) {
        endObjectBurn(object, state);
        if (!heroIsBlind(state))
            await plineWithContinuation(equipmentLightMessage(object, false, state));
    }
    await removeArmorProperties(object, state, { embeddedSkin });
    if (object.otyp === CORNUTHAUM) {
        state.u.clairvoyanceBlocked = false;
        refreshProperty('clairvoyant', state);
    }
    if (object.otyp === DUNCE_CAP) state.context.botl = true;
    if (object.otyp === ALCHEMY_SMOCK) removeWornProperty('acidResistance', object, 'uarmc', state);
    if (object.otyp === MUMMY_WRAPPING) refreshProperty('invisible', state);

    object._armorApplied = false;
    delete object._waterWalkingWasInWater;
    if (object.otyp === GAUNTLETS_OF_POWER) state.context.botl = true;
    if (object.otyp === SPEED_BOOTS) object._grantsVeryFastFromArmor = false;
    if ((object.otyp === FUMBLE_BOOTS || object.otyp === GAUNTLETS_OF_FUMBLING)
        && !fumblingHasPermanentOrEquipmentSource(state))
        setPropertyTimeout('fumbling', 0, state);
    if (deferArmorClass) state._armorClassDirty = true;
    else findArmorClass(state);
    return true;
}

// C do_wear.c:hard_helmet().
export function objectIsHardHelmet(
    object: Pick<GameObject, 'otyp' | 'oclass'> | null | undefined,
) {
    if (!object || armorSlotFor(object.otyp) !== 'uarmh') return false;
    return objectIsMetallic(object) || objectIsCrackable(object);
}

export function wornArmorInDestroyOrder(state: GameState = game) {
    return (['uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu'] as const)
        .map(slot => state[slot] || state.u?.[slot])
        .filter((object): object is GameObject => object != null);
}

// C do_wear.c:some_armor(). Only the outer torso layer is exposed; each
// other occupied slot has its own chance to replace the current choice.
export function someHeroArmor(state: GameState = game) {
    let armor = equippedObject(state, 'uarmc')
        || equippedObject(state, 'uarm') || equippedObject(state, 'uarmu');
    for (const slot of ['uarmh', 'uarmg', 'uarmf', 'uarms'] as const) {
        const candidate = equippedObject(state, slot);
        if (candidate && (!armor || rn2(4) === 0)) armor = candidate;
    }
    return armor;
}

// C do_wear.c:adj_abon(). The slot must still own the object when called,
// including the subtraction immediately before its *_off() transition.
export function adjustArmorAttributeBonus(object: GameObject | null | undefined, amount: number, state: GameState = game) {
    if (!object) return;
    const attributes: AttributeIndex[] = object === equippedObject(state, 'uarmg')
        && object.otyp === GAUNTLETS_OF_DEXTERITY ? [A_DEX]
        : object === equippedObject(state, 'uarmh')
            && object.otyp === HELM_OF_BRILLIANCE ? [A_INT, A_WIS] : [];
    if (!attributes.length) return;
    state.context.botl = true;
    if (!amount) return;
    const hero = state.u;
    hero.abon ||= { a: [0, 0, 0, 0, 0, 0] };
    for (const attribute of attributes) hero.abon.a[attribute] += amount;
    learnObjectType(object.otyp, state);
}

// C do_wear.c:destroy_arm(). Scroll damage bypasses grease but retains
// blessed-item protection, inventory resistances, billing, and destruction.
export async function erodeWornArmor(state: GameState = game) {
    const hits = rn2(4) + 1;
    const armors = wornArmorInDestroyOrder(state);
    if (!armors.length) return false;
    let damaged = false;
    for (let hit = 0; hit < hits; hit++) {
        const armor = armors[rn2(armors.length)];
        if (!armor) throw new Error('Armor erosion selected an invalid worn item');
        if (!erosionMatters(armor) || armor.oerodeproof) continue;
        const kind = (['burn', 'rust', 'crack', 'rot', 'corrosion'] as const)
            .find(candidate => objectIsVulnerableToErosion(armor, candidate, state));
        if (!kind) continue;
        const result = await erodeObject(armor, kind, {
            state, grease: false, pay: true, destroy: true,
        });
        if (result !== 'nothing') damaged = true;
        if (result === 'destroyed' || state.program_state?.gameover) break;
    }
    if (state.program_state?.gameover) return damaged;
    if (damaged) await stopHeroOccupation(state, plineWithContinuation);
    // destroy_arm() never calls find_ac(); moveloop_core() recomputes u.uac.
    state._armorClassDirty = true;
    return damaged;
}

// C do_wear.c:obj_erode_type(): the first erosion kind that can apply to
// the object from its material — burn, rust, crack, rot, or corrode.
export function objectErosionKind(object: Pick<GameObject, 'otyp' | 'oclass'>): ArmorErosionDescription | null {
    if (objectIsFlammable(object))
        return { field: 'oeroded', action: 'smoulder' };
    if (objectIsRustprone(object))
        return { field: 'oeroded', action: 'rust' };
    if (objectIsCrackable(object))
        return { field: 'oeroded', action: 'crack' };
    if (objectIsRottable(object))
        return { field: 'oeroded2', action: 'rot' };
    if (objectIsCorrodeable(object))
        return { field: 'oeroded2', action: 'corrode' };
    return null;
}

// C do_wear.c:wornarm_destroyed(): cancel any interrupted donning, take
// the piece off, and destroy it only if it survived the removal.
export async function destroyWornArmor(armor: GameObject, state: GameState = game) {
    await removeWornHeroItem(armor, state);
    if (state.program_state?.gameover || !state.inventory.includes(armor)) return false;
    await consumeInventoryItem(armor, state);
    return true;
}

// C do_wear.c:maybe_destroy_armor(): the slot check and the 90% resistance
// roll that mark this piece as the one that crumbles, inlined with the
// caller's per-slot messages.
// C do_wear.c:disintegrate_arm(), with a specified worn piece.
export async function disintegrateWornArmor(armor: GameObject, {
    state = game, publish = plineWithContinuation,
}: ArmorDestructionOptions = {}) {
    const slot = armorSlotFor(armor.otyp);
    if (!slot || equippedObject(state, slot) !== armor
        || objectResistsDestruction(armor, 0, 90)) return false;
    armor.in_use = true;
    const noun = simpleArmorName(armor, slot, state);
    let message;
    switch (slot) {
    case 'uarmc': message = `Your ${noun} crumbles and turns to dust!`; break;
    case 'uarm': {
        if (armor.lamplit) endObjectBurn(armor, state);
        const plural = noun === 'dragon scales';
        const surface = surfaceName(state.u.ux, state.u.uy, state);
        message = `Your ${noun} ${plural ? 'turn' : 'turns'} to dust and ${plural ? 'fall' : 'falls'} to the ${surface}!`;
        break;
    }
    case 'uarmu': message = `Your ${noun} crumbles into tiny threads and falls apart!`; break;
    case 'uarmh': message = `Your ${noun} turns to dust and is blown away!`; break;
    case 'uarmg': message = `Your ${noun} vanish!`; break;
    case 'uarmf': message = `Your ${noun} disintegrate!`; break;
    case 'uarms': message = `Your ${noun} crumbles away!`; break;
    }
    await publish(message);
    await destroyWornArmor(armor, state);
    if (state.program_state?.gameover) return true;
    state._armorClassDirty = true;
    if (slot === 'uarmg') {
        const result = await selfTouchPetrifyingWeapons({ messageStart: 'You', state, publish });
        if (result.died) return true;
    }
    await stopHeroOccupation(state, publish);
    return true;
}

export function simpleArmorName(armor: GameObject, slot: ArmorSlot, state: GameState): string {
    const name = OBJECT_NAMES[armor.otyp];
    if (!name) throw new RangeError(`Missing name for armor type ${armor.otyp}`);
    const appearance = state.objectDescriptions?.[armor.otyp]
        || OBJECT_DESCRIPTIONS[armor.otyp] || name;
    const known = objectTypeKnown(armor, state);
    switch (slot) {
    case 'uarm':
        if (name.endsWith('dragon scale mail')) return 'dragon mail';
        if (name.endsWith('dragon scales')) return 'dragon scales';
        if (name.endsWith(' mail')) return 'mail';
        return name.endsWith(' jacket') ? 'jacket' : 'suit';
    case 'uarmc':
        if (name === 'robe') return 'robe';
        if (name === 'mummy wrapping') return 'wrapping';
        if (name === 'alchemy smock') return known && armor.dknown ? 'smock' : 'apron';
        return 'cloak';
    case 'uarmh': return objectIsHardHelmet(armor) ? 'helm' : 'hat';
    case 'uarmu': return 'shirt';
    case 'uarmg':
        return armor.dknown && (known ? name : appearance).includes('gauntlets')
            ? 'gauntlets' : 'gloves';
    case 'uarmf':
        return armor.dknown && (appearance.includes('shoes') || known && name.includes('shoes'))
            ? 'shoes' : 'boots';
    case 'uarms':
        if (armor.otyp === SHIELD_OF_REFLECTION)
            return armor.dknown ? 'silver shield' : 'smooth shield';
        return 'shield';
    }
}

export function armorBaseBonus(otyp: number) {
    if (!Number.isInteger(otyp) || otyp < ARMOR_FIRST || otyp > ARMOR_LAST)
        return 0;
    return OBJECT_ARMOR_BONUS[otyp - ARMOR_FIRST] || 0;
}

function objectEnchantment(object: ArmorBonusSource | null | undefined): number {
    if (object && Number.isInteger(object.spe) && object.spe !== undefined) return object.spe;
    if (object && Number.isInteger(object.enchantment) && object.enchantment !== undefined) return object.enchantment;
    return 0;
}

function greatestErosion(object: ArmorBonusSource) {
    return Math.max(0,
        object?.oeroded || 0,
        object?.oeroded2 || 0);
}

export function armorBonus(object: ArmorBonusSource | null | undefined) {
    if (!object) return 0;
    const base = armorBaseBonus(object.otyp);
    return base + objectEnchantment(object)
        - Math.min(greatestErosion(object), base);
}

// objects[].oc_oprop supplies the primary dragon-armor resistance.  The
// later do_wear.c:dragon_armor_handling() transaction adds a second property
// for several colors; blue mail therefore owns both shock resistance and
// worn-equipment speed.
const DRAGON_ARMOR_EXTRA_PROPERTY = Object.freeze({
    black: 'drainResistance',
    blue: 'fast',
    green: 'sicknessResistance',
    red: 'infravision',
    gold: 'hallucinationResistance',
    orange: 'freeAction',
    yellow: 'stoneResistance',
    white: 'slowDigestion',
} as const);

function dragonArmorColor(object: GameObject): keyof typeof DRAGON_ARMOR_EXTRA_PROPERTY | null {
    const name = OBJECT_NAMES[object?.otyp] || '';
    const color = name.match(/^([a-z]+) dragon scale(?: mail|s)$/)?.[1];
    if (color === undefined) return null;
    switch (color) {
    case 'black': case 'blue': case 'green': case 'red':
    case 'gold': case 'orange': case 'yellow': case 'white':
        return color;
    default: return null;
    }
}

function grantArmorProperty(object: GameObject, state: GameState, property: PropertyName) {
    const hero = state.u;
    grantWornProperty(property, object, 'uarm', state);
    // C youprop.h distinguishes intrinsic Fast from Very_fast: any worn
    // extrinsic source (including blue dragon armor) owns the 2-in-3 speed
    // gate in u_calc_moveamt().  Keep that distinction in live hero state;
    // a single `fast` boolean cannot select the correct scheduler branch.
    if (property === 'fast') {
        object._grantsVeryFastFromArmor = true;
        hero.veryFastFromArmor = true;
        hero.veryFast = true;
    }
}

// C do_wear.c:Helmet_on(): the helm switch — fedora luck (applied by the
// dispatcher for archeologists), caution's monster refresh, the
// cornuthaum charisma swing, and the curse of dunce caps and opposite
// alignment helms.
async function applyHelmetOnEffects(object: GameObject, state: GameState): Promise<void> {
    if (object.otyp === CORNUTHAUM) {
        state.u.abon ??= { a: [0, 0, 0, 0, 0, 0] };
        state.u.abon.a[A_CHA] += state.urole?.key === 'wizard' ? 1 : -1;
        state.context.botl = true;
        learnObjectType(object.otyp, state);
    } else if (object.otyp === DUNCE_CAP || object.otyp === HELM_OF_OPPOSITE_ALIGNMENT) {
        if (object.otyp === HELM_OF_OPPOSITE_ALIGNMENT) {
            const alignment = state.u.ualign?.type;
            if (alignment === undefined || object.o_id === undefined)
                throw new Error('An opposite-alignment helm requires initialized alignment and object identity');
            object.known = true;
            const opposite = alignment === 1 ? -1 : alignment === -1 ? 1 : object.o_id % 2 ? -1 : 1;
            await changeHeroAlignmentFromHelmet(opposite, true, state);
            if (state.program_state.gameover) return;
        }
        const helmet = equippedObject(state, 'uarmh');
        if (helmet && !helmet.cursed) {
            const blind = heroIsBlind(state);
            observeObjectForNaming(helmet, { state });
            const action = blind ? 'vibrates' : `glows ${displayColorName('black', state)}`;
            await plineWithContinuation(`The ${objectName(helmet, state)} ${action} for a moment.`);
            curseObjectState(helmet, state);
            if (blind) helmet.bknown = false;
            else if (state.urole?.key === 'priest') helmet.bknown = true;
        }
        state.context.botl = true;
        if (heroIsHallucinating(state)) await plineWithContinuation('My brain hurts!');
        else if (helmet?.otyp === DUNCE_CAP) {
            const intelligence = (state.u.acurr?.a[A_INT] ?? 10)
                + (state.u.abon?.a[A_INT] ?? 0) + (state.u.atemp?.a[A_INT] ?? 0);
            await plineWithContinuation(formatFeltMessage(`${currentAttribute(A_INT, state) <= intelligence ? 'like sitting in a corner' : 'giddy'}.`, state));
        } else learnObjectType(HELM_OF_OPPOSITE_ALIGNMENT, state);
    } else if (object.otyp === HELM_OF_CAUTION) await see_monsters();
}

function fumblingHasPermanentOrEquipmentSource(state: GameState): boolean {
    const sources = state.u._propertySources?.fumbling;
    return hasIntrinsicProperty('fumbling', null, state) || hasWornProperty('fumbling', state)
        || !!sources?.invoked || !!sources?.carried.length
        || !!state.u.fumblingIntrinsic || !!state.u.fumblingFromIce;
}

function armorHasOtherPropertySource(property: PropertyName, object: GameObject, state: GameState): boolean {
    const sources = state.u._propertySources?.[property];
    const slot = armorSlotFor(object.otyp);
    return hasIntrinsicProperty(property, null, state) || propertyTimeout(property, state) > 0
        || !!sources?.invoked || !!sources?.carried.length
        || !!sources?.worn.some(source => source.slot !== slot);
}

// C do_wear.c:toggle_stealth(): feedback and discovery when stealth is
// gained or lost by wearing or removing elven items; riding suppresses it
// unless hero or steed flies.
// RIN_STEALTH discovery uses learnring(); elven items use makeknown() as
// learnObjectType().
async function toggleArmorStealth(object: GameObject, on: boolean, state: GameState): Promise<void> {
    if (armorHasOtherPropertySource('stealth', object, state) || propertyIsBlocked('stealth', state)
        || state.u.usteed && !propertyIsActive('flying', state) && !propertyIsActive('levitation', state)) return;
    learnObjectType(object.otyp, state);
    if (on) {
        const message = object.otyp === ELVEN_BOOTS
            ? propertyIsActive('levitation', state) || propertyIsActive('flying', state)
                ? 'You float imperceptibly.' : 'You walk very quietly.'
            : 'You move very quietly.';
        await plineWithContinuation(message);
    } else {
        const steed = state.u.usteed;
        await plineWithContinuation(steed
            ? `You and ${monsterName(steed, { state, article: 'your', suppressSaddle: true, suppressHallucination: true })} are noisy.`
            : 'You sure are noisy.');
    }
}

function canObserveDisplacement(state: GameState): boolean {
    const blind = heroIsBlind(state);
    const invisible = propertyIsActive('invisible', state) && !propertyIsActive('seeInvisible', state);
    return !blind && !state.u.uswallow && !invisible
        || hasWornProperty('telepathy', state) || !!state.u.unblindTelepathy
        || (state.u.unblind_telepat_range ?? -1) >= 0
        || blind && (propertyIsActive('telepathy', state) || !!state.u.blindTelepathy)
        || heroDetectsMonsters(state);
}

// C do_wear.c:Cloak_on(): the cloak switch — protection is identified,
// invisibility is announced, oilskin fits tightly, and the smock's acid
// resistance is installed.  The elven-cloak stealth and displacement
// branches live with the armor-on dispatcher below.
async function applyCloakOnEffects(object: GameObject, state: GameState): Promise<void> {
    switch (object.otyp) {
    case CLOAK_OF_PROTECTION: learnObjectType(object.otyp, state); break;
    case MUMMY_WRAPPING:
        if (armorHasOtherPropertySource('invisible', object, state) && !heroIsBlind(state)) {
            await newsym(state.u.ux, state.u.uy);
            await plineWithContinuation(`You can ${propertyIsActive('seeInvisible', state) ? 'no longer see through yourself' : 'see yourself'}!`);
        }
        break;
    case CLOAK_OF_INVISIBILITY:
        if (!armorHasOtherPropertySource('invisible', object, state) && !heroIsBlind(state)) {
            learnObjectType(object.otyp, state);
            await newsym(state.u.ux, state.u.uy);
            await plineWithContinuation(`Suddenly you can${propertyIsActive('seeInvisible', state) ? ' see through' : 'not see'} yourself.`);
        }
        break;
    case OILSKIN_CLOAK:
        observeObjectForNaming(object, { state });
        await plineWithContinuation(`The ${objectName(object, state)} fits very tightly.`);
        break;
    case ALCHEMY_SMOCK: grantWornProperty('acidResistance', object, 'uarmc', state); break;
    default: break;
    }
}

async function applyCloakOffEffects(object: GameObject, state: GameState): Promise<void> {
    if (heroIsBlind(state)) return;
    if (object.otyp === MUMMY_WRAPPING && propertyIsActive('invisible', state)) {
        await newsym(state.u.ux, state.u.uy);
        await plineWithContinuation(`You can ${propertyIsActive('seeInvisible', state) ? 'see through yourself' : 'no longer see yourself'}.`);
    } else if (object.otyp === CLOAK_OF_INVISIBILITY && !armorHasOtherPropertySource('invisible', object, state)) {
        learnObjectType(object.otyp, state);
        await newsym(state.u.ux, state.u.uy);
        await plineWithContinuation(`Suddenly you can ${propertyIsActive('seeInvisible', state) ? 'no longer see through yourself' : 'see yourself'}.`);
    }
}

// C do_wear.c:Armor_on() -> dragon_armor_handling().  Dragon armor's AC is
// C do_wear.c:Helmet_on(): the archeologist's fedora luck credit runs at
// this dispatcher so immediate and delayed wears share it.
// The displacement cloak's toggle_displacement() message is composed
// inline below instead of calling the shared helper.
// active as soon as setworn() installs the slot, but these extrinsics and
// their feedback are afternmv effects: they begin only when dressing reaches
// multi == 0.  Return messages so allmain can preserve nomovemsg ordering.
// C do_wear.c:Boots_on(): the boot switch — water walking, levitation,
// speed, fumbling, and elven stealth, with the AC-evident known flag.
// C do_wear.c:Gloves_on(): gauntlets of power are identified and gauntlets
// of fumbling start their rnd(20) timer; dexterity runs through the shared
// adj_abon() credit below.
// C do_wear.c:Cloak_on(): the elven-cloak and displacement branches that
// share the dispatcher's property bookkeeping.
export async function applyArmorOnEffects(object: GameObject, state: GameState = game, { initialDon = false }: ArmorOnOptions = {}): Promise<string[]> {
    if (object.otyp === LEVITATION_BOOTS || object.otyp === WATER_WALKING_BOOTS) requireLiveGame(state);
    const previousLevitation = object?._levitationBeforeWear
        ?? captureLevitationState(state);
    applyWornArmorProperty(object, state);
    adjustArmorAttributeBonus(object, objectEnchantment(object), state);
    if (object?.otyp === LEVITATION_BOOTS) {
        delete object._levitationBeforeWear;
        if (!previousLevitation.hasSource && !previousLevitation.blockedByTerrain) {
            object.known = true;
            learnObjectType(object.otyp, state);
            await floatHeroUp(state, previousLevitation);
            if (propertyIsActive('levitation', state))
                await applyHeroLocationEffects(undefined, { pick: false });
        } else refreshMovementProperties(state);
        return [];
    }
    if (object.otyp === WATER_WALKING_BOOTS) {
        if (state.u.uinwater) await applyHeroLocationEffects();
        if (object._waterWalkingWasInWater && !state.u.uinwater)
            learnObjectType(object.otyp, state);
        delete object._waterWalkingWasInWater;
        return [];
    }
    if (object?.otyp === FEDORA && state.urole?.key === 'archeologist') {
        // Helmet_on()/Helmet_off() use change_luck(), including its bounds.
        state.u.uluck = Math.min(LUCKMAX, (state.u.uluck ?? 0) + 1);
        return [];
    }
    if (armorSlotFor(object.otyp) === 'uarmh') {
        await applyHelmetOnEffects(object, state);
        return [];
    }
    if (object?.otyp === GAUNTLETS_OF_POWER) {
        state.context.botl = true;
        return [];
    }

    if (object.otyp === FUMBLE_BOOTS || object.otyp === GAUNTLETS_OF_FUMBLING) {
        const sources = state.u._propertySources?.fumbling;
        const slot = armorSlotFor(object.otyp);
        const otherEquipment = sources?.worn.some(source => source.slot !== slot);
        if (!otherEquipment && !hasIntrinsicProperty('fumbling', null, state)
            && !state.u.fumblingIntrinsic && !state.u.fumblingFromIce)
            setPropertyTimeout('fumbling', propertyTimeout('fumbling', state) + rnd(20), state);
        return [];
    }

    if (object.otyp === ELVEN_CLOAK || object.otyp === ELVEN_BOOTS) {
        if (!initialDon) await toggleArmorStealth(object, true, state);
        return [];
    }
    if (object.otyp === CLOAK_OF_DISPLACEMENT) {
        return !initialDon && !object._displacementWasActive && canObserveDisplacement(state)
            ? [formatFeltMessage('that monsters have difficulty pinpointing your location.', state)] : [];
    }
    if (armorSlotFor(object.otyp) === 'uarmc') {
        await applyCloakOnEffects(object, state);
        return [];
    }

    if (object.otyp === SPEED_BOOTS) {
        const sources = state.u._propertySources?.fast;
        const otherEquipment = sources?.worn.some(source => source.slot !== 'uarmf')
            || !!sources?.invoked || !!sources?.carried.length;
        if (!otherEquipment && propertyTimeout('fast', state) === 0) {
            return [formatFeltMessage(`yourself speed up${hasIntrinsicProperty('fast', null, state) ? ' a bit more' : ''}.`, state)];
        }
        return [];
    }

    const color = dragonArmorColor(object);
    const extraProperty = color ? DRAGON_ARMOR_EXTRA_PROPERTY[color] : null;
    if (!extraProperty) return [];

    const hero = state.u;
    const messages = [];
    const hadProperty = !!hero[extraProperty];
    const wasVeryFast = !!hero.veryFast;
    if (color !== 'gold') grantArmorProperty(object, state, extraProperty);

    if (color === 'blue') {
        if (!wasVeryFast)
            messages.push(`You speed up${hadProperty ? ' a bit more' : ''}.`);
    } else if (color === 'gold') {
        await makeHallucinated(0, {
            state, talk: !state.program_state?.restoring,
            resistanceSource: { object, slot: 'uarm' },
        });
    } else if (color === 'red') {
        state.vision_full_recalc = 1;
    }
    if (artifactEmitsLight(object) && !object.lamplit) {
        beginObjectBurn(object, state);
        if (!state.blind && !state.u.blindTurns) {
            const name = ownedObjectName(object, state);
            const verb = objectNameIsPlural(object, state) ? 'begin' : 'begins';
            messages.push(`${name} ${verb} to shine ${equipmentLightDescription(object, state)}!`);
        }
    }
    return messages;
}

// C do_wear.c:set_wear(NULL). ini_inv_use_obj() has already installed
// the slots, so apply their callbacks without installing equipment again.
// Native starting inventory equips armor, weapons, and quiver only.
export async function applyStartingArmorEffects(state: GameState = game) {
    for (const slot of ['uarmu', 'uarm', 'uarmc', 'uarmf', 'uarmg', 'uarmh', 'uarms'] as const) {
        const object = state[slot] || state.u?.[slot];
        if (!object) continue;
        const messages = await applyArmorOnEffects(object, state, { initialDon: true });
        if (state.program_state?.gameover) return;
        object.known = true;
        object._armorApplied = true;
        if (armorOnIdentifiesType(object, messages)) learnObjectType(object.otyp, state);
        for (const message of messages) await plineWithContinuation(message);
    }
}

// C do_wear.c:Armor_off() removes both the ordinary dragon resistance and
// the color-specific extra property after the suit leaves W_ARM.
// C do_wear.c:dragon_armor_handling() runs through the same removal for
// Armor_gone().
export async function removeArmorProperties(
    object: GameObject, state: GameState = game,
    { embeddedSkin = false }: { embeddedSkin?: boolean } = {},
) {
    const color = dragonArmorColor(object);
    const extraProperty = color ? DRAGON_ARMOR_EXTRA_PROPERTY[color] : null;
    const ordinaryProperty = OBJECT_PROPERTY[object?.otyp];
    const slot = armorSlotFor(object?.otyp);
    if (slot) setWornArtifactProperties(object, slot, false, state);
    if (ordinaryProperty && slot) {
        removeWornProperty(ordinaryProperty, object, slot, state);
        // C worn.c setworn()/setnotworn() call monstunseesu_prop() when an
        // oc_oprop item leaves its slot: monsters which can see the hero
        // forget that remembered resistance and may try that attack again.
        if (!embeddedSkin)
            monstersForgetHeroResistance(seenResistanceForProperty(ordinaryProperty), state);
    }
    if (!extraProperty) return;

    if (color !== 'gold') removeWornProperty(extraProperty, object, 'uarm', state);

    if (color === 'blue') {
        object._grantsVeryFastFromArmor = false;
    } else if (color === 'gold') {
        await makeHallucinated(1, {
            state, talk: !state.program_state?.restoring,
            resistanceSource: { object, slot: 'uarm' },
        });
    } else if (color === 'red') {
        state.vision_full_recalc = 1;
    }
}

function equippedObject(state: GameState, slot: WornPropertySlot): GameObject | null | undefined {
    if (Object.prototype.hasOwnProperty.call(state, slot)) return state[slot];
    return state.u?.[slot] || null;
}

function protectionItemBonus(object: GameObject | null | undefined, expectedType: number) {
    return object?.otyp === expectedType ? objectEnchantment(object) : 0;
}

// Rebuild current AC from authoritative equipment state. The default base is
// human AC 10; polymorph can supply `formArmorClass` without changing callers.
export function projectedArmorClass(state: GameState = game) {
    const hero = state.u;
    let armorClass = typeof hero.formArmorClass === 'number' && Number.isInteger(hero.formArmorClass)
        ? hero.formArmorClass
        : typeof hero.baseArmorClass === 'number' && Number.isInteger(hero.baseArmorClass) ? hero.baseArmorClass : 10;

    for (const slot of ARMOR_SLOTS)
        armorClass -= armorBonus(equippedObject(state, slot));

    armorClass -= protectionItemBonus(
        equippedObject(state, 'uleft'), RIN_PROTECTION,
    );
    armorClass -= protectionItemBonus(
        equippedObject(state, 'uright'), RIN_PROTECTION,
    );
    if (equippedObject(state, 'uamul')?.otyp === AMULET_OF_GUARDING)
        armorClass -= 2;

    if (hasIntrinsicProperty('protection', null, state))
        armorClass -= hero.ublessed || 0;
    armorClass -= hero.uspellprot || 0;

    return Math.max(-AC_MAX, Math.min(AC_MAX, armorClass));
}

// C do_wear.c:find_ac().
export function findArmorClass(state: GameState = game) {
    const hero = state.u;
    const armorClass = projectedArmorClass(state);
    if (hero.uac !== armorClass) {
        hero.uac = armorClass;
        state.context.botl = true;
    }
    return hero.uac;
}

export function armorSimpleName(
    object: Pick<GameObject, 'otyp'> & Partial<Pick<GameObject, 'oclass' | 'name' | 'dknown'>>,
    state: GameState = game,
) {
    const slot = armorSlotFor(object?.otyp);
    const actualName = OBJECT_NAMES[object?.otyp] || object?.name || 'armor';
    const description = state.objectDescriptions?.[object?.otyp]
        ?? OBJECT_DESCRIPTIONS[object?.otyp] ?? '';
    const dknown = object?.dknown !== false;
    const typeKnown = objectTypeKnown(object, state);

    if (slot === 'uarm') {
        if (/ dragon scale mail$/i.test(actualName)) return 'dragon mail';
        if (/ dragon scales$/i.test(actualName)) return 'dragon scales';
        if (/ mail$/i.test(actualName)) return 'mail';
        if (/ jacket$/i.test(actualName)) return 'jacket';
        return 'suit';
    }
    if (slot === 'uarmc') {
        if (actualName === 'robe') return 'robe';
        if (actualName === 'mummy wrapping') return 'wrapping';
        if (actualName === 'alchemy smock')
            return typeKnown && dknown ? 'smock' : 'apron';
        return 'cloak';
    }
    if (slot === 'uarmh') {
        const softHeadgear = new Set([
            'elven leather helm', 'fedora', 'cornuthaum', 'dunce cap',
        ]);
        return softHeadgear.has(actualName) ? 'hat' : 'helm';
    }
    if (slot === 'uarmg') {
        const perceivedName = typeKnown ? actualName : description;
        return dknown && /gauntlets/i.test(perceivedName)
            ? 'gauntlets' : 'gloves';
    }
    if (slot === 'uarmf') {
        return dknown
            && (/shoes/i.test(description)
                || (typeKnown && /shoes/i.test(actualName)))
            ? 'shoes' : 'boots';
    }
    if (slot === 'uarms') {
        if (object?.otyp === SHIELD_OF_REFLECTION)
            return dknown ? 'silver shield' : 'smooth shield';
        return 'shield';
    }
    if (slot === 'uarmu') return 'shirt';
    return actualName;
}

// C do_wear.c:fingers_or_gloves().
export function fingersOrGloves(): string {
    return game.uarmg ? armorSimpleName(game.uarmg) : makePlural(heroFingerName());
}

export async function armorOffMessage(object: GameObject, state: GameState = game) {
    if (state.flags?.verbose === false) return '';
    observeObjectForNaming(object, { state });
    return `You were wearing ${await inventoryItemDescription(object)}.`;
}

// C cancel_don(): discard the interrupted callback and its recovery text.
// The caller retains whether this was donning before clearing the action.
export function cancelDonning(state: GameState = game): void {
    state._afterMove = null;
    state._helplessDoneMessage = null;
    setMulti(0, state);
    const progress = state.context.takeoff;
    if (progress) {
        progress.current = null;
        progress.delay = 0;
    }
}

// C stop_donning(): a cancelled dressing action loses its incomplete armor;
// interrupted removal leaves the item worn.
export async function stopDonning(stolenObject: GameObject | null = null, state: GameState = game) {
    const delayed = pendingArmorAction(state);
    if (!delayed) {
        const progress = state.context.takeoff;
        const slot = progress?.current;
        const object = slot ? takeoffSlotObject(slot, state) : null;
        if (!progress || !object || !((object.owornmask ?? 0) & W_ARMOR)) return false;
        cancelDonning(state);
        const message = object === stolenObject ? ''
            : `You stop taking off the ${simpleObjectName(object, state)}.`;
        await finishHeroHelplessness(message, state);
        return false;
    }
    const puttingOn = delayed.kind === 'wear';
    cancelDonning(state);
    const message = !puttingOn && delayed.object === stolenObject ? ''
        : `You stop ${puttingOn ? 'putting on' : 'taking off'} the ${simpleObjectName(delayed.object, state)}.`;
    await finishHeroHelplessness(message, state);
    if (puttingOn)
        await removeHeroArmor(delayed.object, state, { cancelledDon: true, deferArmorClass: true });
    return true;
}

// C do_wear.c:Amulet_on()/Amulet_off(): the amulet of strangulation's
// timed grip on the hero, and the Strangled predicate that reads it.
export function heroIsStrangled(state = game) {
    return !!state.u.strangled || (state.u.strangledTurns ?? 0) > 0;
}

export function startAmuletStrangulation(state = game) {
    if (!heroCanBeStrangled(state) || heroIsStrangled(state)) return false;
    learnObjectType(AMULET_OF_STRANGULATION, state);
    state.u.strangledTurns = 6;
    state.context.botl = true;
    refreshProperty('strangled', state);
    return true;
}

export function clearHeroStrangulation(state = game) {
    if (heroIsStrangled(state)) state.context.botl = true;
    state.u.strangledTurns = 0;
    refreshProperty('strangled', state);
}

// Rings and amulets worn by the hero.
// C refs: worn.c:setworn(), do_wear.c:Ring_on(), Ring_off(), Amulet_on(),
// and Amulet_off().
const ACCESSORY_SLOTS = [
    { slot: 'uleft', mask: W_RINGL, label: 'left-ring' },
    { slot: 'uright', mask: W_RINGR, label: 'right-ring' },
    { slot: 'uamul', mask: W_AMUL, label: 'uamul' },
] as const;

export type AccessorySlot = (typeof ACCESSORY_SLOTS)[number]['slot'];

interface AmuletOnState {
    wasFlying: boolean;
    wasInGas: boolean;
}

const RING_ATTRIBUTES = new Map<number, AttributeIndex>([
    [OBJECT_NAMES.indexOf('gain strength'), A_STR],
    [OBJECT_NAMES.indexOf('gain constitution'), A_CON],
    [OBJECT_NAMES.indexOf('adornment'), A_CHA],
]);
const AMULET_OF_ESP = OBJECT_NAMES.indexOf('amulet of ESP');
const AMULET_OF_FLYING = OBJECT_NAMES.indexOf('amulet of flying');
const AMULET_OF_MAGICAL_BREATHING = OBJECT_NAMES.indexOf('amulet of magical breathing');
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;

const RIN_INCREASE_ACCURACY = OBJECT_NAMES.indexOf('increase accuracy');
const RIN_INCREASE_DAMAGE = OBJECT_NAMES.indexOf('increase damage');

// C do_wear.c:stuck_ring(). Find what prevents this ring from coming off.
export function ringRemovalObstacle(
    ring: GameObject | null | undefined, type: number, state: GameState = game,
): GameObject | null {
    if (!ring || ring.otyp !== type) return null;
    const amulet = state.uamul;
    if (heroHasNoLimbs(state)
        && amulet?.otyp === AMULET_OF_UNCHANGING && amulet.cursed) return amulet;
    const weapon = state.uwep;
    const primaryRing = state.u.rightHanded === false ? state.uleft : state.uright;
    if (weapon && isWeldedPrimary(weapon, state)
        && (ring === primaryRing || isBimanualObject(weapon))) return weapon;
    if (state.uarmg?.cursed) return state.uarmg;
    if (ring.cursed) return ring;
    return state.uarmg && (state.u.glibTurns ?? 0) > 0 ? state.uarmg : null;
}

export async function wearHeroAccessory(
    object: GameObject | null | undefined, slot: AccessorySlot, state: GameState = game,
): Promise<PropertyName | null> {
    const position = ACCESSORY_SLOTS.find(position => position.slot === slot);
    if (!object || !position) return null;
    const property = OBJECT_PROPERTY[object.otyp];
    if (property === 'levitation' || property === 'protectionFromShapeChangers')
        requireLiveGame(state);
    if (slot === 'uamul') {
        // C Amulet_on(): "make sure amulet isn't wielded/alt-wielded/
        // quivered, before wearing" — remove_worn_item(amul, FALSE) runs
        // before setworn(amul, W_AMUL).
        await removeWornHeroItem(object, state, { unchainBall: false });
    }
    const previousLevitation = captureLevitationState(state);
    const wasStealthy = propertyIsActive('stealth', state);
    const wasInvisible = propertyIsActive('invisible', state);
    const wasSeeingInvisible = propertyIsActive('seeInvisible', state);
    const wasFlying = !!state.u.flying;
    const wasInGas = property === 'magicalBreathing' && heroIsInDangerousRegion(state);
    // C accessory_or_armor_on(): setworn(obj, mask), then Ring_on() for
    // rings and Amulet_on() for amulets.
    await setworn(object, position.mask, state);
    if (slot !== 'uamul') {
        // C Ring_on(): "make sure ring isn't wielded; can't use
        // remove_worn_item() here because it has already been set worn in
        // a ring slot" — setuwep(0)/setuswapwep(0)/setuqwep(0).
        if (object === (state.uwep || state.u?.uwep)) await setPrimaryWeapon(null, state);
        else if (object === (state.uswapwep || state.u?.uswapwep))
            await setSecondaryWeapon(null, state);
        else if (object === (state.uquiver || state.u?.uquiver))
            await setQuiverObject(null, state);
        changeRingBonus(object, 1, state);
    }
    if (slot === 'uamul') await applyAmuletOnEffects(object, state, { wasFlying, wasInGas });
    if (property === 'warning') await see_monsters();
    if (property === 'seeInvisible') {
        await refreshInvisibleMonsters({ state });
        if (propertyIsActive('invisible', state) && !wasSeeingInvisible && !heroIsBlind(state)) {
            await newsym(state.u.ux, state.u.uy);
            await plineWithContinuation('Suddenly you are transparent, but there!');
            learnRing(object, true, state);
        }
    } else if (property === 'invisible' && !wasInvisible
        && !propertyIsBlocked('invisible', state) && !heroIsBlind(state)) {
        learnRing(object, true, state);
        await newsym(state.u.ux, state.u.uy);
        await showInvisibilityMessage(state);
    }
    if (property === 'protectionFromShapeChangers')
        await restoreNaturalMonsterShapes(state);
    if (property === 'stealth' && !wasStealthy && propertyIsActive('stealth', state)) {
        learnRing(object, true, state);
        await plineWithContinuation('You move very quietly.');
    }
    if (property === 'levitation') {
        if (!previousLevitation.hasSource && !previousLevitation.blockedByTerrain) {
            await floatHeroUp(state, previousLevitation);
            learnRing(object, true, state);
            if (propertyIsActive('levitation', state))
                await applyHeroLocationEffects(undefined, { pick: false });
        } else refreshMovementProperties(state);
    }
    return property || null;
}

async function showWornAmulet(object: GameObject, state: GameState): Promise<void> {
    const message = await objectWearMessage(object, state);
    if (message) await plineWithContinuation(message);
}

// C do_wear.c:Amulet_on(): the amulet switch after setworn() — gas relief,
// unchanging, change, strangulation, restful sleep, flight, guarding.
// float_vs_flight()'s levitation block runs in wearHeroAccessory's
// property grant before this switch.
async function applyAmuletOnEffects(
    object: GameObject, state: GameState, { wasFlying, wasInGas }: AmuletOnState,
): Promise<void> {
    if (object.otyp === AMULET_OF_CHANGE) {
        await changeSexFromAmulet(object, state);
        return;
    }
    let message: string | undefined;
    if (OBJECT_PROPERTY[object.otyp] === 'flying') state.context.botl = true;
    // C potion.c:make_slimed(0): wearing unchanging cures sliming silently.
    if (object.otyp === AMULET_OF_UNCHANGING && heroIsSliming(state)) clearHeroSliming(state);
    else if (object.otyp === AMULET_OF_RESTFUL_SLEEP) {
        const timeout = rnd(98) + 2;
        const previous = propertyTimeout('sleepy', state);
        if (!previous || timeout < previous) setPropertyTimeout('sleepy', timeout, state);
    } else if (object.otyp === AMULET_OF_STRANGULATION) {
        if (startAmuletStrangulation(state)) message = 'It constricts your throat!';
    } else if (OBJECT_PROPERTY[object.otyp] === 'magicalBreathing' && wasInGas) {
        // C region.c:region_danger(): the caller captured the gas state
        // while the amulet was off (heroIsInDangerousRegion).
        learnObjectType(object.otyp, state);
        message = 'You are no longer bothered by the poison gas.';
    } else if (OBJECT_PROPERTY[object.otyp] === 'flying' && state.u.flying && !wasFlying) {
        learnObjectType(object.otyp, state);
        message = 'You are now in flight.';
    } else if (object.otyp === AMULET_OF_GUARDING) {
        learnObjectType(object.otyp, state);
        findArmorClass(state);
    }
    await showWornAmulet(object, state);
    if (message) await plineWithContinuation(message);
}

async function changeSexFromAmulet(object: GameObject, state: GameState): Promise<void> {
    const original = heroPolyGender(state);
    if (!heroIsUnchanging(state)) changeHeroSex(state);
    const changed = heroPolyGender(state) !== original;
    if (changed) learnObjectType(AMULET_OF_CHANGE, state);
    await showWornAmulet(object, state);
    if (changed) {
        await newsym(state.u.ux, state.u.uy);
        state.context.botl = true;
        await plineWithContinuation(`You are suddenly very ${state.flags.female ? 'feminine' : 'masculine'}!`);
    } else await plineWithContinuation("You don't feel like yourself.");
    if (changed && !Upolyd(state.u)) {
        const role = state.urole;
        const level = state.u.ulevel;
        if (!role || level === undefined)
            throw new Error('Amulet transformation requires the hero role and experience level');
        const rankIndex = experienceRankIndex(level);
        const rank = role.title[rankIndex];
        if (!rank) throw new Error(`Role ${role.key} has no title for rank ${rankIndex}`);
        const before = original === 1 ? 'f' : 'm';
        const after = state.flags.female ? 'f' : 'm';
        const title = role.name[before] !== role.name[after] ? role.name[after]
            : rank[before] !== rank[after] ? rank[after]
                : `${state.flags.female ? 'female' : 'male'} ${rank[after]}`;
        recordGameLogEvent(`transformed into ${withIndefiniteArticle(title)}`, { state, flags: LL_MINORAC });
        // C polyself.c:livelog_newform(): the transformed-into chronicle line.
    }
    await plineWithContinuation('The amulet disintegrates!');
    if (!changed && object.dknown) await tryCallObjectType(object, state);
    await consumeInventoryItem(object, state);
}

// C do_wear.c:Ring_off_or_gone(): the ring removal switch — stealth,
// warning, see invisible, invisibility, levitation, attribute rings, and
// protection-from-shape-changers, with off_msg() timing left to callers.
// The stealth branch composes toggle_stealth()'s noisy message inline
// rather than calling the armor-side helper.
export async function removeHeroAccessory(
    object: GameObject, state: GameState = game,
): Promise<PropertyName | null> {
    if (state.uamul === object || state.u.uamul === object)
        return removeAmulet(object, state);
    const objectProperty = OBJECT_PROPERTY[object.otyp];
    if (objectProperty === 'levitation' || objectProperty === 'protectionFromShapeChangers')
        requireLiveGame(state);
    const previousLevitation = captureLevitationState(state);
    const wasStealthy = propertyIsActive('stealth', state);
    const property = await clearHeroAccessory(object, state);
    if (property === 'warning') await see_monsters();
    if (property === 'seeInvisible') {
        if (!propertyIsActive('seeInvisible', state)) await refreshInvisibleMonsters({ state });
        if (propertyIsActive('invisible', state) && !propertyIsActive('seeInvisible', state) && !heroIsBlind(state)) {
            await newsym(state.u.ux, state.u.uy);
            await plineWithContinuation('Suddenly you cannot see yourself.');
            learnRing(object, true, state);
        }
    } else if (property === 'invisible' && !propertyIsActive('invisible', state)
        && !propertyIsBlocked('invisible', state) && !heroIsBlind(state)) {
        await newsym(state.u.ux, state.u.uy);
        await plineWithContinuation(`Your body seems to unfade${propertyIsActive('seeInvisible', state) ? ' completely' : '..'}.`);
        learnRing(object, true, state);
    }
    if (property === 'stealth' && wasStealthy && !propertyIsActive('stealth', state)) {
        learnRing(object, true, state);
        const steed = state.u.usteed;
        await plineWithContinuation(steed
            ? `You and ${monsterName(steed, {
                state, article: 'your', suppressSaddle: true, suppressHallucination: true,
            })} are noisy.`
            : 'You sure are noisy.');
    }
    if (property === 'protectionFromShapeChangers'
        && !propertyIsActive('protectionFromShapeChangers', state))
        await restartMonsterShapechanging(state);
    if (property === 'levitation') {
        if (!previousLevitation.blockedByTerrain) {
            await floatHeroDown(0, 0, state, previousLevitation);
            if (state.program_state.gameover) return property;
            if (!propertyIsActive('levitation', state))
                learnRing(object, true, state);
        } else refreshMovementProperties(state);
    }
    return property;
}

// C do_wear.c:Amulet_off(): the amulet switch — ESP sees monsters first,
// guarding's AC is computed while still worn, strangulation ends, and
// flying/levitation settles after the slot is cleared.
// C polyself.c:float_vs_flight(): the levitation-blocked flying flag is
// reconciled inside clearHeroAccessory()'s property refresh.
async function removeAmulet(object: GameObject, state: GameState): Promise<PropertyName | null> {
    const strangled = heroIsStrangled(state);
    const flying = propertyIsActive('flying', state);
    const guarding = object.otyp === AMULET_OF_GUARDING;
    // C Amulet_off() calculates guarding AC while the amulet is still worn.
    if (guarding) findArmorClass(state);
    const property = await clearHeroAccessory(object, state);
    if (guarding) state._armorClassDirty = true;
    if (object.otyp === AMULET_OF_RESTFUL_SLEEP && !hasIntrinsicProperty('sleepy', null, state)
        && !state.u._propertySources?.sleepy?.worn.length
        && !state.u._propertySources?.sleepy?.carried.length) {
        setPropertyTimeout('sleepy', 0, state);
    }
    const message = await armorOffMessage(object, state);
    if (message) await plineWithContinuation(message);
    if (object.otyp === AMULET_OF_ESP) await see_monsters();
    else if (object.otyp === AMULET_OF_STRANGULATION && strangled) {
        await plineWithContinuation(heroIsBreathless(state)
            ? `Your ${heroNeckName(state)} is no longer constricted!` : 'You can breathe more easily!');
        learnObjectType(object.otyp, state);
    } else if (object.otyp === AMULET_OF_MAGICAL_BREATHING) {
        // C cant_drown() tests the form, not remaining magical breathing.
        // drown() still runs for the warning and inventory water damage.
        if (state.u.uinwater && !(heroFormFlags(state) & (M1_AMPHIBIOUS | M1_BREATHLESS))
            && !heroCanSwim(state)) {
            await plineWithContinuation(`You suddenly inhale an unhealthy amount of ${displayLiquidName('water')}!`);
            await applyHeroLiquidEffects(undefined, { entry: 'drown' });
            if (state.program_state.gameover) return property;
            learnObjectType(object.otyp, state);
        }
        if (heroIsInDangerousRegion(state)) {
            await plineWithContinuation('You are breathing poison gas!');
            learnObjectType(object.otyp, state);
        }
    } else if (object.otyp === AMULET_OF_FLYING && flying && !propertyIsActive('flying', state)) {
        state.context.botl = true;
        const overLiquid = isPoolAt(state.u.ux, state.u.uy, state) || isLavaAt(state.u.ux, state.u.uy, state)
            || levelIsWaterLevel(state) || Is_airlevel(state.u.uz);
        await plineWithContinuation(overLiquid ? 'You stop flying.' : 'You land.');
        await applyHeroLocationEffects();
        if (state.program_state.gameover) return property;
        learnObjectType(object.otyp, state);
    }
    return property;
}

// C setworn/setnotworn: remove the source without running Ring_off().
export async function clearHeroAccessory(
    object: GameObject, state: GameState = game,
    { deferArmorClass = false }: { deferArmorClass?: boolean } = {},
): Promise<PropertyName | null> {
    const position = ACCESSORY_SLOTS.find(({ slot }) =>
        state[slot] === object || state.u[slot] === object);
    if (!position) return null;
    const { slot } = position;
    // C do_wear.c Ring_off_or_gone(): gone items take setnotworn(obj) and
    // voluntary removal setworn(0, obj->owornmask); both paths share the
    // slot work below.  The extrinsic removal and the monstunseesu() notice
    // are setworn()'s.
    await setworn(null, position.mask, state);
    const property = OBJECT_PROPERTY[object.otyp];
    if (slot !== 'uamul') changeRingBonus(object, -1, state, deferArmorClass);
    if (object.otyp === AMULET_OF_STRANGULATION && heroIsStrangled(state)) {
        clearHeroStrangulation(state);
    }
    return property || null;
}

// C do_wear.c:adjust_attrib().
function changeRingBonus(ring: GameObject, direction: 1 | -1, state: GameState, deferArmorClass = false): void {
    const attribute = RING_ATTRIBUTES.get(ring.otyp);
    if (attribute !== undefined) {
        const before = currentAttribute(attribute, state);
        state.u.abon ??= { a: [0, 0, 0, 0, 0, 0] };
        state.u.abon.a[attribute] += direction * ring.spe;
        const observable = before !== currentAttribute(attribute, state);
        if (observable || !attributeIsAtLimit(attribute, state))
            learnRing(ring, observable, state);
        state.context.botl = true;
    } else if (ring.otyp === RIN_INCREASE_ACCURACY) {
        state.u.uhitinc = (state.u.uhitinc || 0) + direction * ring.spe;
    } else if (ring.otyp === RIN_INCREASE_DAMAGE) {
        state.u.udaminc = (state.u.udaminc || 0) + direction * ring.spe;
    } else if (ring.otyp === RIN_PROTECTION) {
        learnRing(ring, ring.spe !== 0, state);
        if (ring.spe) {
            if (deferArmorClass) state._armorClassDirty = true;
            else findArmorClass(state);
        }
    }
}

// C do_wear.c:learnring(). observe_object() records the ring's appearance
// whenever the effect was observable; only hallucination suppresses that
// observation, blindness does not.
function learnRing(ring: GameObject, observable: boolean, state: GameState): void {
    if (observable) {
        if (objectTypeKnown(ring, state)) {
            observeObject(ring, state);
        } else if (ring.dknown) {
            learnObjectType(ring.otyp, state);
        }
    }
    if (ring.dknown && objectTypeKnown(ring, state) && objectCharged(ring.otyp))
        ring.known = true;
}

function currentEyewear(): GameObject | null {
    return game.ublindf || game.u?.ublindf || null;
}

function simpleEyewearName(object: GameObject): string {
    if (isEyesOfTheOverworld(object)) return 'the Eyes of the Overworld';
    if (object.otyp === LENSES) return 'a pair of lenses';
    if (object.otyp === TOWEL) return 'a towel';
    return 'a blindfold';
}

// C do_wear.c:Blindf_on() installs eyewear with setworn(otmp, W_TOOL) after
// releasing a wielded or quivered item through remove_worn_item(otmp, FALSE).
async function equipEyewear(object: GameObject): Promise<void> {
    await removeWornHeroItem(object, game, { unchainBall: false });
    await setworn(object, W_TOOL, game);
}

// C do_wear.c:Blindf_off() clears the slot with setworn(0, otmp->owornmask).
export async function unequipEyewear(object: GameObject, state: GameState = game): Promise<void> {
    await setworn(null, W_TOOL, state);
}

async function announceWorn(object: GameObject): Promise<void> {
    const message = await objectWearMessage(object);
    if (message) await pline(message);
}

// C do_wear.c:already_wearing2(): the "can't wear X because you're wearing
// Y there already" refusal for occupied eyewear, plus the towel's face
// message from the same branch of accessory_or_armor_on().
async function announceOccupiedSlot(object: GameObject, worn: GameObject): Promise<void> {
    if (worn.otyp === TOWEL) {
        await pline('Your face is already covered by a towel.');
    } else if (worn.otyp === BLINDFOLD && object.otyp === LENSES) {
        await pline(
            "You can't wear lenses because you're wearing a blindfold there already.",
        );
    } else if (worn.otyp === LENSES && object.otyp === BLINDFOLD) {
        await pline(
            "You can't wear a blindfold because you're wearing some lenses there already.",
        );
    } else if (worn.otyp === LENSES) {
        await pline('You are already wearing some lenses.');
    } else {
        await pline('You are already wearing a blindfold.');
    }
}

export function isEyewear(object: Pick<GameObject, 'otyp'> | null | undefined): boolean {
    return !!object && [BLINDFOLD, LENSES, TOWEL].includes(object.otyp);
}

// C do_wear.c:Blindf_on(): setworn() runs here, not in the caller — the
// on_msg(), the blindness transition, and the punished ball-and-chain
// notice all follow the slot change.
export async function wearEyewear(object: GameObject | null | undefined, { checkHead = true }: { checkHead?: boolean } = {}): Promise<boolean> {
    if (!object || !isEyewear(object)) return false;
    if (checkHead && heroHasNoHead(game)) {
        await pline(
            `You have no head to wear ${simpleEyewearName(object)} on.`,
        );
        return false;
    }
    const worn = currentEyewear();
    if (worn) {
        await announceOccupiedSlot(object, worn);
        return false;
    }

    const wasBlind = heroIsBlind(game);
    await equipEyewear(object);
    const blind = syncBlindness(game);
    await announceWorn(object);
    if (!wasBlind && blind) {
        if (game.flags?.verbose !== false)
            await plineWithContinuation("You can't see any more.");
        if (game.uball || game.u.uball)
            await setBallAndChainFelt(false, game);
    } else if (wasBlind && !blind) {
        if (game.u.uroleplay?.blind) {
            await plineWithContinuation(
                'For the first time in your life, you can see!',
            );
            game.u.uroleplay.blind = false;
        } else {
            await plineWithContinuation('You can see!');
        }
    }
    if (wasBlind !== blind) await toggleBlindness(game);
    return true;
}

// C do_wear.c:Blindf_off(): clear the eyewear slot, then report the
// blindness transition — "still cannot see", the gulp check for regaining
// sight, and the ball-and-chain notice when newly blinded.
// setworn(0) is unequipEyewear() below.
export async function removeEyewear(object: GameObject | null = null, {
    state = game, publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}): Promise<boolean> {
    const noOffMessage = !object;
    const worn = state.ublindf || state.u.ublindf;
    object ||= worn ?? null;
    if (!object || worn !== object) return false;
    const wasBlind = heroIsBlind(state);
    await unequipEyewear(object, state);
    const blind = syncBlindness(state);
    if (!noOffMessage && state.flags?.verbose !== false)
        await publish(await armorOffMessage(object, state));

    let changed = false;
    if (blind) {
        if (!wasBlind) {
            await publish("You can't see anything now!");
            if (state.uball || state.u.uball)
                await setBallAndChainFelt(false, state);
            changed = true;
        } else if (object.otyp !== LENSES) {
            await publish('You still cannot see.');
        }
    } else if (wasBlind) {
        const gulp = await gulpBlindnessCheck({ state, publish });
        if (gulp.died) return true;
        if (!gulp.triggered) {
            await publish('You can see again.');
            changed = true;
        }
    }
    if (changed) await toggleBlindness(state);
    return true;
}

export async function applyEyewear(object: GameObject): Promise<boolean> {
    const worn = currentEyewear();
    if (worn === object) {
        // apply.c:doapply()'s BLINDFOLD/LENSES branch runs do_wear.c
        // cursed() before Blindf_off(): a cursed worn item refuses with
        // "You can't.  It is cursed." and reveals its BUC.
        if (object.cursed) {
            const plural = object.otyp === LENSES || (object.quan ?? 1) > 1;
            await pline(`You can't.  ${plural ? 'They are' : 'It is'} cursed.`);
            object.bknown = true;
            return false;
        }
        return removeEyewear(object);
    }
    if (!worn) return wearEyewear(object, { checkHead: false });

    const description = worn.otyp === TOWEL
        ? 'covered by a towel'
        : worn.otyp === BLINDFOLD
            ? 'wearing a blindfold' : 'wearing lenses';
    await pline(`You are already ${description}.`);
    return false;
}

// C do_wear.c:glibr(). Each turn, slippery fingers shed uncursed rings and
// any wielded weapon that is not welded or an aklys.
export function heroHasSlipperyHands(state: GameState): boolean {
    return !!state.u.glib || (state.u.glibTurns ?? 0) > 0;
}

function slipVerb(plural: boolean): string {
    return plural ? 'slip' : 'slips';
}

export async function slipFromSlipperyHands(
    state: GameState, publish: MessagePublisher = plineWithContinuation,
): Promise<void> {
    const hero = state.u;
    const weapon = state.uwep ?? null;
    const rightHanded = hero.rightHanded !== false;
    // A welded two-handed weapon pins only the ring on the weapon hand.
    const ringFalls = (ring: GameObject | null | undefined, weaponHand: boolean) => {
        if (!ring || ring.cursed) return false;
        return !weapon || !(isWeldedPrimary(weapon, state) && weaponHand)
            || !isBimanualObject(weapon);
    };
    const left = state.uleft ?? null;
    const right = state.uright ?? null;
    const leftFalls = ringFalls(left, !rightHanded);
    const rightFalls = ringFalls(right, rightHanded);
    let slipped = 0;
    if (!state.uarmg && (leftFalls || rightFalls) && !heroHasNoLimbs(state)) {
        const both = leftFalls && rightFalls;
        await publish(`Your ${both ? 'rings slip' : 'ring slips'} off your ${
            both ? makePlural(heroFingerName(state)) : heroFingerName(state)}.`);
        slipped++;
        for (const ring of [leftFalls ? left : null, rightFalls ? right : null]) {
            if (!ring) continue;
            await removeHeroAccessory(ring, state);
            await dropInventoryObjectAtHero(ring, { state, publish });
            cmdq_clear(CQ_CANNED, state);
        }
    }

    let otherWeapon: string | null = null;
    let wasTwoWeapon = false;
    const secondary = state.uswapwep ?? null;
    if (hero.twoweap && secondary) {
        const quantity = secondary.quan ?? 1;
        otherWeapon = isSword(secondary) ? 'sword' : weaponDescription(secondary);
        if (quantity > 1) otherWeapon = makePlural(otherWeapon);
        await publish(`Your ${otherWeapon} ${slipped ? 'also ' : ''}${slipVerb(quantity > 1)} from your ${
            rightHanded ? 'left ' : 'right '}${heroHandName(state)}.`);
        slipped++;
        wasTwoWeapon = true;
        await setSecondaryWeapon(null, state);
        cmdq_clear(CQ_CANNED, state);
        if (await canLetGo(secondary, '', state)) await dropInventoryObjectAtHero(secondary, { state, publish });
    }

    const primary = state.uwep ?? null;
    if (!primary || primary.otyp === AKLYS || isWeldedPrimary(primary, state)) return;
    let kind = isSword(primary) ? 'sword' : weaponDescription(primary);
    if (otherWeapon && kind !== makeSingular(otherWeapon)) otherWeapon = null;
    // Several wielded food items still slip as one "food".
    let plural = (primary.quan ?? 1) > 1;
    if (plural) {
        if (kind === 'food') plural = false;
        else kind = makePlural(kind);
    }
    let hand = heroHandName(state);
    let which = '';
    if (isBimanualObject(primary)) hand = makePlural(hand);
    else if (wasTwoWeapon) which = rightHanded ? 'right ' : 'left ';
    await publish(`${kind.startsWith('corpse') ? 'The' : 'Your'} ${otherWeapon ? 'other ' : ''}${kind} ${
        slipped ? 'also ' : ''}${slipVerb(plural)} from your ${which}${hand}.`);
    await setPrimaryWeapon(null, state);
    cmdq_clear(CQ_CANNED, state);
    if (await canLetGo(primary, '', state)) await dropInventoryObjectAtHero(primary, { state, publish });
}

// C do_wear.c:on_msg(). Zero-delay armor uses xname; accessories use prinv.
export async function objectWearMessage(object: GameObject, state: GameState = game): Promise<string | null> {
    const mask = object.owornmask ?? 0;
    const verbose = state.flags.verbose !== false;
    const inventoryFeedback = !!(mask & (W_RING | W_AMUL)) || !!(mask & W_TOOL) && !verbose;
    if (!inventoryFeedback && !verbose) return null;
    observeObjectForNaming(object, { state });
    if (inventoryFeedback) return `${object.invlet} - ${await objectDescription(object, { state })}.`;
    const noun = objectName(object, state);
    const name = objectHasPersonalName(object, state) ? `the ${noun}` : withIndefiniteArticle(noun);
    const how = object.otyp === TOWEL ? ` around your ${heroHeadName(state)}` : '';
    return `You are now wearing ${name}${how}.`;
}
