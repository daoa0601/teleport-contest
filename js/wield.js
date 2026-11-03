// wield.js — Wield, quiver, and weapon-swap commands.
// C refs: wield.c dowield(), dowieldquiver(), doquiver_core(),
// doswapweapon(), dotwoweapon(), and finish_splitting().
import { game, requirePlayingGame } from './gstate.js';
import { pline, plineWithContinuation } from './pline.js';
import { commandResultCancelled, commandResultFailed, setMulti } from './cmd.js';
import { GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, W_ACCESSORY, W_ARMOR, W_SADDLE, AKLYS_LIM, P_AXE, P_BOW, P_CROSSBOW, P_DAGGER, P_LANCE, P_PICK_AXE, P_POLEARMS, P_SABER, P_SHORT_SWORD, P_WHIP, W_QUIVER, W_SWAPWEP, W_WEAPONS, W_WEP } from './const.js';
import { LENSES, LOADSTONE, OBJECT_NAMES, AKLYS, HEAVY_IRON_BALL, IRON_CHAIN, OBJECT_DIR, OBJECT_SUBTYPE, TIN_OPENER, TOWEL, BATTLE_AXE, CORPSE } from './object_data.js';
import { monsterIsHumanoid, MONSTER_FLAGS1, requireMonsterData } from './monster_data.js';
import { heroSpecies, heroHasNoHands, heroIsVerySmall } from './polyself.js';
import { heroHandName } from './body_parts.js';
import { armorUsesPairGrammar, makePlural, minimalObjectName, objectNameIsPlural, observeObjectForNaming, objectHasPersonalName, objectName, ownedObjectAction, corpseName, killerObjectName, objectCombatName } from './objnam.js';
import { clearSplitObjects, rejoinObjectStack, splitObjectStack } from './mkobj.js';
import { objectClassForType } from './o_init.js';
import { inventoryItemDescription } from './invent.js';
import { getobj } from './inventory_prompt.js';
import { freeInventoryObject } from './hero_inventory.js';
import { addInventoryItem } from './u_init.js';
import { isBimanualObject, isWeaponTool, isWetTowel, isAmmunition, isMissileObject, isPolearm } from './object_properties.js';
import { stopTwoWeaponCombat, toggleTwoWeaponCombat } from './two_weapon.js';
import { resetBulkTakeoff, cancelSlotTakeoff } from './do_wear.js';
import { readySuggestion } from './quiver.js';
import { objectOwnershipPrefix, insideShopRoomAt, shopResident } from './shk.js';
import { promptYesNoQuit } from './query.js';
import { artifactById, speakArtifact, artifactEmitsLight, setWornArtifactProperties, setArtifactWarningWielded } from './artifacts.js';
import { rn2 } from './rng.js';
import { retouchHeroObject } from './hero_retouch.js';
import { lightWieldedArtifact, equipmentLightMessage } from './light.js';
import { endObjectBurn } from './timeout.js';
import { shopkeeperName } from './shknam.js';
import { statusConditionEnabled } from './botl.js';
import { heroResistsStoning, touchPetrifies } from './stoning.js';
import { resolveImmediatePetrification } from './trap.js';
import { setnotworn, setworn, recalculateTelepathyRange } from './worn.js';
import { heroIsBlind } from './senses.js';
import { makeHallucinated } from './potion.js';
const WEAPON_CLASS = 2;
export async function dotwoweapon() {
    const spentTime = await toggleTwoWeaponCombat();
    if (!game.program_state.gameover)
        game.context.move = spentTime ? 1 : 0;
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
    }
    else if (oldPrimary) {
        await setSecondaryWeapon(oldPrimary, game);
        observeObjectForNaming(oldPrimary);
        await plineWithContinuation(`${oldPrimary.invlet} - ${await inventoryItemDescription(oldPrimary)}.`);
    }
    else {
        await plineWithContinuation('You have no secondary weapon readied.');
    }
    if (result === 'failed')
        commandResultFailed(); // ready_weapon() ECMD_FAIL.
    else
        game.context.move = result === 'time' ? 1 : 0;
}
// C refs: wield.c:dowield(), ready_weapon(), invent.c:getobj().  The prompt
// advertises weapons and weapon-tools but still permits the full inventory
// through ?/*; '-' represents the synthetic empty-hands object.
export async function dowield() {
    setMulti(0);
    if (heroHasNoHands(game) || heroIsVerySmall(game)) {
        await pline("Don't be ridiculous!");
        commandResultFailed(); // wield.c:dowield() cantwield ECMD_FAIL.
        return;
    }
    clearSplitObjects();
    // C wield.c:wield_ok(): hands are a likely candidate; coins are excluded.
    const selection = await getobj('wield', object => object.oclass === 12 ? GETOBJ_EXCLUDE
        : object.oclass === 2 || isWeaponTool(object) ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY, {
        forcePrompt: true, allowCount: true, hands: GETOBJ_SUGGEST,
        handsText: `your ${game.uarmg ? 'gloved' : 'bare'} ${makePlural(heroHandName(game))}${game.uwep ? '' : ' (wielded)'}`,
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
    let splitParent = null;
    if (object && selection.count !== null && selection.count < object.quan) {
        if (object.otyp === LOADSTONE && object.cursed)
            object.corpsenm = selection.count;
        else if (isWeldedPrimary(object))
            object.bknown = true;
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
        if (splitParent && object)
            await rejoinObjectStack(splitParent, object);
        commandResultFailed(); // wield.c:dowield() welded ECMD_FAIL.
        return;
    }
    if (splitParent && object) {
        if (splitParent === game.uwep) {
            await rejoinObjectStack(splitParent, object);
            await reportAlreadyWielded(splitParent);
        }
        else {
            await finishSplittingCarriedStack(object);
            await wieldSelectedWeapon(object);
        }
        return;
    }
    if (selection.none) {
        await wieldSelectedWeapon(null);
        return;
    }
    if (!object)
        return;
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
        let confirmation;
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
        }
        else {
            const plural = objectNameIsPlural(object, game)
                || object.otyp === LENSES || armorUsesPairGrammar(OBJECT_NAMES[object.otyp]);
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
    }
    else if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY | W_SADDLE)) {
        await pline('You cannot wield that!');
        commandResultFailed(); // wield.c:dowield() "cannot wield that" ECMD_FAIL.
        return;
    }
    await wieldSelectedWeapon(object);
}
async function reportAlreadyWielded(object) {
    await pline('You are already wielding that!');
    if (isWeaponTool(object) || isWetTowel(object))
        game._unweapon = false;
    commandResultFailed(); // wield.c:dowield() already-wielded ECMD_FAIL.
}
async function wieldSelectedWeapon(object) {
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
    if (result === 'failed')
        commandResultFailed(); // ready_weapon() ECMD_FAIL.
    else
        game.context.move = result === 'time' ? 1 : 0;
}
// C refs: dowieldquiver(), doquiver_core().  Q and empty-quiver fire share
// one live inventory transaction; neither role nor recorded input selects a
// different readiness implementation.
export async function doready() {
    await doquiverCore('ready');
}
function splitCarriedStack(item, count) {
    const split = splitObjectStack(item, count, game);
    if (!split)
        throw new Error('cannot split selected inventory stack');
    return split;
}
async function splitStackForQuiver(item, count) {
    const child = splitCarriedStack(item, count);
    await finishSplittingCarriedStack(child);
    return child;
}
// C finish_splitting(): take the child out and add it without merging so
// its inherited inventory letter is replaced and carried effects refresh.
async function finishSplittingCarriedStack(object) {
    await freeInventoryObject(object);
    const nomerge = !!object.nomerge;
    object.nomerge = true;
    await addInventoryItem(object, null, false);
    object.nomerge = nomerge;
}
function splittableForQuiver(item) {
    return !(item?.otyp === LOADSTONE && item.cursed)
        && !isWeldedPrimary(item);
}
function hasFreeBasicInventoryLetter() {
    return game.inventory.filter(item => item.oclass !== 12).length < 52;
}
export async function doquiverCore(verb) {
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
            : `your ${makePlural(heroHandName(game))}`,
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
        }
        else {
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
            || item.otyp === LENSES || armorUsesPairGrammar(OBJECT_NAMES[item.otyp]);
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
            const partial = await promptYesNoQuit(`${slotDescription}  Ready ${quantity - 1} of them?`);
            if (partial === 'q') {
                game.context.move = 0;
                return { item: null, spentTime: false, cancelled: false };
            }
            if (partial === 'y') {
                item = await splitStackForQuiver(item, quantity - 1);
                readyAll = false;
            }
            else
                confirmation = 'Ready all of them instead?';
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
            }
            else {
                await setSecondaryWeapon(null, game);
                spentTime = wasTwoweap;
            }
        }
    }
    if (verb !== 'fire')
        await setQuiverObject(item, game);
    observeObjectForNaming(item);
    const description = await inventoryItemDescription(item);
    await plineWithContinuation(verb === 'fire'
        ? `You ready: ${item.invlet} - ${description}.`
        : `${item.invlet} - ${description}.`);
    if (verb === 'fire')
        await setQuiverObject(item, game);
    if (spentTime) {
        if (primary) {
            const humanoid = monsterIsHumanoid(heroSpecies(game));
            const hands = game.uarmg ? 'empty handed'
                : humanoid ? 'bare handed' : 'not wielding anything';
            await plineWithContinuation(`You are now ${hands}.`);
        }
        else
            await plineWithContinuation('You are no longer using two weapons at once.');
    }
    game.context.move = spentTime ? 1 : 0;
    return { item, spentTime, cancelled: false };
}
// C wield.c TWOWEAPOK; the two-handed check is separate.
export function isTwoWeaponObject(object) {
    if (object?.oclass !== WEAPON_CLASS)
        return isWeaponTool(object);
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    return !(skill >= P_BOW && skill <= P_CROSSBOW)
        && !isAmmunition(object) && !isMissileObject(object);
}
// C setuwep(): an improvised weapon announces its first use in melee.
export function weaponNeedsBashingMessage(object, state) {
    if (!object)
        return true;
    if (object.oclass !== WEAPON_CLASS)
        return !isWeaponTool(object) && !isWetTowel(object);
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    const launcher = skill >= P_BOW && skill <= P_CROSSBOW;
    const groundedPolearm = isPolearm(object) && !state.u.usteed
        && artifactById(object.oartifact)?.name !== 'Snickersnee';
    return launcher || isAmmunition(object) || isMissileObject(object)
        || groundedPolearm;
}
export function willWeld(object) {
    if (!object?.cursed)
        return false;
    const weaponTool = object.oclass === 6 && OBJECT_SUBTYPE[object.otyp] !== 0;
    return object.oclass === WEAPON_CLASS || weaponTool
        || [HEAVY_IRON_BALL, IRON_CHAIN, TIN_OPENER].includes(object.otyp);
}
// Readiness messages around a semantic primary-weapon change.
// C refs: wield.c ready_weapon(), before and after setuwep().
export async function refuseWeldedPrimary(state = game) {
    const weapon = state.uwep || state.u.uwep;
    if (!weapon || !willWeld(weapon))
        return false;
    weapon.bknown = true;
    const hand = heroHandName(state);
    const hands = isBimanualObject(weapon) ? makePlural(hand) : hand;
    await plineWithContinuation(`${ownedObjectAction(weapon, 'are', state)} welded to your ${hands}!`);
    return true;
}
export async function announceWeaponWeld(object, state = game) {
    const noun = objectName(object, state);
    const quantity = object.quan ?? object.quantity ?? 1;
    const proper = objectHasPersonalName(object, state);
    const article = proper && !noun.includes(' of ') ? '' : 'The ';
    const subject = quantity === 1 ? noun : `${quantity} ${makePlural(noun)}`;
    const side = state.u.rightHanded === false ? 'left' : 'right';
    const hand = heroHandName(state);
    const hands = isBimanualObject(object)
        ? makePlural(hand) : `dominant ${side} ${hand}`;
    await plineWithContinuation(`${article}${subject} ${quantity === 1 ? 'welds itself' : 'weld themselves'} to your ${hands}!`);
    object.bknown = true;
}
export async function explainTwoWeaponEnd(wasTwoWeapon, state = game) {
    const weapon = state.uwep || state.u?.uwep;
    if (!wasTwoWeapon || state.u.twoweap || !weapon
        || state.flags?.verbose === false)
        return;
    const suitable = isTwoWeaponObject(weapon) && !isBimanualObject(weapon);
    await plineWithContinuation(suitable
        ? 'You are no longer using two weapons at once.'
        : 'You can no longer wield two weapons at once.');
}
// C wield.c:ready_weapon() and cant_wield_corpse(): the wield messages and
// the bare-handed petrifying-corpse refusal live in readySelectedWeapon.
// C wield.c:empty_handed().
export function emptyHandedDescription(state = game) {
    if (state.uarmg || state.u.uarmg)
        return 'empty handed';
    const humanoid = monsterIsHumanoid(heroSpecies(state));
    return humanoid ? 'bare handed' : 'not wielding anything';
}
// The caller has already checked whether the old weapon is welded. A failed
// touch spends a turn; a shield refusal does not. Neither installs the item.
export async function readyHeroWeapon(weapon, state = game) {
    const hadWeapon = !!(state.uwep || state.u.uwep);
    const result = await readySelectedWeapon(weapon, state);
    if (hadWeapon !== !!(state.uwep || state.u.uwep)
        && statusConditionEnabled('barehanded', state))
        state.context.botl = true;
    return result;
}
// C wield.c:cant_wield_corpse(): a bare-handed petrifying-corpse wield
// announces itself and petrifies instead of installing the weapon.
async function readySelectedWeapon(weapon, state) {
    requirePlayingGame(state);
    const previous = state.uwep || state.u.uwep;
    const wasTwoWeapon = state.u.twoweap;
    if (!weapon) {
        await plineWithContinuation(`You are ${previous ? '' : 'already '}${emptyHandedDescription(state)}.`);
        if (previous)
            await setPrimaryWeapon(null, state);
        return previous ? 'time' : 'ok';
    }
    if (weapon.otyp === CORPSE && touchPetrifies(weapon.corpsenm)
        && !(state.uarmg || state.u.uarmg) && !heroResistsStoning(state)) {
        await plineWithContinuation(`You wield ${corpseName(weapon, { definite: true })} in your bare ${makePlural(heroHandName(state))}.`);
        await resolveImmediatePetrification({
            state, killer: `wielding ${killerObjectName(weapon, state)} bare-handed`,
        });
        return 'time';
    }
    if ((state.uarms || state.u.uarms) && isBimanualObject(weapon)) {
        const skill = OBJECT_SUBTYPE[weapon.otyp] ?? 0;
        const kind = weapon.oclass === 2 && skill >= P_SHORT_SWORD && skill <= P_SABER
            ? 'sword' : weapon.otyp === BATTLE_AXE ? 'axe' : 'weapon';
        await plineWithContinuation(`You cannot wield a two-handed ${kind} while wearing a shield.`);
        return 'failed';
    }
    const touch = await retouchHeroObject(weapon, { state });
    if (touch.rejected || touch.died)
        return 'time';
    observeObjectForNaming(weapon, { state });
    if (willWeld(weapon)) {
        await announceWeaponWeld(weapon, state);
    }
    else {
        if (weapon.otyp === AKLYS)
            await plineWithContinuation('You secure the tether.');
        await plineWithContinuation(`${weapon.invlet} - ${await inventoryItemDescription(weapon, { projectPrimaryHand: true })}.`);
    }
    await setPrimaryWeapon(weapon, state);
    await explainTwoWeaponEnd(wasTwoWeapon, state);
    if (weapon.oartifact)
        await speakArtifact(weapon, { state });
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
export function isWeldedPrimary(object, state = game) {
    if (!object || object !== (state.uwep || state.u?.uwep) || !willWeld(object))
        return false;
    // C welded() discovers the curse even when the caller can still act.
    object.bknown = true;
    return true;
}
// C wield.c:set_twoweap().
export function setTwoWeaponCombat(enabled, state = game) {
    if (state.u.twoweap === enabled)
        return;
    state.u.twoweap = enabled;
    if (state.flags.weaponstatus)
        state.context.botl = true;
}
function slotObject(slot, state) {
    return state[slot] || state.u?.[slot] || null;
}
// C wield.c:setuwep().  setworn() carries the slot work: two-weapon
// cancellation, cancel_doff(), the owornmask/extrinsic bookkeeping and the
// artifact intrinsics.  The Ogresmasher botl, the Sunsword light and the
// "begin bashing" notice belong here.
export async function setPrimaryWeapon(object, state = game) {
    const previous = slotObject('uwep', state);
    if (previous === object)
        return previous; /* necessary to not set gu.unweapon */
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
export async function setSecondaryWeapon(object, state = game) {
    const previous = slotObject('uswapwep', state);
    await setworn(object, W_SWAPWEP, state);
    return previous;
}
// C wield.c:setuqwep(): setworn(obj, W_QUIVER); no extra handling needed,
// update_inventory() is already performed by setworn().
export async function setQuiverObject(object, state = game) {
    const previous = slotObject('uquiver', state);
    await setworn(object, W_QUIVER, state);
    return previous;
}
// C wield.c:uwepgone().  The light-source message precedes setworn()'s
// removal of the warning source, and the bare-hand notice is armed.
export async function uwepgone(state = game) {
    const object = slotObject('uwep', state);
    if (!object)
        return;
    if (object.lamplit && artifactEmitsLight(object)) {
        endObjectBurn(object, state);
        if (!heroIsBlind(state))
            await plineWithContinuation(equipmentLightMessage(object, false, state));
    }
    await setworn(null, W_WEP, state);
    state._unweapon = true; /* for "bare hands" message */
}
// C wield.c:uswapwepgone().  setworn(0, W_SWAPWEP) plus the redraw.
export async function uswapwepgone(state = game) {
    if (!slotObject('uswapwep', state))
        return;
    await setworn(null, W_SWAPWEP, state);
}
// C wield.c:uqwepgone().  setworn(0, W_QUIVER) plus the redraw.
export async function uqwepgone(state = game) {
    if (!slotObject('uquiver', state))
        return;
    await setworn(null, W_QUIVER, state);
}
// C invent.c:merged() `#adjust' fixup for merging wielded darts, daggers,
// &c: both stacks might be worn in competing slots; merger preference
// (regardless of which is which) is primary weapon, then alternate, then
// quiver, all through raw setworn()/setnotworn().
export async function mergeHeroWeaponSlots(survivor, incoming, state = game) {
    if (!incoming.owornmask || survivor.where !== 'inventory')
        return;
    const combined = (survivor.owornmask ?? 0) | incoming.owornmask;
    const wmask = combined & W_WEP ? W_WEP
        : combined & W_SWAPWEP ? W_SWAPWEP
            : combined & W_QUIVER ? W_QUIVER : 0;
    if (!wmask)
        throw new Error('merging objects in non-weapon slots');
    if (((survivor.owornmask ?? 0) & ~wmask) !== 0)
        await setnotworn(survivor, state);
    await setworn(survivor, wmask, state);
    await setnotworn(incoming, state);
}
//# sourceMappingURL=wield.js.map