// C shk.c:make_itemized_bill(), pay_billed_items(), dopayobj(), buy_container().
import { nameShopTransaction } from './shop_speech.js';
import { promptYesNo } from './query.js';
import { currency } from './currency.js';
import { observeObjectForNaming } from './objnam.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster, ShopBillEntry } from './monster_types.js';
import { hasShopBill } from './shop_types.js';
import type { BilledShopkeeper, ShopBillItem, Shopkeeper } from './shop_types.js';
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
import { impossible } from './diagnostics.js';
import { monsterHasNoLimbs } from './monster_data.js';

export function minimumShopPurchase(resident: Monster, state: GameState = game): {
    price: number; multipleItems: boolean;
} | null {
    const bill = itemizedShopBill(resident, state);
    if (!bill.length || !hasShopBill(resident)) return null;
    return {
        price: Math.min(...bill.map(item => item.price)),
        multipleItems: resident.eshk.bill.length > 1 || bill.length > 1
            || bill[0]?.kind === 'hidden-container',
    };
}

// Contents share one entry for their outermost container. Used portions stay
// separate, so they can be paid before buying the remaining contained goods.
export function itemizedShopBill(resident: Monster | null | undefined, state: GameState = game): ShopBillItem[] {
    if (!hasShopBill(resident)) return [];
    const objects = objectsInTimerGraph(state);
    const bill: ShopBillItem[] = [];
    for (const [billIndex, entry] of resident.eshk.bill.entries()) {
        const object = (entry.useup ? state.billObjects ?? [] : objects)
            .find(candidate => candidate.o_id === entry.bo_id);
        if (!object) continue;
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
                if (previous.kind === 'intact') previous.kind = kind;
                continue;
            }
            bill.push({ object: container, kind, quantity: 1,
                price: unpaidObjectCost(container, state, 'contents'),
                billIndex: container.unpaid ? billIndex : -1 });
        } else {
            bill.push({ object, kind: 'intact', quantity: object.quan,
                price: entry.price * object.quan, billIndex });
        }
    }
    return bill.sort((left, right) => Number(right.kind === 'used') - Number(left.kind === 'used')
        || right.price - left.price || left.billIndex - right.billIndex);
}

export async function buyShopBillItem(resident: Monster, item: ShopBillItem,
    state: GameState = game, { itemize = false }: { itemize?: boolean } = {}
): Promise<'paid' | 'skip' | 'stop' | 'broke'> {
    if (!hasShopBill(resident)) return 'stop';
    const container = item.kind === 'known-container' || item.kind === 'hidden-container';
    // buy_container() checks the group price first; dopayobj() rejects a
    // partly used loose stack before considering its intact portion's price.
    if (container) {
        if (!await checkPurchaseFunds(resident, item, state, 0)) return 'stop';
        if (!await checkPurchaseFunds(resident, item, state)) return 'stop';
    }
    let declined = false;
    if (itemize && !container) {
        if (!await checkPurchaseFunds(resident, item, state, 0)) return 'broke';
        observeObjectForNaming(item.object, { state });
        let name = paymentObjectDescription(item.object, item.quantity, { state });
        if (item.quantity === 1) name = name.charAt(0).toUpperCase() + name.slice(1);
        declined = await promptYesNo(`${name} for ${item.price} ${currency(item.price, { state })}.  Pay?`) === 'n';
    }
    const purchases = container ? containedPurchases(resident, item.object, state) : [item.object];
    for (const object of purchases) {
        const entry = resident.eshk.bill.find(candidate => candidate.bo_id === object.o_id);
        if (entry && item.kind !== 'used' && object.quan < entry.bquan) {
            await rejectPartlyUsedPurchase(resident, object, entry, state);
            return container ? 'stop' : 'skip';
        }
    }
    if (declined) return 'skip';
    if (!container && !await checkPurchaseFunds(resident, item, state)) return itemize ? 'skip' : 'stop';
    const unpaidContainer = container && item.object.unpaid;
    let bought = 0;
    for (const object of purchases) {
        const entry = resident.eshk.bill.find(candidate => candidate.bo_id === object.o_id);
        if (!entry) continue;
        const quantity = item.kind === 'used' ? item.quantity : object.quan;
        const price = entry.price * quantity;
        // The group quote uses today's valuation; each bill entry retains
        // its agreed price. Native keeps trying later contents after a refusal.
        if (container && !await checkPurchaseFunds(resident, { ...item, object, quantity }, state, price)) {
            await impossible(`Buying ${simpleObjectName(item.object, state)} contents failed unexpectedly (#${object.o_id} 0).`, { state });
            continue;
        }
        // dopayobj() retains the purchased count through payment and feedback,
        // then restores the intact count before update_bill().
        const originalQuantity = object.quan;
        object.quan = quantity;
        try {
            await payShopkeeper(resident, price, state);
            if (!container) await nameShopTransaction(resident, object,
                name => `${item.kind === 'used' ? 'paid for' : 'bought'} ${name}${
                    item.kind === 'used' ? ' at a cost of' : ' for'} ${price} gold piece${price === 1 ? '' : 's'}.`,
                { publish: plineWithContinuation, state });
        } finally {
            object.quan = originalQuantity;
        }
        if (item.kind === 'used' && object.where !== 'onbill' && object.quan > 0) {
            entry.bquan = object.quan;
        } else {
            object.unpaid = false;
            if (object.where === 'onbill') {
                unlinkObject(object, state);
                deallocateObject(object, state);
            }
            removeBillEntry(resident, entry);
        }
        bought++;
    }
    if (container && bought === 0) {
        await plineWithContinuation(`"You need to remove any unpaid items from that ${simpleObjectName(item.object, state)} and buy them separately."`);
        return 'stop';
    }
    if (container) {
        // buy_container() names the container with its prior ownership, then
        // clears both flags after the purchase summary has finished.
        if (unpaidContainer) {
            item.object.unpaid = true;
            item.object.no_charge = true;
        }
        await nameShopTransaction(resident, item.object,
            name => `bought ${name} for ${item.price} gold piece${item.price === 1 ? '' : 's'}.`,
            { publish: plineWithContinuation, state });
        item.object.unpaid = false;
        item.object.no_charge = false;
    }
    return 'paid';
}

async function checkPurchaseFunds(resident: BilledShopkeeper, item: ShopBillItem,
    state: GameState, cost = item.price): Promise<boolean> {
    const funds = heroGoldAmount(state) + (resident.eshk.credit ?? 0);
    // C insufficient_funds(): zero cost checks for exhausted cash and credit.
    if (cost === 0 && funds === 0) {
        await plineWithContinuation(`You ${hiddenGold(state, true) ? 'seem to ' : ''}have no gold or credit left.`);
        return false;
    }
    if (funds >= cost) return true;
    const originalQuantity = item.object.quan;
    // dopayobj() leaves the payment quantity in place during refusal feedback.
    item.object.quan = item.quantity;
    try {
        await plineWithContinuation(`You don't${hiddenGold(state, true) ? ' seem to' : ''} have gold${
            resident.eshk.credit ? ' or credit' : ''} enough to pay for ${paymentObjectDescription(item.object, item.quantity, { state })}.`);
    } finally {
        item.object.quan = originalQuantity;
    }
    return false;
}

function outermostContainer(object: GameObject): GameObject {
    while (object.container) object = object.container;
    return object;
}

function containerContentsKnown(object: GameObject): boolean {
    while (object.container) {
        object = object.container;
        if (!object.cknown) return false;
    }
    return true;
}

function containedPurchases(resident: BilledShopkeeper, container: GameObject, state: GameState): GameObject[] {
    const objects = objectsInTimerGraph(state);
    const purchases: GameObject[] = [];
    for (const entry of resident.eshk.bill) {
        const object = objects.find(candidate => candidate.o_id === entry.bo_id);
        if (object && object !== container && outermostContainer(object) === container)
            purchases.push(object);
    }
    // Native buys the container last; its prior ownership controls the name.
    if (container.unpaid) purchases.push(container);
    return purchases;
}

async function rejectPartlyUsedPurchase(resident: BilledShopkeeper, object: GameObject,
    entry: ShopBillEntry, state: GameState): Promise<void> {
    const intactQuantity = object.quan;
    // reject_purchase() restores the intact count after feedback returns.
    object.quan = entry.bquan - intactQuantity;
    try {
        const other = simpleObjectName(object, state);
        if (!heroIsDeaf(state) && !shopkeeperIsMuted(resident)) {
            const which = object.container ? `the one${intactQuantity > 1 ? 's' : ''} in ${
                definiteName(simpleObjectName(object.container, state), state)}`
                : intactQuantity > 1 ? 'these' : 'this one';
            await plineWithContinuation(`"${resident.mpeaceful ? 'Please pay' : 'Pay'} for the other ${other} before buying ${which}."`);
        } else {
            const gesture = monsterHasNoLimbs(resident.mnum) ? 'motions to' : 'points out';
            await plineWithContinuation(`${shopkeeperName(resident)} ${resident.mpeaceful ? '' : 'angrily '}${gesture} your bill for the other ${other} first.`);
        }
    } finally {
        object.quan = intactQuantity;
    }
}

export async function payShopkeeper(resident: Shopkeeper, price: number, state: GameState = game): Promise<void> {
    const credit = resident.eshk.credit ?? 0;
    const creditUsed = Math.min(credit, price);
    if (creditUsed)
        await plineWithContinuation(credit >= price ? 'The price is deducted from your credit.'
            : 'The price is partially covered by your credit.');
    resident.eshk.credit = credit - creditUsed;
    const gold = price - creditUsed;
    if (gold) {
        const payment = detachHeroGold(state, gold);
        if (payment) payment.where = 'gone';
        resident.gold = (resident.gold ?? 0) + gold;
        state._capacityDirty = true;
    }
    resident.eshk.robbed = Math.max(0, (resident.eshk.robbed ?? 0) - price);
    state.context.botl = true;
}

// Native compaction overwrites the vacated slot and preserves its identity.
function removeBillEntry(resident: BilledShopkeeper, entry: ShopBillEntry): void {
    const last = resident.eshk.bill.pop();
    if (last && last !== entry) {
        entry.bo_id = last.bo_id;
        entry.bquan = last.bquan;
        entry.price = last.price;
        entry.useup = last.useup;
    }
    resident.eshk.billct = resident.eshk.bill.length;
}
