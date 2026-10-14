// shk.js — Runtime shop ownership and entry policy.
// C refs: hack.c move_update()/check_special_room(), shk.c inhishop(),
// shop_keeper(), and u_entered_shop().  Lua/mklev owns room construction and
// initial stock; this module owns the live relationship among room, resident,
// customer, and hero.
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { hasShopBill, hasShopkeeperData, requireShopGame } from './shop_types.js';
import { SHOP_TYPES } from './shop_data.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, monsterIsHuman, monsterIsVampire } from './monster_data.js';
import { heroSpecies } from './hero_species.js';
import { monsterName, monsterPossessive, monsterSubjectPronoun, possessiveName, shopkeeperName } from './monster_name.js';
import { containedGold } from './gold.js';
import { containedBuyCost, objectIsCandle, objectPricingUnits, pickedContainer, shopClaimsObject, shopGetPrice, shopkeeperIsMuted, stolenValue, } from './shop_loss.js';
import { costlyGold, donateGold, sellHeroDroppedObject, shopOfferForObject, shopStocksObject, } from './shop_sell.js';
import { canSeeMonster, canSenseMonster, pline, plineWithContinuation } from './display.js';
import { currency } from './currency.js';
import { objectName, objectCombatName, definiteName } from './objnam.js';
import { rn2 } from './rng.js';
import { heroGoldAmount } from './hero_gold.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { propertyIsActive } from './properties.js';
import { publishMonsterWake } from './monster_wake.js';
import { A_CHA, A_WIS, ANTHOLE, BARRACKS, BEEHIVE, COCKNEST, COURT, DELPHI, In_mines, LEPREHALL, M_AP_NOTHING, M_AP_MONSTER, M_AP_TYPE, MORGUE, OROOM, ROOMOFFSET, SHOPBASE, SWAMP, TEMPLE, THRONE, Upolyd, MGIVENNAME, ZOO, } from './const.js';
import { insideRoom, inTown, roomForRoomno, roomsAt, updateHeroRoomMembership } from './room.js';
import { intemple } from './priest.js';
import { recordDiscoveredRoom } from './dungeon.js';
import { BAG_OF_TRICKS, BRASS_LANTERN, CAN_OF_GREASE, CHEST, CORPSE, CRYSTAL_BALL, DRUM_OF_EARTHQUAKE, EXPENSIVE_CAMERA, HORN_OF_PLENTY, ICE_BOX, LARGE_BOX, MAGIC_FLUTE, MAGIC_LAMP, MAGIC_MARKER, OBJECT_CHARGED, OBJECT_COST, OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_INITIAL_KNOWN, DUNCE_CAP, OIL_LAMP, POT_OIL, TINNING_KIT, WORTHLESS_PIECE_OF_WHITE_GLASS, } from './object_data.js';
import { recordObjectPriceQuote } from './object_knowledge.js';
import { ACH_SHOP, ACH_TOWN, recordAchievement } from './achievements.js';
import { nextIdent, nextObjectId } from './ident.js';
import { moneyToMonster, pacifyShopkeeper, rileShopkeeper, shopkeeperCustomerInsult, } from './shop_damage.js';
import { deallocateObject, stopObjectTimers } from './object_delete.js';
import { getObjectLocation, unlinkObject } from './object_location.js';
import { objectsInTimerGraph } from './object_timers.js';
import { leaveHeroShop } from './shop_departure.js';
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const GLASS = 19;
const BILLSZ = 200; // C include/mextra.h
const G_UNIQ = 0x1000;
const M2_PNAME = 0x00080000;
function sameLevel(a, b) {
    return (a?.dnum ?? 0) === (b?.dnum ?? 0)
        && (a?.dlevel ?? 1) === (b?.dlevel ?? 1);
}
// C inside_shop(): a room boundary is not merchandise floor space.
export function insideShopRoomAt(state, x, y) {
    const location = state.level?.at?.(x, y);
    const roomno = location?.roomno ?? 0;
    if (roomno < ROOMOFFSET || location?.edge)
        return null;
    const room = roomForRoomno(state.level, roomno);
    return room && room.rtype >= SHOPBASE ? { room, roomno } : null;
}
// C callers using *in_rooms() select the first matching shop. Membership
// checks must use the full roomsAt() list instead.
function firstShopRoomAt(state, x, y) {
    const roomno = roomsAt(state.level, x, y, SHOPBASE)[0];
    if (roomno === undefined)
        return null;
    const room = roomForRoomno(state.level, roomno);
    return room ? { room, roomno } : null;
}
// C inhishop() includes the room boundary, unlike inside_shop().  Monster
// pickup and shop-resident validity need this broader predicate.
export function shopkeeperInOwnShop(monster, state = game) {
    if (!monster?.isshk || !monster?.eshk)
        return false;
    if (!sameLevel(monster.eshk.shoplevel, state?.u?.uz))
        return false;
    return roomsAt(state.level, monster.mx, monster.my, SHOPBASE)
        .includes(monster.eshk.shoproom);
}
// C tended_shop(): checking residency must not apply shop_keeper()'s surcharge.
export function tendedShop(room, state = game) {
    return shopkeeperInOwnShop(room?.resident, state);
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
export function objectTypeKnown(object, state = game) {
    return !!OBJECT_INITIAL_KNOWN[object.otyp]
        || !!object?.typeKnown
        || !!state?._knownObjectTypes?.has(object?.otyp)
        || (state?.inventory || []).some(item => item.otyp === object?.otyp && item.typeKnown);
}
function shopkeeperForRoom(roomno, state = game) {
    if (!roomno)
        return null;
    const resident = shopResident(roomno, state);
    return resident && shopkeeperInOwnShop(resident, state) ? resident : null;
}
// C shop_keeper(): the assigned resident may be outside the shop.
// Looking up an angry keeper also applies the bill surcharge.
export function shopResident(roomno, state = game) {
    if (roomno === undefined)
        return null;
    const keeper = roomForRoomno(state.level, roomno)?.resident;
    if (!hasShopkeeperData(keeper))
        return null;
    if (!keeper.mpeaceful && !keeper.eshk.surcharge)
        rileShopkeeper(keeper);
    return keeper;
}
export function currentShopResident(state = game) {
    requireLiveGame(state);
    return shopResident(state.u.ushops?.[0], state);
}
export function shopkeeperForHero(state = game) {
    return shopkeeperForRoom(state.u.ushops?.[0], state);
}
// Native bill compaction preserves the overwritten slot's identity.
function copyBillEntry(target, source) {
    target.bo_id = source.bo_id;
    target.bquan = source.bquan;
    target.price = source.price;
    target.useup = source.useup;
}
export function shopThankYouMessage(resident) {
    const typeName = SHOP_TYPES[(resident?.eshk?.shoptype ?? SHOPBASE) - SHOPBASE]?.name || 'shop';
    const enthusiastic = !resident.eshk?.surcharge;
    const end = enthusiastic ? '!' : '.';
    if (!heroIsDeaf() && !shopkeeperIsMuted(resident))
        return `"Thank you for shopping in ${possessive(shopkeeperName(resident))} ${typeName}${end}"`;
    return `${shopkeeperName(resident, { capitalized: true })} nods${enthusiastic ? ' appreciatively' : ''} at you for shopping in ${monsterPossessive(resident, { noIt: true })} ${typeName}${end}`;
}
export function costlySpot(x, y, state = game) {
    if (!state.level?.flags.has_shop)
        return null;
    const spot = insideShopRoomAt(state, x, y);
    if (!spot)
        return null;
    const resident = shopkeeperForRoom(spot.roomno, state);
    if (!resident)
        return null;
    const home = resident.eshk?.shk;
    if (home && x === home.x && y === home.y)
        return null;
    return { ...spot, resident };
}
// C dothrow.c:check_shop_obj(). Broken objects settle through the hero's
// current shop. Intact returns remove bills or offer a sale before stacking.
export function objectIsUnpaid(object) {
    return Boolean(object.unpaid)
        || (object.contents || []).some(objectIsUnpaid);
}
export async function settleThrownShopObject(object, x, y, state = game, publish = plineWithContinuation, { broken = false } = {}) {
    requireLiveGame(state);
    requireShopGame(state);
    const heroShop = state.u.ushops[0];
    const resident = shopResident(heroShop, state);
    if (!resident)
        return false;
    const spot = costlySpot(x, y, state);
    const objectRoom = roomsAt(state.level, x, y, SHOPBASE)[0];
    if (broken || !spot || objectRoom !== heroShop) {
        if (objectIsUnpaid(object))
            await stolenValue(object, state.u.ux, state.u.uy, resident.mpeaceful, {
                state, publish, silent: false,
            });
        if (broken)
            object.no_charge = true;
        return true;
    }
    const previousRoom = state.u.ushops0[0];
    if (objectRoom === heroShop || objectRoom === previousRoom) {
        if (objectIsUnpaid(object)) {
            const gold = containedGold(object, true);
            removeObjectAndContentsFromBill(object, state, { resident });
            if (gold > 0)
                await donateGold(gold, resident, { selling: true, publish });
        }
        else if (x !== resident.mx || y !== resident.my) {
            await sellHeroDroppedObject(object, x, y, state, { publish });
        }
    }
    return true;
}
const glassGemImitations = [
    ['diamond', 'opal'], ['sapphire', 'aquamarine'], ['ruby', 'jasper'],
    ['amber', 'topaz'], ['jacinth', 'agate'], ['citrine', 'chrysoberyl'],
    ['black opal', 'jet'], ['emerald', 'jade'], ['amethyst', 'fluorite'],
].map(pair => pair.map(name => OBJECT_NAMES.indexOf(name)));
// C ref: shk.c:get_cost().  Keep every adjustment as an integer rational and
// apply C's decimal roundoff tweak once after all multipliers are combined.
// C shk.c:2864 oid_price_adjustment(): +1 when an unknown, non-glass-gem
// object carries the shopkeeper's arbitrary surcharge under this oid,
// else 0.  Pure; obfree's merge o_id handover consumes it alongside buy
// pricing.
export function objectPriceAdjustment(object, oid, state = game) {
    const known = !!object?.dknown && objectTypeKnown(object, state);
    const glassGem = object?.oclass === GEM_CLASS
        && OBJECT_MATERIAL[object.otyp] === GLASS;
    if (!known && !glassGem)
        return ((oid % 4) === 0) ? 1 : 0;
    return 0;
}
export function shopObjectUnitCost(object, resident = null, state = game) {
    let cost = shopGetPrice(object, false, state) || 5;
    let multiplier = 1;
    let divisor = 1;
    const unknown = !object?.dknown || !objectTypeKnown(object, state);
    const glassGem = object?.oclass === GEM_CLASS
        && OBJECT_MATERIAL[object.otyp] === GLASS;
    if (unknown) {
        if (glassGem) {
            const pseudorand = (((state.ubirthday ?? 0) | 0) % object.otyp)
                >= Math.trunc(object.otyp / 2);
            const imitations = glassGemImitations[object.otyp - WORTHLESS_PIECE_OF_WHITE_GLASS];
            const imitation = imitations?.[pseudorand ? 0 : 1];
            const imitationCost = imitation === undefined ? undefined : OBJECT_COST[imitation];
            if (imitationCost === undefined)
                throw new Error(`Glass gem ${object.otyp} has no shop imitation price`);
            cost = imitationCost;
        }
        else if (objectPriceAdjustment(object, object.o_id, state) > 0) {
            multiplier *= 4;
            divisor *= 3;
        }
    }
    if (state?.uarmh?.otyp === DUNCE_CAP) {
        multiplier *= 4;
        divisor *= 3;
    }
    else if ((state?.urole?.key === 'tourist'
        && (state?.u?.ulevel ?? 1) < 15)
        || (state?.uarmu && !state?.uarm && !state?.uarmc)) {
        multiplier *= 4;
        divisor *= 3;
    }
    const charisma = currentAttribute(A_CHA, state);
    if (charisma > 18)
        divisor *= 2;
    else if (charisma === 18)
        multiplier *= 2, divisor *= 3;
    else if (charisma >= 16)
        multiplier *= 3, divisor *= 4;
    else if (charisma <= 5)
        multiplier *= 2;
    else if (charisma <= 7)
        multiplier *= 3, divisor *= 2;
    else if (charisma <= 10)
        multiplier *= 4, divisor *= 3;
    cost *= multiplier;
    if (divisor > 1)
        cost = Math.trunc((Math.trunc((cost * 10) / divisor) + 5) / 10);
    cost = Math.max(1, cost);
    if (object.oartifact)
        cost *= 4;
    if (resident?.eshk?.surcharge)
        cost += Math.trunc((cost + 2) / 3);
    return cost;
}
// C shk.c:cost_per_charge(). Fractions use C integer division.
function shopUsageCost(object, resident, alternate, state) {
    let cost = shopObjectUnitCost(object, resident, state);
    const type = object.otyp;
    if (type === MAGIC_LAMP) {
        const oilLampCost = OBJECT_COST[OIL_LAMP];
        if (oilLampCost === undefined)
            throw new Error('Oil lamp shop price is missing');
        return alternate ? cost + Math.trunc(cost / 3) : oilLampCost;
    }
    if (type === MAGIC_MARKER)
        return Math.trunc(cost / 2);
    if (type === BAG_OF_TRICKS || type === HORN_OF_PLENTY)
        return alternate ? cost : Math.trunc(cost / 5);
    if ([CRYSTAL_BALL, OIL_LAMP, BRASS_LANTERN].includes(type)
        || type >= MAGIC_FLUTE && type <= DRUM_OF_EARTHQUAKE
        || object.oclass === 11)
        return object.spe > 1 ? Math.trunc(cost / 4) : cost;
    if (object.oclass === 10)
        return cost - Math.trunc(cost / 5);
    if ([CAN_OF_GREASE, TINNING_KIT, EXPENSIVE_CAMERA].includes(type))
        return Math.trunc(cost / 10);
    if (type === POT_OIL)
        return Math.trunc(cost / 5);
    return cost;
}
// Partial use adds debt without consuming or settling the billed object.
// C shk.c:check_unpaid_usage(). Prefix rolls precede the hearing check.
export async function chargeUnpaidUsage(object, { state = game, alternate = false, } = {}) {
    if (!object.unpaid || !state.u.ushops?.length
        || object.spe <= 0 && OBJECT_CHARGED[object.otyp])
        return null;
    const resident = shopkeeperForHero(state);
    if (!resident)
        return null;
    const amount = shopUsageCost(object, resident, alternate, state);
    if (!amount)
        return null;
    const money = `${amount} zorkmid${amount === 1 ? '' : 's'}`;
    let text;
    if (object.oclass === 10) {
        const insult = shopkeeperCustomerInsult(state);
        const prefix = rn2(2) ? `This is no free library, ${insult}!  ` : '';
        const extra = (resident.eshk.debit ?? 0) > 0 ? ' an additional' : '';
        text = `${prefix}You owe${extra} ${money}.`;
    }
    else if (object.otyp === POT_OIL) {
        text = `That will cost you ${money} (Yendorian Fuel Tax).`;
    }
    else if (alternate
        && [BAG_OF_TRICKS, HORN_OF_PLENTY].includes(object.otyp)) {
        let prefix = rn2(3) === 0 ? 'Whoa!  ' : '';
        if (rn2(3) === 0)
            prefix = 'Watch it!  ';
        text = `${prefix}Emptying that will cost you ${money}.`;
    }
    else {
        const first = rn2(3) === 0 ? 'Hey!  ' : '';
        const second = rn2(3) === 0 ? 'Ahem.  ' : '';
        text = `${first}${second}Usage fee, ${money}.`;
    }
    const audible = !heroIsDeaf(state) && !shopkeeperIsMuted(resident);
    const message = audible ? `"${text}"` : null;
    if (message) {
        await plineWithContinuation(message);
        await exerciseAttribute(A_WIS, true, state);
    }
    resident.eshk.debit = (resident.eshk.debit ?? 0) + amount;
    return { resident, amount, message };
}
export function getCostOfShopItem(object, state = game) {
    if (!object || object.oclass === COIN_CLASS
        || object === state.uball || object === state.uchain
        || object === state.u?.uball || object === state.u?.uchain) {
        return { price: 0, noCharge: -1 };
    }
    const heroShop = state.u.ushops?.[0];
    const location = getObjectLocation(object, state, { contained: true });
    if (!heroShop || !location
        || heroShop !== roomsAt(state.level, location.x, location.y, SHOPBASE)[0]) {
        return { price: 0, noCharge: -1 };
    }
    const shop = insideShopRoomAt(state, location.x, location.y);
    if (!shop)
        return { price: 0, noCharge: -1 };
    const resident = shopResident(shop.roomno, state);
    if (!resident || !shopkeeperInOwnShop(resident, state))
        return { price: 0, noCharge: -1 };
    let top = object;
    while (top.where === 'contained') {
        if (!top.container)
            throw new Error(`Contained object ${top.o_id} has no container`);
        top = top.container;
    }
    const home = resident.eshk.shk;
    const freeSpot = top.where === 'floor'
        && location.x === home.x && location.y === home.y;
    const noCharge = top.where === 'floor' && (object.no_charge || freeSpot) ? 1 : 0;
    let price = 0;
    if (top.where === 'inventory' ? object.unpaid : !noCharge)
        price = objectPricingUnits(object) * shopObjectUnitCost(object, resident, state);
    if (object.contents?.length && !freeSpot)
        price += containedBuyCost(object, resident, { unpaidOnly: true, state });
    return {
        price,
        noCharge,
        resident,
        roomno: shop.roomno,
    };
}
// Iteration matches next_shkp(fmon, TRUE), including the anger surcharge
// applied before each keeper's bill is inspected.
export function* visitBilledShopkeepers(state = game) {
    requireLiveGame(state);
    for (const keeper of [...requireGameLevel(state).monsters].reverse()) {
        if (keeper.dead || keeper.mhp <= 0 || !keeper.isshk || !hasShopBill(keeper) || !keeper.eshk.bill.length)
            continue;
        if (!keeper.mpeaceful && !keeper.eshk.surcharge)
            rileShopkeeper(keeper);
        yield keeper;
    }
}
export function billForObject(object, state = game, resident = null) {
    // C onbill(): with a keeper given, only that keeper's bill answers;
    // other shops' bills stay untouched.
    const keepers = resident ? [resident]
        : [...(state.level?.monsters ?? [])].reverse();
    for (const keeper of keepers) {
        if (keeper.dead || keeper.mhp <= 0 || !hasShopBill(keeper))
            continue;
        const bill = keeper.eshk.bill;
        const entry = bill.find(candidate => candidate.bo_id === object?.o_id);
        if (entry)
            return { resident: keeper, entry };
    }
    return null;
}
export function removeOneObjectFromBill(object, state = game, resident = null) {
    const billed = billForObject(object, state, resident);
    if (!billed) {
        if (object?.unpaid)
            object.unpaid = false;
        return null;
    }
    const eshk = billed.resident.eshk;
    const removedEntry = { ...billed.entry };
    const objectQuantity = Math.max(1, object.quan ?? object.quantity ?? 1);
    const billedQuantity = Math.max(1, billed.entry.bquan ?? 1);
    const removedQuantity = Math.min(objectQuantity, billedQuantity);
    if (billedQuantity > objectQuantity) {
        // The missing part of the stack was already used and is still owed.
        const usedQuantity = billedQuantity - objectQuantity;
        const usedObject = {
            ...object,
            o_id: nextIdent(state),
            oextra: null,
            owt: 0,
            quan: usedQuantity,
            quantity: usedQuantity,
            where: 'free',
            unpaid: false,
            contents: [],
            objectTimers: [],
            owornmask: 0,
            worn: false,
        };
        billed.entry.bo_id = usedObject.o_id;
        billed.entry.bquan = usedQuantity;
        billed.entry.useup = true;
        retainBillObject(usedObject, state);
    }
    else {
        const last = eshk.bill.pop();
        if (last && last !== billed.entry)
            copyBillEntry(billed.entry, last);
    }
    eshk.billct = eshk.bill.length;
    object.unpaid = false;
    return { resident: billed.resident, entry: removedEntry, removedQuantity };
}
export function removeObjectAndContentsFromBill(object, state = game, { resident = null } = {}) {
    // C subfrombill(): recursion over non-coin contents, keeper-scoped.
    const billed = removeOneObjectFromBill(object, state, resident);
    for (const content of object?.contents || []) {
        if (content.oclass !== COIN_CLASS) {
            removeObjectAndContentsFromBill(content, state, { resident });
        }
    }
    return billed;
}
export async function chargeUnpaidObjectAsDebt(object, state = game, publish = plineWithContinuation) {
    if (!object?.unpaid)
        return null;
    const billed = removeOneObjectFromBill(object, state);
    if (!billed)
        return null;
    const { resident, entry } = billed;
    const eshk = resident.eshk;
    const value = Math.max(0, entry.price ?? 0) * billed.removedQuantity;
    let message = null;
    if (resident.mpeaceful) {
        const creditUsed = Math.min(eshk.credit ?? 0, value);
        eshk.credit = Math.max(0, (eshk.credit ?? 0) - creditUsed);
        const debt = value - creditUsed;
        eshk.debit = (eshk.debit ?? 0) + debt;
        if (debt) {
            message = `You owe ${shopkeeperName(resident)} ${debt} zorkmid${debt === 1 ? '' : 's'} for it!`;
        }
        else {
            message = eshk.credit
                ? `You have ${eshk.credit} zorkmids credit remaining.`
                : 'You have no credit remaining.';
        }
    }
    else {
        eshk.robbed = (eshk.robbed ?? 0) + value;
        eshk.following = 1;
        message = `${shopkeeperName(resident)} calls you a thief!`;
    }
    if (message)
        await publish(message);
    return { resident, value, message };
}
export async function payShopDebt(resident, state = game) {
    const eshk = resident?.eshk;
    const debt = Math.max(0, eshk?.debit ?? 0);
    if (!resident || !eshk || !debt)
        return { paid: false, debt: 0 };
    const credit = Math.max(0, eshk.credit ?? 0);
    const gold = heroGoldAmount(state);
    if (credit + gold < debt)
        return { paid: false, debt };
    const creditUsed = Math.min(credit, debt);
    const goldPaid = debt - creditUsed;
    eshk.credit = credit - creditUsed;
    if (goldPaid)
        await moneyToMonster(resident, goldPaid, state);
    eshk.debit = 0;
    eshk.loan = 0;
    return { paid: true, debt, creditUsed, goldPaid };
}
// C shk.c splitbill(): otmp has been split off from obj.  The keeper is
// the CURRENT first hero-shop resident (inhishop-validated), not any
// owner; the original entry's quantity shrinks and the split either
// clones the recorded price into a fresh entry or, on a full bill, simply
// stops being unpaid.
export function splitObjectBill(original, split, state = game) {
    requireShopGame(state);
    const resident = shopResident(state.u.ushops[0], state);
    const keeper = shopkeeperInOwnShop(resident, state) && hasShopBill(resident) ? resident : null;
    if (!keeper)
        return;
    const entry = (keeper.eshk.bill || [])
        .find(candidate => candidate.bo_id === original?.o_id);
    if (!entry)
        return;
    const splitQuan = split?.quan ?? split?.quantity ?? 1;
    // C guards against negative and zero residual quantities.
    if ((entry.bquan ?? 1) < splitQuan)
        return;
    if ((entry.bquan ?? 1) === splitQuan)
        return;
    entry.bquan -= splitQuan;
    if ((keeper.eshk.bill || []).length === BILLSZ) {
        split.unpaid = false;
        return;
    }
    keeper.eshk.bill.push({
        bo_id: split.o_id,
        bquan: splitQuan,
        useup: false,
        price: entry.price,
    });
    keeper.eshk.billct = keeper.eshk.bill.length;
}
// C add_to_billobjs(): only bookkeeping survives; active use, bypass,
// and live timers cannot follow an object onto the used-up bill chain.
function retainBillObject(object, state) {
    if (object.where !== 'free')
        throw new Error('add_to_billobjs requires a free object');
    if (object.timed)
        stopObjectTimers(object, state);
    state.billObjects ||= [];
    state.billObjects.unshift(object);
    object.where = 'onbill';
    object.in_use = false;
    object.bypass = false;
}
export function moveUsedObjectToBill(object, state = game, resident = null) {
    if (!object)
        return null;
    const billed = billForObject(object, state, resident);
    if (!billed)
        return null;
    billed.entry.useup = true;
    if (object.globby && !object.owt && object.oextra?.omid)
        object.owt = object.oextra.omid;
    object.unpaid = false;
    retainBillObject(object, state);
    return { ...billed, object };
}
// The billing branch of C obfree(). Keep retained or inconsistent billed
// identities out of raw deallocation; ordinary merges add quantity, not price.
export function reconcileObjectDeletionBill(object, mergeInto, state = game) {
    let keeper = null;
    if (object.unpaid) {
        for (const candidate of visitBilledShopkeepers(state)) {
            if (billForObject(object, state, candidate)) {
                keeper = candidate;
                break;
            }
        }
    }
    keeper ||= currentShopResident(state);
    const entry = keeper && billForObject(object, state, keeper)?.entry;
    if (!entry || !hasShopBill(keeper))
        return 'unbilled';
    if (!mergeInto) {
        moveUsedObjectToBill(object, state, keeper);
        return 'retained';
    }
    const target = billForObject(mergeInto, state, keeper)?.entry;
    if (!target)
        return 'blocked'; // C impossible(): do not deallocate.
    target.bquan += entry.bquan;
    const last = keeper.eshk.bill.pop();
    if (last && entry !== last)
        copyBillEntry(entry, last);
    keeper.eshk.billct = keeper.eshk.bill.length;
    return 'merged';
}
// C mkobj.c:744 alteration_verbs, index-matched to hack.h COST_*.
const ALTERATION_VERBS = [
    'cancel', 'drain', 'uncharge', 'unbless', 'uncurse', 'disenchant',
    'degrade', 'dilute', 'erase', 'burn', 'neutralize', 'destroy',
    'splatter', 'bite', 'open', 'break the lock on', 'rust', 'rot',
    'tarnish', 'crack',
];
// C mkobj.c bill_dummy_object(): move the altered object onto the bill as
// a used-up dummy entry, retaining the charge for the remaining quantity.
export async function billDummyObject(object, state = game) {
    requireLiveGame(state);
    requireShopGame(state);
    let cost = 0;
    if (object.unpaid) {
        // C unpaid_cost(COST_SINGLEOBJ): scan current shop rooms for the
        // per-unit charge, then remove from the first room's keeper below.
        for (const roomno of state.u.ushops) {
            const keeper = shopResident(roomno, state);
            const billed = keeper && billForObject(object, state, keeper);
            if (!billed)
                continue;
            cost = billed.entry.price;
            break;
        }
        removeObjectAndContentsFromBill(object, state, { resident: currentShopResident(state) });
    }
    const dummy = {
        ...object,
        contents: [],
        oextra: object.oextra ? structuredClone(object.oextra) : null,
        where: 'free',
        unpaid: false,
        owornmask: 0,
        worn: false,
        in_use: false,
        objectTimers: [],
        timed: 0,
    };
    if (dummy.oextra)
        delete dummy.oextra.omid;
    dummy.o_id = nextObjectId(object, dummy, state);
    if (objectIsCandle(dummy))
        dummy.lamplit = 0;
    const transaction = await addShopObjectToBill(dummy, state, { ininv: false, silent: true });
    if (transaction) {
        if (!transaction.entry)
            throw new Error('A billed dummy object has no bill entry');
        // C add_one_tobill(dummy=TRUE): used-up entries live on the bill.
        transaction.entry.useup = true;
        retainBillObject(dummy, state);
        if (cost) {
            // C alter_cost(dummy, -cost): visit keepers in monster order,
            // including their riling, then replace the unit price.
            for (const owner of visitBilledShopkeepers(state)) {
                const billed = billForObject(dummy, state, owner);
                if (!billed)
                    continue;
                billed.entry.price = cost;
                break;
            }
        }
    }
    object.no_charge = object.where === 'floor' || object.where === 'contained';
    object.unpaid = false;
    return transaction;
}
// C shk.c:globby_bill_fixup(). Globs transfer prices and ownership before
// absorption; ordinary stack quantity consolidation is not applicable.
export async function settleGlobAbsorptionBilling(absorber, absorbed, state = game, { publish = plineWithContinuation } = {}) {
    requireLiveGame(state);
    const floorAbsorber = absorber.where === 'floor';
    let keeper = null;
    if (absorber.unpaid) {
        for (const candidate of visitBilledShopkeepers(state)) {
            if (billForObject(absorber, state, candidate)) {
                keeper = candidate;
                break;
            }
        }
    }
    else if (absorbed.unpaid && absorbed.where === 'free' && floorAbsorber) {
        keeper = costlySpot(absorber.ox, absorber.oy, state)?.resident ?? null;
    }
    keeper ||= currentShopResident(state);
    if (!keeper)
        return;
    const absorberEntry = billForObject(absorber, state, keeper)?.entry;
    const absorbedEntry = billForObject(absorbed, state, keeper)?.entry;
    const shop = keeper.eshk;
    const offer = shopOfferForObject(absorbed, keeper, state);
    const name = OBJECT_NAMES[absorbed.otyp];
    const money = (amount) => `${amount} ${currency(amount, { state })}`;
    if (absorbedEntry && (!absorber.no_charge
        || shopClaimsObject(absorber, keeper, false, state))) {
        const amount = absorbedEntry.price;
        // C copies the last bill slot into the removed slot. Saved bill
        // pointers still refer to their original slots, even the old last one.
        const bill = shop.bill;
        if (!bill)
            throw new Error('A billed glob has no shop bill');
        const last = bill.pop();
        if (last && absorbedEntry !== last)
            copyBillEntry(absorbedEntry, last);
        shop.billct = bill.length;
        if (absorberEntry)
            absorberEntry.price += amount;
        return;
    }
    if (!absorberEntry && !absorbedEntry && !absorber.no_charge) {
        const amount = objectPricingUnits(absorbed) * offer;
        if (!shopStocksObject(shop.shoptype, absorbed))
            return;
        if ((shop.debit ?? 0) >= amount) {
            if (shop.loan)
                shop.loan = Math.max(0, shop.loan - amount);
            shop.debit = (shop.debit ?? 0) - amount;
            await publish(`The donated ${name} ${shop.debit ? 'partially ' : ''}pays off your debt.`);
        }
        else {
            const delta = amount - (shop.debit ?? 0);
            shop.credit = (shop.credit ?? 0) + delta;
            if (shop.debit) {
                shop.debit = 0;
                shop.loan = 0;
                await publish('Your debt is paid off.');
            }
            if (shop.credit === delta) {
                await publish(`The ${name} established ${money(delta)} credit.`);
            }
            else {
                await publish(`The ${name} added ${money(delta)} to your credit; total is now ${money(shop.credit)}.`);
            }
        }
        return;
    }
    else if (absorberEntry) {
        absorberEntry.price += objectPricingUnits(absorbed) * offer;
        return;
    }
    if (absorbedEntry && (absorber.no_charge
        || (floorAbsorber && !costlySpot(absorber.ox, absorber.oy, state)))) {
        const amount = absorbedEntry.price;
        await billDummyObject(absorbed, state);
        const action = keeper.mpeaceful ? 'just mixed' : 'had the audacity to mix';
        const ending = keeper.mpeaceful ? 's.' : ' stinking batch!';
        await publish(`"You owe me ${money(amount)} for my ${name} that you ${action} with your${ending}"`);
    }
}
// C mkobj.c:752 costly_alteration(): possibly bill an object the hero just
// modified.  Carried or free objects need only their unpaid flag; placed
// objects must sit on a costly spot and be claimable by that shop.
export async function chargeAlteredUnpaidObject(object, verb, state = game) {
    requireLiveGame(state);
    requireShopGame(state);
    const alterType = ALTERATION_VERBS.indexOf(verb);
    const alteration = ALTERATION_VERBS[alterType < 0 ? 0 : alterType];
    const learnBknown = alteration === 'uncurse' || alteration === 'unbless';
    const quantity = object?.quan ?? object?.quantity ?? 1;
    const pronoun = quantity === 1 ? 'it' : 'them';
    const demonstrative = quantity === 1 ? 'that' : 'those';
    const name = quantity === 1
        ? OBJECT_NAMES[object.otyp] || object.name || 'object'
        : object.plural || `${OBJECT_NAMES[object.otyp] || 'object'}s`;
    let ox = 0;
    let oy = 0;
    let roomno = 0;
    let keeper = null;
    if (object.where === 'inventory' || object.where === 'free') {
        // C: OBJ_FREE catches obj_no_longer_held()'s crysknife revert.
        if (!object.unpaid)
            return null;
    }
    else {
        // C get_obj_location(..., CONTAINED_TOO) over the root: floor
        // yields its own coordinates, a monster-carried root its carrier's
        // (a migrating carrier with mx 0 fails the lookup), inventory
        // resolves to the hero, and free/buried roots fail outright -
        // the caller then falls back to the hero (mkobj.c:776-785).
        let top = object;
        while (top.container)
            top = top.container;
        let located = false;
        if (top.where === 'floor') {
            ox = top.ox;
            oy = top.oy;
            located = true;
        }
        else if (top.where === 'minvent') {
            const carrier = top.ocarry
                || (state.level?.monsters || []).find(monster => (monster.minvent || monster.inventory || [])
                    .includes(top));
            if (carrier?.mx) {
                ox = carrier.mx;
                oy = carrier.my;
                located = true;
            }
        }
        else if (top.where === 'inventory') {
            located = true;
        }
        if (!located) {
            ox = state.u.ux;
            oy = state.u.uy;
        }
        if (!costlySpot(ox, oy, state))
            return null;
        roomno = roomsAt(state.level, ox, oy, SHOPBASE)[0] ?? 0;
        const resident = roomForRoomno(state.level, roomno)?.resident ?? null;
        keeper = resident && hasShopkeeperData(resident)
            && shopkeeperInOwnShop(resident, state) ? resident : null;
        if (!keeper || !shopClaimsObject(object, keeper, false, state))
            return null;
    }
    if (object.where === 'inventory' || object.where === 'free') {
        if (learnBknown)
            object.bknown = true;
        // C verbalizes unconditionally here; only the voice is optional.
        await plineWithContinuation(`"You ${alteration} ${demonstrative} ${name}, you pay for ${pronoun}!"`);
        return billDummyObject(object, state);
    }
    // C's switch has no OBJ_CONTAINED case: a contained member passes the
    // billable gate silently and nothing is charged.
    if (object.where !== 'floor')
        return null;
    if (learnBknown)
        object.bknown = true;
    const heroShop = state.u.ushops[0];
    if (costlySpot(state.u.ux, state.u.uy, state) && roomno === heroShop) {
        await plineWithContinuation(`"You ${alteration} ${demonstrative}, you pay for ${pronoun}!"`);
        return billDummyObject(object, state);
    }
    // C stolen_value(obj, ox, oy, FALSE, FALSE): angry settlement, spoken.
    return stolenValue(object, ox, oy, false, { silent: false, state, publish: plineWithContinuation });
}
// C shk.c:unpaid_cost(). The root keeps its agreed bill price; contents
// use the current shop valuation, and a partially used stack uses its live count.
export function unpaidObjectCost(object, state = game, costType = 'object') {
    let price = 0;
    for (const roomno of state.u.ushops ?? []) {
        const resident = shopResident(roomno, state);
        if (!resident)
            continue;
        const billed = billForObject(object, state, resident);
        if (billed)
            price = billed.entry.price * (costType === 'single' ? 1 : object.quan);
        if (costType === 'contents' && object.contents?.length)
            price += containedBuyCost(object, resident, { unpaidOnly: true, state });
        if (billed || (!object.unpaid && price))
            break;
    }
    return price;
}
// C shk.c:alter_cost(). An improvement can raise a bill, never lower it.
export function updateUnpaidObjectPrice(object, state = game) {
    const billed = billForObject(object, state);
    if (!billed)
        return;
    billed.entry.price = Math.max(billed.entry.price, shopObjectUnitCost(object, billed.resident, state));
}
// C shk.c:shk_your()/Shk_Your(). The returned prefix includes its separator; a corpse
// of a personally named monster has no prefix or separator at all.
export function objectOwnershipPrefix(object, state = game, { capitalized = true } = {}) {
    const species = object.corpsenm;
    if (object.otyp === CORPSE && species !== undefined && MONSTER_NAME[species] !== undefined) {
        if ((MONSTER_FLAGS2[species] ?? 0) & M2_PNAME)
            return '';
        if (((MONSTER_GENO[species] ?? 0) & G_UNIQ)
            && !['high cleric', 'long worm tail'].includes(MONSTER_NAME[species]))
            return capitalized ? 'The ' : 'the ';
    }
    let owner = carriedObjectOwner(object, state);
    if (capitalized)
        owner = owner.charAt(0).toUpperCase() + owner.slice(1);
    else if (owner === 'Your' || owner === 'The')
        owner = owner.toLowerCase();
    return `${owner} `;
}
// C shk.c:shk_owns() and mon_owns(). Shop ownership takes
// precedence over the carrier, using the object's location rather than ours.
export function carriedObjectOwner(object, state = game) {
    const location = getObjectLocation(object, state);
    if (location && (object.unpaid || (object.where === 'floor' && !object.no_charge
        && costlySpot(location.x, location.y, state)))) {
        const shop = insideShopRoomAt(state, location.x, location.y);
        const keeper = shop && shopResident(shop.roomno, state);
        return keeper ? possessiveName(shopkeeperName(keeper, { state })) : 'The';
    }
    if (object.where === 'minvent') {
        const carrier = object.ocarry;
        if (!carrier)
            throw new Error(`Monster-carried object ${object.o_id} has no owner.`);
        return possessiveName(monsterName(carrier, {
            state, article: carrier.mtame ? 'your' : 'the',
            suppressSaddle: !!MGIVENNAME(carrier) || state.u.usteed === carrier,
        }));
    }
    return object.where === 'inventory' ? 'Your' : 'The';
}
// C shk.c:3309 add_one_tobill(): one billed entry; unbilled freebies
// (unclaimed or full bill) print and stop here.
function addOneToBill(object, resident, state) {
    const eshk = resident.eshk;
    if (!shopClaimsObject(object, resident, true, state)
        || eshk.bill.length === BILLSZ) {
        return null;
    }
    const entry = {
        bo_id: object.o_id,
        bquan: object.quan ?? object.quantity ?? 1,
        useup: false,
        price: shopObjectUnitCost(object, resident, state),
    };
    if (object.globby)
        entry.price *= objectPricingUnits(object);
    eshk.bill.push(entry);
    eshk.billct = eshk.bill.length;
    object.unpaid = true;
    recordObjectPriceQuote(object.otyp, entry.price);
    return entry;
}
// C shk.c:3387 bill_box_content(): recursive content billing; a sealed
// Schroedinger box keeps its mystery and its contents unbilled.
function billBoxContent(container, resident, state) {
    if (isSchroedingersBox(container))
        return;
    for (const content of container.contents || []) {
        if (content.oclass === COIN_CLASS)
            continue;
        if (!content.no_charge)
            addOneToBill(content, resident, state);
        if (content.contents?.length) {
            billBoxContent(content, resident, state);
        }
    }
}
function isSchroedingersBox(object) {
    return (object.otyp === LARGE_BOX || object.otyp === CHEST
        || object.otyp === ICE_BOX) && object.spe === 1;
}
// C shk.c:566 costly_adjacent(): a shop wall spot (edge flag, door
// included) or the keeper's free-spot home square.  Not a distance test.
export function costlyAdjacent(resident, x, y, state = game) {
    if (!hasShopkeeperData(resident) || !shopkeeperInOwnShop(resident, state))
        return false;
    if (!Number.isInteger(x) || !Number.isInteger(y))
        return false;
    const home = resident.eshk.shk;
    return !!(state.level?.at(x, y)?.edge
        || (x === home.x && y === home.y));
}
// C shk.c:3492 addtobill(): bills the picked object and its eligible
// contents for the hero's current shop; gold routes through costly_gold.
export async function addShopObjectToBill(object, state = game, { ininv = true, silent = false, publish = plineWithContinuation } = {}) {
    requireLiveGame(state);
    // C billable(&shkp, obj, *u.ushops, TRUE): the hero's first shop room
    // validates the keeper, then the claim is decided by the object flags.
    const resident = currentShopResident(state);
    const keeper = shopkeeperInOwnShop(resident, state) ? resident : null;
    if (!keeper || !object || !shopClaimsObject(object, keeper, true, state))
        return null;
    const eshk = keeper.eshk;
    if (!Array.isArray(eshk.bill))
        eshk.bill = [];
    if (!hasShopBill(keeper))
        throw new Error('Shop bill initialization failed');
    if (object.oclass === COIN_CLASS) {
        await costlyGold(object.ox, object.oy, object.quan ?? object.quantity ?? 1, { silent, publish, state });
        return null;
    }
    if (eshk.bill.length === BILLSZ) {
        if (!silent)
            await publish('You got that for free!');
        return null;
    }
    const container = !!(object.contents?.length);
    let ltmp = 0;
    if (!object.no_charge) {
        ltmp = shopObjectUnitCost(object, keeper, state);
        if (object.globby)
            ltmp *= objectPricingUnits(object);
    }
    if (object.no_charge && !container) {
        object.no_charge = false;
        return null;
    }
    let entry = null;
    let contentscount = 0;
    if (container) {
        const cltmp = containedBuyCost(object, keeper, { unpaidOnly: false, state });
        const gltmp = containedGold(object, true);
        if (ltmp)
            entry = addOneToBill(object, keeper, state);
        if (cltmp)
            billBoxContent(object, keeper, state);
        pickedContainer(object); /* reset contained no_charge */
        ltmp += cltmp;
        if (gltmp) {
            await costlyGold(object.ox, object.oy, gltmp, { silent, publish, state });
            if (!ltmp)
                return null;
        }
        if (object.no_charge)
            object.no_charge = false;
        contentscount = countUnpaidContents(object);
    }
    else {
        entry = addOneToBill(object, keeper, state);
        if (!entry) {
            if (!silent)
                await publish('You got that for free!');
            return null;
        }
    }
    if (!heroIsDeaf(state) && !shopkeeperIsMuted(keeper) && !silent) {
        if (!ltmp) {
            await publish(`${shopkeeperName(keeper, { capitalized: true })} has no interest in ${definiteName(objectCombatName(object, { state, includeCorpseSpecies: false }), state)}.`);
            return null;
        }
        if (!ininv) {
            const name = objectCombatName(object, { state, includeCorpseSpecies: false });
            const each = (object.quan ?? object.quantity ?? 1) > 1
                ? ' each' : '';
            const subject = definiteName(name, state);
            await publish(`${subject.charAt(0).toUpperCase()}${subject.slice(1)} will cost you ${ltmp} ${currency(ltmp, { state })}${each}.`);
        }
    }
    const transaction = { resident: keeper, entry, object, offer: ltmp, contentscount };
    if (!ininv && !silent && (heroIsDeaf(state) || shopkeeperIsMuted(keeper))) {
        const quote = ltmp ? billedPickupQuote(transaction, state)
            : `${shopkeeperName(keeper, { capitalized: true })} does not notice.`;
        if (quote)
            await publish(quote);
    }
    return transaction;
}
function countUnpaidContents(container) {
    let count = 0;
    for (const content of container.contents || []) {
        if (content.contents?.length)
            count += countUnpaidContents(content);
        if (content.unpaid)
            count += content.quan ?? content.quantity ?? 1;
    }
    return count;
}
function heroHonorific(state = game) {
    const titles = [
        'good', 'honored', 'most gracious', 'esteemed',
        'most renowned and sacred',
    ];
    const demigod = state?.u?.uevent?.udemigod ? 1 : 0;
    const title = titles[rn2(4) + demigod];
    if (!title)
        throw new Error('Shop honorific roll is out of range');
    const species = heroSpecies(state);
    const elven = Upolyd(state.u)
        ? !!((MONSTER_FLAGS2[species] ?? 0) & 0x10) // M2_ELF
        : state.urace?.name === 'elf';
    const female = !!state?.flags?.female;
    const suffix = monsterIsVampire(species) ? (female ? 'dark lady' : 'dark lord')
        : elven ? (female ? 'hiril' : 'hir')
            : !monsterIsHuman(species) ? 'creature'
                : female ? 'lady' : 'sir';
    return `${title} ${suffix}`;
}
export function billedPickupQuote(transaction, state = game) {
    if (!transaction)
        return null;
    const { resident, object, offer: price, contentscount } = transaction;
    if (heroIsDeaf(state) || shopkeeperIsMuted(resident)) {
        const contents = contentscount && !object.unpaid ? 'the contents of ' : '';
        const suffix = contentscount && object.unpaid ? ' and its contents' : '';
        return `The list price of ${contents}${definiteName(objectCombatName(object, { state, includeCorpseSpecies: false }), state)}${suffix} is ${price} ${currency(price, { state })}${object.quan > 1 ? ' each' : ''}.`;
    }
    let greeting = '"For you,';
    if (!resident.mpeaceful)
        greeting += ' scum;';
    else if (!resident.eshk.surcharge)
        greeting += ` ${heroHonorific(state)}; only`;
    const quantity = object.quan;
    object.quan = 1;
    try {
        const unit = quantity > 1 ? 'per'
            : contentscount && !object.unpaid ? 'for the contents of this' : 'for this';
        return `${greeting} ${price} ${currency(price, { state })} ${unit} ${objectName(object, state)}${contentscount && object.unpaid ? ' and its contents' : ''}."`;
    }
    finally {
        object.quan = quantity;
    }
}
function possessive(name) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}
export function shopGreeting(monster, state = game) {
    switch (state.urole?.key) {
        case 'knight': return 'Salutations';
        case 'samurai': return MONSTER_NAME[monster?.mnum] === 'shopkeeper'
            ? 'Irasshaimase' : 'Konnichi wa';
        case 'tourist': return 'Aloha';
        case 'valkyrie': return 'Velkommen';
        case 'archeologist':
        case 'barbarian':
        case 'caveman':
        case 'healer':
        case 'monk':
        case 'priest':
        case 'ranger':
        case 'rogue':
        case 'wizard':
        case undefined: return 'Hello';
    }
}
// C shk.c:deserted_shop(). Disguised or unseen occupants leave uncertainty.
async function describeUntendedShop(room) {
    requireShopGame(game);
    let occupants = 0, noticed = 0;
    for (const monster of game.level.monsters) {
        const { mx, my } = monster;
        if (monster.dead || monster.mhp <= 0
            || mx < room.lx || mx > room.hx || my < room.ly || my > room.hy
            || (mx === game.u.ux && my === game.u.uy))
            continue;
        occupants++;
        const appearance = M_AP_TYPE(monster);
        if (canSenseMonster(monster)
            || ([M_AP_NOTHING, M_AP_MONSTER].includes(appearance)
                && canSeeMonster(monster)))
            noticed++;
    }
    if (heroIsBlind() && !propertyIsActive('telepathy')
        && !game.u.detectMonsters && !game.detectMonsters)
        occupants++;
    await plineWithContinuation(`This shop ${noticed < occupants ? 'seems to be' : 'is'} ${occupants ? 'untended' : 'deserted'}.`);
}
// C shk.c:after_shk_move(). The suspended bill survives save/restore.
export async function afterShopkeeperMove(keeper, state = game) {
    requireLiveGame(state);
    if (!keeper.eshk.billUnavailable || !shopkeeperInOwnShop(keeper, state))
        return;
    keeper.eshk.billUnavailable = false;
    if (!state.program_state?.gameover)
        await checkSpecialRoom();
}
async function enterShop({ room, roomno }) {
    requireShopGame(game);
    const shopkeeper = shopResident(roomno, game);
    if (!shopkeeper || !shopkeeperInOwnShop(shopkeeper, game)) {
        if (shopkeeper)
            shopkeeper.eshk.billUnavailable = true;
        // in_rooms() returns offsets into one static C buffer. Pointer
        // inequality here compares membership counts, not room identities.
        const changedCount = roomsAt(game.level, game.u.ux, game.u.uy, SHOPBASE).length
            !== roomsAt(game.level, game.u.ux0, game.u.uy0, SHOPBASE).length;
        if (!game._emptyShops?.includes(roomno) && (shopkeeper || changedCount))
            await describeUntendedShop(room);
        game._emptyShops = [...game.u.ushops];
        game.u.ushops = [];
        return null;
    }
    recordAchievement(game, ACH_SHOP);
    const eshk = shopkeeper.eshk;
    eshk.billUnavailable = false;
    const playerName = game.plname || 'player';
    if ((!eshk.visitct || eshk.customer)
        && String(eshk.customer || '').toLowerCase()
            !== playerName.toLowerCase()) {
        eshk.visitct = 0;
        eshk.following = 0;
        eshk.customer = playerName;
        pacifyShopkeeper(shopkeeper, true);
    }
    if (shopkeeperIsMuted(shopkeeper) || eshk.following)
        return null;
    const typeName = SHOP_TYPES[(room.rtype ?? roomno) - SHOPBASE]?.name
        || 'shop';
    const deaf = heroIsDeaf(game);
    let message;
    if (game.u.invisible || game.u.invis) {
        await plineWithContinuation(`${shopkeeperName(shopkeeper, { capitalized: true })} senses your presence.`);
        message = deaf
            ? `${shopkeeperName(shopkeeper, { capitalized: true })} stands firm as if ${monsterSubjectPronoun(shopkeeper, { noIt: true })} knows you are there.`
            : '"Invisible customers are not welcome!"';
        await plineWithContinuation(message);
        return message;
    }
    if (!shopkeeper.mpeaceful) {
        message = deaf
            ? `${shopkeeperName(shopkeeper, { capitalized: true })} seems ${['quite upset', 'ticked off', 'furious'][rn2(3)]} over your return to ${monsterPossessive(shopkeeper, { noIt: true })} ${typeName}!`
            : `"So, ${playerName}, you dare return to ${possessive(shopkeeperName(shopkeeper))} ${typeName}?!"`;
    }
    else if (eshk.surcharge) {
        message = deaf
            ? `The atmosphere at ${possessive(shopkeeperName(shopkeeper))} ${typeName} seems unwelcoming.`
            : `"Back again, ${playerName}?  I've got my eye on you."`;
    }
    else if (eshk.robbed) {
        message = deaf
            ? `${shopkeeperName(shopkeeper, { capitalized: true })} is combing through ${monsterPossessive(shopkeeper, { noIt: true })} inventory list.`
            : `${shopkeeperName(shopkeeper, { capitalized: true })} mutters imprecations against shoplifters.`;
    }
    else {
        const again = eshk.visitct ? ' again' : '';
        eshk.visitct = (eshk.visitct ?? 0) + 1;
        message = deaf ? `You enter ${possessive(shopkeeperName(shopkeeper))} ${typeName}${again}!`
            : `"${shopGreeting(shopkeeper)}, ${playerName}!  Welcome${again} to ${possessive(shopkeeperName(shopkeeper))} ${typeName}!"`;
    }
    await plineWithContinuation(message);
    return message;
}
// C hack.c:check_special_room(). newLevel is the old-level exit, not arrival.
export async function checkSpecialRoom({ newLevel = false } = {}) {
    updateHeroRoomMembership(game, newLevel);
    requireShopGame(game);
    if (game.u.ushops0.length)
        await leaveHeroShop(game.u.ushops_left, { newLevel });
    if (game.level.flags.has_town && In_mines(game.u.uz)
        && inTown(game.level, game.u.ux, game.u.uy))
        recordAchievement(game, ACH_TOWN);
    if (!game.u.uentered.length && !game.u.ushops_entered.length)
        return null;
    let result = null;
    if (game.u.ushops_entered.length) {
        const roomno = game.u.ushops_entered[0];
        if (roomno === undefined)
            throw new Error('Entered shop has no room number');
        const room = roomForRoomno(game.level, roomno);
        if (!room)
            throw new Error(`Entered shop ${roomno} has no room`);
        result = await enterShop({ room, roomno });
    }
    for (const roomno of game.u.uentered) {
        const room = roomForRoomno(game.level, roomno);
        if (!room)
            throw new Error(`Entered room ${roomno} does not exist`);
        const type = room.rtype;
        const message = specialRoomEntryMessage(room, roomno);
        if (message) {
            await plineWithContinuation(message);
            recordDiscoveredRoom(roomno - ROOMOFFSET);
            room.rtype = OROOM;
            result = room;
        }
        else if (type === DELPHI) {
            const oracle = [...game.level.monsters].reverse().find(monster => !monster.dead && monster.mhp > 0
                && monster.mnum === MONSTER_NAME.indexOf('Oracle')
                && roomsAt(game.level, monster.mx, monster.my).includes(roomno));
            if (oracle) {
                const name = game.plname;
                await plineWithContinuation(oracle.mpeaceful
                    ? `"${shopGreeting(oracle)}, ${name}, welcome to Delphi!"`
                    : `"You're in Delphi, ${name}."`);
                recordDiscoveredRoom(roomno - ROOMOFFSET);
            }
            room.rtype = OROOM;
            result = room;
        }
        else if (type === TEMPLE) {
            result = await intemple(roomno);
            recordDiscoveredRoom(roomno - ROOMOFFSET);
        }
        else if (type >= SHOPBASE) {
            recordDiscoveredRoom(roomno - ROOMOFFSET);
        }
        if (room.rtype !== OROOM || type === OROOM)
            continue;
        const remainingRooms = [...game.level.rooms, ...(game.level.subrooms ?? [])];
        if (!remainingRooms.some(candidate => 'rtype' in candidate && candidate.rtype === type)) {
            switch (type) {
                case COURT:
                    game.level.flags.has_court = false;
                    break;
                case SWAMP:
                    game.level.flags.has_swamp = false;
                    break;
                case MORGUE:
                    game.level.flags.has_morgue = false;
                    break;
                case ZOO:
                    game.level.flags.has_zoo = false;
                    break;
                case BARRACKS:
                    game.level.flags.has_barracks = false;
                    break;
                case BEEHIVE:
                    game.level.flags.has_beehive = false;
                    break;
            }
        }
        if ([COURT, SWAMP, MORGUE, ZOO].includes(type)) {
            for (const monster of [...game.level.monsters].reverse()) {
                // Native compares the stored room number to its room index here.
                if (monster.dead || monster.mhp <= 0
                    || game.level.at(monster.mx, monster.my)?.roomno !== roomno - ROOMOFFSET)
                    continue;
                if (!propertyIsActive('stealth', game) && !rn2(3)) {
                    await publishMonsterWake(monster);
                    monster.msleeping = 0;
                }
            }
        }
    }
    return result;
}
function specialRoomEntryMessage(room, roomno) {
    switch (room.rtype) {
        case ZOO: return "Welcome to David's treasure zoo!";
        case SWAMP: return heroIsBlind(game) ? 'It feels rather humid down here.' : 'It looks rather muddy down here.';
        case COURT: {
            const throne = furniturePresent(room, THRONE);
            return `You enter an opulent${throne ? ' throne' : ''} room!`;
        }
        case LEPREHALL: return 'You enter a leprechaun hall!';
        case MORGUE: return Number(String(game.datetime || '').slice(8, 10)) === 0
            ? 'Run away!  Run away!' : 'You have an uncanny feeling...';
        case BEEHIVE: return 'You enter a giant beehive!';
        case COCKNEST: return 'You enter a disgusting nest!';
        case ANTHOLE: return 'You enter an anthole!';
        case BARRACKS: {
            const soldiers = ['soldier', 'sergeant', 'lieutenant', 'captain'].map(name => MONSTER_NAME.indexOf(name));
            const occupied = game.level?.monsters.some(monster => !monster.dead && monster.mhp > 0
                && soldiers.includes(monster.mnum)
                && roomsAt(game.level, monster.mx, monster.my).includes(roomno));
            return occupied ? 'You enter a military barracks!' : 'You enter an abandoned barracks.';
        }
        default: return null;
    }
}
// C hack.c:furniture_present() scans the interior bounds, then checks the
// actual shape. Rectangular courts include furniture in their subrooms.
function furniturePresent(room, furniture) {
    const level = game.level;
    if (!level)
        return false;
    for (let y = room.ly; y <= room.hy; y++) {
        for (let x = room.lx; x <= room.hx; x++) {
            if (level.at(x, y)?.typ === furniture && insideRoom(level, room, x, y))
                return true;
        }
    }
    return false;
}
//# sourceMappingURL=shk.js.map