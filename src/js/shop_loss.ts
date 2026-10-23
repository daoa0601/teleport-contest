// C shk.c:stolen_value() and the shop tail of dokick.c:container_impact_dmg().
// Reusable by drop-side theft owners (swallowed objects, destroyed contents).

import { HUNGRY, SHOPBASE } from './const.js';
import { shopkeeperName } from './monster_name.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import type { GameObject } from './object_types.js';
import type { Monster, MonsterFlag, ShopBillEntry } from './monster_types.js';
import { hasShopkeeperData } from './shop_types.js';
import type { Shopkeeper } from './shop_types.js';
import { containedGold } from './gold.js';
import { angerWatchGuards } from './monster_anger.js';
import {
    MONSTER_CONVEYS, MONSTER_FLAGS1, MONSTER_GENO, MONSTER_LEVEL,
    MONSTER_NAME, MONSTER_NUTRITION, MONSTER_SOUND,
} from './monster_data.js';
import { artifactById } from './artifacts.js';
import {
    CORPSE, EGG, OBJECT_COST, OBJECT_NAMES, TIN,
} from './object_data.js';
import { monsterIsHelpless } from './monster_sleep.js';
import { OBJECT_WEIGHT } from './object_data.js';
import { roomsAt } from './room.js';
import { currency } from './currency.js';
import { heroIsDeaf } from './senses.js';
import {
    costlySpot, insideShopRoomAt, removeOneObjectFromBill,
    shopResident, shopkeeperInOwnShop, shopObjectUnitCost, visitBilledShopkeepers,
} from './shk.js';
import {
    hotPursuitShopkeeper, makeAngryShopkeeper,
} from './shop_damage.js';
import { objectWeight } from './weight.js';

const COIN_CLASS = 12;
const FOOD_CLASS = 7;
const MS_ANIMAL = 17; // C monflag.h: msound at or below this is not speech

export function shopkeeperIsMuted(resident: Monster): boolean {
    // C shk.c:58 muteshk(): helpless, or no capability for human speech.
    return monsterIsHelpless(resident)
        || (MONSTER_SOUND[resident?.mnum] ?? 0) <= MS_ANIMAL;
}

function objectQuan(object: GameObject): number {
    return object.quan ?? object.quantity ?? 1;
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

export function onBillEntry(object: GameObject, resident: Monster | null | undefined): ShopBillEntry | null {
    return (resident?.eshk?.bill || [])
        .find(entry => entry.bo_id === object?.o_id) ?? null;
}

// ---- shared pure price owner: C shk.c:getprice()/corpsenm_price_adj() ----
// Both buy and sell pricing consume this; keeping one owner prevents the
// two directions from drifting apart.

const POT_WATER = OBJECT_NAMES.indexOf('water');
const WAX_CANDLE = OBJECT_NAMES.indexOf('wax candle');
const TALLOW_CANDLE = OBJECT_NAMES.indexOf('tallow candle');
const M1_TPORT = 0x02000000;
const M1_TPORT_CNTRL = 0x04000000;
const G_UNIQ = 0x1000;
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
const PM_MIND_FLAYER = MONSTER_NAME.indexOf('mind flayer');
const PM_MASTER_MIND_FLAYER = MONSTER_NAME.indexOf('master mind flayer');

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

// C eat.c:888 intrinsic_possible().  The eight resistance terms read
// mconveys (MONSTER_CONVEYS, MR_* bit layout shared with MONSTER_RESISTS);
// the movement and mind terms read MONSTER_FLAGS1 and species identity.
const CONVEYED_RESISTANCE_BITS = {
    fire: 0x01,
    cold: 0x02,
    sleep: 0x04,
    disintegration: 0x08,
    shock: 0x10,
    poison: 0x20,
    acid: 0x40,
    stoning: 0x80,
};

type CorpseIntrinsic = keyof typeof CONVEYED_RESISTANCE_BITS
    | 'teleport' | 'teleport-control' | 'telepathy';

function intrinsicPossible(intrinsic: CorpseIntrinsic, mnum: number): boolean {
    if (intrinsic === 'teleport')
        return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_TPORT);
    if (intrinsic === 'teleport-control')
        return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_TPORT_CNTRL);
    if (intrinsic === 'telepathy') {
        return mnum === PM_FLOATING_EYE || mnum === PM_MIND_FLAYER
            || mnum === PM_MASTER_MIND_FLAYER;
    }
    return !!((MONSTER_CONVEYS[mnum] ?? 0) & CONVEYED_RESISTANCE_BITS[intrinsic]);
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
        const intrinsicCosts: ReadonlyArray<readonly [CorpseIntrinsic, number]> = [
            ['fire', 2], ['sleep', 3], ['cold', 2], ['disintegration', 5],
            ['shock', 4], ['poison', 2], ['acid', 1], ['stoning', 3],
            ['teleport', 2], ['teleport-control', 3], ['telepathy', 5],
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

// C picked_container() (shk.c:3093): picking a no_charge container up again
// clears the flag from its contents.
export function pickedContainer(container: GameObject): void {
    for (const content of container.contents || []) {
        if (content.oclass === COIN_CLASS) continue;
        if (content.no_charge) content.no_charge = false;
        if (content.contents?.length) pickedContainer(content);
    }
}

// C invent.c:count_contents(container, nested, quantity, everything, FALSE).
function countContents(container: GameObject, { quantity = false, everything = false } = {},
    state: GameState = game): number {
    let shoppy = false;
    if (!everything) {
        let top = container;
        while (top.container) top = top.container;
        if (top.where === 'floor')
            shoppy = !!costlySpot(top.ox, top.oy, state);
    }
    let count = 0;
    for (const content of container.contents || []) {
        if (content.contents?.length)
            count += countContents(content, { quantity, everything }, state);
        if (everything || content.unpaid || (shoppy && !content.no_charge))
            count += quantity ? objectQuan(content) : 1;
    }
    return count;
}

// C shk.c:contained_cost(usell = FALSE): buy-side price of contents.  The
// sell-side twin lives with the sell owner (js/shop_sell.js).
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

// dokick.c:443-450 per-item adapter: mark no_charge for the hero's own
// contents, then charge the item at its pre-destruction value.  Called by
// the container-impact owner immediately before each deletion.
export async function chargeDestroyedShopContent(object: GameObject, x: number, y: number, fromInventory: boolean,
    { publish = plineWithContinuation, state = game }:
    { publish?: MessagePublisher; state?: GameState } = {}): Promise<number> {
    requireLiveGame(state);
    const spot = costlySpot(x, y, state);
    if (!spot) return 0;
    if (fromInventory && !object.unpaid) object.no_charge = true;
    return stolenValue(object, x, y, !!spot.resident.mpeaceful,
        { silent: true, publish, state });
}

// dokick.c:476-484 summary: insider debt or outsider damage and anger.
export async function settleDestroyedShopCharges(
    { loss, x, y, publish = plineWithContinuation, state = game }:
    { loss: number; x: number; y: number; publish?: MessagePublisher; state?: GameState },
): Promise<{ loss: number; settled: boolean }> {
    requireLiveGame(state);
    const spot = costlySpot(x, y, state);
    if (!spot || !loss) return { loss, settled: false };
    const objectRooms = roomsAt(state.level, x, y, SHOPBASE);
    // C inside_shop(): a boundary hero is an outsider; the decode is the
    // shared shk helper, and the first-room equality stays separate.
    const heroRoom = insideShopRoomAt(state, state.u.ux, state.u.uy);
    const insider = heroRoom != null && objectRooms[0] === heroRoom.roomno;
    if (!insider) {
        await publish(`You caused ${zorkmids(loss)} worth of damage!`);
        await makeAngryShopkeeper(spot.resident, state);
    } else {
        await publish(`You owe ${shopkeeperName(spot.resident)} ${zorkmids(loss)} for objects destroyed.`);
    }
    return { loss, settled: true };
}
