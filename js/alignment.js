// Hero alignment record changes.
// C ref: attrib.c adjalign().

import { game } from './gstate.js';

export function adjustHeroAlignment(amount, state = game) {
    if (!amount || !state.u?.ualign) return;
    const alignment = state.u.ualign;
    if (amount < 0) {
        alignment.record = (alignment.record || 0) + amount;
        alignment.abuse = (alignment.abuse ?? 0) - amount;
        return;
    }
    const alignmentLimit = 10 + Math.trunc((state.moves || 0) / 200);
    alignment.record = Math.min(
        alignmentLimit, (alignment.record || 0) + amount,
    );
}
