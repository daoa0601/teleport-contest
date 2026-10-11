import { ROOM, ROOMOFFSET, SHOPBASE } from '../../js/const.js';
import { game, requirePlayingGame } from '../../js/gstate.js';
import { cls } from '../../js/display.js';
import { pushKey } from '../../js/input.js';
import { roomsAt } from '../../js/room.js';
import { checkSpecialRoom } from '../../js/shk.js';
import { createMonsterAt } from './monsters.js';
const PM_SHOPKEEPER = 271;
export async function createStaffedShop({ left = 8, right = 14, top = 8, bottom = 12, keeperX = 11, keeperY = 10, doorX = left, doorY = keeperY, shopType = SHOPBASE, bill = [], } = {}) {
    requirePlayingGame(game);
    const roomIndex = game.level.rooms.length;
    const roomno = roomIndex + ROOMOFFSET;
    const room = {
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
            if (!location)
                throw new RangeError(`Shop square ${x},${y} is outside the map`);
            location.typ = ROOM;
            location.roomno = roomno;
            location.edge = false;
        }
    }
    const eshk = {
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
        if (game._pending_message)
            pushKey(' ');
        await cls();
    }
    return { room, roomno, shopkeeper };
}
function requireStaffedShopkeeper(monster) {
    const shop = monster.eshk;
    if (!shop || !shop.bill || shop.billct === undefined || shop.debit === undefined)
        throw new Error('A staffed shop needs a resident with initialized billing.');
}
//# sourceMappingURL=shop.js.map