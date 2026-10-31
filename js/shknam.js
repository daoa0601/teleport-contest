// shknam.js — shopkeeper identity and shop stocking.
// C ref: shknam.c — good_shopdoor, nameshk, get_shop_item, shkveg and
// mkveggy_at, shkinit and stock_room. Room and shop selection live in
// mkroom.ts (mkroom.c mkshop); shopkeeper runtime behavior lives in shk.ts.
import { game, requireGameLevel } from './gstate.js';
import { rn2, rnd } from './rng.js';
import { CORR, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, DUST, HEALTHY_TIN, In_mines, IS_ROOM, MM_ESHK, PL_NSIZ, ROOM, RLOC_NOMSG, ROOMOFFSET, SDOOR, SHOPBASE, } from './const.js';
import { convertSecretDoor } from './detect.js';
import { SHOP_TYPES } from './shop_data.js';
import { specialLevelAt } from './dungeon.js';
import { roomsAt } from './room.js';
import { insideShopRoomAt } from './shk.js';
import { newsym } from './display.js';
import { makeEngravingAt } from './engrave.js';
import { makemon, mkclass } from './makemon.js';
import { depth as depth_of_level, ledgerNo } from './hacklib.js';
import { GOLD_PIECE, OBJECT_BASES, OBJECT_PROB, SPE_NOVEL, TOUCHSTONE, CORPSE, EGG, TIN, } from './object_data.js';
import { mksobj, mksobj_at, mkobj_at } from './mkobj.js';
import { objectMaterial } from './object_material.js';
import { setTinVariety } from './tin.js';
import { objectWeight } from './weight.js';
import { addObjectToMonsterInventory, linkObjectToMonsterInventory, } from './monster_inventory.js';
import { monsterAtPosition } from './monster_location.js';
import { setMonsterMalign } from './monster_alignment.js';
import { randomMonsterRelocation } from './teleport.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { FOOD_CLASS, S_MIMIC } from './mklev.js';
// shknam.c's health-food pseudo-class lives just above the real object
// classes and is resolved by shkveg(), not by mkobj().
const VEGETARIAN_CLASS = 19;
const PM_SHOPKEEPER = 271;
// Scroll constant (normally from objects.js, not in contest template)
const SCR_CHARGING = 342;
function goodShopDoor(sroom) {
    const level = requireGameLevel();
    for (let i = 0; i < sroom.doorct; i++) {
        const doorIndex = sroom.fdoor + i;
        const door = level.doors[doorIndex];
        if (!door)
            continue;
        let { x, y } = door;
        if (sroom.irregular) {
            const roomno = (sroom.roomnoidx ?? -1) + ROOMOFFSET;
            const candidates = [
                { x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 },
            ];
            const inside = candidates.find(({ x: cx, y: cy }) => {
                const loc = level.at(cx, cy);
                return loc && !loc.edge && loc.roomno === roomno;
            });
            if (!inside)
                continue;
            x = inside.x;
            y = inside.y;
        }
        else if (x === sroom.lx - 1)
            x++;
        else if (x === sroom.hx + 1)
            x--;
        else if (y === sroom.ly - 1)
            y++;
        else if (y === sroom.hy + 1)
            y--;
        else
            continue;
        return { doorIndex, door, x, y };
    }
    return null;
}
function stockRoomGoodPos(sroom, shopDoor, x, y) {
    const loc = requireGameLevel().at(x, y);
    if (!loc || !IS_ROOM(loc.typ))
        return false;
    if (sroom.irregular) {
        const roomno = (sroom.roomnoidx ?? -1) + ROOMOFFSET;
        return !loc.edge && loc.roomno === roomno
            && Math.max(Math.abs(x - shopDoor.door.x), Math.abs(y - shopDoor.door.y)) > 1;
    }
    return !((x === sroom.lx && shopDoor.door.x === x - 1)
        || (x === sroom.hx && shopDoor.door.x === x + 1)
        || (y === sroom.ly && shopDoor.door.y === y - 1)
        || (y === sroom.hy && shopDoor.door.y === y + 1));
}
// C shknam.c:nameshk(). Store the prefixed identity; presentation strips it.
function assignShopkeeperIdentity(monster, shopIndex) {
    const level = requireGameLevel();
    const shop = SHOP_TYPES[shopIndex];
    const candleShop = SHOP_TYPES[11], toolShop = SHOP_TYPES[8], generalShop = SHOP_TYPES[0];
    if (!shop || !candleShop || !toolShop || !generalShop)
        throw new Error(`Missing shop naming definition ${shopIndex}`);
    const shopkeeper = monster.eshk;
    if (!shopkeeper)
        throw new Error('Shopkeeper identity requires the shop extension.');
    let names = shop.names;
    let selected;
    if (names === candleShop.names && In_mines(game.u.uz)
        && specialLevelAt()?.flags.town) {
        selected = '+Izchak';
        monster.female = false;
    }
    else {
        const birthSeed = Math.trunc((game.ubirthday ?? 0) / 257) | 0;
        let wanted = (monster.m_id | 0) + ledgerNo(game.u.uz)
            + (birthSeed % 13) - (birthSeed % 5);
        if (wanted < 0)
            wanted += 18;
        monster.female = !!(wanted & 1);
        wanted %= names.length;
        for (let attempt = 0; attempt < 50; attempt++) {
            if (names === toolShop.names) {
                selected = names[rn2(names.length)];
                monster.female = false;
            }
            else if (wanted < names.length) {
                selected = names[wanted];
            }
            else {
                const index = rn2(names.length);
                if (index)
                    selected = names[index - 1];
                else if (names !== generalShop.names) {
                    names = generalShop.names;
                    continue;
                }
                else {
                    selected = monster.female ? '-Lucrezia' : '+Dirk';
                }
            }
            if (selected === undefined)
                throw new Error('Shopkeeper name selection is out of range.');
            if (selected[0] === '_' || selected[0] === '-')
                monster.female = true;
            else if (selected[0] === '|' || selected[0] === '+')
                monster.female = false;
            const taken = level.monsters.some(other => other !== monster
                && other.mhp > 0 && other.isshk && other.eshk?.shknam === selected);
            if (!taken)
                break;
            wanted = names.length;
        }
    }
    if (selected === undefined)
        throw new Error('Shopkeeper name selection did not choose a name.');
    shopkeeper.shknam = selected.slice(0, PL_NSIZ - 1);
}
export function getShopItem(shopIndex) {
    const table = SHOP_TYPES[shopIndex]?.items;
    if (!table)
        throw new Error(`Missing shop stock definition ${shopIndex}`);
    let roll = rnd(100);
    for (const [probability, itemType] of table) {
        if (probability === undefined || itemType === undefined)
            throw new Error(`Incomplete shop stock entry for shop ${shopIndex}`);
        roll -= probability;
        if (roll <= 0)
            return itemType;
    }
    const lastType = table.at(-1)?.[1];
    if (lastType === undefined)
        throw new Error(`Shop ${shopIndex} has no stock entries.`);
    return lastType;
}
// C ref: shknam.c shkveg()/mkveggy_at().  Corpses and tins use a vegetarian
// lichen stand-in while selecting an object type; actual tin contents are
// repaired after normal mksobj initialization.
async function mkveggy_at(x, y) {
    const eligible = [];
    let totalProbability = 0;
    const first = OBJECT_BASES[FOOD_CLASS];
    const afterFood = OBJECT_BASES[FOOD_CLASS + 1];
    if (first === undefined || afterFood === undefined)
        throw new Error('Food class boundaries are missing.');
    const last = afterFood - 1;
    for (let otyp = first; otyp <= last; otyp++) {
        if (objectMaterial(otyp) !== 3 // VEGGY
            && otyp !== EGG && otyp !== TIN && otyp !== CORPSE)
            continue;
        eligible.push(otyp);
        const probability = OBJECT_PROB[otyp];
        if (probability === undefined)
            throw new Error(`Missing food probability for object ${otyp}`);
        totalProbability += probability;
    }
    let choice = rnd(totalProbability);
    let selected = eligible[0];
    for (const otyp of eligible) {
        selected = otyp;
        const probability = OBJECT_PROB[otyp];
        if (probability === undefined)
            throw new Error(`Missing food probability for object ${otyp}`);
        choice -= probability;
        if (choice <= 0)
            break;
    }
    if (selected === undefined)
        throw new Error('Vegetarian shop selection has no eligible food.');
    const object = await mksobj_at(selected, x, y, true, true);
    if (object?.otyp === TIN)
        setTinVariety(object, HEALTHY_TIN);
    return object;
}
export async function stockShopRoom(sroom) {
    const level = requireGameLevel();
    const shopLevel = game.u.uz;
    if (!shopLevel)
        throw new Error('Shop creation requires the current dungeon location.');
    const shopDoor = goodShopDoor(sroom);
    if (!shopDoor)
        return;
    const shopIndex = sroom.rtype - SHOPBASE;
    // shknam.c:shkinit() relocates an existing occupant before creating
    // the resident; it does not abandon this shop when its doorway is busy.
    const occupant = monsterAtPosition(level, shopDoor.x, shopDoor.y);
    if (occupant)
        await randomMonsterRelocation(occupant, { flags: RLOC_NOMSG });
    const shopkeeper = await makemon(PM_SHOPKEEPER, shopDoor.x, shopDoor.y, MM_ESHK);
    if (!shopkeeper)
        return;
    const shop = shopkeeper.eshk;
    if (!shop)
        throw new Error('Shopkeeper creation requires its shop extension.');
    // C isshk() is resident-extension identity, not species identity.  A
    // Wizard-forced out-of-context shopkeeper has no eshk and remains an
    // ordinary humanoid observer; shkinit() establishes both together here.
    shopkeeper.isshk = 1;
    shopkeeper.mpeaceful = 1;
    setMonsterMalign(shopkeeper);
    shopkeeper.msleeping = 0;
    shopkeeper.mtrapseen = -1;
    shop.shoproom = (sroom.roomnoidx ?? -1) + ROOMOFFSET;
    sroom.resident = shopkeeper;
    shop.shoptype = sroom.rtype;
    shop.shoplevel = { ...shopLevel };
    shop.shd = { ...shopDoor.door };
    shop.shk = { x: shopDoor.x, y: shopDoor.y };
    // C shknam.c:shkinit()/makemon.c:mkmonmoney(). Initial capital is
    // an ordinary coin stack in the keeper's inventory.
    const capital = 1000 + 30 * rnd(100);
    const coins = await mksobj(GOLD_PIECE, false, false);
    coins.quan = coins.quantity = capital;
    coins.owt = objectWeight(coins);
    await linkObjectToMonsterInventory(shopkeeper, coins, { atFront: true });
    if (shopIndex === 6)
        await addObjectToMonsterInventory(shopkeeper, await mksobj(TOUCHSTONE, true, false), game, { atFront: true });
    if (shopIndex === 8 || shopIndex === 7
        || (shopIndex === 6 && rn2(2))
        || (shopIndex === 0 && rn2(5)))
        await addObjectToMonsterInventory(shopkeeper, await mksobj(SCR_CHARGING, true, false), game, { atFront: true });
    assignShopkeeperIdentity(shopkeeper, shopIndex);
    const entrance = level.doors[sroom.fdoor];
    if (!entrance)
        throw new Error('A stocked shop has no entrance door.');
    const doorLoc = level.requireAt(entrance.x, entrance.y);
    if (doorLoc.doormask === D_NODOOR) {
        doorLoc.doormask = D_ISOPEN;
        await newsym(entrance.x, entrance.y);
    }
    if (doorLoc.typ === SDOOR) {
        convertSecretDoor(doorLoc);
        await newsym(entrance.x, entrance.y);
    }
    if (doorLoc.doormask & D_TRAPPED)
        doorLoc.doormask = D_LOCKED;
    if (doorLoc.doormask === D_LOCKED) {
        let x = entrance.x, y = entrance.y;
        if (insideShopRoomAt(game, x + 1, y))
            x--;
        else if (insideShopRoomAt(game, x - 1, y))
            x++;
        if (insideShopRoomAt(game, entrance.x, y + 1))
            y--;
        else if (insideShopRoomAt(game, entrance.x, y - 1))
            y++;
        makeEngravingAt(x, y, 'Closed for inventory', null, 0, DUST);
        const noticeLocation = level.requireAt(x, y);
        if (noticeLocation.typ !== CORR && noticeLocation.typ !== ROOM)
            noticeLocation.typ = specialLevelAt() || roomsAt(level, x, y, 0).length ? ROOM : CORR;
    }
    const stockPositions = [];
    for (let x = sroom.lx; x <= sroom.hx; x++)
        for (let y = sroom.ly; y <= sroom.hy; y++)
            if (stockRoomGoodPos(sroom, shopDoor, x, y))
                stockPositions.push({ x, y });
    // Tribute support begins enabled, but stock_room() stops selecting a
    // special square after the first bookstore successfully places a novel.
    // Non-book shops can consume this draw without satisfying bookstock.
    const specialSpot = !game._tributeBookstock && stockPositions.length
        ? rnd(stockPositions.length) : 0;
    let stockCount = 0;
    for (const pos of stockPositions) {
        stockCount++;
        // Tribute stocking is the first per-square branch in stock_room().
        // A selected book-shop square constructs its novel before the mimic
        // and ordinary shop-item reservoirs which begin with the next square.
        if (stockCount === specialSpot
            && (shopIndex === 2 || shopIndex === 9)) {
            await mksobj_at(SPE_NOVEL, pos.x, pos.y, false, false);
            game._tributeBookstock = true;
            continue;
        }
        if (rn2(100) < depth_of_level(game.u?.uz)
            && !monsterAtPosition(level, pos.x, pos.y)) {
            const mimic = mkclass(S_MIMIC, 0);
            if (mimic != null && await makemon(mimic, pos.x, pos.y, 0)) {
                continue;
            }
        }
        const atype = getShopItem(shopIndex);
        if (atype === VEGETARIAN_CLASS) {
            await mkveggy_at(pos.x, pos.y);
        }
        else if (atype < 0) {
            await mksobj_at(-atype, pos.x, pos.y, true, true);
        }
        else {
            await mkobj_at(atype, pos.x, pos.y, true);
        }
    }
    // shknam.c:stock_room() makes Orcus's two shops into a ghost town after
    // stocking.  mongone() first probes every carried item for protected
    // objects, then discards the inventory and detaches the shopkeeper.
    if (game._activeSpecialLevel?.prototype === 'orcus') {
        await removeMonsterFromGame(shopkeeper);
    }
    level.flags.has_shop = true;
}
//# sourceMappingURL=shknam.js.map