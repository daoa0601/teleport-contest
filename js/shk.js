// shk.js — Runtime shop ownership and entry policy.
// C refs: hack.c move_update()/check_special_room(), shk.c inhishop(),
// shop_keeper(), and u_entered_shop().  Lua/mklev owns room construction and
// initial stock; this module owns the live relationship among room, resident,
// customer, and hero.

import { game } from './gstate.js';
import { pline, plineWithContinuation } from './display.js';
import { rn2 } from './rng.js';
import { detachHeroGold, heroGoldAmount } from './hero_gold.js';
import { exerciseAttribute } from './attrib.js';
import { heroIsDeaf } from './senses.js';
import { A_CHA, A_WIS, MORGUE, OROOM, ROOMOFFSET, SHOPBASE } from './const.js';
import { roomForRoomno } from './room.js';
import { intemple, templeRoomAt } from './priest.js';
import {
    BRASS_LANTERN, MAGIC_LAMP, OBJECT_COST, OBJECT_MATERIAL, OBJECT_NAMES,
    OIL_LAMP,
} from './object_data.js';
import { recordObjectPriceQuote } from './object_knowledge.js';
import { ACH_TOWN, recordAchievement } from './achievements.js';
import { nextIdent } from './ident.js';

export const SHOP_TYPE_NAMES = [
    'general store',
    'used armor dealership',
    'second-hand bookstore',
    'liquor emporium',
    'antique weapons outlet',
    'delicatessen',
    'jewelers',
    'quality apparel and accessories',
    'hardware store',
    'rare books',
    'health food store',
    'lighting store',
];

function sameLevel(a, b) {
    return (a?.dnum ?? 0) === (b?.dnum ?? 0)
        && (a?.dlevel ?? 1) === (b?.dlevel ?? 1);
}

function shopRoomAt(state, x, y, includeBoundary = false) {
    const level = state?.level;
    const location = level?.at?.(x, y);
    const roomno = location?.roomno ?? 0;
    if (roomno < ROOMOFFSET || (!includeBoundary && location?.edge))
        return null;
    const room = roomForRoomno(level, roomno);
    if (!room || (room.rtype ?? 0) < SHOPBASE) return null;
    return { room, roomno };
}

// C hack.c:in_rooms()/check_special_room().  Shops and temples keep their
// type because their residents own repeatable behavior.  Other special rooms
// deliver one entry event and are converted to OROOM.  Keep this lookup
// independent from shopRoomAt(): a level-arrival square can enter a generic
// room even when no shop boundary exists.
function oneShotSpecialRoomAt(state, x, y) {
    const level = state?.level;
    const location = level?.at?.(x, y);
    const roomno = location?.roomno ?? 0;
    // in_rooms(..., 0) includes the room's boundary code.  In Pri-loca the
    // random arrival is one row below the interior, on the lower Morgue edge,
    // and C still records that room as newly entered.
    if (roomno < ROOMOFFSET) return null;
    const room = roomForRoomno(level, roomno);
    if (!room || room.rtype !== MORGUE) return null;
    return { room, roomno };
}

async function enterOneShotSpecialRoom({ room }) {
    switch (room.rtype) {
    case MORGUE:
        // C chooses the morgue message from the game's recorded hour.
        if (Number(String(game.datetime || '').slice(8, 10)) === 0)
            await plineWithContinuation('Run away!  Run away!');
        else
            await plineWithContinuation('You have an uncanny feeling...');
        break;
    default:
        return null;
    }
    room.rtype = OROOM;
    return room;
}

// C inhishop() includes the room boundary, unlike inside_shop().  Monster
// pickup and shop-resident validity need this broader predicate.
export function shopkeeperInOwnShop(monster, state = game) {
    if (!monster?.isshk || !monster?.eshk) return false;
    if (!sameLevel(monster.eshk.shoplevel, state?.u?.uz)) return false;
    const current = shopRoomAt(state, monster.mx, monster.my, true);
    return current?.roomno === monster.eshk.shoproom;
}

export function shopkeeperName(monster) {
    const raw = monster?.eshk?.shknam || monster?.name || 'shopkeeper';
    return /^[+_|=-]/.test(raw) ? raw.slice(1) : raw;
}

// C end.c:done_in_by().  General shopkeeper names carry a gendered
// honorific in killer identity; prefix-coded personal names (-, +, =) do
// not.  formatkiller() later changes the descriptive comma to a semicolon,
// so expose the already-sanitized identity consumed by both the tombstone
// and score record.
export function shopkeeperKillerName(monster) {
    const raw = monster?.eshk?.shknam || monster?.name || 'shopkeeper';
    const personal = /^[-+=]/.test(raw);
    const honorific = personal ? '' : monster?.female ? 'Ms. ' : 'Mr. ';
    return `${honorific}${shopkeeperName(monster)}; the shopkeeper`;
}

function clearShopDebtOnDeath(resident, state) {
    const eshk = resident?.eshk;
    if (!eshk) return;
    const billedIds = new Set(
        (eshk.bill || []).map(entry => entry.bo_id),
    );
    for (const object of state?.inventory || []) {
        if (billedIds.has(object.o_id)) object.unpaid = false;
    }
    eshk.bill = [];
    eshk.billObjects = [];
    eshk.billct = 0;
    eshk.credit = 0;
    eshk.debit = 0;
    eshk.loan = 0;
}

function shopDeathRepositoryLocation(resident, state) {
    const eshk = resident?.eshk || {};
    const heroX = state?.u?.ux ?? 0;
    const heroY = state?.u?.uy ?? 0;
    const home = eshk.shk;
    const door = eshk.shd;
    const atEntry = home && door
        && (heroX === home.x && heroY === home.y
            || heroX === door.x && heroY === door.y
            || state?.level?.at?.(heroX, heroY)?.edge);
    if (!atEntry) return { x: heroX, y: heroY };
    return {
        x: home.x + Math.sign(home.x - door.x),
        y: home.y + Math.sign(home.y - door.y),
    };
}

// C end.c:really_done() -> shk.c:paybill()/inherits().  This first live
// death slice chooses the resident of the shop containing the hero, clears
// its settled debt state, and records where finish_paybill() would later
// deposit inventory after disclosure.  Inventory deliberately remains in
// hero ownership until that later boundary.
export function settleShopkeepersAfterDeath(state = game) {
    if (state._deathShopSettlement) return state._deathShopSettlement;

    const shopkeepers = (state?.level?.monsters || []).filter(monster =>
        monster?.isshk && !monster.dead && (monster.mhp ?? 1) > 0);
    const heroShop = shopRoomAt(
        state, state?.u?.ux, state?.u?.uy, true,
    );
    const resident = heroShop
        ? shopkeepers.find(monster =>
            monster.eshk?.shoproom === heroShop.roomno)
        : null;
    const creditor = shopkeepers.find(monster => {
        const eshk = monster.eshk || {};
        return (eshk.bill?.length || eshk.billct || eshk.debit
            || eshk.robbed);
    });
    const hostile = shopkeepers.find(monster =>
        monster.eshk?.following || !monster.mpeaceful);
    const local = shopkeepers.find(monster =>
        sameLevel(monster.eshk?.shoplevel, state?.u?.uz));
    const shopkeeper = resident || creditor || hostile || local;
    if (!shopkeeper) {
        state._deathShopSettlement = {
            taken: false, shopkeeper: null, message: null,
        };
        return state._deathShopSettlement;
    }

    const eshk = shopkeeper.eshk || {};
    const inventoryPresent = (state?.inventory || []).length > 0;
    const heroInShop = heroShop?.roomno === eshk.shoproom;
    const inOwnShop = shopkeeperInOwnShop(shopkeeper, state);
    const owes = !!(eshk.bill?.length || eshk.billct
        || eshk.debit || eshk.robbed);
    const peacefulInheritance = heroInShop && inOwnShop
        && !owes && shopkeeper.mpeaceful && !eshk.following;
    const takes = inventoryPresent && (peacefulInheritance
        || owes || eshk.following || !shopkeeper.mpeaceful);

    let message = null;
    if (takes) {
        const name = shopkeeperName(shopkeeper);
        if (peacefulInheritance) {
            message = `${name} gratefully inherits all your possessions.`;
        } else {
            const helpless = shopkeeper.msleeping
                || shopkeeper.mcanmove === 0
                || (shopkeeper.mfrozen ?? 0) > 0;
            const adjacent = Math.max(
                Math.abs(shopkeeper.mx - (state?.u?.ux ?? shopkeeper.mx)),
                Math.abs(shopkeeper.my - (state?.u?.uy ?? shopkeeper.my)),
            ) <= 1;
            const prefix = `${helpless ? 'wakes up and ' : ''}${
                adjacent ? '' : 'comes and '
            }takes`;
            message = `${name} ${prefix} all your possessions.`;
        }
    }

    clearShopDebtOnDeath(shopkeeper, state);
    shopkeeper.msleeping = 0;
    shopkeeper.mcanmove = 1;
    shopkeeper.mfrozen = 0;
    state._deathShopSettlement = {
        taken: takes,
        shopkeeper,
        message,
        repository: takes
            ? shopDeathRepositoryLocation(shopkeeper, state) : null,
        inventoryRetainedForDisclosure: takes,
    };
    return state._deathShopSettlement;
}

export function objectTypeKnown(object, state = game) {
    const trueName = OBJECT_NAMES[object?.otyp];
    const discoveryName = object?.oclass === 11 ? `wand of ${trueName}`
        : object?.oclass === 10 ? `spellbook of ${trueName}`
            : object?.oclass === 9 ? `scroll of ${trueName}`
                : object?.oclass === 8 ? `potion of ${trueName}`
                    : trueName;
    return !!object?.typeKnown
        || !!state?._knownObjectTypes?.has(object?.otyp)
        || (state?.inventory || []).some(item =>
            item.otyp === object?.otyp && item.typeKnown)
        || (state?.discoveries || []).some(discovery =>
            discovery.otyp === object?.otyp
            || discovery.name === discoveryName);
}

function shopkeeperForRoom(roomno, state = game) {
    if (!roomno) return null;
    const room = roomForRoomno(state?.level, roomno);
    const resident = room?.resident;
    return shopkeeperInOwnShop(resident, state) ? resident : null;
}

export function shopkeeperForHero(state = game) {
    const current = shopRoomAt(
        state, state?.u?.ux, state?.u?.uy, true,
    );
    return shopkeeperForRoom(current?.roomno, state);
}

export function carriedShopBill(resident, state = game) {
    if (!resident?.eshk) return [];
    const inventory = state?.inventory || [];
    const usedObjects = resident.eshk.billObjects || [];
    return (resident.eshk.bill || []).map(entry => ({
        entry,
        object: inventory.find(object => object.o_id === entry.bo_id)
            || usedObjects.find(object => object.o_id === entry.bo_id),
        price: entry.price * (entry.bquan ?? 1),
    })).filter(item => item.object);
}

// C refs: shk.c:pay(), sub_one_frombill(), and update_bill().  Gold is a
// real object stack in C; paying less than the whole purse splits it and the
// new stack identity consumes next_ident() before either stack is transferred.
export function settleCarriedShopBillItem(resident, item, state = game) {
    const { entry, object, price } = item || {};
    if (!resident?.eshk || !entry || !object || price <= 0
        || heroGoldAmount(state) < price) return false;
    const paid = detachHeroGold(state, price);
    if (paid) paid.where = 'gone';
    resident.gold = (resident.gold || 0) + price;
    object.unpaid = false;
    resident.eshk.bill = (resident.eshk.bill || [])
        .filter(candidate => candidate !== entry);
    resident.eshk.billObjects = (resident.eshk.billObjects || [])
        .filter(candidate => candidate !== object);
    resident.eshk.billct = resident.eshk.bill.length;
    return true;
}

export function shopThankYouMessage(resident) {
    const name = shopkeeperName(resident);
    const typeName = SHOP_TYPE_NAMES[
        (resident?.eshk?.shoptype ?? SHOPBASE) - SHOPBASE
    ] || 'shop';
    return `"Thank you for shopping in ${possessive(name)} ${typeName}!"`;
}

export function costlySpot(x, y, state = game) {
    const spot = shopRoomAt(state, x, y, false);
    const resident = shopkeeperForRoom(spot?.roomno, state);
    if (!resident) return null;
    const home = resident.eshk?.shk;
    if (home && x === home.x && y === home.y) return null;
    return { ...spot, resident };
}

// C dothrow.c:check_shop_obj().  Returning an unpaid object to its costly
// shop square removes it from the bill.  Throwing it elsewhere turns its bill
// price into debt.  A paid object with no sale value remains the hero's.
export async function settleThrownShopObject(
    object, x, y, state = game, publish = plineWithContinuation,
) {
    const heroShop = shopRoomAt(
        state, state?.u?.ux, state?.u?.uy, true,
    );
    const spot = costlySpot(x, y, state);
    if (object?.unpaid) {
        const returnedToShop = heroShop && spot
            && heroShop.roomno === spot.roomno;
        if (returnedToShop) removeObjectFromBill(object, state);
        else await chargeUnpaidObjectAsDebt(object, state, publish);
        return true;
    }
    if (!heroShop || !spot || heroShop.roomno !== spot.roomno
        || !spot.resident?.mpeaceful
        || x === spot.resident.mx && y === spot.resident.my
        || (OBJECT_COST[object?.otyp] ?? 0) !== 0) return false;

    object.no_charge = true;
    await plineWithContinuation(
        `${shopkeeperName(spot.resident)} seems uninterested.`,
    );
    return true;
}

function objectBaseShopCost(object) {
    let cost = OBJECT_COST[object?.otyp] ?? 0;
    if (!cost) cost = 5;
    if ((object?.oclass === 2 || object?.oclass === 3)
        && (object.spe ?? 0) > 0) cost += 10 * object.spe;
    return cost;
}

// C ref: shk.c:get_cost().  Keep every adjustment as an integer rational and
// apply C's decimal roundoff tweak once after all multipliers are combined.
export function shopObjectUnitCost(object, resident = null, state = game) {
    let cost = objectBaseShopCost(object);
    let multiplier = 1;
    let divisor = 1;
    const unknown = !object?.dknown || !objectTypeKnown(object, state);
    const glassGem = object?.oclass === 13
        && OBJECT_MATERIAL[object.otyp] === 20;
    if (unknown && !glassGem && Number.isInteger(object?.o_id)
        && object.o_id % 4 === 0) {
        multiplier *= 4;
        divisor *= 3;
    }

    // DUNCE_CAP is object 94 in the configured NetHack 5.0 object table.
    if (state?.uarmh?.otyp === 94) {
        multiplier *= 4;
        divisor *= 3;
    } else if ((state?.urole?.key === 'tourist'
            && (state?.u?.ulevel ?? 1) < 15)
        || (state?.uarmu && !state?.uarm && !state?.uarmc)) {
        multiplier *= 4;
        divisor *= 3;
    }

    const charisma = state?.u?.acurr?.a?.[A_CHA] ?? 10;
    if (charisma > 18) divisor *= 2;
    else if (charisma === 18) multiplier *= 2, divisor *= 3;
    else if (charisma >= 16) multiplier *= 3, divisor *= 4;
    else if (charisma <= 5) multiplier *= 2;
    else if (charisma <= 7) multiplier *= 3, divisor *= 2;
    else if (charisma <= 10) multiplier *= 4, divisor *= 3;

    cost *= multiplier;
    if (divisor > 1) cost = Math.trunc(
        (Math.trunc((cost * 10) / divisor) + 5) / 10,
    );
    cost = Math.max(1, cost);
    if (resident?.eshk?.surcharge)
        cost += Math.trunc((cost + 2) / 3);
    return cost;
}

// C refs: shk.c:check_unpaid()/check_unpaid_usage()/cost_per_charge().
// Lamps pay a usage fee only when switched on while their resident shopkeeper
// is still operating the current shop.  Magic-lamp lighting uses an ordinary
// oil-lamp fee so its inexhaustible light does not identify it for free.
// Prefix RNG is consumed before deaf/mute presentation, exactly as in C.
export async function chargeUnpaidLampUse(object, state = game) {
    if (!object?.unpaid
        || ![OIL_LAMP, BRASS_LANTERN, MAGIC_LAMP].includes(object.otyp)) {
        return null;
    }
    const resident = shopkeeperForHero(state);
    if (!resident) return null;

    let amount = object.otyp === MAGIC_LAMP
        ? OBJECT_COST[OIL_LAMP]
        : shopObjectUnitCost(object, resident, state);
    if (object.otyp !== MAGIC_LAMP && (object.spe ?? 0) > 1)
        amount = Math.trunc(amount / 4);
    if (amount <= 0) return null;

    const first = rn2(3) === 0 ? 'Hey!  ' : '';
    const second = rn2(3) === 0 ? 'Ahem.  ' : '';
    const audible = !heroIsDeaf(state) && !resident.mute;
    const message = audible
        ? `"${first}${second}Usage fee, ${amount} zorkmid${
            amount === 1 ? '' : 's'}."`
        : null;
    if (message) {
        await pline(message);
        exerciseAttribute(A_WIS, true, state);
    }
    resident.eshk.debit = (resident.eshk.debit ?? 0) + amount;
    return { resident, amount, message };
}

export function getCostOfShopItem(object, state = game) {
    if (!object || object.oclass === 12) return { price: 0, noCharge: -1 };
    const heroShop = shopRoomAt(
        state, state?.u?.ux, state?.u?.uy, true,
    );
    const objectShop = costlySpot(object.ox, object.oy, state);
    if (!heroShop || !objectShop
        || heroShop.roomno !== objectShop.roomno) {
        return { price: 0, noCharge: -1 };
    }
    if (object.no_charge) {
        return {
            price: 0, noCharge: 1, resident: objectShop.resident,
            roomno: objectShop.roomno,
        };
    }
    const quantity = object.quan ?? object.quantity ?? 1;
    const unitPrice = shopObjectUnitCost(object, objectShop.resident, state);
    recordObjectPriceQuote(object.otyp, unitPrice);
    return {
        price: quantity * unitPrice,
        noCharge: 0,
        resident: objectShop.resident,
        roomno: objectShop.roomno,
    };
}

function billForObject(object, state = game) {
    for (const room of state?.level?.rooms || []) {
        const resident = room?.resident;
        const bill = resident?.eshk?.bill || [];
        const entry = bill.find(candidate => candidate.bo_id === object?.o_id);
        if (entry) return { resident, entry };
    }
    return null;
}

function removeObjectFromBill(object, state = game) {
    const billed = billForObject(object, state);
    if (!billed) return null;
    const eshk = billed.resident.eshk;
    eshk.bill = (eshk.bill || []).filter(candidate =>
        candidate !== billed.entry);
    eshk.billct = eshk.bill.length;
    object.unpaid = false;
    return billed;
}

export async function chargeUnpaidObjectAsDebt(
    object,
    state = game,
    publish = plineWithContinuation,
) {
    if (!object?.unpaid) return null;
    const billed = removeObjectFromBill(object, state);
    if (!billed) return null;

    const { resident, entry } = billed;
    const eshk = resident.eshk;
    const value = Math.max(0, entry.price ?? 0)
        * Math.max(1, entry.bquan ?? 1);

    let message = null;
    if (resident.mpeaceful) {
        const creditUsed = Math.min(eshk.credit ?? 0, value);
        eshk.credit = Math.max(0, (eshk.credit ?? 0) - creditUsed);
        const debt = value - creditUsed;
        eshk.debit = (eshk.debit ?? 0) + debt;
        if (debt) {
            message = `You owe ${shopkeeperName(resident)} ${debt} zorkmid${
                debt === 1 ? '' : 's'
            } for it!`;
        } else {
            message = eshk.credit
                ? `You have ${eshk.credit} zorkmids credit remaining.`
                : 'You have no credit remaining.';
        }
    } else {
        eshk.robbed = (eshk.robbed ?? 0) + value;
        eshk.following = 1;
        message = `${shopkeeperName(resident)} calls you a thief!`;
    }
    if (message) await publish(message);
    return { resident, value, message };
}

export function payShopDebt(resident, state = game) {
    const eshk = resident?.eshk;
    const debt = Math.max(0, eshk?.debit ?? 0);
    if (!eshk || !debt) return { paid: false, debt: 0 };

    const credit = Math.max(0, eshk.credit ?? 0);
    const gold = heroGoldAmount(state);
    if (credit + gold < debt) return { paid: false, debt };

    const creditUsed = Math.min(credit, debt);
    const goldPaid = debt - creditUsed;
    eshk.credit = credit - creditUsed;
    if (goldPaid) {
        const payment = detachHeroGold(state, goldPaid);
        if (payment) payment.where = 'gone';
        resident.gold = (resident.gold ?? 0) + goldPaid;
        state._capacityDirty = true;
    }
    eshk.debit = 0;
    eshk.loan = 0;
    return { paid: true, debt, creditUsed, goldPaid };
}

export function splitShopBill(object, split, state = game) {
    if (!object?.unpaid || !split) return null;
    const billed = billForObject(object, state);
    if (!billed) return null;
    const quantity = split.quan ?? split.quantity ?? 1;
    billed.entry.bquan = Math.max(
        0, (billed.entry.bquan ?? 1) - quantity,
    );
    const entry = {
        bo_id: split.o_id,
        bquan: quantity,
        useup: false,
        price: billed.entry.price,
    };
    billed.resident.eshk.bill.push(entry);
    billed.resident.eshk.billct = billed.resident.eshk.bill.length;
    split.unpaid = true;
    return {
        resident: billed.resident,
        parentEntry: billed.entry,
        entry,
        object: split,
    };
}

export function rejoinShopBill(billSplit) {
    if (!billSplit?.resident?.eshk
        || !billSplit.parentEntry || !billSplit.entry)
        return false;
    const bill = billSplit.resident.eshk.bill || [];
    if (!bill.includes(billSplit.parentEntry)
        || !bill.includes(billSplit.entry))
        return false;
    billSplit.parentEntry.bquan = (billSplit.parentEntry.bquan ?? 0)
        + (billSplit.entry.bquan ?? 0);
    billSplit.resident.eshk.bill = bill.filter(entry =>
        entry !== billSplit.entry);
    billSplit.resident.eshk.billct = billSplit.resident.eshk.bill.length;
    if (billSplit.object) billSplit.object.unpaid = false;
    return true;
}

export function moveUsedObjectToBill(object, state = game) {
    if (!object?.unpaid) return null;
    const billed = billForObject(object, state);
    if (!billed) return null;
    billed.entry.bquan = object.quan ?? object.quantity ?? 1;
    billed.entry.useup = true;
    billed.resident.eshk.billObjects ||= [];
    billed.resident.eshk.billObjects.push(object);
    object.where = 'onbill';
    object.unpaid = false;
    return { ...billed, object };
}

export async function chargeAlteredUnpaidObject(
    object, verb, state = game,
) {
    if (!object?.unpaid) return null;
    const billed = billForObject(object, state);
    if (!billed) return null;
    const quantity = object.quan ?? object.quantity ?? 1;
    const pronoun = quantity === 1 ? 'it' : 'them';
    const demonstrative = quantity === 1 ? 'that' : 'those';
    const name = quantity === 1
        ? OBJECT_NAMES[object.otyp] || object.name || 'object'
        : object.plural || `${OBJECT_NAMES[object.otyp] || 'object'}s`;
    if (!heroIsDeaf(state) && !billed.resident.mute) {
        await plineWithContinuation(
            `"You ${verb} ${demonstrative} ${name}, you pay for ${pronoun}!"`,
        );
    }

    const dummy = {
        ...object,
        o_id: nextIdent(state),
        where: 'onbill',
        unpaid: false,
        owornmask: 0,
        worn: false,
    };
    billed.entry.bo_id = dummy.o_id;
    billed.entry.bquan = quantity;
    billed.entry.useup = true;
    billed.resident.eshk.billObjects ||= [];
    billed.resident.eshk.billObjects.push(dummy);
    object.unpaid = false;
    return { ...billed, object: dummy };
}

export function unpaidObjectCost(object, state = game) {
    const billed = billForObject(object, state);
    if (!billed) return 0;
    return billed.entry.price * (object?.quan ?? object?.quantity ?? 1);
}

export function addShopObjectToBill(object, state = game) {
    const spot = costlySpot(object?.ox, object?.oy, state);
    const heroShop = shopRoomAt(
        state, state?.u?.ux, state?.u?.uy, true,
    );
    if (!spot || !heroShop || heroShop.roomno !== spot.roomno
        || object?.oclass === 12 || object?.no_charge) return null;
    const eshk = spot.resident.eshk;
    if (!Array.isArray(eshk.bill)) eshk.bill = [];
    const existing = eshk.bill.find(entry => entry.bo_id === object.o_id);
    if (existing) return { resident: spot.resident, entry: existing, object };
    const entry = {
        bo_id: object.o_id,
        bquan: object.quan ?? object.quantity ?? 1,
        useup: false,
        price: shopObjectUnitCost(object, spot.resident, state),
    };
    eshk.bill.push(entry);
    eshk.billct = eshk.bill.length;
    object.unpaid = true;
    return { resident: spot.resident, entry, object };
}

function heroHonorific(state = game) {
    const titles = [
        'good', 'honored', 'most gracious', 'esteemed',
        'most renowned and sacred',
    ];
    const demigod = state?.u?.uevent?.udemigod ? 1 : 0;
    const title = titles[rn2(4) + demigod];
    const race = state?.urace?.key || state?.race;
    const female = !!state?.flags?.female;
    const suffix = race === 'vampire' ? (female ? 'dark lady' : 'dark lord')
        : race === 'elf' ? (female ? 'hiril' : 'hir')
            : race && race !== 'human' ? 'creature'
                : female ? 'lady' : 'sir';
    return `${title} ${suffix}`;
}

export function billedPickupQuote(transaction, noun, state = game) {
    if (!transaction) return null;
    const { resident, entry, object } = transaction;
    if (state?.u?.deaf || resident?.mute) return null;
    if (object) recordObjectPriceQuote(object.otyp, entry.price);
    if (!resident.mpeaceful)
        return `"For you, scum; ${entry.price} zorkmids for this ${noun}."`;
    if (resident.eshk?.surcharge)
        return `"For you, ${entry.price} zorkmids for this ${noun}."`;
    return `"For you, ${heroHonorific(state)}; only ${entry.price} zorkmids for this ${noun}."`;
}

function possessive(name) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function shopGreeting() {
    switch (game.urole?.key) {
    case 'knight': return 'Salutations';
    case 'samurai': return 'Irasshaimase';
    case 'tourist': return 'Aloha';
    case 'valkyrie': return 'Velkommen';
    default: return 'Hello';
    }
}

async function enterShop({ room, roomno }) {
    const shopkeeper = room.resident;
    if (!shopkeeper || !shopkeeperInOwnShop(shopkeeper, game)) return null;

    const eshk = shopkeeper.eshk;
    const playerName = game.plname || 'player';
    if ((!eshk.visitct || eshk.customer)
        && String(eshk.customer || '').toLowerCase()
            !== playerName.toLowerCase()) {
        eshk.visitct = 0;
        eshk.following = 0;
        eshk.customer = playerName;
        shopkeeper.mpeaceful = 1;
    }
    if (shopkeeper.mute || eshk.following) return null;

    const name = shopkeeperName(shopkeeper);
    const typeName = SHOP_TYPE_NAMES[(room.rtype ?? roomno) - SHOPBASE]
        || 'shop';
    if (game.u?.invisible || game.u?.invis) {
        const message = `${name} senses your presence.`;
        await pline(message);
        return message;
    }

    if (!shopkeeper.mpeaceful) {
        const message = `"So, ${playerName}, you dare return to ${possessive(name)} ${typeName}?!"`;
        await pline(message);
        return message;
    }
    if (eshk.surcharge) {
        const message = `"Back again, ${playerName}?  I've got my eye on you."`;
        await pline(message);
        return message;
    }
    if (eshk.robbed) {
        const message = `${name} mutters imprecations against shoplifters.`;
        await pline(message);
        return message;
    }

    const again = eshk.visitct++ ? ' again' : '';
    const message = `"${shopGreeting()}, ${playerName}!  Welcome${again} to ${possessive(name)} ${typeName}!"`;
    await pline(message);
    return message;
}

// C spoteffects() calls this before destination pickup and traps.  Room-entry
// accounting uses in_rooms(), which includes the shop boundary; inside_shop()
// is the later, stricter predicate used for merchandise and door blocking.
export async function checkSpecialRoom({ newLevel = false } = {}) {
    // hack.c:check_special_room() records Minetown when the hero first
    // reaches the town's outer room (including its boundary and subrooms).
    // Lua's selected town room is retained as the active special context.
    const town = game._activeSpecialLevel?.context;
    if (game.level?.flags?.has_town && town) {
        const x = game.u?.ux, y = game.u?.uy;
        const inTown = x >= town.xstart - 1
            && x <= town.xstart + town.width
            && y >= town.ystart - 1
            && y <= town.ystart + town.height;
        if (inTown) recordAchievement(game, ACH_TOWN);
    }
    const previous = newLevel
        ? null : shopRoomAt(game, game.u?.ux0, game.u?.uy0, true);
    const current = shopRoomAt(game, game.u?.ux, game.u?.uy, true);
    const previousRoomno = previous?.roomno ?? null;
    const currentRoomno = current?.roomno ?? null;
    game._shopRooms = {
        previous: previousRoomno,
        current: currentRoomno,
        entered: currentRoomno !== null && currentRoomno !== previousRoomno
            ? currentRoomno : null,
        left: previousRoomno !== null && previousRoomno !== currentRoomno
            ? previousRoomno : null,
    };
    let result = null;
    if (game._shopRooms.entered) result = await enterShop(current);

    const previousOneShot = newLevel
        ? null : oneShotSpecialRoomAt(game, game.u?.ux0, game.u?.uy0);
    const currentOneShot = oneShotSpecialRoomAt(
        game, game.u?.ux, game.u?.uy,
    );
    game._specialRooms = {
        previous: previousOneShot?.roomno ?? null,
        current: currentOneShot?.roomno ?? null,
        entered: currentOneShot
            && currentOneShot.roomno !== previousOneShot?.roomno
            ? currentOneShot.roomno : null,
    };
    if (game._specialRooms.entered)
        result = await enterOneShotSpecialRoom(currentOneShot);

    const previousTemple = newLevel
        ? null : templeRoomAt(game, game.u?.ux0, game.u?.uy0);
    const currentTemple = templeRoomAt(game, game.u?.ux, game.u?.uy);
    game._templeRooms = {
        previous: previousTemple?.roomno ?? null,
        current: currentTemple?.roomno ?? null,
        entered: currentTemple
            && currentTemple.roomno !== previousTemple?.roomno
            ? currentTemple.roomno : null,
    };
    if (game._templeRooms.entered)
        result = await intemple(game._templeRooms.entered);
    return result;
}
