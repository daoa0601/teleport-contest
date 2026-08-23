// monworn.js — monster armor ownership and deferred dressing transactions.
// C refs: makemon.c:makemon(), mon.c:check_gear_next_turn() and
// movemon_singlemon(), worn.c:m_dowear()/m_dowear_type().

import { armorBonus, armorSlotFor } from './armor.js';
import {
    MONSTER_EXPERIENCE_META, MONSTER_FLAGS1, MONSTER_SIZE, MONSTER_SYMBOL,
} from './monster_data.js';
import {
    AMULET_OF_GUARDING, OBJECT_BIMANUAL, OBJECT_DELAY,
} from './object_data.js';
import {
    AC_MAX, I_SPECIAL, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS,
    W_ARMU,
} from './const.js';

const M1_NOHANDS = 0x00002000;
const M1_NOHEAD = 0x00008000;
const M1_MINDLESS = 0x00010000;
const M1_HUMANOID = 0x00020000;
const M1_ANIMAL = 0x00040000;
const M1_SLITHY = 0x00080000;
const MZ_SMALL = 1;
const MZ_LARGE = 3;
const MZ_HUGE = 4;
const S_CENTAUR = 29;
const S_GHOST = 54;
const SPEED_BOOTS = 166;
const PM_WINGED_GARGOYLE = 42;
const PM_MARILITH = 295;

const SLOT_MASK = Object.freeze({
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
    'uarmu', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarm',
]);

function monsterCanDress(monster, creation) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const size = MONSTER_SIZE[monster?.mnum] ?? 0;
    if (size < MZ_SMALL || (flags & (M1_NOHANDS | M1_ANIMAL))) return false;
    // Creation is the one source exception for skeletons and mummies.  They
    // currently have no witnessed generated armor in the JS graph; retain the
    // exception without letting other mindless monsters dress later.
    if ((flags & M1_MINDLESS) && !creation) return false;
    return true;
}

function monsterCanWearSuit(monster) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const size = MONSTER_SIZE[monster?.mnum] ?? 0;
    return size > MZ_SMALL && size < MZ_LARGE
        && !!(flags & M1_HUMANOID)
        && monster.mnum !== PM_MARILITH
        && monster.mnum !== PM_WINGED_GARGOYLE;
}

function monsterWrappingAllowed(monster) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const size = MONSTER_SIZE[monster?.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster?.mnum];
    return !!(flags & M1_HUMANOID)
        && size >= MZ_SMALL && size <= MZ_HUGE
        && symbol !== S_GHOST && symbol !== S_CENTAUR
        && monster.mnum !== PM_WINGED_GARGOYLE
        && monster.mnum !== PM_MARILITH;
}

function monsterCreationWearSnapshotSlots(monster) {
    if (!monsterCanDress(monster, true)) return [];
    const canWearSuit = monsterCanWearSuit(monster);
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const weapon = monster?.mw;
    const slots = ['uamul'];
    if (canWearSuit && !((monster.misc_worn_check ?? 0) & W_ARM))
        slots.push('uarmu');
    if (canWearSuit || monsterWrappingAllowed(monster)) slots.push('uarmc');
    slots.push('uarmh');
    if (!weapon || !OBJECT_BIMANUAL[weapon.otyp]) slots.push('uarms');
    slots.push('uarmg');
    if (!(flags & M1_SLITHY)
        && MONSTER_SYMBOL[monster?.mnum] !== S_CENTAUR) slots.push('uarmf');
    slots.push('uarm');
    return slots;
}

function slotAllowed(monster, slot) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (slot === 'uarm' || slot === 'uarmu')
        return monsterCanWearSuit(monster);
    if (slot === 'uarmc') return monsterCanWearSuit(monster);
    if (slot === 'uarmh') return !(flags & M1_NOHEAD);
    if (slot === 'uarmf')
        return !(flags & M1_SLITHY)
            && MONSTER_SYMBOL[monster?.mnum] !== S_CENTAUR;
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

// C ref: worn.c:find_mac().  Species AC is the base; only inventory objects
// whose worn bit is present in misc_worn_check contribute protection.
export function findMonsterArmorClass(monster) {
    if (!monster) return 10;
    if (Number.isFinite(monster.mac))
        return Math.max(-AC_MAX, Math.min(AC_MAX, monster.mac));

    let armorClass = Number.isFinite(monster.ac)
        ? monster.ac
        : (MONSTER_EXPERIENCE_META[monster.mnum]?.[0] ?? 10);
    const wornMask = monster.misc_worn_check ?? 0;
    for (const object of monster.minvent || monster.inventory || []) {
        if (!((object.owornmask ?? 0) & wornMask)) continue;
        armorClass -= object.otyp === AMULET_OF_GUARDING
            ? 2 : armorBonus(object);
    }
    return Math.max(-AC_MAX, Math.min(AC_MAX, armorClass));
}

function bestForSlot(monster, slot) {
    const mask = SLOT_MASK[slot];
    const old = wornInSlot(monster, mask);
    if (old?.cursed) return { old, best: old };
    let best = old;
    for (const object of monster?.minvent || monster?.inventory || []) {
        if (armorSlotFor(object?.otyp) !== slot) continue;
        if ((object.owornmask ?? 0) && object !== old) continue;
        if (best && preference(monster, best) >= preference(monster, object))
            continue;
        best = object;
    }
    return { old, best };
}

function wearSlot(monster, slot, creation) {
    if (!slotAllowed(monster, slot)) return null;
    if (slot === 'uarmu' && ((monster.misc_worn_check ?? 0) & W_ARM))
        return null;
    const mask = SLOT_MASK[slot];
    const { old, best } = bestForSlot(monster, slot);
    if (!best || best === old) return null;

    let delay = 0;
    if ((slot === 'uarm' || slot === 'uarmu')
        && ((monster.misc_worn_check ?? 0) & W_ARMC)) delay += 2;
    if (old) {
        delay += OBJECT_DELAY[old.otyp] ?? 0;
        old.owornmask = (old.owornmask ?? 0) & ~mask;
        old.worn = (old.owornmask ?? 0) !== 0;
    }
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | mask;
    best.owornmask = (best.owornmask ?? 0) | mask;
    best.worn = true;

    if (!creation) {
        delay += OBJECT_DELAY[best.otyp] ?? 0;
        monster.mfrozen = delay;
        if (delay) monster.mcanmove = 0;
    }
    return { slot, mask, old, best, delay };
}

export function initializeMonsterArmor(monster) {
    if (!monsterCanDress(monster, true)) return [];
    monster.misc_worn_check ??= 0;
    const changes = [];
    for (const slot of WEAR_ORDER) {
        const change = wearSlot(monster, slot, true);
        if (change) changes.push(change);
    }
    return changes;
}

export function snapshotMonsterCreationWearNames(monster, snapshotName) {
    if (typeof snapshotName !== 'function') return 0;
    const slots = monsterCreationWearSnapshotSlots(monster);
    for (const slot of slots) snapshotName(monster, slot);
    return slots.length;
}

export function checkMonsterGearNextTurn(monster) {
    if (!monster) return;
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | I_SPECIAL;
}

// Return null when the source postpones assessment because a hostile monster
// still believes the hero is nearby.  Otherwise return the action outcome;
// `consumed` mirrors movemon_singlemon()'s worn-mask/mcanmove return gate.
export function reassessMonsterArmor(monster) {
    if (!((monster?.misc_worn_check ?? 0) & I_SPECIAL)) return null;
    const apparentX = Number.isFinite(monster.mux) ? monster.mux : 0;
    const apparentY = Number.isFinite(monster.muy) ? monster.muy : 0;
    const dx = (monster.mx ?? 0) - apparentX;
    const dy = (monster.my ?? 0) - apparentY;
    if (!monster.mpeaceful && !monster.mtame && !monster.pet
        && dx * dx + dy * dy <= 9) return null;

    const oldMask = (monster.misc_worn_check ?? 0) & ~I_SPECIAL;
    monster.misc_worn_check = oldMask;
    let change = null;
    if (monsterCanDress(monster, false)) {
        for (const slot of WEAR_ORDER) {
            if ((monster.mfrozen ?? 0) > 0) break;
            const candidate = wearSlot(monster, slot, false);
            if (candidate && !change) change = candidate;
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
