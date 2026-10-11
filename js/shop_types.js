export function hasShopkeeperData(monster) {
    return !!monster?.eshk;
}
export function hasShopBill(monster) {
    return !!monster?.eshk?.bill;
}
export function requireShopGame(state) {
    const hero = state.u;
    if (!state.level || !hero.uz || !hero.urooms || !hero.urooms0
        || !hero.uentered || !hero.ushops || !hero.ushops0
        || !hero.ushops_entered || !hero.ushops_left)
        throw new Error('Shop interaction requires a level and hero room membership');
}
//# sourceMappingURL=shop_types.js.map