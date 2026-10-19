import { setMulti } from './command_state.js';
import { MENU_FULL, MENU_TRADITIONAL } from './const.js';
import { promptChoice } from './query.js';
import { game } from './gstate.js';
import { bot, canSpotMonster, flush_screen, pline, plineWithContinuation } from './display.js';
import { cansee } from './vision.js';
import { heroIsBlind } from './senses.js';
import { distmin } from './hacklib.js';
import { shopkeeperName, monsterName, monsterSubjectPronoun, monsterObjectPronoun, monsterPossessive } from './monster_name.js';
import { describeGetposLocation, selectMapPosition, showGetposInstructions, showGetposTip } from './getpos.js';
import { hasShopkeeperData } from './shop_types.js';
import { payShopDebt, shopkeeperInOwnShop, shopThankYouMessage } from './shk.js';
import { rileShopkeeper, makeShopkeeperHappy, setPaidShopkeeper } from './shop_damage.js';
import { heroGoldAmount } from './hero_gold.js';
import { currency } from './currency.js';
import { hiddenGold } from './gold.js';
import { rn2 } from './rng.js';
import { itemizedShopBill, minimumShopPurchase, buyShopBillItem, payShopkeeper } from './shop_payment.js';
import { observeObjectForNaming } from './objnam.js';
import { paymentObjectDescription } from './object_description.js';
import { rouseShopkeeper } from './shop_sell.js';
import { monsterIsHelpless } from './monster_sleep.js';
import { impossible } from './diagnostics.js';
import { showMultiSelectWindow } from './windows.js';
// C refs: shk.c:dopay(), rouse_shk(), menu_pick_pay_items(), pay(), and update_bill().
// An empty bill takes a turn when the keeper can respond. A payment menu
// takes no time until a debt or billed item is paid.
export async function dopay() {
    setMulti(0);
    const stashedGold = hiddenGold(game, true) > 0;
    const target = await choosePaymentShopkeeper();
    if (!target) {
        game.context.move = 0;
        return;
    }
    const { keeper, resident } = target;
    const shop = keeper.eshk;
    const robbed = shop.robbed ?? 0;
    if (robbed || shop.billct || shop.debit)
        await rouseShopkeeper(keeper);
    if (monsterIsHelpless(keeper)) {
        const name = shopkeeperName(keeper, { capitalized: true });
        const response = rn2(2) ? 'seems to be napping' : "doesn't respond";
        await plineWithContinuation(`${name} ${response}.`);
        game.context.move = 0;
        return;
    }
    if (keeper !== resident && keeper.mpeaceful) {
        await payOutsideShop(keeper, robbed, stashedGold);
        game.context.move = 1;
        return;
    }
    if (!shop.billct && !shop.debit) {
        await settleEmptyBill(keeper, robbed, stashedGold);
        game.context.move = 1;
        return;
    }
    if (keeper !== resident) {
        await impossible('dopay: not to shopkeeper?');
        if (resident)
            setPaidShopkeeper(resident);
        game.context.move = 0;
        return;
    }
    let paid = false;
    const debt = Math.max(0, keeper.eshk?.debit ?? 0);
    if (debt) {
        const loan = keeper.eshk.loan ?? 0;
        const reason = !loan ? 'for the use of merchandise.'
            : loan === debt ? 'you picked up in the store.'
                : 'for gold picked up and the use of merchandise.';
        await plineWithContinuation(`You owe ${shopkeeperName(keeper)} ${debt} ${currency(debt)} ${reason}`);
        const payment = await payShopDebt(keeper, game);
        if (!payment.paid) {
            await plineWithContinuation(`But you don't${stashedGold ? ' seem to' : ''} have enough gold${keeper.eshk.credit ? ' or credit' : ''}.`);
            game.context.move = 1;
            return;
        }
        if (payment.creditUsed === payment.debt) {
            await plineWithContinuation('Your debt is covered by your credit.');
        }
        else if (payment.creditUsed) {
            await plineWithContinuation('That debt is partially offset by your credit.');
            await plineWithContinuation('You pay the remainder.');
        }
        else {
            await plineWithContinuation('You pay that debt.');
        }
        paid = true;
    }
    // pay_billed_items() checks the whole bill, including contained goods,
    // before offering item selection. Stashed gold cannot fund this payment.
    if (keeper === resident && (keeper.eshk?.billct ?? 0) > 0
        && !heroGoldAmount(game) && !(keeper.eshk?.credit ?? 0)) {
        await plineWithContinuation(`You ${hiddenGold(game, true) ? 'seem to ' : ''}have no gold or credit${paid ? ' left' : ''}.`);
        if (paid && keeper.mpeaceful)
            await plineWithContinuation(shopThankYouMessage(keeper));
        game.context.move = paid ? 1 : 0;
        return;
    }
    if (keeper === resident) {
        const purchase = minimumShopPurchase(keeper);
        if (purchase && heroGoldAmount(game) + (keeper.eshk?.credit ?? 0) < purchase.price) {
            const items = purchase.multipleItems ? ' any of the items' : ' the item';
            const bill = (keeper.eshk?.billct ?? 0) > 1 ? "you've picked" : 'on your bill';
            await plineWithContinuation(`You don't have enough gold to buy${items} ${bill}.`);
            if (hiddenGold(game, true))
                await plineWithContinuation('Maybe you have some gold stashed away?');
            if (paid && keeper.mpeaceful)
                await plineWithContinuation(shopThankYouMessage(keeper));
            game.context.move = paid ? 1 : 0;
            return;
        }
    }
    const billed = itemizedShopBill(keeper);
    if (!billed.length) {
        if (!paid) {
            await plineWithContinuation(`You do not owe ${shopkeeperName(keeper)} anything.`);
            if (keeper === resident && keeper.mpeaceful && !heroGoldAmount(game))
                await plineWithContinuation(`Moreover, you${hiddenGold(game, true) ? ' seem to' : ''} have no gold.`);
            game.context.move = 1;
            return;
        }
        if (keeper.mpeaceful)
            await plineWithContinuation(shopThankYouMessage(keeper));
        game.context.move = 1;
        return;
    }
    const selection = await chooseBilledItems(billed, minimumShopPurchase(keeper)?.multipleItems ?? false);
    let paidForItem = false;
    let finished = true;
    // Native queued selection buys in bill order, regardless of selection order.
    for (const item of selection.items) {
        const result = await buyShopBillItem(keeper, item, game, { itemize: selection.itemize });
        if (result === 'broke') {
            paidForItem = true;
            break;
        }
        if (result === 'stop') {
            finished = false;
            break;
        }
        if (result === 'skip')
            continue;
        paidForItem = true;
        if (selection.itemize || selection.queued)
            await bot();
    }
    game.iflags.menu_requested = false;
    if (!paid && !paidForItem) {
        game.context.move = 0;
        return;
    }
    if (finished && keeper.mpeaceful)
        await plineWithContinuation(shopThankYouMessage(keeper));
    game.context.move = 1;
}
async function chooseBilledItems(billed, multiple) {
    let viaMenu = (game.flags.menu_style ?? MENU_FULL) !== MENU_TRADITIONAL;
    if (game.iflags.menu_requested)
        viaMenu = !viaMenu;
    if (!viaMenu) {
        const answer = multiple
            ? await promptChoice('Itemized billing?', ['y', 'n', 'q', 'm'], 'q', { visibleChoices: 'ynq m' })
            : 'y';
        if (answer === 'q')
            return { items: [], itemize: false, queued: false };
        if (answer !== 'm')
            return { items: billed, itemize: answer === 'y', queued: false };
    }
    const selected = await paymentMenu(billed);
    return { items: billed.filter(item => selected.includes(item)), itemize: false, queued: true };
}
async function paymentMenu(billed) {
    for (const item of billed)
        observeObjectForNaming(item.object);
    const priceWidth = String(Math.max(...billed.map(item => item.price))).length;
    const used = billed.filter(item => item.kind === 'used');
    const intact = billed.filter(item => item.kind !== 'used');
    const sections = [used, intact].filter(items => items.length).map(items => ({
        heading: used.length ? `${items === used ? 'Used up' : 'Unpaid'} item${items.length > 1 ? 's' : ''}:` : '',
        items: items.map(item => ({
            key: String.fromCharCode(97 + billed.indexOf(item)),
            text: `${String(item.price).padStart(priceWidth)} Zm, ${paymentObjectDescription(item.object, item.quantity)}`,
            value: item,
        })),
    }));
    game._pending_message = '';
    await flush_screen(1);
    return await showMultiSelectWindow({
        title: 'Pay for which items?', sections,
        omitHeadings: !used.length,
    });
}
async function choosePaymentShopkeeper() {
    const shopkeepers = [];
    let nearby = null;
    let nearbyCount = 0;
    let visibleCount = 0;
    let resident = null;
    const adjacent = (keeper) => distmin(keeper.mx, keeper.my, game.u.ux, game.u.uy) <= 1;
    for (const monster of [...(game.level?.monsters ?? [])].reverse()) {
        if (!monster.isshk || monster.dead || monster.mhp <= 0 || !hasShopkeeperData(monster))
            continue;
        if (!monster.mpeaceful && !monster.eshk.surcharge)
            rileShopkeeper(monster);
        shopkeepers.push(monster);
        if (adjacent(monster)) {
            // Once an angry neighbor has priority, C skips the remaining
            // visibility and residency checks for other adjacent keepers.
            if (nearby && !nearby.mpeaceful)
                continue;
            nearbyCount++;
            nearby = monster;
        }
        if (canSpotMonster(monster))
            visibleCount++;
        if (shopkeeperInOwnShop(monster) && game.u.ushops?.[0] === monster.eshk.shoproom)
            resident = monster;
    }
    if (nearby && nearbyCount === 1)
        return { keeper: nearby, resident };
    const blind = heroIsBlind();
    if ((!shopkeepers.length && (!blind || game.u.blindTelepathy || game.u.telepathy))
        || (!blind && !visibleCount)) {
        await pline('There appears to be no shopkeeper here to receive your payment.');
        return null;
    }
    if (!visibleCount) {
        await pline("You can't see...");
        return null;
    }
    if (shopkeepers.length === 1 && resident)
        return { keeper: resident, resident };
    if (visibleCount === 1) {
        const keeper = shopkeepers.find(monster => canSpotMonster(monster));
        if (!keeper)
            throw new Error('Visible shopkeeper disappeared during payment.');
        if (keeper !== resident && !adjacent(keeper)) {
            await pline(`${shopkeeperName(keeper, { capitalized: true })} is not near enough to receive your payment.`);
            return null;
        }
        return { keeper, resident };
    }
    // C shk.c dopay(): pline("Pay whom?"), then getpos() adds its tip and
    // instructions to the same message window before reading a position.
    const goal = 'the creature you want to pay';
    await plineWithContinuation('Pay whom?');
    const tip = await showGetposTip();
    await showGetposInstructions();
    if (tip)
        await plineWithContinuation(`Move cursor to ${goal}:`);
    const position = await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy },
        prompt: game._pending_message, goal, describe: describeGetposLocation,
    });
    game._pending_message = '';
    if (!position)
        return null;
    if (position.x === game.u.ux && position.y === game.u.uy) {
        await pline('You are generous to yourself.');
        return null;
    }
    const monster = game.level?.monsters.find(candidate => !candidate.dead
        && candidate.mhp > 0 && candidate.mx === position.x && candidate.my === position.y);
    if (!cansee(position.x, position.y) && (!monster || !canSpotMonster(monster))) {
        await pline(`You can't ${blind ? 'sense' : 'see'} anyone there.`);
    }
    else if (!monster) {
        await pline('There is no one there to receive your payment.');
    }
    else if (!monster.isshk || !hasShopkeeperData(monster)) {
        await pline(`${monsterName(monster, { capitalized: true })} is not interested in your payment.`);
    }
    else if (monster !== resident && !adjacent(monster)) {
        await pline(`${shopkeeperName(monster, { capitalized: true })} is too far to receive your payment.`);
    }
    else {
        return { keeper: monster, resident };
    }
    return null;
}
// A peaceful keeper away from the hero's shop accepts whatever is offered,
// even when that amount will not settle the robbery.
async function payOutsideShop(keeper, robbed, stashed) {
    const money = heroGoldAmount(game);
    if (!robbed) {
        await plineWithContinuation(`You do not owe ${shopkeeperName(keeper)} anything.`);
    }
    else if (!money) {
        await plineWithContinuation(`You ${stashed ? 'seem to ' : ''}have no gold.`);
        if (stashed)
            await plineWithContinuation('But you have some gold stashed away.');
    }
    else {
        if (money > robbed) {
            await plineWithContinuation(`You give ${shopkeeperName(keeper)} the ${robbed} gold piece${robbed === 1 ? '' : 's'} ${monsterSubjectPronoun(keeper, { noIt: true })} asked for.`);
            await payShopkeeper(keeper, robbed);
        }
        else {
            await plineWithContinuation(`You give ${shopkeeperName(keeper)} all your${stashed ? ' openly kept' : ''} gold.`);
            await payShopkeeper(keeper, money);
            if (stashed)
                await plineWithContinuation('But you have hidden gold!');
        }
        if (money < Math.trunc(robbed / 2) || money < robbed && stashed) {
            await plineWithContinuation(`Unfortunately, ${monsterSubjectPronoun(keeper, { noIt: true })} doesn't look satisfied.`);
        }
        else
            await makeShopkeeperHappy(keeper);
    }
}
async function settleEmptyBill(keeper, robbed, stashed) {
    const money = heroGoldAmount(game);
    if (!robbed && keeper.mpeaceful) {
        await plineWithContinuation(`You do not owe ${shopkeeperName(keeper)} anything.`);
        if (!money)
            await plineWithContinuation(`Moreover, you${stashed ? ' seem to' : ''} have no gold.`);
    }
    else if (robbed) {
        await plineWithContinuation(`${shopkeeperName(keeper)} is after blood, not gold!`);
        if (money < Math.trunc(robbed / 2) || money < robbed && stashed) {
            await rejectRestitution(keeper, money, stashed);
            return;
        }
        await plineWithContinuation(`But since ${monsterPossessive(keeper, { noIt: true })} shop has been robbed recently,`);
        await plineWithContinuation(`you ${money < robbed ? 'partially ' : ''}compensate ${shopkeeperName(keeper)} for ${monsterPossessive(keeper, { noIt: true })} losses.`);
        await payShopkeeper(keeper, Math.min(money, robbed));
        await makeShopkeeperHappy(keeper);
    }
    else {
        await plineWithContinuation(`${shopkeeperName(keeper, { capitalized: true })} is after your hide, not your gold!`);
        if (money < 1000) {
            await rejectRestitution(keeper, money, stashed);
            return;
        }
        const name = canSpotMonster(keeper)
            ? monsterName(keeper, { adjective: 'angry' }) : shopkeeperName(keeper);
        await plineWithContinuation(`You try to appease ${name} by giving ${monsterObjectPronoun(keeper, { noIt: true })} 1000 gold pieces.`);
        await payShopkeeper(keeper, 1000);
        if (keeper.eshk.customer !== game.plname || rn2(3))
            await makeShopkeeperHappy(keeper);
        else
            await plineWithContinuation(`But ${shopkeeperName(keeper)} is as angry as ever.`);
    }
}
async function rejectRestitution(keeper, money, stashed) {
    await plineWithContinuation(!money
        ? `Moreover, you${stashed ? ' seem to' : ''} have no gold.`
        : `Besides, you don't have enough to interest ${monsterObjectPronoun(keeper, { noIt: true })}.`);
}
//# sourceMappingURL=shop_pay_command.js.map