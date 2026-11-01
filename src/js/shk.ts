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
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { Monster, ShopBillEntry, MonsterFlag } from './monster_types.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { Room, Stairway, Position } from './map_types.js';
import type { MessagePublisher } from './pline.js';
import { hasShopBill, hasShopkeeperData, requireShopGame, type ShopGameState, type ShopBillItem } from './shop_types.js';
import type {
    BilledShopkeeper, CostlyShopSpot,
    Shopkeeper, ShopRoom, ShopTransaction,
} from './shop_types.js';
import { SHOP_TYPES, saleable } from './shknam.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, monsterIsHuman, monsterIsVampire, monsterHasHead, MONSTER_SOUND, MONSTER_LEVEL, MONSTER_NUTRITION, monsterHasNoLimbs } from './monster_data.js';
import { heroSpecies } from './hero_species.js';
import { monsterName } from './do_name.js';
import { possessiveName, depth, distmin } from './hacklib.js';
import { monsterPossessive, monsterSubjectPronoun, monsterIsHelpless, monsterObjectPronoun } from './mondata.js';
import { shopkeeperName, shopStocksObject } from './shknam.js';
import { containedGold, hiddenGold } from './gold.js';
import { canSeeMonster, canSenseMonster, flush_screen, canSpotMonster } from './display.js';
import { pline, plineWithContinuation } from './pline.js';
import { currency } from './currency.js';
import { simpleObjectName, objectTypeName, objectName, objectCombatName, definiteName, observeObjectForNaming, simpleObjectNameWithArticle } from './objnam.js';
import { rn2, rnd } from './rng.js';
import { recordRandom } from './monster_action_types.js';
import { heroGoldAmount, monsterGoldAmount } from './hero_gold.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { propertyIsActive } from './properties.js';
import { publishMonsterWake, angerWatchGuards, removeMonsterFromGame } from './mon.js';
import { A_CHA, A_WIS, ANTHOLE, BARRACKS, BEEHIVE, COCKNEST, COURT, DELPHI, In_mines, LEPREHALL, M_AP_NOTHING, M_AP_MONSTER, M_AP_TYPE, MMOVE_NOTHING, MORGUE, OROOM, PL_NSIZ, ROOMOFFSET, SHOPBASE, SWAMP, TEMPLE, THRONE, Upolyd, MGIVENNAME, ZOO, LL_ACHIEVE, G_GONE, isok, MM_NOMSG, LOW_PM, DOOR, D_BROKEN, HUNGRY, QBUFSZ, MENU_FULL, MENU_TRADITIONAL } from './const.js';
import { insideRoom, inTown, roomForRoomno, roomsAt, updateHeroRoomMembership, roomForIndex } from './room.js';
import { searchSpecial } from './mkroom.js';
import { intemple } from './priest.js';
import { recordDiscoveredRoom, dungeonBuildsUp } from './dungeon.js';
import { BAG_OF_TRICKS, BRASS_LANTERN, CAN_OF_GREASE, CHEST, CORPSE, CRYSTAL_BALL, DRUM_OF_EARTHQUAKE, EXPENSIVE_CAMERA, HORN_OF_PLENTY, ICE_BOX, LARGE_BOX, MAGIC_FLUTE, MAGIC_LAMP, MAGIC_MARKER, OBJECT_CHARGED, OBJECT_COST, OBJECT_NAMES, OBJECT_INITIAL_KNOWN, DUNCE_CAP, OIL_LAMP, POT_OIL, TINNING_KIT, WORTHLESS_PIECE_OF_WHITE_GLASS, PICK_AXE, DWARVISH_MATTOCK, OBJECT_MAGIC, MIRROR, POT_WATER, WAX_CANDLE, TALLOW_CANDLE, OBJECT_WEIGHT, TIN, EGG, CANDELABRUM_OF_INVOCATION } from './object_data.js';
import { learnObjectType, recordObjectPriceQuote, observeObject } from './object_knowledge.js';
import { ACH_SHOP, ACH_TOWN, recordAchievement } from './achievements.js';
import { nextIdent, nextObjectId } from './ident.js';
import { moneyToMonster, pacifyShopkeeper, rileShopkeeper, shopkeeperCustomerInsult, setPaidShopkeeper, hotPursuitShopkeeper, addUpBill, homeShopkeeper, makeShopkeeperHappy } from './shop_damage.js';
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
import type { PlayingGameState } from './game_state.js';
import type {
    MonsterCallLog, MonsterMovement, RandomBelow, RollDice, RollOne,
} from './monster_action_types.js';
import { adjustHeroAlignment } from './alignment.js';
import { dropHeroInventoryForBones } from './bones_death.js';
import { recordGameLogEvent } from './gamelog.js';
import { releaseAllMonsterLeashes } from './leash_apply.js';
import { makemonAt } from './makemon.js';
import { SPBOOK_CLASS, FOOD_CLASS } from './mklev.js';
import { paymentObjectDescription, objectDescription } from './object_description.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { cansee } from './vision.js';
import { showDisclosureOverlay, showMultiSelectWindow } from './windows.js';
import { dropObjectAtHero } from './object_drop.js';
import { mergable } from './object_merge.js';
import { splitObjectStack } from './object_stack.js';
import { addInventoryItem } from './u_init.js';
import { intrinsicPossible } from './corpse_intrinsics.js';
import type { CorpseIntrinsic } from './corpse_intrinsics.js';
import { countContents } from './invent.js';
import { objectWeight } from './weight.js';
import { artifactById } from './artifacts.js';
import { bot } from './botl.js';
import { setMulti, commandResultCancelled } from './command_state.js';
import { showGetposTip, showGetposInstructions, selectMapPosition } from './getpos.js';
import { promptYesNo, promptChoice, promptYesNoAllQuit } from './query.js';
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

// C objclass.h class codes used by the sell path.
const TOOL_CLASS = 6;
const POTION_CLASS = 8;
const WAND_CLASS = 11;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const FIRST_REAL_GEM = OBJECT_NAMES.indexOf('dilithium crystal');

function sameLevel(a: DungeonLocation | null | undefined, b: DungeonLocation | null | undefined): boolean {
    return (a?.dnum ?? 0) === (b?.dnum ?? 0)
        && (a?.dlevel ?? 1) === (b?.dlevel ?? 1);
}

// C inside_shop(): a room boundary is not merchandise floor space.
export function insideShopRoomAt(state: GameState, x: number, y: number): ShopRoom | null {
    const location = state.level?.at?.(x, y);
    const roomno = location?.roomno ?? 0;
    if (roomno < ROOMOFFSET || location?.edge) return null;
    const room = roomForRoomno(state.level, roomno);
    return room && room.rtype >= SHOPBASE ? { room, roomno } : null;
}

// C callers using *in_rooms() select the first matching shop. Membership
// checks must use the full roomsAt() list instead.
function firstShopRoomAt(state: GameState, x: number, y: number): ShopRoom | null {
    const roomno = roomsAt(state.level, x, y, SHOPBASE)[0];
    if (roomno === undefined) return null;
    const room = roomForRoomno(state.level, roomno);
    return room ? { room, roomno } : null;
}

// C inhishop() includes the room boundary, unlike inside_shop().  Monster
// pickup and shop-resident validity need this broader predicate.
export function shopkeeperInOwnShop(
    monster: Monster | null | undefined, state: GameState = game,
): boolean {
    if (!monster?.isshk || !monster?.eshk) return false;
    if (!sameLevel(monster.eshk.shoplevel, state?.u?.uz)) return false;
    return roomsAt(state.level, monster.mx, monster.my, SHOPBASE)
        .includes(monster.eshk.shoproom);
}

// C tended_shop(): checking residency must not apply shop_keeper()'s surcharge.
export function tendedShop(room: Room | null | undefined, state: GameState = game): boolean {
    return shopkeeperInOwnShop(room?.resident, state);
}

// C end.c:done_in_by().  General shopkeeper names carry a gendered
// honorific in killer identity; prefix-coded personal names (-, +, =) do
// not.  formatkiller() later changes the descriptive comma to a semicolon,
// so expose the already-sanitized identity consumed by both the tombstone
// and score record.
export function shopkeeperKillerName(monster: Monster): string {
    const raw = monster?.eshk?.shknam || monster?.name || 'shopkeeper';
    const personal = /^[-+=]/.test(raw);
    const honorific = personal ? '' : monster?.female ? 'Ms. ' : 'Mr. ';
    return `${honorific}${shopkeeperName(monster)}; the shopkeeper`;
}

// C objects[otyp].oc_name_known belongs to the type, never to an instance.
export function objectTypeKnown(
    object: Pick<GameObject, 'otyp'> & Partial<Pick<GameObject, 'oclass'>>,
    state: GameState = game,
): boolean {
    return !!OBJECT_INITIAL_KNOWN[object.otyp]
        || !!state._knownObjectTypes?.has(object.otyp);
}

function shopkeeperForRoom(roomno: number | undefined, state: GameState = game): Shopkeeper | null {
    if (!roomno) return null;
    const resident = shopResident(roomno, state);
    return resident && shopkeeperInOwnShop(resident, state) ? resident : null;
}

// C shop_keeper(): the assigned resident may be outside the shop.
// Looking up an angry keeper also applies the bill surcharge.
export function shopResident(roomno: number | undefined, state: GameState = game): Shopkeeper | null {
    if (roomno === undefined) return null;
    const keeper = roomForRoomno(state.level, roomno)?.resident;
    if (!hasShopkeeperData(keeper)) return null;
    if (!keeper.mpeaceful && !keeper.eshk.surcharge) rileShopkeeper(keeper);
    return keeper;
}

// C replshk(): the bill stays on eshk; reconnect the room's resident.
// Carried remains can revive on a level without the original room.
export function restoreShopkeeperResidency(monster: Monster, state: GameState = game): void {
    if (!hasShopkeeperData(monster)) return;
    const room = roomForRoomno(state.level, monster.eshk.shoproom);
    if (room) room.resident = monster;
}

export function currentShopResident(state: GameState = game): Shopkeeper | null {
    requireLiveGame(state);
    return shopResident(state.u.ushops?.[0], state);
}

export function shopkeeperForHero(state: GameState = game): Shopkeeper | null {
    return shopkeeperForRoom(state.u.ushops?.[0], state);
}

// Native bill compaction preserves the overwritten slot's identity.
function copyBillEntry(target: ShopBillEntry, source: ShopBillEntry): void {
    target.bo_id = source.bo_id;
    target.bquan = source.bquan;
    target.price = source.price;
    target.useup = source.useup;
}

export function shopThankYouMessage(resident: Monster): string {
    const typeName = SHOP_TYPES[
        (resident?.eshk?.shoptype ?? SHOPBASE) - SHOPBASE
    ]?.name || 'shop';
    const enthusiastic = !resident.eshk?.surcharge;
    const end = enthusiastic ? '!' : '.';
    if (!heroIsDeaf() && !shopkeeperIsMuted(resident))
        return `"Thank you for shopping in ${possessive(shopkeeperName(resident))} ${typeName}${end}"`;
    return `${shopkeeperName(resident, { capitalized: true })} nods${enthusiastic ? ' appreciatively' : ''} at you for shopping in ${monsterPossessive(resident, { noIt: true })} ${typeName}${end}`;
}

export function costlySpot(x: number, y: number, state: GameState = game): CostlyShopSpot | null {
    if (!state.level?.flags.has_shop) return null;
    const spot = insideShopRoomAt(state, x, y);
    if (!spot) return null;
    const resident = shopkeeperForRoom(spot.roomno, state);
    if (!resident) return null;
    const home = resident.eshk?.shk;
    if (home && x === home.x && y === home.y) return null;
    return { ...spot, resident };
}

// C dothrow.c:check_shop_obj(). Broken objects settle through the hero's
// current shop. Intact returns remove bills or offer a sale before stacking.
export function objectIsUnpaid(object: GameObject): boolean {
    return Boolean(object.unpaid)
        || (object.contents || []).some(objectIsUnpaid);
}

export async function settleThrownShopObject(
    object: GameObject, x: number, y: number, state: GameState = game,
    publish: MessagePublisher = plineWithContinuation,
    { broken = false } = {},
) {
    requireLiveGame(state);
    requireShopGame(state);
    const heroShop = state.u.ushops[0];
    const resident = shopResident(heroShop, state);
    if (!resident) return false;
    const spot = costlySpot(x, y, state);
    const objectRoom = roomsAt(state.level, x, y, SHOPBASE)[0];
    if (broken || !spot || objectRoom !== heroShop) {
        if (objectIsUnpaid(object))
            await stolenValue(object, state.u.ux, state.u.uy, resident.mpeaceful, {
                state, publish, silent: false,
            });
        if (broken) object.no_charge = true;
        return true;
    }
    const previousRoom = state.u.ushops0[0];
    if (objectRoom === heroShop || objectRoom === previousRoom) {
        if (objectIsUnpaid(object)) {
            const gold = containedGold(object, true);
            removeObjectAndContentsFromBill(object, state, { resident });
            if (gold > 0) await donateGold(gold, resident, { selling: true, publish });
        } else if (x !== resident.mx || y !== resident.my) {
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
export function objectPriceAdjustment(object: GameObject, oid: number, state: GameState = game): number {
    const known = !!object?.dknown && objectTypeKnown(object, state);
    const glassGem = object?.oclass === GEM_CLASS
        && objectMaterial(object.otyp) === GLASS;
    if (!known && !glassGem) return ((oid % 4) === 0) ? 1 : 0;
    return 0;
}

export function shopObjectUnitCost(object: GameObject, resident: Monster | null = null, state: GameState = game): number {
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
            const imitations = glassGemImitations[
                object.otyp - WORTHLESS_PIECE_OF_WHITE_GLASS
            ];
            const imitation = imitations?.[pseudorand ? 0 : 1];
            const imitationCost = imitation === undefined ? undefined : OBJECT_COST[imitation];
            if (imitationCost === undefined)
                throw new Error(`Glass gem ${object.otyp} has no shop imitation price`);
            cost = imitationCost;
        } else if (objectPriceAdjustment(object, object.o_id, state) > 0) {
            multiplier *= 4;
            divisor *= 3;
        }
    }

    if (state?.uarmh?.otyp === DUNCE_CAP) {
        multiplier *= 4;
        divisor *= 3;
    } else if ((state?.urole?.key === 'tourist'
            && (state?.u?.ulevel ?? 1) < 15)
        || (state?.uarmu && !state?.uarm && !state?.uarmc)) {
        multiplier *= 4;
        divisor *= 3;
    }

    const charisma = currentAttribute(A_CHA, state);
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
    if (object.oartifact) cost *= 4;
    if (resident?.eshk?.surcharge)
        cost += Math.trunc((cost + 2) / 3);
    return cost;
}

// C shk.c:cost_per_charge(). Fractions use C integer division.
function shopUsageCost(object: GameObject, resident: Shopkeeper, alternate: boolean, state: GameState): number {
    let cost = shopObjectUnitCost(object, resident, state);
    const type = object.otyp;
    if (type === MAGIC_LAMP) {
        const oilLampCost = OBJECT_COST[OIL_LAMP];
        if (oilLampCost === undefined) throw new Error('Oil lamp shop price is missing');
        return alternate ? cost + Math.trunc(cost / 3) : oilLampCost;
    }
    if (type === MAGIC_MARKER) return Math.trunc(cost / 2);
    if (type === BAG_OF_TRICKS || type === HORN_OF_PLENTY)
        return alternate ? cost : Math.trunc(cost / 5);
    if ([CRYSTAL_BALL, OIL_LAMP, BRASS_LANTERN].includes(type)
        || type >= MAGIC_FLUTE && type <= DRUM_OF_EARTHQUAKE
        || object.oclass === 11)
        return object.spe > 1 ? Math.trunc(cost / 4) : cost;
    if (object.oclass === 10) return cost - Math.trunc(cost / 5);
    if ([CAN_OF_GREASE, TINNING_KIT, EXPENSIVE_CAMERA].includes(type))
        return Math.trunc(cost / 10);
    if (type === POT_OIL) return Math.trunc(cost / 5);
    return cost;
}

// Partial use adds debt without consuming or settling the billed object.
// C shk.c:check_unpaid_usage(). Prefix rolls precede the hearing check.
export async function chargeUnpaidUsage(object: GameObject, {
    state = game, alternate = false,
}: { state?: GameState; alternate?: boolean } = {}) {
    if (!object.unpaid || !state.u.ushops?.length
        || object.spe <= 0 && OBJECT_CHARGED[object.otyp]) return null;
    const resident = shopkeeperForHero(state);
    if (!resident) return null;
    const amount = shopUsageCost(object, resident, alternate, state);
    if (!amount) return null;

    const money = () => `${amount} ${currency(amount, { state })}`;
    let text: () => string;
    if (object.oclass === 10) {
        const insult = shopkeeperCustomerInsult(state);
        const prefix = rn2(2) ? `This is no free library, ${insult}!  ` : '';
        const extra = (resident.eshk.debit ?? 0) > 0 ? ' an additional' : '';
        text = () => `${prefix}You owe${extra} ${money()}.`;
    } else if (object.otyp === POT_OIL) {
        text = () => `That will cost you ${money()} (Yendorian Fuel Tax).`;
    } else if (alternate
        && [BAG_OF_TRICKS, HORN_OF_PLENTY].includes(object.otyp)) {
        let prefix = rn2(3) === 0 ? 'Whoa!  ' : '';
        if (rn2(3) === 0) prefix = 'Watch it!  ';
        text = () => `${prefix}Emptying that will cost you ${money()}.`;
    } else {
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

export function getCostOfShopItem(object: GameObject | null | undefined, state: GameState = game) {
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
    if (!shop) return { price: 0, noCharge: -1 };
    const resident = shopResident(shop.roomno, state);
    if (!resident || !shopkeeperInOwnShop(resident, state))
        return { price: 0, noCharge: -1 };

    let top = object;
    while (top.where === 'contained') {
        if (!top.container) throw new Error(`Contained object ${top.o_id} has no container`);
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
export function* visitBilledShopkeepers(state: GameState = game): Generator<BilledShopkeeper> {
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
export function repriceDiscoveredGems(otyp: number, state: GameState = game): void {
    const objects = objectsInTimerGraph(state);
    for (const keeper of visitBilledShopkeepers(state)) {
        for (const entry of keeper.eshk.bill) {
            const object = objects.find(candidate => candidate.o_id === entry.bo_id
                && candidate.where !== 'free' && candidate.where !== 'onbill');
            if (!object) break;
            if (otyp === 0 ? object.oclass === GEM_CLASS : object.otyp === otyp)
                entry.price = shopObjectUnitCost(object, keeper, state);
        }
    }
}

export interface BilledObject {
    resident: BilledShopkeeper;
    entry: ShopBillEntry;
}

// C shk.c:onbill().
export function billForObject(
    object: Pick<GameObject, 'o_id'> | null | undefined,
    state: GameState = game, resident: Monster | null = null,
): BilledObject | null {
    // C onbill(): with a keeper given, only that keeper's bill answers;
    // other shops' bills stay untouched.
    const keepers = resident ? [resident]
        : [...(state.level?.monsters ?? [])].reverse();
    for (const keeper of keepers) {
        if (keeper.dead || keeper.mhp <= 0 || !hasShopBill(keeper)) continue;
        const bill = keeper.eshk.bill;
        const entry = bill.find(candidate => candidate.bo_id === object?.o_id);
        if (entry) return { resident: keeper, entry };
    }
    return null;
}

// C shk.c:sub_one_frombill().
export function removeOneObjectFromBill(object: GameObject, state: GameState = game,
    resident: Monster | null = null,
) {
    const billed = billForObject(object, state, resident);
    if (!billed) {
        if (object?.unpaid) object.unpaid = false;
        return null;
    }
    const eshk = billed.resident.eshk;
    const removedEntry = { ...billed.entry };
    const objectQuantity = Math.max(
        1, object.quan ?? object.quantity ?? 1,
    );
    const billedQuantity = Math.max(1, billed.entry.bquan ?? 1);
    const removedQuantity = Math.min(objectQuantity, billedQuantity);
    if (billedQuantity > objectQuantity) {
        // The missing part of the stack was already used and is still owed.
        const usedQuantity = billedQuantity - objectQuantity;
        const usedObject: GameObject = {
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
    } else {
        const last = eshk.bill.pop();
        if (last && last !== billed.entry) copyBillEntry(billed.entry, last);
    }
    eshk.billct = eshk.bill.length;
    object.unpaid = false;
    return { resident: billed.resident, entry: removedEntry, removedQuantity };
}

// C shk.c:subfrombill().
export function removeObjectAndContentsFromBill(
    object: GameObject, state: GameState = game,
    { resident = null }: { resident?: Monster | null } = {},
) {
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
export async function chargeUnpaidObjectAsDebt(
    object: GameObject,
    state: GameState = game,
    publish: MessagePublisher = plineWithContinuation,
) {
    if (!object?.unpaid) return null;
    const resident = currentShopResident(state);
    if (!resident) return null;
    return stolenValue(object, state.u.ux, state.u.uy, resident.mpeaceful,
        { silent: false, state, publish });
}

export async function payShopDebt(resident: Monster | null | undefined, state: GameState = game) {
    const eshk = resident?.eshk;
    const debt = Math.max(0, eshk?.debit ?? 0);
    if (!resident || !eshk || !debt) return { paid: false, debt: 0 };

    const credit = Math.max(0, eshk.credit ?? 0);
    const gold = heroGoldAmount(state);
    if (credit + gold < debt) return { paid: false, debt };

    const creditUsed = Math.min(credit, debt);
    const goldPaid = debt - creditUsed;
    eshk.credit = credit - creditUsed;
    if (goldPaid) await moneyToMonster(resident, goldPaid, state);
    eshk.debit = 0;
    eshk.loan = 0;
    return { paid: true, debt, creditUsed, goldPaid };
}

// C shk.c splitbill(): otmp has been split off from obj.  The keeper is
// the CURRENT first hero-shop resident (inhishop-validated), not any
// owner; the original entry's quantity shrinks and the split either
// clones the recorded price into a fresh entry or, on a full bill, simply
// stops being unpaid.
export function splitObjectBill(original: GameObject, split: GameObject, state: GameState = game): void {
    requireShopGame(state);
    const resident = shopResident(state.u.ushops[0], state);
    const keeper = shopkeeperInOwnShop(resident, state) && hasShopBill(resident) ? resident : null;
    if (!keeper) return;

    const entry = (keeper.eshk.bill || [])
        .find(candidate => candidate.bo_id === original?.o_id);
    if (!entry) return;

    const splitQuan = split?.quan ?? split?.quantity ?? 1;
    // C guards against negative and zero residual quantities.
    if ((entry.bquan ?? 1) < splitQuan) return;
    if ((entry.bquan ?? 1) === splitQuan) return;
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
function retainBillObject(object: GameObject, state: GameState): void {
    if (object.where !== 'free')
        throw new Error('add_to_billobjs requires a free object');
    if (object.timed) stopObjectTimers(object, state);
    state.billObjects ||= [];
    state.billObjects.unshift(object);
    object.where = 'onbill';
    object.in_use = false;
    object.bypass = false;
}

export function moveUsedObjectToBill(object: GameObject | null | undefined, state: GameState = game, resident: Monster | null = null) {
    if (!object) return null;
    const billed = billForObject(object, state, resident);
    if (!billed) return null;
    billed.entry.useup = true;
    if (object.globby && !object.owt && object.oextra?.omid)
        object.owt = object.oextra.omid;
    object.unpaid = false;
    retainBillObject(object, state);
    return { ...billed, object };
}

// The billing branch of C obfree(). Keep retained or inconsistent billed
// identities out of raw deallocation; ordinary merges add quantity, not price.
export function reconcileObjectDeletionBill(object: GameObject, mergeInto: GameObject | null, state: GameState = game) {
    let keeper: Shopkeeper | null = null;
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
    if (!entry || !hasShopBill(keeper)) return 'unbilled';
    if (!mergeInto) {
        moveUsedObjectToBill(object, state, keeper);
        return 'retained';
    }
    const target = billForObject(mergeInto, state, keeper)?.entry;
    if (!target) return 'blocked'; // C impossible(): do not deallocate.
    target.bquan += entry.bquan;
    const last = keeper.eshk.bill.pop();
    if (last && entry !== last) copyBillEntry(entry, last);
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
export async function billDummyObject(object: GameObject, state: GameState = game): Promise<ShopTransaction | null> {
    requireLiveGame(state);
    requireShopGame(state);
    let cost = 0;
    if (object.unpaid) {
        // C unpaid_cost(COST_SINGLEOBJ): scan current shop rooms for the
        // per-unit charge, then remove from the first room's keeper below.
        for (const roomno of state.u.ushops) {
            const keeper = shopResident(roomno, state);
            const billed = keeper && billForObject(object, state, keeper);
            if (!billed) continue;
            cost = billed.entry.price;
            break;
        }
        removeObjectAndContentsFromBill(object, state,
            { resident: currentShopResident(state) });
    }
    const dummy: GameObject = {
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
    if (dummy.oextra) delete dummy.oextra.omid;
    dummy.o_id = nextObjectId(object, dummy, state);
    if (objectIsCandle(dummy)) dummy.lamplit = 0;
    const transaction = await addShopObjectToBill(dummy, state,
        { ininv: false, silent: true });
    if (transaction) {
        if (!transaction.entry) throw new Error('A billed dummy object has no bill entry');
        // C add_one_tobill(dummy=TRUE): used-up entries live on the bill.
        transaction.entry.useup = true;
        retainBillObject(dummy, state);
        if (cost) {
            // C alter_cost(dummy, -cost): visit keepers in monster order,
            // including their riling, then replace the unit price.
            for (const owner of visitBilledShopkeepers(state)) {
                const billed = billForObject(dummy, state, owner);
                if (!billed) continue;
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
export async function settleGlobAbsorptionBilling(
    absorber: GameObject, absorbed: GameObject, state: GameState = game,
    { publish = plineWithContinuation }: { publish?: MessagePublisher } = {},
): Promise<void> {
    requireLiveGame(state);
    const floorAbsorber = absorber.where === 'floor';
    let keeper: Shopkeeper | null = null;
    if (absorber.unpaid) {
        for (const candidate of visitBilledShopkeepers(state)) {
            if (billForObject(absorber, state, candidate)) {
                keeper = candidate;
                break;
            }
        }
    } else if (absorbed.unpaid && absorbed.where === 'free' && floorAbsorber) {
        keeper = costlySpot(absorber.ox, absorber.oy, state)?.resident ?? null;
    }
    keeper ||= currentShopResident(state);
    if (!keeper) return;

    const absorberEntry = billForObject(absorber, state, keeper)?.entry;
    const absorbedEntry = billForObject(absorbed, state, keeper)?.entry;
    const shop = keeper.eshk;
    const offer = shopOfferForObject(absorbed, keeper, state);
    const name = objectTypeName(absorbed.otyp, state);
    const money = (amount: number) => `${amount} ${currency(amount, { state })}`;

    if (absorbedEntry && (!absorber.no_charge
        || shopClaimsObject(absorber, keeper, false, state))) {
        const amount = absorbedEntry.price;
        // C copies the last bill slot into the removed slot. Saved bill
        // pointers still refer to their original slots, even the old last one.
        const bill = shop.bill;
        if (!bill) throw new Error('A billed glob has no shop bill');
        const last = bill.pop();
        if (last && absorbedEntry !== last) copyBillEntry(absorbedEntry, last);
        shop.billct = bill.length;
        if (absorberEntry) absorberEntry.price += amount;
        return;
    }

    if (!absorberEntry && !absorbedEntry && !absorber.no_charge) {
        const amount = objectPricingUnits(absorbed) * offer;
        if (!shopStocksObject(shop.shoptype, absorbed)) return;
        if ((shop.debit ?? 0) >= amount) {
            if (shop.loan) shop.loan = Math.max(0, shop.loan - amount);
            shop.debit = (shop.debit ?? 0) - amount;
            await publish(`The donated ${name} ${
                shop.debit ? 'partially ' : ''}pays off your debt.`);
        } else {
            const delta = amount - (shop.debit ?? 0);
            shop.credit = (shop.credit ?? 0) + delta;
            if (shop.debit) {
                shop.debit = 0;
                shop.loan = 0;
                await publish('Your debt is paid off.');
            }
            if (shop.credit === delta) {
                await publish(`The ${name} established ${money(delta)} credit.`);
            } else {
                await publish(`The ${name} added ${money(delta)} to your credit; total is now ${money(shop.credit)}.`);
            }
        }
        return;
    } else if (absorberEntry) {
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
export async function chargeAlteredUnpaidObject(
    object: GameObject, verb: string, state: GameState = game,
) {
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
    let keeper: Shopkeeper | null = null;
    if (object.where === 'inventory' || object.where === 'free') {
        // C: OBJ_FREE catches obj_no_longer_held()'s crysknife revert.
        if (!object.unpaid) return null;
    } else {
        // C get_obj_location(..., CONTAINED_TOO) over the root: floor
        // yields its own coordinates, a monster-carried root its carrier's
        // (a migrating carrier with mx 0 fails the lookup), inventory
        // resolves to the hero, and free/buried roots fail outright -
        // the caller then falls back to the hero (mkobj.c:776-785).
        let top = object;
        while (top.container) top = top.container;
        let located = false;
        if (top.where === 'floor') {
            ox = top.ox;
            oy = top.oy;
            located = true;
        } else if (top.where === 'minvent') {
            const carrier = top.ocarry
                || (state.level?.monsters || []).find(monster =>
                    (monster.minvent || monster.inventory || [])
                        .includes(top));
            if (carrier?.mx) {
                ox = carrier.mx;
                oy = carrier.my;
                located = true;
            }
        } else if (top.where === 'inventory') {
            located = true;
        }
        if (!located) {
            ox = state.u.ux;
            oy = state.u.uy;
        }
        if (!costlySpot(ox, oy, state)) return null;
        roomno = roomsAt(state.level, ox, oy, SHOPBASE)[0] ?? 0;
        const resident = roomForRoomno(state.level, roomno)?.resident ?? null;
        keeper = resident && hasShopkeeperData(resident)
            && shopkeeperInOwnShop(resident, state) ? resident : null;
        if (!keeper || !shopClaimsObject(object, keeper, false, state))
            return null;
    }

    if (object.where === 'inventory' || object.where === 'free') {
        if (learnBknown) object.bknown = true;
        // C verbalizes unconditionally here; only the voice is optional.
        await plineWithContinuation(
            `"You ${alteration} ${demonstrative} ${simpleObjectName(object, state)}, you pay for ${pronoun}!"`,
        );
        return billDummyObject(object, state);
    }

    // C's switch has no OBJ_CONTAINED case: a contained member passes the
    // billable gate silently and nothing is charged.
    if (object.where !== 'floor') return null;

    if (learnBknown) object.bknown = true;
    const heroShop = state.u.ushops[0];
    if (costlySpot(state.u.ux, state.u.uy, state) && roomno === heroShop) {
        await plineWithContinuation(
            `"You ${alteration} ${demonstrative}, you pay for ${pronoun}!"`,
        );
        return billDummyObject(object, state);
    }
    // C stolen_value(obj, ox, oy, FALSE, FALSE): angry settlement, spoken.
    return stolenValue(object, ox, oy, false,
        { silent: false, state, publish: plineWithContinuation });
}

// C shk.c:unpaid_cost(). The root keeps its agreed bill price; contents
// use the current shop valuation, and a partially used stack uses its live count.
export async function unpaidObjectCost(
    object: GameObject, state: GameState = game,
    costType: 'object' | 'contents' | 'single' = 'object',
): Promise<number> {
    let price = 0;
    let resident: Shopkeeper | null = null;
    let billed: BilledObject | null = null;
    for (const roomno of state.u.ushops ?? []) {
        resident = shopResident(roomno, state);
        if (!resident) continue;
        billed = billForObject(object, state, resident);
        if (billed)
            price = billed.entry.price * (costType === 'single' ? 1 : object.quan);
        if (costType === 'contents' && object.contents?.length)
            price += containedBuyCost(object, resident, { unpaidOnly: true, state });
        if (billed || (!object.unpaid && price)) break;
    }
    // Native tests the last shopkeeper examined; none outside a shop.
    if (!resident || (object.unpaid && !billed))
        await impossible("unpaid_cost: object wasn't on any bill.", { state });
    return price;
}

// C shk.c:alter_cost(). An improvement can raise a bill, never lower it.
export function updateUnpaidObjectPrice(object: GameObject, state: GameState = game): void {
    const billed = billForObject(object, state);
    if (!billed) return;
    billed.entry.price = Math.max(
        billed.entry.price, shopObjectUnitCost(object, billed.resident, state),
    );
}

// C shk.c:shk_your()/Shk_Your(). The returned prefix includes its separator; a corpse
// of a personally named monster has no prefix or separator at all.
export function objectOwnershipPrefix(
    object: GameObject, state: GameState = game, { capitalized = true } = {},
): string {
    const species = object.corpsenm;
    if (object.otyp === CORPSE && species !== undefined && MONSTER_NAME[species] !== undefined) {
        if ((MONSTER_FLAGS2[species] ?? 0) & M2_PNAME) return '';
        if (((MONSTER_GENO[species] ?? 0) & G_UNIQ)
            && !['high cleric', 'long worm tail'].includes(MONSTER_NAME[species]))
            return capitalized ? 'The ' : 'the ';
    }
    let owner = carriedObjectOwner(object, state);
    if (capitalized) owner = owner.charAt(0).toUpperCase() + owner.slice(1);
    else if (owner === 'Your' || owner === 'The') owner = owner.toLowerCase();
    return `${owner} `;
}

// C shk.c:shk_owns() and mon_owns(). Shop ownership takes
// precedence over the carrier, using the object's location rather than ours.
export function carriedObjectOwner(object: GameObject, state: GameState = game): string {
    const location = getObjectLocation(object, state);
    if (location && (object.unpaid || (object.where === 'floor' && !object.no_charge
        && costlySpot(location.x, location.y, state)))) {
        const shop = insideShopRoomAt(state, location.x, location.y);
        const keeper = shop && shopResident(shop.roomno, state);
        return keeper ? possessiveName(shopkeeperName(keeper, { state })) : 'The';
    }
    if (object.where === 'minvent') {
        const carrier = object.ocarry;
        if (!carrier) throw new Error(`Monster-carried object ${object.o_id} has no owner.`);
        return possessiveName(monsterName(carrier, {
            state, article: carrier.mtame ? 'your' : 'the',
            suppressSaddle: !!MGIVENNAME(carrier) || state.u.usteed === carrier,
        }));
    }
    return object.where === 'inventory' ? 'Your' : 'The';
}

// C shk.c:3309 add_one_tobill(): one billed entry. An unclaimed object
// stays unbilled quietly; a full bill gives it away, even for silent callers.
async function addOneToBill(object: GameObject, resident: BilledShopkeeper,
    publish: MessagePublisher, state: GameState): Promise<ShopBillEntry | null> {
    const eshk = resident.eshk;
    if (!shopClaimsObject(object, resident, true, state)) return null;
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
    if (object.globby) entry.price *= objectPricingUnits(object);
    eshk.bill.push(entry);
    eshk.billct = eshk.bill.length;
    object.unpaid = true;
    recordObjectPriceQuote(object.otyp, entry.price);
    return entry;
}

// C shk.c:3387 bill_box_content(): recursive content billing; a sealed
// Schroedinger box keeps its mystery and its contents unbilled.
async function billBoxContent(container: GameObject, resident: BilledShopkeeper,
    publish: MessagePublisher, state: GameState): Promise<void> {
    if (isSchroedingersBox(container)) return;
    for (const content of container.contents || []) {
        if (content.oclass === COIN_CLASS) continue;
        if (!content.no_charge) await addOneToBill(content, resident, publish, state);
        if (content.contents?.length) {
            await billBoxContent(content, resident, publish, state);
        }
    }
}

// C obj.h SchroedingersBox(): only a large box can hold the cat.
function isSchroedingersBox(object: GameObject): boolean {
    return object.otyp === LARGE_BOX && object.spe === 1;
}

// C shk.c:566 costly_adjacent(): a shop wall spot (edge flag, door
// included) or the keeper's free-spot home square.  Not a distance test.
export function costlyAdjacent(resident: Monster | null | undefined, x: number, y: number, state: GameState = game): boolean {
    if (!hasShopkeeperData(resident) || !shopkeeperInOwnShop(resident, state)) return false;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    const home = resident.eshk.shk;
    return !!(state.level?.at(x, y)?.edge
        || (x === home.x && y === home.y));
}

// C shk.c:3492 addtobill(): bills the picked object and its eligible
// contents for the hero's current shop; gold routes through costly_gold.
export async function addShopObjectToBill(object: GameObject, state: GameState = game,
    { ininv = true, silent = false, publish = plineWithContinuation }:
    { ininv?: boolean; silent?: boolean; publish?: MessagePublisher } = {},
): Promise<ShopTransaction | null> {
    requireLiveGame(state);
    // C billable(&shkp, obj, *u.ushops, TRUE): the hero's first shop room
    // validates the keeper, then the claim is decided by the object flags.
    const resident = currentShopResident(state);
    const keeper = shopkeeperInOwnShop(resident, state) ? resident : null;
    if (!keeper || !object || !shopClaimsObject(object, keeper, true, state))
        return null;
    const eshk = keeper.eshk;
    if (!Array.isArray(eshk.bill)) eshk.bill = [];
    if (!hasShopBill(keeper)) throw new Error('Shop bill initialization failed');

    if (object.oclass === COIN_CLASS) {
        await costlyGold(object.ox, object.oy,
            object.quan ?? object.quantity ?? 1, { silent, publish, state });
        return null;
    }
    if (eshk.bill.length === BILLSZ) {
        if (!silent) await publish('You got that for free!');
        return null;
    }

    const container = !!(object.contents?.length);
    let ltmp = 0;
    if (!object.no_charge) {
        ltmp = shopObjectUnitCost(object, keeper, state);
        if (object.globby) ltmp *= objectPricingUnits(object);
    }
    if (object.no_charge && !container) {
        object.no_charge = false;
        return null;
    }

    let entry = null;
    let contentscount = 0;
    if (container) {
        const cltmp = containedBuyCost(object, keeper,
            { unpaidOnly: false, state });
        const gltmp = containedGold(object, true);
        if (ltmp) entry = await addOneToBill(object, keeper, publish, state);
        if (cltmp) await billBoxContent(object, keeper, publish, state);
        pickedContainer(object); /* reset contained no_charge */
        ltmp += cltmp;
        if (gltmp) {
            await costlyGold(object.ox, object.oy, gltmp,
                { silent, publish, state });
            if (!ltmp) return null;
        }
        if (object.no_charge) object.no_charge = false;
        contentscount = countUnpaidContents(object);
    } else {
        entry = await addOneToBill(object, keeper, publish, state);
        if (!entry) return null;
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
        if (quote) await publish(quote);
    }
    return transaction;
}

function countUnpaidContents(container: GameObject): number {
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
function heroHonorific(state: GameState = game): string {
    const titles = [
        'good', 'honored', 'most gracious', 'esteemed',
        'most renowned and sacred',
    ];
    const demigod = state?.u?.uevent?.udemigod ? 1 : 0;
    const title = titles[rn2(4) + demigod];
    if (!title) throw new Error('Shop honorific roll is out of range');
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

export function billedPickupQuote(transaction: ShopTransaction | null, state: GameState = game): string | null {
    if (!transaction) return null;
    const { resident, object, offer: price, contentscount } = transaction;
    if (heroIsDeaf(state) || shopkeeperIsMuted(resident)) {
        const contents = contentscount && !object.unpaid ? 'the contents of ' : '';
        const suffix = contentscount && object.unpaid ? ' and its contents' : '';
        return `The list price of ${contents}${definiteName(objectCombatName(object, { state, includeCorpseSpecies: false }), state)}${suffix} is ${price} ${currency(price, { state })}${object.quan > 1 ? ' each' : ''}.`;
    }
    let greeting = '"For you,';
    if (!resident.mpeaceful) greeting += ' scum;';
    else if (!resident.eshk.surcharge) greeting += ` ${heroHonorific(state)}; only`;
    const quantity = object.quan;
    object.quan = 1;
    try {
        const unit = quantity > 1 ? 'per'
            : contentscount && !object.unpaid ? 'for the contents of this' : 'for this';
        return `${greeting} ${price} ${currency(price, { state })} ${unit} ${objectName(object, state)}${contentscount && object.unpaid ? ' and its contents' : ''}."`;
    } finally {
        object.quan = quantity;
    }
}

function possessive(name: string): string {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

// C role.c:Hello().
export function shopGreeting(monster: Monster, state: GameState = game): string {
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
async function describeUntendedShop(room: Room): Promise<void> {
    requireShopGame(game);
    let occupants = 0, noticed = 0;
    for (const monster of game.level.monsters) {
        const { mx, my } = monster;
        if (monster.dead || monster.mhp <= 0
            || mx < room.lx || mx > room.hx || my < room.ly || my > room.hy
            || (mx === game.u.ux && my === game.u.uy)) continue;
        occupants++;
        const appearance = M_AP_TYPE(monster);
        if (canSenseMonster(monster)
            || ([M_AP_NOTHING, M_AP_MONSTER].includes(appearance)
                && canSeeMonster(monster))) noticed++;
    }
    if (heroIsBlind() && !propertyIsActive('telepathy')
        && !game.u.detectMonsters && !game.detectMonsters) occupants++;
    await plineWithContinuation(`This shop ${noticed < occupants ? 'seems to be' : 'is'} ${
        occupants ? 'untended' : 'deserted'}.`);
}

// C shk.c:after_shk_move(). The suspended bill survives save/restore.
export async function afterShopkeeperMove(keeper: Shopkeeper, state: GameState = game): Promise<void> {
    requireLiveGame(state);
    if (!keeper.eshk.billUnavailable || !shopkeeperInOwnShop(keeper, state)) return;
    keeper.eshk.billUnavailable = false;
    if (!state.program_state?.gameover) await checkSpecialRoom();
}

async function enterShop({ room, roomno }: ShopRoom): Promise<string | null> {
    requireShopGame(game);
    const shopkeeper = shopResident(roomno, game);
    if (!shopkeeper || !shopkeeperInOwnShop(shopkeeper, game)) {
        if (shopkeeper) shopkeeper.eshk.billUnavailable = true;
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
    if (shopkeeperIsMuted(shopkeeper) || eshk.following) return null;

    const typeName = SHOP_TYPES[(room.rtype ?? roomno) - SHOPBASE]?.name
        || 'shop';
    const deaf = heroIsDeaf(game);
    let message: string;
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
    } else if (eshk.surcharge) {
        message = deaf
            ? `The atmosphere at ${possessive(shopkeeperName(shopkeeper))} ${typeName} seems unwelcoming.`
            : `"Back again, ${playerName}?  I've got my eye on you."`;
    } else if (eshk.robbed) {
        message = deaf
            ? `${shopkeeperName(shopkeeper, { capitalized: true })} is combing through ${monsterPossessive(shopkeeper, { noIt: true })} inventory list.`
            : `${shopkeeperName(shopkeeper, { capitalized: true })} mutters imprecations against shoplifters.`;
    } else {
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
async function blockShopEntry(shopkeeper: Shopkeeper): Promise<void> {
    if (insideShopRoomAt(game, game.u.ux, game.u.uy)) return;
    const picks = game.inventory.filter(object => object.otyp === PICK_AXE).length;
    const mattocks = game.inventory.filter(object => object.otyp === DWARVISH_MATTOCK).length;
    const calm = !shopkeeper.eshk.surcharge;
    const canSpeak = !heroIsDeaf(game) && !shopkeeperIsMuted(shopkeeper);
    if (picks || mattocks) {
        const tool = picks && mattocks ? 'digging tool' : picks ? 'pick-axe' : 'mattock';
        const count = picks + mattocks;
        if (!picks && mattocks && !heroIsBlind(game)) learnObjectType(DWARVISH_MATTOCK);
        const tools = `${tool}${count > 1 ? 's' : ''}`;
        const request = calm ? `Will you please leave your ${tools} outside?` : `Leave the ${tools} outside.`;
        await plineWithContinuation(canSpeak
            ? `"${request}"`
            : `${shopkeeperName(shopkeeper, { capitalized: true })} ${calm ? 'is hesitant' : 'refuses'} to let you in with your ${tools}.`);
    } else if (game.u.usteed) {
        const steed = monsterName(game.u.usteed, { article: 'your' });
        const request = calm ? `Will you please leave ${steed} outside?` : `Leave ${steed} outside.`;
        await plineWithContinuation(canSpeak
            ? `"${request}"`
            : `${shopkeeperName(shopkeeper, { capitalized: true })} ${calm ? "doesn't want" : 'refuses'} to let you in while you're riding ${steed}.`);
    } else {
        const floorTools = game.level?.objects[game.u.ux]?.[game.u.uy];
        if (!(game.u.fast || game.u.veryFast)
            || !floorTools?.some(object => object.otyp === PICK_AXE || object.otyp === DWARVISH_MATTOCK)) return;
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
        && inTown(game.level, game.u.ux, game.u.uy)) recordAchievement(game, ACH_TOWN);
    if (!game.u.uentered.length && !game.u.ushops_entered.length) return null;

    let result = null;
    if (game.u.ushops_entered.length) {
        const roomno = game.u.ushops_entered[0];
        if (roomno === undefined) throw new Error('Entered shop has no room number');
        const room = roomForRoomno(game.level, roomno);
        if (!room) throw new Error(`Entered shop ${roomno} has no room`);
        result = await enterShop({ room, roomno });
    }
    for (const roomno of game.u.uentered) {
        const room = roomForRoomno(game.level, roomno);
        if (!room) throw new Error(`Entered room ${roomno} does not exist`);
        const type = room.rtype;
        const message = specialRoomEntryMessage(room, roomno);
        if (message) {
            await plineWithContinuation(message);
            recordDiscoveredRoom(roomno - ROOMOFFSET);
            room.rtype = OROOM;
            result = room;
        } else if (type === DELPHI) {
            const oracle = [...game.level.monsters].reverse().find(monster =>
                !monster.dead && monster.mhp > 0
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
        } else if (type === TEMPLE) {
            result = await intemple(roomno);
            recordDiscoveredRoom(roomno - ROOMOFFSET);
        } else if (type >= SHOPBASE) {
            recordDiscoveredRoom(roomno - ROOMOFFSET);
        }
        if (room.rtype !== OROOM || type === OROOM) continue;
        if (!searchSpecial(type)) {
            switch (type) {
            case COURT: game.level.flags.has_court = false; break;
            case SWAMP: game.level.flags.has_swamp = false; break;
            case MORGUE: game.level.flags.has_morgue = false; break;
            case ZOO: game.level.flags.has_zoo = false; break;
            case BARRACKS: game.level.flags.has_barracks = false; break;
            case BEEHIVE: game.level.flags.has_beehive = false; break;
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

function specialRoomEntryMessage(room: Room, roomno: number): string | null {
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
function furniturePresent(room: Room, furniture: number): boolean {
    const level = game.level;
    if (!level) return false;
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
export async function leaveHeroShop(roomnos: readonly number[],
    { newLevel = false, state = game }: { newLevel?: boolean; state?: GameState } = {}): Promise<void> {
    requireLiveGame(state);
    requireShopGame(state);
    const hero = state.u;
    const leaving = roomnos.length > 0;
    if (!leaving && (!state.level.at(hero.ux, hero.uy)?.edge
        || state.level.at(hero.ux0, hero.uy0)?.edge)) return;

    const keeper = shopResident(leaving ? roomnos[0] : hero.ushops0[0], state);
    if (!keeper || !shopkeeperInOwnShop(keeper, state)) return;
    const shop = keeper.eshk;
    if (!(shop.bill?.length || shop.billct) && !shop.debit) return;

    if (!leaving && !shopkeeperIsMuted(keeper)) {
        const calm = !shop.surcharge;
        if (!heroIsDeaf(state)) {
            await plineWithContinuation(`"${state.plname}!  ${calm
                ? 'Please pay before leaving.' : "Don't you leave without paying!"}"`);
        } else {
            await plineWithContinuation(`${shopkeeperName(keeper, { state, capitalized: true })} ${calm
                ? 'points out' : 'makes it clear'} that you need to pay before leaving${calm ? '.' : '!'}`);
        }
        return;
    }
    if (await robShop(keeper, state))
        await callKops(keeper, !newLevel && !!state.level.at(hero.ux0, hero.uy0)?.edge, state);
}

// C shk.c:remote_burglary(): bill first, then pursue from the distant shop.
export async function remoteBurglary(x: number, y: number, state: GameState = game): Promise<void> {
    requireLiveGame(state);
    requireShopGame(state);
    const keeper = shopResident(roomsAt(state.level, x, y, SHOPBASE)[0], state);
    if (!keeper || !shopkeeperInOwnShop(keeper, state)) return;
    if (!keeper.eshk.billct && !keeper.eshk.debit) return;
    if (await robShop(keeper, state)) await callKops(keeper, false, state);
}

async function robShop(keeper: Shopkeeper, state: ShopGameState): Promise<boolean> {
    await rouseShopkeeper(keeper);
    const shop = keeper.eshk;
    let total = (shop.bill || []).reduce((sum, entry) => sum + entry.price * entry.bquan, 0)
        + (shop.debit || 0);
    const credit = shop.credit || 0;
    if (credit >= total) {
        await plineWithContinuation(`Your credit of ${credit} ${currency(credit, { state })} is used to cover your shopping bill.`);
        total = 0;
    } else {
        await plineWithContinuation('You escaped the shop without paying!');
        total -= credit;
    }
    setPaidShopkeeper(keeper, state);
    if (!total) return false;

    shop.robbed = (shop.robbed || 0) + total;
    await plineWithContinuation(`You stole ${total} ${currency(total, { state })} worth of merchandise.`);
    const shopType = SHOP_TYPES[shop.shoptype - SHOPBASE];
    if (!shopType) throw new Error(`Shopkeeper ${keeper.m_id} has invalid shop type ${shop.shoptype}`);
    recordGameLogEvent(`stole ${total} ${currency(total, { state })} worth of merchandise from ${
        possessiveName(shopkeeperName(keeper, { state }))} ${shopType.name}`, {
        state,
        flags: LL_ACHIEVE,
    });
    if (!state.urole || !state.u.ualign) throw new Error('Shop robbery requires hero role and alignment');
    if (state.urole.key !== 'rogue') adjustHeroAlignment(-Math.sign(state.u.ualign.type), state);
    hotPursuitShopkeeper(keeper, state);
    return true;
}

async function callKops(keeper: Shopkeeper, nearShop: boolean, state: ShopGameState): Promise<void> {
    const deaf = heroIsDeaf(state);
    if (!deaf) await plineWithContinuation('An alarm sounds!');
    const noKops = kopSpecies.every(species => (state.mvitals?.[species]?.mvflags ?? 0) & G_GONE);
    const guardsResponded = await angerWatchGuards(deaf);
    if (!guardsResponded && noKops) {
        if (state.flags.verbose && !deaf) await plineWithContinuation('But no one seems to respond to it.');
        return;
    }
    if (noKops) return;

    const stairs = pursuitStairs(state);
    if (nearShop) {
        if (state.flags.verbose) await plineWithContinuation('The Keystone Kops appear!');
        await makeKops({ x: state.u.ux, y: state.u.uy }, state);
        return;
    }
    if (state.flags.verbose) await plineWithContinuation('The Keystone Kops are after you!');
    if (stairs && isok(stairs.sx, stairs.sy))
        await makeKops({ x: stairs.sx, y: stairs.sy }, state);
    if (state.program_state.gameover) return;
    await makeKops({ x: keeper.mx, y: keeper.my }, state);
}

function pursuitStairs(state: ShopGameState): Stairway | null {
    const stairs: Stairway[] = [];
    for (let stair = state.stairs; stair; stair = stair.next) stairs.push(stair);
    if (!stairs.length) return null;
    const up = dungeonBuildsUp(state.u.uz, state);
    return stairs.find(stair => !stair.isladder && !!stair.up === up)
        || stairs.find(stair => stair.isladder && !!stair.up === up)
        || stairs.find(stair => stair.tolev.dnum !== state.u.uz.dnum)
        || stairs.find(stair => !stair.isladder && !!stair.up !== up)
        || stairs.find(stair => stair.isladder && !!stair.up !== up)
        || null;
}

async function makeKops(origin: Position, state: ShopGameState): Promise<void> {
    let position = origin;
    const count = Math.abs(depth(state.u.uz, state.dungeons)) + rnd(5);
    const ranks = [count, Math.trunc(count / 3) + 1, Math.trunc(count / 6), Math.trunc(count / 9)];
    for (const [rank, rankCount] of ranks.entries()) {
        if (!rankCount) break;
        const species = kopSpecies[rank];
        if (species === undefined) throw new Error(`Kop rank ${rank} has no monster species`);
        if ((state.mvitals?.[species]?.mvflags ?? 0) & G_GONE) continue;
        for (let remaining = rankCount; remaining > 0; remaining--) {
            // Native enexto moves the center even if makemon later fails.
            const next = findNearbyMonsterPosition(species, position.x, position.y, { state });
            if (next) {
                position = next;
                await makemonAt(species, position.x, position.y, MM_NOMSG);
                if (state.program_state.gameover) return;
            }
        }
    }
}

// C shk.c:shopper_financial_report().
export async function reportShopFinances(): Promise<void> {
    const room = insideShopRoomAt(game, game.u.ux, game.u.uy);
    let current = room ? shopResident(room.roomno) : null;
    if (current && !current.eshk.credit && !shopDebt(current)) {
        await plineWithContinuation('You have no credit or debt in here.');
        current = null;
    }
    for (let pass = current ? 0 : 1; pass <= 1; pass++) {
        for (const keeper of [...(game.level?.monsters ?? [])].reverse()) {
            if (!keeper.isshk || keeper.dead || keeper.mhp <= 0 || !hasShopkeeperData(keeper)) continue;
            if (!keeper.mpeaceful && !keeper.eshk.surcharge) rileShopkeeper(keeper);
            if ((keeper !== current) !== !!pass) continue;
            const credit = keeper.eshk.credit ?? 0;
            if (credit) {
                const shop = SHOP_TYPES[keeper.eshk.shoptype - SHOPBASE];
                if (!shop) throw new Error(`Shopkeeper ${keeper.m_id} has no shop type.`);
                await plineWithContinuation(`You have ${credit} ${currency(credit)} credit at ${possessiveName(shopkeeperName(keeper))} ${shop.name}.`);
            } else if (keeper === current) {
                await plineWithContinuation('You have no credit in here.');
            }
            const debt = shopDebt(keeper);
            if (debt) {
                await plineWithContinuation(`You owe ${shopkeeperName(keeper)} ${debt} ${currency(debt)}.`);
            } else if (keeper === current) {
                await plineWithContinuation("You don't owe any gold here.");
            }
        }
    }
}

function shopDebt(keeper: Shopkeeper): number {
    return addUpBill(keeper) + (keeper.eshk.debit ?? 0);
}

export type ShopExitOutcome = 'died' | 'quit' | 'escaped' | 'ascended';

interface ShopSettlementOptions {
    silent?: boolean;
    publish?: MessagePublisher;
    random?: (limit: number) => number;
}

export async function settleShopkeepersOnExit(
    outcome: ShopExitOutcome,
    { silent = false, publish = plineWithContinuation, random = rn2 }: ShopSettlementOptions = {},
): Promise<boolean> {
    if (outcome === 'escaped') return false;
    requireShopGame(game);
    game._shopRepossession = { shopkeeper: null, location: { x: 0, y: 0 } };
    const first = preferredShopkeeper();
    const options = { croaked: outcome !== 'quit', silent, publish, random };
    let count = 0;
    let taken = false;
    if (first) taken = await inheritHeroInventory(first, ++count, options);
    for (const keeper of exitShopkeepers()) {
        const local = shopkeeperIsLocal(keeper);
        if (keeper !== first) {
            const claimed = await inheritHeroInventory(keeper, ++count, options);
            taken = taken || claimed;
        }
        // Bones must not retain a keeper whose shop belongs to another level.
        if (!local) await removeMonsterFromGame(keeper);
    }
    return taken;
}

// C shk.c:finish_paybill().
export async function finishShopkeeperRepossession(): Promise<void> {
    const repository = game._shopRepossession;
    const keeper = repository?.shopkeeper ?? null;
    let { x, y } = repository?.location ?? { x: 0, y: 0 };
    if (!isok(x, y)) {
        if (keeper) await impossible(`finish_paybill: bad location <${x},${y}>.`, { state: game });
        ({ x, y } = heroRepositoryPosition());
    }
    releaseAllMonsterLeashes(game);
    const money = heroGoldAmount(game);
    if (keeper && money) await moneyToMonster(keeper, money);
    await dropHeroInventoryForBones(x, y);
}

function preferredShopkeeper(): Shopkeeper | null {
    let resident: Shopkeeper | null = null;
    let creditor: Shopkeeper | null = null;
    let hostile: Shopkeeper | null = null;
    let localKeeper: Shopkeeper | null = null;
    for (const keeper of exitShopkeepers()) {
        const shop = keeper.eshk;
        const local = shopkeeperIsLocal(keeper);
        if (local && game.u.ushops?.includes(shop.shoproom)) {
            if (!resident || shopkeeperHasDebt(keeper)) resident = keeper;
        } else if (shopkeeperHasDebt(keeper)) {
            creditor ??= keeper;
        } else if (shop.following || !keeper.mpeaceful) {
            hostile ??= keeper;
        } else if (local) {
            localKeeper ??= keeper;
        }
    }
    return resident ?? creditor ?? hostile ?? localKeeper;
}

// C next_shkp(FALSE). Capture the list before this pass because mongone()
// removes its current member while the native loop retains the next pointer.
function* exitShopkeepers(): Generator<Shopkeeper> {
    for (const keeper of [...(game.level?.monsters ?? [])].reverse()) {
        if (keeper.dead || keeper.mhp <= 0 || !keeper.isshk) continue;
        if (!hasShopkeeperData(keeper)) throw new Error('Shopkeeper lacks shop history.');
        if (!keeper.mpeaceful && !keeper.eshk.surcharge) rileShopkeeper(keeper);
        yield keeper;
    }
}

interface InheritanceOptions {
    croaked: boolean;
    silent: boolean;
    publish: MessagePublisher;
    random: (limit: number) => number;
}

async function inheritHeroInventory(
    keeper: Shopkeeper, count: number, options: InheritanceOptions,
): Promise<boolean> {
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
            await publish(`${shopkeeperName(keeper, { capitalized: true })} ${
                monsterIsHelpless(keeper) ? 'wakes up, ' : ''}looks at your corpse${shake} and ${
                shopkeeperInOwnShop(keeper) ? 'sighs' : 'disappears'}.`);
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
        if (heroInShop && shopkeeperInOwnShop(keeper)) loss = addUpBill(keeper) + (shop.debit ?? 0);
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
                if (money > 0) await moneyToMonster(keeper, money);
                if (!silent) await publish(`${shopkeeperName(keeper, { capitalized: true })} ${takes} all your possessions.`);
                taken = true;
            } else {
                await moneyToMonster(keeper, loss);
                if (!silent) {
                    const customer = (shop.customer ?? '').slice(0, PL_NSIZ) === game.plname.slice(0, PL_NSIZ);
                    await publish(`${shopkeeperName(keeper, { capitalized: true })} ${takes} the ${loss} ${
                        currency(loss, { random })} ${customer ? 'you ' : ''}owed ${
                        monsterObjectPronoun(keeper, { noIt: true })}.`);
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

async function returnShopkeeperHome(keeper: Shopkeeper): Promise<void> {
    requireShopGame(game);
    if (monsterIsHelpless(keeper)) {
        keeper.msleeping = 0;
        keeper.mfrozen = 0;
        keeper.mcanmove = 1;
    }
    if (!shopkeeperInOwnShop(keeper)) await homeShopkeeper(keeper, game);
}

function completeShopSettlement(keeper: Shopkeeper, taken: boolean): boolean {
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

function heroRepositoryPosition(): Position {
    return { x: game.u.ux || game.u.ux0, y: game.u.ux ? game.u.uy : game.u.uy0 };
}

function shopkeeperHasDebt(keeper: Shopkeeper): boolean {
    const shop = keeper.eshk;
    return !!(shop.billct || shop.debit || shop.robbed);
}

function shopkeeperIsLocal(keeper: Shopkeeper): boolean {
    const level = keeper.eshk.shoplevel;
    const heroLevel = game.u.uz;
    return !!heroLevel && level.dnum === heroLevel.dnum && level.dlevel === heroLevel.dlevel;
}

export async function nameShopTransaction(keeper: Shopkeeper, object: GameObject,
    describe: (name: string) => string,
    { publish, state }: { publish: MessagePublisher; state: GameState }): Promise<void> {
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
    } else {
        await publish(`You ${describe(name)}`);
    }
}

export async function quoteShopGoods(): Promise<boolean> {
    if (heroIsBlind() || heroIsDeaf()) return false;
    const spot = costlySpot(game.u.ux, game.u.uy);
    if (!spot || !spot.resident.mpeaceful || shopkeeperIsMuted(spot.resident)) return false;
    const goods = game.level?.objects[game.u.ux]?.[game.u.uy]?.filter(object => object.oclass !== 12) ?? [];
    if (!goods.length) return false;
    const quotes = [];
    for (const object of goods) {
        let cost = object.no_charge || object === game.uball || object === game.uchain
            ? 0 : shopObjectUnitCost(object, spot.resident);
        const contentsOnly = !cost;
        if (object.contents?.length)
            cost += containedBuyCost(object, spot.resident, { unpaidOnly: false });
        if (object.globby) cost *= objectPricingUnits(object);
        observeObjectForNaming(object);
        const name = `${cost && contentsOnly ? 'the contents of ' : ''}${await objectDescription(object)}`;
        const each = object.quan > 1 ? ' each' : '';
        quotes.push({ object, cost, contentsOnly, each, name,
            line: `${name}, ${cost ? `${cost} ${currency(cost)}${each}` : 'no charge'}` });
    }
    const quote = quotes[0];
    if (!quote) throw new Error('Shop goods disappeared during a price quote.');
    if (quotes.length > 1) {
        await showDisclosureOverlay(['Fine goods for sale:', '', ...quotes.map(item => item.line)],
            { restoreUnderlay: true });
    } else if (!quote.cost) {
        await plineWithContinuation(`"${capitalize(quote.line)}!"`);
    } else {
        const name = `${quote.contentsOnly ? 'the contents of ' : ''}${await objectDescription(quote.object)}`;
        await plineWithContinuation(`"${capitalize(name)}, price ${quote.cost} ${currency(quote.cost)}${quote.each}${
            quote.contentsOnly ? '.' : embellish(quote.object, quote.cost)}"`);
    }
    return true;
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// C shk.c:shk_embellish().
function embellish(object: GameObject, cost: number): string {
    if (!rn2(3)) {
        let choice = rn2(5);
        if (!choice) choice = cost < 100 ? 1 : cost < 500 ? 2 : 3;
        switch (choice) {
        case 4:
            if (cost < 10) break;
            if (object.oclass === 7) return ", gourmets' delight!";
            if (objectTypeKnown(object) ? OBJECT_MAGIC[object.otyp]
                : [4, 5, 8, 9, 10, 11].includes(object.oclass))
                return ', painstakingly developed!';
            return ', superb craftsmanship!';
        case 3: return ', finest quality.';
        case 2: return ', an excellent choice.';
        case 1: return ', a real bargain.';
        }
    } else if (object.oartifact) return ', one of a kind!';
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

export async function chatWithShopkeeper(monster: Monster, state: GameState = game): Promise<void> {
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
    let message: string;
    if (!monster.mpeaceful) {
        message = `${name()} ${speaking ? 'mentions' : 'indicates'} how much ${subject()} dislikes ${shop.robbed ? 'non-paying' : 'rude'} customers.`;
    } else if (shop.following) {
        if (shop.customer !== state.plname) {
            if (speaking)
                await plineWithContinuation(`"${shopGreeting(monster, state)} ${state.plname}!  I was looking for ${shop.customer}."`);
            shop.following = 0;
            return;
        }
        message = speaking ? `"${shopGreeting(monster, state)} ${state.plname}!  Didn't you forget to pay?"`
            : `${name()} taps you on the ${heroArmName(state)}.`;
    } else if (shop.billct) {
        const total = addUpBill(monster) + (shop.debit ?? 0);
        message = `${name()} ${speaking ? 'says' : 'indicates'} that your bill comes to ${total} ${currency(total, { state })}.`;
    } else if (shop.debit) {
        message = `${name()} ${speaking ? 'reminds you' : 'indicates'} that you owe ${monsterObjectPronoun(monster, { state, noIt: true })} ${shop.debit} ${currency(shop.debit, { state })}.`;
    } else if (shop.credit) {
        message = `${name()} encourages you to use your ${shop.credit} ${currency(shop.credit, { state })} of credit.`;
    } else if (shop.robbed) {
        message = `${name()} ${speaking ? 'complains' : 'indicates concern'} about a recent robbery.`;
    } else if (shop.surcharge) {
        message = `${name()} ${speaking ? 'warns you' : 'indicates'} that ${subject()} is watching you carefully.`;
    } else {
        const money = monsterGoldAmount(monster);
        if (money < 50 || money > 4000) {
            message = `${name()} ${speaking ? money < 50 ? 'complains' : 'says' : 'indicates'} that business is ${money < 50 ? 'bad' : 'good'}.`;
        } else {
            if (!speaking) return;
            const izchak = !heroIsHallucinating(state)
                && inTown(state.level, monster.mx, monster.my)
                && shop.shknam?.replace(/^[^A-Za-z]/, '') === 'Izchak';
            message = izchak ? `${shopkeeperName(monster, { state })} ${IZCHAK_SPEAKS[rn2(IZCHAK_SPEAKS.length)]}`
                : `${name()} talks about the problem of shoplifters.`;
        }
    }
    await plineWithContinuation(message);
}

export function shopkeeperBlockingDoor(x: number, y: number, state: GameState = game): Shopkeeper | null {
    if (state.level?.at(x, y)?.typ !== DOOR) return null;
    const keeper = keeperForEntrance(x, y, state);
    if (!keeper || keeper.eshk.shoproom !== state.u.ushops?.[0]) return null;
    const shop = keeper.eshk;
    return keeper.mx === shop.shk.x && keeper.my === shop.shk.y
        && shop.shd.x === x && shop.shd.y === y && !monsterIsHelpless(keeper)
        && (shop.debit || shop.billct || shop.robbed) ? keeper : null;
}

export function shopkeeperBlockingEntry(x: number, y: number, state: GameState = game): Shopkeeper | null {
    const door = state.level?.at(state.u.ux, state.u.uy);
    if (door?.typ !== DOOR || door.doormask !== D_BROKEN) return null;
    const keeper = keeperForEntrance(x, y, state);
    if (!keeper || monsterIsHelpless(keeper)) return null;
    const { shk: home, shd: entrance } = keeper.eshk;
    if (entrance.x !== state.u.ux || entrance.y !== state.u.uy
        || keeper.mx !== home.x || keeper.my !== home.y
        || !(Math.abs(x - home.x) === 1 || Math.abs(y - home.y) === 1)) return null;
    return propertyIsActive('invisible', state) || state.u.usteed
        || state.inventory.some(object => object.otyp === PICK_AXE || object.otyp === DWARVISH_MATTOCK)
        ? keeper : null;
}

function keeperForEntrance(x: number, y: number, state: GameState): Shopkeeper | null {
    const roomno = roomsAt(state.level, x, y, SHOPBASE)[0];
    // These two pinned C functions pass the encoded room number straight
    // to IS_SHOP(), which indexes rooms[] without removing ROOMOFFSET.
    if (roomno === undefined || (roomForIndex(state.level, roomno)?.rtype ?? 0) < SHOPBASE) return null;
    const keeper = shopResident(roomno, state);
    return keeper && shopkeeperInOwnShop(keeper, state) ? keeper : null;
}

export async function moneyToHero(monster: Monster, amount: number, state: GameState = game): Promise<void> {
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
    if (!payment) throw new Error('Shopkeeper could not split the payment coins.');
    unlinkObject(payment, state);
    const canMerge = state.inventory.some(object => mergable(object, payment, state));
    const slots = state.inventory.filter(object => object.invlet !== '$').length;
    if (!canMerge && slots >= 52) {
        await plineWithContinuation('You have no room for the gold!');
        await dropObjectAtHero(payment, { state });
    } else {
        await addInventoryItem(payment);
        state.context.botl = true;
    }
}

// C include/monflag.h enum msound: sounds at or below MS_ANIMAL are not speech.
const MS_ANIMAL = 17;

export function shopkeeperIsMuted(resident: Monster): boolean {
    // C shk.c:58 muteshk(): helpless, or no capability for human speech.
    return monsterIsHelpless(resident)
        || (MONSTER_SOUND[resident?.mnum] ?? 0) <= MS_ANIMAL;
}

function objectQuan(object: GameObject): number {
    return object.quan ?? object.quantity ?? 1;
}

// C shk.c:1084 find_objowner(): on-bill objects belong to their billing
// shop; otherwise the rooms containing (x,y) claim via bill then resident.
export function findObjectOwner(object: GameObject, x: number, y: number, state: GameState): Shopkeeper | null {
    if (object.where === 'onbill') {
        for (const resident of visitBilledShopkeepers(state))
            if (onBillEntry(object, resident)) return resident;
        return null;
    }
    let fallback: Shopkeeper | null = null;
    for (const roomno of roomsAt(state.level, x, y, SHOPBASE)) {
        const resident = shopResident(roomno, state);
        if (!hasShopkeeperData(resident)) continue;
        if (onBillEntry(object, resident)) return resident;
        if (!fallback) fallback = resident;
    }
    return fallback;
}

export function onBillEntry(object: GameObject, resident: Monster | null | undefined): ShopBillEntry | null {
    return (resident?.eshk?.bill || [])
        .find(entry => entry.bo_id === object?.o_id) ?? null;
}

// C shk.c:1278 check_credit(): messages are not silent-gated in C.
async function checkShopCredit(value: number, resident: Shopkeeper, publish: MessagePublisher): Promise<number> {
    const credit = resident.eshk.credit ?? 0;
    if (credit === 0) return value;
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
export function objectPricingUnits(object: GameObject): number {
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
export function objectIsCandle(object: GameObject): boolean {
    return object.otyp === WAX_CANDLE || object.otyp === TALLOW_CANDLE;
}

function artifactCost(object: GameObject, state: GameState): number {
    const artifact = artifactById(object.oartifact, state);
    if (artifact?.cost) return artifact.cost;
    return 100 * (OBJECT_COST[object.otyp] ?? 0);
}

// C shk.c:4280 corpsenm_price_adj().
function corpsenmPriceAdj(object: GameObject): number {
    let value = 0;
    if ((object.otyp === TIN || object.otyp === EGG
        || object.otyp === CORPSE)
        && typeof object.corpsenm === 'number'
        && Number.isInteger(object.corpsenm) && object.corpsenm >= 0) {
        const mnum = object.corpsenm;
        let multiplier = 1;
        // C eat.c:intrinsic_possible() terms and shk.c price adders; the
        // shared owner keys them by the intrinsic property names.
        const intrinsicCosts: ReadonlyArray<readonly [CorpseIntrinsic, number]> = [
            ['fireResistance', 2], ['sleepResistance', 3], ['coldResistance', 2],
            ['disintegrationResistance', 5], ['shockResistance', 4],
            ['poisonResistance', 2], ['acidResistance', 1], ['stoneResistance', 3],
            ['teleportation', 2], ['teleportControl', 3], ['telepathy', 5],
        ];
        for (const [intrinsic, cost] of intrinsicCosts) {
            if (intrinsicPossible(intrinsic, mnum)) multiplier += cost;
        }
        // C mondata.h unique_corpstat(): geno & G_UNIQ.
        if ((MONSTER_GENO[mnum] ?? 0) & G_UNIQ) multiplier += 50;

        const level = MONSTER_LEVEL[mnum];
        if (level === undefined) throw new Error(`Corpse species ${mnum} has no shop value`);
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
export function shopGetPrice(object: GameObject, shkBuying: boolean, state: GameState = game): number {
    let tmp = OBJECT_COST[object.otyp] ?? 0;
    if (object.oartifact) {
        tmp = artifactCost(object, state);
        if (shkBuying) tmp = Math.trunc(tmp / 4);
    }
    if (object.oclass === 7 /* FOOD_CLASS */) {
        tmp += corpsenmPriceAdj(object);
        // Hungry buyers pay multiples of the food price; sellers never do.
        const hunger = state.u.uhs ?? 0;
        if (hunger >= HUNGRY && !shkBuying) tmp *= hunger;
        if (object.oeaten) tmp = 0;
    } else if (object.oclass === 11 /* WAND_CLASS */) {
        if (object.spe === -1) tmp = 0;
    } else if (object.oclass === 8 /* POTION_CLASS */) {
        if (object.otyp === POT_WATER && !object.blessed && !object.cursed)
            tmp = 0;
    } else if (object.oclass === 3 /* ARMOR */
        || object.oclass === 2 /* WEAPON_CLASS */) {
        if ((object.spe ?? 0) > 0) tmp += 10 * object.spe;
    } else if (object.oclass === 6 /* TOOL_CLASS */) {
        if (objectIsCandle(object)
            && (object.age ?? 0) < 20 * (OBJECT_COST[object.otyp] ?? 0)) {
            tmp = Math.trunc(tmp / 2);
        }
    }
    return tmp;
}

// C shk.c:contained_cost(usell = FALSE): buy-side price of contents.  The
// sell-side twin lives below with sellobj().
export function containedBuyCost(container: GameObject, resident: Monster | null,
    { unpaidOnly = true, state = game }: { unpaidOnly?: boolean; state?: GameState } = {}): number {
    let price = 0;
    let top = container;
    while (top.container) top = top.container;
    const onFloor = top.where === 'floor' || top.where === 'free';
    // C: a FREE top (or one without a location) prices from the hero's
    // coordinates; only a FLOOR top uses its own ox/oy.
    const x = top.where === 'floor' ? top.ox : state.u?.ux;
    const y = top.where === 'floor' ? top.oy : state.u?.uy;
    const home = resident?.eshk?.shk;
    const freeSpot = onFloor && home && x === home.x && y === home.y;
    for (const content of container.contents || []) {
        if (content.oclass === COIN_CLASS) continue;
        if (onFloor ? (!content.no_charge && !freeSpot)
            : (content.unpaid || !unpaidOnly)) {
            price += objectPricingUnits(content)
                * shopObjectUnitCost(content, resident, state);
        }
        if (content.contents?.length) {
            price += containedBuyCost(content, resident,
                { unpaidOnly, state });
        }
    }
    return price;
}

// C picked_container() (shk.c:3093): picking a no_charge container up again
// clears the flag from its contents.
export function pickedContainer(container: GameObject): void {
    for (const content of container.contents || []) {
        if (content.oclass === COIN_CLASS) continue;
        if (content.no_charge) content.no_charge = false;
        if (content.contents?.length) pickedContainer(content);
    }
}

// C shk.c:3450 billable(): does the shopkeeper claim this object's charge?
// Callers pass a validated resident or use validateShopkeeper() first.
export function shopClaimsObject(object: GameObject, resident: Monster | null,
    resetNoCharge: boolean, state: GameState): boolean {
    if (onBillEntry(object, resident)
        || (object.oclass === FOOD_CLASS && object.oeaten)) return false;
    if (object.no_charge) {
        const hasContents = !!(object.contents?.length);
        const payable = hasContents
            && (containedGold(object, true) > 0
                || containedBuyCost(object, resident,
                    { unpaidOnly: !resetNoCharge, state }) > 0);

        if (!payable) {
            if (resetNoCharge && object.oclass !== COIN_CLASS) {
                object.no_charge = false;
                if (hasContents) pickedContainer(object);
            }
            return false;
        }
    }
    return true;
}

// C shop_keeper(roomno) + inhishop(shkp).
function validateShopkeeper(roomno: number, state: GameState): Shopkeeper | null {
    const resident = shopResident(roomno, state);
    return hasShopkeeperData(resident) && shopkeeperInOwnShop(resident, state) ? resident : null;
}

// C shk.c:3713 stolen_container(): recursive content theft value.
async function stolenContainer(container: GameObject, resident: Shopkeeper,
    { inInventory, state }: { inInventory: boolean; state: GameState }): Promise<number> {
    let price = 0;
    for (const content of [...(container.contents || [])]) {
        if (content.oclass === COIN_CLASS) continue;
        let billamt = 0;
        if (!shopClaimsObject(content, resident, true, state)) {
            const entry = onBillEntry(content, resident);
            if (!entry) continue;
            billamt = (entry.bquan ?? 1) * entry.price;
            removeOneObjectFromBill(content, state);
        }
        if (billamt) price += billamt;
        else if (inInventory ? !!content.unpaid : !content.no_charge) {
            price += objectPricingUnits(content)
                * shopObjectUnitCost(content, resident, state);
        }
        if (content.contents?.length) {
            price += await stolenContainer(content, resident,
                { inInventory, state });
        }
    }
    return price;
}

function zorkmids(amount: number): string {
    return `${amount} ${currency(amount)}`;
}

// C shk.c:3754 stolen_value().  World mutations (bills, credit, debit,
// robbed, pursuit, guards) are live-game only.
export async function stolenValue(object: GameObject, x: number, y: number, peaceful: boolean | MonsterFlag | undefined,
    { silent = true, publish = plineWithContinuation, state = game }: {
        silent?: boolean;
        publish?: MessagePublisher;
        state?: GameState;
    } = {}): Promise<number> {
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
        if (!entry && !uCount) return 0;
    }
    if (!resident) throw new Error(`Billed contents at ${x},${y} have no resident shopkeeper`);

    let value = 0;
    let gvalue = 0;
    if (object.oclass === COIN_CLASS) {
        gvalue += objectQuan(object);
    } else {
        if (billamt) value += billamt;
        else if (!object.no_charge) {
            value += objectPricingUnits(object)
                * shopObjectUnitCost(object, resident, state);
        }
        if (container) {
            const inInventory = object.where === 'inventory'
                || object.where === 'free';
            value += await stolenContainer(object, resident,
                { inInventory, state });
            if (!inInventory) gvalue += containedGold(object, true);
        }
    }

    if (gvalue + value === 0) return 0;
    value += gvalue;

    if (peaceful) {
        const creditUse = !!(resident.eshk.credit ?? 0);
        value = await checkShopCredit(value, resident, publish);
        // charges after the shopkeeper is angry belong in robbed, not debit
        if (!resident.mpeaceful) {
            resident.eshk.robbed = (resident.eshk.robbed ?? 0) + value;
        } else {
            resident.eshk.debit = (resident.eshk.debit ?? 0) + value;
        }
        if (!silent) {
            let still = '';
            if (creditUse) {
                if (resident.eshk.credit) {
                    await publish(`You have ${zorkmids(resident.eshk.credit)} credit remaining.`);
                    return value;
                } else if (!value) {
                    await publish('You have no credit remaining.');
                    return 0;
                }
                still = 'still ';
            }
            let owed = `${still}owe ${shopkeeperName(resident)} ${zorkmids(value)}`;
            if (uCount) {
                owed += ` for ${wasUnpaid ? 'it and ' : ''}${cCount > uCount ? 'some of ' : ''}its contents`;
            } else if (object.oclass !== COIN_CLASS) {
                owed += ` for ${objectQuan(object) > 1 ? 'them' : 'it'}`;
            }
            await publish(`You ${owed}!`);
        }
    } else {
        resident.eshk.robbed = (resident.eshk.robbed ?? 0) + value;
        if (!silent) {
            if (canSeeMonster(resident)) {
                await publish(`${shopkeeperName(resident)} booms: "${state.plname || 'you'}, you are a thief!"`,
                    { noRepeat: true });
            } else if (!heroIsDeaf(state)) {
                await publish('You hear a scream, "Thief!"', { noRepeat: true });
            }
        }
        // C runs pursuit and guard anger even when silent.
        await hotPursuitShopkeeper(resident, state);
        await angerWatchGuards(false);
    }
    return value;
}

// C shk.c:cheapest_item().
export async function minimumShopPurchase(resident: Monster, state: GameState = game): Promise<{
    price: number; multipleItems: boolean;
} | null> {
    const bill = await itemizedShopBill(resident, state);
    if (!bill.length || !hasShopBill(resident)) return null;
    return {
        price: Math.min(...bill.map(item => item.price)),
        multipleItems: resident.eshk.bill.length > 1 || bill.length > 1
            || bill[0]?.kind === 'hidden-container',
    };
}

// Contents share one entry for their outermost container. Used portions stay
// separate, so they can be paid before buying the remaining contained goods.
// C shk.c:sortbill_cmp().
// C shk.c:bp_to_obj().
export async function itemizedShopBill(resident: Monster | null | undefined, state: GameState = game): Promise<ShopBillItem[]> {
    if (!hasShopBill(resident)) return [];
    const objects = objectsInTimerGraph(state);
    const bill: ShopBillItem[] = [];
    for (const [billIndex, entry] of resident.eshk.bill.entries()) {
        const object = (entry.useup ? state.billObjects ?? [] : objects)
            .find(candidate => candidate.o_id === entry.bo_id);
        if (!object) continue;
        if (object.where === 'onbill' || object.quan === 0) {
            bill.push({ object, kind: 'used', quantity: entry.bquan,
                price: entry.price * entry.bquan, billIndex });
            continue;
        }
        if (object.quan < entry.bquan) {
            const quantity = entry.bquan - object.quan;
            bill.push({ object, kind: 'used', quantity,
                price: entry.price * quantity, billIndex });
        }
        if (object.container || object.contents?.length) {
            const container = outermostContainer(object);
            const previous = bill.find(item => item.object === container);
            const kind = container === object ? 'intact'
                : containerContentsKnown(object) ? 'known-container' : 'hidden-container';
            if (previous) {
                if (previous.kind === 'intact') previous.kind = kind;
                continue;
            }
            bill.push({ object: container, kind, quantity: 1,
                price: await unpaidObjectCost(container, state, 'contents'),
                billIndex: container.unpaid ? billIndex : -1 });
        } else {
            bill.push({ object, kind: 'intact', quantity: object.quan,
                price: entry.price * object.quan, billIndex });
        }
    }
    return bill.sort((left, right) => Number(right.kind === 'used') - Number(left.kind === 'used')
        || right.price - left.price || left.billIndex - right.billIndex);
}

export async function buyShopBillItem(resident: Monster, item: ShopBillItem,
    state: GameState = game, { itemize = false }: { itemize?: boolean } = {}
): Promise<'paid' | 'skip' | 'stop' | 'broke'> {
    if (!hasShopBill(resident)) return 'stop';
    const container = item.kind === 'known-container' || item.kind === 'hidden-container';
    // buy_container() checks the group price first; dopayobj() rejects a
    // partly used loose stack before considering its intact portion's price.
    if (container) {
        if (!await checkPurchaseFunds(resident, item, state, 0)) return 'stop';
        if (!await checkPurchaseFunds(resident, item, state)) return 'stop';
    }
    let declined = false;
    if (itemize && !container) {
        if (!await checkPurchaseFunds(resident, item, state, 0)) return 'broke';
        observeObjectForNaming(item.object, { state });
        const originalQuantity = item.object.quan;
        const originalSuppressPrice = state.iflags.suppress_price;
        item.object.quan = item.quantity;
        state.iflags.suppress_price = true;
        try {
            declined = await promptYesNo(await paymentQuestion(item.object, item.price, state)) === 'n';
        } finally {
            item.object.quan = originalQuantity;
            if (originalSuppressPrice === undefined) delete state.iflags.suppress_price;
            else state.iflags.suppress_price = originalSuppressPrice;
        }
    }
    const purchases = container ? containedPurchases(resident, item.object, state) : [item.object];
    for (const object of purchases) {
        const entry = resident.eshk.bill.find(candidate => candidate.bo_id === object.o_id);
        if (entry && item.kind !== 'used' && object.quan < entry.bquan) {
            await rejectPartlyUsedPurchase(resident, object, entry, state);
            return container ? 'stop' : 'skip';
        }
    }
    if (declined) return 'skip';
    if (!container && !await checkPurchaseFunds(resident, item, state)) return itemize ? 'skip' : 'stop';
    const unpaidContainer = container && item.object.unpaid;
    let bought = 0;
    for (const object of purchases) {
        const entry = resident.eshk.bill.find(candidate => candidate.bo_id === object.o_id);
        if (!entry) continue;
        const quantity = item.kind === 'used' ? item.quantity : object.quan;
        const price = entry.price * quantity;
        // The group quote uses today's valuation; each bill entry retains
        // its agreed price. Native keeps trying later contents after a refusal.
        if (container && !await checkPurchaseFunds(resident, { ...item, object, quantity }, state, price)) {
            await impossible(`Buying ${simpleObjectName(item.object, state)} contents failed unexpectedly (#${object.o_id} 0).`, { state });
            continue;
        }
        // dopayobj() retains the purchased count through payment and feedback,
        // then restores the intact count before update_bill().
        const originalQuantity = object.quan;
        object.quan = quantity;
        try {
            await payShopkeeper(resident, price, state);
            if (!container) await nameShopTransaction(resident, object,
                name => `${item.kind === 'used' ? 'paid for' : 'bought'} ${name}${
                    item.kind === 'used' ? ' at a cost of' : ' for'} ${price} gold piece${price === 1 ? '' : 's'}.`,
                { publish: plineWithContinuation, state });
        } finally {
            object.quan = originalQuantity;
        }
        if (item.kind === 'used' && object.where !== 'onbill' && object.quan > 0) {
            entry.bquan = object.quan;
        } else {
            object.unpaid = false;
            if (object.where === 'onbill') {
                unlinkObject(object, state);
                deallocateObject(object, state);
            }
            removeBillEntry(resident, entry);
        }
        bought++;
    }
    if (container && bought === 0) {
        await plineWithContinuation(`"You need to remove any unpaid items from that ${simpleObjectName(item.object, state)} and buy them separately."`);
        return 'stop';
    }
    if (container) {
        // buy_container() names the container with its prior ownership, then
        // clears both flags after the purchase summary has finished.
        if (unpaidContainer) {
            item.object.unpaid = true;
            item.object.no_charge = true;
        }
        await nameShopTransaction(resident, item.object,
            name => `bought ${name} for ${item.price} gold piece${item.price === 1 ? '' : 's'}.`,
            { publish: plineWithContinuation, state });
        item.object.unpaid = false;
        item.object.no_charge = false;
    }
    return 'paid';
}

// C dopayobj(): safe_qbuf() reserves the price and question before shortening
// the doname() description. Keep the same object for equipment annotations,
// and restore the temporary naming fields before asking for input.
async function paymentQuestion(object: GameObject, price: number, state: GameState): Promise<string> {
    const suffix = ` for ${price} ${currency(price, { state })}.  Pay?`;
    const limit = QBUFSZ - 1 - suffix.length;
    const describe = async (nameState: GameState): Promise<string> => {
        const name = await objectDescription(object, { state: nameState });
        return object.quan === 1 ? name.charAt(0).toUpperCase() + name.slice(1) : name;
    };
    let name = await describe(state);
    if (name.length <= limit) return name + suffix;

    // C short_oname() tries each user name separately, then both together.
    const callName = state._objectCallNames?.[object.otyp];
    const personalName = object.oextra?.oname || object.oname;
    const shortCallState = callName && callName.length >= 12
        ? { ...state, _objectCallNames: {
            ...state._objectCallNames, [object.otyp]: `${callName.slice(0, 8)}...`,
        } } : state;
    if (shortCallState !== state) {
        name = await describe(shortCallState);
        if (name.length <= limit) return name + suffix;
    }
    const shortPersonalName = personalName && personalName.length >= 12
        ? `${personalName.slice(0, 8)}...` : null;
    const { oextra, bknown, rknown, greased, oeroded, oeroded2 } = object;
    try {
        if (shortPersonalName) {
            object.oextra = { ...oextra, oname: shortPersonalName };
            name = await describe(state);
            if (name.length <= limit) return name + suffix;
        }
        const shortenBoth = shortCallState !== state && shortPersonalName !== null;
        const nameState = shortenBoth ? shortCallState : state;
        if (shortenBoth) {
            name = await describe(nameState);
            if (name.length <= limit) return name + suffix;
        } else if (oextra === undefined) delete object.oextra;
        else object.oextra = oextra;

        // Only the combined attempt keeps abbreviated names while stripping
        // physical details; native restores each separate attempt first.
        object.bknown = object.rknown = object.greased = false;
        object.oeroded = object.oeroded2 = 0;
        name = await describe(nameState);
        if (name.length > limit) name = simpleObjectNameWithArticle(object, nameState);
        if (name.length > limit) name = object.quan === 1 ? 'that' : 'those';
        return name + suffix;
    } finally {
        if (oextra === undefined) delete object.oextra;
        else object.oextra = oextra;
        if (bknown === undefined) delete object.bknown;
        else object.bknown = bknown;
        if (rknown === undefined) delete object.rknown;
        else object.rknown = rknown;
        if (greased === undefined) delete object.greased;
        else object.greased = greased;
        if (oeroded === undefined) delete object.oeroded;
        else object.oeroded = oeroded;
        if (oeroded2 === undefined) delete object.oeroded2;
        else object.oeroded2 = oeroded2;
    }
}

// C shk.c:insufficient_funds().
async function checkPurchaseFunds(resident: BilledShopkeeper, item: ShopBillItem,
    state: GameState, cost = item.price): Promise<boolean> {
    const funds = heroGoldAmount(state) + (resident.eshk.credit ?? 0);
    // C insufficient_funds(): zero cost checks for exhausted cash and credit.
    if (cost === 0 && funds === 0) {
        await plineWithContinuation(`You ${hiddenGold(state, true) ? 'seem to ' : ''}have no gold or credit left.`);
        return false;
    }
    if (funds >= cost) return true;
    const originalQuantity = item.object.quan;
    // dopayobj() leaves the payment quantity in place during refusal feedback.
    item.object.quan = item.quantity;
    try {
        await plineWithContinuation(`You don't${hiddenGold(state, true) ? ' seem to' : ''} have gold${
            resident.eshk.credit ? ' or credit' : ''} enough to pay for ${await paymentObjectDescription(item.object, item.quantity, { state })}.`);
    } finally {
        item.object.quan = originalQuantity;
    }
    return false;
}

function outermostContainer(object: GameObject): GameObject {
    while (object.container) object = object.container;
    return object;
}

function containerContentsKnown(object: GameObject): boolean {
    while (object.container) {
        object = object.container;
        if (!object.cknown) return false;
    }
    return true;
}

function containedPurchases(resident: BilledShopkeeper, container: GameObject, state: GameState): GameObject[] {
    const objects = objectsInTimerGraph(state);
    const purchases: GameObject[] = [];
    for (const entry of resident.eshk.bill) {
        const object = objects.find(candidate => candidate.o_id === entry.bo_id);
        if (object && object !== container && outermostContainer(object) === container)
            purchases.push(object);
    }
    // Native buys the container last; its prior ownership controls the name.
    if (container.unpaid) purchases.push(container);
    return purchases;
}

// C shk.c:reject_purchase().
async function rejectPartlyUsedPurchase(resident: BilledShopkeeper, object: GameObject,
    entry: ShopBillEntry, state: GameState): Promise<void> {
    const intactQuantity = object.quan;
    // reject_purchase() restores the intact count after feedback returns.
    object.quan = entry.bquan - intactQuantity;
    try {
        const other = simpleObjectName(object, state);
        if (!heroIsDeaf(state) && !shopkeeperIsMuted(resident)) {
            const which = object.container ? `the one${intactQuantity > 1 ? 's' : ''} in ${
                definiteName(simpleObjectName(object.container, state), state)}`
                : intactQuantity > 1 ? 'these' : 'this one';
            await plineWithContinuation(`"${resident.mpeaceful ? 'Please pay' : 'Pay'} for the other ${other} before buying ${which}."`);
        } else {
            const gesture = monsterHasNoLimbs(resident.mnum) ? 'motions to' : 'points out';
            await plineWithContinuation(`${shopkeeperName(resident)} ${resident.mpeaceful ? '' : 'angrily '}${gesture} your bill for the other ${other} first.`);
        }
    } finally {
        object.quan = intactQuantity;
    }
}

export async function payShopkeeper(resident: Shopkeeper, price: number, state: GameState = game): Promise<void> {
    const credit = resident.eshk.credit ?? 0;
    const creditUsed = Math.min(credit, price);
    if (creditUsed)
        await plineWithContinuation(credit >= price ? 'The price is deducted from your credit.'
            : 'The price is partially covered by your credit.');
    resident.eshk.credit = credit - creditUsed;
    const gold = price - creditUsed;
    if (gold) await moneyToMonster(resident, gold, state);
    resident.eshk.robbed = Math.max(0, (resident.eshk.robbed ?? 0) - price);
    state.context.botl = true;
}

// Native compaction overwrites the vacated slot and preserves its identity.
function removeBillEntry(resident: BilledShopkeeper, entry: ShopBillEntry): void {
    const last = resident.eshk.bill.pop();
    if (last && last !== entry) {
        entry.bo_id = last.bo_id;
        entry.bquan = last.bquan;
        entry.price = last.price;
        entry.useup = last.useup;
    }
    resident.eshk.billct = resident.eshk.bill.length;
}

// C refs: shk.c:dopay(), rouse_shk(), menu_pick_pay_items(), pay(), and update_bill().
// An empty bill takes a turn when the keeper can respond. A payment menu
// takes no time until a debt or billed item is paid.
export async function dopay(): Promise<void> {
    setMulti(0);
    const stashedGold = hiddenGold(game, true) > 0;
    const target = await choosePaymentShopkeeper();
    if (!target) {
        game.context.move = 0;
        return;
    }

    const { keeper, resident } = target;
    const shop = keeper.eshk;
    const robbed = shop.robbed ?? 0;
    if (robbed || shop.billct || shop.debit) await rouseShopkeeper(keeper);
    if (monsterIsHelpless(keeper)) {
        const name = shopkeeperName(keeper, { capitalized: true });
        const response = rn2(2) ? 'seems to be napping' : "doesn't respond";
        await plineWithContinuation(`${name} ${response}.`);
        game.context.move = 0;
        return;
    }
    if (keeper !== resident && keeper.mpeaceful) {
        await payOutsideShop(keeper, robbed, stashedGold);
        game.context.move = 1;
        return;
    }
    if (!shop.billct && !shop.debit) {
        await settleEmptyBill(keeper, robbed, stashedGold);
        game.context.move = 1;
        return;
    }
    if (keeper !== resident) {
        await impossible('dopay: not to shopkeeper?');
        if (resident) setPaidShopkeeper(resident);
        game.context.move = 0;
        return;
    }

    let paid = false;
    const debt = Math.max(0, keeper.eshk?.debit ?? 0);
    if (debt) {
        const loan = keeper.eshk.loan ?? 0;
        const reason = !loan ? 'for the use of merchandise.'
            : loan === debt ? 'you picked up in the store.'
                : 'for gold picked up and the use of merchandise.';
        await plineWithContinuation(`You owe ${shopkeeperName(keeper)} ${debt} ${currency(debt)} ${reason}`);
        const payment = await payShopDebt(keeper, game);
        if (!payment.paid) {
            await plineWithContinuation(`But you don't${stashedGold ? ' seem to' : ''} have enough gold${keeper.eshk.credit ? ' or credit' : ''}.`);
            game.context.move = 1;
            return;
        }
        if (payment.creditUsed === payment.debt) {
            await plineWithContinuation('Your debt is covered by your credit.');
        } else if (payment.creditUsed) {
            await plineWithContinuation('That debt is partially offset by your credit.');
            await plineWithContinuation('You pay the remainder.');
        } else {
            await plineWithContinuation('You pay that debt.');
        }
        paid = true;
    }

    // pay_billed_items() checks the whole bill, including contained goods,
    // before offering item selection. Stashed gold cannot fund this payment.
    if (keeper === resident && (keeper.eshk?.billct ?? 0) > 0
        && !heroGoldAmount(game) && !(keeper.eshk?.credit ?? 0)) {
        await plineWithContinuation(`You ${hiddenGold(game, true) ? 'seem to ' : ''}have no gold or credit${paid ? ' left' : ''}.`);
        if (paid && keeper.mpeaceful)
            await plineWithContinuation(shopThankYouMessage(keeper));
        game.context.move = paid ? 1 : 0;
        return;
    }

    if (keeper === resident) {
        const purchase = await minimumShopPurchase(keeper);
        if (purchase && heroGoldAmount(game) + (keeper.eshk?.credit ?? 0) < purchase.price) {
            const items = purchase.multipleItems ? ' any of the items' : ' the item';
            const bill = (keeper.eshk?.billct ?? 0) > 1 ? "you've picked" : 'on your bill';
            await plineWithContinuation(`You don't have enough gold to buy${items} ${bill}.`);
            if (hiddenGold(game, true))
                await plineWithContinuation('Maybe you have some gold stashed away?');
            if (paid && keeper.mpeaceful)
                await plineWithContinuation(shopThankYouMessage(keeper));
            game.context.move = paid ? 1 : 0;
            return;
        }
    }

    const billed = await itemizedShopBill(keeper);
    if (!billed.length) {
        if (!paid) {
            await plineWithContinuation(`You do not owe ${shopkeeperName(keeper)} anything.`);
            if (keeper === resident && keeper.mpeaceful && !heroGoldAmount(game))
                await plineWithContinuation(`Moreover, you${hiddenGold(game, true) ? ' seem to' : ''} have no gold.`);
            game.context.move = 1;
            return;
        }
        if (keeper.mpeaceful) await plineWithContinuation(shopThankYouMessage(keeper));
        game.context.move = 1;
        return;
    }

    const selection = await chooseBilledItems(billed, (await minimumShopPurchase(keeper))?.multipleItems ?? false);
    let paidForItem = false;
    let finished = true;
    // Native queued selection buys in bill order, regardless of selection order.
    for (const item of selection.items) {
        const result = await buyShopBillItem(keeper, item, game, { itemize: selection.itemize });
        if (result === 'broke') {
            paidForItem = true;
            break;
        }
        if (result === 'stop') {
            finished = false;
            break;
        }
        if (result === 'skip') continue;
        paidForItem = true;
        if (selection.itemize || selection.queued) await bot();
    }
    game.iflags.menu_requested = false;
    if (!paid && !paidForItem) {
        game.context.move = 0;
        return;
    }
    if (finished && keeper.mpeaceful)
        await plineWithContinuation(shopThankYouMessage(keeper));
    game.context.move = 1;
}

async function chooseBilledItems(billed: ShopBillItem[], multiple: boolean): Promise<{
    items: ShopBillItem[]; itemize: boolean; queued: boolean;
}> {
    let viaMenu = (game.flags.menu_style ?? MENU_FULL) !== MENU_TRADITIONAL;
    if (game.iflags.menu_requested) viaMenu = !viaMenu;
    if (!viaMenu) {
        const answer = multiple
            ? await promptChoice('Itemized billing?', ['y', 'n', 'q', 'm'], 'q', { visibleChoices: 'ynq m' })
            : 'y';
        if (answer === 'q') return { items: [], itemize: false, queued: false };
        if (answer !== 'm') return { items: billed, itemize: answer === 'y', queued: false };
    }
    const selected = await paymentMenu(billed);
    return { items: billed.filter(item => selected.includes(item)), itemize: false, queued: true };
}

async function paymentMenu(billed: ShopBillItem[]): Promise<ShopBillItem[]> {
    for (const item of billed) observeObjectForNaming(item.object);
    const priceWidth = String(Math.max(...billed.map(item => item.price))).length;
    const used = billed.filter(item => item.kind === 'used');
    const intact = billed.filter(item => item.kind !== 'used');
    const sections = [];
    for (const group of [used, intact]) {
        if (!group.length) continue;
        const items = [];
        for (const item of group) items.push({
            key: String.fromCharCode(97 + billed.indexOf(item)),
            text: `${String(item.price).padStart(priceWidth)} Zm, ${await paymentObjectDescription(item.object, item.quantity)}`,
            value: item,
        });
        sections.push({
            heading: used.length ? `${group === used ? 'Used up' : 'Unpaid'} item${group.length > 1 ? 's' : ''}:` : '',
            items,
        });
    }
    // C select_menu() pages the pending topline with --More-- before the
    // menu is drawn; tty_display_nhwindow() owns that pager.
    await flush_screen(1);
    return await showMultiSelectWindow({
        title: 'Pay for which items?', sections,
        omitHeadings: !used.length,
    });
}

// next_shkp() applies the surcharge as it visits angry keepers. The linked
// native monster list runs from the newest monster to the oldest.
interface PaymentTarget {
    keeper: Shopkeeper;
    resident: Shopkeeper | null;
}

async function choosePaymentShopkeeper(): Promise<PaymentTarget | null> {
    const shopkeepers: Shopkeeper[] = [];
    let nearby: Shopkeeper | null = null;
    let nearbyCount = 0;
    let visibleCount = 0;
    let resident: Shopkeeper | null = null;
    const adjacent = (keeper: Shopkeeper) =>
        distmin(keeper.mx, keeper.my, game.u.ux, game.u.uy) <= 1;
    for (const monster of [...(game.level?.monsters ?? [])].reverse()) {
        if (!monster.isshk || monster.dead || monster.mhp <= 0 || !hasShopkeeperData(monster)) continue;
        if (!monster.mpeaceful && !monster.eshk.surcharge) rileShopkeeper(monster);
        shopkeepers.push(monster);
        if (adjacent(monster)) {
            // Once an angry neighbor has priority, C skips the remaining
            // visibility and residency checks for other adjacent keepers.
            if (nearby && !nearby.mpeaceful) continue;
            nearbyCount++;
            nearby = monster;
        }
        if (canSpotMonster(monster)) visibleCount++;
        if (shopkeeperInOwnShop(monster) && game.u.ushops?.[0] === monster.eshk.shoproom)
            resident = monster;
    }
    if (nearby && nearbyCount === 1) return { keeper: nearby, resident };
    const blind = heroIsBlind();
    if ((!shopkeepers.length && (!blind || game.u.blindTelepathy || game.u.telepathy))
        || (!blind && !visibleCount)) {
        await pline('There appears to be no shopkeeper here to receive your payment.');
        return null;
    }
    if (!visibleCount) {
        await pline("You can't see...");
        return null;
    }
    if (shopkeepers.length === 1 && resident) return { keeper: resident, resident };
    if (visibleCount === 1) {
        const keeper = shopkeepers.find(monster => canSpotMonster(monster));
        if (!keeper) throw new Error('Visible shopkeeper disappeared during payment.');
        if (keeper !== resident && !adjacent(keeper)) {
            await pline(`${shopkeeperName(keeper, { capitalized: true })} is not near enough to receive your payment.`);
            return null;
        }
        return { keeper, resident };
    }
    // C shk.c dopay(): pline("Pay whom?"), then getpos() adds its tip and
    // instructions to the same message window before reading a position.
    const goal = 'the creature you want to pay';
    await plineWithContinuation('Pay whom?');
    const tip = await showGetposTip();
    await showGetposInstructions();
    if (tip) await plineWithContinuation(`Move cursor to ${goal}:`);
    const position = await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy },
        prompt: game._pending_message, goal,
    });
    game._pending_message = '';
    if (!position) {
        // shk.c:dopay() returns ECMD_CANCEL when getpos() is dismissed;
        // the later "no one there" refusals stay ECMD_OK.
        commandResultCancelled();
        return null;
    }
    if (position.x === game.u.ux && position.y === game.u.uy) {
        await pline('You are generous to yourself.');
        return null;
    }
    const monster = game.level?.monsters.find(candidate => !candidate.dead
        && candidate.mhp > 0 && candidate.mx === position.x && candidate.my === position.y);
    if (!cansee(position.x, position.y) && (!monster || !canSpotMonster(monster))) {
        await pline(`You can't ${blind ? 'sense' : 'see'} anyone there.`);
    } else if (!monster) {
        await pline('There is no one there to receive your payment.');
    } else if (!monster.isshk || !hasShopkeeperData(monster)) {
        await pline(`${monsterName(monster, { capitalized: true })} is not interested in your payment.`);
    } else if (monster !== resident && !adjacent(monster)) {
        await pline(`${shopkeeperName(monster, { capitalized: true })} is too far to receive your payment.`);
    } else {
        return { keeper: monster, resident };
    }
    return null;
}

// A peaceful keeper away from the hero's shop accepts whatever is offered,
// even when that amount will not settle the robbery.
async function payOutsideShop(keeper: Shopkeeper, robbed: number, stashed: boolean): Promise<void> {
    const money = heroGoldAmount(game);
    if (!robbed) {
        await plineWithContinuation(`You do not owe ${shopkeeperName(keeper)} anything.`);
    } else if (!money) {
        await plineWithContinuation(`You ${stashed ? 'seem to ' : ''}have no gold.`);
        if (stashed) await plineWithContinuation('But you have some gold stashed away.');
    } else {
        if (money > robbed) {
            await plineWithContinuation(`You give ${shopkeeperName(keeper)} the ${robbed} gold piece${robbed === 1 ? '' : 's'} ${monsterSubjectPronoun(keeper, { noIt: true })} asked for.`);
            await payShopkeeper(keeper, robbed);
        } else {
            await plineWithContinuation(`You give ${shopkeeperName(keeper)} all your${stashed ? ' openly kept' : ''} gold.`);
            await payShopkeeper(keeper, money);
            if (stashed) await plineWithContinuation('But you have hidden gold!');
        }
        if (money < Math.trunc(robbed / 2) || money < robbed && stashed) {
            await plineWithContinuation(`Unfortunately, ${monsterSubjectPronoun(keeper, { noIt: true })} doesn't look satisfied.`);
        } else await makeShopkeeperHappy(keeper);
    }
}

async function settleEmptyBill(keeper: Shopkeeper, robbed: number, stashed: boolean): Promise<void> {
    const money = heroGoldAmount(game);
    if (!robbed && keeper.mpeaceful) {
        await plineWithContinuation(`You do not owe ${shopkeeperName(keeper)} anything.`);
        if (!money) await plineWithContinuation(`Moreover, you${stashed ? ' seem to' : ''} have no gold.`);
    } else if (robbed) {
        await plineWithContinuation(`${shopkeeperName(keeper)} is after blood, not gold!`);
        if (money < Math.trunc(robbed / 2) || money < robbed && stashed) {
            await rejectRestitution(keeper, money, stashed);
            return;
        }
        await plineWithContinuation(`But since ${monsterPossessive(keeper, { noIt: true })} shop has been robbed recently,`);
        await plineWithContinuation(`you ${money < robbed ? 'partially ' : ''}compensate ${shopkeeperName(keeper)} for ${monsterPossessive(keeper, { noIt: true })} losses.`);
        await payShopkeeper(keeper, Math.min(money, robbed));
        await makeShopkeeperHappy(keeper);
    } else {
        await plineWithContinuation(`${shopkeeperName(keeper, { capitalized: true })} is after your hide, not your gold!`);
        if (money < 1000) {
            await rejectRestitution(keeper, money, stashed);
            return;
        }
        const name = canSpotMonster(keeper)
            ? monsterName(keeper, { adjective: 'angry' }) : shopkeeperName(keeper);
        await plineWithContinuation(`You try to appease ${name} by giving ${monsterObjectPronoun(keeper, { noIt: true })} 1000 gold pieces.`);
        await payShopkeeper(keeper, 1000);
        if (keeper.eshk.customer !== game.plname || rn2(3)) await makeShopkeeperHappy(keeper);
        else await plineWithContinuation(`But ${shopkeeperName(keeper)} is as angry as ever.`);
    }
}

async function rejectRestitution(keeper: Shopkeeper, money: number, stashed: boolean): Promise<void> {
    await plineWithContinuation(!money
        ? `Moreover, you${stashed ? ' seem to' : ''} have no gold.`
        : `Besides, you don't have enough to interest ${monsterObjectPronoun(keeper, { noIt: true })}.`);
}

// C shk.c:1381 rouse_shk(): greed-induced recovery.
export async function rouseShopkeeper(resident: Monster, publish: MessagePublisher = plineWithContinuation): Promise<void> {
    if (monsterIsHelpless(resident)) {
        if (canSpotMonster(resident)) {
            await publish(`${shopkeeperName(resident)} ${
                resident.msleeping ? 'wakes up' : 'can move again'}.`);
        }
        resident.msleeping = 0;
        resident.mfrozen = 0;
        resident.mcanmove = 1;
    }
}

// ---- pricing: C shk.c:set_cost() over the shared pure price owner ------
// Charisma and surcharge never enter the sell price.
export function shopOfferForObject(object: GameObject, resident: Monster | null, state: GameState = game): number {
    let tmp = objectPricingUnits(object)
        * shopGetPrice(object, true, state);
    let multiplier = 1;
    let divisor = 1;
    if (state.uarmh?.otyp === DUNCE_CAP) {
        divisor *= 3;
    } else if ((state.urole?.key === 'tourist'
            && (state.u?.ulevel ?? 1) < 15)
        || (state.uarmu && !state.uarm && !state.uarmc)) {
        divisor *= 3;
    } else {
        divisor *= 2;
    }
    const unknown = !object.dknown || !objectTypeKnown(object, state);
    if (unknown) {
        if (object.oclass === GEM_CLASS) {
            if ([19, 20].includes(objectMaterial(object.otyp))) {
                tmp = (object.otyp - FIRST_REAL_GEM)
                    % (6 - (resident?.m_id ?? 1) % 3);
                tmp = (tmp + 3) * objectQuan(object);
                divisor = 1;
            }
        } else if (tmp > 1 && (resident?.m_id ?? 1) % 4 === 0) {
            multiplier *= 3;
            divisor *= 4;
        }
    }
    if (tmp >= 1) {
        tmp *= multiplier;
        if (divisor > 1) {
            tmp = Math.trunc((Math.trunc((tmp * 10) / divisor) + 5) / 10);
        }
        if (tmp < 1) tmp = 1;
    }
    return tmp;
}

// ---- sellobj helpers ----------------------------------------------------

// C shk.c:3103 special_stock(): the candelabrum in a lighting store.
async function specialStock(resident: Shopkeeper, object: GameObject,
    { publish, state }: { publish: MessagePublisher; state: GameState }): Promise<boolean> {
    if ((resident?.eshk?.shoptype ?? SHOPBASE) !== SHOPBASE + 11
        || object.otyp !== CANDELABRUM_OF_INVOCATION) return false;
    // C is_izchak(shkp, TRUE): a shopkeeper in town whose (prefix-stripped)
    // name is Izchak; hallucination is overridden at this call site.
    const stripped = (resident.eshk.shknam ?? '').replace(/^[^a-zA-Z]/, '');
    const izchak = !!resident.isshk
        && inTown(state.level, resident.mx, resident.my)
        && stripped === 'Izchak';
    if (izchak && !state.u?.uevent?.invoked) {
        if (!heroIsDeaf(state) && !shopkeeperIsMuted(resident)) {
            await publish('"No thanks, I\'d hang onto that if I were you."');
            if ((object.spe ?? 0) < 7) {
                const missing = 7 - (object.spe ?? 0);
                await publish(`"You'll need ${missing}${
                    (object.spe ?? 0) > 0 ? ' more' : ''} candle${
                    missing === 1 ? '' : 's'} to go along with it."`);
            }
        } else {
            await publish(`${shopkeeperName(resident)} seems ${
                (object.spe ?? 0) < 7 ? 'horrified' : 'concerned'
            } that you want to sell that.`);
        }
    } else if (!heroIsDeaf(state) && !shopkeeperIsMuted(resident)) {
        await publish('"I won\'t stock that.  Take it out of here!"');
    } else {
        await publish(`${shopkeeperName(resident)} shakes ${monsterPossessive(resident, { noIt: true })} head in refusal.`);
    }
    return true;
}

// C shk.c:3064 dropped_container().
function droppedContainerContents(object: GameObject, resident: Shopkeeper, sale: boolean): void {
    for (const content of object.contents || []) {
        if (content.oclass === COIN_CLASS) continue;
        if (!content.unpaid && !(sale && saleable(resident, content)))
            content.no_charge = true;
        if (content.contents?.length)
            droppedContainerContents(content, resident, sale);
    }
}

// C shk.c:2995 contained_cost(usell = TRUE): sell-side content price.
function containedSellCost(object: GameObject, resident: Shopkeeper, state: GameState): number {
    let price = 0;
    for (const content of object.contents || []) {
        if (content.oclass === COIN_CLASS) continue;
        if (saleable(resident, content) && !content.unpaid
            && content.oclass !== BALL_CLASS
            && !(content.oclass === FOOD_CLASS && content.oeaten)
            && !(objectIsCandle(content)
                && (content.age ?? 0)
                < 20 * (OBJECT_COST[content.otyp] ?? 0))) {
            price += shopOfferForObject(content, resident, state);
        }
        if (content.contents?.length) {
            price += containedSellCost(content, resident, state);
        }
    }
    return price;
}

function countAllContents(container: GameObject): number {
    let count = 0;
    for (const content of container.contents || []) {
        if (content.contents?.length)
            count += countAllContents(content);
        count += objectQuan(content);
    }
    return count;
}

function isGold(object: GameObject): boolean {
    return object.oclass === COIN_CLASS;
}

function hasContents(object: GameObject): boolean {
    return !!(object.contents?.length);
}

export const SELL_NORMAL = 0;

export const SELL_DELIBERATE = 1;

export const SELL_DONTSELL = 2;

export type SellDisposition = typeof SELL_NORMAL | typeof SELL_DELIBERATE | typeof SELL_DONTSELL;

type SellAnswer = 'y' | 'n' | 'a' | 'q';

type SaleQuery = (question: string, defaultAnswer: 'y' | 'n') => SellAnswer | Promise<SellAnswer>;

export type ShopSaleResult = { sold: false }
    | { sold: true; credit: number }
    | { sold: true; offer: number };

// C gs.sell_response / gs.sell_how / ga.auto_credit are command-batch
// globals bracketed by dodrop()/doddrop() through sellobj_state().  decl.c
// starts them at 'a' / SELL_NORMAL, so an accidental drop before any
// deliberate one sells without a query, like every later one.
// setSellDisposition(SELL_NORMAL) restores that automatic 'a' response; the
// parent's drop owner brackets deliberate drops and restores SELL_NORMAL in
// a finally.
let sellResponse: '' | SellAnswer = 'a';

let sellHow: SellDisposition = SELL_NORMAL;

let autoCredit = false;

export function setSellDisposition(disposition: SellDisposition): void {
    sellResponse = disposition === SELL_NORMAL ? 'a' : '';
    sellHow = disposition;
    autoCredit = false;
}

function moneyAmount(amount: number, state: GameState): string {
    return `${amount} ${currency(amount, { state })}`;
}

function goldPieces(amount: number): string {
    return `${amount} gold piece${amount === 1 ? '' : 's'}`;
}

// shk.c asks the credit offer with ynaq() (default yes) and the cash offer
// with nyaq() (default no); hack.h's two macros differ in that default.
function askSell(question: string, { query, defaultAnswer = 'n' }:
    { query: SaleQuery; defaultAnswer?: 'y' | 'n' }): SellAnswer | Promise<SellAnswer> {
    return query(question, defaultAnswer);
}

// C safe_qbuf() reserves the offer and question before short_oname()
// abbreviates user names. Cash offers use xname/simpleonames; credit offers
// use doname/thesimpleoname. The object's full names survive the question.
async function saleQuestion(object: GameObject, prefix: string, suffix: string,
    one: boolean, state: GameState, kind: 'cash' | 'credit'): Promise<string> {
    const limit = QBUFSZ - 1 - prefix.length - suffix.length;
    const describe = async (item: GameObject, nameState: GameState): Promise<string> => {
        if (kind === 'cash')
            return objectCombatName(item, { state: nameState, includeCorpseSpecies: false });
        observeObjectForNaming(item, { state: nameState });
        return await objectDescription(item, { state: nameState });
    };
    const question = (name: string): string => `${prefix}${name}${suffix}`;
    let name = await describe(object, state);
    if (name.length <= limit) return question(name);

    const callName = state._objectCallNames?.[object.otyp];
    const personalName = object.oextra?.oname || object.oname;
    const shortCallState = callName && callName.length >= 12
        ? { ...state, _objectCallNames: {
            ...state._objectCallNames, [object.otyp]: `${callName.slice(0, 8)}...`,
        } } : state;
    const shortNamedObject = personalName && personalName.length >= 12
        ? { ...object, oextra: { ...object.oextra, oname: `${personalName.slice(0, 8)}...` } }
        : object;
    if (shortCallState !== state) {
        name = await describe(object, shortCallState);
        if (name.length <= limit) return question(name);
    }
    if (shortNamedObject !== object) {
        name = await describe(shortNamedObject, state);
        if (name.length <= limit) return question(name);
    }
    const shortenBoth = shortCallState !== state && shortNamedObject !== object;
    if (shortenBoth) {
        name = await describe(shortNamedObject, shortCallState);
        if (name.length <= limit) return question(name);
    }

    // Native retains abbreviated names during attribute removal only when
    // both names needed shortening; the separate attempts restore them.
    const nameState = shortenBoth ? shortCallState : state;
    const plainObject = { ...(shortenBoth ? shortNamedObject : object),
        bknown: false, rknown: false, greased: false, oeroded: 0, oeroded2: 0 };
    name = await describe(plainObject, nameState);
    if (name.length > limit) {
        name = simpleObjectName(plainObject, nameState);
        if (kind === 'credit') name = definiteName(name, nameState);
    }
    if (name.length > limit) name = one ? 'that' : 'those';
    return question(name);
}

// C shk.c:3873 donate_gold().
export async function donateGold(amount: number, resident: Shopkeeper,
    { selling = true, publish = plineWithContinuation, state = game }:
    { selling?: boolean; publish?: MessagePublisher; state?: GameState } = {}): Promise<void> {
    const eshk = resident.eshk;
    if ((eshk.debit ?? 0) >= amount) {
        if (eshk.loan) {
            eshk.loan = (eshk.loan ?? 0) > amount
                ? eshk.loan - amount : 0;
        }
        eshk.debit = (eshk.debit ?? 0) - amount;
        await publish(
            `Your debt is ${eshk.debit ? 'partially ' : ''}paid off.`);
    } else {
        const delta = amount - (eshk.debit ?? 0);
        eshk.credit = (eshk.credit ?? 0) + delta;
        if (eshk.debit) {
            eshk.debit = 0;
            eshk.loan = 0;
            await publish('Your debt is paid off.');
        }
        if (eshk.credit === delta) {
            await publish(`You have ${selling ? '' : 're-'}established ${
                moneyAmount(delta, state)} credit.`);
        } else {
            await publish(`${moneyAmount(delta, state)} added${
                selling ? '' : ' back'} to your credit; total is now ${
                moneyAmount(eshk.credit, state)}.`);
        }
    }
}

// C shk.c:5745 costly_gold(): picking gold up in a shop pays down credit
// first, then becomes debt and loan.
export async function costlyGold(x: number, y: number, amount: number,
    { silent = false, publish = plineWithContinuation, state = game }:
    { silent?: boolean; publish?: MessagePublisher; state?: GameState } = {}): Promise<Shopkeeper | null> {
    requireLiveGame(state);
    const spot = costlySpot(x, y, state);
    if (!spot) return null;
    const eshk = spot.resident.eshk;
    if ((eshk.credit ?? 0) >= amount) {
        if (!silent) {
            if ((eshk.credit ?? 0) > amount) {
                await publish(`Your credit is reduced by ${moneyAmount(amount, state)}.`);
            } else {
                await publish('Your credit is erased.');
            }
        }
        eshk.credit = (eshk.credit ?? 0) - amount;
    } else {
        const delta = amount - (eshk.credit ?? 0);
        if (!silent) {
            if (eshk.credit) await publish('Your credit is erased.');
            if (eshk.debit) {
                await publish(`Your debt increases by ${moneyAmount(delta, state)}.`);
            } else {
                await publish(`You owe ${shopkeeperName(spot.resident)} ${moneyAmount(delta, state)}.`);
            }
        }
        eshk.debit = (eshk.debit ?? 0) + delta;
        eshk.loan = (eshk.loan ?? 0) + delta;
        eshk.credit = 0;
    }
    return spot.resident;
}

// ---- the owner: C shk.c:3927 sellobj() -----------------------------------

export async function sellHeroDroppedObject(object: GameObject, x: number, y: number, state: GameState = game,
    { publish = plineWithContinuation, query = promptYesNoAllQuit }:
    { publish?: MessagePublisher; query?: SaleQuery } = {}): Promise<ShopSaleResult> {
    requireLiveGame(state);
    requireShopGame(state);
    // do cheapest exclusion test first: the hero's own shop membership.
    if (!state.u.ushops.length) return { sold: false };
    const spot = costlySpot(x, y, state);
    if (!spot) return { sold: false };
    const resident = spot.resident;
    const eshk = resident.eshk;

    const container = hasContents(object);
    const gold = isGold(object);
    if (object.unpaid && !container && !gold) {
        removeObjectAndContentsFromBill(object, state);
        return { sold: false };
    }

    let cltmp = 0;
    let gltmp = 0;
    let cgold = false;
    if (container) {
        // find the price of contents before removing anything from the bill
        cltmp = containedSellCost(object, resident, state);
        gltmp = containedGold(object, true);
        cgold = gltmp > 0;
    }

    const saleitem = saleable(resident, object);
    let ltmp = 0;
    if (!gold && !object.unpaid && saleitem)
        ltmp = shopOfferForObject(object, resident, state);

    let offer = ltmp + cltmp;

    // you dropped something of your own - probably want to sell it
    await rouseShopkeeper(resident, publish);

    if (!resident.mpeaceful) {
        // they become shop-objects, no pay
        if (!heroIsDeaf(state) && !shopkeeperIsMuted(resident)) {
            await publish('"Thank you, scum!"');
        } else {
            await publish(`${shopkeeperName(resident)} smirks with satisfaction.`);
        }
        removeObjectAndContentsFromBill(object, state);
        return { sold: false };
    }

    // get one case out of the way: nothing to sell, and no gold
    if (!(gold || cgold)
        && ((offer + gltmp) === 0 || sellHow === SELL_DONTSELL)) {
        // C is_unpaid(): the flag or any unpaid descendant.
        const unpaid = objectIsUnpaid(object);
        if (container) {
            droppedContainerContents(object, resident, false);
            if (!object.unpaid) object.no_charge = true;
            if (unpaid) removeObjectAndContentsFromBill(object, state);
        } else {
            object.no_charge = true;
        }
        if (!unpaid && sellHow !== SELL_DONTSELL
            && !(await specialStock(resident, object,
                { publish, state }))) {
            await publish(`${shopkeeperName(resident)} seems uninterested.`);
        }
        return { sold: false };
    }

    if (eshk.robbed) {
        // bones; shop robbed by previous customer
        if (gold) offer = objectQuan(object);
        else if (cgold) offer += 1; // C adds the boolean, not the amount
        // In pinned C, '<' binds before '-=' in the balance update.
        // The existing nonzero robbed balance therefore clears even when
        // this contribution is worth less than the loss.
        eshk.robbed = 0;
        if (offer && !heroIsDeaf(state) && !shopkeeperIsMuted(resident)) {
            await publish('"Thank you for your contribution to restock this recently plundered shop."');
        }
        removeObjectAndContentsFromBill(object, state);
        return { sold: false };
    }

    if (gold || cgold) {
        if (!cgold) gltmp = objectQuan(object);

        await donateGold(gltmp, resident, { selling: true, publish });

        if (!offer || sellHow === SELL_DONTSELL) {
            if (!gold) {
                if (container)
                    droppedContainerContents(object, resident, false);
                if (!object.unpaid) object.no_charge = true;
                removeObjectAndContentsFromBill(object, state);
            }
            return { sold: false };
        }
    }

    if ((!saleitem && !(container && cltmp > 0))
        || (eshk.bill || []).length === BILLSZ
        || object.oclass === BALL_CLASS || object.oclass === CHAIN_CLASS
        || offer === 0
        || (object.oclass === FOOD_CLASS && object.oeaten)
        || (objectIsCandle(object)
            && (object.age ?? 0) < 20 * (OBJECT_COST[object.otyp] ?? 0))) {
        await publish(`${shopkeeperName(resident)} seems uninterested${
            cgold ? ' in the rest' : ''}.`);
        if (container) droppedContainerContents(object, resident, false);
        object.no_charge = true;
        return { sold: false };
    }

    const shkmoney = monsterGoldAmount(resident);
    if (!shkmoney) {
        const tmpcr = Math.trunc((offer * 9) / 10) + (offer <= 1 ? 1 : 0);
        let answer;
        if (sellHow === SELL_NORMAL || autoCredit) {
            answer = sellResponse = 'y';
        } else if (sellResponse !== 'n') {
            await publish(`${shopkeeperName(resident)} cannot pay you at present.`);
            recordObjectPriceQuote(object.otyp,
                Math.trunc(tmpcr / objectQuan(object)), 'sell');
            const prefix = `Will you accept ${moneyAmount(tmpcr, state)} in credit for `;
            answer = await askSell(await saleQuestion(object, prefix, '?',
                object.quan === 1, state, 'credit'), { query, defaultAnswer: 'y' });
            if (answer === 'a') {
                answer = 'y';
                autoCredit = true;
            }
        } else {
            answer = 'n';
        }

        if (answer === 'y') {
            const creditAmount = `${tmpcr} zorkmid${tmpcr === 1 ? '' : 's'}`;
            await nameShopTransaction(resident, object,
                it => sellHow !== SELL_NORMAL
                    ? `traded ${it} for ${creditAmount} in ${
                        (eshk.credit ?? 0) > 0 ? 'additional ' : ''}credit.`
                    : `relinquish ${it} and acquire ${creditAmount} in ${(eshk.credit ?? 0) > 0
                        ? 'additional ' : ''}credit.`,
                { publish, state });
            eshk.credit = (eshk.credit ?? 0) + tmpcr;
            if (container) droppedContainerContents(object, resident, true);
            removeObjectAndContentsFromBill(object, state);
            return { sold: true, credit: tmpcr };
        }
        if (answer === 'q') sellResponse = 'n';
        if (container) droppedContainerContents(object, resident, false);
        if (!object.unpaid) object.no_charge = true;
        removeObjectAndContentsFromBill(object, state);
        return { sold: false };
    }

    const shortFunds = offer > shkmoney;
    if (shortFunds) offer = shkmoney;
    if (!sellResponse) {
        let yourc = 0;
        let onlyPartially = false;
        if (container) {
            const shksc = countUnpaidContents(object);
            yourc = countAllContents(object) - shksc;
            onlyPartially = shksc > 0 && yourc > 0;
        }
        const one = !ltmp ? yourc === 1
            : objectQuan(object) === 1 && !cltmp;
        let contentsSuffix = '';
        if (cltmp && ltmp) {
            contentsSuffix = onlyPartially
                ? (yourc === 1 ? ' and item inside' : ' and items inside')
                : ' and its contents';
        }
        recordObjectPriceQuote(object.otyp,
            Math.trunc(offer / objectQuan(object)), 'sell');
        const prefix = `${shopkeeperName(resident)} offers${
            shortFunds ? ' only' : ''} ${goldPieces(offer)} for ${
            cltmp && !ltmp
                ? (yourc === 1 ? 'your item in ' : 'your items in ') : ''
        }${object.unpaid ? 'the' : 'your'} `;
        const suffix = `${contentsSuffix}.  Sell ${one ? 'it' : 'them'}?`;
        const question = await saleQuestion(object, prefix, suffix, one, state, 'cash');
        const answer = await askSell(question, { query });
        if (answer === 'q') sellResponse = 'n';
        if (answer === 'a') sellResponse = 'y';
        if (answer === 'y' || answer === 'a') {
            if (container) droppedContainerContents(object, resident, true);
            if (!object.unpaid && !saleitem) object.no_charge = true;
            removeObjectAndContentsFromBill(object, state);
            await moneyToHero(resident, offer, state);
            const partialContents = !ltmp && cltmp > 0 && onlyPartially;
            await nameShopTransaction(resident, object,
                it => sellHow !== SELL_NORMAL
                    ? `sold ${partialContents ? 'some items inside ' : ''}${it} for ${goldPieces(offer)}.`
                    : `relinquish ${it} and receive ${goldPieces(
                        offer)} in compensation.`,
                { publish, state });
            return { sold: true, offer };
        }
    } else {
        // recorded response: apply it without a new query
        if (sellResponse === 'y' || sellResponse === 'a') {
            if (container) droppedContainerContents(object, resident, true);
            if (!object.unpaid && !saleitem) object.no_charge = true;
            removeObjectAndContentsFromBill(object, state);
            await moneyToHero(resident, offer, state);
            await nameShopTransaction(resident, object,
                it => sellHow !== SELL_NORMAL
                    ? `sold ${it} for ${goldPieces(offer)}.`
                    : `relinquish ${it} and receive ${goldPieces(
                        offer)} in compensation.`,
                { publish, state });
            return { sold: true, offer };
        }
    }
    if (container) droppedContainerContents(object, resident, false);
    if (!object.unpaid) object.no_charge = true;
    removeObjectAndContentsFromBill(object, state);
    return { sold: false };
}

// C shk.c:shk_move(): return 1: moved  0: didn't  -1: let m_move do it.
// Chooses a goal before move_special() selects a square.
export async function moveShopkeeper(
    monster: Monster,
    state: PlayingGameState,
    random: RandomBelow,
    rollDice: RollDice,
    rollOne: RollOne,
    calls: MonsterCallLog,
): Promise<MonsterMovement | null> {
    if (!monster.isshk || !hasShopkeeperData(monster)) return null;
    const oldx = monster.mx;
    const oldy = monster.my;
    if (shopkeeperInOwnShop(monster, state)) await shopkeeperRepairsDamage(monster, state);

    const eshk = monster.eshk;
    const heroX = state.u.ux;
    const heroY = state.u.uy;
    const distance = dist2(oldx, oldy, heroX, heroY);
    const home = eshk.shk;
    const atHome = oldx === home.x && oldy === home.y;
    const stopped: MonsterMovement = {
        oldx,
        oldy,
        x: oldx,
        y: oldy,
        moved: false,
        postMoveStatus: MMOVE_NOTHING,
        movementStage: 'postmov',
        shopkeeper: true,
    };
    if (
        distance < 3 &&
        (MONSTER_NAME[monster.mnum] !== 'grid bug' || oldx === heroX || oldy === heroY)
    ) {
        if (
            !monster.mpeaceful ||
            (heroHasConflict(state) && !resistConflict(monster, state, rollOne, calls))
        ) {
            if (heroIsDisplaced(state)) {
                await plineWithContinuation(
                    `Your displaced image doesn't fool ${shopkeeperName(monster, { state })}!`,
                );
            }
            return {
                ...stopped,
                deferredAfterSpecialAttack: true,
                ...await beginMonsterHeroAttack(
                    monster,
                    state,
                    random,
                    rollOne,
                    rollDice,
                    calls,
                ),
            };
        }
        if (eshk.following) {
            if ((eshk.customer ?? '').slice(0, PL_NSIZ) !== state.plname.slice(0, PL_NSIZ)) {
                if (!heroIsDeaf(state) && !shopkeeperIsMuted(monster)) {
                    await plineWithContinuation(
                        `"${shopGreeting(monster, state)}, ${state.plname}!  I was looking for ${eshk.customer}."`,
                    );
                }
                eshk.following = false;
                return stopped;
            }
            if (state.moves > (state._shopFollowMessageTurn ?? 0) + 4) {
                if (!heroIsDeaf(state) && !shopkeeperIsMuted(monster)) {
                    await plineWithContinuation(
                        `"${shopGreeting(monster, state)}, ${state.plname}!  Didn't you forget to pay?"`,
                    );
                } else {
                    await plineWithContinuation(
                        `${shopkeeperName(monster, { state, capitalized: true })} holds out ${monsterPossessive(
                            monster,
                            { state, random, noIt: true },
                        )} upturned ${monsterHandName(monster.mnum)}.`,
                    );
                }
                state._shopFollowMessageTurn = state.moves;
                if (!recordRandom(random, calls, 9)) {
                    await plineWithContinuation(
                        `${shopkeeperName(monster, { state, capitalized: true })} doesn't like customers who don't pay.`,
                    );
                    rileShopkeeper(monster);
                }
            }
            if (distance < 2) return stopped;
        }
    }
    let goalX = home.x;
    let goalY = home.y;
    let approach = 1;
    let heroOnDoor = false;
    let avoid = false;
    const holeTime = eshk.following ? -1 : diggingTimeToHole(state);
    if (eshk.following || (holeTime >= 0 && holeTime * holeTime <= distance)) {
        if (distance > 4 && eshk.following && !eshk.billct) return null;
        goalX = heroX;
        goalY = heroY;
    } else if (!monster.mpeaceful) {
        if (specialMoverSeesHero(monster, state)) {
            goalX = heroX;
            goalY = heroY;
        }
    } else if (!heroIsInvisible(state) && !state.u.usteed) {
        heroOnDoor = heroX === eshk.shd.x && heroY === eshk.shd.y;
        let hasDiggingTool = false;
        if (heroOnDoor) {
            const isPick = (object: GameObject) =>
                object.otyp === PICK_AXE || object.otyp === DWARVISH_MATTOCK;
            hasDiggingTool =
                state.inventory.some(isPick) ||
                !!(
                    (state.u.fast || state.u.veryFast) &&
                    state.level.objects[heroX]?.[heroY]?.some(isPick)
                );
            if (atHome && hasDiggingTool) return stopped;
            avoid = !hasDiggingTool;
        } else {
            avoid = state.u.ushops.length > 0 && dist2(heroX, heroY, home.x, home.y) > 8;
        }
        if (
            ((!eshk.robbed && !eshk.billct && !eshk.debit) || avoid) &&
            dist2(oldx, oldy, home.x, home.y) < 3
        ) {
            if (!hasDiggingTool && !pointsOnline(oldx, oldy, heroX, heroY)) return stopped;
            if (atHome) approach = goalX = goalY = 0;
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
export function setShopResidency(monster: Monster, zeroOut: boolean, state: GameState): void {
    if (!monster.isshk || !monster.eshk) return;
    if (!sameShopLevel(monster.eshk.shoplevel, state.u?.uz)) return;
    const room = roomForRoomno(state.level, monster.eshk.shoproom);
    if (room) room.resident = zeroOut ? null : monster;
}

function sameShopLevel(first: { dnum: number; dlevel: number } | null | undefined, second: { dnum: number; dlevel: number } | null | undefined): boolean {
    return !!first && !!second
        && first.dnum === second.dnum
        && first.dlevel === second.dlevel;
}
