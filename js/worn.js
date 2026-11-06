// C worn.c: the hero equipment table and its slot installers
// (setworn()/setnotworn()/recalc_telepat_range()), the object bypass
// marks (bypass_obj(), bypass_objlist(), nxt_unbypassed_obj/loot(),
// clear_bypass()/clear_bypasses()), permanent monster invisibility and
// speed (mon_set_minvis(), mon_adjust_speed()), and monster armor
// (update_mon_extrinsics(), find_mac(), m_dowear(), m_dowear_type(),
// which_armor(), m_lose_armor(), mon_break_armor(), extra_pref(),
// extract_from_minvent()).
import { WEAPON_CLASS } from './objclass.js';
import { MFAST, MSLOW, NON_PM } from './const.js';
import { game, requireLiveGame } from './gstate.js';
import { MONSTER_EXPERIENCE_META, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, monsterTypeName, } from './monster_data.js';
import { naturalMonsterSpeed } from './mon.js';
import { objectDelay, objectPropertyName, ALCHEMY_SMOCK, AMULET_OF_GUARDING, AMULET_OF_LIFE_SAVING, AMULET_OF_REFLECTION, CORNUTHAUM, DUNCE_CAP, ELVEN_MITHRIL_COAT, HELM_OF_OPPOSITE_ALIGNMENT, MUMMY_WRAPPING, SADDLE, } from './object_data.js';
import { canSeeMonster, newsym } from './display.js';
import { grantWornProperty, hasCarriedProperty, refreshProperty, removeWornProperty } from './properties.js';
import { seenResistanceForProperty, monstersForgetHeroResistance, monsterObjectPronoun, monsterPossessive, monsterBreaksArmor, monsterHasHead, monsterHasNoHands, monsterHornCount, monsterIsAnimal, monsterIsCentaur, monsterIsMindless, monsterIsSlithy, monsterIsVerySmall, monsterIsWhirly, monsterSlipsArmor, monsterWrappingAllowed, touchPetrifies, } from './mondata.js';
import { armorBonus, armorSimpleName, armorSlotFor, cancelSlotTakeoff } from './do_wear.js';
import { setTwoWeaponCombat } from './wield.js';
import { artifactEmitsLight, setWieldedArtifactProperties, setWornArtifactProperties } from './artifact.js';
import { isBimanualObject, isWeaponTool } from './object_properties.js';
import { I_SPECIAL, W_AMUL, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMOR, W_ARMS, W_ARMU, W_BALL, W_CHAIN, W_QUIVER, W_RINGL, W_RINGR, W_SADDLE, W_SWAPWEP, W_TOOL, W_WEP, AC_MAX, DISMOUNT_FELL, } from './const.js';
import { objectMaterial, learnObjectType } from './o_init.js';
import { dragonFormForArmor } from './polyself.js';
import { ownedObjectName, objectNameIsPlural, observeDistantObjectForNaming, simpleObjectName, verbForSubject, } from './objnam.js';
import { plineWithContinuation, publishHeardMessage } from './pline.js';
import { inventoryItemDescription } from './invent.js';
import { learnWand } from './zap.js';
import { beginObjectBurn, endObjectBurn } from './timeout.js';
import { equipmentLightDescription } from './light.js';
import { cansee, vision_recalc } from './vision.js';
import { surfaceName } from './dungeon.js';
import { displayColorName, monsterName } from './do_name.js';
import { dismountHero, heroCanRideSteed, monsterCanBeSaddled } from './steed.js';
import { possessiveName } from './hacklib.js';
import { rnl } from './rng.js';
import { objectNoLongerHeld } from './do.js';
import { deleteObject } from './shk.js';
import { placeObject, unlinkMonsterObject } from './mkobj.js';
import { unwieldMonsterWeapon } from './weapon.js';
import { resolveImmediatePetrification } from './trap.js';
const WORN_SLOTS = [
    { slot: 'uarm', mask: W_ARM, label: 'uarm', propertySlot: 'uarm' },
    { slot: 'uarmc', mask: W_ARMC, label: 'uarmc', propertySlot: 'uarmc' },
    { slot: 'uarmh', mask: W_ARMH, label: 'uarmh', propertySlot: 'uarmh' },
    { slot: 'uarms', mask: W_ARMS, label: 'uarms', propertySlot: 'uarms' },
    { slot: 'uarmg', mask: W_ARMG, label: 'uarmg', propertySlot: 'uarmg' },
    { slot: 'uarmf', mask: W_ARMF, label: 'uarmf', propertySlot: 'uarmf' },
    { slot: 'uarmu', mask: W_ARMU, label: 'uarmu', propertySlot: 'uarmu' },
    { slot: 'uleft', mask: W_RINGL, label: 'left-ring', propertySlot: 'uleft' },
    { slot: 'uright', mask: W_RINGR, label: 'right-ring', propertySlot: 'uright' },
    { slot: 'uwep', mask: W_WEP, weaponFlag: 'wielded', propertySlot: 'uwep' },
    { slot: 'uswapwep', mask: W_SWAPWEP, weaponFlag: 'alternate', propertySlot: 'uswapwep' },
    { slot: 'uquiver', mask: W_QUIVER, weaponFlag: 'ready', propertySlot: 'uquiver' },
    { slot: 'uamul', mask: W_AMUL, label: 'uamul', propertySlot: 'uamul' },
    { slot: 'ublindf', mask: W_TOOL, label: 'ublindf', propertySlot: 'ublindf' },
    { slot: 'uball', mask: W_BALL },
    { slot: 'uchain', mask: W_CHAIN },
];
function wornSlotObject(slot, state) {
    return state[slot] ?? state.u?.[slot] ?? null;
}
function assignWornSlot(slot, object, state) {
    state[slot.slot] = object;
    if (state.u)
        state.u[slot.slot] = object;
}
function markWornObject(object, slot) {
    if (slot.weaponFlag) {
        if (slot.weaponFlag === 'wielded')
            object.wielded = true;
        else if (slot.weaponFlag === 'alternate')
            object.alternate = true;
        else
            object.ready = true;
    }
    else if (slot.label) {
        object.worn = true;
        object.wornSlot = slot.label;
    }
}
function unmarkWornObject(object, slot) {
    if (slot.weaponFlag) {
        if (slot.weaponFlag === 'wielded')
            object.wielded = false;
        else if (slot.weaponFlag === 'alternate')
            object.alternate = false;
        else
            object.ready = false;
    }
    else if (slot.label) {
        object.worn = false;
        object.wornSlot = null;
    }
}
// Part of C worn.c:setworn(): the property refresh after the w_blocks macro changes a worn-slot block.
// C worn.c w_blocks(): at most one blocking item per property, keyed on the
// mask being worn or unworn. The Eyes of the Overworld's BLINDED block is
// derived live from ublindf in senses.ts, so it needs no bookkeeping here.
function refreshWornBlocks(object, mask, state, on) {
    if (object.otyp === MUMMY_WRAPPING && (mask & W_ARMC) !== 0) {
        refreshProperty('invisible', state);
    }
    else if (object.otyp === CORNUTHAUM && (mask & W_ARMH) !== 0) {
        // C updates u.uprops[CLAIRVOYANT].blocked; the port keeps the one
        // possible blocker as a live flag.
        state.u.clairvoyanceBlocked = on && state.urole?.key !== 'wizard';
        refreshProperty('clairvoyant', state);
    }
}
// C worn.c:recalc_telepat_range()
// worn.c counts all ordinary worn TELEPAT objects, plus one source for
// every carried ESP artifact together, regardless of their number.
export function recalculateTelepathyRange(state) {
    const worn = [state.uarm, state.uarmc, state.uarmh, state.uarms,
        state.uarmg, state.uarmf, state.uarmu, state.uamul, state.uleft,
        state.uright, state.ublindf, state.uwep, state.uswapwep, state.uquiver];
    const ordinary = worn.filter(object => object && object.owornmask
        && objectPropertyName(object.otyp) === 'telepathy').length;
    const sources = ordinary + Number(hasCarriedProperty('telepathy', null, state));
    state.u.unblind_telepat_range = sources ? 64 * sources : -1;
}
// C worn.c:setworn(). Slot installation with the extrinsic and blocked
// bookkeeping, followed by the shared tail: botl, the inventory redraw and
// the telepathy-range recalculation (cited at their statements below).
export async function setworn(object, mask, state = game) {
    if ((mask & (W_ARM | I_SPECIAL)) === (W_ARM | I_SPECIAL)) {
        // restoring saved game; no properties are conferred via skin
        state.uskin = object;
    }
    else {
        for (const slot of WORN_SLOTS) {
            if ((slot.mask & mask) === 0)
                continue;
            // C follows the read with an impossible() sanity check when
            // oobj lacks the slot bit; the port's impossible() queues
            // urgent message input, and restored or hand-built states
            // legally hold a slot pointer whose presentation flags predate
            // its mask, so the diagnostic is skipped.
            const oobj = wornSlotObject(slot.slot, state);
            if (oobj) {
                if (state.u.twoweap && ((oobj.owornmask ?? 0) & (W_WEP | W_SWAPWEP)))
                    setTwoWeaponCombat(false, state); /* u.twoweap = FALSE */
                oobj.owornmask = (oobj.owornmask ?? 0) & ~slot.mask;
                unmarkWornObject(oobj, slot);
                if ((slot.mask & ~(W_SWAPWEP | W_QUIVER)) !== 0) {
                    // if the hero removed an extrinsic-granting item, nearby
                    // monsters will notice and attempt attacks of that type
                    // again: monstunseesu_prop(p) = monstunseesu(
                    // cvt_prop_to_mseenres(p)).
                    const property = objectPropertyName(oobj.otyp);
                    if (property && slot.propertySlot) {
                        removeWornProperty(property, oobj, slot.propertySlot, state);
                        monstersForgetHeroResistance(seenResistanceForProperty(property), state);
                    }
                    refreshWornBlocks(oobj, mask, state, false);
                    // C calls set_artifact_intrinsic() here for the mask
                    // it is updating; the wielded slot also carries the
                    // talkative SPFX feedback.
                    if (slot.slot === 'uwep')
                        await setWieldedArtifactProperties(oobj, false, state);
                    else if (slot.propertySlot)
                        setWornArtifactProperties(oobj, slot.propertySlot, false, state);
                }
                // in case wearing or removal is in progress or removal is
                // pending (via 'A' command for multiple items)
                if (slot.slot !== 'uball' && slot.slot !== 'uchain')
                    cancelSlotTakeoff(slot.slot, state);
            }
            assignWornSlot(slot, object, state);
            if (object) {
                object.owornmask = (object.owornmask ?? 0) | slot.mask;
                markWornObject(object, slot);
                // Prevent getting/blocking intrinsics from wielding potions,
                // through the quiver, etc.  Allow weapon-tools, too.
                if ((slot.mask & ~(W_SWAPWEP | W_QUIVER)) !== 0) {
                    if (object.oclass === WEAPON_CLASS || isWeaponTool(object) || mask !== W_WEP) {
                        const property = objectPropertyName(object.otyp);
                        if (property && slot.propertySlot)
                            grantWornProperty(property, object, slot.propertySlot, state);
                        refreshWornBlocks(object, mask, state, true);
                    }
                    if (slot.slot === 'uwep')
                        await setWieldedArtifactProperties(object, true, state);
                    else if (slot.propertySlot)
                        setWornArtifactProperties(object, slot.propertySlot, true, state);
                }
            }
        }
        if (object && ((object.owornmask ?? 0) & W_ARMOR) !== 0 && state.u.uroleplay)
            state.u.uroleplay.nudist = false;
        // iflags.tux_penalty (uarm && Role_if(PM_MONK) && u.urole.spelarmr)
        // stays derived live in enlightenment_attributes.ts.
    }
    if ((state.flags.weaponstatus && (mask & W_WEP) !== 0)
        || (state.flags.armorstatus && (mask & W_ARMOR) !== 0))
        state.context.botl = true;
    // update_inventory(): the tty inventory view is rebuilt from state.
    recalculateTelepathyRange(state);
}
// C worn.c:setnotworn(). Called e.g. when obj is destroyed: every slot the
// object still occupies is emptied at once, without arming the "begin
// bashing with your bare hands" notice.
export async function setnotworn(object, state = game) {
    if (!object)
        return;
    let unworn = 0;
    if (state.u.twoweap
        && (object === wornSlotObject('uwep', state) || object === wornSlotObject('uswapwep', state)))
        setTwoWeaponCombat(false, state); /* u.twoweap = FALSE */
    for (const slot of WORN_SLOTS) {
        if (wornSlotObject(slot.slot, state) !== object)
            continue;
        // in case wearing or removal is in progress or removal is pending
        // (via 'A' command for multiple items)
        if (slot.slot !== 'uball' && slot.slot !== 'uchain')
            cancelSlotTakeoff(slot.slot, state);
        assignWornSlot(slot, null, state);
        unworn |= slot.mask;
        const property = objectPropertyName(object.otyp);
        if (property && slot.propertySlot) {
            removeWornProperty(property, object, slot.propertySlot, state);
            monstersForgetHeroResistance(seenResistanceForProperty(property), state);
        }
        object.owornmask = (object.owornmask ?? 0) & ~slot.mask;
        unmarkWornObject(object, slot);
        if (slot.slot === 'uwep')
            await setWieldedArtifactProperties(object, false, state);
        else if (slot.propertySlot)
            setWornArtifactProperties(object, slot.propertySlot, false, state);
        refreshWornBlocks(object, slot.mask, state, false);
    }
    // C clears iflags.tux_penalty when the suit slot is empty; the port
    // derives it live in enlightenment_attributes.ts.
    if ((state.flags.weaponstatus && (unworn & W_WEP) !== 0)
        || (state.flags.armorstatus && (unworn & W_ARMOR) !== 0))
        state.context.botl = true;
    // update_inventory(): the tty inventory view is rebuilt from state.
    recalculateTelepathyRange(state);
}
// C worn.c:mon_set_minvis(). The map refresh and worm-tail reveal that the
// native function performs when visibility flips stay with its callers.
export function setMonsterPermanentInvisibility(monster, permanent = true) {
    const oldPermanent = !!monster.perminvis;
    const oldInvisible = !!monster.minvis;
    monster.perminvis = permanent ? 1 : 0;
    if (!monster.invis_blkd)
        monster.minvis = monster.perminvis;
    return {
        oldPermanent,
        oldInvisible,
        permanent: !!monster.perminvis,
        invisible: !!monster.minvis,
        changed: oldInvisible !== !!monster.minvis,
    };
}
// C worn.c:mon_adjust_speed(). Returns the change so the caller can phrase
// the message for its own subject; monsterSpeedMessage() below is the
// native wording.
export function adjustMonsterSpeed(monster, amount) {
    const oldSpeed = monster.mspeed ?? 0;
    if (amount === 2) {
        monster.permspeed = MFAST;
    }
    else if (amount === 1) {
        monster.permspeed = monster.permspeed === MSLOW ? 0 : MFAST;
    }
    else if (amount === -1) {
        monster.permspeed = monster.permspeed === MFAST ? 0 : MSLOW;
    }
    else if (amount === -2) {
        monster.permspeed = MSLOW;
    }
    else if (amount === -3 || amount === -4) {
        if (monster.permspeed === MFAST)
            monster.permspeed = 0;
    }
    // worn speed boots (objects[otyp].oc_oprop == FAST) keep mspeed fast
    const speedBoots = (monster?.minvent || monster?.inventory || []).some(object => objectPropertyName(object.otyp) === 'fast' && (object.owornmask ?? 0) !== 0);
    monster.mspeed = speedBoots ? MFAST : monster.permspeed ?? 0;
    return {
        amount,
        oldSpeed,
        speed: monster.mspeed,
        changed: monster.mspeed !== oldSpeed,
        much: monster.mspeed + oldSpeed === MFAST + MSLOW,
        canDescribe: naturalMonsterSpeed(monster) !== 0
            && !(monster.mfrozen ?? 0) && !monster.msleeping,
    };
}
export function monsterSpeedMessage(change, subject, state = game) {
    if (state.in_mklev || [2, -2, -4].includes(change.amount)
        || (!change.changed && change.amount !== -3) || !change.canDescribe)
        return null;
    if (change.amount === -3)
        return state.flags.verbose ? `${subject} is slowing down.` : null;
    const much = change.much ? 'much ' : '';
    if (change.amount > 0 || change.speed === MFAST)
        return `${subject} is suddenly moving ${much}faster.`;
    return `${subject} seems to be moving ${much}slower.`;
}
// Properties granted or blocked by monster armor; C flips
// mon->mextrinsics with res_to_mr() bits in update_mon_extrinsics().
const RESISTANCE_BITS = {
    fireResistance: 0x01,
    coldResistance: 0x02,
    sleepResistance: 0x04,
    disintegrationResistance: 0x08,
    shockResistance: 0x10,
    poisonResistance: 0x20,
    acidResistance: 0x40,
    stoneResistance: 0x80,
};
// The altprop() macro: a worn alchemy smock confers poison and acid
// resistance even though objects[] names only one of the two.
function equipmentProperties(object) {
    const primary = objectPropertyName(object.otyp);
    if (!primary)
        return [];
    if (object.otyp !== ALCHEMY_SMOCK)
        return [primary];
    return [primary, primary === 'poisonResistance' ? 'acidResistance' : 'poisonResistance'];
}
// Part of C worn.c:update_mon_extrinsics(): the property loop and mummy-wrapping tail; updateMonsterEquipment() owns the complete operation.
// The `again:` property loop of C worn.c:update_mon_extrinsics() plus its
// w_blocks() mummy-wrapping tail: the part that flips minvis, speed and
// the worn resistance bits.  It stands alone because mon.c:monstone()
// strips a dead monster's item-conferred traits without the
// saddle-dismount and newsym tail C never runs there; updateMonsterEquipment()
// below is the whole C function.
export function applyMonsterEquipmentProperties(monster, object, on) {
    let speed = null;
    for (const property of equipmentProperties(object)) {
        if (property === 'invisible') {
            monster.minvis = on ? !monster.invis_blkd : !!monster.perminvis;
        }
        else if (property === 'fast') {
            speed = adjustMonsterSpeed(monster, 0);
        }
        else {
            const bit = RESISTANCE_BITS[property];
            if (!bit)
                continue;
            if (on) {
                monster.mextrinsics = (monster.mextrinsics || 0) | bit;
            }
            else {
                const anotherSource = (monster.minvent || []).some(other => other !== object && other.owornmask
                    && equipmentProperties(other).includes(property));
                if (!anotherSource)
                    monster.mextrinsics = (monster.mextrinsics || 0) & ~bit;
            }
        }
    }
    if (object.otyp === MUMMY_WRAPPING) {
        monster.invis_blkd = on ? 1 : 0;
        monster.minvis = on ? false : !!monster.perminvis;
    }
    return speed;
}
// C worn.c:update_mon_extrinsics(). Armor put on or taken off; might be
// magical variety.
export async function updateMonsterEquipment(monster, object, on, state = game, { silently = false, publish = plineWithContinuation } = {}) {
    const wasVisible = canSeeMonster(monster);
    const speed = applyMonsterEquipmentProperties(monster, object, on);
    if (!silently && !state.in_mklev && speed?.changed && speed.canDescribe && canSeeMonster(monster)) {
        const message = monsterSpeedMessage(speed, monsterName(monster, { state, capitalized: true }), state);
        if (message) {
            await publish(message);
            learnWand(object, { state });
        }
    }
    if (!on && state.u.usteed === monster && object.otyp === SADDLE)
        await dismountHero(DISMOUNT_FELL, { state, announce: publish });
    if (!silently && wasVisible !== canSeeMonster(monster))
        await newsym(monster.mx, monster.my);
}
// The C cantweararm() macro: breakarm() or sliparm() species cannot keep
// body armor on.
function monsterCanWearSuit(monster) {
    return !monsterSlipsArmor(monster.mnum)
        && !monsterBreaksArmor(monster.mnum);
}
const MZ_SMALL = 1;
const LEATHER = 7;
const SPEED_BOOTS = 166;
const S_MUMMY = MONSTER_SYMBOL[MONSTER_NAME.indexOf('kobold mummy')];
const SLOT_MASK = Object.freeze({
    uamul: W_AMUL,
    uarm: W_ARM,
    uarmc: W_ARMC,
    uarmh: W_ARMH,
    uarms: W_ARMS,
    uarmg: W_ARMG,
    uarmf: W_ARMF,
    uarmu: W_ARMU,
});
// C worn.c:m_dowear(). Wear the best object of each armor type the monster
// carries: everything at once when the monster is created (`creation`),
// otherwise one replacement at a time with wearing delays.  The entry
// restrictions match dowear in do_wear.c plus intelligence; a monster busy
// putting a previous item on (mfrozen) stops the walk for this turn.
export async function initializeMonsterArmor(monster, state = game, { creation = true, publish = plineWithContinuation } = {}) {
    const size = MONSTER_SIZE[monster?.mnum] ?? 0;
    if (size < MZ_SMALL || monsterHasNoHands(monster.mnum)
        || monsterIsAnimal({ mnum: monster?.mnum }))
        return [];
    // Creation is the source exception for skeletons and mummies. Other
    // mindless monsters cannot dress themselves later.
    if (monsterIsMindless(monster?.mnum) && (!creation
        || (MONSTER_SYMBOL[monster.mnum] !== S_MUMMY
            && MONSTER_NAME[monster.mnum] !== 'skeleton')))
        return [];
    monster.misc_worn_check ??= 0;
    // We'll let monsters put on shirts and/or suits under worn cloaks, but
    // not shirts under worn suits.  WrappingAllowed() makes any size
    // between small and huge eligible for the cloak slot.
    const canWearSuit = monsterCanWearSuit(monster);
    const weapon = monster?.mw;
    const slots = ['uamul'];
    if (canWearSuit && !((monster.misc_worn_check ?? 0) & W_ARM))
        slots.push('uarmu');
    if (canWearSuit || monsterWrappingAllowed(monster.mnum))
        slots.push('uarmc');
    slots.push('uarmh');
    if (!weapon || !isBimanualObject(weapon))
        slots.push('uarms');
    slots.push('uarmg');
    if (!monsterIsSlithy(monster.mnum)
        && !monsterIsCentaur(monster.mnum))
        slots.push('uarmf');
    slots.push('uarm');
    const changes = [];
    for (const slot of slots) {
        if ((monster.mfrozen ?? 0) > 0)
            break;
        const change = await wearSlot(monster, slot, creation, state, publish);
        if (change)
            changes.push(change);
    }
    return changes;
}
// C worn.c:m_dowear_type(). Find the best object for one armor type in the
// monster's inventory and put it on, replacing what it wore there.  The
// per-slot gates are m_dowear()'s call-site choices (plus its
// racialexception pass for suits: hobbits may wear elven armor), and the
// per-object filters are the C flag switch.
async function wearSlot(monster, slot, creation, state, publish) {
    if (monster.mfrozen)
        return null;
    // Save the perceived identity before equipment can change visibility,
    // including checks which find nothing to put on.
    const previousName = monsterName(monster, { state, capitalized: !!state.u.seeInvisible });
    const canWearSuit = monsterCanWearSuit(monster);
    if (slot === 'uarm'
        && !(canWearSuit || MONSTER_NAME[monster.mnum] === 'hobbit'))
        return null;
    if (slot === 'uarmu' && !canWearSuit)
        return null;
    if (slot === 'uarmc'
        && !(canWearSuit || monsterWrappingAllowed(monster.mnum)))
        return null;
    if (slot === 'uarmh' && !monsterHasHead({ mnum: monster?.mnum }))
        return null;
    if (slot === 'uarmf' && (monsterIsSlithy(monster.mnum)
        || monsterIsCentaur(monster.mnum)))
        return null;
    // can't put on shirt if already wearing suit
    if (slot === 'uarmu' && ((monster.misc_worn_check ?? 0) & W_ARM))
        return null;
    const mask = SLOT_MASK[slot];
    if (slot === 'uarms' && isBimanualObject(monster.mw))
        return null;
    const old = wornInSlot(monster, mask);
    let best = old;
    if (!old?.cursed) {
        if (slot === 'uamul') {
            // no amulet better than life-saving or reflection: only an
            // amulet of guarding leaves room for improvement
            if (!(old && old.otyp !== AMULET_OF_GUARDING)) {
                for (const object of monster?.minvent || monster?.inventory || []) {
                    if (![AMULET_OF_LIFE_SAVING, AMULET_OF_REFLECTION,
                        AMULET_OF_GUARDING].includes(object?.otyp))
                        continue;
                    if ((object.owornmask ?? 0) && object !== old)
                        continue;
                    if (!best || object.otyp !== AMULET_OF_GUARDING) {
                        best = object;
                        if (best.otyp !== AMULET_OF_GUARDING)
                            break;
                    }
                }
            }
        }
        else {
            for (const object of monster?.minvent || monster?.inventory || []) {
                if (armorSlotFor(object?.otyp) !== slot)
                    continue;
                if ((object.owornmask ?? 0) && object !== old)
                    continue;
                if (slot === 'uarmc') {
                    const size = MONSTER_SIZE[monster.mnum];
                    if (size !== undefined && size > 2 && object.otyp !== MUMMY_WRAPPING)
                        continue;
                    if (object.otyp === MUMMY_WRAPPING && monster.minvis
                        && !state.u.seeInvisible && !creation)
                        continue;
                }
                if (slot === 'uarmh') {
                    if (object.otyp === HELM_OF_OPPOSITE_ALIGNMENT
                        && (monster.ispriest || monster.isminion))
                        continue;
                    const material = objectMaterial(object.otyp);
                    if (monsterHornCount(monster.mnum) && material !== undefined && material > LEATHER)
                        continue;
                }
                if (slot === 'uarm' && !canWearSuit
                    && object.otyp !== ELVEN_MITHRIL_COAT)
                    continue;
                if (best && preference(monster, best) >= preference(monster, object))
                    continue;
                best = object;
            }
        }
    }
    if (!best || best === old)
        return null;
    const wasVisible = canSeeMonster(monster);
    const sawSquare = cansee(monster.mx, monster.my);
    const oldShining = old?.lamplit && artifactEmitsLight(old);
    const autocurse = !best.cursed
        && [DUNCE_CAP, HELM_OF_OPPOSITE_ALIGNMENT].includes(best.otyp);
    let delay = 0;
    if ((slot === 'uarm' || slot === 'uarmu')
        && ((monster.misc_worn_check ?? 0) & W_ARMC))
        delay += 2;
    if (old) {
        delay += objectDelay(old.otyp);
        old.owornmask = 0;
        old.worn = false;
    }
    if (!creation) {
        if (wasVisible) {
            if (old)
                observeDistantObjectForNaming(old, state);
            observeDistantObjectForNaming(best, state);
            const oldName = old ? await inventoryItemDescription(old) : '';
            let newName = await inventoryItemDescription(best);
            if (newName.toLowerCase() === oldName.toLowerCase())
                newName = newName.replace(/^an? /i, 'another ');
            const subject = monsterName(monster, { state, capitalized: true });
            await publish(`${subject}${old ? ` removes ${oldName} and` : ''} puts on ${newName}.`);
            if (autocurse) {
                // C worn.c:952: s_suffix(Monnam), simpleonames(), otense("glow").
                const owner = possessiveName(monsterName(monster, { state, capitalized: true }));
                const glow = objectNameIsPlural(best, state) ? 'glow' : verbForSubject(null, 'glow');
                await publish(`${owner} ${simpleObjectName(best, state)} ${glow} ${displayColorName('black', state)} for a moment.`);
            }
        }
        delay += objectDelay(best.otyp);
        monster.mfrozen = delay;
        if (delay)
            monster.mcanmove = 0;
    }
    if (old) {
        await updateMonsterEquipment(monster, old, false, state, { silently: creation, publish });
        if (oldShining)
            endObjectBurn(old, state);
    }
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | mask;
    best.owornmask = (best.owornmask ?? 0) | mask;
    best.worn = true;
    if (autocurse) {
        best.blessed = false;
        best.cursed = true;
    }
    if (artifactEmitsLight(best) && !best.lamplit) {
        beginObjectBurn(best, state);
        await vision_recalc(1);
        if (!creation && best.lamplit && cansee(monster.mx, monster.my)) {
            const visibleNow = canSeeMonster(monster);
            const named = wasVisible || visibleNow;
            const plural = named && objectNameIsPlural(best, state);
            const name = named
                ? ownedObjectName(best, state) : 'Something';
            const startsShining = wasVisible || (!visibleNow && sawSquare);
            const verb = startsShining ? (plural ? 'begin to shine' : 'begins to shine')
                : (plural ? 'are shining' : 'is shining');
            await publish(`${name} ${verb} ${equipmentLightDescription(best, state)}.`);
        }
    }
    await updateMonsterEquipment(monster, best, true, state, { silently: creation, publish });
    if (!creation && wasVisible && !canSeeMonster(monster)
        && monster.minvis && !state.u.seeInvisible) {
        await publish(`Suddenly you cannot see ${previousName}.`);
        learnObjectType(best.otyp, state);
    }
    return { slot, mask, old, best, delay };
}
// C worn.c:which_armor().
export function wornInSlot(monster, mask) {
    return (monster?.minvent || monster?.inventory || [])
        .find(object => ((object.owornmask ?? 0) & mask) !== 0) || null;
}
// C worn.c:m_lose_armor(): no floor effects or stacking.
async function dropMonsterArmor(monster, object, state = game, options = {}) {
    if (!await removeObjectFromMonsterInventory(monster, object, state, options))
        return null;
    // Monster inventory releases also run during hero actions (polymorph
    // from a hero zap, kill cascades), so placement is always awaited.
    return placeObject(object, monster.mx, monster.my, state);
}
const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');
// C worn.c:clear_bypass().
function clearChain(objects) {
    for (const object of objects ?? []) {
        object.bypass = false;
        clearChain(object.contents);
    }
}
// C worn.c:clear_bypasses().
export function clearBypasses(state = game) {
    for (const column of state.level?.objects ?? [])
        for (const pile of column ?? [])
            clearChain(pile);
    clearChain(state.inventory);
    clearChain(state.migratingObjects);
    clearChain(state.level?.buriedObjects);
    clearChain(state.billObjects);
    for (const monster of state.level?.monsters ?? []) {
        if (monster.dead || monster.mhp <= 0)
            continue;
        clearChain(monster.minvent ?? monster.inventory);
        if (monster.mnum !== PM_LONG_WORM)
            continue;
        if (monster.mcorpsenm !== undefined)
            monster.mcorpsenm = NON_PM;
        if (monster.mextra?.mcorpsenm !== undefined)
            monster.mextra.mcorpsenm = NON_PM;
    }
    for (const monster of state._migratingMonsters ?? [])
        clearChain(monster.minvent ?? monster.inventory);
    // A swallowed hero's ball and chain can be outside every object chain.
    if (state.uball)
        state.uball.bypass = false;
    if (state.uchain)
        state.uchain.bypass = false;
    state.context.bypasses = false;
}
// C worn.c:bypass_obj().
export function bypassObject(object, state = game) {
    object.bypass = true;
    state.context.bypasses = true;
}
// C worn.c:bypass_objlist().
export function bypassObjectList(objects, on, state = game) {
    if (on && objects.length)
        state.context.bypasses = true;
    for (const object of objects)
        object.bypass = on;
}
// C worn.c:nxt_unbypassed_obj()
// Pass the current chain each time: an action may remove or add objects.
// A sorted traversal also supplies its original order; stale entries are skipped.
// Also C worn.c:nxt_unbypassed_loot(): the sorted traversal skips stale entries inline.
export function nextUnbypassedObject(objects, state = game, order = objects) {
    for (const object of order) {
        if (object.bypass || !objects.includes(object))
            continue;
        bypassObject(object, state);
        return object;
    }
    return null;
}
// C worn.c:mon_break_armor(). A polymorph or growth that no longer fits the
// monster's worn armor: breakarm() species destroy it, sliparm() species
// drop it, and handless, tiny, horned and legless forms shed gloves,
// shields, helmets, boots and the saddle.
export async function adjustMonsterClothingAfterPolymorph(monster, state = game, { publish = plineWithContinuation, polyspot = false } = {}) {
    const dropped = [];
    const destroyed = [];
    const mnum = monster.mnum;
    // mon_break_armor chooses both perceived pronouns before any clothing
    // changes visibility. Hallucination chooses each one independently.
    const pronoun = monsterObjectPronoun(monster, { state });
    const owner = monsterPossessive(monster, { state });
    const wrappingFits = monsterWrappingAllowed(mnum);
    const visible = cansee(monster.mx, monster.my);
    const name = () => monsterName(monster, { state, capitalized: true });
    const possessive = () => possessiveName(name());
    // C cloak_simple_name(): robe, wrapping, smock/apron, or cloak.
    const cloakName = (object) => armorSimpleName(object, state);
    // Not a port of the do.c drop command: this removes a monster's worn
    // armor for the worn.c m_lose_armor() callers.
    const dropWornArmor = async (object) => {
        if (!object)
            return;
        const placed = await dropMonsterArmor(monster, object, state, { publish });
        if (!placed)
            return;
        if (polyspot) {
            bypassObject(placed, state);
        }
        dropped.push(placed);
        await newsym(monster.mx, monster.my);
    };
    const destroy = async (object) => {
        if (object && await destroyObjectFromMonsterInventory(monster, object, state, { publish }))
            destroyed.push(object);
    };
    const hear = async (sound) => {
        await publishHeardMessage(`${sound}.`, publish, state);
    };
    let object;
    if (monsterBreaksArmor(mnum)) {
        if ((object = wornInSlot(monster, W_ARM))) {
            if (dragonFormForArmor(object) !== mnum) {
                if (visible)
                    await publish(`${name()} breaks out of ${owner} armor!`);
                else
                    await hear('a cracking sound');
            }
            await destroy(object);
        }
        const cloak = wornInSlot(monster, W_ARMC);
        if (cloak && (cloak.otyp !== MUMMY_WRAPPING || !wrappingFits)) {
            if (cloak.oartifact) {
                if (visible)
                    await publish(`${possessive()} ${cloakName(cloak)} falls off!`);
                await dropWornArmor(cloak);
            }
            else {
                if (visible)
                    await publish(`${possessive()} ${cloakName(cloak)} tears apart!`);
                else
                    await hear('a ripping sound');
                await destroy(cloak);
            }
        }
        if ((object = wornInSlot(monster, W_ARMU))) {
            if (visible)
                await publish(`${possessive()} shirt rips to shreds!`);
            else
                await hear('a ripping sound');
            await destroy(object);
        }
    }
    else if (monsterSlipsArmor(mnum)) {
        if ((object = wornInSlot(monster, W_ARM))) {
            if (visible)
                await publish(`${possessive()} armor falls around ${pronoun}!`);
            else
                await hear('a thud');
            await dropWornArmor(object);
        }
        const cloak = wornInSlot(monster, W_ARMC);
        if (cloak && (cloak.otyp !== MUMMY_WRAPPING || !wrappingFits)) {
            if (visible)
                await publish(monsterIsWhirly(monster)
                    ? `${possessive()} ${cloakName(cloak)} falls, unsupported!`
                    : `${name()} shrinks out of ${owner} ${cloakName(cloak)}!`);
            await dropWornArmor(cloak);
        }
        if ((object = wornInSlot(monster, W_ARMU))) {
            if (visible)
                await publish((MONSTER_SIZE[mnum] ?? 0) > MZ_SMALL
                    ? `${name()} seeps right through ${owner} shirt!`
                    : `${name()} becomes much too small for ${owner} shirt!`);
            await dropWornArmor(object);
        }
    }
    const handlessOrTiny = monsterHasNoHands(mnum)
        || monsterIsVerySmall(mnum);
    if (handlessOrTiny) {
        if ((object = wornInSlot(monster, W_ARMG))) {
            if (visible)
                await publish(`${name()} drops ${owner} gloves${monster.mw ? ' and weapon' : ''}!`);
            await dropWornArmor(object);
        }
        if ((object = wornInSlot(monster, W_ARMS))) {
            if (visible)
                await publish(`${name()} can no longer hold ${owner} shield!`);
            else
                await hear('a clank');
            await dropWornArmor(object);
        }
    }
    const helmet = wornInSlot(monster, W_ARMH);
    const helmetIsFlimsy = helmet
        && objectMaterial(helmet.otyp) <= LEATHER;
    if (helmet && (handlessOrTiny
        || (monsterHornCount(mnum) && !helmetIsFlimsy))) {
        if (visible)
            await publish(`${possessive()} helmet falls to the ${surfaceName(monster.mx, monster.my, state)}!`);
        else
            await hear('a clank');
        await dropWornArmor(helmet);
    }
    if ((handlessOrTiny || monsterIsSlithy(mnum) || monsterIsCentaur(mnum))
        && (object = wornInSlot(monster, W_ARMF))) {
        if (visible)
            await publish(monsterIsWhirly(monster)
                ? `${possessive()} boots fall away!`
                : `${possessive()} boots ${monsterIsVerySmall(mnum) ? 'slide' : 'are pushed'} off ${owner} feet!`);
        await dropWornArmor(object);
    }
    if (!monsterCanBeSaddled(monster)) {
        if ((object = wornInSlot(monster, W_SADDLE))) {
            await dropWornArmor(object);
            if (visible)
                await publish(`${possessive()} saddle falls off.`);
        }
    }
    if (state.u.usteed === monster
        && (!monsterCanBeSaddled(monster) || !heroCanRideSteed(monster, state))) {
        await publish(`You can no longer ride ${monsterName(monster, { state })}.`);
        if (touchPetrifies(mnum) && !state.u.stoneResistance && rnl(3)) {
            await publish(`You touch ${monsterName(monster, { state })}.`);
            await resolveImmediatePetrification({ state, publish,
                killer: `falling off a ${monsterTypeName(mnum, !!monster.female)}` });
        }
        await dismountHero(DISMOUNT_FELL, { state, announce: publish });
    }
    return { dropped, destroyed };
}
// Part of C worn.c:m_dowear_type(): the armor score combining ARM_BONUS with extra_pref().
// Bias a monster's preferences towards armor that has special benefits.
// C worn.c:extra_pref().
function preference(monster, object) {
    return armorBonus(object)
        + Number(object?.otyp === SPEED_BOOTS && monster?.permspeed !== 2) * 20;
}
// C worn.c:extract_from_minvent(). Remove an object from a monster's
// inventory; it leaves worn state, extrinsics and weapon bookkeeping behind.
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
        // give the monster a chance to wear other equipment on its next
        // move instead of waiting until it picks something up
        // (mon.c check_gear_next_turn()).
        monster.misc_worn_check |= I_SPECIAL;
    }
    if (monster.saddle === object || (worn & W_SADDLE)) {
        monster.saddle = null;
        monster.saddled = false;
    }
    // C worn.c:1413 obj_no_longer_held(): the release runs after the equipment
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
// extract_from_minvent() followed by obfree(): m_useup() and
// discard_minvent() destroy a monster's worn or carried object this way.
export async function destroyObjectFromMonsterInventory(monster, object, state = game, options = {}) {
    if (!await removeObjectFromMonsterInventory(monster, object, state, options))
        return false;
    return await deleteObject(object, state);
}
// C worn.c:find_mac()
// trap.c wearing_iron_shoes() tests the boots' material, so iron kicking
// boots protect as well as iron shoes do.
// C ref: worn.c:find_mac().  Species AC is the base; only inventory objects
// whose worn bit is present in misc_worn_check contribute protection.
export function findMonsterArmorClass(monster) {
    if (!monster)
        return 10;
    const species = MONSTER_EXPERIENCE_META[monster.mnum];
    if (!species)
        throw new Error(`Monster ${monster.m_id} has no armor class for species ${monster.mnum}`);
    let armorClass = species[0];
    const wornMask = monster.misc_worn_check ?? 0;
    for (const object of monster.minvent || monster.inventory || []) {
        if (!((object.owornmask ?? 0) & wornMask))
            continue;
        armorClass -= object.otyp === AMULET_OF_GUARDING
            ? 2 : armorBonus(object);
    }
    return Math.max(-AC_MAX, Math.min(AC_MAX, armorClass));
}
//# sourceMappingURL=worn.js.map