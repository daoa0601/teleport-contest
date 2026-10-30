import { takeRepeatCommand } from './command_repeat.js';
import { clearCannedCommands } from './command_state.js';
import { game } from './gstate.js';
import { takeCommandResponse } from './input.js';
import { OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
// The queued branch of native display_inventory checks class symbols in
// the filter, even when its caller supplied inventory letters instead.
// Undefined means no queued answer; zero means the queue rejected a choice.
export function takeQueuedInventoryChoice(classes = null) {
    const entry = game._inDoAgain ? takeRepeatCommand() : takeCommandResponse();
    if (entry === undefined && (game._inDoAgain || !game._cannedCommands?.length))
        return undefined;
    const key = typeof entry === 'number' ? entry
        : typeof entry === 'object' && 'kind' in entry && entry.kind === 'key'
            ? entry.key : null;
    if (key !== null) {
        const object = game.inventory.find(item => item.invlet === String.fromCharCode(key));
        const symbol = object ? OBJECT_CLASS_SYMBOLS[object.oclass] : undefined;
        if (object && (!classes || symbol !== undefined && classes.includes(symbol)))
            return key;
    }
    clearCannedCommands();
    return 0;
}
//# sourceMappingURL=inventory_queued_choice.js.map