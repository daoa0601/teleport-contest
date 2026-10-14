// C shk.c:money2u() and hack.c:money_cnt(). Coins retain ordinary ownership.
import { game } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { impossible } from './diagnostics.js';
import { monsterName } from './monster_name.js';
import { splitObjectStack } from './object_stack.js';
import { unlinkObject } from './object_location.js';
import { mergable } from './object_merge.js';
import { addInventoryItem } from './u_init.js';
import { dropObjectAtHero } from './object_drop.js';
const COIN_CLASS = 12;
export function monsterGoldAmount(monster) {
    return monster.minvent?.find(object => object.oclass === COIN_CLASS)?.quan ?? 0;
}
export async function moneyToHero(monster, amount, state = game) {
    if (amount <= 0) {
        await impossible(`${amount ? 'negative' : 'zero'} payment in money2u!`, { state });
        return;
    }
    const coins = monster.minvent?.find(object => object.oclass === COIN_CLASS);
    if (!coins || coins.quan < amount) {
        await impossible(`${monsterName(monster, { state, article: 'a' })} paying without ${coins ? 'enough' : ''} gold?`, { state });
        return;
    }
    const payment = coins.quan > amount ? splitObjectStack(coins, amount, state) : coins;
    if (!payment)
        throw new Error('Shopkeeper could not split the payment coins.');
    unlinkObject(payment, state);
    const canMerge = state.inventory.some(object => mergable(object, payment, state));
    const slots = state.inventory.filter(object => object.invlet !== '$').length;
    if (!canMerge && slots >= 52) {
        await plineWithContinuation('You have no room for the gold!');
        await dropObjectAtHero(payment, { state });
    }
    else {
        await addInventoryItem(payment);
        state.context.botl = true;
    }
}
//# sourceMappingURL=shop_money.js.map