// C shk.c:doinvbill(): the used-up bill views behind 'I x'. These commands
// inspect inventory without taking time; the invent.c report commands they
// extend live in invent.ts.
import { game } from './gstate.js';
import type { GameObject } from './object_types.js';
import { currentShopResident, shopkeeperInOwnShop } from './shk.js';
import { objectsInTimerGraph } from './timeout.js';
import { showTextMenuOverlay } from './windows.js';
import { pricedInventoryLine } from './invent.js';

interface BillLine { object: GameObject | null; quantity: number; price: number }

// C shk.c:doinvbill() mode 0: collect the used-up bill lines (and the
// debit) so 'I' can offer the 'x' extension.
export function usedUpBill(): BillLine[] {
    const keeper = currentShopResident();
    if (!keeper || !shopkeeperInOwnShop(keeper)) return [];
    const objects = [...objectsInTimerGraph(), ...game.billObjects ?? []];
    const lines: BillLine[] = [];
    for (const entry of keeper.eshk.bill ?? []) {
        // C shk.c:bp_to_obj(): the bill entry's object, by o_id.
        const object = objects.find(object => object.o_id === entry.bo_id);
        if (object && (entry.useup || object.quan < entry.bquan)) {
            const quantity = entry.useup ? entry.bquan : entry.bquan - object.quan;
            lines.push({ object, quantity, price: quantity * entry.price });
        }
    }
    if (keeper.eshk.debit) lines.push({ object: null, quantity: 0, price: keeper.eshk.debit });
    return lines;
}

// C shk.c:doinvbill() mode 1: page through the used-up articles and their
// total, including the leftover debit.
export async function showBill(bill: readonly BillLine[]): Promise<void> {
    const lines = ['Unpaid articles already used up:', ''];
    let total = 0;
    for (const line of bill) {
        if (!line.object && total) lines.push('');
        lines.push(await pricedInventoryLine(line.object, line.object ? 'x' : '$', line.price,
            line.object ? null : 'usage charges and/or other fees',
            { quantity: line.quantity, useInvlet: false, distant: false }));
        total += line.price;
    }
    lines.push('', await pricedInventoryLine(null, '*', total, 'Total:'));
    // C shk.c:4229 fills the bill window with putstr(), which never reaches
    // add_menu()'s menucoloring.
    await showTextMenuOverlay(lines, { viaPutstr: true });
}
