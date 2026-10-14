// C shk.c:block_door()/block_entry(): diagonal passage at shop entrances.
import { DOOR, D_BROKEN, SHOPBASE } from './const.js';
import { game } from './gstate.js';
import { monsterIsHelpless } from './monster_sleep.js';
import { PICK_AXE, DWARVISH_MATTOCK } from './object_data.js';
import { propertyIsActive } from './properties.js';
import { roomForIndex, roomsAt } from './room.js';
import { shopResident, shopkeeperInOwnShop } from './shk.js';
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
//# sourceMappingURL=shop_blocking.js.map