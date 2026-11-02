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

import { game, requireLiveGame } from './gstate.js';
import { pline, plineWithContinuation } from './pline.js';
import { commandResultCancelled, setMulti, clearCannedCommands } from './cmd.js';
import { nomul, applyHeroLocationEffects, heroCanSwim, applyHeroLiquidEffects } from './hack.js';
import { finishHeroHelplessness } from './allmain.js';
import type { GameObject } from './object_types.js';
import { monsterIsHumanoid, MONSTER_NAME } from './monster_data.js';
import { GRAY_DRAGON_SCALES, HELM_OF_OPPOSITE_ALIGNMENT, LENSES, MEAT_RING, OBJECT_DELAY, AMULET_OF_GUARDING, ALCHEMY_SMOCK, CLOAK_OF_DISPLACEMENT, CLOAK_OF_PROTECTION, CORPSE, CORNUTHAUM, DUNCE_CAP, ELVEN_BOOTS, ELVEN_CLOAK, GAUNTLETS_OF_FUMBLING, GAUNTLETS_OF_POWER, MUMMY_WRAPPING, FEDORA, FUMBLE_BOOTS, LEVITATION_BOOTS, RIN_FREE_ACTION, RIN_PROTECTION, GRAY_DRAGON_SCALE_MAIL, YELLOW_DRAGON_SCALE_MAIL, YELLOW_DRAGON_SCALES, SHIELD_OF_DRAIN_RESISTANCE, SHIELD_OF_REFLECTION, OBJECT_DESCRIPTIONS, OBJECT_NAMES, OBJECT_PROPERTY, WATER_WALKING_BOOTS, AMULET_OF_CHANGE, AMULET_OF_RESTFUL_SLEEP, AMULET_OF_STRANGULATION, AMULET_OF_UNCHANGING, OBJECT_CHARGED, AKLYS, TOWEL } from './object_data.js';
import { GETOBJ_SUGGEST, PARANOID_REMOVE, W_ACCESSORY, W_ARMOR, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_INACCESS, A_CHA, A_DEX, A_INT, A_WIS, LUCKMIN, LUCKMAX, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, A_CON, A_STR, Is_airlevel, Upolyd, W_AMUL, W_RING, W_RINGL, W_RINGR, W_TOOL } from './const.js';
import { isBimanualObject, isSword } from './object_properties.js';
import { heroFingerName, heroHandName, heroNeckName, heroHeadName } from './body_parts.js';
import type { PlayingGameState, GameState } from './game_state.js';
import type { ArmorCompletion } from './cmd.js';
import { recordRandom } from './monster_action_types.js';
import type { MonsterCallLog, RandomBelow } from './monster_action_types.js';
import { heroHasNoHead, heroSpecies, changeHeroSex, heroIsBreathless, heroPolyGender } from './hero_species.js';
import { heroHasNoHands, heroHasNoLimbs, heroIsVerySmall, heroFormClings, heroFormFlags, heroIsUnchanging } from './polyself.js';
import { armorWearDecision } from './armor_wear.js';
import { isEyewear, removeEyewear, wearEyewear } from './eyewear.js';
import { retouchHeroObject } from './hero_retouch.js';
import { learnObjectType, observeObject } from './o_init.js';
import { observeObjectForNaming, objectName, ownedObjectName, corpseName, killerObjectName, objectNameIsPlural, simpleObjectName, makePlural, withIndefiniteArticle, makeSingular, objectDescription, objectHasPersonalName } from './objnam.js';
import { inventoryItemDescription, consumeInventoryItem } from './invent.js';
import { chooseInventoryObject, compactInventoryLetters } from './inventory_prompt.js';
import { canSelectOff } from './bulk_takeoff.js';
import { isWeldedPrimary, releaseWeaponSlots, setPrimaryWeapon, setSecondaryWeapon } from './wield.js';
import { yn_function } from './query.js';
import { objectOwnershipPrefix, objectTypeKnown } from './shk.js';
import type { InventoryClassification } from './inventory_prompt.js';
import { objectMaterial } from './o_init.js';
import { formatFeltMessage } from './hero_speech.js';
import { heroDetectsMonsters, heroIsBlind, heroIsHallucinating } from './senses.js';
import { makeHallucinated } from './hero_mental_status.js';
import { displayColorName, newsym, see_monsters, displayLiquidName } from './display.js';
import { objectResistsDestruction } from './zap.js';
import { erodeObject, erosionMatters, objectIsVulnerableToErosion } from './trap.js';
import { stopHeroOccupation } from './occupation.js';
import { heroResistsStoning, resolveImmediatePetrification, selfTouchPetrifyingWeapons, touchPetrifies } from './stoning.js';
import { setSlipperyHands } from './towel.js';
import { surfaceName } from './terrain_name.js';
import { isLavaAt, isPoolAt } from './dbridge.js';
import { levelHasCeiling, levelIsWaterLevel } from './dungeon.js';

import { removeWornHeroItem } from './hero_equipment.js';
import { floatHeroDown, floatHeroUp } from './terrain_movement.js';
import { artifactEmitsLight, heroHasArtifactDefense, setWornArtifactProperties } from './artifacts.js';
import { beginObjectBurn, endObjectBurn, equipmentLightDescription, equipmentLightMessage } from './light.js';
import { rn2, rnd } from './rng.js';
import type { PropertyName, WornPropertySlot } from './property_types.js';
import type { MessagePublisher } from './pline.js';
import { changeHeroAlignmentFromHelmet } from './alignment.js';
import { currentAttribute, attributeIsAtLimit } from './attrib.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { curseObjectState } from './mkobj.js';
import type { AttributeIndex } from './attrib.js';
import { monsterName } from './do_name.js';
import { captureLevitationState, grantWornProperty, hasIntrinsicProperty, hasWornProperty, propertyIsActive, propertyIsBlocked, propertyTimeout, refreshMovementProperties, refreshProperty, removeWornProperty, setPropertyTimeout } from './properties.js';
import { monstersForgetHeroResistance, seenResistanceForProperty, heroResistsLifeDrain } from './mondata.js';
import { refreshInvisibleMonsters } from './hero_seeing.js';
import { showInvisibilityMessage } from './hero_invisibility.js';
import { tryCallObjectType } from './do.js';
import { LL_MINORAC, recordGameLogEvent } from './gamelog.js';
import { experienceRankIndex } from './exper.js';
import { clearHeroSliming, heroIsSliming } from './slime.js';
import { heroIsInDangerousRegion } from './regions.js';
import { restartMonsterShapechanging, restoreNaturalMonsterShapes } from './mon.js';
import { clearHeroStrangulation, heroIsStrangled, startAmuletStrangulation } from './hero_strangulation.js';
import { canLetGo } from './hero_inventory.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
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
    if (object.oclass === 3) {
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

    if (object.oclass === 5 || object.class === 'Amulets') {
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

    if ((object.oclass === 4 || object.class === 'Rings' || object.otyp === MEAT_RING)
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

    const delay = OBJECT_DELAY[object.otyp] ?? 0;
    const isArmor = object.class === 'Armor' || object.oclass === 3;
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

    // C accessory_or_armor_on(): armor leaves any held slot before setworn.
    // Cursed armor does not weld to the hand.
    await releaseWeaponSlots(object, game);
    wearHeroArmor(object, game);
    // C do_wear.c installs the slot with setworn() now, but allmain.c does
    // not run find_ac() until the command's monster/global time has passed.
    // Mark that once-per-input boundary; identification and Armor_on()
    // extrinsics remain later afternmv effects.
    const delay = OBJECT_DELAY[object.otyp] ?? 0;
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
    if (action === 'wear' && object.oclass === 3) {
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
    if (object.oclass === 3) await putOnArmorObject(object);
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


// C do_wear.c:equip_ok(), inaccessible_equipment(), count_worn_stuff().
type EquipmentAction = 'wear' | 'put on' | 'take off' | 'remove';

// C do_wear.c:equip_ok().
// C do_wear.c:puton_ok().
// C do_wear.c:remove_ok().
// C do_wear.c:wear_ok().
// C do_wear.c:takeoff_ok().
export function equipmentClassification(
    object: GameObject, action: EquipmentAction, itemAction = false, state: GameState = game,
): InventoryClassification {
    const removing = action === 'take off' || action === 'remove';
    const accessory = action === 'put on' || action === 'remove';
    const worn = !!((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY));
    if (removing !== worn) return GETOBJ_EXCLUDE_INACCESS;
    if (![3, 4, 5].includes(object.oclass) && !isEyewear(object) && object.otyp !== MEAT_RING)
        return GETOBJ_EXCLUDE;
    if (accessory !== (object.oclass !== 3)) return GETOBJ_DOWNPLAY;
    if (object.oclass === 3 && !removing && armorWearDecision(object, state).refusal)
        return GETOBJ_DOWNPLAY;
    if (removing && !itemAction && equipmentIsCovered(object, object.oclass === 4, state))
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
const IRON = 11;
const MITHRIL = 17;
const GLASS = 19;
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

export function wearHeroArmor(object: GameObject, state: GameState = game): ArmorSlot | null {
    const slot = armorSlotFor(object?.otyp);
    if (!slot) return null;
    const hero = state.u;
    const previous = equippedObject(state, slot);
    if (previous && previous !== object) cancelSlotTakeoff(slot, state);
    // setworn() installs physical properties immediately. The later *_on()
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
    state[slot] = object;
    if (state.u) state.u[slot] = object;
    object.worn = true;
    object.wornSlot = slot;
    object.owornmask = (object.owornmask ?? 0) | ARMOR_MASKS[slot];
    applyWornArmorProperty(object, state);
    if (object.otyp === MUMMY_WRAPPING) refreshProperty('invisible', state);
    if (object.otyp === CORNUTHAUM) {
        state.u.clairvoyanceBlocked = state.urole?.key !== 'wizard';
        refreshProperty('clairvoyant', state);
    }
    return slot;
}

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
        await reportHeroEncumbrance(state);
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
        if (!heroResistsStoning(state)) await releaseWeaponSlots(weapon, state);
    }
}

// Slot/source removal without the Boots_off() transition.
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
    if (state[slot] === object) state[slot] = null;
    if (state.u?.[slot] === object) state.u[slot] = null;
    object.worn = false;
    object.wornSlot = null;
    object.owornmask = (object.owornmask ?? 0) & ~ARMOR_MASKS[slot];
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
export function objectIsHardHelmet(object: Pick<GameObject, 'otyp'> | null | undefined) {
    if (!object || armorSlotFor(object.otyp) !== 'uarmh') return false;
    const material = objectMaterial(object.otyp);
    return material >= IRON && material <= MITHRIL || material === GLASS;
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

export function objectErosionKind(object: Pick<GameObject, 'otyp' | 'oclass'>): ArmorErosionDescription | null {
    const material = objectMaterial(object.otyp);
    if ((material !== undefined && material <= 8 && material !== 1) || material === 18)
        return { field: 'oeroded', action: 'smoulder' };
    if (material === 11)
        return { field: 'oeroded', action: 'rust' };
    if (material === 19 && object.oclass === 3)
        return { field: 'oeroded', action: 'crack' };
    if (material === 10)
        return { field: 'oeroded2', action: 'rot' };
    if (material === 13)
        return { field: 'oeroded2', action: 'corrode' };
    return null;
}

export async function destroyWornArmor(armor: GameObject, state: GameState = game) {
    await removeWornHeroItem(armor, state);
    if (state.program_state?.gameover || !state.inventory.includes(armor)) return false;
    await consumeInventoryItem(armor, state);
    return true;
}

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
// active as soon as setworn() installs the slot, but these extrinsics and
// their feedback are afternmv effects: they begin only when dressing reaches
// multi == 0.  Return messages so allmain can preserve nomovemsg ordering.
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
    const previousLevitation = captureLevitationState(state);
    const wasStealthy = propertyIsActive('stealth', state);
    const wasInvisible = propertyIsActive('invisible', state);
    const wasSeeingInvisible = propertyIsActive('seeInvisible', state);
    const wasFlying = !!state.u.flying;
    const wasInGas = property === 'magicalBreathing' && heroIsInDangerousRegion(state);
    await releaseWeaponSlots(object, state);
    const previous = state[slot] || state.u[slot];
    if (previous && previous !== object) cancelSlotTakeoff(slot, state);
    state[slot] = object;
    state.u[slot] = object;
    object.worn = true;
    object.wornSlot = position.label;
    object.owornmask = (object.owornmask ?? 0) | position.mask;
    if (property) grantWornProperty(property, object, slot, state);
    setWornArtifactProperties(object, slot, true, state);
    if (slot !== 'uamul') changeRingBonus(object, 1, state);
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

async function applyAmuletOnEffects(
    object: GameObject, state: GameState, { wasFlying, wasInGas }: AmuletOnState,
): Promise<void> {
    if (object.otyp === AMULET_OF_CHANGE) {
        await changeSexFromAmulet(object, state);
        return;
    }
    let message: string | undefined;
    if (OBJECT_PROPERTY[object.otyp] === 'flying') state.context.botl = true;
    if (object.otyp === AMULET_OF_UNCHANGING && heroIsSliming(state)) clearHeroSliming(state);
    else if (object.otyp === AMULET_OF_RESTFUL_SLEEP) {
        const timeout = rnd(98) + 2;
        const previous = propertyTimeout('sleepy', state);
        if (!previous || timeout < previous) setPropertyTimeout('sleepy', timeout, state);
    } else if (object.otyp === AMULET_OF_STRANGULATION) {
        if (startAmuletStrangulation(state)) message = 'It constricts your throat!';
    } else if (OBJECT_PROPERTY[object.otyp] === 'magicalBreathing' && wasInGas) {
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
    }
    await plineWithContinuation('The amulet disintegrates!');
    if (!changed && object.dknown) await tryCallObjectType(object, state);
    await consumeInventoryItem(object, state);
}

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
    const property = clearHeroAccessory(object, state);
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

async function removeAmulet(object: GameObject, state: GameState): Promise<PropertyName | null> {
    const strangled = heroIsStrangled(state);
    const flying = propertyIsActive('flying', state);
    const guarding = object.otyp === AMULET_OF_GUARDING;
    // C Amulet_off() calculates guarding AC while the amulet is still worn.
    if (guarding) findArmorClass(state);
    const property = clearHeroAccessory(object, state);
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
export function clearHeroAccessory(
    object: GameObject, state: GameState = game,
    { deferArmorClass = false }: { deferArmorClass?: boolean } = {},
): PropertyName | null {
    const position = ACCESSORY_SLOTS.find(({ slot }) =>
        state[slot] === object || state.u[slot] === object);
    if (!position) return null;
    const { slot } = position;
    cancelSlotTakeoff(slot, state);
    state[slot] = null;
    state.u[slot] = null;
    object.worn = false;
    object.wornSlot = null;
    object.owornmask = (object.owornmask ?? 0) & ~position.mask;
    const property = OBJECT_PROPERTY[object.otyp];
    if (property) {
        removeWornProperty(property, object, slot, state);
        // C worn.c setworn()/setnotworn(): an oc_oprop item leaving its slot
        // makes observing monsters forget the hero's remembered resistance.
        monstersForgetHeroResistance(seenResistanceForProperty(property), state);
    }
    setWornArtifactProperties(object, slot, false, state);
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
    if (ring.dknown && objectTypeKnown(ring, state) && OBJECT_CHARGED[ring.otyp])
        ring.known = true;
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
            clearCannedCommands(state);
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
        clearCannedCommands(state);
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
    clearCannedCommands(state);
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
