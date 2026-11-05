import { game } from './gstate.js';
import { plineWithContinuation } from './pline.js';
import type { ActiveSpecialLevel } from './map_types.js';

// C questpgr.c:deliver_splev_message(): a special level's custom arrival
// message prints once and is freed, so returning to the level later cannot
// repeat it.  Bones loads generate no level script, so they carry none.
// goto_level() (do.ts) delivers this ahead of every other arrival message.
export async function deliverSpecialLevelMessages(
    active: ActiveSpecialLevel | null | undefined = game._activeSpecialLevel,
): Promise<void> {
    const messages = active?.specialMessages;
    if (!active || !messages?.length) return;
    for (const line of messages) await plineWithContinuation(line);
    active.specialMessages = [];
}
