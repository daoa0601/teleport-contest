import { game } from './gstate.js';
import { bot, canSpotMonster, flush_screen, pline, plineWithContinuation } from './display.js';
import { cansee } from './vision.js';
import { heroIsBlind } from './senses.js';
import { distmin } from './hacklib.js';
import { shopkeeperName, monsterName } from './monster_name.js';
import { selectMapPosition } from './getpos.js';
import { hasShopkeeperData } from './shop_types.js';
import type { Shopkeeper } from './shop_types.js';
import { payShopDebt, shopkeeperForHero, shopkeeperInOwnShop, shopThankYouMessage } from './shk.js';
import { rileShopkeeper } from './shop_damage.js';
import { heroGoldAmount } from './hero_gold.js';
import { hiddenGold } from './gold.js';
import { rn2 } from './rng.js';
import { itemizedShopBill, minimumShopPurchase, buyShopBillItem } from './shop_payment.js';
import { observeObjectForNaming } from './objnam.js';
import { paymentObjectDescription } from './object_description.js';
import { showMultiSelectWindow } from './windows.js';

// C refs: shk.c:dopay(), rouse_shk(), menu_pick_pay_items(), pay(), and update_bill().
// An empty bill takes a turn when the keeper can respond. A payment menu
// takes no time until a debt or billed item is paid.
export async function dopay(): Promise<void> {
    game.multi = 0;
    const resident = await choosePaymentShopkeeper();
    if (!resident) {
        game.context.move = 0;
        return;
    }

    if (resident.msleeping || !resident.mcanmove) {
        // Outstanding charges rouse the keeper before payment can proceed.
        if (resident.eshk?.robbed || resident.eshk?.billct || resident.eshk?.debit) {
            if (canSpotMonster(resident)) {
                const recovery = resident.msleeping ? 'wakes up' : 'can move again';
                await plineWithContinuation(`${shopkeeperName(resident, { capitalized: true })} ${recovery}.`);
            }
            resident.msleeping = 0;
            resident.mfrozen = 0;
            resident.mcanmove = 1;
        } else {
            const name = shopkeeperName(resident, { capitalized: true });
            const response = rn2(2) ? 'seems to be napping' : "doesn't respond";
            await plineWithContinuation(`${name} ${response}.`);
            game.context.move = 0;
            return;
        }
    }

    if (resident !== shopkeeperForHero() && resident.mpeaceful && !resident.eshk?.robbed) {
        await plineWithContinuation(`You do not owe ${shopkeeperName(resident)} anything.`);
        game.context.move = 1;
        return;
    }

    let paid = false;
    const debt = Math.max(0, resident.eshk?.debit ?? 0);
    if (debt) {
        await pline(
            `You owe ${shopkeeperName(resident)} ${debt} zorkmid${
                debt === 1 ? '' : 's'
            } for the use of merchandise.`,
        );
        const payment = payShopDebt(resident, game);
        if (!payment.paid) {
            await pline("But you don't have enough gold or credit.");
            game.context.move = 1;
            return;
        }
        if (payment.creditUsed === payment.debt) {
            await pline('Your debt is covered by your credit.');
        } else if (payment.creditUsed) {
            await pline('That debt is partially offset by your credit.');
            await pline('You pay the remainder.');
        } else {
            await pline('You pay that debt.');
        }
        paid = true;
    }

    // pay_billed_items() checks the whole bill, including contained goods,
    // before offering item selection. Stashed gold cannot fund this payment.
    if (resident === shopkeeperForHero() && (resident.eshk?.billct ?? 0) > 0
        && !heroGoldAmount(game) && !(resident.eshk?.credit ?? 0)) {
        await plineWithContinuation(`You ${hiddenGold(game, true) ? 'seem to ' : ''}have no gold or credit${paid ? ' left' : ''}.`);
        if (paid && resident.mpeaceful)
            await plineWithContinuation(shopThankYouMessage(resident));
        game.context.move = paid ? 1 : 0;
        return;
    }

    if (resident === shopkeeperForHero()) {
        const purchase = minimumShopPurchase(resident);
        if (purchase && heroGoldAmount(game) + (resident.eshk?.credit ?? 0) < purchase.price) {
            const items = purchase.multipleItems ? ' any of the items' : ' the item';
            const bill = (resident.eshk?.billct ?? 0) > 1 ? "you've picked" : 'on your bill';
            await plineWithContinuation(`You don't have enough gold to buy${items} ${bill}.`);
            if (hiddenGold(game, true))
                await plineWithContinuation('Maybe you have some gold stashed away?');
            if (paid && resident.mpeaceful)
                await plineWithContinuation(shopThankYouMessage(resident));
            game.context.move = paid ? 1 : 0;
            return;
        }
    }

    const billed = itemizedShopBill(resident);
    if (!billed.length) {
        if (!paid) {
            await plineWithContinuation(`You do not owe ${shopkeeperName(resident)} anything.`);
            if (resident === shopkeeperForHero() && resident.mpeaceful && !heroGoldAmount(game))
                await plineWithContinuation(`Moreover, you${hiddenGold(game, true) ? ' seem to' : ''} have no gold.`);
            game.context.move = 1;
            return;
        }
        await plineWithContinuation(shopThankYouMessage(resident));
        game.context.move = 1;
        return;
    }

    for (const item of billed) observeObjectForNaming(item.object);
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
    const selected = await showMultiSelectWindow({
        title: 'Pay for which items?', sections,
        omitHeadings: !used.length,
    });
    if (!selected.length) {
        game.context.move = paid ? 1 : 0;
        return;
    }

    let paidForItem = false;
    let finished = true;
    // Native queued selection buys in bill order, regardless of selection order.
    for (const item of billed.filter(item => selected.includes(item))) {
        const result = await buyShopBillItem(resident, item);
        if (result === 'stop') {
            finished = false;
            break;
        }
        if (result === 'skip') continue;
        paidForItem = true;
        await bot();
    }
    if (!paid && !paidForItem) {
        game.context.move = 0;
        return;
    }
    if (finished && resident.mpeaceful)
        await plineWithContinuation(shopThankYouMessage(resident));
    game.context.move = 1;
}

// next_shkp() applies the surcharge as it visits angry keepers. The linked
// native monster list runs from the newest monster to the oldest.
async function choosePaymentShopkeeper(): Promise<Shopkeeper | null> {
    const shopkeepers: Shopkeeper[] = [];
    let nearby: Shopkeeper | null = null;
    let nearbyCount = 0;
    let visibleCount = 0;
    let resident: Shopkeeper | null = null;
    const adjacent = (keeper: Shopkeeper) =>
        distmin(keeper.mx, keeper.my, game.u.ux, game.u.uy) <= 1;
    for (const monster of [...(game.level?.monsters ?? [])].reverse()) {
        if (!monster.isshk || monster.dead || monster.mhp <= 0 || !hasShopkeeperData(monster)) continue;
        if (!monster.mpeaceful && !monster.eshk.surcharge) rileShopkeeper(monster);
        shopkeepers.push(monster);
        if (adjacent(monster)) {
            // Once an angry neighbor has priority, C skips the remaining
            // visibility and residency checks for other adjacent keepers.
            if (nearby && !nearby.mpeaceful) continue;
            nearbyCount++;
            nearby = monster;
        }
        if (canSpotMonster(monster)) visibleCount++;
        if (shopkeeperInOwnShop(monster) && game.u.ushops?.[0] === monster.eshk.shoproom)
            resident = monster;
    }
    if (nearby && nearbyCount === 1) return nearby;
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
    if (shopkeepers.length === 1 && resident) return resident;
    if (visibleCount === 1) {
        const keeper = shopkeepers.find(monster => canSpotMonster(monster));
        if (!keeper) throw new Error('Visible shopkeeper disappeared during payment.');
        if (keeper !== resident && !adjacent(keeper)) {
            await pline(`${shopkeeperName(keeper, { capitalized: true })} is not near enough to receive your payment.`);
            return null;
        }
        return keeper;
    }
    const position = await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy },
        prompt: 'Pay whom?', goal: 'the creature you want to pay',
    });
    if (!position) return null;
    if (position.x === game.u.ux && position.y === game.u.uy) {
        await pline('You are generous to yourself.');
        return null;
    }
    const monster = game.level?.monsters.find(candidate => !candidate.dead
        && candidate.mhp > 0 && candidate.mx === position.x && candidate.my === position.y);
    if (!cansee(position.x, position.y) && (!monster || !canSpotMonster(monster))) {
        await pline(`You can't ${blind ? 'sense' : 'see'} anyone there.`);
    } else if (!monster) {
        await pline('There is no one there to receive your payment.');
    } else if (!monster.isshk || !hasShopkeeperData(monster)) {
        await pline(`${monsterName(monster, { capitalized: true })} is not interested in your payment.`);
    } else if (monster !== resident && !adjacent(monster)) {
        await pline(`${shopkeeperName(monster, { capitalized: true })} is too far to receive your payment.`);
    } else {
        return monster;
    }
    return null;
}
