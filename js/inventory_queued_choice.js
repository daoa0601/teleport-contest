import { cmdq_clear, cmdq_pop } from './cmd.js';
import { game } from './gstate.js';
import { CMDQ_KEY, CQ_CANNED } from './const.js';
import { OBJECT_CLASS_SYMBOLS } from './display.js';
// The queued branch of native display_inventory checks class symbols in
// the filter, even when its caller supplied inventory letters instead.
// Undefined means no queued answer; zero means the queue rejected a choice.
export function takeQueuedInventoryChoice(classes = null) {
    // C invent.c:display_inventory(): one cmdq_pop() (invent.c:3430-3447)
    // must yield a CMDQ_KEY naming a visible object of a filtered class;
    // any other entry — or an unmatched letter — clears CQ_CANNED and
    // returns 0.
    const entry = cmdq_pop();
    if (!entry)
        return undefined;
    if (entry.typ === CMDQ_KEY) {
        const object = game.inventory.find(item => item.invlet === String.fromCharCode(entry.key));
        const symbol = object ? OBJECT_CLASS_SYMBOLS[object.oclass] : undefined;
        if (object && (!classes || symbol !== undefined && classes.includes(symbol)))
            return entry.key;
    }
    cmdq_clear(CQ_CANNED);
    return 0;
}
//# sourceMappingURL=inventory_queued_choice.js.map