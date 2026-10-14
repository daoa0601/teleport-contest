// C shk.c:shop_object(), price_quote(), and shk_embellish().
import { game } from './gstate.js';
import type { GameObject } from './object_types.js';
import { plineWithContinuation } from './display.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { costlySpot, objectTypeKnown, shopObjectUnitCost } from './shk.js';
import { containedBuyCost, objectPricingUnits, shopkeeperIsMuted } from './shop_loss.js';
import { objectDescription } from './object_description.js';
import { observeObjectForNaming } from './objnam.js';
import { currency } from './currency.js';
import { OBJECT_MAGIC } from './object_data.js';
import { rn2 } from './rng.js';
import { showDisclosureOverlay } from './windows.js';

export async function quoteShopGoods(): Promise<boolean> {
    if (heroIsBlind() || heroIsDeaf()) return false;
    const spot = costlySpot(game.u.ux, game.u.uy);
    if (!spot || !spot.resident.mpeaceful || shopkeeperIsMuted(spot.resident)) return false;
    const goods = game.level?.objects[game.u.ux]?.[game.u.uy]?.filter(object => object.oclass !== 12) ?? [];
    if (!goods.length) return false;
    const quotes = goods.map(object => {
        let cost = object.no_charge || object === game.uball || object === game.uchain
            ? 0 : shopObjectUnitCost(object, spot.resident);
        const contentsOnly = !cost;
        if (object.contents?.length)
            cost += containedBuyCost(object, spot.resident, { unpaidOnly: false });
        if (object.globby) cost *= objectPricingUnits(object);
        observeObjectForNaming(object);
        const name = `${cost && contentsOnly ? 'the contents of ' : ''}${objectDescription(object)}`;
        const each = object.quan > 1 ? ' each' : '';
        return { object, cost, contentsOnly, each, name,
            line: `${name}, ${cost ? `${cost} ${currency(cost)}${each}` : 'no charge'}` };
    });
    const quote = quotes[0];
    if (!quote) throw new Error('Shop goods disappeared during a price quote.');
    if (quotes.length > 1) {
        await showDisclosureOverlay(['Fine goods for sale:', '', ...quotes.map(item => item.line)],
            { restoreUnderlay: true });
    } else if (!quote.cost) {
        await plineWithContinuation(`"${capitalize(quote.line)}!"`);
    } else {
        const name = `${quote.contentsOnly ? 'the contents of ' : ''}${objectDescription(quote.object)}`;
        await plineWithContinuation(`"${capitalize(name)}, price ${quote.cost} ${currency(quote.cost)}${quote.each}${
            quote.contentsOnly ? '.' : embellish(quote.object, quote.cost)}"`);
    }
    return true;
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function embellish(object: GameObject, cost: number): string {
    if (!rn2(3)) {
        let choice = rn2(5);
        if (!choice) choice = cost < 100 ? 1 : cost < 500 ? 2 : 3;
        switch (choice) {
        case 4:
            if (cost < 10) break;
            if (object.oclass === 7) return ", gourmets' delight!";
            if (objectTypeKnown(object) ? OBJECT_MAGIC[object.otyp]
                : [4, 5, 8, 9, 10, 11].includes(object.oclass))
                return ', painstakingly developed!';
            return ', superb craftsmanship!';
        case 3: return ', finest quality.';
        case 2: return ', an excellent choice.';
        case 1: return ', a real bargain.';
        }
    } else if (object.oartifact) return ', one of a kind!';
    return '.';
}
