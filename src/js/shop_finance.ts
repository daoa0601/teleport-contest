// C shk.c:shopper_financial_report(). Robbed balances are not reported.
import { game } from './gstate.js';
import { currency } from './currency.js';
import { plineWithContinuation } from './display.js';
import { possessiveName, shopkeeperName } from './monster_name.js';
import { insideShopRoomAt, shopResident } from './shk.js';
import { addUpBill, rileShopkeeper } from './shop_damage.js';
import { hasShopkeeperData } from './shop_types.js';
import type { Shopkeeper } from './shop_types.js';
import { SHOPBASE } from './const.js';
import { SHOP_TYPES } from './shop_data.js';

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
