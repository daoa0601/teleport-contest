// C worn.c:mon_set_minvis() and mon_adjust_speed(). Permanent monster
// invisibility and speed changes.
import { WEAPON_CLASS } from './objclass.js';
import { MFAST, MSLOW, NON_PM } from './const.js';
import { game } from './gstate.js';
import { MONSTER_MOVE, MONSTER_NAME } from './monster_data.js';
import { objectPropertyName } from './object_data.js';
import { naturalMonsterSpeed } from './mon.js';
import { artifactById } from './artifact.js';
import { see_monsters } from './display.js';
import { grantWornProperty, hasCarriedProperty, refreshProperty, removeWornProperty, setCarriedProperty, } from './properties.js';
import { seenResistanceForProperty, monstersForgetHeroResistance } from './mondata.js';
import { cancelSlotTakeoff } from './do_wear.js';
import { setTwoWeaponCombat } from './wield.js';
import { setWieldedArtifactProperties, setWornArtifactProperties } from './artifact.js';
import { CORNUTHAUM, MUMMY_WRAPPING } from './object_data.js';
import { isWeaponTool } from './object_properties.js';
import { I_SPECIAL, W_AMUL, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_ARMOR, W_BALL, W_CHAIN, W_QUIVER, W_RINGL, W_RINGR, W_SWAPWEP, W_TOOL, W_WEP, } from './const.js';
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
function wearsSpeedItem(monster) {
    return (monster?.minvent || monster?.inventory || []).some(object => objectPropertyName(object.otyp) === 'fast' && (object.owornmask ?? 0) !== 0);
}
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
    monster.mspeed = wearsSpeedItem(monster)
        ? MFAST : monster.permspeed ?? 0;
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
// worn.c counts all ordinary worn TELEPAT objects, plus one source for
// every carried ESP artifact together, regardless of their number.
// C worn.c:recalc_telepat_range().
export function recalculateTelepathyRange(state) {
    const worn = [state.uarm, state.uarmc, state.uarmh, state.uarms,
        state.uarmg, state.uarmf, state.uarmu, state.uamul, state.uleft,
        state.uright, state.ublindf, state.uwep, state.uswapwep, state.uquiver];
    const ordinary = worn.filter(object => object && object.owornmask
        && objectPropertyName(object.otyp) === 'telepathy').length;
    const sources = ordinary + Number(hasCarriedProperty('telepathy', null, state));
    state.u.unblind_telepat_range = sources ? 64 * sources : -1;
}
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
                    // again: monstunseesu_prop(p) = monstunseu(
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
// C worn.c:bypass_obj(), bypass_objlist(), nxt_unbypassed_obj/loot(),
// clear_bypasses(). Marks are shared by inventory traversal and magic.
const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');
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
// Pass the current chain each time: an action may remove or add objects.
// A sorted traversal also supplies its original order; stale entries are skipped.
// C worn.c:nxt_unbypassed_obj().
export function nextUnbypassedObject(objects, state = game, order = objects) {
    for (const object of order) {
        if (object.bypass || !objects.includes(object))
            continue;
        bypassObject(object, state);
        return object;
    }
    return null;
}
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
// C worn.c:clear_bypass().
function clearChain(objects) {
    for (const object of objects ?? []) {
        object.bypass = false;
        clearChain(object.contents);
    }
}
//# sourceMappingURL=worn.js.map