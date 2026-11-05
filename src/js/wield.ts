// wield.js — Wield, quiver, and weapon-swap commands.
// C refs: wield.c dowield(), dowieldquiver(), doquiver_core(),
// doswapweapon(), dotwoweapon(), and finish_splitting().

import { WEAPON_CLASS, TOOL_CLASS, SCROLL_CLASS, COIN_CLASS } from './objclass.js';
import { OBJ_NAME } from './object_data.js';
import {
    objectClassForType, objectSkill, LENSES, LOADSTONE, AKLYS, CRYSKNIFE, ELVEN_ARROW, ELVEN_BOW,
    ELVEN_BROADSWORD, ELVEN_DAGGER, ELVEN_SHORT_SWORD, ELVEN_SPEAR, HEAVY_IRON_BALL, IRON_CHAIN, TIN_OPENER,
    BATTLE_AXE, CORPSE, WORM_TOOTH, } from './object_data.js';
import { game, requireInitializedGame, requirePlayingGame } from './gstate.js';
import { pline, plineWithContinuation } from './pline.js';
import { commandResultCancelled, commandResultFailed, setMulti } from './cmd.js';
import type { GameObject } from './object_types.js';
import { A_DEX, ALTAR, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, Upolyd, W_ACCESSORY, W_ARMOR, W_SADDLE, P_SABER, P_SHORT_SWORD, W_QUIVER, W_SWAPWEP, W_WEP, HAND } from './const.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { heroSpecies, heroHasNoHands, heroIsVerySmall, body_part } from './polyself.js';

import { makePlural, minimalObjectName, objectNameIsPlural, observeObjectForNaming, objectHasPersonalName, objectName, ownedObjectAction, corpseName, killerObjectName, objectCombatName, verbForSubject, ownedObjectName, withIndefiniteArticle } from './objnam.js';
import { clearSplitObjects, rejoinObjectStack, splitObjectStack, uncurseObjectState, objectWeight } from './mkobj.js';
import { learnObjectType } from './o_init.js';
import { inventoryItemDescription, addInventoryItem, freeInventoryObject, getobj, useUpInventoryStack } from './invent.js';
import { isBimanualObject, is_elven_weapon, isWeaponTool, isWetTowel, is_launcher, isLauncherAmmunition, isMissileObject, isPolearm, pair_of } from './object_properties.js';
import type { WeaponCandidate } from './object_properties.js';
import { resetBulkTakeoff } from './do_wear.js';
import { readySuggestion } from './quiver.js';
import { artifactById, artifactByName, speakArtifact, artifactEmitsLight, restrictName } from './artifact.js';
import { objectOwnershipPrefix, insideShopRoomAt, shopResident, chargeAlteredUnpaidObject, updateUnpaidObjectPrice } from './shk.js';
import { promptYesNoQuit } from './query.js';
import { rn2, rnd } from './rng.js';
import type { GameState } from './game_state.js';
import { retouchHeroObject } from './artifact.js';
import { lightWieldedArtifact, equipmentLightMessage } from './light.js';
import { endObjectBurn } from './timeout.js';
import { shopkeeperName } from './shknam.js';
import { statusConditionEnabled } from './botl.js';
import { resolveImmediatePetrification } from './trap.js';
import { setnotworn, setworn } from './worn.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { strangeFeeling } from './potion.js';
import { displayColorName } from './do_name.js';
import { dropInventoryObjectAtHero, dropObjectAtHero } from './do.js';
import { shipObject } from './dokick.js';
import { landObjectOnAltar } from './altar_object.js';
import { encumber_msg } from './pickup.js';
import { monsterIsHumanoid, could_twoweap, heroResistsStoning, touchPetrifies } from './mondata.js';

export async function dotwoweapon() {
    const spentTime = await toggleTwoWeaponCombat();
    if (!game.program_state.gameover) game.context.move = spentTime ? 1 : 0;
}

// C ref: wield.c:doswapweapon()/ready_weapon().  Clearing the old secondary
// slot through setworn() also ends two-weapon mode before either new
// inventory description is projected.
export async function doswapweapon() {
    setMulti(0);
    if (heroHasNoHands(game) || heroIsVerySmall(game)) {
        await pline("Don't be ridiculous!");
        commandResultFailed(); // wield.c:doswapweapon() ECMD_FAIL.
        return;
    }
    if (await refuseWeldedPrimary()) {
        commandResultFailed(); // wield.c:doswapweapon() ECMD_FAIL.
        return;
    }
    const oldPrimary = game.uwep || game.u?.uwep || null;
    const oldSecondary = game.uswapwep || game.u?.uswapwep || null;
    await setSecondaryWeapon(null, game);
    const result = await readyHeroWeapon(oldSecondary);
    // C compares the uwep pointer, so read the slot the same way on both
    // sides: an all-along-empty hand is an unchanged hand even though the
    // optional fields stay undefined rather than null.
    if ((game.uwep || game.u?.uwep || null) === oldPrimary) {
        await setSecondaryWeapon(oldSecondary, game);
    } else if (oldPrimary) {
        await setSecondaryWeapon(oldPrimary, game);
        observeObjectForNaming(oldPrimary);
        await plineWithContinuation(
            `${oldPrimary.invlet} - ${
                await inventoryItemDescription(oldPrimary)}.`,
        );
    } else {
        await plineWithContinuation('You have no secondary weapon readied.');
    }
    if (result === 'failed') commandResultFailed(); // ready_weapon() ECMD_FAIL.
    else game.context.move = result === 'time' ? 1 : 0;
}

// C wield.c:dowield().
// Also C wield.c:wield_ok(): inlined here as the getobj callback.
// C refs: wield.c:ready_weapon(), invent.c:getobj().  The prompt
// advertises weapons and weapon-tools but still permits the full inventory
// through ?/*; '-' represents the synthetic empty-hands object.
export async function dowield(): Promise<void> {
    setMulti(0);
    if (heroHasNoHands(game) || heroIsVerySmall(game)) {
        await pline("Don't be ridiculous!");
        commandResultFailed(); // wield.c:dowield() cantwield ECMD_FAIL.
        return;
    }
    clearSplitObjects();
    // C wield.c:wield_ok(): hands are a likely candidate; coins are excluded.
    const selection = await getobj('wield', object => object.oclass === COIN_CLASS ? GETOBJ_EXCLUDE
        : object.oclass === WEAPON_CLASS || isWeaponTool(object) ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY, {
        forcePrompt: true, allowCount: true, hands: GETOBJ_SUGGEST,
        handsText: `your ${game.uarmg ? 'gloved' : 'bare'} ${
            makePlural(body_part(HAND, game))}${game.uwep ? '' : ' (wielded)'}`,
    });
    if (selection.cancelled) {
        commandResultCancelled(); // wield.c:dowield() getobj ECMD_CANCEL.
        return;
    }

    let object = selection.object;
    if (!selection.none && !object) {
        commandResultCancelled(); // wield.c:dowield() ECMD_CANCEL.
        return;
    }
    let splitParent: GameObject | null = null;
    if (object && selection.count !== null && selection.count < object.quan) {
        if (object.otyp === LOADSTONE && object.cursed) object.corpsenm = selection.count;
        else if (isWeldedPrimary(object)) object.bknown = true;
        else {
            splitParent = object;
            object = splitCarriedStack(object, selection.count);
        }
    }
    if (object && object === game.uwep) {
        await reportAlreadyWielded(object);
        return;
    }
    if (await refuseWeldedPrimary()) {
        resetBulkTakeoff();
        if (splitParent && object) await rejoinObjectStack(splitParent, object);
        commandResultFailed(); // wield.c:dowield() welded ECMD_FAIL.
        return;
    }
    if (splitParent && object) {
        if (splitParent === game.uwep) {
            await rejoinObjectStack(splitParent, object);
            await reportAlreadyWielded(splitParent);
        } else {
            await finishSplittingCarriedStack(object);
            await wieldSelectedWeapon(object);
        }
        return;
    }
    if (selection.none) {
        await wieldSelectedWeapon(null);
        return;
    }
    if (!object) return;

    // C dowield() hands an alternate-weapon selection to doswapweapon()
    // rather than treating it as an unrelated primary.  That continuation
    // prints the new primary before committing the old primary as secondary;
    // tty can page between those two prinv() calls, before monster time.
    if (object === (game.uswapwep || game.u?.uswapwep)) {
        await doswapweapon();
        return;
    }
    if (object === game.uquiver) {
        const quantity = object.quan;
        let confirmation: string;
        if (quantity > 1 && hasFreeBasicInventoryLetter() && splittableForQuiver(object)) {
            const names = makePlural(minimalObjectName(object, game));
            const answer = await promptYesNoQuit(`You have ${quantity} ${names} readied.  Wield one?`);
            if (answer === 'q') {
                game.context.move = 0;
                return;
            }
            if (answer === 'y') {
                await wieldSelectedWeapon(await splitStackForQuiver(object, 1));
                return;
            }
            confirmation = 'Wield all of them instead?';
        } else {
            const plural = objectNameIsPlural(object, game)
                || pair_of(object);
            confirmation = `You have ${plural ? 'those' : 'that'} readied.  Wield ${plural ? 'them' : 'it'} instead?`;
        }
        if (await promptYesNoQuit(confirmation) !== 'y') {
            const names = minimalObjectName(object, game);
            const plural = objectNameIsPlural(object, game);
            await plineWithContinuation(`${objectOwnershipPrefix(object, game)}${quantity > 1 ? makePlural(names) : names} ${plural ? 'remain' : 'remains'} readied.`);
            game.context.move = 0;
            return;
        }
        await setQuiverObject(null);
    } else if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY | W_SADDLE)) {
        await pline('You cannot wield that!');
        commandResultFailed(); // wield.c:dowield() "cannot wield that" ECMD_FAIL.
        return;
    }
    await wieldSelectedWeapon(object);
}

async function reportAlreadyWielded(object: GameObject): Promise<void> {
    await pline('You are already wielding that!');
    if (isWeaponTool(object) || isWetTowel(object)) game._unweapon = false;
    commandResultFailed(); // wield.c:dowield() already-wielded ECMD_FAIL.
}

async function wieldSelectedWeapon(object: GameObject | null): Promise<void> {
    const oldPrimary = game.uwep || game.u.uwep || null;
    const result = await readyHeroWeapon(object);
    // C dowield() applies pushweapon only after ready_weapon() has installed
    // the new primary.  The displaced primary becomes the authoritative
    // secondary object; preserving that identity is what makes a later
    // selection of it enter doswapweapon() and its two-prinv continuation.
    if (game.flags?.pushweapon && oldPrimary && game.uwep !== oldPrimary) {
        await setSecondaryWeapon(oldPrimary, game);
    }
    await stopTwoWeaponCombat();
    if (result === 'failed') commandResultFailed(); // ready_weapon() ECMD_FAIL.
    else game.context.move = result === 'time' ? 1 : 0;
}

// C refs: dowieldquiver(), doquiver_core().  Q and empty-quiver fire share
// one live inventory transaction; neither role nor recorded input selects a
// different readiness implementation.
export async function doready(): Promise<void> {
    await doquiverCore('ready');
}

function splitCarriedStack(item: GameObject, count: number): GameObject {
    const split = splitObjectStack(item, count, game);
    if (!split) throw new Error('cannot split selected inventory stack');
    return split;
}

async function splitStackForQuiver(item: GameObject, count: number): Promise<GameObject> {
    const child = splitCarriedStack(item, count);
    await finishSplittingCarriedStack(child);
    return child;
}

// C finish_splitting(): take the child out and add it without merging so
// its inherited inventory letter is replaced and carried effects refresh.
async function finishSplittingCarriedStack(object: GameObject): Promise<void> {
    await freeInventoryObject(object);
    const nomerge = !!object.nomerge;
    object.nomerge = true;
    await addInventoryItem(object, null, false);
    object.nomerge = nomerge;
}

function splittableForQuiver(item: GameObject): boolean {
    return !(item?.otyp === LOADSTONE && item.cursed)
        && !isWeldedPrimary(item);
}

function hasFreeBasicInventoryLetter(): boolean {
    return game.inventory.filter(item => item.oclass !== COIN_CLASS).length < 52;
}

export interface QuiverCommandResult {
    item: GameObject | null;
    spentTime: boolean;
    cancelled: boolean;
}

export async function doquiverCore(verb: 'ready' | 'fire'): Promise<QuiverCommandResult> {
    setMulti(0);
    if (!(game.inventory || []).length) {
        await pline('You have nothing to ready for firing.');
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: false };
    }
    clearSplitObjects();
    // C wield.c:ready_ok(): '-' empties the quiver and is suggested only
    // while something is readied.
    const selection = await getobj(verb, item => readySuggestion(item, game) ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY, {
        forcePrompt: true, allowCount: true, hands: game.uquiver ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY,
        handsText: verb === 'ready' ? `empty quiver${game.uquiver ? '' : ' (nothing readied)'}`
            : `your ${makePlural(body_part(HAND, game))}`,
    });
    if (selection.cancelled) {
        commandResultCancelled(); // doquiver_core() getobj ECMD_CANCEL.
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: true };
    }
    if (selection.none) {
        if (game.uquiver) {
            await pline('You now have no ammunition readied.');
            await setQuiverObject(null, game);
        } else {
            await pline('You already have no ammunition readied!');
        }
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: false };
    }
    let item = selection.object;
    if (!item) {
        commandResultCancelled(); // doquiver_core() getobj ECMD_CANCEL.
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: true };
    }

    const knewWeld = !!item.bknown;
    if (isWeldedPrimary(item)) {
        // getobj() tests splittable() first for a partial count. That test
        // reveals the weld before doquiver_core() checks whether it is new.
        const countedPart = selection.count !== null && selection.count < item.quan;
        const spentTime = !knewWeld && !countedPart;
        await refuseWeldedPrimary();
        resetBulkTakeoff();
        game.context.move = spentTime ? 1 : 0;
        return {
            item: null, spentTime, cancelled: false,
        };
    }

    const requestedCount = selection.count;
    const initialQuantity = item.quantity ?? item.quan ?? 1;
    const partialCount = requestedCount !== null
        && requestedCount < initialQuantity;
    if (partialCount && item.otyp === LOADSTONE && item.cursed)
        item.corpsenm = requestedCount;
    if (item === game.uquiver) {
        // C getobj() splits before doquiver_core() notices the readied parent.
        if (partialCount && splittableForQuiver(item)) {
            const split = splitCarriedStack(item, requestedCount);
            await rejoinObjectStack(item, split, game);
        }
        await pline('That ammunition is already readied!');
        game.context.move = 0;
        return { item, spentTime: false, cancelled: false };
    }
    const selectedClass = item.oclass || objectClassForType(item.otyp);
    if (partialCount && selectedClass === 12) {
        // C getobj()/unsplitobj(): partial purses are not valid ammunition.
        const split = splitCarriedStack(item, requestedCount);
        await rejoinObjectStack(item, split, game);
        await pline("You can't ready only part of your gold.");
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: false };
    }
    if (requestedCount !== null && requestedCount < initialQuantity
        && splittableForQuiver(item)) {
        item = await splitStackForQuiver(item, requestedCount);
    }

    const incompatibleMask = W_ARMOR | W_ACCESSORY | W_SADDLE;
    if (((item.owornmask ?? 0) & incompatibleMask)
        || (item.worn && item !== game.uwep && item !== game.uswapwep)) {
        await pline(`You cannot ${verb} that!`);
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: false };
    }

    const primary = item === game.uwep;
    const alternate = item === game.uswapwep;
    const wasTwoweap = !!game.u?.twoweap;
    let spentTime = false;
    if (primary || alternate) {
        const quantity = item.quantity ?? item.quan ?? 1;
        const noun = minimalObjectName(item, game);
        const names = quantity === 1 ? noun : makePlural(noun);
        const usePlural = objectNameIsPlural(item, game)
            || pair_of(item);
        let confirmation = primary
            ? `You are wielding ${usePlural ? 'those' : 'that'}.  Ready ${usePlural ? 'them' : 'it'} instead?`
            : `${usePlural ? 'Those are' : 'That is'} your ${wasTwoweap ? 'second' : 'alternate'} weapon.  Ready ${usePlural ? 'them' : 'it'} instead?`;
        let readyAll = true;
        if (quantity > 1 && hasFreeBasicInventoryLetter()
            && splittableForQuiver(item)) {
            const slotDescription = primary
                ? `You are wielding ${quantity} ${names}.`
                : `${wasTwoweap ? 'You are dual wielding'
                    : 'Your alternate weapon is'} ${quantity} ${names}.`;
            const partial = await promptYesNoQuit(
                `${slotDescription}  Ready ${quantity - 1} of them?`,
            );
            if (partial === 'q') {
                game.context.move = 0;
                return { item: null, spentTime: false, cancelled: false };
            }
            if (partial === 'y') {
                item = await splitStackForQuiver(item, quantity - 1);
                readyAll = false;
            } else confirmation = 'Ready all of them instead?';
        }
        if (readyAll) {
            const answer = await promptYesNoQuit(confirmation);
            if (answer !== 'y') {
                const owner = objectOwnershipPrefix(item, game);
                const remains = objectNameIsPlural(item, game) ? 'remain' : 'remains';
                const slot = primary || wasTwoweap ? 'wielded' : 'as secondary weapon';
                await plineWithContinuation(`${owner}${names} ${remains} ${slot}.`);
                game.context.move = 0;
                return { item: null, spentTime: false, cancelled: false };
            }
            if (primary) {
                await setPrimaryWeapon(null, game);
                spentTime = true;
            } else {
                await setSecondaryWeapon(null, game);
                spentTime = wasTwoweap;
            }
        }
    }
    if (verb !== 'fire') await setQuiverObject(item, game);
    observeObjectForNaming(item);
    const description = await inventoryItemDescription(item);
    await plineWithContinuation(verb === 'fire'
        ? `You ready: ${item.invlet} - ${description}.`
        : `${item.invlet} - ${description}.`);
    if (verb === 'fire') await setQuiverObject(item, game);
    if (spentTime) {
        if (primary) {
            const humanoid = monsterIsHumanoid(heroSpecies(game));
            const hands = game.uarmg ? 'empty handed'
                : humanoid ? 'bare handed' : 'not wielding anything';
            await plineWithContinuation(`You are now ${hands}.`);
        } else await plineWithContinuation('You are no longer using two weapons at once.');
    }
    game.context.move = spentTime ? 1 : 0;
    return { item, spentTime, cancelled: false };
}

// C wield.c TWOWEAPOK; the two-handed check is separate.
export function isTwoWeaponObject(object: WeaponCandidate): boolean {
    if (object?.oclass !== WEAPON_CLASS) return isWeaponTool(object);
    return !is_launcher(object)
        && !isLauncherAmmunition(object) && !isMissileObject(object);
}
// C setuwep(): an improvised weapon announces its first use in melee.
export function weaponNeedsBashingMessage(object: WeaponCandidate, state: GameState): boolean {
    if (!object) return true;
    if (object.oclass !== WEAPON_CLASS)
        return !isWeaponTool(object) && !isWetTowel(object);
    const launcher = is_launcher(object);
    const groundedPolearm = isPolearm(object) && !state.u.usteed
        && artifactById(object.oartifact)?.name !== 'Snickersnee';
    return launcher || isLauncherAmmunition(object) || isMissileObject(object)
        || groundedPolearm;
}

export function willWeld(object: WeaponCandidate): boolean {
    if (!object?.cursed) return false;
    const weaponTool = isWeaponTool(object);
    return object.oclass === WEAPON_CLASS || weaponTool
        || [HEAVY_IRON_BALL, IRON_CHAIN, TIN_OPENER].includes(object.otyp);
}

// Readiness messages around a semantic primary-weapon change.
// C refs: wield.c ready_weapon(), before and after setuwep().

export async function refuseWeldedPrimary(state: GameState = game): Promise<boolean> {
    const weapon = state.uwep || state.u.uwep;
    if (!weapon || !willWeld(weapon)) return false;
    weapon.bknown = true;
    const hand = body_part(HAND, state);
    const hands = isBimanualObject(weapon) ? makePlural(hand) : hand;
    await plineWithContinuation(`${ownedObjectAction(weapon, 'are', state)} welded to your ${hands}!`);
    return true;
}

export async function announceWeaponWeld(object: GameObject, state: GameState = game): Promise<void> {
    const noun = objectName(object, state);
    const quantity = object.quan ?? object.quantity ?? 1;
    const proper = objectHasPersonalName(object, state);
    const article = proper && !noun.includes(' of ') ? '' : 'The ';
    const subject = quantity === 1 ? noun : `${quantity} ${makePlural(noun)}`;
    const side = state.u.rightHanded === false ? 'left' : 'right';
    const hand = body_part(HAND, state);
    const hands = isBimanualObject(object)
        ? makePlural(hand) : `dominant ${side} ${hand}`;
    await plineWithContinuation(`${article}${subject} ${
        quantity === 1 ? 'welds itself' : 'weld themselves'} to your ${hands}!`);
    object.bknown = true;
}

export async function explainTwoWeaponEnd(
    wasTwoWeapon: boolean | undefined, state: GameState = game,
): Promise<void> {
    const weapon = state.uwep || state.u?.uwep;
    if (!wasTwoWeapon || state.u.twoweap || !weapon
        || state.flags?.verbose === false) return;
    const suitable = isTwoWeaponObject(weapon) && !isBimanualObject(weapon);
    await plineWithContinuation(suitable
        ? 'You are no longer using two weapons at once.'
        : 'You can no longer wield two weapons at once.');
}

// C wield.c:ready_weapon() and cant_wield_corpse(): the wield messages and
// the bare-handed petrifying-corpse refusal live in readySelectedWeapon.
// C wield.c:empty_handed().
export function emptyHandedDescription(state: GameState = game): string {
    if (state.uarmg || state.u.uarmg) return 'empty handed';
    const humanoid = monsterIsHumanoid(heroSpecies(state));
    return humanoid ? 'bare handed' : 'not wielding anything';
}

// A refusal must abort queued fire assistance; an untimed success keeps it.
export type WeaponReadinessResult = 'time' | 'ok' | 'failed';

// The caller has already checked whether the old weapon is welded. A failed
// touch spends a turn; a shield refusal does not. Neither installs the item.
export async function readyHeroWeapon(
    weapon: GameObject | null, state: GameState = game,
): Promise<WeaponReadinessResult> {
    const hadWeapon = !!(state.uwep || state.u.uwep);
    const result = await readySelectedWeapon(weapon, state);
    if (hadWeapon !== !!(state.uwep || state.u.uwep)
        && statusConditionEnabled('barehanded', state)) state.context.botl = true;
    return result;
}

// C wield.c:cant_wield_corpse(): a bare-handed petrifying-corpse wield
// announces itself and petrifies instead of installing the weapon.
async function readySelectedWeapon(weapon: GameObject | null, state: GameState): Promise<WeaponReadinessResult> {
    requirePlayingGame(state);
    const previous = state.uwep || state.u.uwep;
    const wasTwoWeapon = state.u.twoweap;
    if (!weapon) {
        await plineWithContinuation(`You are ${previous ? '' : 'already '}${emptyHandedDescription(state)}.`);
        if (previous) await setPrimaryWeapon(null, state);
        return previous ? 'time' : 'ok';
    }
    if (weapon.otyp === CORPSE && touchPetrifies(weapon.corpsenm)
        && !(state.uarmg || state.u.uarmg) && !heroResistsStoning(state)) {
        await plineWithContinuation(`You wield ${corpseName(weapon, { definite: true })} in your bare ${makePlural(body_part(HAND, state))}.`);
        await resolveImmediatePetrification({
            state, killer: `wielding ${killerObjectName(weapon, state)} bare-handed`,
        });
        return 'time';
    }
    if ((state.uarms || state.u.uarms) && isBimanualObject(weapon)) {
        const skill = objectSkill(weapon.otyp);
        const kind = weapon.oclass === WEAPON_CLASS && skill >= P_SHORT_SWORD && skill <= P_SABER
            ? 'sword' : weapon.otyp === BATTLE_AXE ? 'axe' : 'weapon';
        await plineWithContinuation(`You cannot wield a two-handed ${kind} while wearing a shield.`);
        return 'failed';
    }
    const touch = await retouchHeroObject(weapon, { state });
    if (touch.rejected || touch.died) return 'time';

    observeObjectForNaming(weapon, { state });
    if (willWeld(weapon)) {
        await announceWeaponWeld(weapon, state);
    } else {
        if (weapon.otyp === AKLYS) await plineWithContinuation('You secure the tether.');
        await plineWithContinuation(`${weapon.invlet} - ${await inventoryItemDescription(weapon, { projectPrimaryHand: true })}.`);
    }
    await setPrimaryWeapon(weapon, state);
    await explainTwoWeaponEnd(wasTwoWeapon, state);
    if (weapon.oartifact) await speakArtifact(weapon, { state });
    await lightWieldedArtifact(weapon, state);
    if (weapon.unpaid) {
        const shop = insideShopRoomAt(state, state.u.ux, state.u.uy);
        const keeper = shopResident(shop?.roomno, state);
        if (keeper) {
            const name = objectCombatName(weapon, { state, includeCorpseSpecies: false });
            await plineWithContinuation(`${shopkeeperName(keeper, { state })} says "You be careful with my ${name}!"`);
        }
    }
    return 'time';
}

// Hero weapon and quiver slot changes.
// C refs: wield.c setuwep(), setuswapwep(), setuqwep(), uwepgone().

export type WeaponSlot = 'uwep' | 'uswapwep' | 'uquiver';

export function isWeldedPrimary(
    object: GameObject | null | undefined, state: GameState = game,
): boolean {
    if (!object || object !== (state.uwep || state.u?.uwep) || !willWeld(object)) return false;
    // C welded() discovers the curse even when the caller can still act.
    object.bknown = true;
    return true;
}

// C wield.c:set_twoweap().
export function setTwoWeaponCombat(enabled: boolean, state: GameState = game): void {
    if (state.u.twoweap === enabled) return;
    state.u.twoweap = enabled;
    if (state.flags.weaponstatus) state.context.botl = true;
}

function slotObject(slot: WeaponSlot, state: GameState): GameObject | null {
    return state[slot] || state.u?.[slot] || null;
}

// C wield.c:setuwep().  setworn() carries the slot work: two-weapon
// cancellation, cancel_doff(), the owornmask/extrinsic bookkeeping and the
// artifact intrinsics.  The Ogresmasher botl, the Sunsword light and the
// "begin bashing" notice belong here.
export async function setPrimaryWeapon(
    object: GameObject | null, state: GameState = game,
): Promise<GameObject | null> {
    const previous = slotObject('uwep', state);
    if (previous === object) return previous; /* necessary to not set gu.unweapon */
    await setworn(object, W_WEP, state);
    // handle Ogresmasher before Sunsword; even though they can't be
    // happening at the same time, botl flag update should come before the
    // pline message (gaining or losing the Con bonus).
    if (artifactById(previous?.oartifact, state)?.name === 'Ogresmasher'
        || artifactById(object?.oartifact, state)?.name === 'Ogresmasher')
        state.context.botl = true;
    // This message is printed *whenever* Sunsword is unwielded, whatever the
    // cause, so it lives here rather than with the wielding commands.
    if (previous?.lamplit && artifactEmitsLight(previous)) {
        endObjectBurn(previous, state);
        if (!heroIsBlind(state))
            await plineWithContinuation(equipmentLightMessage(previous, false, state));
    }
    // Note: Explicitly wielding a pick-axe will not give a "bashing"
    // message.  Wielding one via 'a'pplying it will.
    state._unweapon = weaponNeedsBashingMessage(object, state);
    return previous;
}

// C wield.c:setuswapwep(): setworn(obj, W_SWAPWEP), nothing else.
export async function setSecondaryWeapon(
    object: GameObject | null, state: GameState = game,
): Promise<GameObject | null> {
    const previous = slotObject('uswapwep', state);
    await setworn(object, W_SWAPWEP, state);
    return previous;
}

// C wield.c:setuqwep(): setworn(obj, W_QUIVER); no extra handling needed,
// update_inventory() is already performed by setworn().
export async function setQuiverObject(
    object: GameObject | null, state: GameState = game,
): Promise<GameObject | null> {
    const previous = slotObject('uquiver', state);
    await setworn(object, W_QUIVER, state);
    return previous;
}

// C wield.c:uwepgone().  The light-source message precedes setworn()'s
// removal of the warning source, and the bare-hand notice is armed.
export async function uwepgone(state: GameState = game): Promise<void> {
    const object = slotObject('uwep', state);
    if (!object) return;
    if (object.lamplit && artifactEmitsLight(object)) {
        endObjectBurn(object, state);
        if (!heroIsBlind(state))
            await plineWithContinuation(equipmentLightMessage(object, false, state));
    }
    await setworn(null, W_WEP, state);
    state._unweapon = true; /* for "bare hands" message */
}

// C wield.c:uswapwepgone().  setworn(0, W_SWAPWEP) plus the redraw.
export async function uswapwepgone(state: GameState = game): Promise<void> {
    if (!slotObject('uswapwep', state)) return;
    await setworn(null, W_SWAPWEP, state);
}

// C wield.c:uqwepgone().  setworn(0, W_QUIVER) plus the redraw.
export async function uqwepgone(state: GameState = game): Promise<void> {
    if (!slotObject('uquiver', state)) return;
    await setworn(null, W_QUIVER, state);
}
// ── Two-weapon combat (folded from two_weapon.js) ──
// C refs: wield.c can_twoweapon(), dotwoweapon(), drop_uswapwep(),
// untwoweapon().

// Two-weapon anatomy follows the current body, independent of equipment.
export function heroCanUseTwoWeapons(state: GameState = game): boolean {
    return could_twoweap(heroSpecies(state));
}

function weaponName(object: GameObject, state: GameState): string {
    // C Yname2() omits ownership for personal, non-quest artifact names.
    if (object.where === 'inventory' && objectHasPersonalName(object, state)
        && object.oartifact !== undefined) {
        const firstQuestArtifact = artifactByName('The Orb of Detection', state);
        if (!firstQuestArtifact) throw new Error('The Orb of Detection is missing from the artifact table.');
        if (object.oartifact < firstQuestArtifact.id) return objectName(object, state);
    }
    return ownedObjectName(object, state);
}

export async function toggleTwoWeaponCombat(state: GameState = game): Promise<boolean> {
    if (state.u.twoweap) {
        await plineWithContinuation('You switch to your primary weapon.');
        setTwoWeaponCombat(false, state);
        return false;
    }
    if (!await canBeginTwoWeaponCombat(state)) return false;
    await plineWithContinuation('You begin two-weapon combat.');
    setTwoWeaponCombat(true, state);
    return rnd(20) > currentAttribute(A_DEX, state);
}

// C wield.c:can_twoweapon().
export async function canBeginTwoWeaponCombat(state: GameState): Promise<boolean> {
    const primary = state.uwep || state.u.uwep;
    const secondary = state.uswapwep || state.u.uswapwep;
    if (!heroCanUseTwoWeapons(state)) {
        if (Upolyd(state.u)) {
            await plineWithContinuation("You can't use two weapons in your current form.");
        } else {
            if (!state.urole) throw new Error('Two-weapon combat requires the hero role.');
            const role = state.flags?.female && state.urole.name.f
                ? state.urole.name.f : state.urole.name.m;
            await plineWithContinuation(`${makePlural(role)} aren't able to use two weapons at once.`);
        }
        return false;
    }
    if (!primary || !secondary) {
        const hand = body_part(HAND, state);
        const hands = !primary && !secondary ? makePlural(hand) : hand;
        const side = primary ? 'left ' : secondary ? 'right ' : '';
        await plineWithContinuation(`Your ${side}${hands} ${verbForSubject(hands, 'are')} empty.`);
        return false;
    }
    if (!isTwoWeaponObject(primary) || !isTwoWeaponObject(secondary)) {
        const object = !isTwoWeaponObject(primary) ? primary : secondary;
        const slot = object === primary ? 'primary' : 'secondary';
        const plural = objectNameIsPlural(object, state);
        await plineWithContinuation(`${weaponName(object, state)} ${
            plural ? "aren't" : "isn't a"} suitable ${slot} weapon${object.quan === 1 ? '' : 's'}.`);
        return false;
    }
    if (isBimanualObject(primary) || isBimanualObject(secondary)) {
        const object = isBimanualObject(primary) ? primary : secondary;
        await plineWithContinuation(`${weaponName(object, state)} isn't one-handed.`);
        return false;
    }
    if (state.uarms || state.u.uarms) {
        await plineWithContinuation("You can't use two weapons while wearing a shield.");
        return false;
    }
    if (secondary.oartifact) {
        await plineWithContinuation(`${ownedObjectAction(secondary, 'resist', state)} being held second to another weapon!`);
        return false;
    }
    // Corpses fail TWOWEAPOK above, before the Native stoning branch.
    const slippery = (state.u.glibTurns ?? 0) > 0 || !!state.u.glib;
    if (slippery || secondary.cursed) {
        if (!slippery) secondary.bknown = true;
        await dropSecondaryWeapon(state);
        return false;
    }
    return true;
}

// C curse(): this equipment reaction does not reveal BUC knowledge.
export async function dropCursedSecondaryWeapon(
    object: GameObject, state: GameState = game,
): Promise<void> {
    if (state.u.twoweap && object.cursed
        && object === (state.uswapwep || state.u.uswapwep))
        await dropSecondaryWeapon(state);
}

export async function dropSecondaryWeapon(state: GameState = game): Promise<void> {
    const object = state.uswapwep || state.u.uswapwep;
    if (!object) throw new Error('Dropping the secondary weapon requires an equipped object.');
    const hand = `left ${body_part(HAND, state)}`;
    if (!object.cursed) {
        await plineWithContinuation(`${ownedObjectAction(object, 'slip', state)} from your ${hand}!`);
    } else if (!state.u.twoweap) {
        const drop = objectNameIsPlural(object, state) ? 'drop' : 'drops';
        await plineWithContinuation(`${ownedObjectAction(object, 'evade', state)} your grasp and ${drop} from your ${hand}!`);
    } else {
        const name = ownedObjectAction(object, null, state, { capitalized: false });
        await plineWithContinuation(`Your ${hand} spasms and drops ${name}!`);
    }
    await dropInventoryObjectAtHero(object, { state });
}

// C wield.c:untwoweapon().
export async function stopTwoWeaponCombat(state: GameState = game): Promise<void> {
    if (!state.u.twoweap) return;
    await plineWithContinuation('You can no longer wield two weapons at once.');
    setTwoWeaponCombat(false, state);
}

// C wield.c:drop_uswapwep() and do.c:dropx(): announce before extraction,
// then handle shipping and altar contact before placing the dropped weapon.
export async function dropCursedAlternateWeapon(object: GameObject, state: GameState): Promise<void> {
    await plineWithContinuation(`Your left ${body_part(HAND, state)} spasms and drops ${
        ownedObjectName(object, state, { capitalized: false, includeQuantity: true })}!`);
    await freeInventoryObject(object, state);
    if (!state.u.uswallow) {
        const initialized = requireInitializedGame(state);
        if (await shipObject(object, state.u.ux, state.u.uy, {
            state: initialized, publish: plineWithContinuation,
        })) return;
        if (state.level?.at(state.u.ux, state.u.uy)?.typ === ALTAR)
            await landObjectOnAltar(object, { state });
    }
    await dropObjectAtHero(object, { state });
}

// ── Weapon enchantment (folded from enchant_weapon.js) ──

// C wield.c:chwepon(). Returns true when the wielded weapon was processed,
// false after the bare-hands strange_feeling() path consumed the scroll.
export async function chwepon(scroll: GameObject, amount: number, state: GameState): Promise<boolean> {
    const color = displayColorName(amount < 0 ? 'black' : 'blue', state);
    const uwep = state.uwep || state.u?.uwep || null;
    const scrollType = scroll?.oclass === SCROLL_CLASS ? scroll.otyp : null;

    if (!uwep || (uwep.oclass !== WEAPON_CLASS && !isWeaponTool(uwep))) {
        await strangeFeelingOn(scroll, amount, state);
        return false;
    }

    if (uwep.otyp === WORM_TOOTH && amount >= 0) {
        await sharpenWormTeeth(uwep, scrollType, state);
        return true;
    } else if (uwep.otyp === CRYSKNIFE && amount < 0) {
        await dullCrysknife(uwep, scroll?.bknown, scrollType, state);
        return true;
    }

    const weaponName = uwep.oextra?.oname || uwep.oname || '';
    if (amount < 0 && uwep.oartifact
        && restrictName(uwep, weaponName, state)) {
        if (!heroIsBlind(state)) {
            await pline(`${ownedObjectAction(uwep, 'faintly glow', state)} ${color}.`);
        }
        return true;
    }
    /* there is a (soft) upper and lower limit to uwep->spe */
    const enchantment = objectEnchantment(uwep);
    if (((enchantment > 5 && amount >= 0)
        || (enchantment < -5 && amount < 0)) && rn2(3)) {
        if (!heroIsBlind(state)) {
            await pline(`${ownedObjectAction(uwep, 'violently glow', state)} ${color} `
                + `for a while and then ${
                    objectQuantity(uwep) > 1 ? 'evaporate' : 'evaporates'}.`);
        } else {
            await pline(`${ownedObjectAction(uwep, 'evaporate', state)}.`);
        }
        await useUpInventoryStack(uwep, state);
        return true;
    }
    if (!heroIsBlind(state)) {
        const duration = amount * amount === 1 ? 'moment' : 'while';
        await pline(`${ownedObjectAction(
            uwep, amount === 0 ? 'violently glow' : 'glow', state,
        )} ${color} for a ${duration}.`);
        if (scrollType !== null && uwep.known
            && (amount > 0 || (amount < 0 && scroll.bknown))) {
            learnObjectType(scrollType, state);
        }
    }
    if (amount < 0) {
        await chargeAlteredUnpaidObject(uwep, 'disenchant', state);
    }
    setWeaponEnchantment(uwep, objectEnchantment(uwep) + amount);
    if (amount > 0) {
        if (uwep.cursed) uncurseObjectState(uwep);
        /* update shop bill to reflect the new higher price */
        if (uwep.unpaid) updateUnpaidObjectPrice(uwep, state);
    }

    /* Enchantment has an adverse, spe dependent reaction on Magicbane;
       give an obscure clue here. */
    if (heroWieldsMagicbane(state) && objectEnchantment(uwep) >= 0) {
        const sting = amount > 1 && objectEnchantment(uwep) > 1
            ? 'flin' : 'it';
        await pline(`Your right ${body_part(HAND, state)} ${sting}ches!`);
    }

    /* Elven weapons vibrate warningly when enchanted beyond a limit. */
    if (objectEnchantment(uwep) > 5
        && (is_elven_weapon(uwep) || uwep.oartifact || rn2(7) === 0)) {
        await pline(`${ownedObjectAction(
            uwep, 'suddenly vibrate', state,
        )} unexpectedly.`);
    }
    return true;
}

// C chwepon() worm tooth branch: fusion into one uncursed crysknife.
async function sharpenWormTeeth(uwep: GameObject, scrollType: number | null, state: GameState) {
    const multiple = objectQuantity(uwep) > 1;
    /* order: message, transformation, shop handling */
    await pline(`Your ${simpleonames(uwep)} `
        + `${multiple ? 'fuse, and become' : 'is'} much sharper now.`);
    uwep.otyp = CRYSKNIFE;
    uwep.oerodeproof = false;
    renameTransformedWeapon(uwep, 'crysknife');
    if (multiple) {
        uwep.quan = 1;
        uwep.quantity = 1;
        uwep.owt = objectWeight(uwep);
    }
    if (uwep.cursed) uncurseObjectState(uwep);
    /* update shop bill to reflect the new higher value */
    if (uwep.unpaid) updateUnpaidObjectPrice(uwep, state);
    if (scrollType !== null) learnObjectType(scrollType, state);
    if (multiple) await encumber_msg(state, pline);
}

// C chwepon() crysknife branch: degradation back into one worm tooth.
async function dullCrysknife(uwep: GameObject, scrollBknown: boolean | undefined, scrollType: number | null, state: GameState) {
    const multiple = objectQuantity(uwep) > 1;
    /* order matters: message, shop handling, transformation */
    await pline(`Your ${simpleonames(uwep)} `
        + `${multiple ? 'fuse, and become' : 'is'} much duller now.`);
    await chargeAlteredUnpaidObject(uwep, 'degrade', state);
    uwep.otyp = WORM_TOOTH;
    uwep.oerodeproof = false;
    renameTransformedWeapon(uwep, 'worm tooth');
    if (multiple) {
        uwep.quan = 1;
        uwep.quantity = 1;
        uwep.owt = objectWeight(uwep);
    }
    if (scrollType !== null && scrollBknown) learnObjectType(scrollType, state);
    if (multiple) await encumber_msg(state, pline);
}

// C chwepon() bare-hands branch, including the cursed welded tin opener.
async function strangeFeelingOn(scroll: GameObject, amount: number, state: GameState) {
    const uwep = state.uwep || state.u?.uwep || null;
    let text;
    if (amount >= 0 && uwep && willWeld(uwep)) { /* cursed tin opener */
        if (!heroIsBlind(state)) {
            const aura = displayColorName('amber', state);
            text = `${ownedObjectAction(uwep, 'glow', state)} with `
                + `${withIndefiniteArticle(aura)} aura.`;
            uwep.bknown = !heroIsHallucinating(state);
        } else {
            /* the cursed tin opener is wielded in the right hand */
            text = `Your right ${body_part(HAND, state)} tingles.`;
        }
        uncurseObjectState(uwep);
    } else {
        text = `Your ${makePlural(body_part(HAND, state))} `
            + `${amount >= 0 ? 'twitch' : 'itch'}.`;
    }
    await strangeFeeling(scroll, text, { state });
    await exerciseAttribute(A_DEX, amount >= 0, state);
}

function objectQuantity(object: GameObject) {
    return object.quan ?? object.quantity ?? 1;
}

// The inventory description reads the object's stored name for weapons,
// so a type change must rewrite it, as other type-changing owners do.
function renameTransformedWeapon(uwep: GameObject, name: string) {
    if (uwep.name !== undefined) uwep.name = name;
    if (uwep.plural !== undefined) uwep.plural = makePlural(name);
}

export function objectEnchantment(object: GameObject) {
    return object.spe ?? object.enchantment ?? 0;
}

export function setWeaponEnchantment(object: GameObject, value: number) {
    object.spe = value;
    object.enchantment = value;
}

// C wield.c u_wield_art(ART_MAGICBANE).
function heroWieldsMagicbane(state: GameState) {
    return artifactById(
        (state.uwep || state.u?.uwep)?.oartifact,
    )?.name === 'Magicbane';
}

// Only the tooth/crysknife transformations use simpleonames here. C omits
// individual names and call names from that transformation message.
function simpleonames(object: GameObject): string {
    const name = OBJ_NAME(object.otyp);
    if (name === null) throw new Error(`Transformed weapon type ${object.otyp} has no name`);
    return objectQuantity(object) > 1 ? makePlural(name) : name;
}

// ── Wielding a tool for another command (folded from wield_tool.js) ──

// C wield.c:wield_tool().

export interface WieldToolOptions {
    swapWeapons?: (() => unknown) | undefined;
}

export type WieldToolResult =
    | { ready: false; newlyWielded: false }
    | { ready: true; newlyWielded: boolean };

function quantityOf(object: GameObject): number {
    return object.quan ?? object.quantity ?? 1;
}

function isWeapon(object: GameObject): boolean {
    return object.oclass === WEAPON_CLASS;
}

function isTwoHanded(object: GameObject): boolean {
    // C wield.c:wield_tool() checks bimanual(obj) at both the welded message
    // and the shield refusal.
    return isBimanualObject(object);
}

function weldedPrimary(state: GameState): GameObject | null {
    const primary = state.uwep || state.u?.uwep || null;
    return willWeld(primary) ? primary : null;
}

async function explainWeldedPrimary(
    primary: GameObject, verb: string, name: string, plural: boolean, state: GameState,
): Promise<void> {
    primary.bknown = true;
    if (state.flags?.verbose === false) {
        await pline("You can't do that.");
        return;
    }
    const noun = body_part(HAND, state);
    const hand = isTwoHanded(primary) ? makePlural(noun) : noun;
    const demonstrative = plural && !/pair of /i.test(name) ? 'those' : 'that';
    await pline(
        `Since your weapon is welded to your ${hand}, `
        + `you cannot ${verb} ${demonstrative} ${name}.`,
    );
}

export async function wieldTool(
    object: GameObject,
    verb = 'wield',
    { swapWeapons }: WieldToolOptions = {},
    state: GameState = game,
): Promise<WieldToolResult> {
    const current = state.uwep || state.u?.uwep || null;
    if (object === current)
        return { ready: true, newlyWielded: false };

    const name = objectCombatName(object, { state, includeCorpseSpecies: false });
    const plural = quantityOf(object) > 1 || /pair of |s of /i.test(name);
    if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY)) {
        await pline(
            `You can't ${verb} ${ownedObjectName(object, state, { capitalized: false })} while wearing ${
                plural ? 'them' : 'it'}.`,
        );
        return { ready: false, newlyWielded: false };
    }

    const welded = weldedPrimary(state);
    if (welded) {
        await explainWeldedPrimary(welded, verb, name, plural, state);
        return { ready: false, newlyWielded: false };
    }

    if (heroHasNoHands(state) || heroIsVerySmall(state)) {
        await pline(`You can't hold ${plural ? 'them' : 'it'} strongly enough.`);
        return { ready: false, newlyWielded: false };
    }

    if ((state.uarms || state.u?.uarms) && isTwoHanded(object)) {
        await pline(
            `You cannot ${verb} a two-handed ${
                isWeapon(object) ? 'weapon' : 'tool'} while wearing a shield.`,
        );
        return { ready: false, newlyWielded: false };
    }

    if (state.uquiver === object || state.u?.uquiver === object)
        await setQuiverObject(null, state);

    if (state.uswapwep === object || state.u?.uswapwep === object) {
        if (!swapWeapons)
            return { ready: false, newlyWielded: false };
        await swapWeapons();
        if ((state.uwep || state.u?.uwep) !== object)
            return { ready: false, newlyWielded: false };
    } else {
        if (willWeld(object)) {
            await readyHeroWeapon(object, state);
        } else {
            await plineWithContinuation(`You now wield ${await inventoryItemDescription(object)}.`);
            await setPrimaryWeapon(object, state);
        }

        if (state.flags?.pushweapon && current && state.uwep !== current)
            await setSecondaryWeapon(current, state);
    }
    const weapon = state.uwep || state.u.uwep;
    if (weapon && weapon !== object) return { ready: false, newlyWielded: false };
    await stopTwoWeaponCombat(state);
    if (!isWeapon(object)) state._unweapon = true;
    return { ready: true, newlyWielded: true };
}
