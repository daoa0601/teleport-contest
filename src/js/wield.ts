// wield.js — Wield, quiver, and weapon-swap commands.
// C refs: wield.c dowield(), dowieldquiver(), doquiver_core(),
// doswapweapon(), dotwoweapon(), and finish_splitting().

import { game } from './gstate.js';
import { pline, plineWithContinuation } from './pline.js';
import {
    commandResultCancelled, commandResultFailed, setMulti,
} from './command_state.js';
import type { GameObject } from './object_types.js';
import {
    GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, W_ACCESSORY, W_ARMOR,
    W_SADDLE,
} from './const.js';
import { LENSES, LOADSTONE, OBJECT_NAMES } from './object_data.js';
import { monsterIsHumanoid } from './monster_data.js';
import { heroSpecies } from './hero_species.js';
import { heroHandName } from './body_parts.js';
import { heroHasNoHands, heroIsVerySmall } from './polyself.js';
import { armorUsesPairGrammar, makePlural } from './object_grammar.js';
import {
    minimalObjectName, objectNameIsPlural, observeObjectForNaming,
} from './objnam.js';
import { inventoryItemDescription } from './invent.js';
import { getobj } from './inventory_prompt.js';
import {
    clearSplitObjects, rejoinObjectStack, splitObjectStack,
} from './object_stack.js';
import { freeInventoryObject } from './hero_inventory.js';
import { addInventoryItem } from './u_init.js';
import { isWeaponTool } from './object_properties.js';
import { isWetTowel } from './object_properties.js';
import { stopTwoWeaponCombat, toggleTwoWeaponCombat } from './two_weapon.js';
import { resetBulkTakeoff } from './takeoff_state.js';
import { readySuggestion } from './quiver.js';
import { objectOwnershipPrefix } from './shk.js';
import { objectClassForType } from './object_knowledge.js';
import { promptYesNoQuit } from './query.js';
import {
    AKLYS_LIM,
    P_AXE,
    P_BOW,
    P_CROSSBOW,
    P_DAGGER,
    P_LANCE,
    P_PICK_AXE,
    P_POLEARMS,
    P_SABER,
    P_SHORT_SWORD,
    P_WHIP,
} from './const.js';
import { artifactById } from './artifacts.js';
import {
    AKLYS,
    HEAVY_IRON_BALL,
    IRON_CHAIN,
    OBJECT_BIMANUAL,
    OBJECT_DIR,
    OBJECT_SUBTYPE,
    TIN_OPENER,
    TOWEL,
} from './object_data.js';
import { rn2 } from './rng.js';
import { isAmmunition, isMissileObject, isPolearm, type WeaponCandidate } from './object_properties.js';
import type { GameState } from './game_state.js';
import { objectHasPersonalName, objectName, ownedObjectAction } from './objnam.js';
import { speakArtifact } from './artifacts.js';
import { requirePlayingGame } from './gstate.js';
import { retouchHeroObject } from './hero_retouch.js';
import { lightWieldedArtifact } from './light.js';
import { MONSTER_FLAGS1, requireMonsterData } from './monster_data.js';
import { shopkeeperName } from './shknam.js';
import { BATTLE_AXE, CORPSE } from './object_data.js';
import { corpseName, killerObjectName, objectCombatName } from './objnam.js';
import { insideShopRoomAt, shopResident } from './shk.js';
import { statusConditionEnabled } from './botl.js';
import { heroResistsStoning, resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { W_QUIVER, W_SWAPWEP, W_WEAPONS, W_WEP } from './const.js';
import {
    artifactEmitsLight,
    setWornArtifactProperties,
    setArtifactWarningWielded,
} from './artifacts.js';
import { recalculateTelepathyRange } from './worn.js';
import { makeHallucinated } from './hero_mental_status.js';
import { endObjectBurn, equipmentLightMessage } from './light.js';
import { heroIsBlind } from './senses.js';
import { cancelSlotTakeoff } from './takeoff_state.js';

const WEAPON_CLASS = 2;

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

// C refs: wield.c:dowield(), ready_weapon(), invent.c:getobj().  The prompt
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
    const selection = await getobj('wield', object => object.oclass === 12 ? GETOBJ_EXCLUDE
        : object.oclass === 2 || isWeaponTool(object) ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY, {
        forcePrompt: true, allowCount: true, hands: GETOBJ_SUGGEST,
        handsText: `your ${game.uarmg ? 'gloved' : 'bare'} ${
            makePlural(heroHandName(game))}${game.uwep ? '' : ' (wielded)'}`,
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
    return game.inventory.filter(item => item.oclass !== 12).length < 52;
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
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    return !(skill >= P_BOW && skill <= P_CROSSBOW)
        && !isAmmunition(object) && !isMissileObject(object);
}
// C setuwep(): an improvised weapon announces its first use in melee.
export function weaponNeedsBashingMessage(object: WeaponCandidate, state: GameState): boolean {
    if (!object) return true;
    if (object.oclass !== WEAPON_CLASS)
        return !isWeaponTool(object) && !isWetTowel(object);
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    const launcher = skill >= P_BOW && skill <= P_CROSSBOW;
    const groundedPolearm = isPolearm(object) && !state.u.usteed
        && artifactById(object.oartifact)?.name !== 'Snickersnee';
    return launcher || isAmmunition(object) || isMissileObject(object)
        || groundedPolearm;
}

export function willWeld(object: WeaponCandidate): boolean {
    if (!object?.cursed) return false;
    const weaponTool = object.oclass === 6 && OBJECT_SUBTYPE[object.otyp] !== 0;
    return object.oclass === WEAPON_CLASS || weaponTool
        || [HEAVY_IRON_BALL, IRON_CHAIN, TIN_OPENER].includes(object.otyp);
}

// Readiness messages around a semantic primary-weapon change.
// C refs: wield.c ready_weapon(), before and after setuwep().

export async function refuseWeldedPrimary(state: GameState = game): Promise<boolean> {
    const weapon = state.uwep || state.u.uwep;
    if (!weapon || !willWeld(weapon)) return false;
    weapon.bknown = true;
    const hand = heroHandName(state);
    const hands = OBJECT_BIMANUAL[weapon.otyp] ? makePlural(hand) : hand;
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
    const hand = heroHandName(state);
    const hands = OBJECT_BIMANUAL[object.otyp]
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
    const suitable = isTwoWeaponObject(weapon) && !OBJECT_BIMANUAL[weapon.otyp];
    await plineWithContinuation(suitable
        ? 'You are no longer using two weapons at once.'
        : 'You can no longer wield two weapons at once.');
}

// C wield.c:ready_weapon(), cant_wield_corpse(), and empty_handed().

// C wield.c:empty_handed().
export function emptyHandedDescription(state: GameState = game): string {
    if (state.uarmg || state.u.uarmg) return 'empty handed';
    const humanoid = requireMonsterData(MONSTER_FLAGS1, heroSpecies(state)) & 0x00020000;
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
        await plineWithContinuation(`You wield ${corpseName(weapon, { definite: true })} in your bare ${makePlural(heroHandName(state))}.`);
        await resolveImmediatePetrification({
            state, killer: `wielding ${killerObjectName(weapon, state)} bare-handed`,
        });
        return 'time';
    }
    if ((state.uarms || state.u.uarms) && OBJECT_BIMANUAL[weapon.otyp]) {
        const skill = OBJECT_SUBTYPE[weapon.otyp] ?? 0;
        const kind = weapon.oclass === 2 && skill >= P_SHORT_SWORD && skill <= P_SABER
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
type WeaponFlag = 'wielded' | 'alternate' | 'ready';
type WeaponSlotAssignment = readonly [slot: WeaponSlot, mask: number, flag: WeaponFlag];

const WEAPON_SLOTS: readonly WeaponSlotAssignment[] = [
    ['uwep', W_WEP, 'wielded'],
    ['uswapwep', W_SWAPWEP, 'alternate'],
    ['uquiver', W_QUIVER, 'ready'],
];

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

function clearSlot(
    slot: WeaponSlot, mask: number, flag: WeaponFlag, state: GameState,
): GameObject | null {
    const object = slotObject(slot, state);
    if (object) cancelSlotTakeoff(slot, state);
    state[slot] = null;
    if (state.u) state.u[slot] = null;
    if (!object) return null;
    if (slot === 'uwep' && artifactEmitsLight(object) && object.lamplit)
        endObjectBurn(object, state);
    object[flag] = false;
    object.owornmask = (object.owornmask ?? 0) & ~mask;
    recalculateTelepathyRange(state);
    return object;
}

function installSlot(
    object: GameObject, slot: WeaponSlot, mask: number, flag: WeaponFlag, state: GameState,
): void {
    state[slot] = object;
    if (state.u) state.u[slot] = object;
    object.wielded = flag === 'wielded';
    object.alternate = flag === 'alternate';
    object.ready = flag === 'ready';
    object.owornmask = (object.owornmask ?? 0) | mask;
    recalculateTelepathyRange(state);
}

async function replaceSlot(
    object: GameObject | null, slot: WeaponSlot, mask: number, flag: WeaponFlag, state: GameState,
): Promise<GameObject | null> {
    const oldObject = slotObject(slot, state);
    if (oldObject !== object || !object) clearSlot(slot, mask, flag, state);
    if (!object) return oldObject;
    if (oldObject !== object) await releaseWeaponSlots(object, state);
    installSlot(object, slot, mask, flag, state);
    return oldObject;
}

export async function setWieldedArtifactProperties(
    object: GameObject, active: boolean, state: GameState,
): Promise<void> {
    const artifact = artifactById(object.oartifact, state);
    setWornArtifactProperties(object, 'uwep', active, state);
    if (artifact?.flags.includes('SPFX_HALRES')) {
        await makeHallucinated(Number(!active), {
            state, talk: !state.program_state?.restoring,
            resistanceSource: { object, slot: 'uwep' },
        });
    }
    await setArtifactWarningWielded(object, active, state);
}

export async function setPrimaryWeapon(
    object: GameObject | null, state: GameState = game,
): Promise<GameObject | null> {
    const previous = slotObject('uwep', state);
    if (previous === object) return previous;
    if (state.flags.weaponstatus) state.context.botl = true;
    if (previous) cancelSlotTakeoff('uwep', state);
    // Semantic unwielding retains the old pointer while its warning stops.
    if (previous) {
        setTwoWeaponCombat(false, state);
        previous.wielded = false;
        previous.owornmask = (previous.owornmask ?? 0) & ~W_WEP;
        await setWieldedArtifactProperties(previous, false, state);
    }
    if (object) await releaseWeaponSlots(object, state);
    state.uwep = object;
    if (state.u) state.u.uwep = object;
    if (object) {
        installSlot(object, 'uwep', W_WEP, 'wielded', state);
        await setWieldedArtifactProperties(object, true, state);
    }
    if (artifactById(previous?.oartifact, state)?.name === 'Ogresmasher'
        || artifactById(object?.oartifact, state)?.name === 'Ogresmasher')
        state.context.botl = true;
    // setuwep ends the displaced light after setworn's new warning census.
    if (previous?.lamplit && artifactEmitsLight(previous)) {
        endObjectBurn(previous, state);
        if (!heroIsBlind(state))
            await plineWithContinuation(equipmentLightMessage(previous, false, state));
    }
    state._unweapon = weaponNeedsBashingMessage(object, state);
    return previous;
}

export async function setSecondaryWeapon(
    object: GameObject | null, state: GameState = game,
): Promise<GameObject | null> {
    if (slotObject('uswapwep', state)) setTwoWeaponCombat(false, state);
    return await replaceSlot(
        object, 'uswapwep', W_SWAPWEP, 'alternate', state,
    );
}

export async function setQuiverObject(
    object: GameObject | null, state: GameState = game,
): Promise<GameObject | null> {
    return await replaceSlot(object, 'uquiver', W_QUIVER, 'ready', state);
}

// C uwepgone(): light ends before setworn removes the warning source.
export async function losePrimaryWeapon(state: GameState = game): Promise<void> {
    const object = slotObject('uwep', state);
    if (!object) return;
    if (state.flags.weaponstatus) state.context.botl = true;
    cancelSlotTakeoff('uwep', state);
    if (object.lamplit && artifactEmitsLight(object)) {
        endObjectBurn(object, state);
        if (!heroIsBlind(state))
            await plineWithContinuation(equipmentLightMessage(object, false, state));
    }
    setTwoWeaponCombat(false, state);
    object.wielded = false;
    object.owornmask = (object.owornmask ?? 0) & ~W_WEP;
    await setWieldedArtifactProperties(object, false, state);
    state.uwep = null;
    if (state.u) state.u.uwep = null;
    state._unweapon = true;
}

export async function releaseWeaponSlots(
    object: GameObject | null | undefined, state: GameState = game,
    { keepUnweapon = false }: { keepUnweapon?: boolean } = {},
): Promise<void> {
    if (!object) return;
    const primary = state.uwep === object || state.u?.uwep === object;
    const secondary = state.uswapwep === object
        || state.u?.uswapwep === object;
    const quivered = state.uquiver === object || state.u?.uquiver === object;
    if (primary && state.flags.weaponstatus) state.context.botl = true;

    if (primary) cancelSlotTakeoff('uwep', state);
    if (secondary) cancelSlotTakeoff('uswapwep', state);
    if (quivered) cancelSlotTakeoff('uquiver', state);

    if (primary || secondary) setTwoWeaponCombat(false, state);
    if (primary && artifactEmitsLight(object) && object.lamplit)
        endObjectBurn(object, state);

    if (state.uwep === object) state.uwep = null;
    if (state.u?.uwep === object) state.u.uwep = null;
    if (state.uswapwep === object) state.uswapwep = null;
    if (state.u?.uswapwep === object) state.u.uswapwep = null;
    if (state.uquiver === object) state.uquiver = null;
    if (state.u?.uquiver === object) state.u.uquiver = null;

    // C worn.c:setnotworn() clears a wielded slot without arming the
    // "begin bashing" notice; only uwepgone()/setuwep(NULL) set unweapon.
    // Callers whose C counterpart uses setnotworn() pass keepUnweapon.
    if (primary && !keepUnweapon) state._unweapon = true;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
    object.owornmask = (object.owornmask ?? 0) & ~W_WEAPONS;
    recalculateTelepathyRange(state);
    // Direct setnotworn clears the pointer before warning feedback.
    if (primary) await setWieldedArtifactProperties(object, false, state);
}

// C merged() uses raw setworn/setnotworn, not wield commands or uwepgone.
export function mergeHeroWeaponSlots(
    survivor: GameObject, incoming: GameObject, state: GameState = game,
): void {
    if (!incoming.owornmask || survivor.where !== 'inventory') return;
    const combined = (survivor.owornmask || 0) | incoming.owornmask;
    const target: WeaponSlotAssignment | null = combined & W_WEP ? ['uwep', W_WEP, 'wielded']
        : combined & W_SWAPWEP ? ['uswapwep', W_SWAPWEP, 'alternate']
            : combined & W_QUIVER ? ['uquiver', W_QUIVER, 'ready'] : null;
    if (!target) throw new Error('merging objects in non-weapon slots');
    if (target[1] !== W_QUIVER) setTwoWeaponCombat(false, state);
    for (const [slot, mask, flag] of WEAPON_SLOTS) {
        const object = slotObject(slot, state);
        if (object === survivor || object === incoming)
            clearSlot(slot, mask, flag, state);
    }
    installSlot(survivor, ...target, state);
}
