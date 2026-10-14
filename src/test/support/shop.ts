import type { Monster } from '../../js/monster_types.js';
import { GOLD_PIECE } from '../../js/object_data.js';
import { deleteObject } from '../../js/object_delete.js';
import { addCreatedObjectToMonsterInventory } from '../../js/monster_inventory.js';
import { knownObject } from './game-objects.js';
import type { Room } from '../../js/map_types.js';
import type { ShopBillEntry, ShopkeeperData, MonsterBirthState } from '../../js/monster_types.js';
import { ROOM, ROOMOFFSET, SHOPBASE } from '../../js/const.js';
import { game, requirePlayingGame } from '../../js/gstate.js';
import { cls } from '../../js/display.js';
import { pushKey } from '../../js/input.js';
import { roomsAt } from '../../js/room.js';
import { checkSpecialRoom } from '../../js/shk.js';
import { createMonsterAt } from './monsters.js';

export interface StaffedShopOptions {
    left?: number; right?: number; top?: number; bottom?: number;
    keeperX?: number; keeperY?: number; doorX?: number; doorY?: number;
    shopType?: number; bill?: ShopBillEntry[];
}


const PM_SHOPKEEPER = 271;

export async function createStaffedShop({
    left = 8,
    right = 14,
    top = 8,
    bottom = 12,
    keeperX = 11,
    keeperY = 10,
    doorX = left,
    doorY = keeperY,
    shopType = SHOPBASE,
    bill = [],
}: StaffedShopOptions = {}) {
    requirePlayingGame(game);
    const roomIndex = game.level.rooms.length;
    const roomno = roomIndex + ROOMOFFSET;
    const room: Room = {
        lx: left,
        hx: right,
        ly: top,
        hy: bottom,
        roomnoidx: roomIndex,
        rtype: shopType,
        rlit: 1, doorct: 0, fdoor: 0, irregular: false, needjoining: false,
        nsubrooms: 0, sbrooms: [], needfill: 0,
    };
    game.level.rooms.push(room);
    game.level.nroom = game.level.rooms.length;
    game.level.flags.has_shop = true;

    for (let x = left; x <= right; x++) {
        for (let y = top; y <= bottom; y++) {
            const location = game.level.at(x, y);
            if (!location) throw new RangeError(`Shop square ${x},${y} is outside the map`);
            location.typ = ROOM;
            location.roomno = roomno;
            location.edge = false;
        }
    }

    const eshk: ShopkeeperData & { bill: ShopBillEntry[]; billct: number; debit: number } = {
        shoproom: roomno, shoptype: shopType,
        shoplevel: { ...game.u.uz },
        shk: { x: keeperX, y: keeperY },
        shd: { x: doorX, y: doorY },
        debit: 0, bill, billct: bill.length,
    };
    const shopkeeper = await createMonsterAt(PM_SHOPKEEPER, keeperX, keeperY);
    shopkeeper.isshk = true;
    shopkeeper.mpeaceful = 1;
    shopkeeper.eshk = eshk;
    requireStaffedShopkeeper(shopkeeper);
    room.resident = shopkeeper;
    if (roomsAt(game.level, game.u.ux, game.u.uy, SHOPBASE).includes(roomno)) {
        await checkSpecialRoom();
        // Complete the real greeting pager before the test starts inside.
        if (game._pending_message) pushKey(' ');
        await cls();
    }
    return { room, roomno, shopkeeper };
}

function requireStaffedShopkeeper(monster: MonsterBirthState): asserts monster is MonsterBirthState & {
    eshk: ShopkeeperData & { bill: ShopBillEntry[]; billct: number; debit: number };
} {
    const shop = monster.eshk;
    if (!shop || !shop.bill || shop.billct === undefined || shop.debit === undefined)
        throw new Error('A staffed shop needs a resident with initialized billing.');
}

export async function setShopkeeperGold(monster: Monster, amount: number): Promise<void> {
    for (const object of [...monster.minvent ?? []])
        if (object.otyp === GOLD_PIECE) await deleteObject(object);
    if (amount)
        await addCreatedObjectToMonsterInventory(monster, await knownObject(GOLD_PIECE, { quan: amount, bknown: false }));
}
