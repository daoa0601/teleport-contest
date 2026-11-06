// Port only: narrow monsters with a shopkeeper extension.
export function hasShopkeeperData(monster) {
    return !!monster?.eshk;
}
// Port only: narrow shopkeepers with a bill array.
export function hasShopBill(monster) {
    return !!monster?.eshk?.bill;
}
// Port only: validate the state needed for shop interaction.
export function requireShopGame(state) {
    const hero = state.u;
    if (!state.level || !hero.uz || !hero.urooms || !hero.urooms0
        || !hero.uentered || !hero.ushops || !hero.ushops0
        || !hero.ushops_entered || !hero.ushops_left)
        throw new Error('Shop interaction requires a level and hero room membership');
}
//# sourceMappingURL=shop_types.js.map