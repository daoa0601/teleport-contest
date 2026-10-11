// shop_damage.js — Shop-damage bookkeeping owned by the shop system.
// C refs: shk.c add_damage() [4399], shopdig() [5019], pay_for_damage() and
// its static getcad() [5138-5346], repair_damage() and its litter helpers
// [4579-4845], shk_fixes_damage() [4556], fix_shop_damage() [4850], and the
// shared shk lifecycle helpers they call: rile_shk() [1362], pacify_shk()
// [1344], home_shk() [1317], hot_pursuit() [1449], check_credit() [1278],
// money2mon() [157].
//
// Damage records live in state.level.damagelist, mirroring C's
// svl.level.damagelist.  New records are prepended like the C list.

import { deleteTrap } from './trap_lifecycle.js';
import { monsterPossessive, shopkeeperName } from './monster_name.js';
import { adjustHeroAlignment } from './alignment.js';
import { unplaceBallAndChain, placeBallAndChain, heroIsPunished } from './ball.js';
import {
    pline, plineWithContinuation, canSpotMonster, canSeeMonster, canSenseMonster, newsym,
} from './display.js';
import { deleteEngravingAt } from './engrave.js';
import { game, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import { isRoom } from './map_types.js';
import type { ShopDamage, Trap } from './map_types.js';
import { hasShopkeeperData, requireShopGame } from './shop_types.js';
import type { ShopGameState, Shopkeeper } from './shop_types.js';
import { dist2 } from './hacklib.js';
import { removeHeroEquipment, removeWornHeroItem } from './hero_equipment.js';
import { heroPassesWalls, heroPolyGender, heroSpecies } from './hero_species.js';
import { getObjectLocation, unlinkObject } from './object_location.js';
import { finishInventoryRemoval } from './hero_inventory.js';
import { detachHeroGold, heroGoldAmount, heroGoldObject } from './hero_gold.js';
import { impossible } from './diagnostics.js';
import { currency } from './currency.js';
import { flush_screen } from './display.js';
import { promptYesNo } from './query.js';
import { linkObjectToMonsterInventory } from './monster_inventory.js';
import { publishMonsterGrowl, publishMonsterYelp } from './monster_anger.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SOUND, MONSTER_SYMBOL,
} from './monster_data.js';
import { mksobj } from './mklev.js';
import { migrateMonsterOffLevel, sendMonsterToLimbo } from './monster_migration.js';
import { dropSpecialMonsterObjects } from './monster_drop.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { monsterAtPosition } from './monster_location.js';
import { clearMonsterWormFromMap } from './monster_worm.js';
import { moveMonsterNextToHero, relocateMonsterTo } from './teleport.js';
import {
    BEARTRAP, BOULDER, LAND_MINE, LEASH, ROCK,
} from './object_data.js';
import { deallocateObject, deleteObject } from './object_delete.js';
import { placeObject, remove_object } from './floor_object.js';
import {
    afterShopkeeperMove, costlyAdjacent, costlySpot, currentShopResident,
    removeObjectAndContentsFromBill, shopkeeperInOwnShop,
} from './shk.js';
import { rn2 } from './rng.js';
import { roomForRoomno, roomsAt } from './room.js';
import { findNearbyMonsterPosition, goodPosition } from './teleport_rules.js';
import { stopHeroOccupation } from './occupation.js';
import { objectWeight } from './weight.js';
import {
    MIGR_APPROX_XY, MON_OFFMAP, RLOC_MSG, RLOC_NOMSG,
    BOLT_LIM, D_BROKEN, D_CLOSED, D_LOCKED, DOOR, IS_DOOR, IS_ROOM, IS_WALL,
    LANDMINE, BEAR_TRAP, HOLE, PIT, ROOMOFFSET, ROOM, SHOPBASE, SPIKED_PIT,
    SVALL, TT_PIT, W_QUIVER, W_SWAPWEP, ZAP_POS,
    isok,
} from './const.js';
import { cansee, vision_note_blocker_change } from './vision.js';

// C include/monflag.h enum msound: animal noises end at MS_ANIMAL, and any
// voice at or above MS_HUMANOID can hold a conversation.
const MS_ANIMAL = 17;
const MS_HUMANOID = 25;
const M1_NOLIMBS = 0x00006000;
const M1_WALLWALK = 0x00000008;
const M2_DEMON = 0x00000100;

// C include/mextra.h.
export const REPAIR_DELAY = 5;

const ANGRY_TEXTS = ['quite upset', 'ticked off', 'furious'];

function monsterAt(state: ShopGameState, x: number, y: number): Monster | null {
    return monsterAtPosition(state.level, x, y);
}

function trapAt(state: GameState, x: number, y: number): Trap | null {
    return (state.level?.traps || []).find(trap =>
        trap.tx === x && trap.ty === y) || null;
}

function objectsAt(state: GameState, x: number, y: number): GameObject[] {
    return state.level?.objects?.[x]?.[y] || [];
}

// C hack.h distu()/mdistu(): squared euclidean distance.
function distu(state: GameState, x: number, y: number): number {
    return dist2(x, y, state.u.ux, state.u.uy);
}

function umDist(state: GameState, x: number, y: number, n: number): boolean {
    return Math.abs(state.u.ux - x) > n || Math.abs(state.u.uy - y) > n;
}

// C include/you.h m_next2u(): squared distance within 2, the 8 neighbors.
function mNext2u(monster: Monster, state: GameState): boolean {
    return distu(state, monster.mx, monster.my) <= 2;
}

function monsterHelpless(monster: Monster): boolean {
    return !!(monster?.msleeping || monster?.mcanmove === 0
        || (monster?.mfrozen ?? 0) > 0);
}

function monsterNolimbs(monster: Monster): boolean {
    return ((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_NOLIMBS)
        === M1_NOLIMBS;
}

function monsterSound(monster: Monster): number {
    return MONSTER_SOUND[monster?.mnum] ?? 0;
}

// C shk.c muteshk(): a keeper who cannot speak up.
function muteShopkeeper(monster: Monster): boolean {
    return monsterHelpless(monster) || monsterSound(monster) <= MS_ANIMAL;
}

function heroIsDeafNow(state: GameState): boolean {
    return !!(state.u?.deaf || state.deaf);
}

function heroIsInvisible(state: GameState): boolean {
    return !!(state.u?.invisible || state.u?.invis);
}

async function verbalize(message: string): Promise<void> {
    await pline(`"${message}"`);
}

// C shk.c cad(): a demon form wins outright; otherwise poly_gender() picks
// cad/minx/beast.
export function shopkeeperCustomerInsult(state: GameState, altUsage = false): string {
    const species = heroSpecies(state);
    const gender = (MONSTER_FLAGS2[species] ?? 0) & M2_DEMON
        ? 3 : heroPolyGender(state);
    const word = ['cad', 'minx', 'beast', 'fiend'][gender] || 'thing';
    return altUsage ? `"${word.charAt(0).toUpperCase()}${word.slice(1)}!  ` : word;
}

function damageRecords(state: ShopGameState): ShopDamage[] {
    if (!Array.isArray(state.level.damagelist))
        state.level.damagelist = [];
    return state.level.damagelist;
}

// C shk.c shop_keeper(): the registered resident of a shop room, regardless
// of where that resident currently stands.
function shopKeeper(state: ShopGameState, roomno: number): Shopkeeper | null {
    const resident = roomForRoomno(state.level, roomno)?.resident;
    return hasShopkeeperData(resident) && resident.isshk && !resident.dead
        && (resident.mhp ?? 1) > 0 ? resident : null;
}

function shopRoomnosAt(state: ShopGameState, x: number, y: number): number[] {
    return roomsAt(state.level, x, y, SHOPBASE);
}

// C shk.c inside_shop(): strictly inside shop walls, boundary excluded.
function insideShop(state: ShopGameState, x: number, y: number): number | null {
    const location = state.level?.at?.(x, y);
    const roomno = location?.roomno ?? 0;
    if (!location || roomno < ROOMOFFSET || location.edge) return null;
    const room = roomForRoomno(state.level, roomno);
    return room && (room.rtype ?? 0) >= SHOPBASE ? roomno : null;
}

function heroCarriesBillFor(keeper: Shopkeeper): boolean {
    return (keeper.eshk.bill?.length ?? 0) > 0;
}

// ---------------------------------------------------------------- relocation

// C mon.c mnearto(): bring the monster to <x,y>; shove any resident of the
// destination aside when moveOther is set.  A resident that cannot be
// re-housed goes to limbo via the migration owner and re-arrives on this
// level later (C deal_with_overcrowding() -> m_into_limbo()).
async function mnearto(
    monster: Monster, x: number, y: number, state: ShopGameState,
    { moveOther = false, flags = RLOC_NOMSG }: { moveOther?: boolean; flags?: number } = {},
): Promise<0 | 1 | 2> {
    if (monster.mx === x && monster.my === y
        && monsterAt(state, x, y) === monster) return 1;

    let othermon: Monster | null = null;
    if (moveOther) {
        const candidate = monsterAt(state, x, y);
        if (candidate && candidate !== monster) {
            othermon = candidate;
            // Keep the body nodes and deadline for the nested relocation.
            if (othermon.wormno) clearMonsterWormFromMap(othermon);
            othermon.mx = 0;
            othermon.my = 0;
            othermon.mstate = (othermon.mstate ?? 0) | MON_OFFMAP;
        }
    }

    let newx = x;
    let newy = y;
    if (!goodPosition(newx, newy, { kind: 'monster', monster }, { state })) {
        const near = findNearbyMonsterPosition(
            monster.mnum, newx, newy, { state });
        if (!near) {
            if (othermon) await sendMonsterToLimbo(othermon, state);
            return 0;
        }
        newx = near.x;
        newy = near.y;
    }
    await relocateMonsterTo(monster, newx, newy, { state, flags });

    if (moveOther && othermon) {
        const replaced = await mnearto(
            othermon, x, y, state, { moveOther: false, flags });
        if (!replaced) await sendMonsterToLimbo(othermon, state);
        return 2;
    }
    return 1;
}

// ---------------------------------------------------------- shk anger state

// C shk.c rile_shk(): make angry and raise every open bill entry by a third.
export function rileShopkeeper(monster: Shopkeeper): void {
    monster.mpeaceful = 0;
    const eshk = monster.eshk;
    if (eshk.surcharge) return;
    eshk.surcharge = true;
    for (const entry of eshk.bill || [])
        entry.price += Math.trunc((entry.price + 2) / 3);
}

// C shk.c pacify_shk(): make peaceful again, optionally undoing the bill
// surcharge.
export function pacifyShopkeeper(monster: Shopkeeper, clearSurcharge = false): void {
    monster.mpeaceful = 1;
    const eshk = monster.eshk;
    if (!clearSurcharge || !eshk.surcharge) return;
    eshk.surcharge = false;
    for (const entry of eshk.bill || [])
        entry.price -= Math.trunc((entry.price + 3) / 4);
}

// C shk.c:make_happy_shk(). Taming settles pursuit and returns a keeper
// to the owned shop; the open bill and its surcharge remain intact.
export async function makeShopkeeperHappy(
    monster: Shopkeeper,
    { state = game, silentKops = false }: { state?: GameState; silentKops?: boolean } = {},
): Promise<void> {
    requireShopGame(state);
    requireLiveGame(state);
    if (!state.urole || !state.u.ualign)
        throw new Error('Calming a shopkeeper requires the hero role and alignment.');
    const wasAngry = !monster.mpeaceful;
    const shop = monster.eshk;
    pacifyShopkeeper(monster);
    shop.following = 0;
    shop.robbed = 0;
    if (state.urole.key !== 'rogue') adjustHeroAlignment(Math.sign(state.u.ualign.type));
    if (!shopkeeperInOwnShop(monster, state)) {
        const name = shopkeeperName(monster, { state });
        let vanished = canSeeMonster(monster);
        const here = shop.shoplevel.dnum === state.u.uz.dnum
            && shop.shoplevel.dlevel === state.u.uz.dlevel;
        if (here) {
            await homeShopkeeper(monster, state);
            if (canSpotMonster(monster)) {
                const subject = shopkeeperName(monster, { state, capitalized: true });
                await plineWithContinuation(`${subject} returns to ${monster.female ? 'her' : 'his'} shop.`);
                vanished = false;
            }
        } else {
            if (canSenseMonster(monster)) vanished = true;
            await dropSpecialMonsterObjects(monster, state);
            const x = monster.mx, y = monster.my;
            await migrateMonsterOffLevel(monster, state, { dst: shop.shoplevel }, {
                kind: 'shop-return', mode: MIGR_APPROX_XY, coordinate: shop.shd,
            });
            newsym(x, y);
            shop.dismiss_kops = true;
        }
        if (vanished) await plineWithContinuation(`Satisfied, ${name} suddenly disappears!`);
    } else if (wasAngry) {
        await plineWithContinuation(`${shopkeeperName(monster, { state, capitalized: true })} calms down.`);
    }
    await makeShoppersHappy({ state, silentKops });
}

// C shk.c:make_happy_shoppers()/kops_gone(), mon.c:pacify_guards().
export async function makeShoppersHappy(
    { state = game, silentKops = false }: { state?: GameState; silentKops?: boolean } = {},
): Promise<void> {
    requireShopGame(state);
    if (state.level.monsters.some(monster => monster.isshk && !monster.dead
        && monster.mhp > 0 && !monster.mpeaceful)) return;
    const kopSymbol = MONSTER_SYMBOL[MONSTER_NAME.indexOf('Keystone Kop')];
    let visibleKops = 0;
    for (const monster of [...state.level.monsters].reverse()) {
        if (monster.dead || monster.mhp <= 0 || MONSTER_SYMBOL[monster.mnum] !== kopSymbol) continue;
        if (canSpotMonster(monster)) visibleKops++;
        await removeMonsterFromGame(monster);
    }
    if (visibleKops && !silentKops) {
        await plineWithContinuation(`The Kop${visibleKops === 1 ? '' : 's'} (disappointed) vanish${visibleKops === 1 ? 'es' : ''} into thin air.`);
    }
    for (const monster of state.level.monsters) {
        if (['watchman', 'watch captain'].includes(MONSTER_NAME[monster.mnum] ?? '')) monster.mpeaceful = 1;
    }
}

function clearNoChargeObject(
    keeper: Shopkeeper | null, object: GameObject, state: GameState,
): void {
    for (const content of object.contents || [])
        clearNoChargeObject(keeper, content, state);
    if (!object.no_charge) return;

    const location = ['floor', 'contained', 'buried'].includes(object.where)
        ? getObjectLocation(object, state, { contained: true, buried: true }) : null;
    const x = location?.x, y = location?.y;
    const roomno = location && state.level
        ? state.level.at(location.x, location.y)?.roomno ?? 0 : 0;
    const room = roomForRoomno(state.level, roomno);
    const resident = room?.resident;
    // Clear unless the item sits in a different tended shop.
    if (!keeper || x == null || y == null || !isok(x, y) || roomno < ROOMOFFSET
        || (room?.rtype ?? 0) < SHOPBASE || !resident || resident === keeper)
        object.no_charge = false;
}

// C shk.c hot_pursuit(): the shared anger transaction for unpaid debts.
export function hotPursuitShopkeeper(
    monster: Monster | null | undefined, state: GameState = game,
): void {
    if (!monster?.isshk) return;
    requireShopGame(state);
    if (!hasShopkeeperData(monster))
        throw new Error('Shopkeeper pursuit requires its shop records.');
    rileShopkeeper(monster);
    monster.eshk.customer = state.plname || 'player';
    monster.eshk.following = 1;

    // Shopkeeper networking: clear no_charge on every floor object of the
    // level, plus pet-carried objects except rival-shop merchandise.
    for (const column of state.level?.objects || []) {
        for (const pile of column || []) {
            for (const object of pile || [])
                clearNoChargeObject(null, object, state);
        }
    }
    for (const pet of state.level?.monsters || []) {
        if (!pet.mtame) continue;
        for (const object of pet.minvent || [])
            clearNoChargeObject(monster, object, state);
    }
}


// C shk.c addupbill(): the total of every open bill entry.
export function addUpBill(keeper: Shopkeeper): number {
    let total = 0;
    for (const entry of keeper.eshk.bill || [])
        total += (entry.price ?? 0) * (entry.bquan ?? 1);
    return total;
}

function onBillOf(object: GameObject, keeper: Shopkeeper | null): boolean {
    return !!keeper && (keeper.eshk.bill || []).some(
        entry => entry.bo_id === object.o_id);
}

// C shk.c clear_unpaid_obj().
function clearUnpaidObject(keeper: Shopkeeper | null, object: GameObject): void {
    for (const content of object.contents || [])
        clearUnpaidObject(keeper, content);
    if (onBillOf(object, keeper)) object.unpaid = false;
}

// C shk.c setpaid(): either you paid or left the shop or the shopkeeper
// died.  All pending transactions are settled.
export function setPaidShopkeeper(keeper: Shopkeeper | null, state: GameState = game): void {
    requireLiveGame(state);
    for (const object of state.inventory || [])
        clearUnpaidObject(keeper, object);
    for (const column of state.level?.objects || []) {
        for (const pile of column || []) {
            for (const object of pile || [])
                clearUnpaidObject(keeper, object);
        }
    }
    for (const object of state.level?.buriedObjects || [])
        clearUnpaidObject(keeper, object);
    // C gt.thrownobj.
    if (state._thrownObject) clearUnpaidObject(keeper, state._thrownObject);
    if (state._kickedObject) clearUnpaidObject(keeper, state._kickedObject);
    for (const monster of state.level?.monsters || []) {
        for (const object of monster.minvent || [])
            clearUnpaidObject(keeper, object);
    }
    // C gm.migrating_mons.
    for (const monster of state._migratingMonsters || []) {
        for (const object of monster.minvent || [])
            clearUnpaidObject(keeper, object);
    }

    // Clear no_charge for everything in this keeper's shop.
    for (const column of state.level?.objects || []) {
        for (const pile of column || []) {
            for (const object of pile || [])
                clearNoChargeObject(keeper, object, state);
        }
    }

    for (const object of state.level?.buriedObjects || [])
        clearNoChargeObject(keeper, object, state);

    // C gb.billobjs is global, even when only one keeper's debt is settled.
    // Raw deallocation must not retain these identities on the bill again.
    for (;;) {
        const object = state.billObjects?.[0];
        if (!object) break;
        unlinkObject(object, state);
        deallocateObject(object, state);
    }
    if (keeper) {
        keeper.eshk.bill = [];
        keeper.eshk.billct = 0;
        keeper.eshk.credit = 0;
        keeper.eshk.debit = 0;
        keeper.eshk.loan = 0;
    }
}

// C shk.c make_angry_shk().  Used when the keeper is teleported or falls
// out of the shop, or when damage happens without the hero on a costly
// spot.  ox/oy are only for a caller's message, not needed here.
export async function makeAngryShopkeeper(keeper: Shopkeeper, state: GameState = game): Promise<void> {
    requireShopGame(state);
    const eshk = keeper.eshk;

    // All pending shop transactions are now "past due".
    if (eshk.billct || (eshk.bill?.length ?? 0) || eshk.debit
        || eshk.loan || eshk.credit) {
        eshk.robbed = Math.max(0,
            (eshk.robbed ?? 0) + addUpBill(keeper)
            + (eshk.debit ?? 0) + (eshk.loan ?? 0) - (eshk.credit ?? 0));
        // billct, debit, loan, and credit are cleared by setpaid().
        setPaidShopkeeper(keeper, state);
    }

    await plineWithContinuation(`${shopkeeperName(keeper, { state, capitalized: true })} ${
        keeper.mpeaceful ? 'gets angry' : 'is furious'}!`);
    hotPursuitShopkeeper(keeper, state);
}

// C shk.c home_shk(): return the keeper to the home spot.
export async function homeShopkeeper(monster: Shopkeeper, state: ShopGameState): Promise<void> {
    const { x, y } = monster.eshk.shk;
    await mnearto(monster, x, y, state, { moveOther: true });
    if (state.level.flags) state.level.flags.has_shop = true;
    await afterShopkeeperMove(monster, state);
}

// C shk.c check_credit(): consume shop credit before the hero's purse.
async function checkCredit(amount: number, monster: Shopkeeper): Promise<number> {
    const credit = monster.eshk.credit ?? 0;
    if (credit === 0) return amount;
    if (credit >= amount) {
        await pline('The price is deducted from your credit.');
        monster.eshk.credit = credit - amount;
        return 0;
    }
    await pline('The price is partially covered by your credit.');
    monster.eshk.credit = 0;
    return amount - credit;
}

// C shk.c money2mon(): transfer gold from the hero to the monster.
export async function moneyToMonster(monster: Monster, amount: number, state: GameState = game): Promise<number> {
    const gold = heroGoldObject(state);
    if (amount <= 0) {
        await impossible(`${amount ? 'negative' : 'zero'} payment in money2mon!`, { state });
        return 0;
    }
    if (!gold || heroGoldAmount(state) < amount) {
        await impossible(`Paying without ${gold ? 'enough' : ''} gold?`, { state });
        return 0;
    }
    if (heroGoldAmount(state) === amount && gold.owornmask) await removeWornHeroItem(gold, state);
    const payment = detachHeroGold(state, amount);
    if (!payment) throw new Error('Shop payment lost its carried gold.');
    await linkObjectToMonsterInventory(monster, payment, { state });
    state._capacityDirty = true;
    state.context.botl = true;
    return amount;
}

// ------------------------------------------------------------- add_damage()

// C shk.c add_damage().  Cost is charged later by payForShopDamage(); the
// record itself schedules the keeper's repair.
export function addShopDamage(
    x: number, y: number, cost: number, state: GameState = game,
): void {
    const location = state.level?.at?.(x, y);
    if (!location) return;
    requireShopGame(state);

    if (IS_DOOR(location.typ)) {
        // Only a real shop entrance is worth repairing.
        let entrance = false;
        for (const roomno of shopRoomnosAt(state, x, y)) {
            const keeper = shopKeeper(state, roomno);
            if (keeper && x === keeper.eshk.shd?.x
                && y === keeper.eshk.shd?.y) {
                entrance = true;
                break;
            }
        }
        if (!entrance) return;
    }

    const records = damageRecords(state);
    const existing = records.find(record =>
        record.place.x === x && record.place.y === y);
    if (existing) {
        existing.cost += cost;
        existing.when = state.moves ?? 0;  // needed by payForShopDamage()
        return;
    }
    records.unshift({
        when: state.moves ?? 0,
        place: { x, y },
        cost,
        typ: location.typ,
        flags: location.flags ?? 0,
    });
    // If the hero saw the damage, post-repair walls display as walls.
    if (cansee(x, y)) location.seenv = SVALL;
}

// -------------------------------------------------------- pay_for_damage()

// C shk.c getcad(): the scolding that precedes hot pursuit.
async function getcad(
    keeper: Shopkeeper, dmgstr: string, x: number, y: number,
    { uinshp, animal, pursue }: { uinshp: boolean; animal: boolean; pursue: boolean },
    state: ShopGameState,
) {
    const dugwall = dmgstr === 'dig into' || dmgstr === 'damage';
    if (muteShopkeeper(keeper)) {
        if (animal && !monsterHelpless(keeper))
            await publishMonsterYelp(keeper);
    } else if (pursue || uinshp || !umDist(state, x, y, 1)) {
        if (!heroIsDeafNow(state)) {
            await verbalize(
                `How dare you ${dmgstr} my ${dugwall ? 'shop' : 'door'}?`);
        } else {
            await pline(`${shopkeeperName(keeper, { state, capitalized: true })} is ${ANGRY_TEXTS[rn2(3)]
            } that you decided to ${dmgstr} ${monsterPossessive(keeper, { state, noIt: true })
            } ${dugwall ? 'shop' : 'door'}!`);
        }
    } else if (!heroIsDeafNow(state)) {
        await pline(`${shopkeeperName(keeper, { state, capitalized: true })} shouts:`);
        await verbalize(
            `Who dared ${dmgstr} my ${dugwall ? 'shop' : 'door'}?`);
    } else {
        await pline(`${shopkeeperName(keeper, { state, capitalized: true })} is ${ANGRY_TEXTS[rn2(3)]
        } that someone decided to ${dmgstr} ${monsterPossessive(keeper, { state, noIt: true })
        } ${dugwall ? 'shop' : 'door'}!`);
    }
    hotPursuitShopkeeper(keeper, state);
}

// C shk.c pay_for_damage().  verb is the C dmgstr ("damage", "break",
// "ruin", "dig into", "destroy", "burn away").
export async function payForShopDamage(
    verb: string,
    { cantMollify = false, state = game }: { cantMollify?: boolean; state?: GameState } = {},
) {
    requireShopGame(state);
    let keeper: Shopkeeper | null = null;
    let appearHere: ShopDamage | null = null;
    let costOfDamage = 0;
    let nearestShk = Infinity;
    let nearestDamage = Infinity;
    let picks = 0;

    for (const record of damageRecords(state)) {
        if (record.when !== (state.moves ?? 0) || !record.cost) continue;
        costOfDamage += record.cost;
        for (const roomno of shopRoomnosAt(
            state, record.place.x, record.place.y,
        )) {
            const candidate = shopKeeper(state, roomno);
            if (!candidate) continue;
            if (candidate === keeper) {
                const damageDistance = distu(
                    state, record.place.x, record.place.y);
                if (damageDistance < nearestDamage) {
                    nearestDamage = damageDistance;
                    appearHere = record;
                }
                continue;
            }
            if (!shopkeeperInOwnShop(candidate, state)) continue;
            const shkDistance = dist2(
                candidate.mx, candidate.my, state.u.ux, state.u.uy);
            if (shkDistance > nearestShk) continue;
            if (shkDistance === nearestShk && picks) {
                if (rn2(++picks)) continue;
            } else {
                picks = 1;
            }
            keeper = candidate;
            nearestShk = shkDistance;
            appearHere = record;
            nearestDamage = distu(state, record.place.x, record.place.y);
        }
    }

    if (!costOfDamage || !keeper || !appearHere) return;

    const animal = monsterSound(keeper) <= MS_ANIMAL;
    let pursue = false;
    const x = appearHere.place.x;
    const y = appearHere.place.y;

    // Not the best introduction to the keeper...
    keeper.eshk.customer = state.plname || 'player';

    // If the keeper is already on the war path, be sure it's all out.
    if (!keeper.mpeaceful || keeper.eshk.following) {
        hotPursuitShopkeeper(keeper, state);
        return;
    }

    // If the keeper is not in any shop...
    if (shopRoomnosAt(state, keeper.mx, keeper.my).length === 0) {
        if (!cansee(keeper.mx, keeper.my)) return;
        pursue = true;
        await getcad(keeper, verb, x, y, { uinshp: false, animal, pursue },
            state);
        return;
    }

    const uinshp = shopRoomnosAt(state, state.u.ux, state.u.uy).length > 0;
    if (uinshp) {
        if (umDist(state, keeper.mx, keeper.my, 1)
            && !umDist(state, keeper.mx, keeper.my, 3)) {
            await pline(`${shopkeeperName(keeper, { state, capitalized: true })} leaps towards you!`);
            await moveMonsterNextToHero(keeper, state, { flags: RLOC_NOMSG });
        }
        pursue = umDist(state, keeper.mx, keeper.my, 1);
        if (pursue) {
            await getcad(keeper, verb, x, y, { uinshp, animal, pursue },
                state);
            return;
        }
    } else {
        // Make the keeper show up at the damaged spot.  A monster in the
        // way gets an angry shove from a speaking keeper.
        const blocker = monsterAt(state, x, y);
        if (blocker) {
            if (!animal) {
                if (!heroIsDeafNow(state)
                    && !muteShopkeeper(keeper)) {
                    await pline('You hear an angry voice:');
                    await verbalize('Out of my way, scum!');
                }
                await flush_screen(1);
            } else {
                await publishMonsterGrowl(keeper);
            }
        }
        await mnearto(keeper, x, y, state, { moveOther: true, flags: RLOC_MSG });
    }

    if ((umDist(state, x, y, 1) && !uinshp) || cantMollify
        || heroGoldAmount(state) + (keeper.eshk.credit ?? 0) < costOfDamage
        || rn2(50) === 0) {
        await getcad(keeper, verb, x, y, { uinshp, animal, pursue }, state);
        return;
    }

    if (heroIsInvisible(state))
        await pline(`Your invisibility does not fool ${shopkeeperName(keeper, { state })}!`);

    const question = `${
        animal ? '' : shopkeeperCustomerInsult(state, true)
    }You did ${costOfDamage} ${currency(costOfDamage, { state })
    } worth of damage!${animal ? '' : '"'}  Pay?`;
    const answer = await promptYesNo(question);
    if (answer !== 'n') {
        const wasSeen = canSeeMonster(keeper);
        const wasOutside = !shopkeeperInOwnShop(keeper, state);
        const sx = keeper.mx;
        const sy = keeper.my;

        costOfDamage = await checkCredit(costOfDamage, keeper);
        if (costOfDamage > 0) await moneyToMonster(keeper, costOfDamage, state);
        await pline(`Mollified, ${shopkeeperName(keeper, { state })} accepts your restitution.`);
        // Move the keeper back to the home loc.
        await homeShopkeeper(keeper, state);
        pacifyShopkeeper(keeper, false);
        if (keeper.mx !== sx || keeper.my !== sy) {
            const isSeen = canSeeMonster(keeper);
            if (wasOutside && canSpotMonster(keeper)) {
                await pline(
                    `${shopkeeperName(keeper, { state, capitalized: true })} returns to ${monsterPossessive(keeper, { state, noIt: true })} shop.`);
            } else if (isSeen || wasSeen) {
                await pline(`${shopkeeperName(keeper, { state, capitalized: true })} ${!wasSeen ? 'appears'
                    : isSeen ? 'shifts location' : 'disappears'}.`);
            }
        }
    } else {
        if (!animal) {
            if (!heroIsDeafNow(state)
                && !muteShopkeeper(keeper)) {
                await verbalize("Oh, yes!  You'll pay!");
            } else {
                await pline(`${shopkeeperName(keeper, { state, capitalized: true })} lunges ${monsterPossessive(keeper, { state, noIt: true })
                } hand toward your neck!`);
            }
        } else {
            await publishMonsterGrowl(keeper);
        }
        hotPursuitShopkeeper(keeper, state);
        adjustHeroAlignment(-Math.sign(state.u.ualign?.type ?? 0), state);
    }
}

// ---------------------------------------------------------------- shopdig()

// C shk.c shopdig().  fall=0 while the hero digs the shop floor; fall=1
// when the floor opens under the hero.
export async function shopDig(fall: number | boolean, state: GameState = game): Promise<void> {
    requireShopGame(state);
    const keeper = currentShopResident(state);
    if (!keeper) return;
    if (!shopkeeperInOwnShop(keeper, state)) {
        if (state.urole?.key === 'knight') {
            await pline('You feel like a common thief.');
            adjustHeroAlignment(
                -Math.sign(state.u.ualign?.type ?? 0), state);
        }
        return;
    }

    // 0 == can't speak, 1 == makes animal noises, 2 == speaks.
    let lang = 0;
    if (!monsterHelpless(keeper) && monsterSound(keeper) > 0)
        lang = monsterSound(keeper) <= MS_ANIMAL ? 1
            : monsterSound(keeper) >= MS_HUMANOID ? 2 : 0;

    if (!fall) {
        if (lang === 2 && !heroIsDeafNow(state)
            && !muteShopkeeper(keeper)) {
            const address = state.flags?.female ? 'madam' : 'sir';
            if (state.u.utraptype === TT_PIT) {
                await verbalize(
                    `Be careful, ${address
                    }, or you might fall through the floor.`);
            } else {
                await verbalize(
                    `${address.charAt(0).toUpperCase()}${address.slice(1)
                    }, do not damage the floor here!`);
            }
        }
        if (state.urole?.key === 'knight') {
            await pline('You feel like a common thief.');
            adjustHeroAlignment(
                -Math.sign(state.u.ualign?.type ?? 0), state);
        }
        return;
    }

    if (umDist(state, keeper.mx, keeper.my, 5) || monsterHelpless(keeper))
        return;
    if (!(keeper.eshk.billct || heroCarriesBillFor(keeper)
        || keeper.eshk.debit)) return;

    let grabs = 'grabs';
    if (monsterNolimbs(keeper)) grabs = 'knocks off';

    if (!mNext2u(keeper, state)) {
        await moveMonsterNextToHero(keeper, state, { flags: RLOC_MSG });
        // For some reason the keeper can't come next to you.
        if (!mNext2u(keeper, state)) {
            if (lang === 2)
                await pline(`${shopkeeperName(keeper, { state, capitalized: true })} curses you in anger and frustration!`);
            else if (lang === 1) await publishMonsterGrowl(keeper);
            rileShopkeeper(keeper);
            return;
        }
        await pline(`${shopkeeperName(keeper, { state, capitalized: true })} leaps, and ${grabs} your backpack!`);
    } else {
        await pline(`${shopkeeperName(keeper, { state, capitalized: true })} ${grabs} your backpack!`);
    }

    for (const object of [...(state.inventory || [])]) {
        if ((object.owornmask ?? 0) & ~(W_SWAPWEP | W_QUIVER)) continue;
        if (object === (state.uswapwep || state.u?.uswapwep)
            && state.u?.twoweap) continue;
        if (object.otyp === LEASH && object.leashmon) continue;
        if (state._currentWand === object) continue;
        await removeHeroEquipment(object, state);
        object.owornmask = 0;
        object.worn = false;
        unlinkObject(object, state);
        await finishInventoryRemoval(object, state);
        if (state.program_state?.gameover) return;
        removeObjectAndContentsFromBill(object, state, { resident: keeper });
        await linkObjectToMonsterInventory(keeper, object, { state });
    }
}

// ------------------------------------------------------------ repair chain

// C shk.c shk_impaired().
function shopkeeperImpaired(keeper: Shopkeeper, state: GameState): boolean {
    if (!keeper?.isshk || !keeper.eshk
        || !shopkeeperInOwnShop(keeper, state)) return true;
    return monsterHelpless(keeper) || !!keeper.eshk.following;
}

// C shk.c repairable_damage().
export function repairableShopDamage(
    record: ShopDamage | null | undefined, keeper: Shopkeeper, state: GameState = game,
): boolean {
    if (!record) return false;
    requireShopGame(state);
    if (shopkeeperImpaired(keeper, state)) return false;

    const { x, y } = record.place;

    // Too soon to fix it?
    if ((state.moves ?? 0) - record.when < REPAIR_DELAY) return false;

    // Is it a wall?  Don't fix if anyone is in the way.
    if (!IS_ROOM(record.typ)) {
        if ((state.u.ux === x && state.u.uy === y
            && !heroPassesWalls(state))
            || (x === keeper.mx && y === keeper.my)) return false;
        const resident = monsterAt(state, x, y);
        if (resident && !((MONSTER_FLAGS1[resident.mnum] ?? 0)
            & M1_WALLWALK)) return false;
    }

    // Is it a trap?  Don't fix if the hero or a monster is in it.
    const trap = trapAt(state, x, y);
    if (trap) {
        if (state.u.ux === x && state.u.uy === y) return false;
        const caught = monsterAt(state, x, y);
        if (caught?.mtrapped) return false;
    }

    // Does it belong to this keeper?
    if (!shopRoomnosAt(state, x, y).includes(keeper.eshk.shoproom))
        return false;

    return true;
}

// C shk.c find_damage().
function findDamage(keeper: Shopkeeper, state: ShopGameState): ShopDamage | null {
    if (shopkeeperImpaired(keeper, state)) return null;
    for (const record of damageRecords(state)) {
        if (repairableShopDamage(record, keeper, state)) return record;
    }
    return null;
}

// C shk.c discard_damage_struct().
function discardDamageRecord(record: ShopDamage, state: ShopGameState): void {
    const records = damageRecords(state);
    const index = records.indexOf(record);
    if (index >= 0) records.splice(index, 1);
}

// C shk.c discard_damage_owned_by().
export function discardDamageOwnedByShopkeeper(keeper: Shopkeeper, state: GameState = game): void {
    requireShopGame(state);
    const records = damageRecords(state);
    state.level.damagelist = records.filter(record =>
        !shopRoomnosAt(state, record.place.x, record.place.y)
            .includes(keeper.eshk.shoproom));
}

// C shk.c:shkgone(). This is not migration's temporary loss of residency.
export function finishShopkeeperDeparture(keeper: Shopkeeper, state: GameState = game): void {
    requireShopGame(state);
    requireLiveGame(state);
    const eshk = keeper.eshk;
    if (eshk.shoplevel.dnum !== state.u.uz.dnum
        || eshk.shoplevel.dlevel !== state.u.uz.dlevel) return;

    discardDamageOwnedByShopkeeper(keeper, state);
    const room = roomForRoomno(state.level, eshk.shoproom);
    if (!room) throw new Error(`Departing shopkeeper has no shop room ${eshk.shoproom}.`);
    room.resident = null;
    const rooms = [...state.level.rooms, ...(state.level.subrooms || [])];
    if (!rooms.some(candidate => isRoom(candidate) && candidate.rtype >= SHOPBASE))
        state.level.flags.has_shop = false;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            for (const object of state.level.objects[x]?.[y] || [])
                object.no_charge = false;
        }
    }
    if (state.u.ushops.includes(eshk.shoproom)) {
        setPaidShopkeeper(keeper, state);
        eshk.billUnavailable = false;
        state.u.ushops = state.u.ushops.filter(roomno => roomno !== eshk.shoproom);
    }
}

function removeTrap(trap: Trap, state: ShopGameState): void {
    deleteTrap(trap, state);
    if (state.u?.utrap && state.u.ux === trap.tx && state.u.uy === trap.ty) {
        state.u.utrap = 0;
        state.u.utraptype = 0;
    }
    const caught = monsterAt(state, trap.tx, trap.ty);
    if (caught?.mtrapped) caught.mtrapped = 0;
}

function trapName(trap: Trap): string {
    switch (trap.ttyp) {
    case LANDMINE: return 'land mine';
    case BEAR_TRAP: return 'bear trap';
    case PIT: return 'pit';
    case SPIKED_PIT: return 'spiked pit';
    case HOLE: return 'hole';
    default: return 'trap';
    }
}

function closedDoor(state: ShopGameState, x: number, y: number): boolean {
    const location = state.level.at(x, y);
    return location?.typ === DOOR
        && !!(location.doormask & (D_CLOSED | D_LOCKED));
}

// C lock.c picking_at(): the hero's lock-picking occupation targets this
// door square.  cmd.js installs {key: 'pick-lock', door, x, y, ...} for
// doors and the same key with a container for boxes; only the door form
// matches, exactly as C compares gx.xlock.door.
function pickingAt(state: GameState, x: number, y: number): boolean {
    const occupation = state._occupation;
    return !!occupation && occupation.key === 'pick-lock'
        && !!occupation.door
        && occupation.x === x && occupation.y === y;
}

const LITTER_UPDATE = 0x01;
const LITTER_OPEN = 0x02;
const LITTER_INSHOP = 0x04;
const horiz = (i: number): number => (i % 3) - 1;
const vert = (i: number): number => Math.trunc(i / 3) - 1;

// C shk.c litter_getpos().
function litterGetpos(
    x: number, y: number, keeper: Shopkeeper, state: ShopGameState,
): { litter: number[]; count: number } {
    const litter: number[] = new Array<number>(9).fill(0);
    let count = 0;
    const location = state.level.at(x, y);
    if (!location) throw new Error(`Shop repair square (${x}, ${y}) is outside the level.`);
    if (objectsAt(state, x, y).length > 0
        && !IS_ROOM(location.typ)) {
        for (let i = 0; i < 9; i++) {
            const ix = x + horiz(i);
            const iy = y + vert(i);
            if (i === 4 || !isok(ix, iy)
                || !ZAP_POS(state.level.at(ix, iy)?.typ ?? 0)) continue;
            litter[i] = LITTER_OPEN;
            if (insideShop(state, ix, iy) === keeper.eshk.shoproom) {
                litter[i] = (litter[i] ?? 0) | LITTER_INSHOP;
                count++;
            }
        }
    }
    return { litter, count };
}

// C shk.c litter_scatter().
async function litterScatter(
    litter: number[], x: number, y: number, keeper: Shopkeeper, state: ShopGameState,
): Promise<void> {
    // Either the ball or the chain is in the repair location: put both
    // back under the hero.
    const chain = state.uchain || state.u?.uchain;
    const ball = state.uball || state.u?.uball;
    if (heroIsPunished(state) && !state.u.uswallow
        && ((chain?.ox === x && chain?.oy === y)
            || (ball?.where === 'floor' && ball?.ox === x
                && ball?.oy === y))) {
        if (!heroIsDeafNow(state) && !muteShopkeeper(keeper))
            await verbalize('Get your junk out of my wall!');
        unplaceBallAndChain(state);
        await placeBallAndChain(state);
    }

    for (;;) {
        const object = objectsAt(state, x, y)[0];
        if (!object) break;
        // Don't mess with boulders: merge them into the wall.
        if (object.otyp === BOULDER || object.otyp === ROCK) {
            await deleteObject(object, state);
            continue;
        }

        let trylimit = 10;
        let i = rn2(9);
        // The object must move or this loop never terminates.
        do {
            i = (i + 1) % 9;
        } while (--trylimit && !((litter[i] ?? 0) & LITTER_INSHOP));
        let ix;
        let iy;
        if (((litter[i] ?? 0) & (LITTER_OPEN | LITTER_INSHOP)) !== 0) {
            ix = x + horiz(i);
            iy = y + vert(i);
        } else {
            // The keeper is never at <x,y>; repair was deferred then.
            ix = keeper.mx;
            iy = keeper.my;
        }

        if (object.unpaid) {
            // Moving fully into a shop takes the object off the bill.
            const destination = costlySpot(ix, iy, state);
            const destinationKeeper = destination?.resident ?? null;
            const onRepairingBill = (keeper.eshk.bill || []).some(
                entry => entry.bo_id === object.o_id);
            const onDestinationBill = destinationKeeper
                && destinationKeeper !== keeper
                && (destinationKeeper.eshk.bill || []).some(
                    entry => entry.bo_id === object.o_id);
            if (destination && (onRepairingBill || onDestinationBill))
                removeObjectAndContentsFromBill(object, state);
        }
        if (object.no_charge) {
            if (!costlySpot(ix, iy, state)
                && !costlyAdjacent(keeper, ix, iy, state))
                object.no_charge = false;
        }

        // C shk.c:4703-4705: repairlitter relocates with a bare remove
        // and place; the redraw is deferred to the litter newsyms pass.
        remove_object(object, state);
        await placeObject(object, ix, iy, state);
        litter[i] = (litter[i] ?? 0) | LITTER_UPDATE;
    }
}

// C shk.c litter_newsyms().
function litterNewsyms(litter: readonly number[], x: number, y: number): void {
    for (let i = 0; i < 9; i++)
        if ((litter[i] ?? 0) & LITTER_UPDATE) newsym(x + horiz(i), y + vert(i));
}

// C shk.c repair_damage().  Returns 0: postponed, 1: silent repair,
// 2: normal repair, 3: untrap.
export async function repairShopDamage(
    keeper: Shopkeeper, record: ShopDamage,
    { catchup = false, state = game }: { catchup?: boolean; state?: GameState } = {},
): Promise<0 | 1 | 2 | 3> {
    requireShopGame(state);
    if (!repairableShopDamage(record, keeper, state)) return 0;

    const { x, y } = record.place;
    const location = state.level.at(x, y);
    if (!location) throw new Error(`Shop damage square (${x}, ${y}) is outside the level.`);
    const seeit = cansee(x, y);
    let disposition: 1 | 2 | 3 = 1;

    const trap = trapAt(state, x, y);
    if (trap) {
        switch (trap.ttyp) {
        case LANDMINE:
        case BEAR_TRAP: {
            // Convert to an object the keeper pockets.
            const object = await mksobj(
                trap.ttyp === LANDMINE ? LAND_MINE : BEARTRAP, true, false);
            object.quan = object.quantity = 1;
            object.owt = objectWeight(object);
            if (!catchup) {
                if (canSeeMonster(keeper)
                    && dist2(x, y, keeper.mx, keeper.my) <= 2) {
                    const noun = trap.ttyp === LANDMINE
                        ? 'a land mine' : 'a bear trap';
                    await pline(`${shopkeeperName(keeper, { state, capitalized: true })} untraps ${noun}.`);
                } else if (trap.tseen && cansee(trap.tx, trap.ty)) {
                    await pline(`The ${trapName(trap)} vanishes.`);
                }
            }
            await linkObjectToMonsterInventory(keeper, object, { state });
            break;
        }
        case HOLE:
        case PIT:
        case SPIKED_PIT:
            if (!catchup && trap.tseen
                && cansee(trap.tx, trap.ty))
                await pline(`The ${trapName(trap)} is filled in.`);
            break;
        default:
            if (!catchup && trap.tseen
                && cansee(trap.tx, trap.ty))
                await pline(`The ${trapName(trap)} vanishes.`);
            break;
        }
        removeTrap(trap, state);
        deleteEngravingAt(x, y, state.level);
        if (seeit) newsym(x, y);
        if (!catchup) disposition = 3;
    }

    if (IS_ROOM(record.typ)
        || (record.typ === location.typ
            && (!IS_DOOR(record.typ) || location.doormask > D_BROKEN)))
        // No terrain fix necessary (trap removal or manual repair).
        return disposition;

    const stopPicking = closedDoor(state, x, y)
        ? pickingAt(state, x, y) : false;

    // Door or wall repair: restore terrain and move items away.
    location.typ = record.typ;
    if (IS_DOOR(record.typ)) {
        location.doormask = D_CLOSED;  // arbitrary
    } else {
        // Not a door: restore the old wall flags.
        location.flags = record.flags;
    }

    const { litter, count } = litterGetpos(x, y, keeper, state);
    if (count) await litterScatter(litter, x, y, keeper, state);
    deleteEngravingAt(x, y, state.level);

    if (seeit) newsym(x, y);
    vision_note_blocker_change(x, y);

    if (catchup) return 1;  // repaired while off level: no messages

    if (seeit) {
        if (IS_WALL(record.typ)) {
            // The hero watched the repair: the wall is known.
            location.seenv = SVALL;
            await pline('Suddenly, a section of the wall closes up!');
        } else if (IS_DOOR(record.typ)) {
            await pline('Suddenly, the shop door reappears!');
        }
        newsym(x, y);
    } else if (IS_WALL(record.typ)) {
        if (insideShop(state, state.u.ux, state.u.uy)
            === keeper.eshk.shoproom) {
            await pline('You feel more claustrophobic than before.');
        } else if (!heroIsDeafNow(state) && rn2(10) === 0) {
            await pline('The dungeon acoustics noticeably change.');
        }
    }

    if (stopPicking) await stopHeroOccupation(state);

    litterNewsyms(litter, x, y);

    if (disposition < 3) disposition = 2;
    return disposition;
}

// C shk.c shk_fixes_damage(): one repair attempt during the keeper's move.
export async function shopkeeperRepairsDamage(
    keeper: Shopkeeper, state: GameState = game,
): Promise<0 | 1 | 2 | 3> {
    requireShopGame(state);
    const record = findDamage(keeper, state);
    if (!record) return 0;

    const shkCloseby = distu(state, keeper.mx, keeper.my)
        <= (BOLT_LIM / 2) * (BOLT_LIM / 2);
    if (canSpotMonster(keeper)) {
        await pline(`${shopkeeperName(keeper)} whispers ${
            shkCloseby ? 'an incantation' : 'something'}.`);
    } else if (!heroIsDeafNow(state) && shkCloseby) {
        await pline('You hear someone muttering an incantation.');
    }

    const disposition = await repairShopDamage(keeper, record, { state });
    discardDamageRecord(record, state);
    return disposition;
}

// C shk.c fix_shop_damage(): catch-up repairs when a level is revisited.
export async function fixShopDamage(state: GameState = game): Promise<void> {
    requireShopGame(state);
    const records = damageRecords(state);
    if (!records.length) return;

    for (const keeper of [...state.level.monsters || []]) {
        if (!hasShopkeeperData(keeper) || !keeper.isshk || keeper.dead
            || (keeper.mhp ?? 1) <= 0) continue;
        if (shopkeeperImpaired(keeper, state)) continue;
        for (const record of [...records]) {
            if (!records.includes(record)) continue;
            if (await repairShopDamage(
                keeper, record, { catchup: true, state })) {
                discardDamageRecord(record, state);
            }
        }
    }
}
