// C shk.c:make_itemized_bill(), pay_billed_items(), dopayobj(), buy_container().
import { game } from './gstate.js';
import { hasShopBill } from './shop_types.js';
import { objectsInTimerGraph } from './object_timers.js';
import { unpaidObjectCost } from './shk.js';
import { hiddenGold } from './gold.js';
import { detachHeroGold, heroGoldAmount } from './hero_gold.js';
import { paymentObjectDescription } from './object_description.js';
import { definiteName, simpleObjectName } from './objnam.js';
import { plineWithContinuation } from './display.js';
import { shopkeeperIsMuted } from './shop_loss.js';
import { heroIsDeaf } from './senses.js';
import { shopkeeperName } from './monster_name.js';
import { unlinkObject } from './object_location.js';
import { deallocateObject } from './object_delete.js';
export function minimumShopPurchase(resident, state = game) {
    const bill = itemizedShopBill(resident, state);
    if (!bill.length || !hasShopBill(resident))
        return null;
    return {
        price: Math.min(...bill.map(item => item.price)),
        multipleItems: resident.eshk.bill.length > 1 || bill.length > 1
            || bill[0]?.kind === 'hidden-container',
    };
}
// Contents share one entry for their outermost container. Used portions stay
// separate, so they can be paid before buying the remaining contained goods.
export function itemizedShopBill(resident, state = game) {
    if (!hasShopBill(resident))
        return [];
    const objects = objectsInTimerGraph(state);
    const bill = [];
    for (const [billIndex, entry] of resident.eshk.bill.entries()) {
        const object = (entry.useup ? state.billObjects ?? [] : objects)
            .find(candidate => candidate.o_id === entry.bo_id);
        if (!object)
            continue;
        if (object.where === 'onbill' || object.quan === 0) {
            bill.push({ object, kind: 'used', quantity: entry.bquan,
                price: entry.price * entry.bquan, billIndex });
            continue;
        }
        if (object.quan < entry.bquan) {
            const quantity = entry.bquan - object.quan;
            bill.push({ object, kind: 'used', quantity,
                price: entry.price * quantity, billIndex });
        }
        if (object.container || object.contents?.length) {
            const container = outermostContainer(object);
            const previous = bill.find(item => item.object === container);
            const kind = container === object ? 'intact'
                : containerContentsKnown(object) ? 'known-container' : 'hidden-container';
            if (previous) {
                if (previous.kind === 'intact')
                    previous.kind = kind;
                continue;
            }
            bill.push({ object: container, kind, quantity: 1,
                price: unpaidObjectCost(container, state, 'contents'),
                billIndex: container.unpaid ? billIndex : -1 });
        }
        else {
            bill.push({ object, kind: 'intact', quantity: object.quan,
                price: entry.price * object.quan, billIndex });
        }
    }
    return bill.sort((left, right) => Number(right.kind === 'used') - Number(left.kind === 'used')
        || right.price - left.price || left.billIndex - right.billIndex);
}
export async function buyShopBillItem(resident, item, state = game) {
    if (!hasShopBill(resident))
        return 'stop';
    const container = item.kind === 'known-container' || item.kind === 'hidden-container';
    // buy_container() checks the group price first; dopayobj() rejects a
    // partly used loose stack before considering its intact portion's price.
    if (container && !await checkPurchaseFunds(resident, item, state))
        return 'stop';
    const purchases = container ? containedPurchases(resident, item.object, state) : [item.object];
    for (const object of purchases) {
        const entry = resident.eshk.bill.find(candidate => candidate.bo_id === object.o_id);
        if (entry && item.kind !== 'used' && object.quan < entry.bquan) {
            await rejectPartlyUsedPurchase(resident, object, entry, state);
            return container ? 'stop' : 'skip';
        }
    }
    if (!container && !await checkPurchaseFunds(resident, item, state))
        return 'stop';
    // Only buy_container() suppresses "an unpaid" for a grouped purchase.
    const name = paymentObjectDescription(item.object, item.quantity, { state, purchasingContents: container });
    for (const object of purchases) {
        const entry = resident.eshk.bill.find(candidate => candidate.bo_id === object.o_id);
        if (!entry)
            continue;
        const quantity = item.kind === 'used' ? item.quantity : object.quan;
        await payBillPrice(resident, entry.price * quantity, state);
        if (item.kind === 'used' && object.where !== 'onbill' && object.quan > 0) {
            entry.bquan = object.quan;
        }
        else {
            object.unpaid = false;
            if (object.where === 'onbill') {
                unlinkObject(object, state);
                deallocateObject(object, state);
            }
            removeBillEntry(resident, entry);
        }
    }
    await plineWithContinuation(`You ${item.kind === 'used' ? 'paid for' : 'bought'} ${name}${item.kind === 'used' ? ' at a cost of' : ' for'} ${item.price} gold piece${item.price === 1 ? '' : 's'}.`);
    return 'paid';
}
async function checkPurchaseFunds(resident, item, state) {
    if (heroGoldAmount(state) + (resident.eshk.credit ?? 0) >= item.price)
        return true;
    await plineWithContinuation(`You don't${hiddenGold(state, true) ? ' seem to' : ''} have gold${resident.eshk.credit ? ' or credit' : ''} enough to pay for ${paymentObjectDescription(item.object, item.quantity, { state })}.`);
    return false;
}
function outermostContainer(object) {
    while (object.container)
        object = object.container;
    return object;
}
function containerContentsKnown(object) {
    while (object.container) {
        object = object.container;
        if (!object.cknown)
            return false;
    }
    return true;
}
function containedPurchases(resident, container, state) {
    const objects = objectsInTimerGraph(state);
    const purchases = [];
    for (const entry of resident.eshk.bill) {
        const object = objects.find(candidate => candidate.o_id === entry.bo_id);
        if (object && object !== container && outermostContainer(object) === container)
            purchases.push(object);
    }
    // Native buys the container last; its prior ownership controls the name.
    if (container.unpaid)
        purchases.push(container);
    return purchases;
}
async function rejectPartlyUsedPurchase(resident, object, entry, state) {
    const other = simpleObjectName({ ...object, quan: entry.bquan - object.quan }, state);
    if (!heroIsDeaf(state) && !shopkeeperIsMuted(resident)) {
        const which = object.container ? `the one${object.quan > 1 ? 's' : ''} in ${definiteName(simpleObjectName(object.container, state), state)}`
            : object.quan > 1 ? 'these' : 'this one';
        await plineWithContinuation(`"${resident.mpeaceful ? 'Please pay' : 'Pay'} for the other ${other} before buying ${which}."`);
    }
    else {
        await plineWithContinuation(`${shopkeeperName(resident)} ${resident.mpeaceful ? '' : 'angrily '}points out your bill for the other ${other} first.`);
    }
}
async function payBillPrice(resident, price, state) {
    const credit = resident.eshk.credit ?? 0;
    const creditUsed = Math.min(credit, price);
    if (creditUsed)
        await plineWithContinuation(credit >= price ? 'The price is deducted from your credit.'
            : 'The price is partially covered by your credit.');
    resident.eshk.credit = credit - creditUsed;
    const gold = price - creditUsed;
    if (gold) {
        const payment = detachHeroGold(state, gold);
        if (payment)
            payment.where = 'gone';
        resident.gold = (resident.gold ?? 0) + gold;
        state._capacityDirty = true;
    }
    resident.eshk.robbed = Math.max(0, (resident.eshk.robbed ?? 0) - price);
    state.context.botl = true;
}
// Native compaction overwrites the vacated slot and preserves its identity.
function removeBillEntry(resident, entry) {
    const last = resident.eshk.bill.pop();
    if (last && last !== entry) {
        entry.bo_id = last.bo_id;
        entry.bquan = last.bquan;
        entry.price = last.price;
        entry.useup = last.useup;
    }
    resident.eshk.billct = resident.eshk.bill.length;
}
//# sourceMappingURL=shop_payment.js.map