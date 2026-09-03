import { ROOM, ROOMOFFSET, SHOPBASE } from '../../js/const.js';
import { game } from '../../js/gstate.js';
import { addMonster } from './monsters.js';

const PM_SHOPKEEPER = 271;

export function addStaffedShop({
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
} = {}) {
    const roomIndex = game.level.rooms.length;
    const roomno = roomIndex + ROOMOFFSET;
    const room = {
        lx: left,
        hx: right,
        ly: top,
        hy: bottom,
        roomnoidx: roomIndex,
        rtype: shopType,
    };
    game.level.rooms.push(room);
    game.level.nroom = game.level.rooms.length;

    for (let x = left; x <= right; x++) {
        for (let y = top; y <= bottom; y++) {
            Object.assign(game.level.at(x, y), {
                typ: ROOM,
                roomno,
                edge: false,
            });
        }
    }

    const shopkeeper = addMonster({
        mnum: PM_SHOPKEEPER,
        x: keeperX,
        y: keeperY,
        hitPoints: 20,
        isshk: true,
        mpeaceful: 1,
        mute: false,
        eshk: {
            shoproom: roomno,
            shoptype: shopType,
            shoplevel: { ...game.u.uz },
            shk: { x: keeperX, y: keeperY },
            shd: { x: doorX, y: doorY },
            debit: 0,
            bill,
            billct: bill.length,
        },
    });
    room.resident = shopkeeper;
    return { room, roomno, shopkeeper };
}
