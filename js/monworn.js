// Monster armor.
// C refs: makemon.c:makemon(), mon.c:check_gear_next_turn() and
// movemon_singlemon(), worn.c:m_dowear()/m_dowear_type().
import { armorBonus, armorSlotFor, dragonFormForArmor } from './armor.js';
import { observeDistantObjectForNaming, } from './objnam.js';
import { canSeeMonster, displayColorName, newsym, plineWithContinuation } from './display.js';
import { inventoryItemDescription } from './invent.js';
import { updateMonsterEquipment } from './monster_equipment.js';
import { learnObjectType } from './object_knowledge.js';
import { artifactEmitsLight } from './artifacts.js';
import { beginObjectBurn, endObjectBurn, equipmentLightDescription } from './light.js';
import { cansee, vision_recalc } from './vision.js';
import { heroIsDeaf } from './senses.js';
import { surfaceName } from './terrain_name.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { monsterName } from './monster_name.js';
import { dismountHero, heroCanRideSteed } from './steed.js';
import { resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { rnl } from './rng.js';
import { game } from './gstate.js';
import { MONSTER_EXPERIENCE_META, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_SIZE, MONSTER_NAME, MONSTER_SYMBOL, monsterBreaksArmor, monsterCanBeSaddled, monsterHasNoHands, monsterIsCentaur, monsterIsWhirly, monsterTypeName, monsterHornCount, monsterIsSlithy, monsterIsVerySmall, monsterSlipsArmor, monsterWrappingAllowed, } from './monster_data.js';
import { destroyObjectFromMonsterInventory, dropMonsterArmor, } from './monster_inventory.js';
import { AMULET_OF_GUARDING, AMULET_OF_LIFE_SAVING, AMULET_OF_REFLECTION, ALCHEMY_SMOCK, DUNCE_CAP, ELVEN_MITHRIL_COAT, HELM_OF_OPPOSITE_ALIGNMENT, GOLD_DRAGON_SCALES, IRON_SHOES, MUMMY_WRAPPING, ROBE, OBJECT_BIMANUAL, OBJECT_DELAY, OBJECT_MATERIAL, OBJECT_NAMES, } from './object_data.js';
import { AC_MAX, DISMOUNT_FELL, I_SPECIAL, W_AMUL, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_SADDLE, } from './const.js';
const M1_NOHEAD = 0x00008000;
const M1_MINDLESS = 0x00010000;
const M1_ANIMAL = 0x00040000;
const M2_NEUTER = 0x00040000;
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
// worn.c:m_dowear() visits these slots in this order.  A non-creation wear
// can freeze the monster, causing every later slot in the same pass to stop.
const WEAR_ORDER = Object.freeze([
    'uamul', 'uarmu', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarm',
]);
function monsterCanDress(monster, creation) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const size = MONSTER_SIZE[monster?.mnum] ?? 0;
    if (size < MZ_SMALL || monsterHasNoHands(monster.mnum)
        || (flags & M1_ANIMAL))
        return false;
    // Creation is the source exception for skeletons and mummies. Other
    // mindless monsters cannot dress themselves later.
    if ((flags & M1_MINDLESS) && (!creation
        || (MONSTER_SYMBOL[monster.mnum] !== S_MUMMY
            && MONSTER_NAME[monster.mnum] !== 'skeleton')))
        return false;
    return true;
}
function monsterCanWearSuit(monster) {
    return !monsterSlipsArmor(monster.mnum)
        && !monsterBreaksArmor(monster.mnum);
}
function monsterCreationWearSlots(monster) {
    if (!monsterCanDress(monster, true))
        return [];
    const canWearSuit = monsterCanWearSuit(monster);
    const weapon = monster?.mw;
    const slots = ['uamul'];
    if (canWearSuit && !((monster.misc_worn_check ?? 0) & W_ARM))
        slots.push('uarmu');
    if (canWearSuit || monsterWrappingAllowed(monster.mnum))
        slots.push('uarmc');
    slots.push('uarmh');
    if (!weapon || !OBJECT_BIMANUAL[weapon.otyp])
        slots.push('uarms');
    slots.push('uarmg');
    if (!monsterIsSlithy(monster.mnum)
        && !monsterIsCentaur(monster.mnum))
        slots.push('uarmf');
    slots.push('uarm');
    return slots;
}
function slotAllowed(monster, slot) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (slot === 'uamul')
        return true;
    if (slot === 'uarm')
        return monsterCanWearSuit(monster) || MONSTER_NAME[monster.mnum] === 'hobbit';
    if (slot === 'uarmu')
        return monsterCanWearSuit(monster);
    if (slot === 'uarmc')
        return monsterCanWearSuit(monster) || monsterWrappingAllowed(monster.mnum);
    if (slot === 'uarmh')
        return !(flags & M1_NOHEAD);
    if (slot === 'uarmf')
        return !monsterIsSlithy(monster.mnum)
            && !monsterIsCentaur(monster.mnum);
    return true;
}
function preference(monster, object) {
    return armorBonus(object)
        + Number(object?.otyp === SPEED_BOOTS && monster?.permspeed !== 2) * 20;
}
function wornInSlot(monster, mask) {
    return (monster?.minvent || monster?.inventory || [])
        .find(object => ((object.owornmask ?? 0) & mask) !== 0) || null;
}
export function monsterWearsIronShoes(monster) {
    return wornInSlot(monster, W_ARMF)?.otyp === IRON_SHOES;
}
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
function bestForSlot(monster, slot, creation, state) {
    const mask = SLOT_MASK[slot];
    const old = wornInSlot(monster, mask);
    if (old?.cursed)
        return { old, best: old };
    if (slot === 'uamul') {
        if (old && old.otyp !== AMULET_OF_GUARDING)
            return { old, best: old };
        let best = old;
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
        return { old, best };
    }
    let best = old;
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
            const material = OBJECT_MATERIAL[object.otyp];
            if (monsterHornCount(monster.mnum) && material !== undefined && material > LEATHER)
                continue;
        }
        if (slot === 'uarm' && !monsterCanWearSuit(monster)
            && object.otyp !== ELVEN_MITHRIL_COAT)
            continue;
        if (best && preference(monster, best) >= preference(monster, object))
            continue;
        best = object;
    }
    return { old, best };
}
async function wearSlot(monster, slot, creation, state, publish) {
    if (monster.mfrozen)
        return null;
    // m_dowear_type() saves a name before checking the slot, even when
    // creation suppresses dressing messages. Hallucination advances here.
    if (creation)
        monsterName(monster, { state });
    if (!slotAllowed(monster, slot))
        return null;
    if (slot === 'uarmu' && ((monster.misc_worn_check ?? 0) & W_ARM))
        return null;
    const mask = SLOT_MASK[slot];
    if (slot === 'uarms' && monster.mw && OBJECT_BIMANUAL[monster.mw.otyp])
        return null;
    const { old, best } = bestForSlot(monster, slot, creation, state);
    if (!best || best === old)
        return null;
    const wasVisible = canSeeMonster(monster);
    const sawSquare = cansee(monster.mx, monster.my);
    const subject = monsterSentenceSubject(monster);
    const oldShining = old?.lamplit && artifactEmitsLight(old);
    const autocurse = !best.cursed
        && [DUNCE_CAP, HELM_OF_OPPOSITE_ALIGNMENT].includes(best.otyp);
    let delay = 0;
    if ((slot === 'uarm' || slot === 'uarmu')
        && ((monster.misc_worn_check ?? 0) & W_ARMC))
        delay += 2;
    if (old) {
        delay += OBJECT_DELAY[old.otyp] ?? 0;
        old.owornmask = 0;
        old.worn = false;
    }
    if (!creation) {
        if (wasVisible) {
            if (old)
                observeDistantObjectForNaming(old, state);
            observeDistantObjectForNaming(best, state);
            const oldName = old ? inventoryItemDescription(old) : '';
            let newName = inventoryItemDescription(best);
            if (newName.toLowerCase() === oldName.toLowerCase())
                newName = newName.replace(/^an? /i, 'another ');
            await publish(`${subject}${old ? ` removes ${oldName} and` : ''} puts on ${newName}.`);
            if (autocurse)
                await publish(`${subject}'s ${best.name} glows ${displayColorName('black', state)} for a moment.`);
        }
        delay += OBJECT_DELAY[best.otyp] ?? 0;
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
        vision_recalc(1);
        if (!creation && best.lamplit && cansee(monster.mx, monster.my)) {
            const visibleNow = canSeeMonster(monster);
            const named = wasVisible || visibleNow;
            const plural = named && best.otyp === GOLD_DRAGON_SCALES;
            const name = named
                ? `The ${OBJECT_NAMES[best.otyp]}` : 'Something';
            const startsShining = wasVisible || (!visibleNow && sawSquare);
            const verb = startsShining ? (plural ? 'begin to shine' : 'begins to shine')
                : (plural ? 'are shining' : 'is shining');
            await publish(`${name} ${verb} ${equipmentLightDescription(best, state)}.`);
        }
    }
    await updateMonsterEquipment(monster, best, true, state, { silently: creation, publish });
    if (!creation && wasVisible && !canSeeMonster(monster)
        && monster.minvis && !state.u.seeInvisible) {
        await publish(`Suddenly you cannot see ${subject.replace(/^The /, 'the ')}.`);
        learnObjectType(best.otyp, state);
    }
    return { slot, mask, old, best, delay };
}
export async function initializeMonsterArmor(monster, state = game) {
    if (!monsterCanDress(monster, true))
        return [];
    monster.misc_worn_check ??= 0;
    const changes = [];
    for (const slot of monsterCreationWearSlots(monster)) {
        const change = await wearSlot(monster, slot, true, state, plineWithContinuation);
        if (change)
            changes.push(change);
    }
    return changes;
}
export async function adjustMonsterClothingAfterPolymorph(monster, state = game, { publish = plineWithContinuation, polyspot = false } = {}) {
    const dropped = [];
    const destroyed = [];
    const mnum = monster.mnum;
    const wrappingFits = monsterWrappingAllowed(mnum);
    const visible = cansee(monster.mx, monster.my);
    const name = () => monsterSentenceSubject(monster);
    const possessive = () => {
        const subject = name();
        return `${subject}${subject.endsWith('s') ? "'" : "'s"}`;
    };
    const neuter = !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_NEUTER);
    const pronoun = neuter ? 'it' : monster.female ? 'her' : 'him';
    const owner = neuter ? 'its' : monster.female ? 'her' : 'his';
    const cloakName = (object) => object.otyp === ROBE ? 'robe'
        : object.otyp === MUMMY_WRAPPING ? 'mummy wrapping'
            : object.otyp === ALCHEMY_SMOCK ? 'apron' : 'cloak';
    const drop = async (object) => {
        if (!object)
            return;
        const placed = await dropMonsterArmor(monster, object, state, { publish });
        if (!placed)
            return;
        if (polyspot) {
            placed.bypass = true;
            state.context.bypasses = true;
        }
        dropped.push(placed);
        newsym(monster.mx, monster.my);
    };
    const destroy = async (object) => {
        if (object && await destroyObjectFromMonsterInventory(monster, object, state, { publish }))
            destroyed.push(object);
    };
    const hear = async (sound) => {
        if (!heroIsDeaf(state))
            await publish(`You hear ${sound}.`);
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
                await drop(cloak);
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
            await drop(object);
        }
        const cloak = wornInSlot(monster, W_ARMC);
        if (cloak && (cloak.otyp !== MUMMY_WRAPPING || !wrappingFits)) {
            if (visible)
                await publish(monsterIsWhirly(monster)
                    ? `${possessive()} ${cloakName(cloak)} falls, unsupported!`
                    : `${name()} shrinks out of ${owner} ${cloakName(cloak)}!`);
            await drop(cloak);
        }
        if ((object = wornInSlot(monster, W_ARMU))) {
            if (visible)
                await publish((MONSTER_SIZE[mnum] ?? 0) > MZ_SMALL
                    ? `${name()} seeps right through ${owner} shirt!`
                    : `${name()} becomes much too small for ${owner} shirt!`);
            await drop(object);
        }
    }
    const handlessOrTiny = monsterHasNoHands(mnum)
        || monsterIsVerySmall(mnum);
    if (handlessOrTiny) {
        if ((object = wornInSlot(monster, W_ARMG))) {
            if (visible)
                await publish(`${name()} drops ${owner} gloves${monster.mw ? ' and weapon' : ''}!`);
            await drop(object);
        }
        if ((object = wornInSlot(monster, W_ARMS))) {
            if (visible)
                await publish(`${name()} can no longer hold ${owner} shield!`);
            else
                await hear('a clank');
            await drop(object);
        }
    }
    const helmet = wornInSlot(monster, W_ARMH);
    const helmetIsFlimsy = helmet
        && (OBJECT_MATERIAL[helmet.otyp] ?? Infinity) <= LEATHER;
    if (helmet && (handlessOrTiny
        || (monsterHornCount(mnum) && !helmetIsFlimsy))) {
        if (visible)
            await publish(`${possessive()} helmet falls to the ${surfaceName(monster.mx, monster.my, state)}!`);
        else
            await hear('a clank');
        await drop(helmet);
    }
    if ((handlessOrTiny || monsterIsSlithy(mnum) || monsterIsCentaur(mnum))
        && (object = wornInSlot(monster, W_ARMF))) {
        if (visible)
            await publish(monsterIsWhirly(monster)
                ? `${possessive()} boots fall away!`
                : `${possessive()} boots ${monsterIsVerySmall(mnum) ? 'slide' : 'are pushed'} off ${owner} feet!`);
        await drop(object);
    }
    if (!monsterCanBeSaddled(monster)) {
        if ((object = wornInSlot(monster, W_SADDLE))) {
            await drop(object);
            if (visible)
                await publish(`${possessive()} saddle falls off.`);
        }
    }
    if (state.u.usteed === monster
        && (!monsterCanBeSaddled(monster) || !heroCanRideSteed(monster, state))) {
        const steed = name();
        await publish(`You can no longer ride ${steed.charAt(0).toLowerCase()}${steed.slice(1)}.`);
        if (touchPetrifies(mnum) && !state.u.stoneResistance && rnl(3)) {
            await publish(`You touch ${steed.charAt(0).toLowerCase()}${steed.slice(1)}.`);
            await resolveImmediatePetrification({ state, publish,
                killer: `falling off a ${monsterTypeName(mnum, !!monster.female)}` });
        }
        await dismountHero(DISMOUNT_FELL, { state, announce: publish });
    }
    return { dropped, destroyed };
}
export function checkMonsterGearNextTurn(monster) {
    if (!monster)
        return;
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | I_SPECIAL;
}
// Hostile monsters wait to change armor while they believe the hero is close.
// `consumed` says whether dressing used this turn.
export async function reassessMonsterArmor(monster, state = game, { publish = plineWithContinuation, } = {}) {
    if (!monster || !((monster.misc_worn_check ?? 0) & I_SPECIAL))
        return null;
    const apparentX = typeof monster.mux === 'number' && Number.isFinite(monster.mux) ? monster.mux : 0;
    const apparentY = typeof monster.muy === 'number' && Number.isFinite(monster.muy) ? monster.muy : 0;
    const dx = (monster.mx ?? 0) - apparentX;
    const dy = (monster.my ?? 0) - apparentY;
    if (!monster.mpeaceful && !monster.mtame && !monster.pet
        && dx * dx + dy * dy <= 9)
        return null;
    const oldMask = (monster.misc_worn_check ?? 0) & ~I_SPECIAL;
    monster.misc_worn_check = oldMask;
    let change = null;
    if (monsterCanDress(monster, false)) {
        for (const slot of WEAR_ORDER) {
            if ((monster.mfrozen ?? 0) > 0)
                break;
            const candidate = await wearSlot(monster, slot, false, state, publish);
            if (candidate && !change)
                change = candidate;
        }
    }
    return {
        change,
        oldMask,
        newMask: monster.misc_worn_check ?? 0,
        consumed: (monster.misc_worn_check ?? 0) !== oldMask
            || monster.mcanmove === 0,
    };
}
//# sourceMappingURL=monworn.js.map