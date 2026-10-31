// wield.js — Wield, quiver, and weapon-swap commands.
// C refs: wield.c dowield(), dowieldquiver(), doquiver_core(),
// doswapweapon(), dotwoweapon(), and finish_splitting().
import { game } from './gstate.js';
import { pline, plineWithContinuation } from './pline.js';
import { commandResultCancelled, commandResultFailed, setMulti, } from './command_state.js';
import { GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, W_ACCESSORY, W_ARMOR, W_SADDLE, } from './const.js';
import { LENSES, LOADSTONE, OBJECT_NAMES } from './object_data.js';
import { monsterIsHumanoid } from './monster_data.js';
import { heroSpecies } from './hero_species.js';
import { heroHandName } from './body_parts.js';
import { heroHasNoHands, heroIsVerySmall } from './polyself.js';
import { armorUsesPairGrammar, makePlural } from './object_grammar.js';
import { minimalObjectName, objectNameIsPlural, observeObjectForNaming, } from './objnam.js';
import { inventoryItemDescription } from './invent.js';
import { getobj } from './inventory_prompt.js';
import { clearSplitObjects, rejoinObjectStack, splitObjectStack, } from './object_stack.js';
import { freeInventoryObject } from './hero_inventory.js';
import { addInventoryItem } from './u_init.js';
import { isWeaponTool } from './object_properties.js';
import { isWeldedPrimary, setPrimaryWeapon, setQuiverObject, setSecondaryWeapon, } from './weapon_slots.js';
import { readyHeroWeapon } from './weapon_readiness.js';
import { refuseWeldedPrimary } from './weapon_feedback.js';
import { isWetTowel } from './weapon_type.js';
import { stopTwoWeaponCombat, toggleTwoWeaponCombat } from './two_weapon.js';
import { resetBulkTakeoff } from './takeoff_state.js';
import { readySuggestion } from './quiver.js';
import { objectOwnershipPrefix } from './shk.js';
import { objectClassForType } from './object_knowledge.js';
import { promptYesNoQuit } from './query.js';
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
//# sourceMappingURL=wield.js.map