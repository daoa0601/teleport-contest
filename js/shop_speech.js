import { observeObject, learnObjectType } from './object_knowledge.js';
import { MIRROR, OBJECT_MAGIC } from './object_data.js';
import { paymentObjectDescription } from './object_description.js';
import { objectTypeKnown } from './shk.js';
import { shopStocksObject } from './shop_sell.js';
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
export async function nameShopTransaction(keeper, object, describe, { publish, state }) {
    let wasUnknown = !object.dknown;
    observeObject(object, state);
    if (!OBJECT_MAGIC[object.otyp] && shopStocksObject(keeper.eshk.shoptype, object)
        && ([WEAPON_CLASS, ARMOR_CLASS, SCROLL_CLASS, SPBOOK_CLASS].includes(object.oclass) || object.otyp === MIRROR)) {
        wasUnknown ||= !objectTypeKnown(object, state);
        learnObjectType(object.otyp, state);
    }
    const name = paymentObjectDescription(object, object.quan, { state });
    if (wasUnknown) {
        const subject = name.charAt(0).toUpperCase() + name.slice(1);
        await publish(`${subject}; you ${describe(object.quan > 1 ? 'them' : 'it')}`);
    }
    else {
        await publish(`You ${describe(name)}`);
    }
}
//# sourceMappingURL=shop_speech.js.map