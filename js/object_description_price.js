// C objnam.c:doname_base() pricing suffixes. Describing a current price also
// remembers the quote and chooses the displayed currency.
import { currency } from './currency.js';
import { game } from './gstate.js';
import { priceQuoteSuffix, recordObjectPriceQuote } from './object_knowledge.js';
import { getCostOfShopItem, objectIsUnpaid, objectTypeKnown, unpaidObjectCost, } from './shk.js';
export function objectDescriptionPrice(object, { state = game, withPrice = false, } = {}) {
    if (state.iflags.suppress_price || state.program_state.restoring)
        return '';
    if (objectIsUnpaid(object)) {
        const price = unpaidObjectCost(object, state, 'contents');
        return quotedPriceSuffix(object, object.unpaid ? 'unpaid' : 'contents', price, state);
    }
    if (withPrice) {
        const { price, noCharge } = getCostOfShopItem(object, state);
        if (price > 0)
            return quotedPriceSuffix(object, noCharge ? 'contents' : 'for sale', price, state);
        if (noCharge > 0)
            return ' (no charge)';
    }
    return state.flags.price_quotes && !objectTypeKnown(object, state)
        ? priceQuoteSuffix(object.otyp, state) : '';
}
function quotedPriceSuffix(object, label, price, state) {
    const suffix = ` (${label}, ${price} ${currency(price, { state })})`;
    recordObjectPriceQuote(object.otyp, Math.trunc(price / object.quan), 'buy', state);
    return suffix;
}
//# sourceMappingURL=object_description_price.js.map