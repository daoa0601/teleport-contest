// C pickup.c:encumber_msg(). Status reads nearCapacity() live; oldcap
// records only the last completed encumbrance check.
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { encumbranceMessage, nearCapacity } from './weight.js';
export async function reportHeroEncumbrance(state = game, publish = plineWithContinuation) {
    const previous = state._encumbranceLevel ?? 0;
    const capacity = nearCapacity(state);
    const message = encumbranceMessage(previous, capacity, state);
    if (message)
        await publish(message);
    // pline() may wait for a pager. C requests the next status redraw and
    // commits oldcap only after that message has returned.
    if (previous !== capacity)
        state.context.botl = true;
    state._encumbranceLevel = capacity;
}
//# sourceMappingURL=encumbrance.js.map