import { game } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { monsterName, monsterObjectPronoun, monsterSubjectPronoun, shopkeeperName } from './monster_name.js';
import { heroArmName } from './body_parts.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { currency } from './currency.js';
import { inTown } from './room.js';
import { shopGreeting } from './shk.js';
import { shopkeeperIsMuted } from './shop_loss.js';
import { hasShopkeeperData } from './shop_types.js';
import { monsterGoldAmount } from './shop_money.js';
import { addUpBill } from './shop_damage.js';
import { rn2 } from './rng.js';
const IZCHAK_SPEAKS = [
    "says: 'These shopping malls give me a headache.'",
    "says: 'Slow down.  Think clearly.'",
    "says: 'You need to take things one at a time.'",
    "says: 'I don't like poofy coffee... give me Colombian Supremo.'",
    "says that getting the devteam's agreement on anything is difficult.",
    "says that he has noticed those who serve their deity will prosper.",
    "says: 'Don't try to steal from me - I have friends in high places!'",
    "says: 'You may well need something from this shop in the future.'",
    'comments about the Valley of the Dead as being a gateway.',
];
export async function chatWithShopkeeper(monster, state = game) {
    if (!monster.isshk) {
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} asks whether you've seen any untended shops recently.`);
        return;
    }
    if (!hasShopkeeperData(monster))
        throw new Error('A shopkeeper needs its shop data to discuss business.');
    const shop = monster.eshk;
    const name = () => shopkeeperName(monster, { state, capitalized: true });
    const speaking = !heroIsDeaf(state) && !shopkeeperIsMuted(monster);
    const subject = () => monsterSubjectPronoun(monster, { state, noIt: true });
    let message;
    if (!monster.mpeaceful) {
        message = `${name()} ${speaking ? 'mentions' : 'indicates'} how much ${subject()} dislikes ${shop.robbed ? 'non-paying' : 'rude'} customers.`;
    }
    else if (shop.following) {
        if (shop.customer !== state.plname) {
            if (speaking)
                await plineWithContinuation(`"${shopGreeting(monster, state)} ${state.plname}!  I was looking for ${shop.customer}."`);
            shop.following = 0;
            return;
        }
        message = speaking ? `"${shopGreeting(monster, state)} ${state.plname}!  Didn't you forget to pay?"`
            : `${name()} taps you on the ${heroArmName(state)}.`;
    }
    else if (shop.billct) {
        const total = addUpBill(monster) + (shop.debit ?? 0);
        message = `${name()} ${speaking ? 'says' : 'indicates'} that your bill comes to ${total} ${currency(total, { state })}.`;
    }
    else if (shop.debit) {
        message = `${name()} ${speaking ? 'reminds you' : 'indicates'} that you owe ${monsterObjectPronoun(monster, { state, noIt: true })} ${shop.debit} ${currency(shop.debit, { state })}.`;
    }
    else if (shop.credit) {
        message = `${name()} encourages you to use your ${shop.credit} ${currency(shop.credit, { state })} of credit.`;
    }
    else if (shop.robbed) {
        message = `${name()} ${speaking ? 'complains' : 'indicates concern'} about a recent robbery.`;
    }
    else if (shop.surcharge) {
        message = `${name()} ${speaking ? 'warns you' : 'indicates'} that ${subject()} is watching you carefully.`;
    }
    else {
        const money = monsterGoldAmount(monster);
        if (money < 50 || money > 4000) {
            message = `${name()} ${speaking ? money < 50 ? 'complains' : 'says' : 'indicates'} that business is ${money < 50 ? 'bad' : 'good'}.`;
        }
        else {
            if (!speaking)
                return;
            const izchak = !heroIsHallucinating(state)
                && inTown(state.level, monster.mx, monster.my)
                && shop.shknam?.replace(/^[^A-Za-z]/, '') === 'Izchak';
            message = izchak ? `${shopkeeperName(monster, { state })} ${IZCHAK_SPEAKS[rn2(IZCHAK_SPEAKS.length)]}`
                : `${name()} talks about the problem of shoplifters.`;
        }
    }
    await plineWithContinuation(message);
}
//# sourceMappingURL=shop_chat.js.map