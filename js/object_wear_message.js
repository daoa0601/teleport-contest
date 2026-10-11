// C do_wear.c:on_msg(). Zero-delay armor uses xname; accessories use prinv.
import { heroHeadName } from './body_parts.js';
import { W_AMUL, W_RING, W_TOOL } from './const.js';
import { game } from './gstate.js';
import { TOWEL } from './object_data.js';
import { objectDescription } from './object_description.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { objectHasPersonalName, objectName, observeObjectForNaming } from './objnam.js';
export function objectWearMessage(object, state = game) {
    const mask = object.owornmask ?? 0;
    const verbose = state.flags.verbose !== false;
    const inventoryFeedback = !!(mask & (W_RING | W_AMUL)) || !!(mask & W_TOOL) && !verbose;
    if (!inventoryFeedback && !verbose)
        return null;
    observeObjectForNaming(object, { state });
    if (inventoryFeedback)
        return `${object.invlet} - ${objectDescription(object, { state })}.`;
    const noun = objectName(object, state);
    const name = objectHasPersonalName(object, state) ? `the ${noun}` : withIndefiniteArticle(noun);
    const how = object.otyp === TOWEL ? ` around your ${heroHeadName(state)}` : '';
    return `You are now wearing ${name}${how}.`;
}
//# sourceMappingURL=object_wear_message.js.map