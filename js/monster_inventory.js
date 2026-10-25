// Monster inventory operations.
// C refs: steal.c:mpickobj()/add_to_minv() and invent.c:carry_obj_effects().
import { attachCursedFigurineTimer } from './figurine_timer.js';
import { I_SPECIAL, LOST_DROPPED, LOST_NONE, LOST_STOLEN, LOST_THROWN, W_ARM, W_SADDLE, W_WEP, } from './const.js';
import { placeObject } from './floor_object.js';
import { assertCreatedObject, objectNoLongerHeld } from './object_release.js';
import { game, requireLiveGame } from './gstate.js';
import { mergable, mergeCreatedObjectStacks, mergeObjectStacks } from './object_merge.js';
import { deleteObject } from './object_delete.js';
import { removeObjectAndContentsFromBill } from './shk.js';
import { artifactEmitsLight } from './artifacts.js';
import { endObjectBurn, objectShedsLight, snuffLightSource } from './light.js';
import { monsterCanEngulf, monsterTypeName } from './monster_data.js';
import { impossible } from './diagnostics.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { updateMonsterEquipment } from './monster_equipment.js';
import { unwieldMonsterWeapon } from './monster_weapon.js';
import { definiteName, observeObjectForNaming, objectName, objectNameIsPlural, pluralizeObjectNoun, simpleObjectName, } from './objnam.js';
import { heroIsBlind } from './senses.js';
import { ELVEN_SHIELD, GLOB_OF_BLACK_PUDDING, GLOB_OF_GRAY_OOZE, OBJECT_MERGE, OBJECT_USES_KNOWN, ORCISH_SHIELD, SHIELD_OF_REFLECTION, } from './object_data.js';
const DESCRIPTION_UNKNOWN_CLASSES = new Set([
    2, // WEAPON_CLASS
    4, // RING_CLASS
    6, // TOOL_CLASS
    8, // POTION_CLASS
    9, // SCROLL_CLASS
    10, // SPBOOK_CLASS
    11, // WAND_CLASS
    13, // GEM_CLASS
    17, // VENOM_CLASS
]);
export function clearDescriptionKnowledge(object) {
    const isGlob = object.otyp >= GLOB_OF_GRAY_OOZE
        && object.otyp <= GLOB_OF_BLACK_PUDDING;
    const descriptionNeedsObservation = DESCRIPTION_UNKNOWN_CLASSES.has(object.oclass)
        || (object.otyp >= ELVEN_SHIELD && object.otyp <= ORCISH_SHIELD)
        || object.otyp === SHIELD_OF_REFLECTION
        || !!OBJECT_MERGE[object.otyp];
    object.dknown = isGlob || !descriptionNeedsObservation;
}
export function forgetObjectKnowledge(object) {
    clearDescriptionKnowledge(object);
    object.bknown = false;
    delete object.buc;
    object.rknown = false;
    object.cknown = false;
    object.lknown = false;
    object.tknown = false;
    object.known = !OBJECT_USES_KNOWN[object.otyp];
}
export function clearMonsterCarriedObjectState(object, state = game) {
    if (!object)
        return;
    if (object.lamplit && artifactEmitsLight(object))
        endObjectBurn(object, state);
    object.owornmask = 0;
    object.worn = false;
    object.wornSlot = null;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
    object.ocarry = null;
    delete object.carrierMid;
}
async function prepareMonsterPickup(monster, object, state) {
    if (state._thrownObject === object)
        state._thrownObject = null;
    else if (state._kickedObject === object)
        state._kickedObject = null;
    removeObjectAndContentsFromBill(object, state);
    const snuff = objectShedsLight(object) && monsterCanEngulf(monster);
    if (snuff && state.u.uswallow && state.u.ustuck === monster && !heroIsBlind(state)) {
        observeObjectForNaming(object, { state });
        const noun = objectName(object, state);
        const name = definiteName(object.quan > 1 ? pluralizeObjectNoun(object, noun) : noun, state);
        const subject = name.charAt(0).toUpperCase() + name.slice(1);
        await plineWithContinuation(`${subject} ${objectNameIsPlural(object, state) ? 'go' : 'goes'} out.`);
    }
    object.no_charge = false;
    if (!monster.mtame && monster !== state.u?.ustuck
        && !canSeeMonster(monster)) {
        forgetObjectKnowledge(object);
    }
    if (!monster.mtame) {
        if (object.how_lost === LOST_THROWN)
            object.how_lost = LOST_STOLEN;
        else if (object.how_lost === LOST_DROPPED)
            object.how_lost = LOST_NONE;
    }
    attachCursedFigurineTimer(object, state);
    return snuff;
}
// Carrying effects precede merging; engulfing snuffs the surviving object.
export async function addObjectToMonsterInventory(monster, object, state = game, { atFront = true } = {}) {
    requireLiveGame(state);
    if (!monster)
        return null;
    if (!object) {
        await impossible(`monster (${monsterTypeName(monster.mnum, !!monster.female)}) taking or picking up nothing?`, { state });
        return null;
    }
    if (object === state.uball || object === state.uchain) {
        const part = object === state.uchain ? 'chain' : 'ball';
        await impossible(`monster (${monsterTypeName(monster.mnum, !!monster.female)}) taking or picking up attached ${part} (${simpleObjectName(object, state)})?`, { state });
        return null;
    }
    const extinguish = await prepareMonsterPickup(monster, object, state);
    const carried = await linkObjectToMonsterInventory(monster, object, { atFront, state });
    if (extinguish && monster.mx > 0)
        snuffLightSource(monster.mx, monster.my, state);
    return carried;
}
export async function addCreatedObjectToMonsterInventory(monster, object, state = game, { atFront = true } = {}) {
    assertCreatedObject(object, state);
    const extinguish = await prepareMonsterPickup(monster, object, state);
    const carried = await linkCreatedObjectToMonsterInventory(monster, object, { atFront, state });
    if (extinguish && monster.mx > 0)
        snuffLightSource(monster.mx, monster.my, state);
    return carried;
}
function linkMonsterObject(monster, object, inventory, atFront) {
    if (atFront)
        inventory.unshift(object);
    else
        inventory.push(object);
    monster.minvent = monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;
    object.where = 'minvent';
    object.ocarry = monster;
    // C add_to_minv leaves the former floor coordinates unchanged.
    object.carrierMid = monster.m_id ?? null;
    return object;
}
// C replmon()/restmonchn(): ownership follows the current actor instance,
// including while that actor has left the map but still carries its drops.
export function restoreMonsterInventoryOwnership(monster) {
    for (const object of monster.minvent || monster.inventory || []) {
        object.ocarry = monster;
        object.carrierMid = monster.m_id;
    }
}
// C add_to_minv: acquisition effects belong to mpickobj, not raw linkage.
export async function linkObjectToMonsterInventory(monster, object, { atFront = true, state = game } = {}) {
    requireLiveGame(state);
    if (!monster || !object)
        return null;
    if (object.where !== 'free')
        throw new Error('add_to_minv requires a free object');
    const inventory = monster.minvent || monster.inventory || [];
    const existing = inventory.find(candidate => mergable(candidate, object, state));
    return existing ? await mergeObjectStacks(existing, object, state)
        : linkMonsterObject(monster, object, inventory, atFront);
}
export async function linkCreatedObjectToMonsterInventory(monster, object, { atFront = true, state = game } = {}) {
    assertCreatedObject(object, state);
    const inventory = monster.minvent || monster.inventory || [];
    const existing = inventory.find(candidate => mergable(candidate, object, state));
    return existing ? await mergeCreatedObjectStacks(existing, object, state)
        : linkMonsterObject(monster, object, inventory, atFront);
}
// C obj_extract_self(): only unlink the object. Worn items must go through
// removeObjectFromMonsterInventory() to update the monster and its equipment.
export function unlinkMonsterObject(monster, object) {
    if (!monster || !object)
        return false;
    const inventory = monster.minvent || monster.inventory || [];
    const index = inventory.indexOf(object);
    if (index < 0)
        return false;
    inventory.splice(index, 1);
    monster.minvent = inventory;
    monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;
    object.ocarry = null;
    delete object.carrierMid;
    object.where = 'free';
    return true;
}
export async function removeObjectFromMonsterInventory(monster, object, state = game, { doExtrinsics = true, silently = false, publish = plineWithContinuation } = {}) {
    requireLiveGame(state);
    const worn = object.owornmask ?? 0;
    const wielded = monster.mw === object || object.wielded || (worn & W_WEP);
    if (object.where !== 'minvent'
        || !(monster.minvent || monster.inventory || []).includes(object))
        return false;
    if ((worn & W_ARM) && object.lamplit && artifactEmitsLight(object))
        endObjectBurn(object, state);
    unlinkMonsterObject(monster, object);
    object.owornmask = 0;
    object.worn = false;
    object.wornSlot = null;
    if (worn) {
        if (monster.mhp > 0 && doExtrinsics) {
            await updateMonsterEquipment(monster, object, false, state, { silently, publish });
            if (state.program_state?.gameover)
                return false;
        }
        monster.misc_worn_check = (monster.misc_worn_check ?? 0) & ~worn;
        monster.misc_worn_check |= I_SPECIAL;
    }
    if (monster.saddle === object || (worn & W_SADDLE)) {
        monster.saddle = null;
        monster.saddled = false;
    }
    // C worn.c:1413 unwear_mon_obj(): the release runs after the equipment
    // extrinsics and worn-check updates and before mwepgone()'s weapon
    // bookkeeping (unwieldMonsterWeapon below), unconditionally — even for
    // unworn items.  A fixed crysknife can survive this first draw and
    // still revert on the later placement release; that second release
    // stays with placeObject.
    await objectNoLongerHeld(object, state);
    if (wielded)
        await unwieldMonsterWeapon(monster, state, { weapon: object, publish });
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
    return true;
}
// C worn.c:m_lose_armor(): no floor effects or stacking.
export async function dropMonsterArmor(monster, object, state = game, options = {}) {
    if (!await removeObjectFromMonsterInventory(monster, object, state, options))
        return null;
    // Monster inventory releases also run during hero actions (polymorph
    // from a hero zap, kill cascades), so placement is always awaited.
    return placeObject(object, monster.mx, monster.my, state);
}
export async function destroyObjectFromMonsterInventory(monster, object, state = game, options = {}) {
    if (!await removeObjectFromMonsterInventory(monster, object, state, options))
        return false;
    return await deleteObject(object, state);
}
//# sourceMappingURL=monster_inventory.js.map