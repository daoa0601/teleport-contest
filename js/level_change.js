import { game } from './gstate.js';
import { plineWithContinuation } from './pline.js';
// C questpgr.c:deliver_splev_message(): a special level's custom arrival
// message prints once and is freed, so returning to the level later cannot
// repeat it.  Bones loads generate no level script, so they carry none.
// goto_level() (do.ts) delivers this ahead of every other arrival message.
export async function deliverSpecialLevelMessages(active = game._activeSpecialLevel) {
    const messages = active?.specialMessages;
    if (!active || !messages?.length)
        return;
    for (const line of messages)
        await plineWithContinuation(line);
    active.specialMessages = [];
}
//# sourceMappingURL=level_change.js.map