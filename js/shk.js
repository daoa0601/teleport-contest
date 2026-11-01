import { heroLocomotion } from './hero_locomotion.js';
import { recorderLocalHour } from './calendar.js';
import { impossible } from './diagnostics.js';
// shk.js — Runtime shop ownership and entry policy.
// C refs: hack.c move_update()/check_special_room(), shk.c inhishop(),
// shop_keeper(), and u_entered_shop().  Lua/mklev owns room construction and
// initial stock; this module owns the live relationship among room, resident,
// customer, and hero.
import { objectMaterial } from './object_material.js';
import { game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import { hasShopBill, hasShopkeeperData, requireShopGame } from './shop_types.js';
import { SHOP_TYPES } from './shknam.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, monsterIsHuman, monsterIsVampire, monsterHasHead, MONSTER_SOUND, MONSTER_LEVEL, MONSTER_NUTRITION } from './monster_data.js';
import { heroSpecies } from './hero_species.js';
import { monsterName } from './do_name.js';
import { possessiveName, depth } from './hacklib.js';
import { monsterPossessive, monsterSubjectPronoun, monsterIsHelpless, monsterObjectPronoun } from './mondata.js';
import { shopkeeperName, shopStocksObject } from './shknam.js';
import { containedGold } from './gold.js';
import { costlyGold, donateGold, sellHeroDroppedObject, shopOfferForObject, rouseShopkeeper } from './shop_sell.js';
import { canSeeMonster, canSenseMonster } from './display.js';
import { pline, plineWithContinuation } from './pline.js';
import { currency } from './currency.js';
import { simpleObjectName, objectTypeName, objectName, objectCombatName, definiteName, observeObjectForNaming } from './objnam.js';
import { rn2, rnd } from './rng.js';
import { recordRandom } from './monster_action_types.js';
import { heroGoldAmount, monsterGoldAmount } from './hero_gold.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { propertyIsActive } from './properties.js';
import { publishMonsterWake, angerWatchGuards, removeMonsterFromGame } from './mon.js';
import { A_CHA, A_WIS, ANTHOLE, BARRACKS, BEEHIVE, COCKNEST, COURT, DELPHI, In_mines, LEPREHALL, M_AP_NOTHING, M_AP_MONSTER, M_AP_TYPE, MMOVE_NOTHING, MORGUE, OROOM, PL_NSIZ, ROOMOFFSET, SHOPBASE, SWAMP, TEMPLE, THRONE, Upolyd, MGIVENNAME, ZOO, LL_ACHIEVE, G_GONE, isok, MM_NOMSG, LOW_PM, DOOR, D_BROKEN, HUNGRY } from './const.js';
import { insideRoom, inTown, roomForRoomno, roomsAt, updateHeroRoomMembership, roomForIndex } from './room.js';
import { searchSpecial } from './mkroom.js';
import { intemple } from './priest.js';
import { recordDiscoveredRoom, dungeonBuildsUp } from './dungeon.js';
import { BAG_OF_TRICKS, BRASS_LANTERN, CAN_OF_GREASE, CHEST, CORPSE, CRYSTAL_BALL, DRUM_OF_EARTHQUAKE, EXPENSIVE_CAMERA, HORN_OF_PLENTY, ICE_BOX, LARGE_BOX, MAGIC_FLUTE, MAGIC_LAMP, MAGIC_MARKER, OBJECT_CHARGED, OBJECT_COST, OBJECT_NAMES, OBJECT_INITIAL_KNOWN, DUNCE_CAP, OIL_LAMP, POT_OIL, TINNING_KIT, WORTHLESS_PIECE_OF_WHITE_GLASS, PICK_AXE, DWARVISH_MATTOCK, OBJECT_MAGIC, MIRROR, POT_WATER, WAX_CANDLE, TALLOW_CANDLE, OBJECT_WEIGHT, TIN, EGG } from './object_data.js';
import { learnObjectType, recordObjectPriceQuote, observeObject } from './object_knowledge.js';
import { ACH_SHOP, ACH_TOWN, recordAchievement } from './achievements.js';
import { nextIdent, nextObjectId } from './ident.js';
import { moneyToMonster, pacifyShopkeeper, rileShopkeeper, shopkeeperCustomerInsult, setPaidShopkeeper, hotPursuitShopkeeper, addUpBill, homeShopkeeper } from './shop_damage.js';
import { deallocateObject, stopObjectTimers } from './object_delete.js';
import { getObjectLocation, unlinkObject } from './object_location.js';
import { objectsInTimerGraph } from './object_timers.js';
import { performMonsterTurn } from './monmove.js';
import { dist2, pointsOnline } from './hacklib.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { moveSpecial, specialMoverSeesHero } from './priest.js';
import { resistConflict } from './mon.js';
import { beginMonsterHeroAttack } from './mhitu.js';
import { heroIsDisplaced } from './armor.js';
import { monsterHandName, heroArmName, monsterHeadName } from './body_parts.js';
import { diggingTimeToHole } from './hero_digging.js';
import { shopkeeperRepairsDamage } from './shop_damage.js';
import { heroHasConflict } from './hero_conflict.js';
import { adjustHeroAlignment } from './alignment.js';
import { dropHeroInventoryForBones } from './bones_death.js';
import { recordGameLogEvent } from './gamelog.js';
import { releaseAllMonsterLeashes } from './leash_apply.js';
import { makemonAt } from './makemon.js';
import { SPBOOK_CLASS, FOOD_CLASS } from './mklev.js';
import { paymentObjectDescription, objectDescription } from './object_description.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { cansee } from './vision.js';
import { showDisclosureOverlay } from './windows.js';
import { dropObjectAtHero } from './object_drop.js';
import { mergable } from './object_merge.js';
import { splitObjectStack } from './object_stack.js';
import { addInventoryItem } from './u_init.js';
import { intrinsicPossible } from './corpse_intrinsics.js';
import { countContents } from './invent.js';
import { objectWeight } from './weight.js';
import { artifactById } from './artifacts.js';
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const GLASS = 19;
const BILLSZ = 200; // C include/mextra.h
const G_UNIQ = 0x1000;
const M2_PNAME = 0x00080000;
// Object class codes used by the sale and naming paths; C objclass.h.
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const SCROLL_CLASS = 9;
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
// C objects[otyp].oc_name_known belongs to the type, never to an instance.
export function objectTypeKnown(object, state = game) {
    return !!OBJECT_INITIAL_KNOWN[object.otyp]
        || !!state._knownObjectTypes?.has(object.otyp);
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
// C replshk(): the bill stays on eshk; reconnect the room's resident.
// Carried remains can revive on a level without the original room.
export function restoreShopkeeperResidency(monster, state = game) {
    if (!hasShopkeeperData(monster))
        return;
    const room = roomForRoomno(state.level, monster.eshk.shoproom);
    if (room)
        room.resident = monster;
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
        && objectMaterial(object.otyp) === GLASS;
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
        && objectMaterial(object.otyp) === GLASS;
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
    const money = () => `${amount} ${currency(amount, { state })}`;
    let text;
    if (object.oclass === 10) {
        const insult = shopkeeperCustomerInsult(state);
        const prefix = rn2(2) ? `This is no free library, ${insult}!  ` : '';
        const extra = (resident.eshk.debit ?? 0) > 0 ? ' an additional' : '';
        text = () => `${prefix}You owe${extra} ${money()}.`;
    }
    else if (object.otyp === POT_OIL) {
        text = () => `That will cost you ${money()} (Yendorian Fuel Tax).`;
    }
    else if (alternate
        && [BAG_OF_TRICKS, HORN_OF_PLENTY].includes(object.otyp)) {
        let prefix = rn2(3) === 0 ? 'Whoa!  ' : '';
        if (rn2(3) === 0)
            prefix = 'Watch it!  ';
        text = () => `${prefix}Emptying that will cost you ${money()}.`;
    }
    else {
        const first = rn2(3) === 0 ? 'Hey!  ' : '';
        const second = rn2(3) === 0 ? 'Ahem.  ' : '';
        text = () => `${first}${second}Usage fee, ${money()}.`;
    }
    const audible = !heroIsDeaf(state) && !shopkeeperIsMuted(resident);
    const message = audible ? `"${text()}"` : null;
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
// C gem_learned(): identification changes the price of every live stack of
// this gem on a bill. A missing live object stops this keeper's traversal:
// the native loop does not advance its bill pointer after find_oid fails.
export function repriceDiscoveredGems(otyp, state = game) {
    const objects = objectsInTimerGraph(state);
    for (const keeper of visitBilledShopkeepers(state)) {
        for (const entry of keeper.eshk.bill) {
            const object = objects.find(candidate => candidate.o_id === entry.bo_id
                && candidate.where !== 'free' && candidate.where !== 'onbill');
            if (!object)
                break;
            if (otyp === 0 ? object.oclass === GEM_CLASS : object.otyp === otyp)
                entry.price = shopObjectUnitCost(object, keeper, state);
        }
    }
}
// C shk.c:onbill().
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
// C shk.c:sub_one_frombill().
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
// C shk.c:subfrombill().
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
// C potion.c:potionhit()'s unpaid tail and dothrow.c:check_shop_obj() both
// settle an unpaid object the hero used up with shk.c:stolen_value(obj,
// u.ux, u.uy, shkp->mpeaceful, FALSE): the bill entry comes off, credit is
// consumed by shk.c:check_credit() with its own messages, the remainder is
// still owed, and an angry keeper is set on the hero instead.
export async function chargeUnpaidObjectAsDebt(object, state = game, publish = plineWithContinuation) {
    if (!object?.unpaid)
        return null;
    const resident = currentShopResident(state);
    if (!resident)
        return null;
    return stolenValue(object, state.u.ux, state.u.uy, resident.mpeaceful, { silent: false, state, publish });
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
    const name = objectTypeName(absorbed.otyp, state);
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
        await plineWithContinuation(`"You ${alteration} ${demonstrative} ${simpleObjectName(object, state)}, you pay for ${pronoun}!"`);
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
export async function unpaidObjectCost(object, state = game, costType = 'object') {
    let price = 0;
    let resident = null;
    let billed = null;
    for (const roomno of state.u.ushops ?? []) {
        resident = shopResident(roomno, state);
        if (!resident)
            continue;
        billed = billForObject(object, state, resident);
        if (billed)
            price = billed.entry.price * (costType === 'single' ? 1 : object.quan);
        if (costType === 'contents' && object.contents?.length)
            price += containedBuyCost(object, resident, { unpaidOnly: true, state });
        if (billed || (!object.unpaid && price))
            break;
    }
    // Native tests the last shopkeeper examined; none outside a shop.
    if (!resident || (object.unpaid && !billed))
        await impossible("unpaid_cost: object wasn't on any bill.", { state });
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
// C shk.c:3309 add_one_tobill(): one billed entry. An unclaimed object
// stays unbilled quietly; a full bill gives it away, even for silent callers.
async function addOneToBill(object, resident, publish, state) {
    const eshk = resident.eshk;
    if (!shopClaimsObject(object, resident, true, state))
        return null;
    if (eshk.bill.length === BILLSZ) {
        await publish('You got that for free!');
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
async function billBoxContent(container, resident, publish, state) {
    if (isSchroedingersBox(container))
        return;
    for (const content of container.contents || []) {
        if (content.oclass === COIN_CLASS)
            continue;
        if (!content.no_charge)
            await addOneToBill(content, resident, publish, state);
        if (content.contents?.length) {
            await billBoxContent(content, resident, publish, state);
        }
    }
}
// C obj.h SchroedingersBox(): only a large box can hold the cat.
function isSchroedingersBox(object) {
    return object.otyp === LARGE_BOX && object.spe === 1;
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
            entry = await addOneToBill(object, keeper, publish, state);
        if (cltmp)
            await billBoxContent(object, keeper, publish, state);
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
        entry = await addOneToBill(object, keeper, publish, state);
        if (!entry)
            return null;
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
// C shk.c:append_honorific().
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
// C role.c:Hello().
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
    await blockShopEntry(shopkeeper);
    return message;
}
// C shk.c:u_entered_shop() tail. A hero already on the shop floor cannot
// be stopped at its entrance, including one who teleported past the door.
async function blockShopEntry(shopkeeper) {
    if (insideShopRoomAt(game, game.u.ux, game.u.uy))
        return;
    const picks = game.inventory.filter(object => object.otyp === PICK_AXE).length;
    const mattocks = game.inventory.filter(object => object.otyp === DWARVISH_MATTOCK).length;
    const calm = !shopkeeper.eshk.surcharge;
    const canSpeak = !heroIsDeaf(game) && !shopkeeperIsMuted(shopkeeper);
    if (picks || mattocks) {
        const tool = picks && mattocks ? 'digging tool' : picks ? 'pick-axe' : 'mattock';
        const count = picks + mattocks;
        if (!picks && mattocks && !heroIsBlind(game))
            learnObjectType(DWARVISH_MATTOCK);
        const tools = `${tool}${count > 1 ? 's' : ''}`;
        const request = calm ? `Will you please leave your ${tools} outside?` : `Leave the ${tools} outside.`;
        await plineWithContinuation(canSpeak
            ? `"${request}"`
            : `${shopkeeperName(shopkeeper, { capitalized: true })} ${calm ? 'is hesitant' : 'refuses'} to let you in with your ${tools}.`);
    }
    else if (game.u.usteed) {
        const steed = monsterName(game.u.usteed, { article: 'your' });
        const request = calm ? `Will you please leave ${steed} outside?` : `Leave ${steed} outside.`;
        await plineWithContinuation(canSpeak
            ? `"${request}"`
            : `${shopkeeperName(shopkeeper, { capitalized: true })} ${calm ? "doesn't want" : 'refuses'} to let you in while you're riding ${steed}.`);
    }
    else {
        const floorTools = game.level?.objects[game.u.ux]?.[game.u.uy];
        if (!(game.u.fast || game.u.veryFast)
            || !floorTools?.some(object => object.otyp === PICK_AXE || object.otyp === DWARVISH_MATTOCK))
            return;
    }
    requirePlayingGame(game);
    await performMonsterTurn(shopkeeper, game);
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
        if (!searchSpecial(type)) {
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
        case MORGUE: {
            if (recorderLocalHour(game.datetime) === 0) {
                const verb = heroLocomotion('Run');
                return `${verb} away!  ${verb} away!`;
            }
            return 'You have an uncanny feeling...';
        }
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
const kopSpecies = ['Keystone Kop', 'Kop Sergeant', 'Kop Lieutenant', 'Kop Kaptain']
    .map(name => MONSTER_NAME.indexOf(name));
// An empty room list denotes stepping onto the shop boundary. An actual
// departed room denotes leaving outright, including departure to a new level.
export async function leaveHeroShop(roomnos, { newLevel = false, state = game } = {}) {
    requireLiveGame(state);
    requireShopGame(state);
    const hero = state.u;
    const leaving = roomnos.length > 0;
    if (!leaving && (!state.level.at(hero.ux, hero.uy)?.edge
        || state.level.at(hero.ux0, hero.uy0)?.edge))
        return;
    const keeper = shopResident(leaving ? roomnos[0] : hero.ushops0[0], state);
    if (!keeper || !shopkeeperInOwnShop(keeper, state))
        return;
    const shop = keeper.eshk;
    if (!(shop.bill?.length || shop.billct) && !shop.debit)
        return;
    if (!leaving && !shopkeeperIsMuted(keeper)) {
        const calm = !shop.surcharge;
        if (!heroIsDeaf(state)) {
            await plineWithContinuation(`"${state.plname}!  ${calm
                ? 'Please pay before leaving.' : "Don't you leave without paying!"}"`);
        }
        else {
            await plineWithContinuation(`${shopkeeperName(keeper, { state, capitalized: true })} ${calm
                ? 'points out' : 'makes it clear'} that you need to pay before leaving${calm ? '.' : '!'}`);
        }
        return;
    }
    if (await robShop(keeper, state))
        await callKops(keeper, !newLevel && !!state.level.at(hero.ux0, hero.uy0)?.edge, state);
}
// C shk.c:remote_burglary(): bill first, then pursue from the distant shop.
export async function remoteBurglary(x, y, state = game) {
    requireLiveGame(state);
    requireShopGame(state);
    const keeper = shopResident(roomsAt(state.level, x, y, SHOPBASE)[0], state);
    if (!keeper || !shopkeeperInOwnShop(keeper, state))
        return;
    if (!keeper.eshk.billct && !keeper.eshk.debit)
        return;
    if (await robShop(keeper, state))
        await callKops(keeper, false, state);
}
async function robShop(keeper, state) {
    await rouseShopkeeper(keeper);
    const shop = keeper.eshk;
    let total = (shop.bill || []).reduce((sum, entry) => sum + entry.price * entry.bquan, 0)
        + (shop.debit || 0);
    const credit = shop.credit || 0;
    if (credit >= total) {
        await plineWithContinuation(`Your credit of ${credit} ${currency(credit, { state })} is used to cover your shopping bill.`);
        total = 0;
    }
    else {
        await plineWithContinuation('You escaped the shop without paying!');
        total -= credit;
    }
    setPaidShopkeeper(keeper, state);
    if (!total)
        return false;
    shop.robbed = (shop.robbed || 0) + total;
    await plineWithContinuation(`You stole ${total} ${currency(total, { state })} worth of merchandise.`);
    const shopType = SHOP_TYPES[shop.shoptype - SHOPBASE];
    if (!shopType)
        throw new Error(`Shopkeeper ${keeper.m_id} has invalid shop type ${shop.shoptype}`);
    recordGameLogEvent(`stole ${total} ${currency(total, { state })} worth of merchandise from ${possessiveName(shopkeeperName(keeper, { state }))} ${shopType.name}`, {
        state,
        flags: LL_ACHIEVE,
    });
    if (!state.urole || !state.u.ualign)
        throw new Error('Shop robbery requires hero role and alignment');
    if (state.urole.key !== 'rogue')
        adjustHeroAlignment(-Math.sign(state.u.ualign.type), state);
    hotPursuitShopkeeper(keeper, state);
    return true;
}
async function callKops(keeper, nearShop, state) {
    const deaf = heroIsDeaf(state);
    if (!deaf)
        await plineWithContinuation('An alarm sounds!');
    const noKops = kopSpecies.every(species => (state.mvitals?.[species]?.mvflags ?? 0) & G_GONE);
    const guardsResponded = await angerWatchGuards(deaf);
    if (!guardsResponded && noKops) {
        if (state.flags.verbose && !deaf)
            await plineWithContinuation('But no one seems to respond to it.');
        return;
    }
    if (noKops)
        return;
    const stairs = pursuitStairs(state);
    if (nearShop) {
        if (state.flags.verbose)
            await plineWithContinuation('The Keystone Kops appear!');
        await makeKops({ x: state.u.ux, y: state.u.uy }, state);
        return;
    }
    if (state.flags.verbose)
        await plineWithContinuation('The Keystone Kops are after you!');
    if (stairs && isok(stairs.sx, stairs.sy))
        await makeKops({ x: stairs.sx, y: stairs.sy }, state);
    if (state.program_state.gameover)
        return;
    await makeKops({ x: keeper.mx, y: keeper.my }, state);
}
function pursuitStairs(state) {
    const stairs = [];
    for (let stair = state.stairs; stair; stair = stair.next)
        stairs.push(stair);
    if (!stairs.length)
        return null;
    const up = dungeonBuildsUp(state.u.uz, state);
    return stairs.find(stair => !stair.isladder && !!stair.up === up)
        || stairs.find(stair => stair.isladder && !!stair.up === up)
        || stairs.find(stair => stair.tolev.dnum !== state.u.uz.dnum)
        || stairs.find(stair => !stair.isladder && !!stair.up !== up)
        || stairs.find(stair => stair.isladder && !!stair.up !== up)
        || null;
}
async function makeKops(origin, state) {
    let position = origin;
    const count = Math.abs(depth(state.u.uz, state.dungeons)) + rnd(5);
    const ranks = [count, Math.trunc(count / 3) + 1, Math.trunc(count / 6), Math.trunc(count / 9)];
    for (const [rank, rankCount] of ranks.entries()) {
        if (!rankCount)
            break;
        const species = kopSpecies[rank];
        if (species === undefined)
            throw new Error(`Kop rank ${rank} has no monster species`);
        if ((state.mvitals?.[species]?.mvflags ?? 0) & G_GONE)
            continue;
        for (let remaining = rankCount; remaining > 0; remaining--) {
            // Native enexto moves the center even if makemon later fails.
            const next = findNearbyMonsterPosition(species, position.x, position.y, { state });
            if (next) {
                position = next;
                await makemonAt(species, position.x, position.y, MM_NOMSG);
                if (state.program_state.gameover)
                    return;
            }
        }
    }
}
// C shk.c:shopper_financial_report().
export async function reportShopFinances() {
    const room = insideShopRoomAt(game, game.u.ux, game.u.uy);
    let current = room ? shopResident(room.roomno) : null;
    if (current && !current.eshk.credit && !shopDebt(current)) {
        await plineWithContinuation('You have no credit or debt in here.');
        current = null;
    }
    for (let pass = current ? 0 : 1; pass <= 1; pass++) {
        for (const keeper of [...(game.level?.monsters ?? [])].reverse()) {
            if (!keeper.isshk || keeper.dead || keeper.mhp <= 0 || !hasShopkeeperData(keeper))
                continue;
            if (!keeper.mpeaceful && !keeper.eshk.surcharge)
                rileShopkeeper(keeper);
            if ((keeper !== current) !== !!pass)
                continue;
            const credit = keeper.eshk.credit ?? 0;
            if (credit) {
                const shop = SHOP_TYPES[keeper.eshk.shoptype - SHOPBASE];
                if (!shop)
                    throw new Error(`Shopkeeper ${keeper.m_id} has no shop type.`);
                await plineWithContinuation(`You have ${credit} ${currency(credit)} credit at ${possessiveName(shopkeeperName(keeper))} ${shop.name}.`);
            }
            else if (keeper === current) {
                await plineWithContinuation('You have no credit in here.');
            }
            const debt = shopDebt(keeper);
            if (debt) {
                await plineWithContinuation(`You owe ${shopkeeperName(keeper)} ${debt} ${currency(debt)}.`);
            }
            else if (keeper === current) {
                await plineWithContinuation("You don't owe any gold here.");
            }
        }
    }
}
function shopDebt(keeper) {
    return addUpBill(keeper) + (keeper.eshk.debit ?? 0);
}
export async function settleShopkeepersOnExit(outcome, { silent = false, publish = plineWithContinuation, random = rn2 } = {}) {
    if (outcome === 'escaped')
        return false;
    requireShopGame(game);
    game._shopRepossession = { shopkeeper: null, location: { x: 0, y: 0 } };
    const first = preferredShopkeeper();
    const options = { croaked: outcome !== 'quit', silent, publish, random };
    let count = 0;
    let taken = false;
    if (first)
        taken = await inheritHeroInventory(first, ++count, options);
    for (const keeper of exitShopkeepers()) {
        const local = shopkeeperIsLocal(keeper);
        if (keeper !== first) {
            const claimed = await inheritHeroInventory(keeper, ++count, options);
            taken = taken || claimed;
        }
        // Bones must not retain a keeper whose shop belongs to another level.
        if (!local)
            await removeMonsterFromGame(keeper);
    }
    return taken;
}
// C shk.c:finish_paybill().
export async function finishShopkeeperRepossession() {
    const repository = game._shopRepossession;
    const keeper = repository?.shopkeeper ?? null;
    let { x, y } = repository?.location ?? { x: 0, y: 0 };
    if (!isok(x, y)) {
        if (keeper)
            await impossible(`finish_paybill: bad location <${x},${y}>.`, { state: game });
        ({ x, y } = heroRepositoryPosition());
    }
    releaseAllMonsterLeashes(game);
    const money = heroGoldAmount(game);
    if (keeper && money)
        await moneyToMonster(keeper, money);
    await dropHeroInventoryForBones(x, y);
}
function preferredShopkeeper() {
    let resident = null;
    let creditor = null;
    let hostile = null;
    let localKeeper = null;
    for (const keeper of exitShopkeepers()) {
        const shop = keeper.eshk;
        const local = shopkeeperIsLocal(keeper);
        if (local && game.u.ushops?.includes(shop.shoproom)) {
            if (!resident || shopkeeperHasDebt(keeper))
                resident = keeper;
        }
        else if (shopkeeperHasDebt(keeper)) {
            creditor ??= keeper;
        }
        else if (shop.following || !keeper.mpeaceful) {
            hostile ??= keeper;
        }
        else if (local) {
            localKeeper ??= keeper;
        }
    }
    return resident ?? creditor ?? hostile ?? localKeeper;
}
// C next_shkp(FALSE). Capture the list before this pass because mongone()
// removes its current member while the native loop retains the next pointer.
function* exitShopkeepers() {
    for (const keeper of [...(game.level?.monsters ?? [])].reverse()) {
        if (keeper.dead || keeper.mhp <= 0 || !keeper.isshk)
            continue;
        if (!hasShopkeeperData(keeper))
            throw new Error('Shopkeeper lacks shop history.');
        if (!keeper.mpeaceful && !keeper.eshk.surcharge)
            rileShopkeeper(keeper);
        yield keeper;
    }
}
async function inheritHeroInventory(keeper, count, options) {
    const { croaked, silent, publish, random } = options;
    const shop = keeper.eshk;
    const heroInShop = !!game.u.ushops?.includes(shop.shoproom);
    keeper.minvis = 0;
    keeper.perminvis = 0;
    if (count > 1) {
        if (cansee(keeper.mx, keeper.my) && croaked && !silent) {
            const shake = monsterHasHead(keeper) && !random(2)
                ? `, shakes ${monsterPossessive(keeper, { noIt: true, random })} ${monsterHeadName(keeper.mnum)},`
                : '';
            await publish(`${shopkeeperName(keeper, { capitalized: true })} ${monsterIsHelpless(keeper) ? 'wakes up, ' : ''}looks at your corpse${shake} and ${shopkeeperInOwnShop(keeper) ? 'sighs' : 'disappears'}.`);
        }
        await returnShopkeeperHome(keeper);
        return completeShopSettlement(keeper, heroInShop);
    }
    if (heroInShop && shopkeeperInOwnShop(keeper) && !shopkeeperHasDebt(keeper)
        && keeper.mpeaceful && !shop.following && (game.u.ugrave_arise ?? -1) < LOW_PM) {
        const taken = game.inventory.length > 0;
        if (taken && !silent)
            await publish(`${shopkeeperName(keeper, { capitalized: true })} gratefully inherits all your possessions.`);
        return completeShopSettlement(keeper, taken);
    }
    let loss = 0;
    const owed = shopkeeperHasDebt(keeper);
    if (owed) {
        if (heroInShop && shopkeeperInOwnShop(keeper))
            loss = addUpBill(keeper) + (shop.debit ?? 0);
        loss = Math.max(loss, shop.robbed ?? 0);
    }
    let taken = false;
    if (shop.following || !keeper.mpeaceful || owed) {
        if (game.inventory.length > 0) {
            const money = heroGoldAmount(game);
            const adjacent = dist2(keeper.mx, keeper.my, game.u.ux, game.u.uy) <= 2;
            const takes = `${monsterIsHelpless(keeper) ? 'wakes up and ' : ''}${adjacent ? '' : 'comes and '}takes`;
            if (loss > money || !loss || heroInShop) {
                shop.robbed = Math.max(0, (shop.robbed ?? 0) - money);
                if (money > 0)
                    await moneyToMonster(keeper, money);
                if (!silent)
                    await publish(`${shopkeeperName(keeper, { capitalized: true })} ${takes} all your possessions.`);
                taken = true;
            }
            else {
                await moneyToMonster(keeper, loss);
                if (!silent) {
                    const customer = (shop.customer ?? '').slice(0, PL_NSIZ) === game.plname.slice(0, PL_NSIZ);
                    await publish(`${shopkeeperName(keeper, { capitalized: true })} ${takes} the ${loss} ${currency(loss, { random })} ${customer ? 'you ' : ''}owed ${monsterObjectPronoun(keeper, { noIt: true })}.`);
                }
                pacifyShopkeeper(keeper);
                shop.following = 0;
                shop.robbed = 0;
            }
        }
        await returnShopkeeperHome(keeper);
    }
    return completeShopSettlement(keeper, taken);
}
async function returnShopkeeperHome(keeper) {
    requireShopGame(game);
    if (monsterIsHelpless(keeper)) {
        keeper.msleeping = 0;
        keeper.mfrozen = 0;
        keeper.mcanmove = 1;
    }
    if (!shopkeeperInOwnShop(keeper))
        await homeShopkeeper(keeper, game);
}
function completeShopSettlement(keeper, taken) {
    setPaidShopkeeper(keeper);
    if (taken && !game._shopRepossession?.shopkeeper) {
        let location = heroRepositoryPosition();
        if (!game.u.ushops?.includes(keeper.eshk.shoproom)
            || costlyAdjacent(keeper, location.x, location.y)) {
            const { shk: home, shd: door } = keeper.eshk;
            location = {
                x: home.x + Math.sign(home.x - door.x),
                y: home.y + Math.sign(home.y - door.y),
            };
        }
        game._shopRepossession = { shopkeeper: keeper, location };
    }
    return taken;
}
function heroRepositoryPosition() {
    return { x: game.u.ux || game.u.ux0, y: game.u.ux ? game.u.uy : game.u.uy0 };
}
function shopkeeperHasDebt(keeper) {
    const shop = keeper.eshk;
    return !!(shop.billct || shop.debit || shop.robbed);
}
function shopkeeperIsLocal(keeper) {
    const level = keeper.eshk.shoplevel;
    const heroLevel = game.u.uz;
    return !!heroLevel && level.dnum === heroLevel.dnum && level.dlevel === heroLevel.dlevel;
}
export async function nameShopTransaction(keeper, object, describe, { publish, state }) {
    let wasUnknown = !object.dknown;
    observeObject(object, state);
    if (!OBJECT_MAGIC[object.otyp] && shopStocksObject(keeper.eshk.shoptype, object)
        && ([WEAPON_CLASS, ARMOR_CLASS, SCROLL_CLASS, SPBOOK_CLASS].includes(object.oclass) || object.otyp === MIRROR)) {
        wasUnknown ||= !objectTypeKnown(object, state);
        learnObjectType(object.otyp, state);
    }
    observeObjectForNaming(object, { state });
    const name = await paymentObjectDescription(object, object.quan, { state });
    if (wasUnknown) {
        const subject = name.charAt(0).toUpperCase() + name.slice(1);
        await publish(`${subject}; you ${describe(object.quan > 1 ? 'them' : 'it')}`);
    }
    else {
        await publish(`You ${describe(name)}`);
    }
}
export async function quoteShopGoods() {
    if (heroIsBlind() || heroIsDeaf())
        return false;
    const spot = costlySpot(game.u.ux, game.u.uy);
    if (!spot || !spot.resident.mpeaceful || shopkeeperIsMuted(spot.resident))
        return false;
    const goods = game.level?.objects[game.u.ux]?.[game.u.uy]?.filter(object => object.oclass !== 12) ?? [];
    if (!goods.length)
        return false;
    const quotes = [];
    for (const object of goods) {
        let cost = object.no_charge || object === game.uball || object === game.uchain
            ? 0 : shopObjectUnitCost(object, spot.resident);
        const contentsOnly = !cost;
        if (object.contents?.length)
            cost += containedBuyCost(object, spot.resident, { unpaidOnly: false });
        if (object.globby)
            cost *= objectPricingUnits(object);
        observeObjectForNaming(object);
        const name = `${cost && contentsOnly ? 'the contents of ' : ''}${await objectDescription(object)}`;
        const each = object.quan > 1 ? ' each' : '';
        quotes.push({ object, cost, contentsOnly, each, name,
            line: `${name}, ${cost ? `${cost} ${currency(cost)}${each}` : 'no charge'}` });
    }
    const quote = quotes[0];
    if (!quote)
        throw new Error('Shop goods disappeared during a price quote.');
    if (quotes.length > 1) {
        await showDisclosureOverlay(['Fine goods for sale:', '', ...quotes.map(item => item.line)], { restoreUnderlay: true });
    }
    else if (!quote.cost) {
        await plineWithContinuation(`"${capitalize(quote.line)}!"`);
    }
    else {
        const name = `${quote.contentsOnly ? 'the contents of ' : ''}${await objectDescription(quote.object)}`;
        await plineWithContinuation(`"${capitalize(name)}, price ${quote.cost} ${currency(quote.cost)}${quote.each}${quote.contentsOnly ? '.' : embellish(quote.object, quote.cost)}"`);
    }
    return true;
}
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
// C shk.c:shk_embellish().
function embellish(object, cost) {
    if (!rn2(3)) {
        let choice = rn2(5);
        if (!choice)
            choice = cost < 100 ? 1 : cost < 500 ? 2 : 3;
        switch (choice) {
            case 4:
                if (cost < 10)
                    break;
                if (object.oclass === 7)
                    return ", gourmets' delight!";
                if (objectTypeKnown(object) ? OBJECT_MAGIC[object.otyp]
                    : [4, 5, 8, 9, 10, 11].includes(object.oclass))
                    return ', painstakingly developed!';
                return ', superb craftsmanship!';
            case 3: return ', finest quality.';
            case 2: return ', an excellent choice.';
            case 1: return ', a real bargain.';
        }
    }
    else if (object.oartifact)
        return ', one of a kind!';
    return '.';
}
const IZCHAK_SPEAKS = [
    "says: 'These shopping malls give me a headache.'",
    "says: 'Slow down.  Think clearly.'",
    "says: 'You need to take things one at a time.'",
    "says: 'I don't like poofy coffee... give me Colombian Supremo.'",
    "says that getting the devteam's agreement on anything is difficult.",
    "says that he has noticed those who serve their deity will prosper.",
    "says: 'Don't try to steal from me - I have friends in high places!'",
    "says: 'You may well need something from this shop in the future.'",
    'comments about the Valley of the Dead as being a gateway.',
];
export async function chatWithShopkeeper(monster, state = game) {
    if (!monster.isshk) {
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} asks whether you've seen any untended shops recently.`);
        return;
    }
    if (!hasShopkeeperData(monster))
        throw new Error('A shopkeeper needs its shop data to discuss business.');
    const shop = monster.eshk;
    const name = () => shopkeeperName(monster, { state, capitalized: true });
    const speaking = !heroIsDeaf(state) && !shopkeeperIsMuted(monster);
    const subject = () => monsterSubjectPronoun(monster, { state, noIt: true });
    let message;
    if (!monster.mpeaceful) {
        message = `${name()} ${speaking ? 'mentions' : 'indicates'} how much ${subject()} dislikes ${shop.robbed ? 'non-paying' : 'rude'} customers.`;
    }
    else if (shop.following) {
        if (shop.customer !== state.plname) {
            if (speaking)
                await plineWithContinuation(`"${shopGreeting(monster, state)} ${state.plname}!  I was looking for ${shop.customer}."`);
            shop.following = 0;
            return;
        }
        message = speaking ? `"${shopGreeting(monster, state)} ${state.plname}!  Didn't you forget to pay?"`
            : `${name()} taps you on the ${heroArmName(state)}.`;
    }
    else if (shop.billct) {
        const total = addUpBill(monster) + (shop.debit ?? 0);
        message = `${name()} ${speaking ? 'says' : 'indicates'} that your bill comes to ${total} ${currency(total, { state })}.`;
    }
    else if (shop.debit) {
        message = `${name()} ${speaking ? 'reminds you' : 'indicates'} that you owe ${monsterObjectPronoun(monster, { state, noIt: true })} ${shop.debit} ${currency(shop.debit, { state })}.`;
    }
    else if (shop.credit) {
        message = `${name()} encourages you to use your ${shop.credit} ${currency(shop.credit, { state })} of credit.`;
    }
    else if (shop.robbed) {
        message = `${name()} ${speaking ? 'complains' : 'indicates concern'} about a recent robbery.`;
    }
    else if (shop.surcharge) {
        message = `${name()} ${speaking ? 'warns you' : 'indicates'} that ${subject()} is watching you carefully.`;
    }
    else {
        const money = monsterGoldAmount(monster);
        if (money < 50 || money > 4000) {
            message = `${name()} ${speaking ? money < 50 ? 'complains' : 'says' : 'indicates'} that business is ${money < 50 ? 'bad' : 'good'}.`;
        }
        else {
            if (!speaking)
                return;
            const izchak = !heroIsHallucinating(state)
                && inTown(state.level, monster.mx, monster.my)
                && shop.shknam?.replace(/^[^A-Za-z]/, '') === 'Izchak';
            message = izchak ? `${shopkeeperName(monster, { state })} ${IZCHAK_SPEAKS[rn2(IZCHAK_SPEAKS.length)]}`
                : `${name()} talks about the problem of shoplifters.`;
        }
    }
    await plineWithContinuation(message);
}
export function shopkeeperBlockingDoor(x, y, state = game) {
    if (state.level?.at(x, y)?.typ !== DOOR)
        return null;
    const keeper = keeperForEntrance(x, y, state);
    if (!keeper || keeper.eshk.shoproom !== state.u.ushops?.[0])
        return null;
    const shop = keeper.eshk;
    return keeper.mx === shop.shk.x && keeper.my === shop.shk.y
        && shop.shd.x === x && shop.shd.y === y && !monsterIsHelpless(keeper)
        && (shop.debit || shop.billct || shop.robbed) ? keeper : null;
}
export function shopkeeperBlockingEntry(x, y, state = game) {
    const door = state.level?.at(state.u.ux, state.u.uy);
    if (door?.typ !== DOOR || door.doormask !== D_BROKEN)
        return null;
    const keeper = keeperForEntrance(x, y, state);
    if (!keeper || monsterIsHelpless(keeper))
        return null;
    const { shk: home, shd: entrance } = keeper.eshk;
    if (entrance.x !== state.u.ux || entrance.y !== state.u.uy
        || keeper.mx !== home.x || keeper.my !== home.y
        || !(Math.abs(x - home.x) === 1 || Math.abs(y - home.y) === 1))
        return null;
    return propertyIsActive('invisible', state) || state.u.usteed
        || state.inventory.some(object => object.otyp === PICK_AXE || object.otyp === DWARVISH_MATTOCK)
        ? keeper : null;
}
function keeperForEntrance(x, y, state) {
    const roomno = roomsAt(state.level, x, y, SHOPBASE)[0];
    // These two pinned C functions pass the encoded room number straight
    // to IS_SHOP(), which indexes rooms[] without removing ROOMOFFSET.
    if (roomno === undefined || (roomForIndex(state.level, roomno)?.rtype ?? 0) < SHOPBASE)
        return null;
    const keeper = shopResident(roomno, state);
    return keeper && shopkeeperInOwnShop(keeper, state) ? keeper : null;
}
export async function moneyToHero(monster, amount, state = game) {
    if (amount <= 0) {
        await impossible(`${amount ? 'negative' : 'zero'} payment in money2u!`, { state });
        return;
    }
    const coins = monster.minvent?.find(object => object.oclass === COIN_CLASS);
    if (!coins || coins.quan < amount) {
        await impossible(`${monsterName(monster, { state, article: 'a' })} paying without ${coins ? 'enough' : ''} gold?`, { state });
        return;
    }
    const payment = coins.quan > amount ? splitObjectStack(coins, amount, state) : coins;
    if (!payment)
        throw new Error('Shopkeeper could not split the payment coins.');
    unlinkObject(payment, state);
    const canMerge = state.inventory.some(object => mergable(object, payment, state));
    const slots = state.inventory.filter(object => object.invlet !== '$').length;
    if (!canMerge && slots >= 52) {
        await plineWithContinuation('You have no room for the gold!');
        await dropObjectAtHero(payment, { state });
    }
    else {
        await addInventoryItem(payment);
        state.context.botl = true;
    }
}
// C include/monflag.h enum msound: sounds at or below MS_ANIMAL are not speech.
const MS_ANIMAL = 17;
export function shopkeeperIsMuted(resident) {
    // C shk.c:58 muteshk(): helpless, or no capability for human speech.
    return monsterIsHelpless(resident)
        || (MONSTER_SOUND[resident?.mnum] ?? 0) <= MS_ANIMAL;
}
function objectQuan(object) {
    return object.quan ?? object.quantity ?? 1;
}
// C shk.c:1084 find_objowner(): on-bill objects belong to their billing
// shop; otherwise the rooms containing (x,y) claim via bill then resident.
export function findObjectOwner(object, x, y, state) {
    if (object.where === 'onbill') {
        for (const resident of visitBilledShopkeepers(state))
            if (onBillEntry(object, resident))
                return resident;
        return null;
    }
    let fallback = null;
    for (const roomno of roomsAt(state.level, x, y, SHOPBASE)) {
        const resident = shopResident(roomno, state);
        if (!hasShopkeeperData(resident))
            continue;
        if (onBillEntry(object, resident))
            return resident;
        if (!fallback)
            fallback = resident;
    }
    return fallback;
}
export function onBillEntry(object, resident) {
    return (resident?.eshk?.bill || [])
        .find(entry => entry.bo_id === object?.o_id) ?? null;
}
// C shk.c:1278 check_credit(): messages are not silent-gated in C.
async function checkShopCredit(value, resident, publish) {
    const credit = resident.eshk.credit ?? 0;
    if (credit === 0)
        return value;
    if (credit >= value) {
        await publish('The price is deducted from your credit.');
        resident.eshk.credit = credit - value;
        return 0;
    }
    await publish('The price is partially covered by your credit.');
    resident.eshk.credit = 0;
    return value - credit;
}
// C shk.c:get_pricing_units(): stack quantity, globs priced by weight.
export function objectPricingUnits(object) {
    let units = objectQuan(object);
    if (object.globby) {
        const unitWeight = OBJECT_WEIGHT[object.otyp] ?? 0;
        if (unitWeight) {
            const weight = object.owt > 0 ? object.owt : objectWeight(object);
            units = Math.trunc((weight + unitWeight - 1) / unitWeight);
        }
    }
    return units;
}
// C objnam Is_candle(): wax and tallow only; the candelabrum is a
// special_stock case, never a candle for pricing.
export function objectIsCandle(object) {
    return object.otyp === WAX_CANDLE || object.otyp === TALLOW_CANDLE;
}
function artifactCost(object, state) {
    const artifact = artifactById(object.oartifact, state);
    if (artifact?.cost)
        return artifact.cost;
    return 100 * (OBJECT_COST[object.otyp] ?? 0);
}
// C shk.c:4280 corpsenm_price_adj().
function corpsenmPriceAdj(object) {
    let value = 0;
    if ((object.otyp === TIN || object.otyp === EGG
        || object.otyp === CORPSE)
        && typeof object.corpsenm === 'number'
        && Number.isInteger(object.corpsenm) && object.corpsenm >= 0) {
        const mnum = object.corpsenm;
        let multiplier = 1;
        // C eat.c:intrinsic_possible() terms and shk.c price adders; the
        // shared owner keys them by the intrinsic property names.
        const intrinsicCosts = [
            ['fireResistance', 2], ['sleepResistance', 3], ['coldResistance', 2],
            ['disintegrationResistance', 5], ['shockResistance', 4],
            ['poisonResistance', 2], ['acidResistance', 1], ['stoneResistance', 3],
            ['teleportation', 2], ['teleportControl', 3], ['telepathy', 5],
        ];
        for (const [intrinsic, cost] of intrinsicCosts) {
            if (intrinsicPossible(intrinsic, mnum))
                multiplier += cost;
        }
        // C mondata.h unique_corpstat(): geno & G_UNIQ.
        if ((MONSTER_GENO[mnum] ?? 0) & G_UNIQ)
            multiplier += 50;
        const level = MONSTER_LEVEL[mnum];
        if (level === undefined)
            throw new Error(`Corpse species ${mnum} has no shop value`);
        value = Math.max(1, (level - 1) * 2);
        if (object.otyp === CORPSE) {
            // Only corpses add the nutrition term; tins and eggs do not.
            value += Math.max(1, Math.trunc((MONSTER_NUTRITION[mnum] ?? 0) / 30));
        }
        value = value * multiplier;
    }
    return value;
}
// C shk.c:4319 getprice(): one price owner for buying and selling.
export function shopGetPrice(object, shkBuying, state = game) {
    let tmp = OBJECT_COST[object.otyp] ?? 0;
    if (object.oartifact) {
        tmp = artifactCost(object, state);
        if (shkBuying)
            tmp = Math.trunc(tmp / 4);
    }
    if (object.oclass === 7 /* FOOD_CLASS */) {
        tmp += corpsenmPriceAdj(object);
        // Hungry buyers pay multiples of the food price; sellers never do.
        const hunger = state.u.uhs ?? 0;
        if (hunger >= HUNGRY && !shkBuying)
            tmp *= hunger;
        if (object.oeaten)
            tmp = 0;
    }
    else if (object.oclass === 11 /* WAND_CLASS */) {
        if (object.spe === -1)
            tmp = 0;
    }
    else if (object.oclass === 8 /* POTION_CLASS */) {
        if (object.otyp === POT_WATER && !object.blessed && !object.cursed)
            tmp = 0;
    }
    else if (object.oclass === 3 /* ARMOR */
        || object.oclass === 2 /* WEAPON_CLASS */) {
        if ((object.spe ?? 0) > 0)
            tmp += 10 * object.spe;
    }
    else if (object.oclass === 6 /* TOOL_CLASS */) {
        if (objectIsCandle(object)
            && (object.age ?? 0) < 20 * (OBJECT_COST[object.otyp] ?? 0)) {
            tmp = Math.trunc(tmp / 2);
        }
    }
    return tmp;
}
// C shk.c:contained_cost(usell = FALSE): buy-side price of contents.  The
// sell-side twin lives with the sell owner (js/shop_sell.js).
export function containedBuyCost(container, resident, { unpaidOnly = true, state = game } = {}) {
    let price = 0;
    let top = container;
    while (top.container)
        top = top.container;
    const onFloor = top.where === 'floor' || top.where === 'free';
    // C: a FREE top (or one without a location) prices from the hero's
    // coordinates; only a FLOOR top uses its own ox/oy.
    const x = top.where === 'floor' ? top.ox : state.u?.ux;
    const y = top.where === 'floor' ? top.oy : state.u?.uy;
    const home = resident?.eshk?.shk;
    const freeSpot = onFloor && home && x === home.x && y === home.y;
    for (const content of container.contents || []) {
        if (content.oclass === COIN_CLASS)
            continue;
        if (onFloor ? (!content.no_charge && !freeSpot)
            : (content.unpaid || !unpaidOnly)) {
            price += objectPricingUnits(content)
                * shopObjectUnitCost(content, resident, state);
        }
        if (content.contents?.length) {
            price += containedBuyCost(content, resident, { unpaidOnly, state });
        }
    }
    return price;
}
// C picked_container() (shk.c:3093): picking a no_charge container up again
// clears the flag from its contents.
export function pickedContainer(container) {
    for (const content of container.contents || []) {
        if (content.oclass === COIN_CLASS)
            continue;
        if (content.no_charge)
            content.no_charge = false;
        if (content.contents?.length)
            pickedContainer(content);
    }
}
// C shk.c:3450 billable(): does the shopkeeper claim this object's charge?
// Callers pass a validated resident or use validateShopkeeper() first.
export function shopClaimsObject(object, resident, resetNoCharge, state) {
    if (onBillEntry(object, resident)
        || (object.oclass === FOOD_CLASS && object.oeaten))
        return false;
    if (object.no_charge) {
        const hasContents = !!(object.contents?.length);
        const payable = hasContents
            && (containedGold(object, true) > 0
                || containedBuyCost(object, resident, { unpaidOnly: !resetNoCharge, state }) > 0);
        if (!payable) {
            if (resetNoCharge && object.oclass !== COIN_CLASS) {
                object.no_charge = false;
                if (hasContents)
                    pickedContainer(object);
            }
            return false;
        }
    }
    return true;
}
// C shop_keeper(roomno) + inhishop(shkp).
function validateShopkeeper(roomno, state) {
    const resident = shopResident(roomno, state);
    return hasShopkeeperData(resident) && shopkeeperInOwnShop(resident, state) ? resident : null;
}
// C shk.c:3713 stolen_container(): recursive content theft value.
async function stolenContainer(container, resident, { inInventory, state }) {
    let price = 0;
    for (const content of [...(container.contents || [])]) {
        if (content.oclass === COIN_CLASS)
            continue;
        let billamt = 0;
        if (!shopClaimsObject(content, resident, true, state)) {
            const entry = onBillEntry(content, resident);
            if (!entry)
                continue;
            billamt = (entry.bquan ?? 1) * entry.price;
            removeOneObjectFromBill(content, state);
        }
        if (billamt)
            price += billamt;
        else if (inInventory ? !!content.unpaid : !content.no_charge) {
            price += objectPricingUnits(content)
                * shopObjectUnitCost(content, resident, state);
        }
        if (content.contents?.length) {
            price += await stolenContainer(content, resident, { inInventory, state });
        }
    }
    return price;
}
function zorkmids(amount) {
    return `${amount} ${currency(amount)}`;
}
// C shk.c:3754 stolen_value().  World mutations (bills, credit, debit,
// robbed, pursuit, guards) are live-game only.
export async function stolenValue(object, x, y, peaceful, { silent = true, publish = plineWithContinuation, state = game } = {}) {
    requireLiveGame(state);
    const owner = findObjectOwner(object, x, y, state);
    const roomno = owner ? owner.eshk.shoproom
        : (roomsAt(state.level, x, y, SHOPBASE)[0] ?? 0);
    // gather information for message(s) prior to manipulating bill
    const wasUnpaid = !!object.unpaid;
    const container = !!(object.contents?.length);
    const cCount = container
        ? countContents(object, { quantity: false, everything: true }, state) : 0;
    const uCount = container
        ? countContents(object, { quantity: false, everything: false }, state) : 0;
    const resident = validateShopkeeper(roomno, state);
    let billamt = 0;
    if (!resident || !shopClaimsObject(object, resident, true, state)) {
        // things already on the bill are handled through their bill entry
        const entry = resident ? onBillEntry(object, resident) : null;
        if (entry) {
            billamt = (entry.bquan ?? 1) * entry.price;
            removeOneObjectFromBill(object, state);
        }
        if (!entry && !uCount)
            return 0;
    }
    if (!resident)
        throw new Error(`Billed contents at ${x},${y} have no resident shopkeeper`);
    let value = 0;
    let gvalue = 0;
    if (object.oclass === COIN_CLASS) {
        gvalue += objectQuan(object);
    }
    else {
        if (billamt)
            value += billamt;
        else if (!object.no_charge) {
            value += objectPricingUnits(object)
                * shopObjectUnitCost(object, resident, state);
        }
        if (container) {
            const inInventory = object.where === 'inventory'
                || object.where === 'free';
            value += await stolenContainer(object, resident, { inInventory, state });
            if (!inInventory)
                gvalue += containedGold(object, true);
        }
    }
    if (gvalue + value === 0)
        return 0;
    value += gvalue;
    if (peaceful) {
        const creditUse = !!(resident.eshk.credit ?? 0);
        value = await checkShopCredit(value, resident, publish);
        // charges after the shopkeeper is angry belong in robbed, not debit
        if (!resident.mpeaceful) {
            resident.eshk.robbed = (resident.eshk.robbed ?? 0) + value;
        }
        else {
            resident.eshk.debit = (resident.eshk.debit ?? 0) + value;
        }
        if (!silent) {
            let still = '';
            if (creditUse) {
                if (resident.eshk.credit) {
                    await publish(`You have ${zorkmids(resident.eshk.credit)} credit remaining.`);
                    return value;
                }
                else if (!value) {
                    await publish('You have no credit remaining.');
                    return 0;
                }
                still = 'still ';
            }
            let owed = `${still}owe ${shopkeeperName(resident)} ${zorkmids(value)}`;
            if (uCount) {
                owed += ` for ${wasUnpaid ? 'it and ' : ''}${cCount > uCount ? 'some of ' : ''}its contents`;
            }
            else if (object.oclass !== COIN_CLASS) {
                owed += ` for ${objectQuan(object) > 1 ? 'them' : 'it'}`;
            }
            await publish(`You ${owed}!`);
        }
    }
    else {
        resident.eshk.robbed = (resident.eshk.robbed ?? 0) + value;
        if (!silent) {
            if (canSeeMonster(resident)) {
                await publish(`${shopkeeperName(resident)} booms: "${state.plname || 'you'}, you are a thief!"`, { noRepeat: true });
            }
            else if (!heroIsDeaf(state)) {
                await publish('You hear a scream, "Thief!"', { noRepeat: true });
            }
        }
        // C runs pursuit and guard anger even when silent.
        await hotPursuitShopkeeper(resident, state);
        await angerWatchGuards(false);
    }
    return value;
}
// C shk.c:shk_move(): return 1: moved  0: didn't  -1: let m_move do it.
// Chooses a goal before move_special() selects a square.
export async function moveShopkeeper(monster, state, random, rollDice, rollOne, calls) {
    if (!monster.isshk || !hasShopkeeperData(monster))
        return null;
    const oldx = monster.mx;
    const oldy = monster.my;
    if (shopkeeperInOwnShop(monster, state))
        await shopkeeperRepairsDamage(monster, state);
    const eshk = monster.eshk;
    const heroX = state.u.ux;
    const heroY = state.u.uy;
    const distance = dist2(oldx, oldy, heroX, heroY);
    const home = eshk.shk;
    const atHome = oldx === home.x && oldy === home.y;
    const stopped = {
        oldx,
        oldy,
        x: oldx,
        y: oldy,
        moved: false,
        postMoveStatus: MMOVE_NOTHING,
        movementStage: 'postmov',
        shopkeeper: true,
    };
    if (distance < 3 &&
        (MONSTER_NAME[monster.mnum] !== 'grid bug' || oldx === heroX || oldy === heroY)) {
        if (!monster.mpeaceful ||
            (heroHasConflict(state) && !resistConflict(monster, state, rollOne, calls))) {
            if (heroIsDisplaced(state)) {
                await plineWithContinuation(`Your displaced image doesn't fool ${shopkeeperName(monster, { state })}!`);
            }
            return {
                ...stopped,
                deferredAfterSpecialAttack: true,
                ...await beginMonsterHeroAttack(monster, state, random, rollOne, rollDice, calls),
            };
        }
        if (eshk.following) {
            if ((eshk.customer ?? '').slice(0, PL_NSIZ) !== state.plname.slice(0, PL_NSIZ)) {
                if (!heroIsDeaf(state) && !shopkeeperIsMuted(monster)) {
                    await plineWithContinuation(`"${shopGreeting(monster, state)}, ${state.plname}!  I was looking for ${eshk.customer}."`);
                }
                eshk.following = false;
                return stopped;
            }
            if (state.moves > (state._shopFollowMessageTurn ?? 0) + 4) {
                if (!heroIsDeaf(state) && !shopkeeperIsMuted(monster)) {
                    await plineWithContinuation(`"${shopGreeting(monster, state)}, ${state.plname}!  Didn't you forget to pay?"`);
                }
                else {
                    await plineWithContinuation(`${shopkeeperName(monster, { state, capitalized: true })} holds out ${monsterPossessive(monster, { state, random, noIt: true })} upturned ${monsterHandName(monster.mnum)}.`);
                }
                state._shopFollowMessageTurn = state.moves;
                if (!recordRandom(random, calls, 9)) {
                    await plineWithContinuation(`${shopkeeperName(monster, { state, capitalized: true })} doesn't like customers who don't pay.`);
                    rileShopkeeper(monster);
                }
            }
            if (distance < 2)
                return stopped;
        }
    }
    let goalX = home.x;
    let goalY = home.y;
    let approach = 1;
    let heroOnDoor = false;
    let avoid = false;
    const holeTime = eshk.following ? -1 : diggingTimeToHole(state);
    if (eshk.following || (holeTime >= 0 && holeTime * holeTime <= distance)) {
        if (distance > 4 && eshk.following && !eshk.billct)
            return null;
        goalX = heroX;
        goalY = heroY;
    }
    else if (!monster.mpeaceful) {
        if (specialMoverSeesHero(monster, state)) {
            goalX = heroX;
            goalY = heroY;
        }
    }
    else if (!heroIsInvisible(state) && !state.u.usteed) {
        heroOnDoor = heroX === eshk.shd.x && heroY === eshk.shd.y;
        let hasDiggingTool = false;
        if (heroOnDoor) {
            const isPick = (object) => object.otyp === PICK_AXE || object.otyp === DWARVISH_MATTOCK;
            hasDiggingTool =
                state.inventory.some(isPick) ||
                    !!((state.u.fast || state.u.veryFast) &&
                        state.level.objects[heroX]?.[heroY]?.some(isPick));
            if (atHome && hasDiggingTool)
                return stopped;
            avoid = !hasDiggingTool;
        }
        else {
            avoid = state.u.ushops.length > 0 && dist2(heroX, heroY, home.x, home.y) > 8;
        }
        if (((!eshk.robbed && !eshk.billct && !eshk.debit) || avoid) &&
            dist2(oldx, oldy, home.x, home.y) < 3) {
            if (!hasDiggingTool && !pointsOnline(oldx, oldy, heroX, heroY))
                return stopped;
            if (atHome)
                approach = goalX = goalY = 0;
        }
    }
    const movement = await moveSpecial(monster, state, random, rollDice, rollOne, calls, {
        inHisShop: shopkeeperInOwnShop(monster, state),
        approach,
        heroOnDoor,
        avoid,
        goalX,
        goalY,
    });
    return { ...movement, shopkeeper: true };
}
// C shk.c:set_residency(): a shopkeeper leaving her shop level clears
// the room's resident pointer; arriving on it restores the pointer.
export function setShopResidency(monster, zeroOut, state) {
    if (!monster.isshk || !monster.eshk)
        return;
    if (!sameShopLevel(monster.eshk.shoplevel, state.u?.uz))
        return;
    const room = roomForRoomno(state.level, monster.eshk.shoproom);
    if (room)
        room.resident = zeroOut ? null : monster;
}
function sameShopLevel(first, second) {
    return !!first && !!second
        && first.dnum === second.dnum
        && first.dlevel === second.dlevel;
}
//# sourceMappingURL=shk.js.map